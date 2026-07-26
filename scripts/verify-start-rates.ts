import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  calculateTableCharge,
  resolveHourlyRate,
  toNumber,
} from "../src/lib/billing";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  // Set distinctive rates
  await prisma.clubSettings.update({
    where: { id: "default" },
    data: {
      defaultHourlyRate: 700,
      vipHourlyRate: 1500,
      minimumCharge: 0,
      billingIncrementSeconds: 1,
    },
  });
  await prisma.snookerTable.updateMany({
    where: { isVip: false },
    data: { hourlyRate: 700 },
  });
  await prisma.snookerTable.updateMany({
    where: { isVip: true },
    data: { hourlyRate: 1500 },
  });

  const settings = await prisma.clubSettings.findUniqueOrThrow({
    where: { id: "default" },
  });
  const tables = await prisma.snookerTable.findMany({
    where: { isActive: true },
    orderBy: { number: "asc" },
  });

  // Clear any active sessions first
  await prisma.gameSession.updateMany({
    where: { status: { in: ["ACTIVE", "PAUSED"] } },
    data: { status: "CANCELLED", endedAt: new Date(), paymentStatus: "WAIVED" },
  });
  await prisma.snookerTable.updateMany({
    data: { status: "AVAILABLE" },
  });

  for (const table of tables) {
    const expected = resolveHourlyRate({
      isVip: table.isVip,
      defaultHourlyRate: settings.defaultHourlyRate,
      vipHourlyRate: settings.vipHourlyRate,
      tableHourlyRate: table.hourlyRate,
    });

    const startedAt = new Date(Date.now() - 60_000); // 1 minute ago
    const session = await prisma.gameSession.create({
      data: {
        tableId: table.id,
        status: "COMPLETED",
        startedAt,
        endedAt: new Date(),
        hourlyRate: expected,
        durationSeconds: 60,
        tableCharge: calculateTableCharge({
          elapsedMs: 60_000,
          hourlyRate: expected,
          minimumCharge: 0,
          billingIncrementSeconds: 1,
        }),
        totalCharge: calculateTableCharge({
          elapsedMs: 60_000,
          hourlyRate: expected,
          minimumCharge: 0,
          billingIncrementSeconds: 1,
        }),
        paymentStatus: "PAID",
        paidAt: new Date(),
      },
    });

    const expectedCharge = Math.round((expected / 60) * 100) / 100; // 1 minute
    console.log({
      table: table.name,
      isVip: table.isVip,
      sessionRate: toNumber(session.hourlyRate),
      expectedRate: expected,
      rateOk: toNumber(session.hourlyRate) === expected,
      charge: toNumber(session.totalCharge),
      expectedCharge,
      chargeOk: toNumber(session.totalCharge) === expectedCharge,
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
