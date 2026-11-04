import "server-only";
import { createHash } from "node:crypto";
import type { MeResponse } from "@infra/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

/** No email-based merging. An old account is linked only after proving both live sessions. */
export async function localIdentity(identity: MeResponse, issuer: string, legacyUserId?: string) {
  const admin = createAdminClient();
  const key = { issuer, app_id: identity.appId, subject: identity.user.id };
  const lookup = () => admin.from("fm_auth_identities").select("user_id").match(key).maybeSingle();
  const existing = await lookup();
  if (existing.error) throw new Error("IDENTITY_STORE_UNAVAILABLE");
  if (existing.data) {
    if (legacyUserId && legacyUserId !== existing.data.user_id) throw new Error("IDENTITY_ALREADY_LINKED");
    return existing.data.user_id as string;
  }

  let userId = legacyUserId;
  if (!userId) {
    const hash = createHash("sha256").update(JSON.stringify(key)).digest("hex");
    userId = `${hash.slice(0,8)}-${hash.slice(8,12)}-8${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
    const prior = await admin.auth.admin.getUserById(userId);
    if (prior.error && prior.error.status !== 404) throw new Error("IDENTITY_STORE_UNAVAILABLE");
    if (!prior.data.user) {
      const created = await admin.auth.admin.createUser({
        id: userId, email: `${hash}@identity.fitmatch.invalid`, email_confirm: true,
        app_metadata: { fitmatch_hub_identity: key },
      });
      if (created.error) {
        // Concurrent callbacks may create the same deterministic principal.
        const retry = await admin.auth.admin.getUserById(userId);
        if (!retry.data.user) throw new Error("IDENTITY_PROVISION_FAILED");
      }
    }
    const verified = await admin.auth.admin.getUserById(userId);
    const marker = verified.data.user?.app_metadata?.fitmatch_hub_identity;
    if (marker?.issuer !== issuer || marker?.app_id !== identity.appId || marker?.subject !== identity.user.id) throw new Error("IDENTITY_CONFLICT");
  }
  const inserted = await admin.from("fm_auth_identities").insert({ ...key, user_id: userId });
  if (inserted.error) {
    const winner = await lookup();
    if (winner.error || winner.data?.user_id !== userId) throw new Error("IDENTITY_ALREADY_LINKED");
  }
  // Never overwrite an existing style profile while connecting identities.
  const profile = await admin.from("fm_users").upsert({ id: userId, email: identity.user.email ?? "" }, { onConflict: "id", ignoreDuplicates: true });
  if (profile.error) throw new Error("PROFILE_STORE_UNAVAILABLE");
  return userId;
}

/** Mint a normal user session for RLS. generateLink does not send an email. */
export async function bridgeSession(userId: string) {
  const admin = createAdminClient();
  const profile = await admin.auth.admin.getUserById(userId);
  if (profile.error || !profile.data.user?.email) throw new Error("IDENTITY_STORE_UNAVAILABLE");
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: profile.data.user.email });
  if (link.error || link.data.user.id !== userId || !link.data.properties.hashed_token) throw new Error("SESSION_BRIDGE_FAILED");
  return link.data.properties.hashed_token;
}
