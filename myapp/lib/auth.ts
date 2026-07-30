import { createBrowserClient } from "@supabase/ssr";

var supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
var supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

function getClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export async function getSession(): Promise<{ email: string; id: string } | null> {
  var supabase = getClient();
  var result = await supabase.auth.getSession();
  var session = result.data.session;
  if (!session || !session.user) {
    return null;
  }
  return {
    email: session.user.email || "",
    id: session.user.id
  };
}

export async function signUp(email: string, password: string) {
  var supabase = getClient();
  var result = await supabase.auth.signUp({
    email: email,
    password: password
  });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data.user;
}

export async function signIn(email: string, password: string) {
  var supabase = getClient();
  var result = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return result.data.user;
}

export async function signOut() {
  var supabase = getClient();
  await supabase.auth.signOut();
}
