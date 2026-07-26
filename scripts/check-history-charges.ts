import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { calculateTableCharge, toNumber } from "../src/lib/billing";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const settings = await prisma.clubSettings.findUnique({
    where: { id: "default" },
  });
  console.log("SETTINGS", {
    defaultHourlyRate: toNumber(settings?.defaultHourlyRate),
    vipHourlyRate: toNumber(settings?.vipHourlyRate),
    minimumCharge: toNumber(settings?.minimumCharge),
    billingIncrementSeconds: settings?.billingIncrementSeconds,
  });

  const sessions = await prisma.gameSession.findMany({
    where: { status: "COMPLETED" },
    include: { table: true, addons: true },
    orderBy: { startedAt: "desc" },
    take: 10,
  });

  for (const s of sessions) {
    const elapsedMs = (s.durationSeconds || 0) * 1000;
    const pure = calculateTableCharge({
      elapsedMs,
      hourlyRate: toNumber(s.hourlyRate),
      minimumCharge: 0,
      billingIncrementSeconds: settings?.billingIncrementSeconds ?? 1,
    });
    const withMin = calculateTableCharge({
      elapsedMs,
      hourlyRate: toNumber(s.hourlyRate),
      minimumCharge: toNumber(settings?.minimumCharge),
      billingIncrementSeconds: settings?.billingIncrementSeconds ?? 1,
    });
    console.log({
      table: s.table.name,
      duration: s.durationSeconds,
      durationFmt: `${Math.floor((s.durationSeconds || 0) / 60)}m ${(s.durationSeconds || 0) % 60}s`,
      sessionHourlyRate: toNumber(s.hourlyRate),
      pureTimeCharge: pure,
      withMinimum: withMin,
      tableChargeStored: toNumber(s.tableCharge),
      extras: toNumber(s.addonsTotal),
      addonLines: s.addons.map((a) => `${a.quantity}x ${a.name}=${toNumber(a.lineTotal)}`),
      totalStored: toNumber(s.totalCharge),
      expectedTotal: Math.round((withMin + toNumber(s.addonsTotal)) * 100) / 100,
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
