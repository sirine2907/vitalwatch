import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import ResendProvider from "next-auth/providers/resend";
import { getDb } from "@/data/db";
import { accounts, sessions, users, verificationTokens } from "@/data/schema";
import { canReceiveEmail } from "@/domain/auth/email-policy";
import { DEFAULT_EMAIL_FROM, sendSignInEmail } from "@/integrations/resend";
import { readEnv } from "@/lib/env";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

export function enabledProviders() {
  const env = readEnv();
  return {
    github: Boolean(env.AUTH_GITHUB_ID && env.AUTH_GITHUB_SECRET),
    email: Boolean(env.RESEND_API_KEY),
  };
}

// Built per request, so importing this during a build doesn't need a database.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = readEnv();
  const enabled = enabledProviders();
  const from = env.EMAIL_FROM ?? DEFAULT_EMAIL_FROM;

  return {
    adapter: DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    session: { strategy: "database" },
    pages: {
      signIn: "/sign-in",
      error: "/sign-in",
      verifyRequest: "/sign-in/check-email",
    },
    providers: [
      ...(enabled.github
        ? [GitHub({ clientId: env.AUTH_GITHUB_ID, clientSecret: env.AUTH_GITHUB_SECRET })]
        : []),
      ...(enabled.email
        ? [
            ResendProvider({
              apiKey: env.RESEND_API_KEY,
              from,
              sendVerificationRequest: ({ identifier, url }) =>
                sendSignInEmail({ apiKey: env.RESEND_API_KEY!, from, to: identifier, url }),
            }),
          ]
        : []),
    ],
    callbacks: {
      signIn({ account, user }) {
        if (account?.provider !== "resend") return true;
        return canReceiveEmail(user.email ?? "", env.EMAIL_OWNER_ADDRESS);
      },
      session({ session, user }) {
        session.user.id = user.id;
        return session;
      },
    },
  };
});
