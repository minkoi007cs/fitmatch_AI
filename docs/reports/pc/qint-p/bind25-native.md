# PC-QWEN-BIND-25 — Windows native ACK and CPU bridge

Session PC-QINT-P-20261109-09. Read operations1e211de/PROC0027 in full and Claude's
binding checkpoint/H-MIGRATION-26. Canonical remains **fitmatch-ai**, ref
`gohczmqykjkrgdblgbog`. Connector access is restored per Codex L061; PC did no SQL.
Migration/recovery and reviewed serving HTTPS revision remain open.

PC-SAVE-30 continuation read operations9145532/PROC0030 and the complete root
roadmap/process delta. Existing evidence is preserved/published here without
rerunning models or the unchanged suite. Operations now reports app0c4c44e,
implementationcf902d3 and unchanged worker; this native test receipt remains pinned
tof80749a. Claude owns NATIVE-FIXTURE-30. Wait for the exact reviewed test patch,
then run that native suite and report actual skips/errors; do not rewrite transport.

**Focused binding shape/policy/native identity ACK: PASS.** PC3D alone issued the
policy from the existing canonical lock after Qwen's idle ACK. Qwen independently
verified its digest, guard digest, file identity and exact helper's derived paths.
This ACK does not grant a GPU slot, capability, enrollment or full integration.

| Exact artifact | SHA256 / identity |
|---|---|
| App source | `f80749a65b47441958e7c6fc485034d7efe446df` |
| Worker Git LF / Windows-tested LF bytes | `ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6` |
| Worker CRLF review mirror, LF-normalized identical | `ec9df0b049feac6a14580da525657d25fb29f2663166a4b4c96a52a6baa33ddd` |
| PC3D coordinator policy | `789426d36e00533b1459880dfa70d713614517ccaa8807dc1d3cf965ab895039` |
| Shared guard | `47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c` |
| Existing NTFS lock identity (volume, fileId) | `(3699583840, 2251799814103012)` |

`os.stat` and `os.fstat` matched on the actual existing lock under Python3.10.22
on Windows. Qwen's actual-lock check opened metadata only, acquired no lock and
read/wrote no lock bytes. PC3D separately reports the same native Win32 identity.
Qwen did not write/replace the real coordinator policy, lock, slot, guard or state.

The accepted config shape is `gpuCoordinator {path, sha256}` + `gpuSlotOwner: pc-ai`
and `expectedBackend {projectRef, appOrigin}`. No `gpuLock`, `gpuSlot` or `gpuGuard`
keys may be supplied. Paths derive from the pinned PC3D policy. Worker owns OS
byte0 once, invokes the adapter directly, and keeps the lock until the complete
owned process tree drains. No nested external GPU guard or environment-only proof.

| Verification | Result and limits |
|---|---|
| Exact unmodified `python -m unittest -v scripts/worker/test_worker_unit.py` | **56 run:46 PASS,9 skip,1 ERROR**, no failures; not an all-PASS suite |
| Skips | 5 POSIX process-group tests;4 symlink privilege cases (Windows1314) |
| Copied-lock error | Windows refuses `shutil.copytree` reading a locked byte, before the binding assertion; transport is unchanged |
| Supplemental native proof | **4/4 PASS**, actual Windows processes/Job Object; synthetic lock/policy trees except read-only actual lock identity |
| Own adapter/bridge suite | **70/70 PASS**, JSON/schema/normalization/error mapping and updated coordinator/backend checks; composition parent/Job positives injected |
| Current transport interoperability | 4 actual CLI refusal subprocesses +8 error mappings PASS atf80749a; synthetic result accepted by actual worker validator and contract checker |
| Contract source | 29 schema/fixture/checker files matchf80749a; binding documentation updated to same revision |
| Real-policy helper `verify` | `admitted:true` **binding only**, no lock acquisition, finite-slot evaluation or backend readiness claim |

The supplemental copied-policy test creates the byte-identical copy before locking
the synthetic canonical file. While that canonical lock remains held, a peer
process is excluded and the copied file is independently free, but admission
refuses the copied policy on file identity. This closes the original foreign-lock
reproduction in focused native scope. A [test-only proposal](bind25-worker-test-proposal.patch.txt)
moves fixture copying before lock acquisition; Claude's source/tests were not edited.
Symlink/alias cases remain skipped in this suite; PC3D owns supplemental junction
and actual shared-lock verification, not inferred as Qwen PASS here.

Native drain used the real venv launcher and a sleeping grandchild inside the
worker's per-adapter Windows Job Object. Launcher exit left the grandchild alive;
a peer could not take the synthetic lock. Drain terminated and waited for the
owned grandchild while an unrelated disposable sentinel survived. Lock remained
held until explicit handback after drain; no GPU guard nested and no GPU loaded.

The own adapter approval schema is nowv2 for one authorized wardrobe pilot. It
pins coordinator hash and reviewed HTTPS origin, rejects legacy binding fields
and the retired smoke ref, and rechecks policy/guard/lock identity before load.
Source/config hashes, actual ancestor creation identity, Job membership, finite
slot and held byte0 remain required. The example stays disabled; no operator
approval was installed. This is adapter preparation, not an app contract change.

A private binding-only config and disabled full config plan use the issued policy
and canonical ref. The reviewed HTTPS origin is deliberately unset and no token
is stored. Bounded inventory found no app HTTPS endpoint or scoped worker token
in the inspected sources; it does not search all external secret stores. No
endpoint was contacted. No live config/enrollment was installed. The expired
existing slot was preserved and grants no current pc-ai admission.

Next: Claude closes the fixture and remaining migration runner target guard;
Codex reviews exact compatibility source/SQL and backend recovery/preflight plus the
serving HTTPS revision. Private scoped enrollment and reviewed adapter approval
follow. Only then can PC3D drain its GPU tree and issue a finite pc-ai slot. Qwen
must hold the same OS lock through owned-tree drain, unload and hand back before
render resumes. No real app/Qwen job, CUDA, model download/rehash/benchmark, private
photo read or asset change occurred in this CPU task.

Evidence is under [bind25](evidence/bind25/checkpoint.json): original suite log,
supplemental native receipt, bridge/interop receipts, policy verification and
presence inventory. Prior579ece2 binding reports remain historical.
