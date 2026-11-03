import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { enabledProviders } from "@/auth";
import { EmailSignInForm } from "@/components/email-sign-in-form";
import { Button } from "@/components/ui/button";
import { readEnv } from "@/lib/env";
import { getCurrentUser, isAuthConfigured } from "@/lib/session";
import { signInWithEmail, signInWithGitHub } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    "That email already has an account from another sign-in method. Please use the original one.",
  AccessDenied: "This sign-in isn't allowed.",
  Verification: "That sign-in link has expired or was already used. Please request a new one.",
};
const DEFAULT_ERROR = "We couldn't sign you in. Please try again.";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  if (await getCurrentUser()) redirect("/projects");

  const { error } = await searchParams;
  const message = error ? (ERROR_MESSAGES[String(error)] ?? DEFAULT_ERROR) : null;
  const providers = enabledProviders();
  const ready = isAuthConfigured() && (providers.github || providers.email);

  return (
    <div className="mx-auto max-w-sm sm:pt-8">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-muted-foreground">
        Save your sites and keep the history of every test.
      </p>

      {message && (
        <p role="alert" className="mt-6 rounded-lg border bg-card p-3 text-sm text-poor">
          {message}
        </p>
      )}

      {!ready && (
        <p className="mt-6 rounded-lg border bg-card p-3 text-sm text-muted-foreground">
          Sign-in isn&apos;t set up on this server yet. See the README for the required settings.
        </p>
      )}

      {ready && providers.github && (
        <form action={signInWithGitHub} className="mt-6">
          <Button type="submit" className="h-11 w-full">
            Continue with GitHub
          </Button>
        </form>
      )}

      {ready && providers.email && (
        <div className="mt-6 border-t pt-6">
          <EmailSignInForm action={signInWithEmail} />
          {readEnv().EMAIL_OWNER_ADDRESS && (
            <p className="mt-3 text-sm text-muted-foreground">
              On this demo, email sign-in only works for the site owner.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
