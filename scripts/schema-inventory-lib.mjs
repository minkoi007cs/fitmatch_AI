// Shared by scripts/schema-manifest.mjs and scripts/compare-schema-inventory.mjs (ENV-CANON-01).
// Flattens a fitmatch.schema-inventory.v1 document into stable keys -> comparable values.
// Only FitMatch-relevant schema objects; estimated row counts/bucket usage are kept out of the keys.

export function flattenInventory(raw) {
  if (!raw || raw.format !== "fitmatch.schema-inventory.v1") throw new Error("Not a fitmatch.schema-inventory.v1 document");
  const out = {};
  for (const t of raw.tables ?? []) {
    if (!["public", "storage"].includes(t.schema)) continue;
    if (t.schema === "storage" && !["buckets", "objects"].includes(t.name)) continue;
    const base = `table:${t.schema}.${t.name}`;
    out[base] = { rls: t.rls };
    if (t.schema === "storage") continue; // Supabase-managed columns/indexes: not ours to compare
    for (const c of t.columns ?? []) out[`column:${t.schema}.${t.name}.${c.name}`] = { type: c.type, notNull: c.notNull, hasDefault: c.hasDefault };
    for (const k of t.constraints ?? []) out[`constraint:${t.schema}.${t.name}.${k.name}`] = { type: k.type, def: k.def };
    for (const i of t.indexes ?? []) out[`index:${t.schema}.${t.name}.${i.name}`] = { def: i.def };
  }
  for (const f of raw.functions ?? [])
    out[`function:${f.schema}.${f.name}(${f.args})`] = {
      returns: f.returns, securityDefiner: f.securityDefiner, bodyMd5: f.bodyMd5,
      anonExecute: f.anonExecute, authenticatedExecute: f.authenticatedExecute,
    };
  for (const p of raw.policies ?? [])
    out[`policy:${p.schema}.${p.table}.${p.name}`] = { cmd: p.cmd, roles: [...(p.roles ?? [])].sort(), usingMd5: p.usingMd5, checkMd5: p.checkMd5 };
  for (const t of raw.triggers ?? [])
    if (t.schema === "public" || t.table === "users" || t.table === "objects") out[`trigger:${t.schema}.${t.table}.${t.name}`] = { def: t.def };
  for (const b of raw.buckets ?? [])
    out[`bucket:${b.id}`] = { public: b.public, fileSizeLimit: b.fileSizeLimit ?? null, allowedMimeTypes: b.allowedMimeTypes ?? null };
  return out;
}

/** Per-step status of a manifest against an actual (flattened) inventory. */
export function compareInventory(manifest, actual) {
  // A key re-defined by a later step is only checked for presence in earlier steps (its final value is
  // checked where it was last defined), so a fully applied chain reads "applied" for every step.
  const lastDefined = {};
  manifest.steps.forEach((step, index) => {
    for (const key of [...Object.keys(step.adds), ...Object.keys(step.changes)]) lastDefined[key] = index;
  });
  const steps = manifest.steps.map((step, index) => {
    const keys = Object.keys(step.adds);
    const changed = Object.keys(step.changes);
    let present = 0, equal = 0;
    const missing = [], different = [];
    for (const key of [...keys, ...changed]) {
      const expected = step.adds[key] ?? step.changes[key];
      if (!(key in actual)) {
        if (keys.includes(key)) missing.push(key);
        continue;
      }
      present++;
      if (lastDefined[key] > index || JSON.stringify(actual[key]) === JSON.stringify(expected)) equal++;
      else different.push(key);
    }
    const total = keys.length + changed.length;
    const status = total === 0 ? "no-objects" : equal === total ? "applied" : present === 0 ? "absent"
      : missing.length === 0 && different.length > 0 ? "present-differs" : "partial";
    return { file: step.file, status, objects: total, equal, missing, different };
  });
  const expectedKeys = new Set(Object.keys(manifest.final));
  const extra = Object.keys(actual).filter((k) => !expectedKeys.has(k));
  const rlsOff = Object.entries(actual).filter(([k, v]) => k.startsWith("table:public.") && v.rls === false).map(([k]) => k);
  const publicBuckets = Object.entries(actual).filter(([k, v]) => k.startsWith("bucket:") && v.public === true).map(([k]) => k);
  return { steps, extra, rlsOff, publicBuckets };
}
