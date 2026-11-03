import { DISPATCH_PATH } from "@/integrations/job-queue";
import { monitoringService } from "@/services/app.factory";
import { readVerifiedBody, unauthorized } from "../verify";

// In development every job runs inside this request, which can take minutes.
export const maxDuration = 300;

/** Called by a QStash schedule every 15 minutes. */
export async function POST(request: Request) {
  if ((await readVerifiedBody(request, DISPATCH_PATH)) === null) return unauthorized();

  const result = await monitoringService().dispatchDue();
  return Response.json(result);
}
