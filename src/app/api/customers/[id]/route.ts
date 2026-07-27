import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound, requireSession, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || "Invalid input");
  }

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return notFound("Customer not found");

  const data = parsed.data;
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
      ...(data.email !== undefined ? { email: data.email || null } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
    include: { _count: { select: { sessions: true } } },
  });

  return NextResponse.json({ customer });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const existing = await prisma.customer.findUnique({ where: { id } });
  if (!existing) return notFound("Customer not found");

  await prisma.customer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
