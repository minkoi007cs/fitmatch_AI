# AI-NATIVE-COMPOSE-31 — Windows worker / real CLI / synthetic HTTP

Session PC-QINT-P-20261109-10; operationsb1313e9/PROC0031, own baselinefbd46e5.
**4/4 composition cases PASS**, using the actual Windows worker subprocess and
per-adapter Job Object. Three cases invoke the unchanged Qwen CLI and refuse
before model load. The success control uses Claude's separate **CPU MOCK** adapter.
This closes the bounded local HTTP/worker/CLI gap identified in H-PC-31.

Inventory found the earlier interop was CLI/classification only. Claude's existing
`test-qwen-http.mjs` uses real app/PostgreSQL/browser plus a CPU mock and a POSIX
lock helper. The new owned probe reuses its protocol/fixture conventions, exact
worker and separate mock source; it does not modify or run app/SQL code.

| Case | Real CLI or control | HTTP outcome | Synthetic final state | Result file |
|---|---|---|---|---|
| Missing local approval | Real Qwen CLI →75/GPU_BUSY | `/fail`, GPU_BUSY | queued, attempt0, deferrals1 | absent |
| Unpinned model revision | Real Qwen CLI →78/MODEL_UNAVAILABLE | `/fail`, MODEL_UNAVAILABLE | failed, attempt1, deferrals0 | absent |
| Invalid schema policy | Real Qwen CLI →2/INVALID_INPUT | `/fail`, INVALID_INPUT | failed, attempt1, deferrals0 | absent |
| **MOCK success** | Existing CPU MOCK adapter | `/result`; digest/binding/schema checked | succeeded, attempt1, deferrals0 | MOCK only |

The HTTP API is an in-memory synthetic fixture bound only to127.0.0.1 with an
ephemeral port, synthetic owner/job/lease/worker token and a generated64×64 JPEG.
Its queue state deliberately models the published deferral semantics: claim
increments attempt, GPU_BUSY fail returns to queue and reverses that attempt while
incrementing deferrals. **These state/attempt assertions verify fixture behavior
and the worker's HTTP action/code; they do not independently verify Postgres or
hosted API transactions.** No image/token from the real project was used.

Each case creates a separate disposable coordination tree with a new synthetic
lock, finite120s pc-ai slot and synthetic guard bytes. The exact coordinator helper
writes a policy only in that tree. `expectedBackend` is `isolated-test`, with the
same loopback HTTP origin; the production worker's loopback restriction is intact.
No real coordination policy, lock, slot, guard, state or private config is written.

The actual worker ran with `processContainment: required`, and its log confirms
`windows-job-object`. It holds the synthetic canonical OS byte0 lock, downloads
and verifies the fixture image, writes the real adapter input, invokes the real
CLI directly, drains the owned adapter tree and reports over HTTP. `--once` exits0
after reporting a job failure; this is not a successful Qwen inference.

At each `/fail` or `/result`, a native witness retained SYNCHRONIZE handles to the
actual adapter interpreter inside the owned Windows Job Object and observed all
of them signaled. A separate peer process still could not acquire the synthetic
lock at that HTTP report. After worker/outer-tree drain, the peer acquired and
released the same lock successfully. The real adapter received no worker token.
All three CLI refusals left no result file or `/result` request; checkpoints were
failed. Only the labelled mock produced a completed checkpoint/result requiring
human review, with `approvedForAutoApply:false`.

Witness instrumentation is a local `sitecustomize` import audit/lifecycle logger;
it does not replace approval, parent, admission or worker methods. It fails the
probe on any torch import attempt. No worker/adapter attempted or imported torch.
The missing-approval case names an absent synthetic local approval; no approval
was enabled. The unpinned revision and invalid-input cases use existing CLI
refusal paths. The mock remains separate from the real Qwen CLI.

Command, using the existing qwen-vl Python3.10.22 on Windows:

```text
python ai-service/qint_p/compose31_probe.py
```

| Pinned source | SHA256 |
|---|---|
| Exact worker atf80749a (unchanged worker in0c4c44e per handoff) | `ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6` |
| Real Qwen CLI | `1f3c26b10f67dd92461dbbba385d3499d10f1e726172454e320d7f2c8b3eebb8` |
| Own admission bridge | `b5f92a1365a87cbd9d75ccba153b3967d6f57f3d79eedaba0b56f83626eca78a` |
| Wire mapper | `66a329c51d518aa193fb3d289d42252da374cd35af11732158f7f69c4b35823a` |
| Existing CPU mock | `4b66b038bfda86a4f8756db5f07c630bbe6216407837c50c28a2eb1cfbc50b9a` |
| New composition probe | `5f6500496e3c58fa470f9002d183b9226c141f0a8407691ee9e5eb5d605ea00a` |

The [summary](evidence/compose31/summary.json) includes ordered HTTP events, native
process/lock assertions, actual checkpoint stages, source hashes and per-case time.
Each case has a separate sanitized JSON receipt and worker log in the same folder.
Before/after fingerprints confirm the real policy789426d3, lock identity
`(3699583840,2251799814103012)`, slot, state and guard47331 remained unchanged.

Status: **Ready for review** for this bounded CPU composition. No actual app/DB,
cloud, serving HTTPS, scoped enrollment, live approval, Qwen model/quality, VRAM
or GPU execution is claimed. Canonical remains fitmatch-ai; smoke is retired.
The existing70test/4native/56suite evidence was not rerun. Await Claude's exact
reviewed NATIVE-FIXTURE-30 patch for that separate native-suite follow-up. Real
Qwen still needs backend/recovery/HTTPS review, private scoped token and operator
approval, both native gates and a finite slot from3D, holding the actual OS lock
through owned-tree drain with no overlapping render.
