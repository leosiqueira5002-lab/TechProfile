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
  random?: () => number;
  sleep?: (milliseconds: number, signal: AbortSignal) => Promise<void>;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const BASE_RETRY_DELAY_MS = 1_000;
const RETRY_JITTER_MS = 250;

export async function optimizeWithGemini(inputValue: unknown, options: GenerateOptions = {}): Promise<ResumeDraft> {
  const parsedInput = OptimizeResumeInputSchema.safeParse(inputValue);
  if (!parsedInput.success) throw new GeminiResumeError("invalid_response");

  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY;
  const model = options.model ?? process.env.GEMINI_MODEL;
  if (!model?.trim() || (!options.client && !apiKey?.trim())) {
    logGeminiFailure({
      model: model?.trim() || "(não configurado)",
      stage: "gemini_request",
      category: "not_configured",
      message: "Configuração server-side do Gemini incompleta.",
    });
    throw new GeminiResumeError("not_configured");
  }

  const client = options.client ?? new GoogleGenAI({
    apiKey: apiKey as string,
    httpOptions: { retryOptions: { attempts: 1 } },
  });
  const source = parsedInput.data.extractedText;
  const redactedSource = redactResumeForOptimization(source);
  const abortController = new AbortController();
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const startedAt = Date.now();
  let currentAttempt = 0;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      abortController.abort();
      reject(new GeminiResumeError("timeout"));
    }, timeoutMs);
  });

  let stage: GeminiFailureStage = "gemini_request";
  try {
    const response = await Promise.race([
      generateWithRetry({
        client,
        model,
        request: {
          model,
          contents: createResumeOptimizationContents({ ...parsedInput.data, extractedText: redactedSource }),
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: GEMINI_RESUME_RESPONSE_SCHEMA,
            systemInstruction: RESUME_OPTIMIZATION_SYSTEM_INSTRUCTION,
            abortSignal: abortController.signal,
          },
        },
        signal: abortController.signal,
        timeoutMs,
        startedAt,
        random: options.random ?? Math.random,
        sleep: options.sleep ?? sleepWithAbort,
        onAttempt: (attempt) => { currentAttempt = attempt; },
      }),
      timeout,
    ]);
    stage = "gemini_response";
    if (typeof response.text !== "string" || !response.text.trim()) {
      logGeminiFailure({ model, stage, category: "empty_response", message: "Gemini não retornou texto utilizável." });
      throw new GeminiResumeError("invalid_response");
    }

    stage = "structured_output";
    let candidate: unknown;
    try {
      candidate = JSON.parse(response.text) as unknown;
    } catch {
      logGeminiFailure({ model, stage, category: "invalid_json", message: "A resposta Gemini não contém JSON válido." });
      throw new GeminiResumeError("invalid_response");
    }
    const validated = validateGeminiResumeCandidate(candidate, redactedSource);
    if (!validated.success) {
      logGeminiFailure({ model, stage, category: "schema_or_evidence_rejected", message: "A resposta estruturada não passou pela validação local." });
      throw new GeminiResumeError("invalid_response");
    }
    return buildOptimizedResumeDraft(validated.data, source, parsedInput.data.role);
  } catch (error) {
    if (error instanceof GeminiResumeError) {
      if (error.kind === "timeout") {
        logGeminiAttempt({ attempt: currentAttempt || 1, status: null, category: "timeout", model, willRetry: false });
      }
      throw error;
    }
    logGeminiFailure({
      model,
      stage,
      error,
      category: classifyGeminiError(error),
      message: safeGeminiFailureMessage(readHttpStatus(error)),
    });
    throw new GeminiResumeError("unavailable");
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

type GeminiFailureStage = "gemini_request" | "gemini_response" | "structured_output";

function logGeminiFailure(input: {
  model: string;
  stage: GeminiFailureStage;
  category: string;
  message: string;
  error?: unknown;
}) {
  const event = {
    event: "gemini_failure",
    stage: input.stage,
    category: input.category,
    errorName: readSafeErrorName(input.error),
    httpStatus: readHttpStatus(input.error),
    code: readSafeErrorCode(input.error),
    model: input.model,
    message: input.message,
  };
  console.error("[resume-optimization]", JSON.stringify(event));
}

async function generateWithRetry(input: {
  client: GeminiClient;
  model: string;
  request: Parameters<GeminiClient["models"]["generateContent"]>[0];
  signal: AbortSignal;
  timeoutMs: number;
  startedAt: number;
  random: () => number;
  sleep: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  onAttempt: (attempt: number) => void;
}) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    if (input.signal.aborted) throw new GeminiResumeError("timeout");
    input.onAttempt(attempt);
    try {
      return await input.client.models.generateContent(input.request);
    } catch (error) {
      if (input.signal.aborted) throw new GeminiResumeError("timeout");

      const status = readHttpStatus(error);
      const category = classifyGeminiError(error);
      const transient = status !== null && RETRYABLE_HTTP_STATUSES.has(status) && attempt < MAX_ATTEMPTS;
      const randomValue = transient ? Math.min(0.999_999, Math.max(0, input.random())) : 0;
      const delayMs = transient ? BASE_RETRY_DELAY_MS * 2 ** (attempt - 1) + Math.floor(randomValue * RETRY_JITTER_MS) : 0;
      const remainingMs = input.timeoutMs - (Date.now() - input.startedAt);
      const willRetry = transient && delayMs < remainingMs;

      logGeminiAttempt({
        model: input.model,
        status,
        category,
        attempt,
        willRetry,
      });

      if (!willRetry) throw new GeminiResumeError("unavailable");
      try {
        await input.sleep(delayMs, input.signal);
      } catch {
        if (input.signal.aborted) throw new GeminiResumeError("timeout");
        throw new GeminiResumeError("unavailable");
      }
    }
  }
  throw new GeminiResumeError("unavailable");
}

