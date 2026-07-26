import { NextResponse } from "next/server";
import { badRequest, notFound, requireSession, unauthorized } from "@/lib/api";
import { toNumber } from "@/lib/billing";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string; addonId: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireSession();
  if (!auth) return unauthorized();
  const { id: sessionId, addonId } = await ctx.params;

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { addons: true },
  });
  if (!session) return notFound("Session not found");
  if (session.status !== "ACTIVE" && session.status !== "PAUSED") {
    return badRequest("Can only remove items from an active session");
  }

  const addon = session.addons.find((a) => a.id === addonId);
  if (!addon) return notFound("Extra not found on this session");

  await prisma.sessionAddon.delete({ where: { id: addonId } });

  const addonsTotal = Math.round(
    (session.addons
      .filter((a) => a.id !== addonId)
      .reduce((sum, a) => sum + toNumber(a.lineTotal), 0)) *
      100,
  ) / 100;

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { addonsTotal },
  });

  return NextResponse.json({ ok: true, addonsTotal });
}
