/** Bridges the production HTTP handlers to isolated PostgreSQL and in-memory private object storage. */
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync } from "node:fs";
import { randomUUID, randomBytes, createHash } from "node:crypto";
const run = promisify(execFile);
const tables = new Set(
  [
    "assets",
    "models",
    "jobs",
    "workers",
    "profiles",
    "recommendations",
    "looks",
    "feedback",
    "analyses",
  ].map((v) => "fm_v2_" + v),
);
const quote = (v) =>
  v === null
    ? "null"
    : typeof v === "number"
      ? String(v)
      : typeof v === "boolean"
        ? String(v)
        : `'${(typeof v === "object" ? JSON.stringify(v) : String(v)).replaceAll("'", "''")}'`;
// Postgres array columns written through the REST fixture (everything else that is an array is jsonb).
const arrayColumns = new Set(["allowed_capabilities", "input_assets"]);
const pgArray = (v) =>
  `'{${v.map((x) => '"' + String(x).replaceAll("'", "''").replaceAll('"', '\\"') + '"').join(",")}}'`;
const value = (key, v) =>
  arrayColumns.has(key) && Array.isArray(v) ? pgArray(v) : quote(v);
const ident = (v) => {
  if (!/^[a-z_][a-z_0-9]*$/.test(v))
    throw new Error("Invalid fixture identifier");
  return '"' + v + '"';
};
export async function v2Fixture() {
  const name = `fitmatch-v2-http-${process.pid}`,
    objects = new Map(),
    uploadPaths = new Map(),
    readPaths = new Map(),
    // Fault injection for storage transport tests (counts are consumed per request).
    faults = { uploadDropAfterStore: 0, uploadExpire: 0, uploads: 0, removeFail: 0, removeCalls: 0, serverUploadFail: 0, beforeRpc: {}, readExpire: 0, reads: 0, expiredObjects: new Set() };
  const sql = (s) =>
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        name,
        "psql",
        "-U",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
        "-Atq",
      ],
      { input: s, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    ).trim();
  const query = async (s) => {
    const { stdout } = await run("docker", [
      "exec",
      "-i",
      name,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
      "-c",
      s,
    ]);
    return stdout.trim();
  };
  execFileSync(
    "docker",
    [
      "run",
      "--rm",
      "--detach",
      "--network",
      "none",
      "--name",
      name,
      "-e",
      "POSTGRES_HOST_AUTH_METHOD=trust",
      "postgres:16-alpine",
    ],
    { stdio: "pipe" },
  );
  const stop = () => {
    try {
      execFileSync("docker", ["rm", "--force", name], { stdio: "pipe" });
    } catch {}
  };
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      try {
        execFileSync(
          "docker",
          ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
          {
            stdio: "pipe",
          },
        );
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    if (!ready) throw new Error("Database did not start");
    sql(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;create table auth.users(id uuid primary key);create table fm_wardrobe_items(id uuid primary key,user_id uuid,category text,color text not null default 'white',secondary_color text,pattern text,image_path text,updated_at timestamptz not null default now());create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);grant all on fm_wardrobe_items to service_role;",
    );
    for (const migration of [
      "20261105_studio_control_plane.sql",
      "20261106025506_worker_recovery_r1.sql",
      "20261106035951_full_look_c1.sql",
      "20261106042143_capture_retention_c2.sql",
      "20261106044040_gc_dry_run_c3.sql",
      "20261106053812_fitting_generations.sql",
      "20261106150000_source_cleanup_priv01.sql",
      "20261107120000_qwen_analysis_qint.sql",
      "20261108090000_qwen_review_qrev.sql",
    ])
      sql(
        readFileSync(
          new URL("../supabase/migrations/" + migration, import.meta.url),
          "utf8",
        ),
      );
    return {
      stop,
      sql,
      faults,
      /** path relative to the bucket, as stored in fm_v2_assets */
      hasObject: (path) => objects.has("fitmatch-v2/" + path),
      /** Full key including bucket, e.g. "fitmatch-wardrobe/<owner>/tee.jpg". */
      putObject: (key, bytes) => objects.set(key, Buffer.from(bytes)),
      async handle(req, res, url, body, raw, send) {
        const objectPath = url.pathname.replace(/^\/storage\/v1/, "");
        res.setHeader("Access-Control-Allow-Origin", "http://localhost:3220");
        res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-upsert");
        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return true;
        }
        if (objectPath.startsWith("/fixture-upload/")) {
          const path = uploadPaths.get(objectPath);
          if (!path || req.method !== "PUT") return false;
          faults.uploads++;
          if (faults.uploadExpire > 0) {
            faults.uploadExpire--;
            send({ statusCode: "400", error: "InvalidJWT", message: "jwt expired" }, 400);
            return true;
          }
          if (objects.has(path)) {
            send({ message: "exists" }, 409);
            return true;
          }
          objects.set(path, Buffer.from(raw));
          if (faults.uploadDropAfterStore > 0) {
            // Stored, but the client never learns the outcome.
            faults.uploadDropAfterStore--;
            req.socket.destroy();
            return true;
          }
          send({ Key: path });
          return true;
        }
        if (objectPath.startsWith("/fixture-read/")) {
          faults.reads++;
          const target = readPaths.get(objectPath);
          if (faults.readExpire > 0 && target && !faults.expiredObjects.has(target)) {
            // The first signed URL of each object is refused the way Supabase Storage refuses an
            // expired download URL; a freshly signed URL for the same object then works.
            faults.readExpire--;
            faults.expiredObjects.add(target);
            readPaths.delete(objectPath);
            send({ statusCode: "400", error: "InvalidJWT", message: '"exp" claim timestamp check failed' }, 400);
            return true;
          }
          const path = readPaths.get(objectPath),
            bytes = objects.get(path);
          if (!bytes) {
            send({ message: "missing" }, 404);
            return true;
          }
          res.writeHead(200, { "Content-Type": "application/octet-stream" });
          res.end(bytes);
          return true;
        }
        if (url.pathname === "/storage/v1/object/fitmatch-v2" && req.method === "DELETE") {
          if (req.headers.authorization !== "Bearer synthetic-service")
            throw new Error("Storage admin credential expected");
          faults.removeCalls++;
          if (faults.removeFail > 0) {
            // Storage outage: nothing removed, the client gets an error.
            faults.removeFail--;
            send({ statusCode: "503", error: "Service Unavailable", message: "synthetic storage outage" }, 503);
            return true;
          }
          const removed = (body.prefixes ?? []).filter((path) => objects.delete("fitmatch-v2/" + path));
          send(removed.map((name) => ({ name })));
          return true;
        }
        if (
          url.pathname.startsWith("/storage/v1/object/fitmatch-wardrobe/") &&
          req.method === "GET" &&
          req.headers.authorization === "Bearer synthetic-service"
        ) {
          const bytes = objects.get(decodeURIComponent(url.pathname.slice("/storage/v1/object/".length)));
          if (!bytes) send({ message: "missing" }, 404);
          else {
            res.writeHead(200, { "Content-Type": "application/octet-stream" });
            res.end(bytes);
          }
          return true;
        }
        if (
          url.pathname.startsWith("/storage/v1/") &&
          url.pathname.includes("/fitmatch-v2/")
        ) {
          if (req.headers.authorization !== "Bearer synthetic-service")
            throw new Error("Storage admin credential expected");
          const rawPath = url.pathname;
          if (rawPath.startsWith("/storage/v1/object/upload/sign/")) {
            const path = decodeURIComponent(
              rawPath.slice("/storage/v1/object/upload/sign/".length),
            );
            const id = "/fixture-upload/" + randomUUID();
            uploadPaths.set(id, path);
            send({ url: id + "?token=synthetic" });
            return true;
          }
          if (rawPath.startsWith("/storage/v1/object/sign/")) {
            const path = decodeURIComponent(
              rawPath.slice("/storage/v1/object/sign/".length),
            );
            const id = "/fixture-read/" + randomUUID();
            readPaths.set(id, path);
            send({ signedURL: id + "?token=synthetic" });
            return true;
          }
          if (rawPath.startsWith("/storage/v1/object/info/")) {
            const path = decodeURIComponent(
              rawPath.slice("/storage/v1/object/info/".length),
            );
            const bytes = objects.get(path);
            send(
              bytes ? { size: bytes.length } : { message: "missing" },
              bytes ? 200 : 404,
            );
            return true;
          }
          if (rawPath.startsWith("/storage/v1/object/")) {
            const path = decodeURIComponent(
              rawPath.slice("/storage/v1/object/".length),
            );
            if (req.method === "POST") {
              if (faults.serverUploadFail > 0) {
                // Storage outage on a server-side upload: nothing stored, the client gets an error.
                faults.serverUploadFail--;
                send({ statusCode: "503", error: "Service Unavailable", message: "synthetic storage outage" }, 503);
                return true;
              }
              if (objects.has(path)) {
                send({ message: "exists" }, 409);
                return true;
              }
              objects.set(path, Buffer.from(raw));
              send({ Key: path });
              return true;
            }
            const bytes = objects.get(path);
            if (!bytes) {
              send({ message: "missing" }, 404);
              return true;
            }
            res.writeHead(200, { "Content-Type": "application/octet-stream" });
            res.end(bytes);
            return true;
          }
        }
        const table = url.pathname.slice("/rest/v1/".length);
        if (tables.has(table)) {
          if (req.headers.authorization !== "Bearer synthetic-service")
            throw new Error("Service scope expected");
          const filters = [];
          for (const [key, value] of url.searchParams) {
            if (
              ["select", "order", "limit", "offset", "on_conflict"].includes(
                key,
              )
            )
              continue;
            if (value.startsWith("eq."))
              filters.push(`${ident(key)}=${quote(value.slice(3))}`);
            else if (value.startsWith("gte."))
              filters.push(`${ident(key)}>=${quote(value.slice(4))}`);
            else if (value === "not.is.null")
              filters.push(`${ident(key)} is not null`);
            else if (value === "is.null") filters.push(`${ident(key)} is null`);
            else if (value.startsWith("in.(") && value.endsWith(")"))
              filters.push(`${ident(key)} in (${value.slice(4, -1).split(",").map((x) => quote(x.replace(/^"|"$/g, "")))})`);
            else throw new Error("Unsupported fixture filter " + value);
          }
          const where = filters.length ? " where " + filters.join(" and ") : "";
          let statement;
          if (req.method === "POST") {
            const keys = Object.keys(body);
            if (table === "fm_v2_models")
              body.input_assets = body.input_assets ?? [];
            statement = `insert into ${ident(table)}(${keys.map(ident)}) values(${keys.map((k) => value(k, body[k]))})${url.searchParams.has("on_conflict") ? " on conflict (" + url.searchParams.get("on_conflict").split(",").map(ident) + ") do update set " + keys.map((k) => ident(k) + "=excluded." + ident(k)).join(",") : ""} returning *`;
          } else if (req.method === "PATCH") {
            statement = `update ${ident(table)} set ${Object.entries(body)
              .map(([k, v]) => `${ident(k)}=${value(k, v)}`)
              .join(",")}${where} returning *`;
          } else if (req.method === "DELETE") {
            statement = `delete from ${ident(table)}${where} returning *`;
          } else {
            const fields = (url.searchParams.get("select") ?? "*")
              .split(",")
              .map((k) => (k === "*" ? "*" : ident(k)))
              .join(",");
            const order = url.searchParams
              .get("order")
              ?.split(",")
              .map((v) => {
                const [key, dir] = v.split(".");
                return ident(key) + (dir === "desc" ? " desc" : " asc");
              })
              .join(",");
            statement = `select ${fields} from ${ident(table)}${where}${order ? " order by " + order : ""}${url.searchParams.has("limit") ? " limit " + Number(url.searchParams.get("limit")) : ""}`;
          }
          const rows = JSON.parse(
            await query(
              `set role service_role;${req.method === "GET" ? `select coalesce(json_agg(t),'[]') from (${statement})t` : `with t as (${statement}) select coalesce(json_agg(t),'[]') from t`};`,
            ),
          );
          if (req.headers.accept?.includes("vnd.pgrst.object+json")) {
            send(
              rows.length === 1
                ? rows[0]
                : { code: "PGRST116", message: "No rows" },
              rows.length === 1 ? 200 : 406,
            );
          } else send(rows);
          return true;
        }
        if (table.startsWith("rpc/fm_v2_")) {
          if (req.headers.authorization !== "Bearer synthetic-service")
            throw new Error("Service role RPC expected");
          const fn = table.slice(4);
          if (
            !/^fm_v2_(enqueue|claim|claim_r1|transition|job_action|asset_intent|output_intent|save_look|source_retention|source_cleanup_report|source_cleanup_due|analysis_reserve|analysis_abort|analysis_enqueue|analysis_result|analysis_defer|analysis_action|analysis_confirm)$/.test(
              fn,
            )
          )
            return false;
          // Deterministic race injection: run SQL just before one RPC (e.g. the item is edited while the
          // route uploads the snapshot), then forward the RPC unchanged.
          if (faults.beforeRpc[fn]) {
            const injected = faults.beforeRpc[fn];
            delete faults.beforeRpc[fn];
            sql(injected);
          }
          const args = Object.entries(body).map(
            ([k, v]) =>
              `${ident(k)} => ${k === "p_inputs" ? `array[${v.map(quote)}]::uuid[]` : k === "p_paths" ? `array[${v.map(quote)}]::text[]` : v !== null && typeof v === "object" ? `${quote(JSON.stringify(v))}::jsonb` : quote(v)}`,
          );
          try {
            const value = await query(
              `set role service_role;select coalesce(to_json(${ident(fn)}(${args.join(",")})),'null'::json);`,
            );
            send(JSON.parse(value));
          } catch (error) {
            const message =
              String(error.stderr).match(/ERROR:\s+([^\n]+)/)?.[1] ??
              "fixture SQL failed";
            send({ message }, 400);
          }
          return true;
        }
        return false;
      },
      seed(owner, itemId, category = "shirt") {
        sql(
          `insert into auth.users values(${quote(owner)}) on conflict do nothing;insert into fm_wardrobe_items values(${quote(itemId)},${quote(owner)},${quote(category)}) on conflict do nothing;`,
        );
      },
      worker(
        owner,
        allowed = ["avatar.reconstruct", "garment.reconstruct", "garment.drape"],
      ) {
        const token = "fmw_" + randomBytes(32).toString("base64url"),
          workerId = randomUUID();
        // Operator grant, as scripts/worker/manage.mjs does; R1 default is deny.
        sql(
          `insert into fm_v2_workers(id,user_id,token_hash,name,allowed_capabilities) values('${workerId}',${quote(owner)},'${createHash("sha256").update(token).digest("hex")}','Synthetic worker',array[${allowed.map(quote).join(",")}]::text[]);`,
        );
        return { token, workerId };
      },
    };
  } catch (e) {
    stop();
    throw e;
  }
}
