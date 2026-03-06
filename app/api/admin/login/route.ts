import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { setAdminSession } from '@/lib/session';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  let body: { email: string; password: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }

  const supabase = createSupabaseServer();

  const { data: admin } = await supabase
    .from('admins')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (!admin) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, admin.password_hash);

  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const role: 'super' | 'school' = admin.role ?? 'super';

  await setAdminSession({ admin_id: admin.id, email: admin.email, role });

  // Return role so the login page can redirect to the correct dashboard
  return NextResponse.json({ success: true, role });
}

export async function DELETE() {
  const { clearAdminSession } = await import('@/lib/session');
  await clearAdminSession();
  return NextResponse.json({ success: true });
}
