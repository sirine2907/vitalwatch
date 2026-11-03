import { NextResponse } from "next/server";
import { AppError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";
import { suggestionService } from "@/services/app.factory";

// Fetching the site and waiting for the model can take a while.
export const maxDuration = 120;

export async function POST(_request: Request, { params }: { params: Promise<{ runId: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AppError("unauthorized", "Please sign in first.", { status: 401 });

    const { runId } = await params;
    const stored = await suggestionService().generate(user.id, runId);
    return NextResponse.json({ fixes: stored.suggestions.fixes.length });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    console.error("[vitalwatch] suggestions failed:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json(
      { error: { code: "internal", message: "Something went wrong on our side. Please try again." } },
      { status: 500 },
    );
  }
}
