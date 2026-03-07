import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getAdminSession } from '@/lib/session';

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

// GET — list all students
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') ?? '1', 10);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);
  const search = searchParams.get('search') ?? '';
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = createSupabaseServer();

  let query = supabase
    .from('students')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (search) {
    query = query.or(
      `admission_no.ilike.%${search}%,full_name.ilike.%${search}%,class.ilike.%${search}%`
    );
  }

  const { data, count, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ students: data, total: count });
}

// POST — create or bulk-import students
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  const supabase = createSupabaseServer();

  // Bulk CSV import
  if (contentType.includes('text/csv') || contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('csv') as File;

    if (!file) return NextResponse.json({ error: 'No CSV file provided' }, { status: 400 });

    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());

    const requiredHeaders = ['admission_no', 'full_name', 'class'];
    for (const h of requiredHeaders) {
      if (!headers.includes(h)) {
        return NextResponse.json({ error: `Missing column: ${h}` }, { status: 400 });
      }
    }

    const students = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
      return {
        admission_no: row.admission_no.toUpperCase(),
        full_name: row.full_name,
        class: row.class,
        email: row.email ?? null,
        phone: row.phone ?? null,
      };
    }).filter((s) => s.admission_no && s.full_name && s.class);

    const { data, error } = await supabase
      .from('students')
      .upsert(students, { onConflict: 'admission_no' })
      .select();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ imported: data?.length ?? 0 });
  }

  // Single student
  const body = await request.json();
  const { admission_no, full_name, class: studentClass, email, phone } = body;

  if (!admission_no || !full_name || !studentClass) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('students')
    .insert({
      admission_no: admission_no.trim().toUpperCase(),
      full_name: full_name.trim(),
      class: studentClass.trim(),
      email: email?.trim() ?? null,
      phone: phone?.trim() ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Admission number already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ student: data }, { status: 201 });
}

// PATCH — update student
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) return NextResponse.json({ error: 'Student ID required' }, { status: 400 });

  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ student: data });
}

// DELETE — remove one or many students
// Single:  DELETE /api/admin/students?id=xxx
// Bulk:    DELETE /api/admin/students?ids=a,b,c
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const ids = searchParams.get('ids');

  if (!id && !ids) return NextResponse.json({ error: 'id or ids required' }, { status: 400 });

  const supabase = createSupabaseServer();
  const idList = ids ? ids.split(',').map(s => s.trim()).filter(Boolean) : [id!];

  const { error } = await supabase.from('students').delete().in('id', idList);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, deleted: idList.length });
}
