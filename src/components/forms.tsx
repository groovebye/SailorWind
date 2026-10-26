"use client";

import { useFormStatus } from "react-dom";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
};

/** Labelled `.input` with an accessible inline error. */
export function Field({ label, name, error, hint, id, ...rest }: FieldProps) {
  // Unique per instance: the same field name can appear in several forms on one page.
  const autoId = useId();
  const inputId = id ?? `f-${name}-${autoId}`;
  return (
    <div>
      <label className="field-label" htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        name={name}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-err` : undefined}
        {...rest}
      />
      {error ? (
        <div id={`${inputId}-err`} className="field-error">{error}</div>
      ) : hint ? (
        <div className="faint" style={{ fontSize: 12.5, marginTop: 6 }}>{hint}</div>
      ) : null}
    </div>
  );
}

export function Alert({ kind, children }: { kind: "error" | "ok"; children: ReactNode }) {
  return (
    <div className={`form-alert ${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

/** Submit button that disables itself while its form's action is pending. */
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn btn-primary btn-lg btn-block",
  ...rest
}: { children: ReactNode; pendingLabel?: string; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} {...rest}>
      {pending ? pendingLabel ?? "Please wait…" : children}
    </button>
  );
}
