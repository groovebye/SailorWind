import type { Metadata } from "next";
import { User, Sailboat, KeyRound, ShieldAlert, LogOut } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/dal";
import { safeNext } from "@/lib/auth/safe-redirect";
import { Alert, SubmitButton } from "@/components/forms";
import { logoutEverywhere } from "./actions";
import { BoatForm, BoatRow, DeleteAccountForm, LogoutEverywhereForm, PasswordForm, ProfileForm, type BoatDTO } from "./SettingsForms";

export const metadata: Metadata = { title: "Settings — SailorWind" };
export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; next?: string }>;
}) {
  const me = await requireUser("/settings");
  const sp = await searchParams;
  const next = sp.next ? safeNext(sp.next, "") : "";
  const boats: BoatDTO[] = await prisma.vesselProfile.findMany({
    where: { ownerId: me.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true, name: true, model: true, loaMeters: true, draftMeters: true, engineCruiseKt: true,
      engineMaxKt: true, fuelTankLiters: true, fuelBurnLph: true, notes: true, isDefault: true,
    },
  });

  return (
    <div className="container fade-up" style={{ padding: "40px 0 90px" }}>
      <div className="eyebrow">Account</div>
      <h1 className="display" style={{ fontSize: "clamp(32px, 5vw, 48px)", margin: "8px 0 28px" }}>Settings</h1>

      {sp.welcome && (
        <div style={{ marginBottom: 22 }}>
          <Alert kind="ok">
            Welcome aboard, {me.name}! Add your boat below — its draft and motoring speed tailor routes, harbour access and timings.
          </Alert>
        </div>
      )}
      {next === "/new" && boats.length === 0 && (
        <div style={{ marginBottom: 22 }}>
          <Alert kind="ok">Add a boat first — then you&apos;ll go straight back to planning your passage.</Alert>
        </div>
      )}

      <div className="settings-grid">
        <nav className="settings-nav" aria-label="Settings sections">
          <a href="#boats"><Sailboat size={15} style={{ verticalAlign: -2, marginRight: 8 }} />Boats</a>
          <a href="#profile"><User size={15} style={{ verticalAlign: -2, marginRight: 8 }} />Profile</a>
          <a href="#security"><KeyRound size={15} style={{ verticalAlign: -2, marginRight: 8 }} />Security</a>
          <a href="#danger"><ShieldAlert size={15} style={{ verticalAlign: -2, marginRight: 8 }} />Delete account</a>
        </nav>

        <div>
          <section id="boats" className="glass settings-section">
            <h2>Your boats</h2>
            <p className="dim" style={{ margin: "0 0 14px", fontSize: 14 }}>
              The default boat is preselected for new passages and shown in the top bar.
            </p>
            {boats.length > 0 ? (
              <div style={{ marginBottom: 22 }}>{boats.map((b) => <BoatRow key={b.id} boat={b} />)}</div>
            ) : (
              <p className="faint" style={{ fontSize: 14 }}>No boats yet.</p>
            )}
            <details className="boat-fold" open={boats.length === 0}>
              <summary><Sailboat /> Add a boat</summary>
              <div className="form-stack"><BoatForm next={next || undefined} /></div>
            </details>
          </section>

          <section id="profile" className="glass settings-section">
            <h2>Profile</h2>
            <p className="dim" style={{ margin: "0 0 18px", fontSize: 14 }}>How you appear in SailorWind.</p>
            <ProfileForm name={me.name} email={me.email} />
          </section>

          <section id="security" className="glass settings-section">
            <h2>Security</h2>
            <p className="dim" style={{ margin: "0 0 18px", fontSize: 14 }}>Change your password. Other devices will be signed out.</p>
            <PasswordForm />
            <div className="between wrap gap-12" style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="dim" style={{ fontSize: 14 }}>Lost a phone or used a shared computer?</span>
              <LogoutEverywhereForm action={logoutEverywhere}>
                <SubmitButton className="btn btn-sm" pendingLabel="Signing out…"><LogOut /> Sign out of all devices</SubmitButton>
              </LogoutEverywhereForm>
            </div>
          </section>

          <section id="danger" className="glass settings-section" style={{ borderColor: "rgba(255,107,138,0.3)" }}>
            <h2>Delete account</h2>
            <p className="dim" style={{ margin: "0 0 18px", fontSize: 14 }}>
              Permanently deletes your account, boats, passages and logs. This can&apos;t be undone.
            </p>
            <DeleteAccountForm />
          </section>
        </div>
      </div>
    </div>
  );
}
