import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getAdminSession } from '@/lib/session';
import JSZip from 'jszip';

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const formData = await request.formData();
  const zipFile = formData.get('zip_file') as File;
  const term = formData.get('term') as string;
  const session = formData.get('session') as string;
  const publish_mode = (formData.get('publish_mode') as string) ?? 'unpublished';
  const publish_at = formData.get('publish_at') as string | null;

  if (!zipFile || !term || !session) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const maxMB = parseInt(process.env.MAX_BULK_ZIP_SIZE_MB ?? '50', 10);
  const maxBytes = maxMB * 1024 * 1024;

  if (zipFile.size > maxBytes) {
    return NextResponse.json(
      { error: `ZIP file exceeds maximum size of ${maxMB}MB` },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServer();

  // Unzip
  const arrayBuffer = await zipFile.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);

  const pdfFiles = Object.keys(zip.files).filter(
    (name) => name.endsWith('.pdf') && !zip.files[name].dir
  );

  const results = {
    total: pdfFiles.length,
    uploaded: 0,
    failed: 0,
    failures: [] as { filename: string; reason: string }[],
  };

  for (const filename of pdfFiles) {
    // Extract admission_no from filename
    const baseName = filename.split('/').pop()!;
    const admissionNo = baseName.replace('.pdf', '').toUpperCase();

    // Find student
    const { data: student } = await supabase
      .from('students')
      .select('id, class')
      .eq('admission_no', admissionNo)
      .single();

    if (!student) {
      results.failed++;
      results.failures.push({ filename: baseName, reason: 'Student not found' });
      continue;
    }

    try {
      // Get file content
      const fileBuffer = await zip.files[filename].async('nodebuffer');
      const path = `${session}/${student.class}/${student.id}.pdf`;

      // Upload to storage
      const { error: uploadErr } = await supabase.storage
        .from('results')
        .upload(path, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (uploadErr) throw new Error(uploadErr.message);

      // Determine publish state
      const is_published = publish_mode === 'now';
      const scheduledAt = publish_mode === 'scheduled' && publish_at ? publish_at : null;

      // Upsert result row
      const { error: dbErr } = await supabase.from('results').upsert(
        {
          student_id: student.id,
          term,
          session,
          pdf_path: path,
          is_published,
          publish_at: scheduledAt,
          published_at: is_published ? new Date().toISOString() : null,
        },
        { onConflict: 'student_id,term,session' }
      );

      if (dbErr) throw new Error(dbErr.message);

      results.uploaded++;
    } catch (err) {
      results.failed++;
      results.failures.push({
        filename: baseName,
        reason: err instanceof Error ? err.message : 'Upload error',
      });
    }
  }

  return NextResponse.json(results);
}
