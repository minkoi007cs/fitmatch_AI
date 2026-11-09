// Shared by scripts/schema-manifest.mjs and scripts/compare-schema-inventory.mjs (ENV-CANON-01, CL-MIGRATION-26).
// Flattens a fitmatch.schema-inventory.v1 document into stable keys -> comparable values, and compares a
// manifest of the reviewed SQL chain with an actual inventory both by NAME and by SEMANTIC SIGNATURE:
//   - a legacy object with another name but the same definition is "equivalent" (never duplicate it);
//   - a foreign key on the same columns that references ANOTHER table is "different-target" (real
//     difference: keep the existing target, do not add a second FK to make names match);
//   - functions owned by an extension (e.g. pgcrypto installed in schema `extensions`) are not FitMatch
//     objects; the extension itself is compared by name, its schema is reported, never "missing";
//   - column defaults, forced RLS, policy permissiveness/roles/expressions and table grants are compared.
// Row estimates and bucket usage are never part of the comparison.

const EXT_KEY = "extension:";

const stripIndexName = (def) => def.replace(/^CREATE (UNIQUE )?INDEX \S+ ON /, "CREATE $1INDEX ON ");
const stripTriggerName = (def) => def.replace(/^CREATE (CONSTRAINT )?TRIGGER \S+ /, "CREATE $1TRIGGER ");
// pg_get_constraintdef/pg_get_expr print relations relative to search_path: public.x and x are the same.
const unqualify = (text) => (text ?? "").replace(/\bpublic\./g, "");

export function flattenInventory(raw) {
  if (!raw || raw.format !== "fitmatch.schema-inventory.v1") throw new Error("Not a fitmatch.schema-inventory.v1 document");
  const out = {};
  for (const t of raw.tables ?? []) {
    if (!["public", "storage"].includes(t.schema)) continue;
    if (t.schema === "storage" && !["buckets", "objects"].includes(t.name)) continue;
    out[`table:${t.schema}.${t.name}`] = { rls: t.rls, rlsForced: t.rlsForced ?? false };
    if (t.schema === "storage") continue; // Supabase-managed columns/indexes: not ours to compare
    for (const c of t.columns ?? [])
      out[`column:${t.schema}.${t.name}.${c.name}`] = { type: c.type, notNull: c.notNull, default: c.default ?? null };
    for (const k of t.constraints ?? [])
      out[`constraint:${t.schema}.${t.name}.${k.name}`] = { type: k.type, def: unqualify(k.def), table: `${t.schema}.${t.name}` };
    for (const i of t.indexes ?? [])
      out[`index:${t.schema}.${t.name}.${i.name}`] = { def: i.def, table: `${t.schema}.${t.name}` };
  }
  for (const f of raw.functions ?? []) {
    if (f.extension) continue; // owned by an extension: compared through the extension entry
    out[`function:${f.schema}.${f.name}(${f.args})`] = {
      returns: f.returns, securityDefiner: f.securityDefiner, bodyMd5: f.bodyMd5,
      anonExecute: f.anonExecute, authenticatedExecute: f.authenticatedExecute,
    };
  }
  for (const p of raw.policies ?? [])
    out[`policy:${p.schema}.${p.table}.${p.name}`] = {
      table: `${p.schema}.${p.table}`, cmd: p.cmd, roles: [...(p.roles ?? [])].sort(), permissive: p.permissive ?? "PERMISSIVE",
      using: p.using ?? null, check: p.check ?? null, usingMd5: p.usingMd5, checkMd5: p.checkMd5,
    };
  for (const t of raw.triggers ?? [])
    if (t.schema === "public" || t.table === "users" || t.table === "objects")
      out[`trigger:${t.schema}.${t.table}.${t.name}`] = { def: t.def, table: `${t.schema}.${t.table}` };
  for (const g of raw.publicTableSelectGrants ?? [])
    if (g.privileges) out[`grant:public.${g.table}`] = g.privileges;
  for (const e of raw.extensions ?? [])
    if (e.name !== "plpgsql") out[`${EXT_KEY}${e.name}`] = { schema: e.schema ?? null };
  for (const b of raw.buckets ?? [])
    out[`bucket:${b.id}`] = { public: b.public, fileSizeLimit: b.fileSizeLimit ?? null, allowedMimeTypes: b.allowedMimeTypes ?? null };
  return out;
}

