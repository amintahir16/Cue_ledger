import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { calculateTableCharge, toNumber } from "../src/lib/billing";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const before = await prisma.snookerTable.findMany({
    where: { isActive: true },
    orderBy: { number: "asc" },
  });
  console.log(
    "BEFORE",
    before.map((t) => ({
      name: t.name,
      isVip: t.isVip,
      rate: toNumber(t.hourlyRate),
    })),
  );

  await prisma.clubSettings.update({
    where: { id: "default" },
    data: {
      defaultHourlyRate: 600,
      vipHourlyRate: 1200,
      minimumCharge: 0,
      billingIncrementSeconds: 1,
    },
  });
  await prisma.snookerTable.updateMany({
    where: { isVip: false, isActive: true },
    data: { hourlyRate: 600 },
  });
  await prisma.snookerTable.updateMany({
    where: { isVip: true, isActive: true },
    data: { hourlyRate: 1200 },
  });

  const settings = await prisma.clubSettings.findUnique({
    where: { id: "default" },
  });
  const tables = await prisma.snookerTable.findMany({
    where: { isActive: true },
    orderBy: { number: "asc" },
  });
  console.log("SETTINGS", {
    std: toNumber(settings!.defaultHourlyRate),
    vip: toNumber(settings!.vipHourlyRate),
  });
  console.log(
    "AFTER",
    tables.map((t) => ({
      name: t.name,
      isVip: t.isVip,
      rate: toNumber(t.hourlyRate),
    })),
  );

  for (const t of tables) {
    const rate = t.isVip
      ? toNumber(settings!.vipHourlyRate)
      : toNumber(settings!.defaultHourlyRate);
    const charge1h = calculateTableCharge({
      elapsedMs: 3_600_000,
      hourlyRate: rate,
      minimumCharge: 0,
      billingIncrementSeconds: 1,
    });
    const charge30s = calculateTableCharge({
      elapsedMs: 30_000,
      hourlyRate: rate,
      minimumCharge: 0,
      billingIncrementSeconds: 1,
    });
    console.log({
      table: t.name,
      rate,
      charge1h,
      expected1h: rate,
      match: charge1h === rate,
      charge30s,
      expected30s: Math.round((rate / 120) * 100) / 100,
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
