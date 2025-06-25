import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const runMigrate = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  // NeonDB requires SSL
  const connection = postgres(process.env.DATABASE_URL, {
    max: 1,
    ssl: true,
  });

  const db = drizzle(connection);

  console.log("⏳ Running migrations...");
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("✅ Migrations completed successfully!");
  process.exit(0);
};

runMigrate().catch((err) => {
  console.error("❌ Migration failed");
  console.error(err);
  process.exit(1);
});
