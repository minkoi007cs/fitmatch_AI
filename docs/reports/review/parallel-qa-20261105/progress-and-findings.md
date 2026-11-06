# Claude progress + parallel Codex work

05/11/2026. Session CX-PARALLEL-QA-20261105-11 / QA-PACK-01. Sources checked: PR2 docs head d39d0bf, full-look receipt branch head757e108, local R1 bundle and source a3d051a, canonical worktree d2a9898. No changes to Claude-owned source/UI/API/SQL/transport.

## Current Claude progress

| Package | Evidence | Evaluation |
|---|---|---|
| R1 recovery/capabilities | Updated final a3d051a,5commits, local bundle verified; report full suites passed | Ready for independent review, not product Done |
| Adapter error mapping | a3d051a changes actual exit78/2+JSON, no arbitrary traceback OOM matching | Positive source change; reviewer reran Python unit10/10 |
| Full-look C0/C1 | Receipt CL-FULLLOOK-20261105-01, actual cloud branch codex/full-look-c1 from a3d051a | Work accepted/receipt recorded; no final code bundle/report yet observed |
| Windows process safety | Full-look receipt explicitly says warning-only kill-on-close will be made fail-closed | Known remaining blocker, do not reimplement the same worker file in parallel |
| Top+jeans UI/schema, capture/editor/render | Listed in full-look receipt planned scope | Not yet proven by delivered code/artifacts, cannot count as implemented |
| Real PC/GLB/Supabase/likeness | No new real full-look artifacts inspected in this review | NOT VERIFIED |

Report timestamps converted for user-facing context: receipt at2026-11-06T03:55Z corresponds to05/11/2026 22:55 America/New_York. Chronology is evidence dates, not a promise of completion. Claude external runtime itself is not visible; conclusions above come from receipt/report/source, not live status assumptions.

## Independent review actually performed

Cloned repo objects into a separate temp checkout, fetched bundle into review-only ref and detached at a3d051a. Canonical Studio remains untouched. Ran:

```sh
python3 -I scripts/worker/test_worker_unit.py -v
```

Result:10tests PASS, including checkpoint integrity and structured error mapping; [log](./r1-python-unit.log). Did not rerun app build/DB/API/browser suite in this round. Claude's full test numbers remain implementer-reported, not independent full PASS.

### Integration concern: local adapter manifest schema drift

R1 `Worker.run_lease_bound()` writes adapter input containing `protocolRevision` in addition to the old10fields. PC [adapter conformance report](https://github.com/minkoi007cs/fitmatch_AI/pull/1) explicitly states exact required fields/no extras and does not include protocolRevision. Static AST extraction from a3d051a confirms extra field.

Consequence if PC strict schema remains as reported: structurally valid assignment may be rejected with INVALID_INPUT before the disabled/real engine stage. Fix must be agreed across PC and Claude: optional versioned field in PC schema, or negotiated local adapter payload without the additional field. **Do not silently strip an unknown field from arbitrary manifests or relax every extra field.** Add contract tests driving exact R1 manifest through actual PC CLI, including protocol revision accepted/rejected semantics. This is a static cross-report/source concern, not a claim the PC binary was executed by reviewer.

Handoff action for Claude: include this case in C0 before C1 real integration. New C1 slot/category/params must likewise be machine-readable and versioned; don't keep one frozen validator while expanding the producer unilaterally. PC keeps engine/toolchain ownership; Claude keeps transport/schema.

## Parallel deliverable QA-PACK-01

Built [standalone evidence preflight](../../../../tools/acceptance/README.md) in `tools/acceptance/`, outside Claude src/worker/SQL/testapp scope. CLI checks source revision, body/top/bottom role bindings, owner/avatar/transform references, provenance labels, paths/symlinks, bytes/SHA256, finite measurements and presence of a review record. Never returns product PASS or authenticates likeness/geometry merely from a manifest.

Ran13tests PASS with real CLI exit-status checks and negative tamper/path/identity/slot/provenance/NaN cases; [log](./evidence-unit.log). Test fixtures contain synthetic bytes, not GLB; only evidence-integrity logic is under test. No paid service/GPU/production data used.

This lets Codex prepare and verify future handoff bundles while Claude implements UI/API and PC produces assets; no duplicate production API or model adapter needed. Next Codex-owned work: run this checker against incoming packs, inspect GLB/render/likeness manually, and retest final C0/C1 code when delivered. App/worker automated integration remains Claude's owned test suite, not replaced here.

## Conditions for next acceptance

1. Exact transport→PC adapter schema conformance, including protocolRevision and future top/bottom params.
2. Windows fail-closed implementation + actual PC check before GPU live; shared GPU-host lock still required for two chats.
3. C1 finalSHA/diff, valid body/top/bottom scene, tests for preserving the other slot/late-result guards/save-reopen.
4. Actual model/renderer and personal-data inputs before quality/latency claims; data missing is needs_input, not permission to invent a personal avatar.

Claude can continue C0/C1 without waiting for this standalone tool; return checkpoint receipt/final artifacts as they become available. No new scope or overlapping file ownership assigned to Codex beyond QA-PACK-01 by this report.
