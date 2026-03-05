import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getAdminSession } from '@/lib/session';
import { generatePin, generateMasterNumber, maskPin } from '@/lib/pin-generator';

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

// GET — list master pins (pin_code masked)
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id'); // If provided, return usage logs for this master pin

  const supabase = createSupabaseServer();

  if (id) {
    // Return usage logs
    const { data, error } = await supabase
      .from('master_pin_usage')
      .select(`*, students(admission_no, full_name)`)
      .eq('master_pin_id', id)
      .order('used_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ logs: data });
  }

  const { data, error } = await supabase
    .from('master_pins')
    .select(`*, students:scoped_student_id(admission_no, full_name)`)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Get last_used for each master pin
  const enriched = await Promise.all(
    (data ?? []).map(async (mp: Record<string, unknown> & { id: string; pin_code: string; usage_count: number; usage_limit: number }) => {
      const { data: lastUsage } = await supabase
        .from('master_pin_usage')
        .select('used_at')
        .eq('master_pin_id', mp.id)
        .order('used_at', { ascending: false })
        .limit(1)
        .single();

      return {
        ...mp,
        pin_code: maskPin(mp.pin_code), // Always masked in list view
        last_used: lastUsage?.used_at ?? null,
      };
    })
  );

  return NextResponse.json({ master_pins: enriched });
}

// POST — create master PIN
export async function POST(request: NextRequest) {
  let adminSession: Awaited<ReturnType<typeof requireAdmin>>;
  try {
    adminSession = await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await request.json();
  const {
    label,
    master_number: providedMasterNumber,
    pin_code: providedPinCode,
    scope = 'all',
    scoped_student_id,
    term,
    session,
    usage_limit = 5,
  } = body;

  if (scope === 'student' && !scoped_student_id) {
    return NextResponse.json(
      { error: 'scoped_student_id required when scope is student' },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServer();

  // Auto-generate if not provided
  const masterNumber = providedMasterNumber?.trim() || generateMasterNumber();
  const pinCode = providedPinCode?.trim() || generatePin();

  // Check uniqueness
  const { data: existingNumber } = await supabase
    .from('master_pins')
    .select('id')
    .eq('master_number', masterNumber)
    .single();

  if (existingNumber) {
    return NextResponse.json({ error: 'Master number already exists' }, { status: 409 });
  }

  // Get admin id
  const { data: adminRecord } = await supabase
    .from('admins')
    .select('id')
    .eq('email', adminSession.email)
    .single();

  const { data, error } = await supabase
    .from('master_pins')
    .insert({
      master_number: masterNumber,
      pin_code: pinCode, // Stored as plaintext (service-role-only access)
      label: label ?? null,
      scope,
      scoped_student_id: scoped_student_id ?? null,
      term: term ?? null,
      session: session ?? null,
      usage_limit,
      created_by_admin_id: adminRecord?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Return full credentials ONLY on creation
  return NextResponse.json(
    {
      master_pin: {
        ...data,
        pin_code: pinCode, // Full PIN returned ONCE
      },
      _creation_only: true,
    },
    { status: 201 }
  );
}

// PATCH — toggle active / update
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await request.json();
  const { id, is_active, usage_limit, label } = body;

  if (!id) return NextResponse.json({ error: 'Master PIN ID required' }, { status: 400 });

  const supabase = createSupabaseServer();

  const updates: Record<string, unknown> = {};
  if (is_active !== undefined) updates.is_active = is_active;
  if (usage_limit !== undefined) updates.usage_limit = usage_limit;
  if (label !== undefined) updates.label = label;

  const { data, error } = await supabase
    .from('master_pins')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    master_pin: {
      ...data,
      pin_code: maskPin(data.pin_code),
    },
  });
}

// DELETE — remove master PIN and all usage logs
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'Master PIN ID required' }, { status: 400 });

  const supabase = createSupabaseServer();

  // Delete usage logs first (cascade should handle this but being explicit)
  await supabase.from('master_pin_usage').delete().eq('master_pin_id', id);

  const { error } = await supabase.from('master_pins').delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
