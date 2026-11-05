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
const ident = (v) => {
  if (!/^[a-z_][a-z_0-9]*$/.test(v))
    throw new Error("Invalid fixture identifier");
  return '"' + v + '"';
};
export async function v2Fixture() {
  const name = `fitmatch-v2-http-${process.pid}`,
    objects = new Map(),
    uploadPaths = new Map(),
    readPaths = new Map();
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
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;create table auth.users(id uuid primary key);create table fm_wardrobe_items(id uuid primary key,user_id uuid,category text);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);grant select on fm_wardrobe_items to service_role;",
    );
    sql(
      readFileSync(
        new URL(
          "../supabase/migrations/20261105_studio_control_plane.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    return {
      stop,
      sql,
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
          if (objects.has(path)) {
            send({ message: "exists" }, 409);
            return true;
          }
          objects.set(path, Buffer.from(raw));
          send({ Key: path });
          return true;
        }
        if (objectPath.startsWith("/fixture-read/")) {
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
            else if (value === "not.is.null")
              filters.push(`${ident(key)} is not null`);
            else throw new Error("Unsupported fixture filter " + value);
          }
          const where = filters.length ? " where " + filters.join(" and ") : "";
          let statement;
          if (req.method === "POST") {
            const keys = Object.keys(body);
            if (table === "fm_v2_models")
              body.input_assets = body.input_assets ?? [];
            statement = `insert into ${ident(table)}(${keys.map(ident)}) values(${keys.map((k) => quote(body[k]))})${url.searchParams.has("on_conflict") ? " on conflict (" + url.searchParams.get("on_conflict").split(",").map(ident) + ") do update set " + keys.map((k) => ident(k) + "=excluded." + ident(k)).join(",") : ""} returning *`;
          } else if (req.method === "PATCH") {
            statement = `update ${ident(table)} set ${Object.entries(body)
              .map(([k, v]) => `${ident(k)}=${quote(v)}`)
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
            !/^fm_v2_(enqueue|claim|transition|job_action|asset_intent)$/.test(
              fn,
            )
          )
            return false;
          const args = Object.entries(body).map(
            ([k, v]) =>
              `${ident(k)} => ${k === "p_inputs" ? `array[${v.map(quote)}]::uuid[]` : quote(v)}`,
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
      seed(owner, itemId) {
        sql(
          `insert into auth.users values(${quote(owner)}) on conflict do nothing;insert into fm_wardrobe_items values(${quote(itemId)},${quote(owner)},'shirt') on conflict do nothing;`,
        );
      },
      worker(owner) {
        const token = "fmw_" + randomBytes(32).toString("base64url"),
          workerId = randomUUID();
        sql(
          `insert into fm_v2_workers(id,user_id,token_hash,name) values('${workerId}',${quote(owner)},'${createHash("sha256").update(token).digest("hex")}','Synthetic worker');`,
        );
        return { token, workerId };
      },
    };
  } catch (e) {
    stop();
    throw e;
  }
}
