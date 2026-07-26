import { NextResponse } from "next/server";
import { z } from "zod";
import {
  badRequest,
  requireSession,
  serverError,
  unauthorized,
} from "@/lib/api";
import { toNumber } from "@/lib/billing";
import { prisma } from "@/lib/db";

function serializeSettings(settings: {
  defaultHourlyRate: unknown;
  vipHourlyRate: unknown;
  minimumCharge: unknown;
  [key: string]: unknown;
}) {
  return {
    id: settings.id,
    clubName: settings.clubName,
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    defaultHourlyRate: toNumber(settings.defaultHourlyRate),
    vipHourlyRate: toNumber(settings.vipHourlyRate),
    minimumCharge: toNumber(settings.minimumCharge),
    billingIncrementMinutes: settings.billingIncrementMinutes,
    billingIncrementSeconds: settings.billingIncrementSeconds,
    timezone: settings.timezone,
    updatedAt: settings.updatedAt,
  };
}

export async function GET() {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    let settings = await prisma.clubSettings.findUnique({
      where: { id: "default" },
    });
    if (!settings) {
      settings = await prisma.clubSettings.create({ data: { id: "default" } });
    }
    return NextResponse.json({ settings: serializeSettings(settings) });
  } catch (err) {
    console.error("GET /api/settings", err);
    return serverError("Failed to load settings");
  }
}

const updateSchema = z.object({
  clubName: z.string().min(1).optional(),
  currency: z.string().min(1).optional(),
  currencySymbol: z.string().min(1).optional(),
  defaultHourlyRate: z.number().positive().optional(),
  vipHourlyRate: z.number().positive().optional(),
  minimumCharge: z.number().nonnegative().optional(),
  billingIncrementSeconds: z.number().int().positive().optional(),
  timezone: z.string().optional(),
});

export async function PATCH(req: Request) {
  const session = await requireSession();
  if (!session) return unauthorized();

  try {
    const parsed = updateSchema.safeParse(await req.json());
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message || "Invalid");
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.clubSettings.upsert({
        where: { id: "default" },
        update: parsed.data,
        create: { id: "default", ...parsed.data },
      });

      let standardUpdated = 0;
      let vipUpdated = 0;

      if (parsed.data.defaultHourlyRate != null) {
        const res = await tx.snookerTable.updateMany({
          where: { isActive: true, isVip: false },
          data: { hourlyRate: parsed.data.defaultHourlyRate },
        });
        standardUpdated = res.count;
      }
      if (parsed.data.vipHourlyRate != null) {
        const res = await tx.snookerTable.updateMany({
          where: { isActive: true, isVip: true },
          data: { hourlyRate: parsed.data.vipHourlyRate },
        });
        vipUpdated = res.count;
      }

      return { updated, standardUpdated, vipUpdated };
    });

    return NextResponse.json({
      settings: serializeSettings(result.updated),
      synced: {
        standardTables: result.standardUpdated,
        vipTables: result.vipUpdated,
      },
    });
  } catch (err) {
    console.error("PATCH /api/settings", err);
    const message =
      err instanceof Error ? err.message : "Failed to save settings";
    return serverError(message);
  }
}
