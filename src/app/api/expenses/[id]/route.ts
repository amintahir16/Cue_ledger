import { NextResponse } from "next/server";
import { z } from "zod";
import {
  badRequest,
  notFound,
  requireSession,
  unauthorized,
} from "@/lib/api";
import { parseLocalDate, toNumber } from "@/lib/billing";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const categoryEnum = z.enum([
  "ELECTRICITY",
  "RENT",
  "SALARY",
  "MAINTENANCE",
  "SUPPLIES",
  "MARKETING",
  "EQUIPMENT",
  "OTHER",
]);

function dateOnly(d: Date) {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function isEditableWithin24h(createdAt: Date) {
  return Date.now() - createdAt.getTime() <= TWENTY_FOUR_HOURS_MS;
}

const updateSchema = z.object({
  category: categoryEnum.optional(),
  title: z.string().min(1).max(120).optional(),
  amount: z.number().positive().optional(),
  expenseDate: z.string().min(1).optional(),
  notes: z.string().nullable().optional(),
  employeeName: z.string().nullable().optional(),
});

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return notFound("Expense not found");

  if (!isEditableWithin24h(expense.createdAt)) {
    return badRequest("Expenses can only be edited within 24 hours of creation");
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || "Invalid");
  }

  let expenseDate = expense.expenseDate;
  if (parsed.data.expenseDate) {
    const reference = parseLocalDate(parsed.data.expenseDate);
    if (!reference) return badRequest("Invalid expense date");
    expenseDate = dateOnly(reference);
  }

  const updated = await prisma.expense.update({
    where: { id },
    data: {
      category: parsed.data.category,
      title: parsed.data.title,
      amount: parsed.data.amount,
      expenseDate,
      notes: parsed.data.notes,
      employeeName: parsed.data.employeeName,
    },
  });

  return NextResponse.json({
    expense: { ...updated, amount: toNumber(updated.amount) },
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await requireSession();
  if (!session) return unauthorized();
  const { id } = await ctx.params;

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return notFound("Expense not found");

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
