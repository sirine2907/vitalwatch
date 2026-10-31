import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { AppError } from "@/lib/errors";
import * as schema from "./schema";

/** Works with both the real driver and the in-process database used in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Reused across hot reloads in development, so connections don't pile up.
const cache = globalThis as unknown as { vitalwatchDb?: ReturnType<typeof connect> };

function connect(url: string) {
  // prepare: false keeps this working behind the poolers Neon and Supabase use.
  return drizzle(postgres(url, { prepare: false, max: 5 }), { schema });
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new AppError(
      "not_configured",
      "DATABASE_URL is missing. Add it to .env.local (see .env.example) and restart.",
      { status: 503 },
    );
  }
  cache.vitalwatchDb ??= connect(url);
  return cache.vitalwatchDb;
}
