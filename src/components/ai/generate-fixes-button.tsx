"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function GenerateFixesButton({ runId, label }: { runId: string; label: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function generate() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/runs/${runId}/suggestions`, { method: "POST" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? "We couldn't get suggestions. Please try again.");
      } else {
        startTransition(() => router.refresh());
      }
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    }
    setRunning(false);
  }

  return (
    <div>
      <Button onClick={() => void generate()} disabled={running} variant="outline" className="h-10 px-5">
        {running ? "Thinking..." : label}
      </Button>
      {running && (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          Checking the site&apos;s stack and writing fixes. This can take up to a minute.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-poor">
          {error}
        </p>
      )}
    </div>
  );
}
