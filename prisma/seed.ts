import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@snooker.club";
  const password = process.env.ADMIN_PASSWORD || "Admin@12345";
  const name = process.env.ADMIN_NAME || "Club Admin";

  await prisma.clubSettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      clubName: "CueLedger Snooker Club",
      currency: "PKR",
      currencySymbol: "Rs",
      defaultHourlyRate: 500,
      vipHourlyRate: 800,
      minimumCharge: 100,
      billingIncrementSeconds: 1,
    },
  });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const hashed = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        emailVerified: true,
      },
    });
    await prisma.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashed,
      },
    });
    console.log(`Admin created: ${email}`);
  } else {
    console.log(`Admin already exists: ${email}`);
  }

  const tableCount = await prisma.snookerTable.count();
  if (tableCount === 0) {
    await prisma.snookerTable.createMany({
      data: [
        { name: "Table 1", number: 1, hourlyRate: 500, isVip: false },
        { name: "Table 2", number: 2, hourlyRate: 500, isVip: false },
        { name: "VIP Table", number: 3, hourlyRate: 800, isVip: true },
      ],
    });
    console.log("Seeded 3 sample tables");
  }

  const productCount = await prisma.product.count();
  if (productCount === 0) {
    await prisma.product.createMany({
      data: [
        { name: "Soft Drink", price: 80, category: "F&B" },
        { name: "Mineral Water", price: 50, category: "F&B" },
        { name: "Chips", price: 100, category: "F&B" },
        { name: "Cue Tip Replace", price: 200, category: "Service" },
      ],
    });
    console.log("Seeded sample products");
  }

  console.log("Seed complete.");
  console.log(`Login: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
