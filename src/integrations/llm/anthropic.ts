import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { fixSuggestionsSchema } from "@/domain/ai/fix-schema";
import { AppError } from "@/lib/errors";
import type { LlmProvider } from "./provider";

export const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";

/** Optional: used instead of Gemini when ANTHROPIC_API_KEY is set. */
export function createAnthropicProvider(config: { apiKey: string; model?: string }): LlmProvider {
  const client = new Anthropic({ apiKey: config.apiKey, timeout: 120_000 });
  const model = config.model ?? DEFAULT_ANTHROPIC_MODEL;

  return {
    name: "Claude",
    async generateFixes(system, prompt) {
      let response;
      try {
        response = await client.beta.messages.parse({
          model,
          max_tokens: 16000,
          system,
          messages: [{ role: "user", content: prompt }],
          output_config: { effort: "medium", format: betaZodOutputFormat(fixSuggestionsSchema) },
          // If a safety check declines the request, the API retries it on a fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
      } catch (error) {
        if (error instanceof Anthropic.RateLimitError) {
          throw new AppError("ai_quota", "The AI service is busy. Please try again later.", { status: 503 });
        }
        if (error instanceof Anthropic.APIError) {
          throw new AppError("ai_unavailable", "The AI service returned an error. Please try again.", {
            status: 502,
          });
        }
        throw error;
      }

      if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens" || !response.parsed_output) {
        throw new AppError("ai_unavailable", "The AI service couldn't finish this request. Please try again.", {
          status: 502,
        });
      }

      return {
        output: response.parsed_output,
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    },
  };
}
