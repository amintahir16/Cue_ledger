import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound, requireSession, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/billing";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const schema = z.object({
    name: z.string().min(1).max(80).optional(),
    number: z.number().int().positive().optional(),
    hourlyRate: z.number().positive().optional(),
    isVip: z.boolean().optional(),
    notes: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid input");

  const table = await prisma.snookerTable.findUnique({ where: { id } });
  if (!table) return notFound("Table not found");

  if (parsed.data.number !== undefined && parsed.data.number !== table.number) {
    const clash = await prisma.snookerTable.findUnique({
      where: { number: parsed.data.number },
    });
    if (clash) {
      return badRequest(`Table number ${parsed.data.number} already exists`);
    }
  }

  const updated = await prisma.snookerTable.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({
    table: { ...updated, hourlyRate: toNumber(updated.hourlyRate) },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const table = await prisma.snookerTable.findUnique({
    where: { id },
    include: { sessions: { where: { status: { in: ["ACTIVE", "PAUSED"] } } } },
  });
  if (!table) return notFound("Table not found");
  if (table.sessions.length > 0) {
    return badRequest("Cannot delete a table with an active game. Stop or reset first.");
  }

  await prisma.snookerTable.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ ok: true });
}
