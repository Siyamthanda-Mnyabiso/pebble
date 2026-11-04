import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { infoPages } from '@/data/pages';

// Single-word addresses that belong to real routes or info pages.
const KNOWN = new Set([
  ...Object.keys(infoPages),
  'explore', 'account', 'dashboard', 'admin', 'book', 'contact', 'providers',
  'sitemap', 'sign-in', 'sign-up', 'auth', 'forgot-password', 'reset-password',
]);

/** Keeps the Supabase session cookie fresh. It never redirects. */
export async function proxy(request: NextRequest) {
  // The info-page route is dynamic, so an unknown address would answer 200. Send
  // those to a path that does not exist so visitors and search engines get a 404.
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  if (segments.length === 1 && !KNOWN.has(segments[0])) {
    return NextResponse.rewrite(new URL('/_missing/404', request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          for (const { name, value } of list) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of list) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/|images/).*)'],
};
