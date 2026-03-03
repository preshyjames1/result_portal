import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { setMasterSession } from '@/lib/session';
import type { ApiErrorResponse, MasterVerifyResponse } from '@/types';

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'RATE_LIMITED', message: 'Too many requests. Please wait a minute.' },
      { status: 429 }
    );
  }

  let body: { master_number: string; pin_code: string; term: string; session: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_MASTER_CREDENTIALS' } as ApiErrorResponse, { status: 400 });
  }

  const { master_number, pin_code, term, session } = body;

  if (!master_number || !pin_code || !term || !session) {
    return NextResponse.json({ error: 'INVALID_MASTER_CREDENTIALS' } as ApiErrorResponse, { status: 400 });
  }

  const supabase = createSupabaseServer();

  // 1. Find master pin
  const { data: masterPin, error: masterErr } = await supabase
    .from('master_pins')
    .select('*')
    .eq('master_number', master_number.trim())
    .eq('pin_code', pin_code.trim())
    .eq('is_active', true)
    .single();

  if (masterErr || !masterPin) {
    return NextResponse.json(
      { error: 'INVALID_MASTER_CREDENTIALS' } as ApiErrorResponse,
      { status: 401 }
    );
  }

  // 2. Check usage limit
  if (masterPin.usage_count >= masterPin.usage_limit) {
    return NextResponse.json(
      { error: 'MASTER_PIN_LIMIT_EXCEEDED' } as ApiErrorResponse,
      { status: 403 }
    );
  }

  // 3. Check term restriction
  if (masterPin.term && masterPin.term !== term) {
    return NextResponse.json(
      { error: 'MASTER_PIN_TERM_MISMATCH' } as ApiErrorResponse,
      { status: 403 }
    );
  }

  // 4. Check session restriction
  if (masterPin.session && masterPin.session !== session) {
    return NextResponse.json(
      { error: 'MASTER_PIN_SESSION_MISMATCH' } as ApiErrorResponse,
      { status: 403 }
    );
  }

  // 5. Increment usage count
  await supabase
    .from('master_pins')
    .update({ usage_count: masterPin.usage_count + 1 })
    .eq('id', masterPin.id);

  // 6. Set master_session cookie
  await setMasterSession({
    master_pin_id: masterPin.id,
    scope: masterPin.scope,
    scoped_student_id: masterPin.scoped_student_id,
    term,
    session,
  });

  // 7. Handle scope
  if (masterPin.scope === 'student' && masterPin.scoped_student_id) {
    // Fetch specific student result (ignores is_published)
    const { data: student } = await supabase
      .from('students')
      .select('id, admission_no, full_name, class')
      .eq('id', masterPin.scoped_student_id)
      .single();

    if (!student) {
      return NextResponse.json({ error: 'STUDENT_NOT_FOUND' } as ApiErrorResponse, { status: 404 });
    }

    const { data: result } = await supabase
      .from('results')
      .select('*')
      .eq('student_id', masterPin.scoped_student_id)
      .eq('term', term)
      .eq('session', session)
      .single();

    if (!result) {
      return NextResponse.json({ error: 'NO_RESULT_FOUND' } as ApiErrorResponse, { status: 404 });
    }

    const { data: signedData } = await supabase.storage
      .from('results')
      .createSignedUrl(result.pdf_path, 120);

    if (!signedData?.signedUrl) {
      return NextResponse.json({ error: 'INTERNAL_ERROR' } as ApiErrorResponse, { status: 500 });
    }

    // Log access
    await supabase.from('master_pin_usage').insert({
      master_pin_id: masterPin.id,
      accessed_student_id: masterPin.scoped_student_id,
      term,
      session,
      ip_address: ip,
    });

    const response: MasterVerifyResponse = {
      redirect: 'result',
      student: {
        id: student.id,
        admission_no: student.admission_no,
        full_name: student.full_name,
        class: student.class,
      },
      signed_url: signedData.signedUrl,
    };

    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
  }

  // scope = 'all' → redirect to browse
  const response: MasterVerifyResponse = {
    redirect: 'browse',
    term,
    session,
  };

  return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
}
