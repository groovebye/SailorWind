import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { safeNext } from "@/lib/auth/safe-redirect";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in — SailorWind" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getCurrentUser()) redirect(next);
  return (
    <div className="auth-wrap fade-up">
      <div className="glass auth-card">
        <div className="eyebrow">Welcome back</div>
        <h1 className="display">Sign in</h1>
        <p className="auth-sub dim">Pick up your passages where you left off.</p>
        <LoginForm next={next} />
        <div className="auth-foot">
          New to SailorWind? <Link href="/signup">Create a free account</Link>
        </div>
      </div>
    </div>
  );
}
