"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "@/components/forms";
import { login, resendVerification, type AuthState } from "../actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<AuthState, FormData>(login, undefined);
  const [resent, resendAction] = useActionState<AuthState, FormData>(resendVerification, undefined);
  const f = state?.fields ?? {};

  return (
    <div className="form-stack">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {state?.unverified && (
        <form action={resendAction}>
          <input type="hidden" name="email" value={state.email ?? ""} />
          {resent?.done ? (
            <Alert kind="ok">We sent a new confirmation link.</Alert>
          ) : (
            <SubmitButton className="btn btn-sm" pendingLabel="Sending…">Resend confirmation email</SubmitButton>
          )}
        </form>
      )}
      <form action={action} className="form-stack" noValidate>
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} error={f.email} required />
        <div>
          <Field label="Password" name="password" type="password" autoComplete="current-password" error={f.password} required />
          <div style={{ textAlign: "right", marginTop: 8 }}>
            <Link className="link" href="/forgot-password" style={{ fontSize: 13 }}>Forgot password?</Link>
          </div>
        </div>
        <SubmitButton pendingLabel="Signing in…" data-umami-event="login-submit">Sign in</SubmitButton>
      </form>
    </div>
  );
}
