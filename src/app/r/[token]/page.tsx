import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/reports/report-view";
import { reportService } from "@/services/app.factory";

export const metadata: Metadata = {
  title: "Performance report",
  robots: { index: false, follow: false },
  // The token is in this page's URL, so it must never leak through a Referer header.
  referrer: "no-referrer",
};

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const snapshot = await reportService().getShared(token);
  if (!snapshot) notFound();

  return <ReportView snapshot={snapshot} pdfHref={`/r/${token}/pdf`} />;
}
