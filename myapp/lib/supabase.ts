import { createBrowserClient as ssrCreateBrowserClient } from "@supabase/ssr";

var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
var supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createBrowserClient() {
  return ssrCreateBrowserClient(supabaseUrl, supabaseAnonKey);
}
