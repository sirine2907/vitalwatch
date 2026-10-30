import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { STRATEGIES, type AnalyzeResponse } from "@/domain/psi/types";
import { getClientIp } from "@/lib/client-ip";
import { AppError } from "@/lib/errors";
import { buildAnalysisService } from "@/services/analysis.factory";

// PSI can take over a minute, and failed attempts are retried.
export const maxDuration = 300;

const bodySchema = z.object({
  url: z.string(),
  strategy: z.enum(STRATEGIES),
});

function errorResponse(error: AppError) {
  const body: AnalyzeResponse = {
    error: {
      code: error.code,
      message: error.message,
      retryAfterSeconds: error.retryAfterSeconds,
    },
  };
  const headers: HeadersInit = error.retryAfterSeconds
    ? { "Retry-After": String(error.retryAfterSeconds) }
    : {};
  return NextResponse.json(body, { status: error.status, headers });
}

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) {
      throw new AppError("invalid_request", "Send a URL and a mobile or desktop strategy.", {
        status: 400,
      });
    }

    const outcome = await buildAnalysisService().analyze({
      ...body.data,
      clientId: getClientIp(request.headers, Boolean(process.env.VERCEL)),
    });

    const headers: HeadersInit = outcome.rateLimit
      ? {
          "X-RateLimit-Limit": String(outcome.rateLimit.limit),
          "X-RateLimit-Remaining": String(outcome.rateLimit.remaining),
        }
      : {};
    const response: AnalyzeResponse = { result: outcome.result, cached: outcome.cached };
    return NextResponse.json(response, { headers });
  } catch (error) {
    if (error instanceof AppError) return errorResponse(error);

    console.error("[vitalwatch] analyze failed:", error instanceof Error ? error.name : "unknown");
    return errorResponse(
      new AppError("internal", "Something went wrong on our side. Please try again.", {
        status: 500,
      }),
    );
  }
}
