import type { Metadata } from "next";
import { emailTokenValid } from "@/lib/auth/email-tokens";
import { ConfirmButton, ResendForm } from "./VerifyForm";

export const metadata: Metadata = { title: "Confirm your email — SailorWind", referrer: "no-referrer" };

/**
 * The emailed link only opens this page; the token is consumed by an explicit
 * button press, so mail-scanner prefetches can't burn it.
 */
export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = (await searchParams).token ?? "";
  const valid = token.length >= 20 && (await emailTokenValid(token, "verify_email"));
  return (
    <div className="auth-wrap fade-up">
      <div className="glass auth-card">
        <div className="eyebrow">Almost there</div>
        <h1 className="display">Confirm your email</h1>
        {valid ? (
          <>
            <p className="auth-sub dim">One click and your account is ready.</p>
            <ConfirmButton token={token} />
          </>
        ) : (
          <>
            <p className="auth-sub dim">
              This link is invalid, already used, or expired (links last 48 hours). Enter your email for a new one.
            </p>
            <ResendForm />
          </>
        )}
      </div>
    </div>
  );
}
