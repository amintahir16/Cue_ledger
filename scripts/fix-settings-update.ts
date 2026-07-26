import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const s = await prisma.clubSettings.update({
    where: { id: "default" },
    data: {
      defaultHourlyRate: 6000,
      vipHourlyRate: 8000,
      minimumCharge: 0,
      billingIncrementSeconds: 1,
    },
  });
  await prisma.snookerTable.updateMany({
    where: { isVip: false, isActive: true },
    data: { hourlyRate: 6000 },
  });
  await prisma.snookerTable.updateMany({
    where: { isVip: true, isActive: true },
    data: { hourlyRate: 8000 },
  });
  console.log("saved", {
    defaultHourlyRate: Number(s.defaultHourlyRate),
    vipHourlyRate: Number(s.vipHourlyRate),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
