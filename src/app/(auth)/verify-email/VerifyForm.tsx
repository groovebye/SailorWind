"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "@/components/forms";
import { resendVerification, verifyEmail, type AuthState } from "../actions";

export function ConfirmButton({ token }: { token: string }) {
  const [state, action] = useActionState<AuthState, FormData>(verifyEmail, undefined);
  return (
    <form action={action} className="form-stack">
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <SubmitButton pendingLabel="Confirming…" data-umami-event="verify-email">Confirm my email</SubmitButton>
    </form>
  );
}

export function ResendForm() {
  const [state, action] = useActionState<AuthState, FormData>(resendVerification, undefined);
  if (state?.done) return <Alert kind="ok">If that account still needs confirming, a new link is on its way.</Alert>;
  return (
    <form action={action} className="form-stack" noValidate>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Email" name="email" type="email" autoComplete="email" error={state?.fields?.email} required />
      <SubmitButton className="btn btn-block" pendingLabel="Sending…">Send a new link</SubmitButton>
    </form>
  );
}
