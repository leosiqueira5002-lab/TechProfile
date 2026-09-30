import { isProActive, type BillingProfile } from "../billing/access.ts";
import { MAX_EXTRACTED_CHARACTERS } from "../documents/limits.ts";
import { OptimizeResumeInputSchema, ResumeDraftSchema } from "./optimization-contract.ts";
import { GeminiResumeError } from "./providers/gemini.ts";
import type { ResumeDraft } from "./types.ts";

const MAX_REQUEST_BYTES = MAX_EXTRACTED_CHARACTERS * 4 + 16_384;

type Dependencies = {
  isAuthenticated: () => Promise<boolean>;
  getProfile: () => Promise<BillingProfile | null | undefined>;
  optimize: (input: { extractedText: string; area: string; role: string }) => Promise<ResumeDraft>;
  now?: () => Date;
};

export function createResumeOptimizationHandler(dependencies: Dependencies) {
  return async function POST(request: Request): Promise<Response> {
    let authenticated = false;
    try {
      authenticated = await dependencies.isAuthenticated();
    } catch {
      return failure(401, "Entre na sua conta para continuar.");
    }
    if (!authenticated) return failure(401, "Entre na sua conta para continuar.");

    let profile: BillingProfile | null | undefined;
    try {
      profile = await dependencies.getProfile();
    } catch {
      return failure(403, "A geração de currículo está disponível para assinantes Pro ativos.");
    }
    if (!isProActive(profile, (dependencies.now ?? (() => new Date()))())) {
      return failure(403, "A geração de currículo está disponível para assinantes Pro ativos.");
    }
    if (request.headers.get("x-resume-gemini-consent") !== "true") {
      return failure(400, "Confirme o envio do texto redigido ao Google Gemini para continuar.");
    }

    let body: unknown;
    try {
      body = await readBoundedJson(request);
    } catch (error) {
      return error instanceof RequestTooLargeError
        ? failure(413, "O texto do currículo ultrapassa o limite permitido.")
        : failure(400, "Confira o currículo, a área profissional e o cargo desejado.");
    }

    const input = OptimizeResumeInputSchema.safeParse(body);
    if (!input.success) {
      const text = typeof (body as { extractedText?: unknown } | null)?.extractedText === "string"
        ? (body as { extractedText: string }).extractedText : "";
      if (text.length > MAX_EXTRACTED_CHARACTERS) return failure(413, "O texto do currículo ultrapassa o limite permitido.");
      return text.trim().length < 100
        ? failure(422, "O texto extraído é curto demais para preparar um currículo. Confira o arquivo enviado.")
        : failure(400, "Confira o currículo, a área profissional e o cargo desejado.");
    }

    try {
      const draft = await dependencies.optimize(input.data);
      const validatedDraft = ResumeDraftSchema.safeParse(draft);
      if (!validatedDraft.success) return failure(502, "Não foi possível validar o currículo gerado. Tente novamente.");
      return Response.json({ draft: validatedDraft.data }, { status: 200 });
    } catch (error) {
      if (error instanceof GeminiResumeError) {
        if (error.kind === "not_configured") return failure(503, "A geração de currículo ainda não está configurada. Tente novamente mais tarde.");
        if (error.kind === "invalid_response") return failure(502, "Não foi possível validar o currículo gerado. Tente novamente.");
        if (error.kind === "timeout") return failure(504, "A geração demorou mais que o esperado. Tente novamente.");
        return failure(503, "A geração está temporariamente indisponível. Tente novamente mais tarde.");
      }
      return failure(503, "A geração está temporariamente indisponível. Tente novamente mais tarde.");
    }
  };
}

function failure(status: number, error: string): Response {
  return Response.json({ error }, { status });
}

class RequestTooLargeError extends Error {}

async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json") || !request.body) throw new Error("Invalid JSON request");
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) throw new RequestTooLargeError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new RequestTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
