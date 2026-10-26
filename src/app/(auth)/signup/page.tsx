import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import SignupForm from "./SignupForm";

export const metadata: Metadata = {
  title: "Create your account — SailorWind",
  description: "Free passage planning for coastal cruisers: cape-by-cape forecasts, GO/NO-GO windows and harbour intel.",
};

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <div className="auth-wrap fade-up">
      <div className="glass auth-card">
        <div className="eyebrow">Free account</div>
        <h1 className="display">Start planning</h1>
        <p className="auth-sub dim">Add your boat, pick your ports, get the weather window.</p>
        <SignupForm />
        <div className="auth-foot">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
