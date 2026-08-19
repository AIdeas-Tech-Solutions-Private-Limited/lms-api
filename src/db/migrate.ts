import fs from "fs";
import path from "path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";

export async function runMigrations(): Promise<void> {
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(
      `Drizzle migrations folder not found at ${migrationsFolder}`
    );
  }

  await migrate(db, { migrationsFolder });
}
