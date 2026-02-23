"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "sign_in" | "sign_up" | "forgot";

export default function AuthPage() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const modeParam = searchParams.get("mode");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/onboarding";
  const initialMode: Mode = modeParam === "sign_up" ? "sign_up" : "sign_in";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (modeParam === "sign_up") {
      setMode("sign_up");
      return;
    }
    if (modeParam === "sign_in") {
      setMode("sign_in");
    }
  }, [modeParam]);

  async function onEmailAuth(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Password reset link sent. Check your email.");
      }
    } else if (mode === "sign_up") {
      if (password !== confirmPassword) {
        setMessage("Passwords do not match.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`
        }
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Check your email to confirm your account before matching.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
      } else {
        window.location.href = next;
      }
    }

    setLoading(false);
  }

  async function onGoogleAuth() {
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`
      }
    });

    if (error) {
      if (
        error.message.toLowerCase().includes("provider is not enabled") ||
        error.message.toLowerCase().includes("unsupported provider")
      ) {
        setMessage(
          "Google login is not enabled in Supabase yet. Enable Google under Authentication > Providers and add Google OAuth client credentials."
        );
      } else {
        setMessage(error.message);
      }
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-4">
      <div className="card space-y-4">
        <h1 className="text-2xl font-bold">Welcome to HappiHarbor</h1>
        <p className="text-sm text-harbor-ink/70">Log in or create an account to continue.</p>

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-harbor-cream p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              mode === "sign_in" ? "bg-white shadow" : ""
            }`}
            onClick={() => setMode("sign_in")}
          >
            Log in
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              mode === "sign_up" ? "bg-white shadow" : ""
            }`}
            onClick={() => setMode("sign_up")}
          >
            Join Now
          </button>
        </div>

        <form className="space-y-3" onSubmit={onEmailAuth}>
          <div className="space-y-1">
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode !== "forgot" && (
            <div className="space-y-1">
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                autoComplete={mode === "sign_up" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
          )}

          {mode === "sign_up" && (
            <div className="space-y-1">
              <label className="label">Confirm password</label>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
          )}

          <button className="btn w-full" type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : mode === "sign_up"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : "Log in"}
          </button>
        </form>

        <button
          type="button"
          className="text-left text-sm text-harbor-ink/80 underline-offset-4 hover:underline"
          onClick={() => setMode(mode === "forgot" ? "sign_in" : "forgot")}
        >
          {mode === "forgot" ? "Back to log in" : "Forgot password?"}
        </button>

        {mode !== "forgot" && (
          <>
            <div className="relative py-1 text-center text-xs text-harbor-ink/60">
              <span className="bg-white px-2">or</span>
            </div>

            <button className="btn-secondary w-full" type="button" onClick={onGoogleAuth} disabled={loading}>
              Continue with Google
            </button>
          </>
        )}

        {message && <p className="rounded-lg bg-harbor-peach/60 p-2 text-sm">{message}</p>}
      </div>
    </section>
  );
}
