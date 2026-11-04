import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/**
 * Streams one private document to the admin it was granted to. The address is a
 * ten minute grant, checked against the signed-in admin on every request. The
 * file itself is never given a public or downloadable link.
 */
export async function GET(_: Request, ctx: RouteContext<'/admin/documents/[access]'>) {
  const { access } = await ctx.params;
  const deny = () =>
    new NextResponse('Not found', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    });
  if (!UUID.test(access)) return deny();

  const supabase = await createClient();
  const { data: grant } = await supabase.rpc('admin_resolve_document', {
    p_access: access,
  });
  const row = (grant as { path: string; label: string }[] | null)?.[0];
  if (!row) return deny();

  const { data: file } = await supabase.storage.from('provider-docs').download(row.path);
  if (!file) return deny();

  const type = TYPES[row.path.split('.').pop()?.toLowerCase() ?? ''];
  if (!type) return deny();

  return new NextResponse(file, {
    headers: {
      'Content-Type': type,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
