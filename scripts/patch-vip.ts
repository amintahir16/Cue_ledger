import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  await prisma.clubSettings.update({
    where: { id: "default" },
    data: {
      vipHourlyRate: 800,
      billingIncrementSeconds: 1,
    },
  });

  const vip = await prisma.snookerTable.updateMany({
    where: { name: { contains: "VIP", mode: "insensitive" } },
    data: { isVip: true, hourlyRate: 800 },
  });

  console.log("vip marked", vip.count);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
