export type ResumeErrorCode =
  | "MISSING_FILE"
  | "UNSUPPORTED_TYPE"
  | "MIME_MISMATCH"
  | "FILE_TOO_LARGE"
  | "REQUEST_TOO_LARGE"
  | "INVALID_FILE"
  | "ENCRYPTED_FILE"
  | "TOO_MANY_PAGES"
  | "UNSAFE_ARCHIVE"
  | "EMPTY_TEXT"
  | "TEXT_TOO_LARGE"
  | "PROCESSING_TIMEOUT"
  | "STORAGE_AUTH_REQUIRED"
  | "STORAGE_NOT_CONFIGURED"
  | "STORAGE_FAILED";

const publicMessages: Record<ResumeErrorCode, string> = {
  MISSING_FILE: "Selecione um currículo para continuar.",
  UNSUPPORTED_TYPE: "Formato não aceito. Envie um arquivo PDF ou DOCX.",
  MIME_MISMATCH: "O tipo do arquivo não corresponde ao formato informado.",
  FILE_TOO_LARGE: "O arquivo ultrapassa o limite de 4 MB.",
  REQUEST_TOO_LARGE: "O envio ultrapassa o limite permitido. Tente um arquivo menor que 4 MB.",
  INVALID_FILE: "Não foi possível ler este arquivo. Verifique se ele está íntegro e tente novamente.",
  ENCRYPTED_FILE: "Este arquivo está protegido por senha. Remova a proteção antes de enviar.",
  TOO_MANY_PAGES: "O PDF ultrapassa o limite de 20 páginas nesta etapa.",
  UNSAFE_ARCHIVE: "Este DOCX tem uma estrutura inválida ou ultrapassa os limites de segurança.",
  EMPTY_TEXT: "Não encontramos texto extraível. PDFs digitalizados como imagem não são aceitos nesta etapa.",
  TEXT_TOO_LARGE: "O conteúdo extraído é extenso demais para processar nesta etapa.",
  PROCESSING_TIMEOUT: "O processamento demorou mais que o esperado. Tente outro arquivo.",
  STORAGE_AUTH_REQUIRED: "Entre na sua conta para salvar o currículo no armazenamento privado.",
  STORAGE_NOT_CONFIGURED: "O armazenamento privado está configurado parcialmente. Revise as variáveis do Supabase no servidor.",
  STORAGE_FAILED: "Não foi possível salvar o currículo no armazenamento privado. Tente novamente.",
};

export class ResumeProcessingError extends Error {
  constructor(
    readonly code: ResumeErrorCode,
    message = publicMessages[code],
  ) {
    super(message);
    this.name = "ResumeProcessingError";
  }
}

export function getResumeErrorMessage(code: ResumeErrorCode): string {
  return publicMessages[code];
}
