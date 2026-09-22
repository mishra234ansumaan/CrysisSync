/**
 * Seed script — populates 20 demo SOS reports + 8 volunteers.
 * Run: npx tsx scripts/seed.ts            (skip if data exists)
 *      npx tsx scripts/seed.ts --force   (wipe + reseed)
 */
import "dotenv/config";
import { seedDatabase } from "../src/lib/seed";

async function main() {
  const force = process.argv.includes("--force");
  const result = await seedDatabase(force);
  console.log("[seed]", result);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
