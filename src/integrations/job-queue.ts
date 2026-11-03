import { Client, Receiver } from "@upstash/qstash";
import type { Strategy } from "@/domain/psi/types";

export interface TestJob {
  urlId: string;
  strategy: Strategy;
  /** ISO time of the scheduled slot this job belongs to. */
  slot: string;
  trigger: "scheduled" | "retest";
  /** For a retest, the run whose result it checks. */
  confirmsRunId?: string;
}

export interface JobQueue {
  publishTest(job: TestJob, delaySeconds?: number): Promise<void>;
}

export const RUN_TEST_PATH = "/api/jobs/run-test";
export const DISPATCH_PATH = "/api/jobs/dispatch";

export function createQStashQueue(config: { token: string; baseUrl?: string; appUrl: string }): JobQueue {
  const client = new Client({ token: config.token, baseUrl: config.baseUrl });

  return {
    async publishTest(job, delaySeconds) {
      await client.publishJSON({
        url: `${config.appUrl}${RUN_TEST_PATH}`,
        body: job,
        delay: delaySeconds,
        retries: 3,
        // A second dispatcher tick for the same slot is dropped by QStash itself.
        deduplicationId: [job.urlId, job.strategy, job.trigger, Date.parse(job.slot)].join("_"),
      });
    },
  };
}

/** Checks that a request really came from QStash, for this exact URL and body. */
export async function verifyQStashSignature(options: {
  signature: string | null;
  body: string;
  url: string;
  currentSigningKey: string;
  nextSigningKey: string;
}): Promise<boolean> {
  if (!options.signature) return false;
  const receiver = new Receiver({
    currentSigningKey: options.currentSigningKey,
    nextSigningKey: options.nextSigningKey,
  });
  try {
    return await receiver.verify({
      signature: options.signature,
      body: options.body,
      url: options.url,
    });
  } catch {
    return false;
  }
}
