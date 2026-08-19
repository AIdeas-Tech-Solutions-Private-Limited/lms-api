import { waitForDatabase } from "./waitForDb";
import { runMigrations } from "./migrate";
import { seedAdmin } from "./seed";

export async function initializeDatabase(): Promise<void> {
  console.log("Waiting for database...");
  await waitForDatabase();

  console.log("Running database migrations...");
  await runMigrations();
  console.log("Database migrations completed.");

  await seedAdmin();
}
