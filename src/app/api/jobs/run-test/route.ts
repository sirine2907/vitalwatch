import { z } from "zod";
import { STRATEGIES } from "@/domain/psi/types";
import { RUN_TEST_PATH } from "@/integrations/job-queue";
import { monitoringService } from "@/services/app.factory";
import { readVerifiedBody, unauthorized } from "../verify";

// PSI can take over a minute, and failed attempts are retried.
export const maxDuration = 300;

const jobSchema = z.object({
  urlId: z.uuid(),
  strategy: z.enum(STRATEGIES),
  slot: z.iso.datetime(),
  trigger: z.enum(["scheduled", "retest"]),
  confirmsRunId: z.uuid().optional(),
});

/**
 * Runs one queued test. A failed test is recorded and still answered with 200,
 * because QStash retrying it wouldn't help and the slot is already used.
 */
export async function POST(request: Request) {
  const body = await readVerifiedBody(request, RUN_TEST_PATH);
  if (body === null) return unauthorized();

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    json = null;
  }
  const job = jobSchema.safeParse(json);
  if (!job.success) return Response.json({ error: "Invalid job" }, { status: 400 });

  const outcome = await monitoringService().runJob(job.data);
  return Response.json(outcome);
}
