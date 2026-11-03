import { fixSuggestionsJsonSchema } from "@/domain/ai/fix-schema";
import { AppError } from "@/lib/errors";
import type { LlmProvider } from "./provider";

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const DEFAULT_ENDPOINT = "https://generativelanguage.googleapis.com";
const TIMEOUT_MS = 90_000;

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

const unavailable = (message: string) =>
  new AppError("ai_unavailable", message, { status: 502 });

export function createGeminiProvider(config: { apiKey: string; model?: string; endpoint?: string }): LlmProvider {
  const model = config.model ?? DEFAULT_GEMINI_MODEL;
  const endpoint = (config.endpoint ?? DEFAULT_ENDPOINT).replace(/\/+$/, "");

  return {
    name: "Gemini",
    async generateFixes(system, prompt) {
      let response: Response;
      try {
        response = await fetch(`${endpoint}/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": config.apiKey },
          signal: AbortSignal.timeout(TIMEOUT_MS),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
              responseJsonSchema: fixSuggestionsJsonSchema(),
              maxOutputTokens: 8192,
            },
          }),
        });
      } catch {
        throw unavailable("We couldn't reach the AI service. Please try again.");
      }

      if (response.status === 429) {
        throw new AppError("ai_quota", "The free AI quota is used up for now. Please try again later.", {
          status: 503,
        });
      }
      if (!response.ok) {
        throw unavailable(`The AI service returned an error (${response.status}). Please try again.`);
      }

      const body = (await response.json()) as GeminiResponse;
      const candidate = body.candidates?.[0];
      if (candidate?.finishReason && candidate.finishReason !== "STOP") {
        throw unavailable("The AI service stopped before finishing. Please try again.");
      }
      const text = (candidate?.content?.parts ?? [])
        .filter((part) => !part.thought && typeof part.text === "string")
        .map((part) => part.text)
        .join("");

      let output: unknown;
      try {
        output = JSON.parse(text);
      } catch {
        throw unavailable("The AI service sent an unreadable answer. Please try again.");
      }

      return {
        output,
        model,
        inputTokens: body.usageMetadata?.promptTokenCount ?? null,
        outputTokens: body.usageMetadata?.candidatesTokenCount ?? null,
      };
    },
  };
}
