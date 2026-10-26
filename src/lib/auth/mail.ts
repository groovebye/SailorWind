import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Transactional email over SMTP (Resend: smtp://resend:<API_KEY>@smtp.resend.com:465
 * as smtps://…). Without SMTP_URL the message is logged instead — fine for local dev.
 */
const FROM = process.env.MAIL_FROM || "SailorWind <noreply@sailorwind.com>";

/** Absolute base for links in emails. Never derived from the request Host header. */
export function appUrl(path: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

let transport: Transporter | null = null;
function getTransport() {
  if (!process.env.SMTP_URL) return null;
  transport ??= nodemailer.createTransport(process.env.SMTP_URL);
  return transport;
}

async function send(to: string, subject: string, text: string, html: string) {
  const t = getTransport();
  if (!t) {
    console.info(`[mail] (no SMTP_URL) to=${to} subject="${subject}"\n${text}`);
    return;
  }
  await t.sendMail({ from: FROM, to, subject, text, html });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function layout(title: string, body: string, cta?: { href: string; label: string }) {
  const button = cta
    ? `<p style="margin:28px 0"><a href="${esc(cta.href)}" style="background:#18b6e6;color:#03080f;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;display:inline-block">${esc(cta.label)}</a></p>
       <p style="font-size:12px;color:#6b7f95">Or paste this link into your browser:<br><span style="word-break:break-all">${esc(cta.href)}</span></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#03080f;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#eef5fc">
  <div style="max-width:520px;margin:0 auto;padding:36px 24px">
    <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#34e0ff;margin-bottom:18px">SailorWind</div>
    <h1 style="font-size:22px;font-weight:600;margin:0 0 14px">${esc(title)}</h1>
    <div style="font-size:15px;line-height:1.6;color:#c7d6e6">${body}</div>
    ${button}
    <p style="font-size:12px;color:#6b7f95;margin-top:36px">You received this because this address was used on sailorwind.com. If that wasn't you, ignore this email.</p>
  </div></body></html>`;
}

export async function sendVerifyEmail(to: string, name: string, token: string) {
  const link = appUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  await send(
    to,
    "Confirm your SailorWind account",
    `Hi ${name},\n\nConfirm your email to finish creating your SailorWind account:\n${link}\n\nThe link is valid for 48 hours.`,
    layout("Confirm your email", `<p>Hi ${esc(name)},</p><p>Confirm your email to finish creating your SailorWind account. The link is valid for 48 hours.</p>`, {
      href: link,
      label: "Confirm email",
    }),
  );
}

export async function sendResetPassword(to: string, name: string, token: string) {
  const link = appUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  await send(
    to,
    "Reset your SailorWind password",
    `Hi ${name},\n\nSet a new password here:\n${link}\n\nThe link is valid for 1 hour. If you didn't ask for this, ignore this email.`,
    layout("Reset your password", `<p>Hi ${esc(name)},</p><p>Someone (hopefully you) asked to reset your SailorWind password. The link is valid for 1 hour.</p>`, {
      href: link,
      label: "Set a new password",
    }),
  );
}

/** Sent instead of a second signup, so the form never reveals which emails are registered. */
export async function sendAlreadyRegistered(to: string, name: string) {
  const link = appUrl("/forgot-password");
  await send(
    to,
    "You already have a SailorWind account",
    `Hi ${name},\n\nSomeone tried to sign up with this email, but you already have an account. Sign in at ${appUrl("/login")} or reset your password: ${link}`,
    layout(
      "You already have an account",
      `<p>Hi ${esc(name)},</p><p>Someone tried to sign up with this email, but an account already exists. If it was you, just sign in — or reset your password if you forgot it.</p>`,
      { href: link, label: "Reset password" },
    ),
  );
}
