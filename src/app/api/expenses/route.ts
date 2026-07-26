import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireSession, unauthorized } from "@/lib/api";
import {
  parseLocalDate,
  periodRange,
  toDateInputValue,
  toNumber,
} from "@/lib/billing";
import { prisma } from "@/lib/db";

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

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const dateParam =
    req.nextUrl.searchParams.get("date") || toDateInputValue();
  const periodParam = req.nextUrl.searchParams.get("period") || "day";
  const period = z.enum(["day", "month", "year"]).safeParse(periodParam);
  if (!period.success) return badRequest("Invalid period");

  const reference = parseLocalDate(dateParam);
  if (!reference) return badRequest("Invalid date. Use YYYY-MM-DD.");

  const { start, end } = periodRange(period.data, reference);

  const expenses = await prisma.expense.findMany({
    where: {
      expenseDate: { gte: dateOnly(start), lte: dateOnly(end) },
    },
    orderBy: { expenseDate: "desc" },
  });

  const total = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);

  return NextResponse.json({
    date: dateParam,
    period: period.data,
    expenses: expenses.map((e) => ({ ...e, amount: toNumber(e.amount) })),
    total: Math.round(total),
  });
}

const createSchema = z.object({
  category: categoryEnum,
  title: z.string().min(1).max(120),
  amount: z.number().positive(),
  expenseDate: z.string().min(1),
  notes: z.string().optional(),
  employeeName: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || "Invalid input");
  }

  const reference = parseLocalDate(parsed.data.expenseDate);
  if (!reference) return badRequest("Invalid expense date");

  const expense = await prisma.expense.create({
    data: {
      category: parsed.data.category,
      title: parsed.data.title,
      amount: parsed.data.amount,
      expenseDate: dateOnly(reference),
      notes: parsed.data.notes,
      employeeName: parsed.data.employeeName,
    },
  });

  return NextResponse.json(
    { expense: { ...expense, amount: toNumber(expense.amount) } },
    { status: 201 },
  );
}
