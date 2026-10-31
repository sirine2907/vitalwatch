import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "@/data/db";
import * as schema from "@/data/schema";

/** A real Postgres running in-process, built from the app's own migrations. */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./src/data/migrations" });
  return { db: db as unknown as Db, close: () => client.close() };
}

export async function createUser(db: Db, email: string): Promise<string> {
  const [user] = await db.insert(schema.users).values({ email }).returning();
  return user.id;
}
