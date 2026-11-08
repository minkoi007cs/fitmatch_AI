# PROC0020 CPU handoff — PC-QINT-P-20261108-03

Read operations218bc200a166ae8e3121743fa976ab07bac83f69 and the focused QINT-R
review. App95d59ad5846d78f47209041a76198ad56c378f58 remains **NEEDS CHANGES**.
No final QREV-fix branch/revision was available in the remote Qwen branch inventory
at this checkpoint. Final Claude ACK is **pending**. No GPU, benchmark, weights
verification/download or personal-image read was performed.

## Exact CPU checks

`cpu_handoff_smoke.py --revision <40hex-commit>` reads the exact Git objects from
the separate docs checkout. It verifies the installed shared guard hash and all28
Qwen schemas/fixtures against the existing pinned snapshot. It copies the transport
privately for file-hash binding, never runs its main/worker loop or network client.

On95d59ad, transport SHA256 is
659165ab3723a8608c36acfbd826ec023db3c1bfba402a74d4cb066288f8d8d1, unchanged
from the prior1f4 probe. All28 contract-file hashes matched. Nine negative adapter
admission cases passed:

- Missing, default, other absolute and relative GPU lock paths.
- Unsafe containment and mismatched workDir.
- Old guard hash, unreviewed slot bridge and mismatched transport file hash.

Each invocation returned exit75 with `{"success":false,"code":"GPU_BUSY"}`.
Backend construction, CUDA import, the shared-lock probe and kernel Job probe were
not reached; no result was created. Synthetic PASS policy markers existed only in
a disposable CPU fixture folder, were removed with that fixture, and were never
installed at the real approval path. Private source/config files and policy paths
are excluded from publication. This is an adapter-level smoke, not proof that
Claude's worker startup has been fixed.

Command, exit0:

```powershell
python cpu_handoff_smoke.py --revision 95d59ad5846d78f47209041a76198ad56c378f58
```

To run against a future final revision, fetch it into the docs checkout and pass
its exact full SHA. A changed schema/fixture hash stops this smoke for explicit
contract reconciliation. No mutable branch is accepted as the revision argument.
The existing130-test/129PASS/1skip checkpoint remains unchanged; it was not rerun
to inflate this report. No new model benchmark or actual inference was run.

## Conditional placement receipt for owners

Installed guard SHA256 was independently read as
47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c.
The private coordination receipt records the exact absolute existing
`coordination/gpu0.lock`, msvcrt exclusive byte0. Proposed integration remains
**worker as sole lock owner, direct adapter**, without a nested guard or an
environment-only bypass. Present expired/malformed slot metadata refuses admission;
the 3D coordinator alone grants/renews idle slots. Release of a prior3D task is not
a new pc-ai grant. Current observed slot owner is pc-3d.

Before final ACK, Claude/QINT-G/Codex must reconcile the final config/startup check
with that exact path/hash/slot policy. The public example can use a neutral required
placeholder, but default or missing config must fail closed for Qwen integration.
The startup smoke must establish that a mismatch cannot proceed to claim/spawn/load;
this adapter smoke establishes only the last pre-CUDA refusal boundary. Exact
startup field names/protocol must come from the final Claude checkpoint; QINT-P
does not introduce app/transport metadata unilaterally.

QREV-QUOTA/SNAPSHOT and truthful waiting status remain Claude/Codex scope. Dedicated
authenticated test endpoint/scoped credentials and review approval are still needed.
The real operator approval file is absent; no config install, enrollment, capability
grant, migration, deploy or Qwen GPU slot was performed. PC-PHOTO-019 artifacts and
personal input remain untouched. Central process/app/transport/sharedguard are unchanged.
