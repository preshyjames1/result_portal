import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { setResultSession } from '@/lib/session';
import type { ApiErrorResponse, VerifyResponse } from '@/types';

// Rate limiting (simple in-memory — use Redis in production)
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

  let body: { admission_no: string; pin_code: string; term: string; session: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' } as ApiErrorResponse, { status: 400 });
  }

  const { admission_no, pin_code, term, session } = body;

  if (!admission_no || !pin_code || !term || !session) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' } as ApiErrorResponse, { status: 400 });
  }

  const supabase = createSupabaseServer();

  // 1. Find student
  const { data: student, error: studentErr } = await supabase
    .from('students')
    .select('id, admission_no, full_name, class')
    .eq('admission_no', admission_no.trim().toUpperCase())
    .single();

  if (studentErr || !student) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' } as ApiErrorResponse, { status: 401 });
  }

  // 2. Find pin
  const { data: pin, error: pinErr } = await supabase
    .from('pins')
    .select('*')
    .eq('pin_code', pin_code.trim().toUpperCase())
    .eq('term', term)
    .eq('session', session)
    .single();

  if (pinErr || !pin) {
    return NextResponse.json({ error: 'INVALID_CREDENTIALS' } as ApiErrorResponse, { status: 401 });
  }

  // 3. Check active
  if (!pin.is_active) {
    return NextResponse.json({ error: 'PIN_INACTIVE' } as ApiErrorResponse, { status: 403 });
  }

  // 4. Check usage limit
  if (pin.usage_count >= pin.usage_limit) {
    return NextResponse.json({ error: 'PIN_LIMIT_EXCEEDED' } as ApiErrorResponse, { status: 403 });
  }

  // 5. Check student lock
  if (pin.claimed_by_student_id && pin.claimed_by_student_id !== student.id) {
    return NextResponse.json(
      { error: 'PIN_BELONGS_TO_ANOTHER_STUDENT' } as ApiErrorResponse,
      { status: 403 }
    );
  }

  // 6. TRANSACTION: lock pin + increment + log
  // Claim pin to student if not yet claimed
  if (!pin.claimed_by_student_id) {
    const { error: claimErr } = await supabase
      .from('pins')
      .update({ claimed_by_student_id: student.id })
      .eq('id', pin.id)
      .is('claimed_by_student_id', null); // optimistic lock

    if (claimErr) {
      // Re-check in case another request claimed it simultaneously
      const { data: refreshedPin } = await supabase
        .from('pins')
        .select('claimed_by_student_id')
        .eq('id', pin.id)
        .single();

      if (refreshedPin?.claimed_by_student_id && refreshedPin.claimed_by_student_id !== student.id) {
        return NextResponse.json(
          { error: 'PIN_BELONGS_TO_ANOTHER_STUDENT' } as ApiErrorResponse,
          { status: 403 }
        );
      }
    }
  }

  // Increment usage count
  await supabase
    .from('pins')
    .update({ usage_count: pin.usage_count + 1 })
    .eq('id', pin.id);

  // Log usage
  await supabase.from('pin_usage').insert({
    pin_id: pin.id,
    student_id: student.id,
    ip_address: ip,
  });

  // 7. Find published result
  const { data: result, error: resultErr } = await supabase
    .from('results')
    .select('*')
    .eq('student_id', student.id)
    .eq('term', term)
    .eq('session', session)
    .single();

  if (resultErr || !result) {
    return NextResponse.json({ error: 'NO_RESULT_FOUND' } as ApiErrorResponse, { status: 404 });
  }

  if (!result.is_published) {
    return NextResponse.json(
      { error: 'RESULT_NOT_YET_PUBLISHED' } as ApiErrorResponse,
      { status: 403 }
    );
  }

  // 8. Generate signed URL (120s)
  const { data: signedData, error: signedErr } = await supabase.storage
    .from('results')
    .createSignedUrl(result.pdf_path, 120);

  if (signedErr || !signedData?.signedUrl) {
    return NextResponse.json({ error: 'INTERNAL_ERROR' } as ApiErrorResponse, { status: 500 });
  }

  // 9. Set result_session cookie
  await setResultSession({ student_id: student.id, result_id: result.id });

  const response: VerifyResponse = {
    student: {
      id: student.id,
      admission_no: student.admission_no,
      full_name: student.full_name,
      class: student.class,
    },
    result: { term, session },
    signed_url: signedData.signedUrl,
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
