type RpcErrorLike = {
  code?: unknown;
  hint?: unknown;
  details?: unknown;
};

const summaries: Record<string, string> = {
  "22023": "RPC rejected one or more payment arguments.",
  "23503": "Referenced profile or related row was not found.",
  "23505": "Payment conflicts with an existing unique record.",
  "40001": "RPC encountered a transaction conflict.",
  "42501": "Supabase denied permission to execute the RPC.",
  PGRST202: "RPC function or argument signature was not found.",
  PGRST301: "Supabase could not authenticate the RPC request.",
};

export function summarizeSupabaseRpcError(error: unknown) {
  const candidate = error && typeof error === "object" ? error as RpcErrorLike : {};
  const code = typeof candidate.code === "string" && /^(?:[A-Z\d]{5}|PGRST\d{3})$/i.test(candidate.code)
    ? candidate.code
    : null;

  return {
    code,
    message: code ? summaries[code] ?? "Supabase RPC returned an error." : "Supabase RPC returned an error.",
    hint: candidate.hint ? "redacted" : null,
    details: candidate.details ? "redacted" : null,
  };
}
