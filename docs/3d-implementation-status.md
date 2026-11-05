# 3D increment 1 — implementation and PC handoff

Branch: codex/3d-studio-worker. Baseline: origin/main ac26306. Worktree isolated from original checkout and other audit work.

## Implemented

- Protected /studio route and navigation; desktop three-column research workspace.
- Actual Three.js GLB viewer with orbit/zoom, front/side/back/reset, neutral lights.
- Local self-contained manifest + GLB import; avatar-bound garment versions, cached visibility switching and A/B selection comparison.
- Shared world transform preserves pre-draped garment alignment. File/count/bundle size limits, external-resource rejection, reserved ID check, unsupported required decoder rejection.
- Async load guard, empty/error/WebGL failure states, renderer/controls/texture disposal and close-bundle cleanup.
- Codex PC task sheet, hardware PowerShell collector (no installation/admin/system mutation), exporter contract and example manifest.

## Verification actually run

- npm run lint: PASS.
- npm test: PASS, 15 tests including 4 new Studio contract/security tests.
- npm run build: PASS, Next 16.4.5 and TypeScript.
- npm run test:studio: PASS. Isolated fake auth/Supabase fixture; actual Chromium/WebGL with synthetic triangle GLBs. Tested login gate, malformed import, load, select, A/B, camera controls, 1440px and 390px no horizontal overflow, close/dispose and no page exceptions. Existing HTTP auth/ownership/save/refresh/logout checks also pass.
- Desktop empty-state screenshot visually reviewed. test-results/studio-synthetic-mesh.png is synthetic geometry, not a reconstructed person or garment.
- npm audit --omit=dev: 0 vulnerabilities. npm install reported 8 moderate dev-tree findings; no audit fix --force used.
- PowerShell script and CUDA pipelines have NOT run on the Windows PC.

## Still required before the requested product is complete

- Real PC hardware report, licensed body/checkpoint assets, avatar inference/clean body and garment reconstruction/texture/drape benchmarks.
- Capture/upload and account persistence of avatar/garment versions, durable GPU queue/worker authentication and result publish.
- Connection from wardrobe item IDs to prepared GLBs and persistent saved looks. Current imported model bundle is transient browser memory and explicitly labelled as such.
- User-data quality validation, GPU performance, real logo/fit correctness and research beta deployment.

No cloud spending, production migration, push, merge or deploy performed. PC has Codex but is not connected to this host: the source archive and PC-TASK.md are a concrete handoff; no job is claimed to be executing there.

## Run locally / on PC

npm ci
npm run dev

Configure the app's normal authentication and Supabase environment separately; secrets are not included in handoff. Visit /studio after sign-in. Select manifest.json and all referenced GLBs together. An importer is not an image-to-3D engine: PC-TASK.md implements/tests the latter.

For isolated tests without production accounts: npm ci; npx playwright install chromium; npm run build; npm run test:studio. PowerShell task: powershell -NoProfile -File .\workers\windows\Collect-Hardware.ps1.
