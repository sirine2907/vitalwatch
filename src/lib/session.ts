import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { readEnv } from "./env";

export function isAuthConfigured(): boolean {
  const env = readEnv();
  return Boolean(env.DATABASE_URL && env.AUTH_SECRET);
}

/** Returns the signed-in user, or null. Public pages keep working if auth is down. */
export async function getCurrentUser() {
  // Without this, a build with no settings would freeze pages as signed out.
  await connection();
  if (!isAuthConfigured()) return null;
  try {
    const session = await auth();
    return session?.user ?? null;
  } catch (error) {
    console.error("[vitalwatch] session check failed:", error instanceof Error ? error.name : "unknown");
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
