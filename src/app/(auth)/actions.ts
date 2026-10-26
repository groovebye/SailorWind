"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { safeNext } from "@/lib/auth/safe-redirect";
import { clientIp, createSession, destroySession, revokeSessions } from "@/lib/auth/session";
import { consumeEmailToken, issueEmailToken } from "@/lib/auth/email-tokens";
import { rateLimit } from "@/lib/auth/rate-limit";
import { sendAlreadyRegistered, sendResetPassword, sendVerifyEmail } from "@/lib/auth/mail";
import {
  boatSchema,
  emailOnlySchema,
  fieldErrors,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from "@/lib/auth/schemas";
import { createBoat } from "@/lib/vessels";

export type AuthState =
  | {
      error?: string;
      fields?: Record<string, string>;
      /** Non-secret inputs echoed back so the form keeps them after an error. */
      values?: Record<string, string>;
      done?: boolean;
      email?: string;
      unverified?: boolean;
    }
  | undefined;

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
}

function echo(fd: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, str(fd, k)]));
}

const BOAT_KEYS = ["boat_name", "boat_model", "boat_loa", "boat_draft", "boat_cruise"];

// ── Sign up ─────────────────────────────────────────────────────

export async function signup(_: AuthState, fd: FormData): Promise<AuthState> {
  const values = echo(fd, ["name", "email", ...BOAT_KEYS]);
  if (!(await rateLimit("signup-ip", await clientIp(), 10, 3600))) return { error: TOO_MANY, values };

  const parsed = signupSchema.safeParse({
    name: str(fd, "name"),
    email: str(fd, "email"),
    password: str(fd, "password"),
    terms: fd.get("terms") ?? undefined,
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  // Optional "your boat" block — only validated if the user started filling it in.
  let boat = null;
  if (BOAT_KEYS.some((k) => str(fd, k).trim() !== "")) {
    const b = boatSchema.safeParse({
      name: str(fd, "boat_name"),
      model: str(fd, "boat_model"),
      loaMeters: str(fd, "boat_loa"),
      draftMeters: str(fd, "boat_draft"),
      engineCruiseKt: str(fd, "boat_cruise"),
    });
    if (!b.success) {
      const f = fieldErrors(b.error);
      const map: Record<string, string> = { name: "boat_name", model: "boat_model", loaMeters: "boat_loa", draftMeters: "boat_draft", engineCruiseKt: "boat_cruise" };
      return { fields: Object.fromEntries(Object.entries(f).map(([k, v]) => [map[k] ?? k, v])), values };
    }
    boat = b.data;
  }

  const { name, email, password } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Same answer as a fresh signup: never reveal whether an email is registered.
    if (existing.emailVerifiedAt) await sendAlreadyRegistered(email, existing.name);
    else await sendVerifyEmail(email, existing.name, await issueEmailToken(existing.id, "verify_email"));
    return { done: true, email };
  }

  let userId: string;
  try {
    const user = await prisma.user.create({
      data: { name, email, passwordHash: await hashPassword(password), termsAcceptedAt: new Date() },
    });
    userId = user.id;
  } catch {
    // Unique race with a parallel signup for the same email.
    return { done: true, email };
  }
  if (boat) await createBoat(userId, boat);
  await sendVerifyEmail(email, name, await issueEmailToken(userId, "verify_email"));
  return { done: true, email };
}

// ── Resend verification ─────────────────────────────────────────

export async function resendVerification(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = emailOnlySchema.safeParse({ email: str(fd, "email") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const { email } = parsed.data;
  const ok = (await rateLimit("resend-ip", await clientIp(), 10, 3600)) && (await rateLimit("resend-email", email, 3, 3600));
  if (!ok) return { error: TOO_MANY, email };
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.emailVerifiedAt) {
    await sendVerifyEmail(email, user.name, await issueEmailToken(user.id, "verify_email"));
  }
  return { done: true, email };
}

// ── Verify email (button on /verify-email — link scanners can't consume it) ──

export async function verifyEmail(_: AuthState, fd: FormData): Promise<AuthState> {
  if (!(await rateLimit("verify-ip", await clientIp(), 30, 3600))) return { error: TOO_MANY };
  const userId = await consumeEmailToken(str(fd, "token"), "verify_email");
  if (!userId) return { error: "This link is invalid or has expired. Request a new one below." };
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await createSession(userId);
  const boats = await prisma.vesselProfile.count({ where: { ownerId: userId } });
  revalidatePath("/", "layout");
  redirect(boats ? "/" : "/settings?welcome=1#boats");
}

// ── Log in / out ────────────────────────────────────────────────

export async function login(_: AuthState, fd: FormData): Promise<AuthState> {
  const values = echo(fd, ["email"]);
  const parsed = loginSchema.safeParse({ email: str(fd, "email"), password: str(fd, "password") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };
  const { email, password } = parsed.data;

  const ok = (await rateLimit("login-ip", await clientIp(), 30, 900)) && (await rateLimit("login-email", email, 10, 900));
  if (!ok) return { error: TOO_MANY, values };

  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid) return { error: "Invalid email or password.", values };
  if (!user.emailVerifiedAt) {
    return { error: "Please confirm your email first — check your inbox.", unverified: true, email, values };
  }

  await createSession(user.id);
  revalidatePath("/", "layout");
  redirect(safeNext(str(fd, "next")));
}

export async function logout(): Promise<void> {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}

// ── Password reset ──────────────────────────────────────────────

export async function requestPasswordReset(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = emailOnlySchema.safeParse({ email: str(fd, "email") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values: echo(fd, ["email"]) };
  const { email } = parsed.data;
  const ok = (await rateLimit("forgot-ip", await clientIp(), 10, 3600)) && (await rateLimit("forgot-email", email, 3, 3600));
  if (!ok) return { error: TOO_MANY, values: { email } };
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) await sendResetPassword(email, user.name, await issueEmailToken(user.id, "reset_password"));
  // Same reply whether or not the account exists.
  return { done: true, email };
}

export async function resetPassword(_: AuthState, fd: FormData): Promise<AuthState> {
  if (!(await rateLimit("reset-ip", await clientIp(), 20, 3600))) return { error: TOO_MANY };
  const parsed = resetPasswordSchema.safeParse({
    token: str(fd, "token"),
    password: str(fd, "password"),
    confirm: str(fd, "confirm"),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const userId = await consumeEmailToken(parsed.data.token, "reset_password");
  if (!userId) return { error: "This reset link is invalid or has expired. Request a new one." };

  await prisma.user.update({
    where: { id: userId },
    // Following the emailed link proves the address, so it also verifies it.
    data: { passwordHash: await hashPassword(parsed.data.password), emailVerifiedAt: new Date() },
  });
  await revokeSessions(userId);
  await createSession(userId);
  revalidatePath("/", "layout");
  redirect("/");
}
