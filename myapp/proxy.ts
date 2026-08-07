import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
var supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Pages that are always reachable without signing in.
var PUBLIC_PATHS = ["/signin", "/register", "/auth", "/", "/welcome-demo"];

// API routes handle their own auth and should not be redirected.
var API_PATH_PATTERN = /\/api\//;

function isPublicPath(pathname: string) {
  for (var i = 0; i < PUBLIC_PATHS.length; i++) {
    var p = PUBLIC_PATHS[i];
    if (pathname === p || pathname.startsWith(p + "/")) {
      return true;
    }
  }
  return false;
}

// Requests that should never be gated by the auth check: API routes, Next.js
// internal assets, metadata, and any file with a static extension.
function shouldSkip(pathname: string) {
  if (API_PATH_PATTERN.test(pathname)) {
    return true;
  }
  if (pathname === "/manifest.webmanifest") {
    return true;
  }
  if (pathname.startsWith("/_next/")) {
    return true;
  }
  if (pathname === "/favicon.ico") {
    return true;
  }
  if (/\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff2?|ttf|ico)$/.test(pathname)) {
    return true;
  }
  return false;
}

export async function proxy(request: NextRequest) {
  var response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  // Missing env config: let the page render (no auth check possible).
  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  var { pathname } = request.nextUrl;

  // Belt-and-braces: never gate static assets, API routes, or the webmanifest
  // even if a request slips past the matcher.
  if (shouldSkip(pathname)) {
    return response;
  }

  var supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: function() {
        return request.cookies.getAll();
      },
      setAll: function(cookiesToSet) {
        for (var i = 0; i < cookiesToSet.length; i++) {
          var c = cookiesToSet[i];
          request.cookies.set(c.name, c.value);
          response.cookies.set(c.name, c.value, c.options);
        }
      }
    }
  });

  var { data: { user }, error } = await supabase.auth.getUser();

  // A failed validation (e.g. refresh_token_not_found) means the stored
  // session is dead — the browser is holding a stale refresh token that no
  // longer exists on the server. Drop the Supabase auth cookies so the client
  // stops retrying the dead token instead of surfacing AuthApiErrors.
  if (error) {
    clearAuthCookies(request, response);
  }

  if (user) {
    return response;
  }

  if (isPublicPath(pathname)) {
    return response;
  }

  var url = request.nextUrl.clone();
  url.pathname = "/signin";
  url.searchParams.set("next", pathname + request.nextUrl.search);
  var redirect = NextResponse.redirect(url);
  if (error) {
    clearAuthCookies(request, redirect);
  }
  return redirect;
}

// Expire every Supabase session cookie (sb-*) on the given response so the
// dead session doesn't come back on the next request.
function clearAuthCookies(request: NextRequest, target: NextResponse) {
  var cookies = request.cookies.getAll();
  for (var i = 0; i < cookies.length; i++) {
    var c = cookies[i];
    if (c.name.indexOf("sb-") === 0) {
      target.cookies.set(c.name, "", {
        path: "/",
        expires: new Date(0)
      });
    }
  }
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
