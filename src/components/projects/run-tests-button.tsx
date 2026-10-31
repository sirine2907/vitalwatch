"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { STRATEGIES, type Strategy } from "@/domain/psi/types";

async function runTest(urlId: string, strategy: Strategy): Promise<string | null> {
  try {
    const response = await fetch(`/api/urls/${urlId}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ strategy }),
    });
    if (response.ok) return null;
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? "The test failed.";
  } catch {
    return "We couldn't reach the server. Check your connection and try again.";
  }
}

export function RunTestsButton({ urlId }: { urlId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  async function run() {
    setRunning(true);
    setErrors([]);
    const results = await Promise.all(STRATEGIES.map((strategy) => runTest(urlId, strategy)));
    setErrors([...new Set(results.filter((message) => message !== null))]);
    setRunning(false);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void run()} disabled={running} className="h-10 px-5">
          {running ? "Testing..." : "Test now"}
        </Button>
        {running && (
          <p role="status" className="text-sm text-muted-foreground">
            Testing mobile and desktop. This usually takes 20 to 60 seconds.
          </p>
        )}
      </div>
      {errors.map((message) => (
        <p key={message} role="alert" className="mt-2 text-sm text-poor">
          {message}
        </p>
      ))}
    </div>
  );
}
