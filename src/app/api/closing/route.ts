import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireSession, unauthorized } from "@/lib/api";
import {
  parseLocalDate,
  periodRange,
  roundMoney,
  toDateInputValue,
  toNumber,
} from "@/lib/billing";
import { prisma } from "@/lib/db";

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
  const dayRange = periodRange("day", reference);
  const closingDateKey = dateOnly(reference);

  const [closings, existing, lastClosing, paidAgg] = await Promise.all([
    prisma.dailyClosing.findMany({
      where: {
        closingDate: { gte: dateOnly(start), lte: dateOnly(end) },
      },
      orderBy: { closingDate: "desc" },
      take: 100,
    }),
    prisma.dailyClosing.findUnique({
      where: { closingDate: closingDateKey },
    }),
    prisma.dailyClosing.findFirst({
      where: { closingDate: { lt: closingDateKey } },
      orderBy: { closingDate: "desc" },
    }),
    prisma.gameSession.aggregate({
      where: {
        status: "COMPLETED",
        paymentStatus: "PAID",
        endedAt: { gte: dayRange.start, lte: dayRange.end },
      },
      _sum: { totalCharge: true },
    }),
  ]);

  const paidRevenue = roundMoney(toNumber(paidAgg._sum.totalCharge));
  const suggestedOpening = existing
    ? roundMoney(toNumber(existing.openingCash))
    : lastClosing
      ? roundMoney(toNumber(lastClosing.closingCash))
      : 0;
  const suggestedClosing = existing
    ? roundMoney(toNumber(existing.closingCash))
    : roundMoney(suggestedOpening + paidRevenue);

  return NextResponse.json({
    date: dateParam,
    period: period.data,
    range: { start, end },
    closings: closings.map((c) => ({
      ...c,
      openingCash: toNumber(c.openingCash),
      closingCash: toNumber(c.closingCash),
    })),
    suggestion: {
      openingCash: suggestedOpening,
      closingCash: suggestedClosing,
      paidRevenue,
      lastClosing: lastClosing
        ? {
            date: lastClosing.closingDate,
            closingCash: toNumber(lastClosing.closingCash),
          }
        : null,
      existing: existing
        ? {
            openingCash: toNumber(existing.openingCash),
            closingCash: toNumber(existing.closingCash),
            notes: existing.notes,
          }
        : null,
    },
  });
}

const schema = z.object({
  closingDate: z.string(),
  openingCash: z.number().nonnegative(),
  closingCash: z.number().nonnegative(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message || "Invalid");
  }

  const reference = parseLocalDate(parsed.data.closingDate);
  if (!reference) return badRequest("Invalid date. Use YYYY-MM-DD.");
  const closingDateKey = dateOnly(reference);

  const closing = await prisma.dailyClosing.upsert({
    where: { closingDate: closingDateKey },
    update: {
      openingCash: roundMoney(parsed.data.openingCash),
      closingCash: roundMoney(parsed.data.closingCash),
      notes: parsed.data.notes,
    },
    create: {
      closingDate: closingDateKey,
      openingCash: roundMoney(parsed.data.openingCash),
      closingCash: roundMoney(parsed.data.closingCash),
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json({
    closing: {
      ...closing,
      openingCash: toNumber(closing.openingCash),
      closingCash: toNumber(closing.closingCash),
    },
  });
}
