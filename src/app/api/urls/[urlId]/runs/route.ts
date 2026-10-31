import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { STRATEGIES } from "@/domain/psi/types";
import { AppError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";
import { runService } from "@/services/app.factory";

// PSI can take over a minute, and failed attempts are retried.
export const maxDuration = 300;

const bodySchema = z.object({ strategy: z.enum(STRATEGIES) });

function errorResponse(error: AppError) {
  return NextResponse.json(
    { error: { code: error.code, message: error.message } },
    {
      status: error.status,
      headers: error.retryAfterSeconds ? { "Retry-After": String(error.retryAfterSeconds) } : {},
    },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ urlId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("unauthorized", "Please sign in first.", { status: 401 });

    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      throw new AppError("invalid_request", "Send a mobile or desktop strategy.", { status: 400 });
    }

    const { urlId } = await params;
    const result = await runService().runManualTest(user.id, urlId, body.data.strategy);
    return NextResponse.json({ score: result.score });
  } catch (error) {
    if (error instanceof AppError) return errorResponse(error);

    console.error("[vitalwatch] test run failed:", error instanceof Error ? error.name : "unknown");
    return errorResponse(
      new AppError("internal", "Something went wrong on our side. Please try again.", { status: 500 }),
    );
  }
}
