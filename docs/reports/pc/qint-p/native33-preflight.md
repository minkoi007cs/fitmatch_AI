# PC-NATIVE-33 / AI-PREFLIGHT-33 — exact reviewed fixture and disabled pilot plan

Session PC-QINT-P-20261109-11. Operations8ab74ac/PROC0032 read and reconciled with
the prior complete root history. Own baseline047df82 and CPU31 evidence preserved.
Fetched the reviewed `codex/app-close-30-claude-20261109` candidate at
`499ead01e7f9274ddf310ab346fda4c2464588bd`. No existing native33 receipt existed.

**Windows result:56 run,47 PASS,9 skip,0 errors/failures, exit0.** This is the
first native run of Claude's reviewed test correction, not an assumed result.
The copied-coordination regression now passes with the original lock held during
all refusal/split-lock assertions. The only test change moves fixture copying
before lock acquisition; production worker bytes are unchanged. Exact-source
files were extracted into a separate review directory; no dirty source was copied
over or modified. Prior failed-suite evidence remains historical.

| Artifact | SHA256 |
|---|---|
| Reviewed test-only patch | `50ddd9cb14d893c4f6bdbf7c099e5e4e6c16dc54a333294c8837c2674bde5fd3` |
| Executed test file, raw Git bytes | `f178f7f0ff2723b8e0b5f3235c2da71a1565d9138bd04529362f4223d8a86429` |
| Production worker, Git LF / tested Windows LF | `ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6` |
| Existing equivalent worker CRLF review mirror | `ec9df0b049feac6a14580da525657d25fb29f2663166a4b4c96a52a6baa33ddd` |
| Coordinator policy, unchanged | `789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039` |
| Shared guard, unchanged | `47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c` |

Command: from the disposable exact-source `scripts/worker` directory,
`python -m unittest -v test_worker_unit`, existing Windows Python3.10.22.
Raw Git/test hashes and LF-normalized publication hashes are distinguished in
the source manifest. No assertion was removed and no test was forced to PASS.

The9 skips are5 POSIX process-group drain cases and4 cases requiring symlink
privilege: workspace alias, forged/linked slot, escaping guard link and linked
lock/policy. Their names/reasons are retained in the [native result](evidence/native33/native-result.json)
and [full sanitized log](evidence/native33/native.log). These skipped cases remain
unverified by this run. Prior BIND25 native4/4, CPU31 native HTTP composition4/4
and PC3D supplemental evidence are separate receipts, not substitute counts or
repeated tests here. Native test ACK covers the47 executed cases; final gate
review remains with Codex.

The [disabled canonical preflight plan](sources/qint_p/preflight33.disabled.json.txt)
is metadata, with `enabled:false`, and was not installed as a worker config.
It pins candidate499ead0, the unchanged worker, current adapter/controller hashes,
existing Python/package metadata and model revision
`ebb281ec70b05090aa6165b016eac8ec08e71b17`. Package versions were read from dist-info
without importing torch: torch2.9.0+cu128, transformers4.57.1, accelerate1.11.0,
bitsandbytes0.48.2, Pillow12.0.0, psutil7.1.3 and jsonschema4.25.1.
The existing checkpoint manifest is reused; no weight file was read or rehashed.

Config shape remains `gpuCoordinator {path,sha256}`, `gpuSlotOwner:pc-ai` and
`expectedBackend {projectRef:gohczmqykjkrgdblgbog,appOrigin:null}`. Legacy
gpuLock/gpuSlot/gpuGuard fields are absent. The actual reviewed app origin is
deliberately unset; no HTTPS URL or token was guessed/copied. Canonical remains
fitmatch-ai; smoke remains retired and is not a fallback.

Existing preflight entry points were reused, without a new framework:

- Exact worker `main --once`, with the disabled plan's inner config in a disposable
  workdir, exits5 on the missing reviewed backend origin before constructing its
  client, entering the claim loop or acquiring the real GPU lock. Its binding check
  reads the existing coordinator metadata only. [Startup log](evidence/native33/startup-preflight.log).
- Actual Qwen CLI, using the existing disabled operator-approval example, exits75
  with `GPU_BUSY` before image decoding/model load, and creates no result.
- Existing `validate_policy` rejects that disabled approval with `GPU_BUSY`.

All3 refusal checks passed. The [preflight receipt](evidence/native33/preflight-result.json)
records pins and remaining prerequisites. The bounded [presence inventory](evidence/native33/presence-inventory.json)
does not search every external secret store. Missing/unverified items are:

- Canonical recovery/migration review and hosted readiness, owned by Claude/Codex.
- Reviewed serving HTTPS origin and exact deployed build revision.
- Private scoped worker enrollment/token; no credential was installed or disclosed.
- Authorized app-owned wardrobe input and immutable snapshot binding; a local
  licensed image is not evidence that an app snapshot/job exists.
- Reviewed live operator approval and both native gate acceptance.
- A new finite pc-ai slot from3D; the existing expired pc-3d slot was preserved.

Status: **Ready for review** for native fixture verification and fail-closed CPU
preflight. Real-app readiness is blocked on the listed external gates. No cloud
write, deploy, enrollment, admin/UAC, model download/load or CUDA occurred. Real
policy/lock identity `(3699583840,2251799814103012)`, slot/state and guard remained
unchanged. No new GPU grant. A future authorized job still needs the same actual
OS byte0 lock held through the worker's full owned-tree drain, with a direct
adapter and no nested guard or concurrent3D render.
