// Writes the machine-readable v1-r2 contract and the synthetic full-look fixture.
// Usage: node --import tsx scripts/export-contract.mjs [--check]
// --check exits 1 if the committed files differ from what the code generates.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { jsonSchemas } from "../src/lib/v2/schemas.ts";
import { fullLookFixture } from "../tests/fixtures/full-look.mjs";
import { qwenJsonSchemas } from "../src/lib/v2/qwen.ts";
import { qwenFixtures } from "../tests/fixtures/qwen-v1.mjs";

const check = process.argv.includes("--check");
const files = {};
for (const [name, schema] of Object.entries(jsonSchemas()))
  files[`schemas/v1-r2/${name}.json`] = JSON.stringify(schema, null, 2) + "\n";
const { parts, manifest } = fullLookFixture();
for (const [slot, part] of Object.entries(parts)) files[`fixtures/full-look/${slot}.glb`] = part.bytes;
files["fixtures/full-look/manifest.json"] = JSON.stringify(manifest, null, 2) + "\n";
// QINT-C: Qwen garment analysis contract v1 (proposal until PC Qwen / PC 3D / Codex ACK).
for (const [name, schema] of Object.entries(qwenJsonSchemas()))
  files[`schemas/qwen-v1/${name}.json`] = JSON.stringify(schema, null, 2) + "\n";
const q = qwenFixtures();
for (const [name, value] of Object.entries(q.valid)) files[`fixtures/qwen-v1/valid/${name}.json`] = JSON.stringify(value, null, 2) + "\n";
for (const [name, [value, reason]] of Object.entries(q.invalid))
  files[`fixtures/qwen-v1/invalid/${name}.json`] = JSON.stringify({ reason, value }, null, 2) + "\n";
files["fixtures/qwen-v1/adapter-input.json"] = JSON.stringify(q.adapterInput, null, 2) + "\n";
files["fixtures/qwen-v1/adapter-errors.json"] = JSON.stringify(q.errors, null, 2) + "\n";

let drift = [];
for (const [path, content] of Object.entries(files)) {
  const url = new URL("../" + path, import.meta.url);
  if (check) {
    const current = await readFile(url).catch(() => null);
    if (!current || !Buffer.from(content).equals(current)) drift.push(path);
  } else {
    await mkdir(new URL(".", url), { recursive: true });
    await writeFile(url, content);
  }
}
if (drift.length) {
  console.error("Contract files out of date (run node --import tsx scripts/export-contract.mjs):", drift.join(", "));
  process.exit(1);
}
console.log(check ? `Contract files up to date (${Object.keys(files).length})` : `Wrote ${Object.keys(files).length} files`);
