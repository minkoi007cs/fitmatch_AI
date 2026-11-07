import { test } from "node:test";
import assert from "node:assert/strict";
import { analysisResult, analysisAdapterInput, analysisAdapterError, analysisConfirmRequest, analysisLimits, canonicalJson } from "../src/lib/v2/qwen";
import { qwenFixtures } from "./fixtures/qwen-v1.mjs";

const q = qwenFixtures();

test("qwen v1: every valid fixture parses and stays within the byte budget", () => {
  for (const [name, value] of Object.entries(q.valid)) {
    assert.ok(analysisResult.safeParse(value).success, name);
    assert.ok(Buffer.byteLength(JSON.stringify(value)) <= analysisLimits.maxResultBytes, name);
  }
});

test("qwen v1: every invalid fixture is rejected", () => {
  for (const [name, [value, reason]] of Object.entries(q.invalid) as [string, [unknown, string]][])
    assert.equal(analysisResult.safeParse(value).success, false, `${name}: ${reason}`);
});

test("qwen v1: adapter input and error envelopes", () => {
  assert.ok(analysisAdapterInput.safeParse(q.adapterInput).success);
  assert.equal(analysisAdapterInput.safeParse({ ...q.adapterInput, policy: { ...q.adapterInput.policy, imageIsUntrustedData: false } }).success, false);
  assert.equal(analysisAdapterInput.safeParse({ ...q.adapterInput, assets: [...q.adapterInput.assets, q.adapterInput.assets[0]] }).success, false, "exactly one image");
  for (const e of q.errors.valid) assert.ok(analysisAdapterError.safeParse(e).success);
  for (const e of q.errors.invalid) assert.equal(analysisAdapterError.safeParse(e).success, false);
});

test("qwen v1: human confirmation never accepts unknown or empty approvals", () => {
  const base = { confirmationId: "55555555-6666-4777-8888-999999999999", expectedResultSha256: "c".repeat(64) };
  assert.ok(analysisConfirmRequest.safeParse({ ...base, decision: "approve", fields: { category: "tshirt", primaryColor: "red" } }).success);
  assert.ok(analysisConfirmRequest.safeParse({ ...base, decision: "reject", fields: {} }).success);
  assert.equal(analysisConfirmRequest.safeParse({ ...base, decision: "approve", fields: {} }).success, false);
  assert.equal(analysisConfirmRequest.safeParse({ ...base, decision: "approve", fields: { primaryColor: "unknown" } }).success, false);
  assert.equal(analysisConfirmRequest.safeParse({ ...base, decision: "approve", fields: { category: "unknown" } }).success, false);
  assert.equal(analysisConfirmRequest.safeParse({ ...base, decision: "reject", fields: { pattern: "solid" } }).success, false);
  assert.equal(analysisConfirmRequest.safeParse({ ...base, decision: "approve", fields: { approved: true } }).success, false);
});

test("canonical JSON is key-order independent", () => {
  assert.equal(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] }), canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }));
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
});
