import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getAdminSession } from '@/lib/session';
import { initializePaystackTransaction } from '@/lib/paystack';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  // Must be a logged-in admin (super or school)
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  let body: { email: string; term: string; session: string; quantity: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { email, term, session: academicSession, quantity } = body;

  if (!email || !term || !academicSession || !quantity) {
    return NextResponse.json({ error: 'email, term, session and quantity are required' }, { status: 400 });
  }

  const qty = Math.max(1, Math.min(200, parseInt(String(quantity), 10)));
  const unitPrice = parseInt(process.env.PIN_PRICE_KOBO ?? '50000', 10);
  const totalAmount = qty * unitPrice;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');

  if (!siteUrl) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const supabase = createSupabaseServer();
  const reference = `RHB-BULK-${randomBytes(8).toString('hex').toUpperCase()}`;
  // After payment, redirect back to the pins page with a success flag
  const callbackUrl = `${siteUrl}/school-admin/pins?payment=success&ref=${reference}`;

  try {
    const paystackResponse = await initializePaystackTransaction({
      email,
      amount: totalAmount,
      reference,
      callback_url: callbackUrl,
      metadata: {
        // quantity stored as string because Paystack metadata values must be strings
        quantity: String(qty),
        term,
        session: academicSession,
        // Mark as bulk/admin purchase so webhook knows to email all pins to this address
        purchase_type: 'admin_bulk',
        admin_email: email,
        // admission_no not relevant for admin bulk — set empty
        admission_no: '',
        full_name: `Rehoboth College Admin (${qty} PIN${qty > 1 ? 's' : ''})`,
        phone: '',
      },
    });

    // Store pending transaction
    await supabase.from('transactions').insert({
      reference,
      email,
      phone: null,
      admission_no: null,
      amount: totalAmount,
      status: 'pending',
      authorization_url: paystackResponse.data.authorization_url,
    });

    return NextResponse.json({
      authorization_url: paystackResponse.data.authorization_url,
      reference,
    });
  } catch (err) {
    console.error('Paystack init error (admin bulk):', err);
    return NextResponse.json({ error: 'Payment initialization failed' }, { status: 500 });
  }
}
