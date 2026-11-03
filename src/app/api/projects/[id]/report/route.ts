import { renderReportPdf } from "@/components/reports/report-pdf";
import { reportFileName } from "@/domain/reports/snapshot";
import { AppError } from "@/lib/errors";
import { getCurrentUser } from "@/lib/session";
import { reportService } from "@/services/app.factory";

/** The owner's own PDF of the project's current results, without making a share link. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in first.", { status: 401 });

  const { id } = await params;
  try {
    const snapshot = await reportService().buildSnapshot(user.id, id);
    const pdf = await renderReportPdf(snapshot);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${reportFileName(snapshot.projectName, snapshot.generatedAt)}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AppError && error.code === "not_found") return new Response("Not found", { status: 404 });
    throw error;
  }
}
