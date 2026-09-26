import { NextResponse } from "next/server";
import { MAX_EXTRACTED_CHARACTERS } from "@/features/documents/limits";
import { analysisProvider } from "@/features/analysis/providers";
import { AnalysisProviderError } from "@/features/analysis/providers/types";
import { validateAnalysisInput } from "@/features/analysis/contracts";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = MAX_EXTRACTED_CHARACTERS * 4 + 16_384;

export async function POST(request: Request) {
  try {
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_REQUEST_BYTES) return failure(413, "O currículo ultrapassa o limite de texto permitido.");
    const body = await readBoundedJson(request, MAX_REQUEST_BYTES);
    const input = validateAnalysisInput(body);
    if (!input.success) return failure(400, "Confira o currículo, a área profissional e o cargo desejado.");

    const analysis = await analysisProvider.analyze(input.data);
    return NextResponse.json({ analysis, mode: analysisProvider.mode }, { status: 200 });
  } catch (error) {
    if (error instanceof RequestTooLargeError) return failure(413, "O currículo ultrapassa o limite de texto permitido.");
    if (error instanceof AnalysisProviderError) {
      if (error.kind === "not_configured") return failure(503, "A análise por IA ainda não está configurada. Seu currículo não foi enviado.");
      if (error.kind === "invalid_response") return failure(502, "Não foi possível validar a análise. Tente novamente mais tarde.");
      if (error.kind === "insufficient_text") return failure(422, "O texto extraído é curto demais para uma análise demonstrativa. Envie um currículo com mais conteúdo.");
      return failure(502, "Não foi possível concluir a análise agora. Nenhum conteúdo foi registrado nos logs.");
    }
    return failure(400, "Não foi possível iniciar a análise. Confira os dados e tente novamente.");
  }
}

function failure(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

class RequestTooLargeError extends Error {}

async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json") || !request.body) {
    throw new Error("invalid request");
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}
