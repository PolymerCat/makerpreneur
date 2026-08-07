import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Handles the Supabase email confirmation / recovery link.
 * Two flows are supported:
 *  - OTP token flow:  /auth/confirm?token_hash=...&type=email
 *  - PKCE code flow:  /auth/confirm?code=...
 * On success the session cookies are set and the user is sent to the app.
 */
export async function GET(request: NextRequest) {
  var requestUrl = new URL(request.url);
  var code = requestUrl.searchParams.get("code");
  var tokenHash = requestUrl.searchParams.get("token_hash");
  var type = requestUrl.searchParams.get("type");
  var nextParam = requestUrl.searchParams.get("next");

  var origin = requestUrl.origin;
  var next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/";

  var supabase = await createServerSupabaseClient();

  if (code) {
    var { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(origin + next);
    }
    console.error("[AUTH-CONFIRM] exchangeCodeForSession error:", error.message);
  } else if (tokenHash && type) {
    var { error: otpError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "email" | "sms" | "email_change" | "recovery",
    });
    if (!otpError) {
      return NextResponse.redirect(origin + next);
    }
    console.error("[AUTH-CONFIRM] verifyOtp error:", otpError.message);
  }

  return NextResponse.redirect(origin + "/signin?error=confirmation-failed");
}
