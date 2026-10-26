"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { Alert, Field, SubmitButton } from "@/components/forms";
import { EVENTS, track } from "@/lib/analytics";
import { requestPasswordReset, type AuthState } from "../actions";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<AuthState, FormData>(requestPasswordReset, undefined);
  useEffect(() => {
    if (state?.done) track(EVENTS.PASSWORD_RESET_REQUESTED);
  }, [state?.done]);

  return (
    <div className="auth-wrap fade-up">
      <div className="glass auth-card">
        <div className="eyebrow">Account recovery</div>
        <h1 className="display">Forgot password</h1>
        {state?.done ? (
          <div className="form-stack">
            <Alert kind="ok">
              If an account exists for <b>{state.email}</b>, a reset link is on its way. It&apos;s valid for 1 hour.
            </Alert>
            <Link className="btn btn-block" href="/login">Back to sign in</Link>
          </div>
        ) : (
          <>
            <p className="auth-sub dim">Enter your email and we&apos;ll send you a link to set a new password.</p>
            <form action={action} className="form-stack" noValidate>
              {state?.error && <Alert kind="error">{state.error}</Alert>}
              <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} error={state?.fields?.email} required />
              <SubmitButton pendingLabel="Sending…">Send reset link</SubmitButton>
            </form>
          </>
        )}
        <div className="auth-foot">
          Remembered it? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
