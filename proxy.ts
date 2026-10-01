import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Refreshes the Supabase auth cookie on every request and performs an
 * optimistic sign-in check for protected areas. Real authorization (role
 * checks) happens server-side in layouts, server actions and RLS.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/rescue", "/citizen/report", "/citizen/profile"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it refreshes
  // the session and validates the JWT.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const signedIn = Boolean(claims?.sub) && claims?.is_anonymous !== true;

  const { pathname } = request.nextUrl;
  if (!signedIn && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static assets, images, the service worker and the manifest.
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
