import "dotenv/config";
import { Client } from "pg";
import { randomBytes } from "crypto";

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const users = await c.query(
    `SELECT id, email FROM "user" ORDER BY "createdAt" ASC LIMIT 1`,
  );
  if (!users.rows.length) throw new Error("No users found — create admin first");
  const userId = users.rows[0].id as string;
  console.log("Migrating settings for", users.rows[0].email, userId);

  const old = await c.query(`SELECT * FROM "ClubSettings" LIMIT 1`).catch(() => ({
    rows: [] as Record<string, unknown>[],
  }));
  const row = (old.rows[0] || {}) as Record<string, unknown>;

  await c.query(`DROP TABLE IF EXISTS "ClubSettings" CASCADE`);
  await c.query(`
    CREATE TABLE "ClubSettings" (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL UNIQUE,
      "clubName" TEXT NOT NULL DEFAULT 'My Snooker Club',
      currency TEXT NOT NULL DEFAULT 'PKR',
      "currencySymbol" TEXT NOT NULL DEFAULT 'Rs',
      "defaultHourlyRate" DECIMAL(10,2) NOT NULL DEFAULT 500,
      "vipHourlyRate" DECIMAL(10,2) NOT NULL DEFAULT 800,
      "minimumCharge" DECIMAL(10,2) NOT NULL DEFAULT 0,
      "billingIncrementMinutes" INTEGER NOT NULL DEFAULT 1,
      "billingIncrementSeconds" INTEGER NOT NULL DEFAULT 1,
      timezone TEXT NOT NULL DEFAULT 'Asia/Karachi',
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ClubSettings_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "user"(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await c.query(
    `INSERT INTO "ClubSettings" (
      id, "userId", "clubName", currency, "currencySymbol",
      "defaultHourlyRate", "vipHourlyRate", "minimumCharge",
      "billingIncrementMinutes", "billingIncrementSeconds", timezone, "updatedAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())`,
    [
      `cs_${randomBytes(8).toString("hex")}`,
      userId,
      row.clubName || "CueLedger Snooker Club",
      row.currency || "PKR",
      row.currencySymbol || "Rs",
      row.defaultHourlyRate ?? 500,
      row.vipHourlyRate ?? 800,
      row.minimumCharge ?? 0,
      row.billingIncrementMinutes ?? 1,
      row.billingIncrementSeconds ?? 1,
      row.timezone || "Asia/Karachi",
    ],
  );

  console.log("ClubSettings migrated to per-user");
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
