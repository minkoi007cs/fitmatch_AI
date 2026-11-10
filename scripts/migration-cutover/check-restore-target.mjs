#!/usr/bin/env node
/**
 * APP-RECOVERY-32 — offline guard for the RESTORE-PROOF target URL (read from TARGET_URL, never printed).
 * A restore proof must never run against the canonical project or the retired smoke project. Exit 0 = allowed
 * (still run restore-preflight.sql against it), 2 = refused.
 *   TARGET_URL=... node scripts/migration-cutover/check-restore-target.mjs --canonical-ref gohczmqykjkrgdblgbog
 */
import { fileURLToPath } from "node:url";
import { RETIRED_REFS } from "./target.mjs";

export function checkRestoreTarget(url, canonicalRef) {
  if (!/^[a-z0-9]{20}$/.test(canonicalRef ?? "")) return { ok: false, reason: "--canonical-ref is not a project ref" };
  let u;
  try { u = new URL(url); } catch { return { ok: false, reason: "TARGET_URL is not a URL" }; }
  if (!["postgres:", "postgresql:"].includes(u.protocol)) return { ok: false, reason: "TARGET_URL must be postgres:// or postgresql://" };
  const hay = `${decodeURIComponent(u.username)}@${u.hostname}${u.search}`.toLowerCase();
  for (const ref of [canonicalRef, ...RETIRED_REFS]) if (hay.includes(ref)) return { ok: false, reason: `TARGET_URL names project ${ref === canonicalRef ? "canonical" : "retired"} ${ref}: a restore proof must use a disposable target` };
  for (const k of u.searchParams.keys()) if (!["sslmode", "connect_timeout", "application_name"].includes(k)) return { ok: false, reason: `connection parameter "${k}" not accepted` };
  return { ok: true };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--canonical-ref");
  const r = checkRestoreTarget(process.env.TARGET_URL ?? "", i === -1 ? undefined : process.argv[i + 1]);
  if (!r.ok) { console.error("REFUSED: " + r.reason); process.exit(2); }
  console.log("restore target is not the canonical/retired project; run restore-preflight.sql next");
}
