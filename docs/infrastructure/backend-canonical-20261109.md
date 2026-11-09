# BACKEND-024 — canonical backend and safe transition

User decision09/11/2026 supersedes earlier authorization to use smoke-supabase asFitMatchtest. **fitmatch-ai / gohczmqykjkrgdblgbog** is the only approvedmain/pilotSupabasebackend. Source of truth: backend-environments.json. PublicprojectURL is configuration, never acredential. Root.env.local already points to thisref; noenvfile wasmodified and nosecretwasprinted.

## Environments

- Main/pilot: existingfitmatch-ai project, preservingwardrobe/auth/storage/users. Controlled2-userpilot must retain currentassets/data and clearlybindworkerowner.
- Automated destructive/fault/migrationtests: disposablelocalDockerPG withsyntheticdata first. Previewdeploy using mainDB is **not isolated** justbecause itsURL or accountsdiffer. Noautomaticcollector, destructivefixtures orfakejobload onmain.
- Remoteisolatedstaging, iflaterneeded: separatelyprovisioned underowner'scorrectaccount afterbudget/accessdecision; noautomaticpaidresourcecreation. It musthaveitsownref/keys/buckets andpasssameidentitychecks. Not smoke.
- smoke-supabase/wqbwwusrhertqktwsxsl: deprecatedFORFITMATCH; historicalevidencekept. NoSQL/workergrant/job/keys ornewprivateimageshere. No deletion/credentialrotation/disconnect ofunrelatedaccount app performed. Retirement doesnotrequiredeletingunknownclouddata.

## Verified access discrepancy

**Resolved 09/11/2026, PROC-0025/0026:** owner approved the organization-wide OAuth scope, reconnect completed, and the connector now lists fitmatch-ai and executes canonical read-only SQL. The paragraph below is historical diagnosis, not the current blocker. Current gaps are migration compatibility/recovery, native PC ACK and serving HTTPS revision; see [migration preparation](./qwen-migration-preparation-20261109/plan.md).

Browseraccount minkoi007cs sees fitmatch-ai andlifedashboard in itsorg; fitmatch-aidashboardhealthy. ConnectedSupabaseinventorysees onlysmoke-supabase in anotherorg; itsSQLfails28P01 forreadonlyandpostgres. Directconnectorlist_tables oncanonicalgohczref returnspermissiondenied (-32600). This isconfirmedwrongconnection/accessscope, not proofcanonicalDBpasswordisbad. Do notresetcanonicalpassword/dropRLS/alterACL tofixwrongconnector. Correctconnectoraccount/projectauthorization mustbeselectedviauserconnectionflow; managementtoolsavailableherecannotretargetOAuthsilently. Dashboardloginandconnectorloginareseparatesessions.

## Requiredpreflight before cloud changes

1. Access canonicalproject withcorrectaccount; readexistingtables/functions/RLS/storagebucketpolicies/migrationhistory only, noautoreset. CompareactualDBwithreviewedmigrationchain, donotblindlyapplyallfiles toexistingDB.
2. Confirm recoveryroute andmakeprivatebackup/schema snapshot appropriate totheproject beforeadditivechanges; don'tassumefreeprojecthasautomaticbackups. Exportsstayprivate, noGitHub userdata/dump/tokens.
3. ReviewSQLdiff/stageonDocker; namedadditivemigrations preservecurrentwardrobe/auth/outfits. Stopif unrelatedtables/names conflict; reportreconciliation plan. Noappproductiondeploymentor destructive schemachange implicitlyauthorizedbythisdocument.
4. Credentialsperenvironment,server-onlysecretkeys; workerreceivesonlyscopedworkertoken andappHTTPSorigin, notservice-role. Validateconfiguredexpectedprojectref/backendidentity so wrongproject failsbeforewrites/jobclaim. PublicexamplevaluesmustbeplaceholdersormainpublicURL, notsmokefallback. Do notfetchunknownkeysorcopyfromotheraccount.
5. KeepQwenOFFuntilcanonicalGPUbindingcodefix+PCnativeACK+Codexreview. SingleOSlock+finitepc-ai slot+ownedtreedrain before3Dcanresume; noGPUoverlap. Mainbackendselectiondoesnotwaivethisgate.
6. Controlledpilot: one licensedgarmentimage onownedpilotitem→analysis→Qwenreal→humanconfirm. Preserveexistinguseredits; idempotency/leasefence, privatebucket andcrossownerchecks; recordactualSHA/jobIDs/timing/resources privatelyand sanitizedreviewreport. EmergencyrollbackflagOFF/ungrantonlyscopedtestworker, notdropschema/recreateproject.

## Owners

Codex keepscanonicalmapping/process/review andaccessdiagnostics. Claude receivesENV-CANON-01: runtime/projectidentityvalidation/configexamples/runbook +actualschema-reconciliationproposal onownbranch, retain579ece2cleanupfix andfinishQREV-BIND-02 first. No duplicate taskowner oroverwritecanonicalworktree. PCQwen/3D updateownedconfig/receipt tocanonicalproject whilependingaccess, CPUonly. NoonlychangingbaseURLwhileleavingoldkeys/tokens.
