import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { verifyPaystackWebhookSignature } from '@/lib/paystack';
import { generatePin } from '@/lib/pin-generator';
import { sendPinEmail } from '@/lib/resend';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-paystack-signature') ?? '';

  // Verify HMAC SHA512 signature
  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: { event: string; data: Record<string, unknown> };

  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (event.event !== 'charge.success') {
    return NextResponse.json({ received: true });
  }

  const data = event.data as {
    reference: string;
    status: string;
    paid_at: string;
    amount: number;
    customer: { email: string };
    metadata: {
      admission_no: string;
      full_name: string;
      term: string;
      session: string;
      phone?: string;
    };
  };

  if (data.status !== 'success') {
    return NextResponse.json({ received: true });
  }

  const supabase = createSupabaseServer();

  // Find transaction
  const { data: transaction } = await supabase
    .from('transactions')
    .select('*')
    .eq('reference', data.reference)
    .single();

  if (!transaction) {
    console.error('Webhook: transaction not found for reference', data.reference);
    return NextResponse.json({ received: true });
  }

  // Idempotency: already processed
  if (transaction.status === 'success') {
    return NextResponse.json({ received: true });
  }

  const { admission_no, full_name, term, session } = data.metadata;

  // Generate unique PIN
  let pinCode: string;
  let attempts = 0;
  do {
    pinCode = generatePin();
    const { data: existing } = await supabase
      .from('pins')
      .select('id')
      .eq('pin_code', pinCode)
      .single();
    if (!existing) break;
    attempts++;
  } while (attempts < 10);

  if (attempts >= 10) {
    console.error('Webhook: failed to generate unique PIN');
    return NextResponse.json({ received: true });
  }

  // Insert PIN
  const { data: newPin, error: pinErr } = await supabase
    .from('pins')
    .insert({
      pin_code: pinCode,
      usage_limit: 5,
      usage_count: 0,
      is_active: true,
      claimed_by_student_id: null,
      term,
      session,
    })
    .select('id')
    .single();

  if (pinErr || !newPin) {
    console.error('Webhook: failed to insert PIN', pinErr);
    return NextResponse.json({ received: true });
  }

  // Update transaction
  await supabase
    .from('transactions')
    .update({
      status: 'success',
      pin_id: newPin.id,
      paid_at: data.paid_at,
    })
    .eq('id', transaction.id);

  // Send email
  try {
    await sendPinEmail({
      to: data.customer.email,
      full_name: full_name ?? admission_no,
      pin_code: pinCode,
      admission_no,
      term,
      session,
    });
  } catch (emailErr) {
    console.error('Webhook: email send failed', emailErr);
    // Don't fail the webhook — PIN was still created
  }

  return NextResponse.json({ received: true });
}
