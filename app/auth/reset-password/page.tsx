"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EmailOtpType } from "@supabase/supabase-js";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    async function initializeRecoverySession() {
      setMessage(null);

      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (error) {
          setMessage(error.message);
          return;
        }
        setReady(true);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
        setReady(true);
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session) {
        setReady(true);
      } else {
        setMessage("Invalid or expired reset link. Request a new one from Sign in.");
      }
    }

    void initializeRecoverySession();
  }, [code, tokenHash, type, supabase]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Password updated successfully. You can sign in now.");
  }

  return (
    <section className="mx-auto max-w-md space-y-4">
      <div className="card space-y-4">
        <h1 className="text-2xl font-bold">Reset password</h1>
        <p className="text-sm text-harbor-ink/70">Set a new password for your account.</p>

        {ready && (
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-1">
              <label className="label">New password</label>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="label">Confirm new password</label>
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

            <button className="btn w-full" type="submit" disabled={loading}>
              {loading ? "Please wait..." : "Update password"}
            </button>
          </form>
        )}

        {message && <p className="rounded-lg bg-harbor-peach/60 p-2 text-sm">{message}</p>}

        <Link href="/auth" className="text-sm">
          Back to sign in
        </Link>
      </div>
    </section>
  );
}
