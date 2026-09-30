import { GoogleGenAI } from "@google/genai";
import {
  buildOptimizedResumeDraft,
  GEMINI_RESUME_RESPONSE_SCHEMA,
  OptimizeResumeInputSchema,
  redactResumeForOptimization,
  validateGeminiResumeCandidate,
} from "../optimization-contract.ts";
import { createResumeOptimizationContents, RESUME_OPTIMIZATION_SYSTEM_INSTRUCTION } from "../optimization-prompt.ts";
import type { ResumeDraft } from "../types.ts";

export type GeminiResumeErrorKind = "not_configured" | "invalid_response" | "unavailable" | "timeout";

export class GeminiResumeError extends Error {
  readonly kind: GeminiResumeErrorKind;

  constructor(kind: GeminiResumeErrorKind) {
    super("Gemini resume optimization failed");
    this.name = "GeminiResumeError";
    this.kind = kind;
  }
}

type GeminiClient = Pick<GoogleGenAI, "models">;
type GenerateOptions = {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  client?: GeminiClient;
};

const DEFAULT_TIMEOUT_MS = 8_000;

export async function optimizeWithGemini(inputValue: unknown, options: GenerateOptions = {}): Promise<ResumeDraft> {
  const parsedInput = OptimizeResumeInputSchema.safeParse(inputValue);
  if (!parsedInput.success) throw new GeminiResumeError("invalid_response");

  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const model = options.model ?? process.env.GEMINI_MODEL;
  if (!model?.trim() || (!options.client && !apiKey?.trim())) throw new GeminiResumeError("not_configured");

  const client = options.client ?? new GoogleGenAI({
    apiKey: apiKey as string,
    httpOptions: { retryOptions: { attempts: 1 } },
  });
  const source = parsedInput.data.extractedText;
  const redactedSource = redactResumeForOptimization(source);
  const abortController = new AbortController();
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      abortController.abort();
      reject(new GeminiResumeError("timeout"));
    }, timeoutMs);
  });

  try {
    const response = await Promise.race([
      client.models.generateContent({
        model,
        contents: createResumeOptimizationContents({ ...parsedInput.data, extractedText: redactedSource }),
        config: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_RESUME_RESPONSE_SCHEMA,
          systemInstruction: RESUME_OPTIMIZATION_SYSTEM_INSTRUCTION,
          abortSignal: abortController.signal,
        },
      }),
      timeout,
    ]);
    if (typeof response.text !== "string" || !response.text.trim()) throw new GeminiResumeError("invalid_response");

    let candidate: unknown;
    try {
      candidate = JSON.parse(response.text) as unknown;
    } catch {
      throw new GeminiResumeError("invalid_response");
    }
    const validated = validateGeminiResumeCandidate(candidate, redactedSource);
    if (!validated.success) throw new GeminiResumeError("invalid_response");
    return buildOptimizedResumeDraft(validated.data, source, parsedInput.data.role);
  } catch (error) {
    if (error instanceof GeminiResumeError) throw error;
    throw new GeminiResumeError("unavailable");
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
