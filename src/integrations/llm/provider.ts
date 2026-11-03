import type { FixSuggestions } from "@/domain/ai/fix-schema";

export interface GenerationResult {
  /** Unvalidated model output. The caller checks it against the schema. */
  output: unknown;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface LlmProvider {
  readonly name: string;
  generateFixes(system: string, prompt: string): Promise<GenerationResult>;
}

export type { FixSuggestions };
