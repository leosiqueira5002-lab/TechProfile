import type { AnalysisInput, AnalysisResult } from "../contracts.ts";

export type AnalysisProviderMode = "demo" | "openai";

export interface AnalysisProvider {
  readonly mode: AnalysisProviderMode;
  analyze(input: AnalysisInput): Promise<AnalysisResult>;
}

export class AnalysisProviderError extends Error {
  readonly kind: "not_configured" | "provider" | "invalid_response" | "insufficient_text";

  constructor(kind: "not_configured" | "provider" | "invalid_response" | "insufficient_text") {
    super(kind);
    this.kind = kind;
  }
}
