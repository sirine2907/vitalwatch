import { Resend } from "resend";

export const DEFAULT_EMAIL_FROM = "VitalWatch <onboarding@resend.dev>";

export async function sendSignInEmail(options: {
  apiKey: string;
  from: string;
  to: string;
  url: string;
}) {
  const { error } = await new Resend(options.apiKey).emails.send({
    from: options.from,
    to: options.to,
    subject: "Sign in to VitalWatch",
    text: `Use this link to sign in to VitalWatch:\n\n${options.url}\n\nThe link works once and expires in 24 hours. If you didn't ask for it, you can ignore this email.`,
  });
  // The error's own message can quote account details, so only its name is kept.
  if (error) throw new Error(`Resend rejected the sign-in email: ${error.name}`);
}
