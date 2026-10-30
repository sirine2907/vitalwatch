import { z } from "zod";

const fieldMetricSchema = z.object({
  percentile: z.number(),
  distributions: z
    .array(
      z.object({
        min: z.number().optional(),
        max: z.number().optional(),
        proportion: z.number(),
      }),
    )
    .optional(),
});

const loadingExperienceSchema = z.object({
  id: z.string().optional(),
  metrics: z.record(z.string(), fieldMetricSchema).optional(),
  origin_fallback: z.boolean().optional(),
});

const auditSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  score: z.number().nullable().optional(),
  scoreDisplayMode: z.string().optional(),
  displayValue: z.string().optional(),
  numericValue: z.number().optional(),
  metricSavings: z.record(z.string(), z.number()).optional(),
  details: z
    .object({
      type: z.string().optional(),
      overallSavingsMs: z.number().optional(),
    })
    .optional(),
});

/** Only the parts of a PageSpeed Insights v5 response this app reads. */
export const psiResponseSchema = z.object({
  loadingExperience: loadingExperienceSchema.optional(),
  originLoadingExperience: loadingExperienceSchema.optional(),
  lighthouseResult: z.object({
    requestedUrl: z.string().optional(),
    finalUrl: z.string().optional(),
    fetchTime: z.string().optional(),
    lighthouseVersion: z.string().optional(),
    runWarnings: z.array(z.unknown()).optional(),
    runtimeError: z
      .object({ code: z.string().optional(), message: z.string().optional() })
      .optional(),
    categories: z.object({
      performance: z.object({ score: z.number().nullable().optional() }),
    }),
    audits: z.record(z.string(), auditSchema),
  }),
});

export type PsiResponse = z.infer<typeof psiResponseSchema>;
export type PsiAudit = z.infer<typeof auditSchema>;
export type PsiLoadingExperience = z.infer<typeof loadingExperienceSchema>;
