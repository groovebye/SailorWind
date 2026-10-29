"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser, ownedPassage } from "@/lib/auth/dal";
import { rateLimit } from "@/lib/auth/rate-limit";
import { emailOnlySchema, fieldErrors } from "@/lib/auth/schemas";

export type CrewState = { ok?: string; error?: string; nonce?: number } | undefined;

function str(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
}

/** Owner adds an existing SailorWind account to the passage crew by email. */
export async function addCrew(passageRef: string, _: CrewState, fd: FormData): Promise<CrewState> {
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/p/${passageRef}`);
  if (!(await rateLimit("crew-add", me.id, 30, 3600))) return { error: "Too many attempts. Try again later." };

  const passage = await prisma.passage.findFirst({ where: ownedPassage(passageRef, me.id), select: { id: true, shortId: true } });
  if (!passage) return { error: "Only the passage owner can add crew." };

  const parsed = emailOnlySchema.safeParse({ email: str(fd, "email") });
  if (!parsed.success) return { error: fieldErrors(parsed.error).email };

  const mate = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, name: true } });
  if (!mate) return { error: "No SailorWind account with that email yet — ask them to sign up first, then add them." };
  if (mate.id === me.id) return { error: "That's you — you already own this passage." };

  await prisma.passageMember.upsert({
    where: { passageId_userId: { passageId: passage.id, userId: mate.id } },
    create: { passageId: passage.id, userId: mate.id },
    update: {},
  });
  revalidatePath(`/p/${passage.shortId}`);
  return { ok: `${mate.name} can now see and edit this passage.`, nonce: Date.now() };
}

/** Owner removes a crew member, or a crew member leaves the passage. */
export async function removeCrew(passageRef: string, fd: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=/p/${passageRef}`);
  const userId = str(fd, "userId");
  const passage = await prisma.passage.findFirst({
    where: { OR: [{ shortId: passageRef }, { id: passageRef }] },
    select: { id: true, shortId: true, ownerId: true },
  });
  if (!passage) return;
  const leaving = userId === me.id;
  if (!leaving && passage.ownerId !== me.id) return;
  await prisma.passageMember.deleteMany({ where: { passageId: passage.id, userId } });
  if (leaving) {
    revalidatePath("/", "layout");
    redirect("/");
  }
  revalidatePath(`/p/${passage.shortId}`);
}
