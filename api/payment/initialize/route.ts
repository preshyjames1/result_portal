import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { initializePaystackTransaction } from '@/lib/paystack';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  let body: {
    email: string;
    admission_no: string;
    full_name: string;
    phone?: string;
    term: string;
    session: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, admission_no, full_name, phone, term, session } = body;

  if (!email || !admission_no || !full_name || !term || !session) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = createSupabaseServer();

  // Validate student exists
  const { data: student } = await supabase
    .from('students')
    .select('id')
    .eq('admission_no', admission_no.trim().toUpperCase())
    .single();

  if (!student) {
    return NextResponse.json(
      { error: 'Student not found. Please verify your admission number.' },
      { status: 404 }
    );
  }

  const amount = parseInt(process.env.PIN_PRICE_KOBO ?? '50000', 10);
  const reference = `RHB-${randomBytes(8).toString('hex').toUpperCase()}`;
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback?reference=${reference}`;

  try {
    const paystackResponse = await initializePaystackTransaction({
      email,
      amount,
      reference,
      callback_url: callbackUrl,
      metadata: {
        admission_no: admission_no.trim().toUpperCase(),
        full_name,
        term,
        session,
        phone: phone ?? '',
      },
    });

    // Store pending transaction
    await supabase.from('transactions').insert({
      reference,
      email,
      phone: phone ?? null,
      admission_no: admission_no.trim().toUpperCase(),
      amount,
      status: 'pending',
    });

    return NextResponse.json({
      access_code: paystackResponse.data.access_code,
      reference,
    });
  } catch (error) {
    console.error('Paystack init error:', error);
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
  }
}
