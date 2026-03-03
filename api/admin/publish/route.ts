import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getAdminSession } from '@/lib/session';

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error('UNAUTHORIZED');
  return session;
}

// GET — list scheduled/unpublished results
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from('results')
    .select(`*, students(admission_no, full_name, class)`)
    .or('is_published.eq.false,publish_at.not.is.null')
    .order('publish_at', { ascending: true, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ results: data });
}

// POST — manually trigger publish of all due results
export async function POST() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const supabase = createSupabaseServer();

  const { data, error } = await supabase
    .from('results')
    .update({ is_published: true, published_at: new Date().toISOString() })
    .lte('publish_at', new Date().toISOString())
    .eq('is_published', false)
    .not('publish_at', 'is', null)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ published_count: data?.length ?? 0 });
}
