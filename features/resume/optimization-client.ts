import type { ResumeDraft } from "./types.ts";

const GENERATION_ERROR = "Não foi possível gerar o currículo agora. Tente novamente.";

type Dependencies = {
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  onLoadingChange: (loading: boolean) => void;
  onError: (message: string) => void;
  setDraft: (draft: ResumeDraft) => void;
  navigate: (path: string) => void;
};

export function createResumeOptimizationAction({ fetchImpl, onLoadingChange, onError, setDraft, navigate }: Dependencies) {
  let pending = false;
  return async function optimize(input: { extractedText: string; area: string; role: string }): Promise<void> {
    if (pending) return;
    pending = true;
    onError("");
    onLoadingChange(true);
    try {
      const response = await fetchImpl("/api/resumes/optimize", {
        method: "POST",
        headers: { "content-type": "application/json", "x-resume-gemini-consent": "true" },
        body: JSON.stringify(input),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isDraftPayload(payload)) throw new Error("Invalid response");
      setDraft(payload.draft);
      navigate("/curriculo");
    } catch {
      onError(GENERATION_ERROR);
    } finally {
      pending = false;
      onLoadingChange(false);
    }
  };
}

function isDraftPayload(value: unknown): value is { draft: ResumeDraft } {
  return typeof value === "object" && value !== null && "draft" in value
    && typeof value.draft === "object" && value.draft !== null;
}
