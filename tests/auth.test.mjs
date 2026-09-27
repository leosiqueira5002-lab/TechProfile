import test from "node:test";
import assert from "node:assert/strict";
import { validateAuthInput } from "../features/auth/validation.ts";
import { getFriendlyAuthError, getFriendlyConnectionError } from "../features/auth/errors.ts";

test("auth validation accepts normalized email and matching signup passwords", () => {
  assert.equal(validateAuthInput("signup", " user@example.com ", "safe-pass", "safe-pass"), null);
});

test("auth validation rejects invalid email and empty password", () => {
  assert.match(validateAuthInput("login", "invalid", "secret") ?? "", /e-mail válido/i);
  assert.match(validateAuthInput("login", "user@example.com", "") ?? "", /senha/i);
});

test("signup validation rejects mismatched passwords", () => {
  assert.match(validateAuthInput("signup", "user@example.com", "one", "two") ?? "", /não coincidem/i);
});

test("provider errors become friendly messages without exposing raw error details", () => {
  assert.match(getFriendlyAuthError("invalid_credentials", "login"), /incorretos/i);
  assert.match(getFriendlyAuthError("email_not_confirmed", "login"), /Confirme seu e-mail/i);
  assert.match(getFriendlyAuthError("email_exists", "signup"), /Já existe uma conta/i);
  assert.doesNotMatch(getFriendlyAuthError("unknown-secret-token", "login"), /unknown-secret-token/);
  assert.match(getFriendlyConnectionError(), /conectar/i);
});
