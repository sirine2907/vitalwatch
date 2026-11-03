import { z } from "zod";

export const PROMPT_VERSION = "fixes-v1";
export const MAX_FIXES = 6;

export const fixSchema = z.object({
  title: z.string().describe("Short imperative title, like 'Preload the hero image'"),
  priority: z.number().int().describe("1 is the most important"),
  impact: z.enum(["high", "medium", "low"]).describe("Expected effect on load speed"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  auditIds: z.array(z.string()).describe("IDs of the audits this fixes, copied exactly from the input"),
  why: z.string().describe("One or two sentences on why this slows the page"),
  steps: z.array(z.string()).describe("Concrete steps for this stack"),
  code: z
    .object({ language: z.string(), snippet: z.string() })
    .nullable()
    .describe("A short example for the detected stack, or null if none applies"),
});

export const fixSuggestionsSchema = z.object({
  summary: z.string().describe("Two sentences at most on the main problem"),
  fixes: z.array(fixSchema).describe(`At most ${MAX_FIXES}, most important first`),
});

export type FixSuggestions = z.infer<typeof fixSuggestionsSchema>;
export type Fix = z.infer<typeof fixSchema>;

/** The same schema as JSON Schema, for providers that take it directly. */
export function fixSuggestionsJsonSchema(): Record<string, unknown> {
  // Gemini doesn't need the $schema marker, so it is left out.
  const schema = { ...(z.toJSONSchema(fixSuggestionsSchema) as Record<string, unknown>) };
  delete schema.$schema;
  return schema;
}

/**
 * Model output is untrusted. This keeps only audit IDs that were actually sent,
 * caps lengths, and orders fixes by priority.
 */
export function cleanSuggestions(output: FixSuggestions, sentAuditIds: string[]): FixSuggestions {
  const known = new Set(sentAuditIds);
  const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);

  return {
    summary: clip(output.summary, 400),
    fixes: [...output.fixes]
      .sort((a, b) => a.priority - b.priority)
      .slice(0, MAX_FIXES)
      .map((fix, index) => ({
        ...fix,
        priority: index + 1,
        title: clip(fix.title, 120),
        why: clip(fix.why, 500),
        auditIds: fix.auditIds.filter((id) => known.has(id)),
        steps: fix.steps.slice(0, 6).map((step) => clip(step, 400)),
        code: fix.code ? { language: clip(fix.code.language, 20), snippet: clip(fix.code.snippet, 2000) } : null,
      })),
  };
}
