import assert from "node:assert/strict";
import test from "node:test";

import { bearerToken, parseDiscoveryRequest, publicError } from "./mediaOsSecurity.ts";

const valid = {
  workspace_id: "123e4567-e89b-42d3-a456-426614174000",
  production_id: "123e4567-e89b-42d3-a456-426614174001",
  idempotency_key: "production:discovery:0001",
  branch: "gaming",
  coverage_start: "2026-07-28",
  coverage_end: "2026-07-31",
  cost_cap_usd: 0.25,
  dry_run: true,
};

test("bearer token is required and bounded", () => {
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken("Basic abc"), null);
  assert.equal(bearerToken("Bearer short"), null);
  assert.equal(bearerToken(`Bearer ${"x".repeat(24)}`), "x".repeat(24));
});

test("valid deterministic discovery request is normalized", () => {
  assert.deepEqual(parseDiscoveryRequest(valid), valid);
});

test("invalid identifiers, branch, dates, key, and caps are rejected", () => {
  for (const change of [
    { workspace_id: "bad" },
    { branch: "beauty" },
    { coverage_start: "July 28" },
    { coverage_start: "2026-08-01", coverage_end: "2026-07-31" },
    { idempotency_key: "short" },
    { cost_cap_usd: 5.01 },
  ]) {
    assert.throws(() => parseDiscoveryRequest({ ...valid, ...change }));
  }
});

test("internal errors are redacted", () => {
  assert.deepEqual(publicError(new Error("database password leaked")), {
    code: "DISCOVERY_FAILED",
    message: "Discovery failed safely. No retry was started.",
  });
});
