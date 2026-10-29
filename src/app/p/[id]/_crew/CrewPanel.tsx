"use client";

import { useActionState } from "react";
import { Users, UserPlus, X } from "lucide-react";
import { Alert, SubmitButton } from "@/components/forms";
import { addCrew, removeCrew, type CrewState } from "./actions";

export type CrewInfo = {
  isOwner: boolean;
  owner: { name: string };
  members: { id: string; name: string; email: string | null; isMe: boolean }[];
};

/** Who's on this passage; the owner adds/removes crew, crew can leave. */
export default function CrewPanel({ passageId, crew }: { passageId: string; crew: CrewInfo }) {
  const [state, action] = useActionState<CrewState, FormData>(addCrew.bind(null, passageId), undefined);
  const remove = removeCrew.bind(null, passageId);

  return (
    <div className="glass fade-up" style={{ padding: 22 }}>
      <div className="center gap-10" style={{ marginBottom: 12 }}>
        <div className="sec-icon" style={{ width: 32, height: 32 }}><Users size={16} /></div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Crew · {crew.members.length + 1}</div>
          <div className="faint mono" style={{ fontSize: 11 }}>
            {crew.isOwner ? "share this passage — crew see and edit it" : `shared with you by ${crew.owner.name}`}
          </div>
        </div>
      </div>

      <div className="boat-row" style={{ paddingTop: 6 }}>
        <span style={{ flex: 1 }}><b>{crew.owner.name}</b> <span className="faint mono" style={{ fontSize: 11 }}>· owner{crew.isOwner ? " (you)" : ""}</span></span>
      </div>
      {crew.members.map((m) => (
        <div key={m.id} className="boat-row">
          <span style={{ flex: 1, minWidth: 160 }}>
            {m.name}{m.isMe && <span className="faint mono" style={{ fontSize: 11 }}> · you</span>}
            {m.email && <span className="faint mono" style={{ fontSize: 11, display: "block" }}>{m.email}</span>}
          </span>
          {(crew.isOwner || m.isMe) && (
            <form action={remove}>
              <input type="hidden" name="userId" value={m.id} />
              <SubmitButton className="btn btn-sm btn-ghost" pendingLabel="…" aria-label={m.isMe ? "Leave this passage" : `Remove ${m.name}`}>
                <X /> {m.isMe ? "Leave" : "Remove"}
              </SubmitButton>
            </form>
          )}
        </div>
      ))}

      {crew.isOwner && (
        <form action={action} className="form-stack" style={{ marginTop: 14 }} key={state?.nonce} noValidate>
          {state?.ok && <Alert kind="ok">{state.ok}</Alert>}
          {state?.error && <Alert kind="error">{state.error}</Alert>}
          <div className="flex gap-8">
            <input className="input" type="email" name="email" placeholder="crew@example.com" aria-label="Crew member's email" autoComplete="off" required />
            <SubmitButton className="btn" pendingLabel="Adding…"><UserPlus /> Add</SubmitButton>
          </div>
          <div className="faint" style={{ fontSize: 12 }}>They need a SailorWind account with this email.</div>
        </form>
      )}
    </div>
  );
}
