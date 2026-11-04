"use client";

import { Monitor, Smartphone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STRATEGIES, type AnalysisResult, type AnalyzeResponse, type Strategy } from "@/domain/psi/types";
import { RESULT_PANEL, ResultPanel } from "./result-panel";

type RunState =
  | { status: "loading" }
  | { status: "done"; result: AnalysisResult; cached: boolean }
  | { status: "error"; message: string };

const STRATEGY_META = {
  mobile: { label: "Mobile", icon: Smartphone },
  desktop: { label: "Desktop", icon: Monitor },
};

async function runAnalysis(url: string, strategy: Strategy): Promise<RunState> {
  try {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, strategy }),
    });
    const body = (await response.json()) as AnalyzeResponse;
    return "error" in body
      ? { status: "error", message: body.error.message }
      : { status: "done", result: body.result, cached: body.cached };
  } catch {
    return {
      status: "error",
      message: "We couldn't get a result. Check your connection and try again.",
    };
  }
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div role="status">
      <p className="text-muted-foreground">
        Running the {label.toLowerCase()} test. This usually takes 20 to 60 seconds.
      </p>
      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
        <Skeleton className="h-36 w-full sm:w-64" />
        <Skeleton className="h-16 w-full max-w-sm" />
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-3">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
    </div>
  );
}

export function ResultsView({ url }: { url: string }) {
  const [runs, setRuns] = useState<Record<Strategy, RunState>>({
    mobile: { status: "loading" },
    desktop: { status: "loading" },
  });
  // Stops React's development double-run from spending API quota twice.
  const started = useRef(false);

  const run = useCallback(
    async (strategy: Strategy) => {
      setRuns((current) => ({ ...current, [strategy]: { status: "loading" } }));
      const state = await runAnalysis(url, strategy);
      setRuns((current) => ({ ...current, [strategy]: state }));
    },
    [url],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    STRATEGIES.forEach((strategy) => void run(strategy));
  }, [run]);

  return (
    <div>
      <p className="text-sm font-medium text-muted-foreground">Test results for</p>
      <h1 className="mt-1 text-4xl leading-none font-bold break-all sm:text-5xl">{url}</h1>

      <Tabs defaultValue="mobile" className="mt-8 gap-0">
        <TabsList>
          {STRATEGIES.map((strategy) => {
            const { label, icon: Icon } = STRATEGY_META[strategy];
            const state = runs[strategy];
            return (
              <TabsTrigger key={strategy} value={strategy} className="gap-1.5 px-3">
                <Icon className="size-4" aria-hidden />
                {label}
                {state.status === "done" && (
                  <span className="tabular-nums">{state.result.score}</span>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {STRATEGIES.map((strategy) => {
          const state = runs[strategy];
          return (
            <TabsContent key={strategy} value={strategy} className={RESULT_PANEL}>
              {state.status === "loading" && <LoadingPanel label={STRATEGY_META[strategy].label} />}
              {state.status === "done" && (
                <ResultPanel result={state.result} cached={state.cached} />
              )}
              {state.status === "error" && (
                <div>
                  <Alert>
                    <AlertTitle>The {strategy} test didn&apos;t finish</AlertTitle>
                    <AlertDescription>{state.message}</AlertDescription>
                  </Alert>
                  <Button variant="outline" className="mt-4" onClick={() => void run(strategy)}>
                    Try again
                  </Button>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
