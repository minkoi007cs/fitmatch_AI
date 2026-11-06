import { randomUUID } from "node:crypto";
import { z } from "zod";
import { authenticateRequest } from "@/lib/auth/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { InputError, readJson } from "@/lib/validation";
import {
  id,
  modelRequest,
  uploadRequest,
  workerHeartbeat,
  outputIntentRequest,
  completeRequest,
  claimRequest,
  protocolRevision,
  workerKinds,
  progressRequest,
  failureRequest,
  styleAnswers,
  lookRequest,
  type ModelRow,
  type JobRow,
  type WorkerRow,
} from "@/lib/v2/contracts";
import {
  reply,
  result,
  required,
  digest,
  workerAuth,
  ownedJob,
  assetIntent,
  outputIntent,
  finalizeAsset,
  signedAsset,
} from "@/lib/v2/server";
import { recommend, type Candidate } from "@/lib/v2/recommend";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const safeJobFields =
  "id,model_id,kind,state,attempt,error_code,stage,created_at,updated_at";
function uuid(value: string | undefined) {
  const parsed = id.safeParse(value);
  if (!parsed.success) throw new InputError(400, "INVALID_ID");
  return parsed.data;
}
async function workerRoute(request: Request, path: string[], w: WorkerRow) {
  const db = createAdminClient();
  const method = request.method;
  if (method !== "POST") throw new InputError(405, "METHOD_NOT_ALLOWED");
  if (path.join("/") === "heartbeat") {
    const body = await readJson(request, workerHeartbeat);
    result(
      await db
        .from("fm_v2_workers")
        .update({
          last_seen: new Date().toISOString(),
          capabilities: body.capabilities,
        })
        .eq("id", w.id)
        .eq("enabled", true),
    );
    // Declarations are not permissions: report what the operator actually granted.
    return reply({
      success: true,
      grantedCapabilities: grantedKinds(body.capabilities, w.allowed_capabilities),
    });
  }
  if (path.join("/") === "claim") {
    const body = await readJson(request, claimRequest);
    const job = result(
      await db.rpc("fm_v2_claim_r1", {
        p_worker: w.id,
        p_instance: body.instanceId ?? null,
        p_request: body.requestId ?? null,
      }),
    ) as JobRow | null;
    if (!job) return new Response(null, { status: 204 });
    const model = result(
      await db
        .from("fm_v2_models")
        .select("*")
        .eq("id", job.model_id)
        .eq("user_id", w.user_id)
        .single(),
    ) as ModelRow;
    const inputs = await Promise.all(
      model.input_assets.map(async (assetId) => ({
        ...(await signedAsset(w.user_id, assetId)),
        role:
          model.input_assets.indexOf(assetId) === 0
            ? "front"
            : model.kind === "avatar" &&
                model.input_assets.indexOf(assetId) === 1
              ? "side"
              : model.input_assets.indexOf(assetId) === 2 &&
                  model.kind === "garment"
                ? "detail"
                : "back",
      })),
    );
    let category = model.params.category as string | undefined;
    if (model.kind === "fitting") {
      const garment = required(
        await db
          .from("fm_v2_models")
          .select("params")
          .eq("id", model.garment_id)
          .eq("user_id", w.user_id)
          .single(),
      );
      category = garment.params?.category;
      for (const [role, modelId] of [
        ["body", model.avatar_id],
        ["garment", model.garment_id],
      ]) {
        const parent = required(
          await db
            .from("fm_v2_models")
            .select("output_asset_id")
            .eq("id", modelId)
            .eq("user_id", w.user_id)
            .single(),
        );
        inputs.push({
          ...(await signedAsset(w.user_id, parent.output_asset_id)),
          role: role!,
        });
      }
    }
    return reply({
      protocolVersion: 1,
      protocolRevision,
      redelivered: job.redelivered === true,
      jobId: job.id,
      kind: job.kind,
      modelId: model.id,
      modelRevision: job.engine,
      lease: {
        token: job.lease_token,
        expiresAt: job.lease_until,
        attempt: job.attempt,
      },
      input: {
        params: model.params,
        avatarVersionId: model.avatar_id,
        garmentVersionId: model.garment_id,
        slot: model.slot ?? null,
        category: category ?? null,
        assets: inputs,
      },
      outputContract: {
        format: "glb-v2",
        units: "meters",
        up: "+Y",
        front: "+Z",
        embeddedTextures: true,
        content:
          model.kind === "fitting"
            ? `${model.slot ?? "top"}-only-aligned-to-avatar`
            : model.kind === "garment"
              ? `${model.slot ?? "top"}-canonical`
              : model.kind,
        sharedFrame: {
          units: "meters",
          up: "+Y",
          front: "+Z",
          origin: "floor-between-feet",
          pose: "a-pose-v1",
          note: "body, top and bottom must share this frame; never normalize one item on its own",
        },
        maxFileBytes: 41943040,
      },
    });
  }
  if (path[0] !== "jobs" || path.length !== 3)
    throw new InputError(404, "NOT_FOUND");
  const jobId = uuid(path[1]);
  const action = path[2];
  if (action === "heartbeat") {
    const body = await readJson(request, progressRequest);
    const ok = result(
      await db.rpc("fm_v2_transition", {
        p_worker: w.id,
        p_job: jobId,
        p_token: body.leaseToken,
        p_action: "heartbeat",
        p_stage: body.stage,
      }),
    );
    if (!ok) throw new InputError(409, "LEASE_LOST");
    return reply({ success: true });
  }
  if (action === "output-intent") {
    const body = await readJson(request, outputIntentRequest);
    if (body.sha256)
      return reply(
        await outputIntent(w, jobId, body.leaseToken, body.bytes, body.sha256),
        201,
      );
    // Legacy v1 worker without sha256: previous non-idempotent behavior.
    await ownedJob(w, jobId, body.leaseToken);
    return reply(await assetIntent(w.user_id, "glb", body.bytes, jobId), 201);
  }
  if (action === "finalize") {
    const body = await readJson(request, completeRequest);
    await ownedJob(w, jobId, body.leaseToken);
    return reply(await finalizeAsset(w.user_id, body.assetId, jobId));
  }
  if (action === "input-url") {
    const body = await readJson(request, completeRequest);
    const job = await ownedJob(w, jobId, body.leaseToken);
    const model = result(
      await db
        .from("fm_v2_models")
        .select("*")
        .eq("id", job.model_id)
        .eq("user_id", w.user_id)
        .single(),
    ) as ModelRow;
    const allowed = [...model.input_assets];
    for (const modelId of [model.avatar_id, model.garment_id].filter(Boolean)) {
      const p = required(
        await db
          .from("fm_v2_models")
          .select("output_asset_id")
          .eq("id", modelId)
          .eq("user_id", w.user_id)
          .single(),
      );
      if (p.output_asset_id) allowed.push(p.output_asset_id);
    }
    if (!allowed.includes(body.assetId))
      throw new InputError(403, "ASSET_NOT_IN_JOB");
    return reply(await signedAsset(w.user_id, body.assetId));
  }
  if (action === "complete") {
    const body = await readJson(request, completeRequest);
    const ok = result(
      await db.rpc("fm_v2_transition", {
        p_worker: w.id,
        p_job: jobId,
        p_token: body.leaseToken,
        p_action: "complete",
        p_asset: body.assetId,
      }),
    );
    if (!ok) throw new InputError(409, "LEASE_LOST_OR_OUTPUT_INVALID");
    return reply({ success: true });
  }
  if (action === "fail") {
    const body = await readJson(request, failureRequest);
    const ok = result(
      await db.rpc("fm_v2_transition", {
        p_worker: w.id,
        p_job: jobId,
        p_token: body.leaseToken,
        p_action: "fail",
        p_stage: body.code,
      }),
    );
    if (!ok) throw new InputError(409, "LEASE_LOST_OR_OUTPUT_PUBLISHED");
    return reply({ success: true });
  }
  throw new InputError(404, "NOT_FOUND");
}
function grantedKinds(
  declared: Record<string, unknown> | null | undefined,
  allowed: string[] | null | undefined,
) {
  return workerKinds.filter(
    (k) => !!declared && k in declared && (allowed ?? []).includes(k),
  );
}
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const requestId = randomUUID();
  try {
    const { path } = await context.params;
    if (path[0] === "worker")
      return await workerRoute(
        request,
        path.slice(1),
        await workerAuth(request),
      );
    const auth = await authenticateRequest(request);
    if (!auth.ok) return auth.response;
    const owner = auth.user.id;
    const db = createAdminClient();
    const method = request.method;
    if (path.join("/") === "assets/upload-intent" && method === "POST") {
      const body = await readJson(request, uploadRequest);
      return reply(await assetIntent(owner, "photo", body.bytes), 201);
    }
    if (
      path[0] === "assets" &&
      path.length === 3 &&
      path[2] === "finalize" &&
      method === "POST"
    )
      return reply(await finalizeAsset(owner, uuid(path[1])));
    if (path[0] === "models" && path.length === 1) {
      if (method === "GET") {
        const rows = result(
          await db
            .from("fm_v2_models")
            .select("*")
            .eq("user_id", owner)
            .order("created_at", { ascending: false })
            .limit(100),
        ) as ModelRow[];
        return reply({ models: rows });
      }
      if (method === "POST") {
        const body = await readJson(request, modelRequest);
        const key = request.headers.get("idempotency-key");
        if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key))
          throw new InputError(400, "IDEMPOTENCY_KEY_REQUIRED");
        const payload = {
          p_user: owner,
          p_key: key,
          p_hash: digest(JSON.stringify(body)),
          p_kind: body.kind,
          p_name: body.name,
          p_inputs: "inputAssetIds" in body ? body.inputAssetIds : [],
          p_params:
            body.kind === "avatar"
              ? { heightCm: body.heightCm }
              : body.kind === "garment"
                ? { preserveSource: true }
                : { pose: "a-pose-v1" },
          p_wardrobe: body.kind === "garment" ? body.wardrobeItemId : null,
          p_avatar: body.kind === "fitting" ? body.avatarId : null,
          p_garment: body.kind === "fitting" ? body.garmentId : null,
        };
        return reply(result(await db.rpc("fm_v2_enqueue", payload)), 202);
      }
    }
    if (path[0] === "models" && path.length === 2 && method === "GET") {
      const row = result(
        await db
          .from("fm_v2_models")
          .select("*")
          .eq("id", uuid(path[1]))
          .eq("user_id", owner)
          .maybeSingle(),
      ) as ModelRow | null;
      if (!row) throw new InputError(404, "MODEL_NOT_FOUND");
      return reply({
        model: row,
        asset: row.output_asset_id
          ? await signedAsset(owner, row.output_asset_id)
          : null,
      });
    }
    if (path[0] === "jobs" && path.length === 1 && method === "GET")
      return reply({
        jobs: result(
          await db
            .from("fm_v2_jobs")
            .select(safeJobFields)
            .eq("user_id", owner)
            .order("created_at", { ascending: false })
            .limit(100),
        ),
      });
    if (
      path[0] === "jobs" &&
      path.length === 3 &&
      method === "POST" &&
      ["cancel", "retry"].includes(path[2])
    ) {
      const ok = result(
        await db.rpc("fm_v2_job_action", {
          p_user: owner,
          p_job: uuid(path[1]),
          p_action: path[2],
        }),
      );
      if (!ok) throw new InputError(409, "JOB_ACTION_NOT_ALLOWED");
      return reply({ success: true });
    }
    if (path.join("/") === "compute/status" && method === "GET") {
      const workers = result(
        await db
          .from("fm_v2_workers")
          .select("last_seen,capabilities,allowed_capabilities")
          .eq("user_id", owner)
          .eq("enabled", true),
      ) as Pick<
        WorkerRow,
        "last_seen" | "capabilities" | "allowed_capabilities"
      >[];
      return reply({
        workers: workers.map((w) => ({
          online:
            !!w.last_seen && Date.parse(w.last_seen) > Date.now() - 90_000,
          // Only capabilities that are both declared and granted by the operator.
          capabilities: Object.fromEntries(
            grantedKinds(w.capabilities, w.allowed_capabilities).map((k) => [
              k,
              w.capabilities[k],
            ]),
          ),
          lastSeen: w.last_seen,
        })),
      });
    }
    if (path.join("/") === "style-profiles") {
      if (method === "GET")
        return reply({
          profile: result(
            await db
              .from("fm_v2_profiles")
              .select("id,answers,created_at")
              .eq("user_id", owner)
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ),
        });
      if (method === "POST") {
        const body = await readJson(request, styleAnswers);
        const profile = result(
          await db
            .from("fm_v2_profiles")
            .insert({ id: randomUUID(), user_id: owner, answers: body })
            .select("id,answers,created_at")
            .single(),
        );
        return reply({ profile }, 201);
      }
    }
    if (path.join("/") === "recommendations") {
      if (method === "GET")
        return reply({
          recommendation: result(
            await db
              .from("fm_v2_recommendations")
              .select("id,profile_id,data,created_at")
              .eq("user_id", owner)
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
              .limit(1)
              .maybeSingle(),
          ),
        });
      if (method === "POST") {
        const profile = result(
          await db
            .from("fm_v2_profiles")
            .select("id,answers")
            .eq("user_id", owner)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle(),
        );
        if (!profile) throw new InputError(409, "QUIZ_REQUIRED");
        const rows = result(
          await db
            .from("fm_wardrobe_items")
            .select("id,name,category,color,style,pattern,is_favorite")
            .eq("user_id", owner)
            .order("id")
            .limit(500),
        ) as Candidate[];
        const answers = styleAnswers.parse(profile.answers);
        const votes = result(
          await db
            .from("fm_v2_feedback")
            .select("item_id,value")
            .eq("user_id", owner)
            .limit(500),
        ) as { item_id: string; value: "like" | "skip" }[];
        const feedback = Object.fromEntries(
          votes.map((v) => [v.item_id, v.value]),
        );
        const looks = recommend(rows, answers, feedback);
        const snapshot = digest(
          JSON.stringify({ rows, answers, feedback, engine: "rules-v1" }),
        );
        const existing = result(
          await db
            .from("fm_v2_recommendations")
            .select("id,profile_id,data,created_at,snapshot_hash")
            .eq("user_id", owner)
            .eq("profile_id", profile.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        );
        if (existing?.snapshot_hash === snapshot)
          return reply({ recommendation: existing });
        const record = result(
          await db
            .from("fm_v2_recommendations")
            .insert({
              id: randomUUID(),
              user_id: owner,
              profile_id: profile.id,
              snapshot_hash: snapshot,
              data: looks,
            })
            .select("id,profile_id,data,created_at")
            .single(),
        );
        return reply({ recommendation: record }, 201);
      }
    }
    if (path.join("/") === "feedback") {
      if (method === "GET")
        return reply({
          feedback: result(
            await db
              .from("fm_v2_feedback")
              .select("item_id,value")
              .eq("user_id", owner)
              .limit(500),
          ),
        });
      if (method === "POST") {
        const body = await readJson(
          request,
          z
            .object({
              itemId: id,
              recommendationId: id,
              value: z.enum(["like", "skip"]),
            })
            .strict(),
        );
        const rec = result(
          await db
            .from("fm_v2_recommendations")
            .select("data")
            .eq("user_id", owner)
            .eq("id", body.recommendationId)
            .maybeSingle(),
        );
        const item = result(
          await db
            .from("fm_wardrobe_items")
            .select("id")
            .eq("user_id", owner)
            .eq("id", body.itemId)
            .maybeSingle(),
        );
        if (
          !rec ||
          !item ||
          !Array.isArray(rec.data) ||
          !rec.data.some((l: { itemId: string }) => l.itemId === body.itemId)
        )
          throw new InputError(404, "NOT_FOUND");
        result(
          await db.from("fm_v2_feedback").upsert(
            {
              user_id: owner,
              item_id: body.itemId,
              recommendation_id: body.recommendationId,
              value: body.value,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,item_id" },
          ),
        );
        return reply({ success: true });
      }
    }
    if (path[0] === "feedback" && path.length === 2 && method === "DELETE") {
      result(
        await db
          .from("fm_v2_feedback")
          .delete()
          .eq("user_id", owner)
          .eq("item_id", uuid(path[1])),
      );
      return reply({ success: true });
    }
    if (path[0] === "looks" && path.length === 1) {
      if (method === "GET")
        return reply({
          looks: result(
            await db
              .from("fm_v2_looks")
              .select("*")
              .eq("user_id", owner)
              .order("created_at", { ascending: false })
              .limit(100),
          ),
        });
      if (method === "POST") {
        const body = await readJson(request, lookRequest);
        // One RPC validates owner, avatar binding, slot and readiness and snapshots the asset versions.
        const look = result(
          await db.rpc("fm_v2_save_look", {
            p_user: owner,
            p_name: body.name,
            p_avatar: body.avatarId,
            p_top: body.topFittingId ?? body.fittingId ?? null,
            p_bottom: body.bottomFittingId ?? null,
            p_camera: body.camera ?? null,
            p_recommendation: body.recommendationId ?? null,
          }),
        );
        return reply({ look }, 201);
      }
    }
    if (path[0] === "looks" && path.length === 2 && method === "DELETE") {
      result(
        await db
          .from("fm_v2_looks")
          .delete()
          .eq("id", uuid(path[1]))
          .eq("user_id", owner),
      );
      return reply({ success: true });
    }
    throw new InputError(404, "NOT_FOUND");
  } catch (error) {
    const status = error instanceof InputError ? error.status : 503;
    const code =
      error instanceof InputError ? error.message : "SERVICE_UNAVAILABLE";
    return Response.json(
      { success: false, error: code, requestId },
      {
        status,
        headers: {
          "Cache-Control": "no-store",
          ...(status === 429 ? { "Retry-After": "60" } : {}),
        },
      },
    );
  }
}
export { handle as GET, handle as POST, handle as DELETE };
