import type { Metadata } from "next";
import { ResultsView } from "@/components/results/results-view";
import { UrlForm } from "@/components/url-form";
import { validateUrl } from "@/domain/url/validate";

export const metadata: Metadata = {
  title: "Results",
  robots: { index: false },
};

export default async function AnalyzePage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string | string[] }>;
}) {
  const { url } = await searchParams;
  const input = typeof url === "string" ? url : "";
  const validation = validateUrl(input);

  if (!validation.ok) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Test a page</h1>
        {input && <p className="mt-2 text-poor">{validation.error}</p>}
        <div className="mt-6">
          <UrlForm defaultValue={input} />
        </div>
      </div>
    );
  }

  // The key restarts the tests when the URL changes.
  return <ResultsView key={validation.url} url={validation.url} />;
}
