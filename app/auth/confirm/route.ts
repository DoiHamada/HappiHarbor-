import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/onboarding";
  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      if (next.startsWith("/auth/reset-password")) {
        redirect(`/auth/reset-password?error=${encodeURIComponent(error.message)}`);
      }
      redirect(`/auth?error=${encodeURIComponent(error.message)}`);
    }

    redirect(next);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      if (next.startsWith("/auth/reset-password")) {
        redirect(`/auth/reset-password?error=${encodeURIComponent(error.message)}`);
      }
      redirect(`/auth?error=${encodeURIComponent(error.message)}`);
    }

    redirect(next);
  }

  if (next.startsWith("/auth/reset-password")) {
    redirect("/auth/reset-password?error=Invalid%20or%20expired%20reset%20link.");
  }

  redirect("/auth?error=missing_token");
}