/** Name-independent signature of an object, or null when only the name identifies it. */
export function signature(key, value) {
  const kind = key.slice(0, key.indexOf(":"));
  if (kind === "constraint") return `constraint|${value.table}|${value.def}`;
  if (kind === "index") return `index|${value.table}|${stripIndexName(value.def)}`;
  if (kind === "trigger") return `trigger|${value.table}|${stripTriggerName(value.def)}`;
  if (kind === "policy")
    return `policy|${value.table}|${value.cmd}|${value.roles.join(",")}|${value.permissive}|${value.usingMd5}|${value.checkMd5}`;
  return null;
}

/** Same table + same FK columns but another referenced table/action: a real difference, not an alias. */
function fkShape(value) {
  const m = /^FOREIGN KEY \(([^)]*)\) REFERENCES ([^(]+)\(/.exec(value.def ?? "");
  return m ? { table: value.table, columns: m[1], target: m[2].trim() } : null;
}

function classify(key, expected, actual, actualBySignature, actualFks) {
  if (key.startsWith(EXT_KEY)) {
    if (!(key in actual)) return { state: "missing" };
    return JSON.stringify(actual[key]) === JSON.stringify(expected) ? { state: "equal" }
      : { state: "extension-placement", detail: `expected schema ${expected.schema}, found ${actual[key].schema}` };
  }
  if (key in actual) {
    if (JSON.stringify(actual[key]) === JSON.stringify(expected)) return { state: "equal" };
    if (key.startsWith("function:") && expected.bodyMd5 === actual[key].bodyMd5 &&
        expected.returns === actual[key].returns && expected.securityDefiner === actual[key].securityDefiner)
      return { state: "differs", detail: "privileges differ" };
    return { state: "differs" };
  }
  const sig = signature(key, expected);
  if (sig && actualBySignature.has(sig)) return { state: "equivalent", detail: `same definition as ${actualBySignature.get(sig)}` };
  const fk = key.startsWith("constraint:") && expected.type === "f" ? fkShape(expected) : null;
  if (fk) {
    const other = actualFks.find((x) => x.table === fk.table && x.columns === fk.columns);
    if (other) return { state: "different-target", detail: `${other.key} references ${other.target} instead of ${fk.target}` };
  }
  return { state: "missing" };
}

const OK_STATES = new Set(["equal", "equivalent", "superseded"]);
const DIFF_STATES = new Set(["differs", "different-target", "extension-placement"]);

/** Per-step status of a manifest against an actual (flattened) inventory. */
export function compareInventory(manifest, actual) {
  // A key re-defined by a later step is only checked for presence in earlier steps (its final value is
  // checked where it was last defined), so a fully applied chain reads "applied" for every step.
  const lastDefined = {};
  manifest.steps.forEach((step, index) => {
    for (const key of [...Object.keys(step.adds), ...Object.keys(step.changes)]) lastDefined[key] = index;
  });
  const actualBySignature = new Map();
  const actualFks = [];
  for (const [key, value] of Object.entries(actual)) {
    const sig = signature(key, value);
    if (sig && !actualBySignature.has(sig)) actualBySignature.set(sig, key);
    if (key.startsWith("constraint:") && value.type === "f") {
      const fk = fkShape(value);
      if (fk) actualFks.push({ key, ...fk });
    }
  }
  const matchedActual = new Set();
  const steps = manifest.steps.map((step, index) => {
    const findings = {};
    for (const key of [...Object.keys(step.adds), ...Object.keys(step.changes)]) {
      const expected = step.adds[key] ?? step.changes[key];
      let result = classify(key, expected, actual, actualBySignature, actualFks);
      if (lastDefined[key] > index && result.state === "differs") result = { state: "superseded" };
      if (key in actual) matchedActual.add(key);
      if (result.state === "equivalent") matchedActual.add(result.detail.replace("same definition as ", ""));
      if (result.state === "different-target") matchedActual.add(result.detail.split(" ")[0]);
      findings[key] = result;
    }
    const states = Object.values(findings).map((f) => f.state);
    const total = states.length;
    const missing = Object.keys(findings).filter((k) => findings[k].state === "missing");
    const different = Object.keys(findings).filter((k) => DIFF_STATES.has(findings[k].state));
    const equivalent = Object.keys(findings).filter((k) => findings[k].state === "equivalent");
    const okCount = states.filter((s) => OK_STATES.has(s)).length;
    const status = total === 0 ? "no-objects" : okCount === total ? "applied"
      : missing.length === total ? "absent"
      : missing.length === 0 ? "applied-with-differences" : "partial";
    return { file: step.file, status, objects: total, equal: okCount, missing, different, equivalent, findings };
  });
  const expectedKeys = new Set(Object.keys(manifest.final));
  const extra = Object.keys(actual).filter((k) => !expectedKeys.has(k) && !matchedActual.has(k));
  const rlsOff = Object.entries(actual).filter(([k, v]) => k.startsWith("table:public.") && v.rls === false).map(([k]) => k);
  const publicBuckets = Object.entries(actual).filter(([k, v]) => k.startsWith("bucket:") && v.public === true).map(([k]) => k);
  const anonWritable = Object.entries(actual)
    .filter(([k, v]) => k.startsWith("grant:public.") && (v.anon ?? []).some((p) => p !== "SELECT"))
    .map(([k]) => k);
  // Permissive policies are OR-ed: report tables where more than one permissive policy covers a command.
  const permissive = {};
  for (const [k, v] of Object.entries(actual))
    if (k.startsWith("policy:") && v.permissive === "PERMISSIVE")
      for (const cmd of v.cmd === "ALL" ? ["SELECT", "INSERT", "UPDATE", "DELETE"] : [v.cmd])
        (permissive[`${v.table}|${cmd}`] ??= []).push(k);
  const overlappingPolicies = Object.entries(permissive).filter(([, list]) => list.length > 1)
    .map(([slot, list]) => ({ slot, policies: list.sort() }));
  // Extensions the stub provides (not added by any step) are still checked by name and placement.
  const extensions = Object.entries(manifest.final).filter(([k]) => k.startsWith(EXT_KEY))
    .map(([k, v]) => ({ name: k.slice(EXT_KEY.length), expected: v.schema, found: actual[k]?.schema ?? null }))
    .filter((e) => e.found !== e.expected);
  return { steps, extra, rlsOff, publicBuckets, anonWritable, overlappingPolicies, extensions };
}

/**
 * Precondition of one manifest step on a live inventory, for sequential apply:
 *   - every object the step ADDS must be absent (no same-name object and no equivalent definition);
 *   - every object the step CHANGES must still have the value the manifest recorded before this step
 *     (its last definition in an earlier step), or — only when `pending` names the earlier step that defines
 *     it and that step will run first in the same plan — may be absent.
 * Returns { state: "ready" | "applied" | "conflict", conflicts: [{ key, reason }] }.
 */
export function stepPrecondition(manifest, actual, file, pending = new Set()) {
  const index = manifest.steps.findIndex((s) => s.file === file);
  if (index < 0) return { state: "conflict", conflicts: [{ key: file, reason: "not in manifest" }] };
  const post = compareInventory(manifest, actual).steps[index];
  const step = manifest.steps[index];
  const conflicts = [];
  const bySig = new Map();
  for (const [key, value] of Object.entries(actual)) {
    const sig = signature(key, value);
    if (sig && !bySig.has(sig)) bySig.set(sig, key);
  }
  for (const [key, value] of Object.entries(step.adds)) {
    const sig = signature(key, value);
    if (key in actual) conflicts.push({ key, reason: "already exists" });
    else if (sig && bySig.has(sig)) conflicts.push({ key, reason: `equivalent object ${bySig.get(sig)} exists` });
  }
  for (const key of Object.keys(step.changes)) {
    let definedIn = -1;
    for (let i = index - 1; i >= 0; i--)
      if (key in manifest.steps[i].adds || key in manifest.steps[i].changes) { definedIn = i; break; }
    const before = definedIn >= 0 ? (manifest.steps[definedIn].adds[key] ?? manifest.steps[definedIn].changes[key]) : undefined;
    if (!(key in actual)) {
      if (!(definedIn >= 0 && pending.has(manifest.steps[definedIn].file)))
        conflicts.push({ key, reason: "object this step changes is missing" });
      continue;
    }
    if (before === undefined || JSON.stringify(actual[key]) !== JSON.stringify(before))
      conflicts.push({ key, reason: "object this step changes does not have its expected prior definition" });
  }
  if (post.status === "applied") return { state: "applied", conflicts: [] };
  return { state: conflicts.length ? "conflict" : "ready", conflicts };
}
