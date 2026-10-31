"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { canReceiveEmail } from "@/domain/auth/email-policy";
import { createRedisRateLimiter, noRateLimit } from "@/integrations/rate-limit";
import { getRedis } from "@/integrations/redis";
import { getClientIp } from "@/lib/client-ip";
import { readEnv } from "@/lib/env";

export interface EmailSignInState {
  error?: string;
  email?: string;
}

const AFTER_SIGN_IN = "/projects";

export async function signInWithGitHub() {
  await signIn("github", { redirectTo: AFTER_SIGN_IN });
}

export async function signInWithEmail(
  _previous: EmailSignInState,
  formData: FormData,
): Promise<EmailSignInState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!z.email().safeParse(email).success) {
    return { error: "Enter a valid email address.", email };
  }

  const env = readEnv();
  if (!canReceiveEmail(email, env.EMAIL_OWNER_ADDRESS)) {
    return { error: "Email sign-in is limited to the site owner. Please use GitHub.", email };
  }

  // The free email quota is small, and links shouldn't be able to flood an inbox.
  const redis = getRedis(env);
  const limit = redis
    ? createRedisRateLimiter(redis, { prefix: "ratelimit:email", requests: 5, window: "10 m" })
    : noRateLimit;
  const clientIp = getClientIp(await headers(), Boolean(process.env.VERCEL));
  const decision = await limit(clientIp).catch(() => null);
  if (decision && !decision.allowed) {
    return { error: "Too many sign-in emails. Please try again in a few minutes.", email };
  }

  try {
    // Auth.js would redirect through an API route, which client navigation can't
    // follow from a server action, so this goes straight to our own page instead.
    await signIn("resend", { email, redirectTo: AFTER_SIGN_IN, redirect: false });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    console.error("[vitalwatch] email sign-in failed:", error.type);
    return { error: "We couldn't send the email. Please try again.", email };
  }
  redirect("/sign-in/check-email");
}

export async function signOutUser() {
  await signOut({ redirectTo: "/" });
}
