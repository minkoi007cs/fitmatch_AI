import "server-only";
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import { refreshTokenPair, type RefreshOutcome } from "@infra/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { authConfig } from "./config";
import { coordinatedRefresh, type RefreshStore } from "./refresh-coordinator";

export async function refreshHubToken(refreshToken: string): Promise<RefreshOutcome> {
  const config = authConfig();
  const admin = createAdminClient();
  const fingerprint = createHmac("sha256", config.secretKey).update(`fm:refresh:${config.appId}:${refreshToken}`).digest("hex");
  const key = Buffer.from(hkdfSync("sha256", config.secretKey, "fitmatch", "refresh-at-rest-v1", 32));
  const codec = {
    encode(value: RefreshOutcome) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      cipher.setAAD(Buffer.from(fingerprint));
      const body = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
    },
    decode(value: string): RefreshOutcome {
      const bytes = Buffer.from(value, "base64url");
      const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
      decipher.setAAD(Buffer.from(fingerprint));
      decipher.setAuthTag(bytes.subarray(12, 28));
      return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()) as RefreshOutcome;
    },
  };
  const store: RefreshStore = {
    async claim(hash, owner) {
      const result = await admin.rpc("fm_begin_auth_refresh", { p_hash: hash, p_owner: owner });
      if (result.error || !result.data?.[0]) throw new Error("REFRESH_STORE_UNAVAILABLE");
      return { owner: result.data[0].is_owner === true, result: result.data[0].sealed_result as string | null };
    },
    async read(hash) {
      const result = await admin.from("fm_auth_refreshes").select("sealed_result").eq("refresh_hash", hash).single();
      if (result.error) throw new Error("REFRESH_STORE_UNAVAILABLE");
      return result.data.sealed_result as string | null;
    },
    async finish(hash, owner, result) {
      const saved = await admin.rpc("fm_finish_auth_refresh", { p_hash: hash, p_owner: owner, p_result: result });
      if (saved.error || saved.data !== true) throw new Error("REFRESH_STORE_UNAVAILABLE");
    },
  };
  return coordinatedRefresh(store, fingerprint, () => refreshTokenPair({ baseUrl: config.hubUrl, apiKey: config.secretKey, timeoutMs: 8_000 }, refreshToken), codec);
}
