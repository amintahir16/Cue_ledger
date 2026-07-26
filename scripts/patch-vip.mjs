import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

await prisma.clubSettings.update({
  where: { id: "default" },
  data: {
    vipHourlyRate: 800,
    billingIncrementSeconds: 1,
  },
});

const vip = await prisma.snookerTable.updateMany({
  where: {
    OR: [{ name: { contains: "VIP", mode: "insensitive" } }],
  },
  data: { isVip: true, hourlyRate: 800 },
});

console.log("settings updated, vip tables marked:", vip.count);
await prisma.$disconnect();
