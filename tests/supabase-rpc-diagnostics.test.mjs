import assert from "node:assert/strict";
import test from "node:test";
import { summarizeSupabaseRpcError } from "../features/billing/supabase-rpc-diagnostics.ts";

test("RPC diagnostic keeps known error code and safe summary, redacting raw fields", () => {
  const diagnostic = summarizeSupabaseRpcError({
    code: "23503",
    message: "violates FK for user 12345678901234567890",
    hint: "sensitive hint with a UUID 123e4567-e89b-12d3-a456-426614174000",
    details: "provider_payment_id=12345678901234567890",
  });

  assert.deepEqual(diagnostic, {
    code: "23503",
    message: "Referenced profile or related row was not found.",
    hint: "redacted",
    details: "redacted",
  });
  assert.equal(JSON.stringify(diagnostic).includes("12345678901234567890"), false);
  assert.equal(JSON.stringify(diagnostic).includes("123e4567-e89b-12d3-a456-426614174000"), false);
});

test("unknown RPC errors receive a generic summary and malformed code is omitted", () => {
  assert.deepEqual(summarizeSupabaseRpcError({
    code: "secret-token-value",
    message: "raw private server response",
  }), {
    code: null,
    message: "Supabase RPC returned an error.",
    hint: null,
    details: null,
  });
});
