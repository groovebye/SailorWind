"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/dal";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { destroySession, revokeSessions } from "@/lib/auth/session";
import { rateLimit } from "@/lib/auth/rate-limit";
import { boatSchema, changePasswordSchema, fieldErrors, profileSchema } from "@/lib/auth/schemas";
import { createBoat, deleteBoat, setDefaultBoat, updateBoat } from "@/lib/vessels";

export type SettingsState =
  | { ok?: string; error?: string; fields?: Record<string, string>; values?: Record<string, string>; nonce?: number }
  | undefined;

const BOAT_FIELDS = ["name", "model", "loaMeters", "draftMeters", "engineCruiseKt", "engineMaxKt", "fuelTankLiters", "fuelBurnLph", "notes"];

function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
}

async function me() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings");
  return user;
}

function parseBoat(fd: FormData) {
  return boatSchema.safeParse(Object.fromEntries(BOAT_FIELDS.map((k) => [k, str(fd, k)])));
}

// ── Profile ─────────────────────────────────────────────────────

export async function updateProfile(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await me();
  const parsed = profileSchema.safeParse({ name: str(fd, "name") });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  await prisma.user.update({ where: { id: user.id }, data: { name: parsed.data.name } });
  revalidatePath("/", "layout");
  return { ok: "Profile saved." };
}

export async function changePassword(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await me();
  if (!(await rateLimit("chpw", user.id, 10, 3600))) return { error: "Too many attempts. Try again later." };
  const parsed = changePasswordSchema.safeParse({
    current: str(fd, "current"),
    password: str(fd, "password"),
    confirm: str(fd, "confirm"),
  });
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(parsed.data.current, row?.passwordHash))) {
    return { fields: { current: "Current password is incorrect." } };
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await revokeSessions(user.id, true);
  return { ok: "Password changed. Other devices have been signed out.", nonce: Date.now() };
}

export async function logoutEverywhere(): Promise<void> {
  const user = await me();
  await revokeSessions(user.id);
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function deleteAccount(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await me();
  if (str(fd, "confirm") !== "DELETE") return { fields: { confirm: 'Type DELETE to confirm.' } };
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(str(fd, "password"), row?.passwordHash))) {
    return { fields: { password: "Password is incorrect." } };
  }
  const boats = await prisma.vesselProfile.findMany({ where: { ownerId: user.id }, select: { id: true } });
  await prisma.$transaction([
    // LegComputation → VesselProfile has no cascade; clear it before the account cascade.
    prisma.legComputation.deleteMany({ where: { vesselProfileId: { in: boats.map((b) => b.id) } } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}

// ── Boats ───────────────────────────────────────────────────────

export async function addBoat(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await me();
  const parsed = parseBoat(fd);
  if (!parsed.success) {
    return { fields: fieldErrors(parsed.error), values: Object.fromEntries(BOAT_FIELDS.map((k) => [k, str(fd, k)])) };
  }
  await createBoat(user.id, parsed.data);
  revalidatePath("/", "layout");
  const next = str(fd, "next");
  if (next === "/new") redirect("/new");
  return { ok: `${parsed.data.name} added.`, nonce: Date.now() };
}

export async function editBoat(_: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await me();
  const parsed = parseBoat(fd);
  if (!parsed.success) {
    return { fields: fieldErrors(parsed.error), values: Object.fromEntries(BOAT_FIELDS.map((k) => [k, str(fd, k)])) };
  }
  if (!(await updateBoat(user.id, str(fd, "id"), parsed.data))) return { error: "Boat not found." };
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export async function makeDefaultBoat(fd: FormData): Promise<void> {
  const user = await me();
  await setDefaultBoat(user.id, str(fd, "id"));
  revalidatePath("/", "layout");
}

export async function removeBoat(fd: FormData): Promise<void> {
  const user = await me();
  await deleteBoat(user.id, str(fd, "id"));
  revalidatePath("/", "layout");
}
