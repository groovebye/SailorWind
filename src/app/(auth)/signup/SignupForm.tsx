"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { Sailboat, MailCheck } from "lucide-react";
import { Alert, Field, SubmitButton } from "@/components/forms";
import { EVENTS, track } from "@/lib/analytics";
import { resendVerification, signup, type AuthState } from "../actions";

export default function SignupForm() {
  const [state, action] = useActionState<AuthState, FormData>(signup, undefined);
  const [resent, resendAction] = useActionState<AuthState, FormData>(resendVerification, undefined);
  const f = state?.fields ?? {};
  const v = state?.values ?? {};

  useEffect(() => {
    if (state?.done) track(EVENTS.SIGNUP);
  }, [state?.done]);

  if (state?.done) {
    return (
      <div className="form-stack">
        <div className="center gap-12">
          <div className="sec-icon"><MailCheck size={18} /></div>
          <h2 className="display" style={{ fontSize: 26, margin: 0 }}>Check your inbox</h2>
        </div>
        <p className="dim" style={{ margin: 0, lineHeight: 1.6 }}>
          We sent a confirmation link to <b style={{ color: "var(--fg)" }}>{state.email}</b>. Open it to activate
          your account — the link is valid for 48 hours.
        </p>
        {resent?.done && <Alert kind="ok">A fresh link is on its way.</Alert>}
        {resent?.error && <Alert kind="error">{resent.error}</Alert>}
        <form action={resendAction} onSubmit={() => track(EVENTS.VERIFY_RESENT)}>
          <input type="hidden" name="email" value={state.email ?? ""} />
          <SubmitButton className="btn btn-block" pendingLabel="Sending…">Resend the email</SubmitButton>
        </form>
        <p className="faint" style={{ fontSize: 13, margin: 0 }}>
          Nothing arrived? Check spam, or <Link className="link" href="/signup">use another address</Link>.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="form-stack" noValidate>
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Your name" name="name" autoComplete="name" defaultValue={v.name} error={f.name} required />
      <Field label="Email" name="email" type="email" autoComplete="email" defaultValue={v.email} error={f.email} required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        error={f.password}
        hint="At least 8 characters, with a letter and a number."
        required
      />

      <details className="boat-fold" open={Boolean(v.boat_name || f.boat_name || f.boat_loa || f.boat_draft || f.boat_cruise)}>
        <summary><Sailboat /> Add your boat now <span className="faint" style={{ fontWeight: 400 }}>· optional</span></summary>
        <div className="form-stack">
          <div className="form-row">
            <Field label="Boat name" name="boat_name" placeholder="Bossanova" defaultValue={v.boat_name} error={f.boat_name} />
            <Field label="Make & model" name="boat_model" placeholder="Hallberg-Rassy Monsun 31" defaultValue={v.boat_model} error={f.boat_model} />
          </div>
          <div className="form-row-3">
            <Field label="Length (m)" name="boat_loa" type="number" step="0.01" inputMode="decimal" placeholder="9.5" defaultValue={v.boat_loa} error={f.boat_loa} />
            <Field label="Draft (m)" name="boat_draft" type="number" step="0.01" inputMode="decimal" placeholder="1.45" defaultValue={v.boat_draft} error={f.boat_draft} />
            <Field label="Cruise (kn)" name="boat_cruise" type="number" step="0.1" inputMode="decimal" placeholder="6" defaultValue={v.boat_cruise} error={f.boat_cruise} />
          </div>
          <p className="faint" style={{ fontSize: 12.5, margin: 0 }}>
            Draft filters out harbours you can&apos;t enter. You can add more boats later in Settings.
          </p>
        </div>
      </details>

      <label className="check-row">
        <input type="checkbox" name="terms" required />
        <span>
          I accept the <Link className="link" href="/terms" target="_blank">terms</Link>{" "}and understand SailorWind is a
          planning aid — not a substitute for official charts, notices and the skipper&apos;s judgement.
        </span>
      </label>
      {f.terms && <div className="field-error" style={{ marginTop: -8 }}>{f.terms}</div>}

      <SubmitButton pendingLabel="Creating account…" data-umami-event="signup-submit">Create account</SubmitButton>
    </form>
  );
}
