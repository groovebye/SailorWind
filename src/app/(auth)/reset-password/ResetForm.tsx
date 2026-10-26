"use client";

import { useActionState } from "react";
import { Alert, Field, SubmitButton } from "@/components/forms";
import { resetPassword, type AuthState } from "../actions";

export default function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState<AuthState, FormData>(resetPassword, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="form-stack" noValidate>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        error={f.password}
        hint="At least 8 characters, with a letter and a number."
        required
      />
      <Field label="Repeat password" name="confirm" type="password" autoComplete="new-password" error={f.confirm} required />
      <SubmitButton pendingLabel="Saving…">Set password &amp; sign in</SubmitButton>
    </form>
  );
}
