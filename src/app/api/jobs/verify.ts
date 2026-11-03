import { verifyQStashSignature } from "@/integrations/job-queue";
import { appUrl, readEnv } from "@/lib/env";

/**
 * Reads a job request's body if QStash signed it for this exact URL. In local
 * development there is no QStash to sign anything, so unsigned calls are allowed.
 */
export async function readVerifiedBody(request: Request, path: string): Promise<string | null> {
  const body = await request.text();
  const env = readEnv();

  if (env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY) {
    const valid = await verifyQStashSignature({
      signature: request.headers.get("upstash-signature"),
      body,
      url: `${appUrl(env)}${path}`,
      currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    });
    return valid ? body : null;
  }
  return process.env.NODE_ENV === "development" ? body : null;
}

export const unauthorized = () => Response.json({ error: "Invalid signature" }, { status: 401 });
