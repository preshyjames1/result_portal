import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getAdminSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('pdf') as File;
  const result_id = formData.get('result_id') as string;

  if (!file || !result_id) {
    return NextResponse.json({ error: 'Missing file or result ID' }, { status: 400 });
  }

  const supabase = createSupabaseServer();

  // Fetch existing result to get student_id, term, session, pdf_path
  const { data: existing, error: fetchErr } = await supabase
    .from('results')
    .select('*, students(id, class)')
    .eq('id', result_id)
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'Result not found' }, { status: 404 });
  }

  const studentId = existing.student_id;
  const studentClass = (existing.students as { id: string; class: string } | null)?.class ?? 'unknown';
  const path = `${existing.session}/${studentClass}/${studentId}.pdf`;

  // Upload new PDF — upsert: true replaces the existing file at same path
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadErr } = await supabase.storage
    .from('results')
    .upload(path, fileBuffer, { contentType: 'application/pdf', upsert: true });

  if (uploadErr) {
    return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  // Update pdf_path in DB (same path, but touch updated_at)
  const { error: updateErr } = await supabase
    .from('results')
    .update({ pdf_path: path, updated_at: new Date().toISOString() })
    .eq('id', result_id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
