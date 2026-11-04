import "server-only";
import { createServerClient, memoryStorage, sessionState } from "@infra/sdk";
import { cookies } from "next/headers";
import { authConfig } from "./config";
import { decodeSession, SESSION_COOKIE } from "./session";

export class AuthFailure extends Error {
  constructor(public status: 401 | 403 | 503, public code: string) { super(code); }
}

export async function verifiedHubSession() {
  const jar = await cookies();
  return verifyHubValue(jar.get(SESSION_COOKIE)?.value);
}

export async function verifyHubValue(value: string | undefined) {
  const config = authConfig();
  const session = decodeSession(value, config.secretKey);
  if (!session || session.appId !== config.appId || session.issuer !== config.hubUrl) throw new AuthFailure(401, "SIGN_IN_REQUIRED");
  if (session.pair.expiresAt <= Date.now()) throw new AuthFailure(503, "AUTH_UNAVAILABLE");
  const client = createServerClient({ baseUrl: config.hubUrl, apiKey: config.secretKey, storage: memoryStorage(session.pair), readOnly: true, skewMs: 0 });
  const state = sessionState(await client.me());
  if (state.status === "anonymous") throw new AuthFailure(401, "SESSION_EXPIRED");
  if (state.status === "forbidden") throw new AuthFailure(403, "ACCESS_DENIED");
  if (state.status !== "authenticated") throw new AuthFailure(503, "AUTH_UNAVAILABLE");
  if (state.user.appId !== config.appId || state.user.user.id !== session.subject) throw new AuthFailure(401, "SESSION_MISMATCH");
  return { session, identity: state.user };
}
