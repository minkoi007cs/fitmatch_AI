# BACKEND-024 canonical backend — PC-QINT-P-20261109-08

The owner decision replaces the former smoke authorization: **fitmatch-ai** is the
canonical main/pilot backend. Existing user data must be preserved. The former
smoke-supabase target is deprecated for FitMatch and must not be a fallback; its
cloud project has not been deleted or reset.

Authority is `docs/infrastructure/backend-environments.json` at operations commit
`7b247ba6cb0e08f3360f42a3cda56825dfbfcde1` (PROC0024, includes2ee6f25), read with
the canonical infrastructure document and updated agent/roadmap/process rules.
The pinned snapshot SHA256 is
`5ea746851bf4f52819953c41c0446fde92604859eed6bafbc5848a5635d13e7c`.
This public registry copy is metadata for this checkpoint, not a second authority
or an installed app/worker configuration. The helper verifies its digest and the
canonical identity, and refuses mismatch without falling back to the old target.

| Item | Current state |
|---|---|
| Canonical backend | fitmatch-ai, main/pilot; preserve existing data |
| Project ref | `gohczmqykjkrgdblgbog` |
| Backend API | `https://gohczmqykjkrgdblgbog.supabase.co` |
| Root public backend environment | Codex reports already canonical; PC Qwen did not read/edit it |
| FitMatch application HTTPS endpoint | Not found in bounded inspected sources |
| Scoped canonical worker token | Not found in bounded inspected sources; identity/binding unverified |
| Reviewed worker approval | Absent; no config installed or capability granted |
| Connector access | Codex reports permission denied on canonical project; PC Qwen did not retry |
| GPU binding | QREV-BIND-02 NEEDS CHANGES at unchanged579ece2; startup/config ACK WITHHELD |

A fresh nonsecret canonical target/config-plan receipt and GPU-path checkpoint
were written. The previous current smoke receipt is explicitly deactivated.
No smoke key or worker token may be reused, and changing only the URL while keeping
old credentials is prohibited. A Supabase API URL is separate from the FitMatch
application URL used by `/api/v2/worker`; it is excluded from app endpoint candidates.
Claude owns ENV-CANON-01 app changes. PC Qwen changed only its metadata helper,
receipts and publication package, without touching app/transport/shared GPU guard.

The connector needs the correct account/project connection flow. Browser and
connector sessions are separate. Permission denied does not establish a database
password problem; no password, role, RLS or ACL was changed. No project credential
was fetched, printed, copied, installed or committed.

Before any main migration, the owning lane must complete read-only inventory of
existing schema/RLS/storage/migration state, establish private recovery, and
reconcile the proposed schema with existing data. PC Qwen performed no SQL,
migration, backup, enrollment or cloud mutation. Destructive/synthetic checks belong
in a disposable local environment; automatic cleanup must not target main. A
preview connected to main still uses main data.

The prepared licensed-jeans pilot remains NOT RUN. It requires the binding fix,
review and native/startup ACK, a reviewed app endpoint and newly verified scoped
canonical credentials, plus a coordinator-granted finite pc-ai slot and the actual
OS byte0 lock. Worker owns the lock once and invokes the direct adapter; no nested
guard or environment-only bypass. Main user data is not disposable pilot data.
Focused cleanup PASS579ece2 does not close binding or full integration acceptance;
the documented long-upload/app-death limit remains.

Validation: registry digest and source commit match; canonical ref is absent from
the deprecated set; old current smoke authorization is false; new reports contain
presence/status only. CPU parsing, package digest and publication checks were run.
The metadata-only inventory inspected targeted process/user/machine variables and
12 named files, not every external secret store. No model benchmark, CUDA, personal
image read, actual slot/lock/guard mutation or asset/weight change occurred.

Evidence: [presence inventory](evidence/backend024/testenv-presence.json),
[preparation summary](evidence/backend024/preparation-summary.json), and
[sanitized checkpoint](evidence/backend024/canonical-checkpoint.json). Earlier
smoke reports remain historical and do not authorize current use.
The [metadata validation receipt](evidence/backend024/metadata-validation.json)
records78 verified snapshots and38 parsed Python sources, with no torch import.
