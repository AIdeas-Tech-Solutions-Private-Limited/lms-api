import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { config } from "../config";
import { db } from "./index";
import { users } from "./schema";

export async function seedAdmin(): Promise<void> {
  console.log("Checking default admin user...");

  const email = config.admin.email.trim();
  const name = config.admin.name.trim();
  const role = config.admin.role.trim() || "admin";
  const password = config.admin.password;

  if (!email || !name || !password) {
    console.warn(
      "Admin seed skipped: ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD must be set."
    );
    return;
  }

  const existing = await db
    .select({
      id: users.id,
      role: users.role,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing.length > 0) {
    console.log("Default admin user already exists.");
    if (existing[0].role !== role) {
      console.warn(
        `User ${email} already exists with role "${existing[0].role}". Role and password were left unchanged.`
      );
    }
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const inserted = await db
    .insert(users)
    .values({
      name,
      email,
      password: hashedPassword,
      role,
    })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });

  if (inserted.length === 0) {
    console.log("Default admin user already exists.");
    return;
  }

  console.log("Default admin user created.");
}