function logGeminiAttempt(input: {
  attempt: number;
  status: number | null;
  category: string;
  model: string;
  willRetry: boolean;
}) {
  console.error("[resume-optimization]", JSON.stringify({
    event: "gemini_attempt",
    attempt: input.attempt,
    httpStatus: input.status,
    category: input.category,
    model: input.model,
    willRetry: input.willRetry,
  }));
}

function sleepWithAbort(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new GeminiResumeError("timeout"));
      return;
    }
    const timeoutHandle = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(timeoutHandle);
      signal.removeEventListener("abort", onAbort);
      reject(new GeminiResumeError("timeout"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function readHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null;
}

function readSafeErrorCode(error: unknown): string | number | null {
  if (!error || typeof error !== "object") return null;
  const directCode = (error as { code?: unknown }).code;
  if (typeof directCode === "number" && Number.isInteger(directCode) && directCode >= 100 && directCode <= 599) return directCode;
  if (typeof directCode === "string" && /^[A-Z][A-Z0-9_]{0,39}$/.test(directCode)) return directCode;

  // ApiError in @google/genai keeps the HTTP code in `status` and embeds the
  // Google status enum in a prefixed message. Extract only that enum; never log
  // the vendor message because it may contain request details.
  const message = (error as { message?: unknown }).message;
  if (typeof message === "string") {
    const match = /^got status: ([A-Z][A-Z0-9_]{0,39})\./.exec(message);
    if (match) return match[1];
  }
  return null;
}

function readSafeErrorName(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const name = (error as { name?: unknown }).name;
  return typeof name === "string" && /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(name) ? name : "Error";
}

function classifyGeminiError(error: unknown): string {
  const status = readHttpStatus(error);
  if (status === 400) return "bad_request_or_schema";
  if (status === 401) return "authentication_rejected";
  if (status === 403) return "permission_or_project_restriction";
  if (status === 404) return "model_or_endpoint_not_found";
  if (status === 429) return "quota_or_rate_limit";
  if (status !== null && status >= 500) return "google_service_error";
  return "request_failed";
}

function safeGeminiFailureMessage(status: number | null): string {
  if (status === 400) return "Google recusou os parâmetros ou o formato da solicitação.";
  if (status === 401) return "Google recusou a autenticação da API.";
  if (status === 403) return "Google recusou o acesso do projeto ou da credencial.";
  if (status === 404) return "O modelo ou endpoint Gemini não foi encontrado.";
  if (status === 429) return "A API Gemini recusou a solicitação por cota ou limite de uso.";
  if (status !== null && status >= 500) return "A API Gemini retornou uma falha temporária de serviço.";
  return "A chamada Gemini falhou antes de produzir uma resposta.";
}
