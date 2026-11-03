import { renderReportPdf } from "@/components/reports/report-pdf";
import { reportFileName } from "@/domain/reports/snapshot";
import { reportService } from "@/services/app.factory";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const snapshot = await reportService().getShared(token);
  if (!snapshot) return new Response("Not found", { status: 404 });

  const pdf = await renderReportPdf(snapshot);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${reportFileName(snapshot.projectName, snapshot.generatedAt)}"`,
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
      "cache-control": "private, no-store",
    },
  });
}
