import { Resend } from "resend";

export const DEFAULT_EMAIL_FROM = "VitalWatch <onboarding@resend.dev>";

export interface Email {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(config: { apiKey: string; from: string }, email: Email) {
  const { error } = await new Resend(config.apiKey).emails.send({ from: config.from, ...email });
  // The error's own message can quote account details, so only its name is kept.
  if (error) throw new Error(`Resend rejected the email: ${error.name}`);
}

export function sendSignInEmail(options: { apiKey: string; from: string; to: string; url: string }) {
  return sendEmail(options, {
    to: options.to,
    subject: "Sign in to VitalWatch",
    text: `Use this link to sign in to VitalWatch:\n\n${options.url}\n\nThe link works once and expires in 24 hours. If you didn't ask for it, you can ignore this email.`,
  });
}
