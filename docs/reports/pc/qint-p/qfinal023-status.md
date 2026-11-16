# PROC0023 — cleanup accepted in scope, GPU binding still open

PC-QINT-P-20261108-06. Operations0a83edc/PROC0023 (includesf262ee1).
App579ece2f4d7eb1b5336fec1469d5965ab9d8f919/codead6d1d7.

| Gate | Current state |
|---|---|
| QREV-CLEANUP-RACE |**Focused PASS**, Codex independently65unit/10DBblocks; this session did not rerun them |
| Whole privacy/lifecycle |Not universally accepted; documented long-upload+app-death-after-grace orphan limit remains |
| QREV-BIND-02 |**NEEDS CHANGES**, final startup/config ACK WITHHELD |
| Dedicated test environment |Not established; local endpoint/token/test label absent in bounded inspected sources |
| Real app→Qwen |**NOT RUN**, no slot/approval/capability or GPU inference |

The exact worker in579ece2 hashes to
4035abe547fc42621e9dad237c8f429ddb521253c3e0c2b5aab0a590eed09ceb (Git LF),
identical to7631cb0. The corresponding Windows CRLF hash remains5f03f523....
No new startup behavior exists to test. Existing native/CPU findings apply; cleanup
acceptance does not approve another lock, slot, guard or worker deployment.

## Reuse the published CPU repro

PC3D's [portable stdlib repro](https://github.com/minkoi007cs/fitmatch_AI/blob/89c0a30bcb76633db291bd0740899ae5014fff62/docs/reports/pc-safe-008/repro_qrev_binding_cpu.py.txt)
has verified published UTF8 SHA256
8290691756df7c157e5de6905e061aeb11d58544af62748be2bc131113e2f17c.
Its [report/evidence](https://github.com/minkoi007cs/fitmatch_AI/blob/89c0a30bcb76633db291bd0740899ae5014fff62/docs/reports/pc-safe-008/qfinal022-report.md)
and Qwen's [independent final inspection](qrev-final.md) are already published.
Reused here without another execution on unchanged worker bytes.

The repro takes `--worker`, `--expected-worker-sha256`, `--guard` and a fresh
`--output` fixture directory. It checks the actual47331 guard bytes without importing
or substituting the guard, uses isolated lock/slot files and never runs worker.main,
claim, adapter or CUDA. Exit0 means the old bug was reproduced, **not** safety PASS.
Use the hash matching actual worker bytes (LF4035... vs CRLF5f03...), not a guessed
newline-normalized pin. QINT-P has not repeated PC3D's real canonical-lock interval.

## Test configuration remains pending

The local presence-only inventory was refreshed: no configured dedicated test HTTPS
endpoint, scoped worker token, test label or reviewed approval/config was found in
the same targeted environment/12named-file scope. No URL/secret values are emitted;
no remote auth, SQL, key read or environment install was performed.

Codex's separate read-only discovery of project **smoke-supabase** is recorded only
as a candidate. Its owner-purpose question is pending; it is not adopted as a test
project, and no production environment is assumed authorized. The private canonical
metadata receipt now records cleanup focusedPASS separately from bindingNEEDSCHANGES.
It is still metadata, not an installed worker config or test grant.

The [prepared one-licensed-jeans slice](qfinal022-readiness.md) remains conditional:
new canonical-binding source→Codex review→both PC native/config ACK→dedicated test
designation/HTTPS/scoped credential→reviewed worker-owner config→explicit pc-ai slot
and actual OSlock after3D drain. No nested guard, preemption or portrait substitution.
Existing model/env/weights,3D artifacts and Admin/UAC pause remain untouched. No
unchanged benchmark, full unit/DB/native suite or weights verification was rerun.
