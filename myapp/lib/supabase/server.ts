import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  var cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: function() {
          return cookieStore.getAll();
        },
        setAll: function(cookiesToSet) {
          try {
            for (var i = 0; i < cookiesToSet.length; i++) {
              var c = cookiesToSet[i];
              cookieStore.set(c.name, c.value, c.options);
            }
          } catch (_err) {
            /* ignore in RSC context */
          }
        }
      }
    }
  );
}
