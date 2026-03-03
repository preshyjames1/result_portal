import { NextRequest, NextResponse } from 'next/server';
import { verifyPaystackTransaction } from '@/lib/paystack';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get('reference');

  if (!reference) {
    return NextResponse.json({ error: 'Reference required' }, { status: 400 });
  }

  try {
    const result = await verifyPaystackTransaction(reference);

    if (result.data.status !== 'success') {
      return NextResponse.json(
        { status: 'failed', message: 'Payment was not successful' },
        { status: 400 }
      );
    }

    // Get email from transaction record
    const supabase = createSupabaseServer();
    const { data: transaction } = await supabase
      .from('transactions')
      .select('email')
      .eq('reference', reference)
      .single();

    return NextResponse.json({
      status: 'success',
      email: transaction?.email ?? result.data.customer.email,
    });
  } catch (error) {
    return NextResponse.json(
      { status: 'failed', message: 'Could not verify payment' },
      { status: 500 }
    );
  }
}
