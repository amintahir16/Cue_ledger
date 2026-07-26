import { NextResponse } from "next/server";
import { notFound, requireSession, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return notFound("Expense not found");

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
