import { createHmac, timingSafeEqual } from "node:crypto";
import type { TokenPair } from "@infra/sdk";

export const SESSION_COOKIE = "fm_hub_session";
export const FLOW_PREFIX = "fm_hub_flow_";
export const SESSION_AGE = 60 * 60 * 24 * 30;
export const FLOW_AGE = 600;
export const REFRESH_WINDOW = 120_000;

export type HubSession = { pair: TokenPair; subject: string; appId: string; issuer: string; localUserId: string };
export type SignInFlow = { state: string; codeVerifier: string; next: string; issuedAt: number; legacyUserId?: string };

/** Namespaced MAC protects both tokens and the legacy account selected for explicit linking. */
export function seal(value: unknown, key: string, purpose: "session" | "flow") {
  const body = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${body}.${createHmac("sha256", key).update(`fitmatch:${purpose}:${body}`).digest("base64url")}`;
}

export function unseal<T>(value: string | undefined, key: string, purpose: "session" | "flow"): T | null {
  if (!value || value.length > 12_000) return null;
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", key).update(`fitmatch:${purpose}:${parts[0]}`).digest();
  const actual = Buffer.from(parts[1], "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try { return JSON.parse(Buffer.from(parts[0], "base64url").toString()) as T; } catch { return null; }
}

export function decodeSession(value: string | undefined, key: string): HubSession | null {
  const session = unseal<HubSession>(value, key, "session");
  if (!session || typeof session.subject !== "string" || typeof session.appId !== "string" ||
      typeof session.issuer !== "string" || typeof session.localUserId !== "string" ||
      typeof session.pair?.accessToken !== "string" || typeof session.pair.refreshToken !== "string" ||
      !Number.isFinite(session.pair.expiresAt)) return null;
  return session;
}

export function decodeFlow(value: string | undefined, key: string): SignInFlow | null {
  const flow = unseal<SignInFlow>(value, key, "flow");
  if (!flow || typeof flow.state !== "string" || typeof flow.codeVerifier !== "string" ||
      !Number.isFinite(flow.issuedAt) || Date.now() - flow.issuedAt > FLOW_AGE * 1000 ||
      flow.issuedAt > Date.now() + 5_000 || (flow.legacyUserId !== undefined && typeof flow.legacyUserId !== "string")) return null;
  return { ...flow, next: safeNext(flow.next) };
}

export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) return "/wardrobe";
  try {
    const url = new URL(value, "https://fitmatch.invalid");
    if (url.origin !== "https://fitmatch.invalid" || url.pathname.startsWith("//") ||
        /^\/(?:auth(?:\/|$)|login(?:\/|$)|api(?:\/|$))/.test(url.pathname)) return "/wardrobe";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return "/wardrobe"; }
}

export function flowName(state: string | null) {
  return state && /^[A-Za-z0-9_-]{20,128}$/.test(state) ? `${FLOW_PREFIX}${state}` : null;
}

export function cookieOptions(appUrl: string, maxAge: number) {
  return { httpOnly: true, secure: appUrl.startsWith("https://"), sameSite: "lax" as const, path: "/", maxAge };
}

export function ownsImagePath(path: unknown, userId: string): path is string {
  return typeof path === "string" && path.startsWith(`${userId}/`) &&
    !/[\\\u0000-\u001f%]/.test(path) && path.split("/").every(part => part !== ".." && part !== "." && part !== "");
}
