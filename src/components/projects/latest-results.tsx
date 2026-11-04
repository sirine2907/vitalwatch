"use client";

import { RESULT_PANEL, ResultPanel } from "@/components/results/result-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STRATEGIES, type AnalysisResult, type Strategy } from "@/domain/psi/types";

const LABEL: Record<Strategy, string> = { mobile: "Mobile", desktop: "Desktop" };

export function LatestResults({ results }: { results: Partial<Record<Strategy, AnalysisResult>> }) {
  const available = STRATEGIES.filter((strategy) => results[strategy]);
  if (available.length === 0) return null;

  return (
    <Tabs defaultValue={available[0]} className="gap-0">
      <TabsList>
        {available.map((strategy) => (
          <TabsTrigger key={strategy} value={strategy}>
            {LABEL[strategy]}
          </TabsTrigger>
        ))}
      </TabsList>
      {available.map((strategy) => (
        <TabsContent key={strategy} value={strategy} className={RESULT_PANEL}>
          <ResultPanel result={results[strategy]!} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
