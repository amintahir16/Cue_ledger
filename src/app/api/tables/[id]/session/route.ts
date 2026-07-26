import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound, requireSession, unauthorized } from "@/lib/api";
import {
  calculateTableCharge,
  getElapsedMs,
  resolveHourlyRate,
  roundMoney,
  toNumber,
} from "@/lib/billing";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const actionSchema = z.object({
  action: z.enum(["start", "pause", "resume", "stop", "reset"]),
  customerName: z.string().optional(),
  customerId: z.string().optional(),
  markPaid: z.boolean().optional(),
});

export async function POST(req: Request, ctx: Ctx) {
  const authSession = await requireSession();
  if (!authSession) return unauthorized();
  const { id: tableId } = await ctx.params;

  const parsed = actionSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid input");

  const { action, customerName, customerId, markPaid } = parsed.data;

  const table = await prisma.snookerTable.findUnique({ where: { id: tableId } });
  if (!table || !table.isActive) return notFound("Table not found");

  const settings = await prisma.clubSettings.findUnique({ where: { id: "default" } });
  const minimumCharge = toNumber(settings?.minimumCharge);
  const billingIncrementSeconds = settings?.billingIncrementSeconds ?? 1;

  const active = await prisma.gameSession.findFirst({
    where: { tableId, status: { in: ["ACTIVE", "PAUSED"] } },
    include: { addons: true },
  });

  if (action === "start") {
    if (active) return badRequest("Table already has an active session");
    if (table.status !== "AVAILABLE") return badRequest("Table is not available");

    // Always charge using the latest Settings rates at game start
    const sessionRate = resolveHourlyRate({
      isVip: table.isVip,
      defaultHourlyRate: settings?.defaultHourlyRate,
      vipHourlyRate: settings?.vipHourlyRate,
      tableHourlyRate: table.hourlyRate,
    });
    if (sessionRate <= 0) {
      return badRequest("Hourly rate is not configured. Set it in Settings.");
    }

    const now = new Date();
    const [session] = await prisma.$transaction([
      prisma.gameSession.create({
        data: {
          tableId,
          customerId: customerId || null,
          customerName: customerName || null,
          status: "ACTIVE",
          startedAt: now,
          hourlyRate: sessionRate,
        },
      }),
      prisma.snookerTable.update({
        where: { id: tableId },
        data: { status: "OCCUPIED", hourlyRate: sessionRate },
      }),
    ]);

    return NextResponse.json({
      session: {
        ...session,
        hourlyRate: toNumber(session.hourlyRate),
      },
    });
  }

  if (!active) return badRequest("No active session on this table");

  if (action === "pause") {
    if (active.status !== "ACTIVE") return badRequest("Session is not running");
    const now = new Date();
    const [session] = await prisma.$transaction([
      prisma.gameSession.update({
        where: { id: active.id },
        data: { status: "PAUSED", pausedAt: now },
      }),
      prisma.snookerTable.update({
        where: { id: tableId },
        data: { status: "PAUSED" },
      }),
    ]);
    return NextResponse.json({
      session: { ...session, hourlyRate: toNumber(session.hourlyRate) },
    });
  }

  if (action === "resume") {
    if (active.status !== "PAUSED" || !active.pausedAt) {
      return badRequest("Session is not paused");
    }
    const now = new Date();
    const extraPaused = now.getTime() - active.pausedAt.getTime();
    const [session] = await prisma.$transaction([
      prisma.gameSession.update({
        where: { id: active.id },
        data: {
          status: "ACTIVE",
          pausedAt: null,
          totalPausedMs: active.totalPausedMs + extraPaused,
        },
      }),
      prisma.snookerTable.update({
        where: { id: tableId },
        data: { status: "OCCUPIED" },
      }),
    ]);
    return NextResponse.json({
      session: { ...session, hourlyRate: toNumber(session.hourlyRate) },
    });
  }

  if (action === "stop") {
    const now = new Date();
    let totalPausedMs = active.totalPausedMs;
    if (active.status === "PAUSED" && active.pausedAt) {
      totalPausedMs += now.getTime() - active.pausedAt.getTime();
    }

    const elapsedMs = getElapsedMs(
      {
        startedAt: active.startedAt,
        pausedAt: active.status === "PAUSED" ? active.pausedAt : null,
        totalPausedMs: active.totalPausedMs,
        status: active.status,
      },
      now,
    );

    const tableCharge = roundMoney(
      calculateTableCharge({
        elapsedMs,
        hourlyRate: toNumber(active.hourlyRate),
        minimumCharge,
        billingIncrementSeconds,
      }),
    );
    const addonsTotal = roundMoney(
      active.addons.reduce((sum, a) => sum + toNumber(a.lineTotal), 0),
    );
    const totalCharge = roundMoney(tableCharge + addonsTotal);
    const durationSeconds = Math.floor(elapsedMs / 1000);

    const [session] = await prisma.$transaction([
      prisma.gameSession.update({
        where: { id: active.id },
        data: {
          status: "COMPLETED",
          endedAt: now,
          pausedAt: null,
          totalPausedMs,
          durationSeconds,
          tableCharge,
          addonsTotal,
          totalCharge,
          paymentStatus: markPaid ? "PAID" : "PENDING",
          paidAt: markPaid ? now : null,
        },
        include: { addons: true },
      }),
      prisma.snookerTable.update({
        where: { id: tableId },
        data: { status: "AVAILABLE" },
      }),
    ]);

    return NextResponse.json({
      session: {
        ...session,
        hourlyRate: toNumber(session.hourlyRate),
        tableCharge: toNumber(session.tableCharge),
        addonsTotal: toNumber(session.addonsTotal),
        totalCharge: toNumber(session.totalCharge),
      },
    });
  }

  if (action === "reset") {
    // Cancel active session without charging, free the table
    await prisma.$transaction([
      prisma.gameSession.update({
        where: { id: active.id },
        data: {
          status: "CANCELLED",
          endedAt: new Date(),
          pausedAt: null,
          durationSeconds: 0,
          tableCharge: 0,
          totalCharge: 0,
          paymentStatus: "WAIVED",
        },
      }),
      prisma.snookerTable.update({
        where: { id: tableId },
        data: { status: "AVAILABLE" },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return badRequest("Unknown action");
}
