"use client";

import { useActionState, useEffect, useState } from "react";
import { Star, Trash2, Pencil } from "lucide-react";
import { Alert, Field, SubmitButton } from "@/components/forms";
import { EVENTS, track } from "@/lib/analytics";
import {
  addBoat,
  changePassword,
  deleteAccount,
  editBoat,
  makeDefaultBoat,
  removeBoat,
  updateProfile,
  type SettingsState,
} from "./actions";

export type BoatDTO = {
  id: string;
  name: string;
  model: string | null;
  loaMeters: number;
  draftMeters: number;
  engineCruiseKt: number;
  engineMaxKt: number | null;
  fuelTankLiters: number | null;
  fuelBurnLph: number | null;
  notes: string | null;
  isDefault: boolean;
};

const n = (v: unknown) => (v == null ? "" : String(v));

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action] = useActionState<SettingsState, FormData>(updateProfile, undefined);
  return (
    <form action={action} className="form-stack" noValidate>
      {state?.ok && <Alert kind="ok">{state.ok}</Alert>}
      <div className="form-row">
        <Field label="Name" name="name" defaultValue={name} autoComplete="name" error={state?.fields?.name} required />
        <Field label="Email" name="email_ro" defaultValue={email} readOnly disabled hint="Used to sign in. Can't be changed yet." />
      </div>
      <div><SubmitButton className="btn btn-primary" pendingLabel="Saving…">Save profile</SubmitButton></div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<SettingsState, FormData>(changePassword, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="form-stack" noValidate key={state?.nonce}>
      {state?.ok && <Alert kind="ok">{state.ok}</Alert>}
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Current password" name="current" type="password" autoComplete="current-password" error={f.current} required />
      <div className="form-row">
        <Field label="New password" name="password" type="password" autoComplete="new-password" error={f.password} hint="8+ characters, a letter and a number." required />
        <Field label="Repeat new password" name="confirm" type="password" autoComplete="new-password" error={f.confirm} required />
      </div>
      <div><SubmitButton className="btn btn-primary" pendingLabel="Saving…">Change password</SubmitButton></div>
    </form>
  );
}

/** Add (no `boat`) or edit (with `boat`) form — same fields as signup's boat block, plus extras. */
export function BoatForm({ boat, next, onDone }: { boat?: BoatDTO; next?: string; onDone?: () => void }) {
  const [state, action] = useActionState<SettingsState, FormData>(boat ? editBoat : addBoat, undefined);
  const f = state?.fields ?? {};
  const v = state?.values;
  const val = (k: keyof BoatDTO) => (v ? v[k] : n(boat?.[k]));

  useEffect(() => {
    if (!state?.ok) return;
    if (!boat) track(EVENTS.BOAT_ADDED);
    onDone?.();
  }, [state?.ok, state?.nonce, boat, onDone]);

  return (
    <form action={action} className="form-stack" noValidate key={state?.nonce}>
      {state?.ok && !boat && <Alert kind="ok">{state.ok}</Alert>}
      {state?.error && <Alert kind="error">{state.error}</Alert>}
      {boat && <input type="hidden" name="id" value={boat.id} />}
      {next && <input type="hidden" name="next" value={next} />}
      <div className="form-row">
        <Field label="Boat name" name="name" defaultValue={val("name")} error={f.name} placeholder="Bossanova" required />
        <Field label="Make & model" name="model" defaultValue={val("model")} error={f.model} placeholder="Hallberg-Rassy Monsun 31" />
      </div>
      <div className="form-row-3">
        <Field label="LOA (m)" name="loaMeters" type="number" step="0.01" inputMode="decimal" defaultValue={val("loaMeters")} error={f.loaMeters} required />
        <Field label="Draft (m)" name="draftMeters" type="number" step="0.01" inputMode="decimal" defaultValue={val("draftMeters")} error={f.draftMeters} required />
        <Field label="Cruise (kn)" name="engineCruiseKt" type="number" step="0.1" inputMode="decimal" defaultValue={val("engineCruiseKt")} error={f.engineCruiseKt} required />
      </div>
      <div className="form-row-3">
        <Field label="Max (kn)" name="engineMaxKt" type="number" step="0.1" inputMode="decimal" defaultValue={val("engineMaxKt")} error={f.engineMaxKt} />
        <Field label="Fuel tank (L)" name="fuelTankLiters" type="number" step="1" inputMode="numeric" defaultValue={val("fuelTankLiters")} error={f.fuelTankLiters} />
        <Field label="Burn (L/h)" name="fuelBurnLph" type="number" step="0.1" inputMode="decimal" defaultValue={val("fuelBurnLph")} error={f.fuelBurnLph} />
      </div>
      <div>
        <label className="field-label" htmlFor={`notes-${boat?.id ?? "new"}`}>Notes</label>
        <textarea id={`notes-${boat?.id ?? "new"}`} name="notes" className="input" rows={2} maxLength={500} defaultValue={val("notes")} placeholder="Rig, sail plan, quirks…" />
      </div>
      <div className="flex gap-12">
        <SubmitButton className="btn btn-primary" pendingLabel="Saving…">{boat ? "Save boat" : "Add boat"}</SubmitButton>
        {boat && onDone && <button type="button" className="btn btn-ghost" onClick={onDone}>Cancel</button>}
      </div>
    </form>
  );
}

export function BoatRow({ boat }: { boat: BoatDTO }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (editing) {
    return (
      <div className="boat-row" style={{ display: "block" }}>
        <BoatForm boat={boat} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <div className="boat-row">
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>
          {boat.name}{" "}
          {boat.isDefault && <span className="pill" style={{ marginLeft: 6 }}><Star size={11} /> Default</span>}
        </div>
        <div className="mono faint" style={{ fontSize: 12, marginTop: 4 }}>
          {[boat.model, `LOA ${boat.loaMeters} m`, `draft ${boat.draftMeters} m`, `${boat.engineCruiseKt} kn motoring`]
            .filter(Boolean)
            .join(" · ")}
        </div>
      </div>
      <div className="flex gap-8 wrap">
        {!boat.isDefault && (
          <form action={makeDefaultBoat}>
            <input type="hidden" name="id" value={boat.id} />
            <SubmitButton className="btn btn-sm" pendingLabel="…"><Star /> Make default</SubmitButton>
          </form>
        )}
        <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}><Pencil /> Edit</button>
        {confirming ? (
          <form action={removeBoat} className="flex gap-8">
            <input type="hidden" name="id" value={boat.id} />
            <SubmitButton className="btn btn-sm btn-danger" pendingLabel="Deleting…">Delete {boat.name}?</SubmitButton>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirming(false)}>Keep</button>
          </form>
        ) : (
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirming(true)} aria-label={`Delete ${boat.name}`}>
            <Trash2 />
          </button>
        )}
      </div>
    </div>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState<SettingsState, FormData>(deleteAccount, undefined);
  const f = state?.fields ?? {};
  return (
    <form action={action} className="form-stack" noValidate>
      <div className="form-row">
        <Field label="Your password" name="password" type="password" autoComplete="current-password" error={f.password} required />
        <Field label='Type "DELETE"' name="confirm" autoComplete="off" error={f.confirm} required />
      </div>
      <div><SubmitButton className="btn btn-danger" pendingLabel="Deleting…">Delete my account forever</SubmitButton></div>
    </form>
  );
}
