import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound, requireSession, unauthorized } from "@/lib/api";
import { toNumber } from "@/lib/billing";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const addonSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1),
  unitPrice: z.number().nonnegative(),
  quantity: z.number().int().positive().default(1),
});

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireSession();
  if (!auth) return unauthorized();
  const { id: sessionId } = await ctx.params;

  const parsed = addonSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid");

  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    include: { addons: true },
  });
  if (!session) return notFound("Session not found");
  if (session.status !== "ACTIVE" && session.status !== "PAUSED") {
    return badRequest("Can only add items to an active session");
  }

  const lineTotal =
    Math.round(parsed.data.unitPrice * parsed.data.quantity * 100) / 100;

  const addon = await prisma.sessionAddon.create({
    data: {
      sessionId,
      productId: parsed.data.productId,
      name: parsed.data.name,
      unitPrice: parsed.data.unitPrice,
      quantity: parsed.data.quantity,
      lineTotal,
    },
  });

  const addonsTotal =
    session.addons.reduce((s, a) => s + toNumber(a.lineTotal), 0) + lineTotal;

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { addonsTotal },
  });

  return NextResponse.json(
    {
      addon: {
        ...addon,
        unitPrice: toNumber(addon.unitPrice),
        lineTotal: toNumber(addon.lineTotal),
      },
    },
    { status: 201 },
  );
}
