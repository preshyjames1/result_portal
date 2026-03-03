import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getMasterSession } from '@/lib/session';
import type { ApiErrorResponse } from '@/types';

export async function POST(request: NextRequest) {
  // 1. Validate master session
  const masterSession = await getMasterSession();

  if (!masterSession) {
    return NextResponse.json({ error: 'UNAUTHORIZED' } as ApiErrorResponse, { status: 401 });
  }

  if (masterSession.scope !== 'all') {
    return NextResponse.json({ error: 'UNAUTHORIZED' } as ApiErrorResponse, { status: 403 });
  }

  let body: { admission_no: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' } as ApiErrorResponse, { status: 400 });
  }

  const { admission_no } = body;

  if (!admission_no) {
    return NextResponse.json({ error: 'STUDENT_NOT_FOUND' } as ApiErrorResponse, { status: 400 });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  const supabase = createSupabaseServer();

  // 2. Find student
  const { data: student } = await supabase
    .from('students')
    .select('id, admission_no, full_name, class')
    .eq('admission_no', admission_no.trim().toUpperCase())
    .single();

  if (!student) {
    return NextResponse.json({ error: 'STUDENT_NOT_FOUND' } as ApiErrorResponse, { status: 404 });
  }

  // 3. Find result (ignores is_published — master access)
  const { data: result } = await supabase
    .from('results')
    .select('*')
    .eq('student_id', student.id)
    .eq('term', masterSession.term)
    .eq('session', masterSession.session)
    .single();

  if (!result) {
    return NextResponse.json({ error: 'NO_RESULT_FOUND' } as ApiErrorResponse, { status: 404 });
  }

  // 4. Generate signed URL (120s)
  const { data: signedData } = await supabase.storage
    .from('results')
    .createSignedUrl(result.pdf_path, 120);

  if (!signedData?.signedUrl) {
    return NextResponse.json({ error: 'INTERNAL_ERROR' } as ApiErrorResponse, { status: 500 });
  }

  // 5. Log access (does NOT increment usage_count)
  await supabase.from('master_pin_usage').insert({
    master_pin_id: masterSession.master_pin_id,
    accessed_student_id: student.id,
    term: masterSession.term,
    session: masterSession.session,
    ip_address: ip,
  });

  return NextResponse.json(
    {
      student: {
        id: student.id,
        admission_no: student.admission_no,
        full_name: student.full_name,
        class: student.class,
      },
      signed_url: signedData.signedUrl,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
