import { pool } from "./index";

const MAX_ATTEMPTS = 30;
const DELAY_MS = 2000;

export async function waitForDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.error("Database connection failed after retries:", lastError);
  throw new Error(
    `PostgreSQL did not become ready after ${MAX_ATTEMPTS} attempts`
  );
}
