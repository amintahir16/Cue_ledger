import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, requireSession, unauthorized } from "@/lib/api";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/billing";

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  const tables = await prisma.snookerTable.findMany({
    where: { isActive: true },
    orderBy: { number: "asc" },
    include: {
      sessions: {
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
        take: 1,
        orderBy: { startedAt: "desc" },
        include: {
          addons: true,
          customer: true,
        },
      },
    },
  });

  return NextResponse.json({
    tables: tables.map((t) => ({
      ...t,
      hourlyRate: toNumber(t.hourlyRate),
      activeSession: t.sessions[0]
        ? {
            ...t.sessions[0],
            hourlyRate: toNumber(t.sessions[0].hourlyRate),
            tableCharge: toNumber(t.sessions[0].tableCharge),
            addonsTotal: toNumber(t.sessions[0].addonsTotal),
            totalCharge: toNumber(t.sessions[0].totalCharge),
            addons: t.sessions[0].addons.map((a) => ({
              ...a,
              unitPrice: toNumber(a.unitPrice),
              lineTotal: toNumber(a.lineTotal),
            })),
          }
        : null,
      sessions: undefined,
    })),
  });
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  number: z.number().int().positive(),
  hourlyRate: z.number().positive().optional(),
  isVip: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message || "Invalid input");

  const exists = await prisma.snookerTable.findUnique({
    where: { number: parsed.data.number },
  });
  if (exists) return badRequest(`Table number ${parsed.data.number} already exists`);

  const settings = await prisma.clubSettings.findUnique({ where: { id: "default" } });
  const isVip = parsed.data.isVip ?? false;
  const hourlyRate =
    parsed.data.hourlyRate ??
    (isVip
      ? toNumber(settings?.vipHourlyRate) || 800
      : toNumber(settings?.defaultHourlyRate) || 500);

  const table = await prisma.snookerTable.create({
    data: {
      name: parsed.data.name,
      number: parsed.data.number,
      hourlyRate,
      isVip,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json(
    { table: { ...table, hourlyRate: toNumber(table.hourlyRate) } },
    { status: 201 },
  );
}
