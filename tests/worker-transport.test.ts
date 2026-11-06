import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("python worker: checkpoint safety, exit classification, adapter env (stdlib unittest)", () => {
  const r = spawnSync("python3", ["-I", "scripts/worker/test_worker_unit.py", "-v"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
