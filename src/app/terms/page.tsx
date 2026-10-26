import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms & privacy — SailorWind" };

export default function TermsPage() {
  return (
    <div className="container fade-up" style={{ maxWidth: 760, padding: "48px 0 80px" }}>
      <div className="eyebrow">Terms & privacy</div>
      <h1 className="display" style={{ fontSize: 42, margin: "10px 0 24px" }}>The short version</h1>
      <div className="glass" style={{ padding: "28px 30px", lineHeight: 1.7, fontSize: 15.5 }}>
        <h2 className="display" style={{ fontSize: 22 }}>A planning aid, not a navigation instrument</h2>
        <p className="dim">
          SailorWind combines public weather models, bathymetry and curated harbour notes to help you plan. Forecasts can be
          wrong, data can be out of date and computed routes are not validated for navigation. Always use official charts,
          notices to mariners and forecasts, and rely on your own judgement as skipper. You use SailorWind at your own risk;
          it is provided as is, without warranty.
        </p>

        <h2 className="display" style={{ fontSize: 22, marginTop: 28 }}>Beta</h2>
        <p className="dim">The service is free while in beta. Features may change and the service may be interrupted.</p>

        <h2 className="display" style={{ fontSize: 22, marginTop: 28 }}>What we store</h2>
        <p className="dim">
          Your name, email, a salted hash of your password (never the password itself), your boats and your passages. We
          use one strictly necessary cookie to keep you signed in. Page-visit statistics are collected with a self-hosted,
          cookieless analytics tool that doesn&apos;t identify you. We don&apos;t sell or share your data and don&apos;t show ads.
        </p>

        <h2 className="display" style={{ fontSize: 22, marginTop: 28 }}>Your control</h2>
        <p className="dim" style={{ marginBottom: 0 }}>
          You can edit your profile and boats, sign out of all devices, or permanently delete your account and everything
          in it from <Link className="link" href="/settings">Settings</Link>.
        </p>
      </div>
    </div>
  );
}
