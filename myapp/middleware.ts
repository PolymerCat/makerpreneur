import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  var supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  var response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

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

  await supabase.auth.getUser();

  return response;
}

export var config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
