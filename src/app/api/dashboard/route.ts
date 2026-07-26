import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireSession, unauthorized } from "@/lib/api";
import { parseLocalDate, periodRange, toNumber } from "@/lib/billing";
import { prisma } from "@/lib/db";
import { getOrCreateClubSettings } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const periodParam = req.nextUrl.searchParams.get("period") || "day";
  const periodSchema = z.enum(["day", "month", "year"]);
  const period = periodSchema.safeParse(periodParam);
  if (!period.success) return badRequest("Invalid period");

  const dateParam = req.nextUrl.searchParams.get("date");
  let reference = new Date();
  if (dateParam) {
    const parsed = parseLocalDate(dateParam);
    if (!parsed) return badRequest("Invalid date. Use YYYY-MM-DD.");
    reference = parsed;
  }

  const { start, end } = periodRange(period.data, reference);

  const [completedSessions, expenses, tables, activeSessions, pendingPayments] =
    await Promise.all([
      prisma.gameSession.findMany({
        where: {
          status: "COMPLETED",
          endedAt: { gte: start, lte: end },
        },
        include: { table: true },
        orderBy: { endedAt: "desc" },
      }),
      prisma.expense.findMany({
        where: { expenseDate: { gte: start, lte: end } },
      }),
      prisma.snookerTable.findMany({ where: { isActive: true } }),
      prisma.gameSession.count({
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
      }),
      prisma.gameSession.aggregate({
        where: {
          status: "COMPLETED",
          paymentStatus: "PENDING",
          endedAt: { gte: start, lte: end },
        },
        _sum: { totalCharge: true },
        _count: true,
      }),
    ]);

  const revenue = completedSessions.reduce(
    (sum, s) => sum + toNumber(s.totalCharge),
    0,
  );
  const paidRevenue = completedSessions
    .filter((s) => s.paymentStatus === "PAID")
    .reduce((sum, s) => sum + toNumber(s.totalCharge), 0);
  const tableRevenue = completedSessions.reduce(
    (sum, s) => sum + toNumber(s.tableCharge),
    0,
  );
  const addonRevenue = completedSessions.reduce(
    (sum, s) => sum + toNumber(s.addonsTotal),
    0,
  );
  const totalExpenses = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
  const actualProfit = revenue - totalExpenses;

  const expensesByCategory = expenses.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + toNumber(e.amount);
    return acc;
  }, {});

  const occupied = tables.filter((t) => t.status !== "AVAILABLE").length;
  const available = tables.filter((t) => t.status === "AVAILABLE").length;

  const avgTicket =
    completedSessions.length > 0 ? revenue / completedSessions.length : 0;
  const totalPlayMinutes = completedSessions.reduce(
    (sum, s) => sum + (s.durationSeconds || 0) / 60,
    0,
  );

  const revenueSeries: { label: string; revenue: number; expenses: number }[] =
    [];
  if (period.data === "day") {
    for (let h = 0; h < 24; h++) {
      const label = `${String(h).padStart(2, "0")}:00`;
      const hourRev = completedSessions
        .filter((s) => s.endedAt && s.endedAt.getHours() === h)
        .reduce((sum, s) => sum + toNumber(s.totalCharge), 0);
      revenueSeries.push({ label, revenue: hourRev, expenses: 0 });
    }
  } else if (period.data === "month") {
    const daysInMonth = end.getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const dayRev = completedSessions
        .filter((s) => s.endedAt && s.endedAt.getDate() === d)
        .reduce((sum, s) => sum + toNumber(s.totalCharge), 0);
      const dayExp = expenses
        .filter((e) => e.expenseDate.getDate() === d)
        .reduce((sum, e) => sum + toNumber(e.amount), 0);
      revenueSeries.push({
        label: String(d),
        revenue: dayRev,
        expenses: dayExp,
      });
    }
  } else {
    for (let m = 0; m < 12; m++) {
      const label = new Date(2000, m, 1).toLocaleString("en", {
        month: "short",
      });
      const monthRev = completedSessions
        .filter((s) => s.endedAt && s.endedAt.getMonth() === m)
        .reduce((sum, s) => sum + toNumber(s.totalCharge), 0);
      const monthExp = expenses
        .filter((e) => e.expenseDate.getMonth() === m)
        .reduce((sum, e) => sum + toNumber(e.amount), 0);
      revenueSeries.push({
        label,
        revenue: monthRev,
        expenses: monthExp,
      });
    }
  }

  const settings = await getOrCreateClubSettings(session.user.id);

  return NextResponse.json({
    period: period.data,
    date: dateParam || null,
    range: { start, end },
    currencySymbol: settings.currencySymbol || "Rs",
    clubName: settings.clubName || "Snooker Club",
    stats: {
      revenue: round2(revenue),
      paidRevenue: round2(paidRevenue),
      tableRevenue: round2(tableRevenue),
      addonRevenue: round2(addonRevenue),
      totalExpenses: round2(totalExpenses),
      actualProfit: round2(actualProfit),
      gamesCompleted: completedSessions.length,
      activeGames: activeSessions,
      avgTicket: round2(avgTicket),
      totalPlayMinutes: Math.round(totalPlayMinutes),
      tablesTotal: tables.length,
      tablesOccupied: occupied,
      tablesAvailable: available,
      pendingPaymentsCount: pendingPayments._count,
      pendingPaymentsAmount: round2(
        toNumber(pendingPayments._sum.totalCharge),
      ),
      expensesByCategory,
    },
    recentSessions: completedSessions.slice(0, 8).map((s) => ({
      id: s.id,
      tableName: s.table.name,
      customerName: s.customerName,
      endedAt: s.endedAt,
      durationSeconds: s.durationSeconds,
      totalCharge: toNumber(s.totalCharge),
      paymentStatus: s.paymentStatus,
    })),
    revenueSeries,
  });
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
