import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireSession, unauthorized } from "@/lib/api";
import { parseLocalDate, periodRange, toNumber } from "@/lib/billing";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const status = req.nextUrl.searchParams.get("status");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || 100), 200);
  const dateParam = req.nextUrl.searchParams.get("date");
  const periodParam = req.nextUrl.searchParams.get("period") || "day";
  const period = z.enum(["day", "month", "year"]).safeParse(periodParam);
  if (!period.success) return badRequest("Invalid period");

  let reference = new Date();
  if (dateParam) {
    const parsed = parseLocalDate(dateParam);
    if (!parsed) return badRequest("Invalid date. Use YYYY-MM-DD.");
    reference = parsed;
  }

  const { start, end } = periodRange(period.data, reference);

  const sessions = await prisma.gameSession.findMany({
    where: {
      ...(status
        ? { status: status as "COMPLETED" | "CANCELLED" | "ACTIVE" | "PAUSED" }
        : { status: { in: ["COMPLETED", "CANCELLED"] } }),
      OR: [
        { endedAt: { gte: start, lte: end } },
        {
          AND: [
            { endedAt: null },
            { startedAt: { gte: start, lte: end } },
          ],
        },
      ],
    },
    include: {
      table: true,
      customer: true,
      addons: true,
    },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    date: dateParam,
    period: period.data,
    range: { start, end },
    sessions: sessions.map((s) => ({
      ...s,
      hourlyRate: toNumber(s.hourlyRate),
      tableCharge: toNumber(s.tableCharge),
      addonsTotal: toNumber(s.addonsTotal),
      totalCharge: toNumber(s.totalCharge),
      addons: s.addons.map((a) => ({
        ...a,
        unitPrice: toNumber(a.unitPrice),
        lineTotal: toNumber(a.lineTotal),
      })),
    })),
  });
}
