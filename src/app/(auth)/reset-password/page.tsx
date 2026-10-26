import type { Metadata } from "next";
import Link from "next/link";
import { emailTokenValid } from "@/lib/auth/email-tokens";
import ResetForm from "./ResetForm";

export const metadata: Metadata = { title: "Set a new password — SailorWind", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const valid = token.length >= 20 && (await emailTokenValid(token, "reset_password"));
  return (
    <div className="auth-wrap fade-up">
      <div className="glass auth-card">
        <div className="eyebrow">Account recovery</div>
        <h1 className="display">New password</h1>
        {valid ? (
          <>
            <p className="auth-sub dim">Choose a new password. You&apos;ll be signed out on all other devices.</p>
            <ResetForm token={token} />
          </>
        ) : (
          <div className="form-stack">
            <p className="auth-sub dim" style={{ marginBottom: 0 }}>This reset link is invalid, already used, or expired (links last 1 hour).</p>
            <Link className="btn btn-primary btn-block" href="/forgot-password">Request a new link</Link>
          </div>
        )}
      </div>
    </div>
  );
}
