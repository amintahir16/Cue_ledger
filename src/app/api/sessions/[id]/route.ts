import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound, requireSession, unauthorized } from "@/lib/api";
import { toNumber } from "@/lib/billing";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireSession();
  if (!auth) return unauthorized();
  const { id } = await ctx.params;

  const schema = z.object({
    paymentStatus: z.enum(["PENDING", "PAID", "WAIVED"]).optional(),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid");

  const existing = await prisma.gameSession.findUnique({ where: { id } });
  if (!existing) return notFound();

  const session = await prisma.gameSession.update({
    where: { id },
    data: {
      paymentStatus: parsed.data.paymentStatus,
      notes: parsed.data.notes,
      paidAt:
        parsed.data.paymentStatus === "PAID"
          ? new Date()
          : parsed.data.paymentStatus
            ? null
            : undefined,
    },
  });

  return NextResponse.json({
    session: {
      ...session,
      totalCharge: toNumber(session.totalCharge),
    },
  });
}
