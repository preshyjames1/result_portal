import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const cronSecret = request.headers.get('x-cron-secret') ??
    request.nextUrl.searchParams.get('secret');

  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createSupabaseServer();

  // Publish all results where publish_at has passed
  const { data, error } = await supabase
    .from('results')
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .lte('publish_at', new Date().toISOString())
    .eq('is_published', false)
    .not('publish_at', 'is', null)
    .select('id');

  if (error) {
    console.error('Cron publish error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const published_count = data?.length ?? 0;

  if (published_count > 0) {
    console.log(`Cron: auto-published ${published_count} results`);
  }

  return NextResponse.json({ published_count });
}
