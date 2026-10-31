"use client";

import { ResultPanel } from "@/components/results/result-panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STRATEGIES, type AnalysisResult, type Strategy } from "@/domain/psi/types";

const LABEL: Record<Strategy, string> = { mobile: "Mobile", desktop: "Desktop" };

export function LatestResults({ results }: { results: Partial<Record<Strategy, AnalysisResult>> }) {
  const available = STRATEGIES.filter((strategy) => results[strategy]);
  if (available.length === 0) return null;

  return (
    <Tabs defaultValue={available[0]}>
      <TabsList>
        {available.map((strategy) => (
          <TabsTrigger key={strategy} value={strategy} className="px-3">
            {LABEL[strategy]}
          </TabsTrigger>
        ))}
      </TabsList>
      {available.map((strategy) => (
        <TabsContent key={strategy} value={strategy}>
          <ResultPanel result={results[strategy]!} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
