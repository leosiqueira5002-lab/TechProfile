import assert from "node:assert/strict";
import test from "node:test";
import { isProActive } from "../features/billing/access.ts";

const now = new Date("2026-09-29T12:00:00.000Z");

test("Free plan is inactive even when an expiration date exists", () => {
  assert.equal(isProActive({ plan: "free", pro_expires_at: "2026-10-01T00:00:00.000Z" }, now), false);
});

test("Pro is active only when expiration is later than now", () => {
  assert.equal(isProActive({ plan: "pro", pro_expires_at: "2026-09-29T12:00:00.001Z" }, now), true);
  assert.equal(isProActive({ plan: "pro", pro_expires_at: "2026-09-29T12:00:00.000Z" }, now), false);
});

test("expired Pro, missing profile, missing expiration, and invalid dates are inactive", () => {
  assert.equal(isProActive({ plan: "pro", pro_expires_at: "2026-09-29T11:59:59.999Z" }, now), false);
  assert.equal(isProActive(null, now), false);
  assert.equal(isProActive({ plan: "pro", pro_expires_at: null }, now), false);
  assert.equal(isProActive({ plan: "pro", pro_expires_at: "not-a-date" }, now), false);
});
