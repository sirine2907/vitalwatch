"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/** Tests every page in the comparison on one device, all at once. */
export function CompareTestsButton({ urlIds, strategy }: { urlIds: string[]; strategy: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(0);
  const [, startTransition] = useTransition();

  async function run() {
    setRunning(true);
    setFailed(0);
    const results = await Promise.all(
      urlIds.map((urlId) =>
        fetch(`/api/urls/${urlId}/runs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strategy }),
        })
          .then((response) => response.ok)
          .catch(() => false),
      ),
    );
    setFailed(results.filter((ok) => !ok).length);
    setRunning(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={() => void run()} disabled={running} className="h-10 px-5">
        {running ? "Testing..." : `Test all on ${strategy}`}
      </Button>
      {running && (
        <p role="status" className="text-sm text-muted-foreground">
          Testing {urlIds.length} pages. This usually takes up to a minute.
        </p>
      )}
      {failed > 0 && !running && (
        <p role="alert" className="text-sm text-poor">
          {failed} {failed === 1 ? "test" : "tests"} didn&apos;t finish. Open that page to see why.
        </p>
      )}
    </div>
  );
}
