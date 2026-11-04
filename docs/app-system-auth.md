# App System authentication for FitMatch AI

This change is based on production commit `d97553c`. The original checkout is untouched.

## Design

App System (`https://system.minkoi.org`) handles sign-in, signup and provider selection. FitMatch starts authorization-code + S256 PKCE, validates a signed per-attempt state cookie and exchanges the one-time code only on the server. Hub secrets/tokens never enter client JavaScript. Bridged Supabase cookies and their server-side refreshes are also HttpOnly in App System mode; the legacy email/password connection step still uses the existing browser Supabase client before linking.

Supabase remains the data/storage provider. The callback maps the verified App System subject to a local Supabase principal and creates a normal user session through server-only `generateLink` + `verifyOtp` (no email is sent). All business routes continue using the user-scoped client and existing RLS policies, never an admin client for wardrobe queries.

When `FITMATCH_AUTH_PROVIDER=app-system`, a valid Supabase session alone is insufficient: protected pages and every business API also verify the hub's current app membership/subject and the binding to the same local user ID. Hub outages return 503 and preserve cookies; unauthorized identities are denied. State/PKCE checks run before identity provisioning.

### Existing wardrobes

There is **no automatic email merge**. While signed into the old FitMatch account, open `/login` and submit **Connect App System to this wardrobe**. This same-origin POST binds the existing user ID into the signed flow. The callback must still see that same authenticated Supabase user and a valid hub identity. The mapping is unique in both directions within this app. Existing wardrobe/outfit/profile rows and image paths keep their original IDs.

Someone without the old session may use `/login?legacy=1` to sign in using the existing email/password first, then connect. New users receive an internal non-deliverable Supabase principal based on the hub issuer/app/subject. The displayed email comes from verified `/me`, not that internal address. Signup and OAuth in the new mode happen only on the hub.

### Session lifecycle

- First-party HttpOnly, SameSite=Lax, Secure on HTTPS cookies. Signed contents bind issuer, app, hub subject and local user ID.
- Only the proxy rotates hub refresh tokens. Server handlers/rendering use read-only SDK clients with no hidden refresh.
- A PostgreSQL claim shared across instances permits one request per rotating token. Concurrent/late requests reuse an AES-GCM encrypted outcome from the server-only table; refresh tokens are never stored in plaintext there.
- HMAC fingerprints and cached encrypted results are retained 31 days (hub refresh lifetime: 30 days). Secret-key rotation invalidates cookie MACs/cache keys and requires signing in again.
- If a leader dies after rotation or transport is ambiguous, the old token is not resent. A still-valid access token can continue; after expiry the user must sign in again. Do not delete refresh claims to retry a possibly spent token.
- POST logout revokes the app's hub refresh token, signs out the local Supabase session and clears the app cookies. It does not log the user out of unrelated apps/hub browser sessions. A provider outage may prevent remote revocation; local access is still denied after cookie removal.

## Registration completed

FitMatch auth client has been created on the existing hub:

- App ID: `8d9265af-eebf-4849-b4b6-cab01e87496c`.
- Origins: `https://fitmatch.minkoi.org`, `http://localhost:3220`.
- Dedicated publishable/server keys with **auth:read only**; no data API grants or new database provisioned.
- Keys are stored only in ignored `.env.app-system.local` (mode 0600). Do not commit or paste this file into chat.
- Live `/authorize` renders **SIGN IN TO FitMatch AI**, and the server credential is accepted by `/api/v1/me`.

`scripts/register-app-system.mjs` uses the hub's existing DB helpers, records an audit event, and never prints keys. It refuses to issue replacement keys for an existing registration. It does not modify hub source or deploy the hub. Do not rerun it to recover secrets.

The SDK is a dependency-free local snapshot at `vendor/infra-sdk`; Vercel requires no filesystem path outside this repository. Generated vendor files are excluded from app lint.

## Production rollout — still required

1. Apply `supabase/migrations/20261103_app_system_identity.sql` to **FitMatch's existing Supabase project**, not the smoke/test project. It adds two private tables and two service-only functions; it does not rename/delete/copy wardrobe data. Run after the existing `fm_*` schema is present. Do not replace the existing schema.
2. Keep the existing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and OpenAI settings. The service key is needed only for identity provisioning/mapping, refresh coordination and the pre-existing storage upload functionality.
3. Configure these auth variables privately for the FitMatch Vercel project:

```text
FITMATCH_AUTH_PROVIDER
NEXT_PUBLIC_INFRA_URL
NEXT_PUBLIC_INFRA_PUBLISHABLE_KEY
INFRA_SECRET_KEY
INFRA_APP_ID
APP_URL
```

Use `FITMATCH_AUTH_PROVIDER=app-system`, hub URL `https://system.minkoi.org`, the app ID above, and `APP_URL=https://fitmatch.minkoi.org` in production. Transfer key values from the ignored local file directly into environment management; do not expose them in terminal output, screenshots, a PR or a client variable. `INFRA_SECRET_KEY` is server-only. Next.js inlines public variables at build time: set them **before** building the deployed environment.

4. For localhost, merge the ignored auth file into a private `.env.local` together with this project's Supabase settings; keep `APP_URL=http://localhost:3220`. The auth-only `.env.app-system.local` is deliberately not auto-loaded by Next.js. Example/sample files contain names only.
5. For a Vercel preview, register that exact preview origin first and configure `APP_URL` to the same origin. Never wildcard arbitrary Vercel domains; do not use production's APP_URL for a different preview host. Supabase local verification happens server-to-server; the existing OAuth callback for legacy mode is preserved.
6. Deploy the branch, connect the existing authenticated account and verify that the original two items remain visible after reload and after sign-out/sign-in. Test a new user and a second user for isolation, then quiz/upload/outfits. A temporary hosted login success is not proof of data persistence or account isolation.

No production migration, Vercel env change, Git push or deployment has been performed in this task. Existing production continues using its previous auth. The remaining live acceptance needs the migration/settings and a real App System sign-in; synthetic integration tests are not labeled live OAuth success.

### Rollback

Set `FITMATCH_AUTH_PROVIDER=supabase` (or unset it), then redeploy. The original Supabase login/session and user IDs remain valid. Leave the additive identity/refresh tables in place; rollback requires no data deletion. Do not rotate/revoke a shared hub credential; these keys belong only to FitMatch.

## Verification

```sh
npm ci
npm test
npm run lint
npm run build
npm run test:http
```

`test:http` uses ports 3220/3221 and a real Next.js production server against isolated synthetic hub/Supabase HTTP fixtures; no live keys are loaded. It verifies guest rejection before AI, Origin protection, callback state, per-user sessions, return path, account linking with the original UUID, outage behavior, cookie binding, parallel refresh, and logout. It does not establish that Supabase RLS policies are deployed correctly.

Also verified with an isolated PostgreSQL 16 Docker container: migration applies; browser roles cannot access identity/refresh records or RPCs; 10 independent clients yield one refresh owner; only that owner can publish a result; duplicate account mappings are rejected. Existing production tables were not touched.

Browser checks: new login at desktop/mobile (390×844), no horizontal overflow; h1 at y=185 below the navbar ending y=67. The new button reaches the real hosted FitMatch sign-in page. Screenshots are in `Document/fitmatch-audit-2026-11-03/auth-integration`.

## Scope

This integration fixes the missing API auth gate and auth return path. Other audit findings (upload selection race, quiz hydration, outfit image persistence, archive interactions) remain separate work.
