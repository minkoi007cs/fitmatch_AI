# H-QWEN-018 — tích hợp Qwen vào app để chạy thử

Ngày07/11/2026. Chủ dự án đã giao **triển khai và chạy thử** Qwen trên PC với app, phối hợp một GPU với3D. Đây là quyền xây code, chạy local/disposable authenticated test environment; không phải quyền deploy/migrate production, mở router/publicPythonAPI hoặc enable các engine3D chưa đạt. Giữ toàn bộ PR6/7/8/checkpoint/env/weights. Đọc AGENTS→agent→roadmap→process đầy đủ, H-PC-017 và receipt trước sửa.

## Kết quả cần đưa cho chủ dự án

Trong app test, user thêm/chọn ảnh áo thun hoặc jeans thuộc wardrobe của mình → bấm phân tích với AI → thấy queued/waiting_GPU/running/review/error đúng thực tế → PC Qwen chạy thật → trả gợi ý loại/màu/họa tiết và text/logo chưa xác nhận → user duyệt/chỉnh → lưu đúng source version. Kết quả hỗ trợ rules-v1 đề xuất3bộ chỉ từ owned itemIDs, giải thích ngắn; bấm đúng bộ vào Studio như hiện có. Không bắt Qwen sinh mesh hoặc GLB. Không thay nội dung logo bằng suy đoán, không tự ghi đè metadata do user đã xác nhận.

Mốc đầu tiên: một ảnh licensed test đi xuyên browser→authenticated API→durablejob→PCQwen→validatedresult→browserreview, rồi2account isolation/queue contention. Ưu tiên mốc này trước mở rộng chat/generalassistant. Không cần ảnh cá nhân để tích hợp, không cần đợi SiTH compiler.

## Owner và nhánh

| ID | Owner | Scope |
|---|---|---|
| QINT-C | Claude | src/, additiveSQL, machine-readableQwen contract, tests và existing scripts/worker transport nếu cần; tiếp từ own appfinal d17ca355 hoặc descendant có receipt |
| QINT-P | PC Qwen | ai-service runtime/adapter/controller/env riêng, JSON input/output/error conformance, weights hiện có; không sửa app/transport Claude |
| QINT-G | PC3D | sharedguard/absoluteOSlock/slotcoordination/nativeproof; giữ3D asset/engine, không sửaapp |
| QINT-R | Codex | reviewcontract/diff/logs, reconciliation và testacceptance; không claim app củaClaude |

Nếu nhánh own đang dirty: commit/checkpoint scope trước, nhánh tiếp nối riêng, ghi actualSHA; không reset/stash/overwrite. Không đồng thời chạy3D vàQwenCUDA. H-PC-017 PC-SAFE-008/AI-QUALITY-04 được tiếp nối trong QINT-G/P, không làm lại report cũ.

## Kiến trúc và contract phải thống nhất trước GPU integration

Tận dụng authenticated V2 API/durablequeue/workerregistry/privateStorage/lease/fencing/idempotency hiện có. PC **poll outbound HTTPS**, app không gọi thẳng IP nhà. Không public PC service/port/tunnel, không service-role trênbrowser. Existing worker assumes GLB/model jobs: không nhét JSON Qwen vào GLB path hoặc kích hoạt3Dcapability để lách. Claude thiết kế additive JSON-result jobpath trong cùng controlplane và tối thiểu sửa transport nếu cần; PC adapter/runtime riêng. Không viết worker auth/queue stack thứhai.

Claude xuất đề xuất machine-readable Qwen contract version1 cùng valid/invalidfixtures; PCQwen xác nhận exact producer→consumer conformance và PC3D xác nhận locking; Codex review trước first real integratedGPU. Trong lúc chờ, code/CPUtest/mockservice được làm ngay. Contract cần:
- Taskname/version riêng cho garment analysis, scoped allowlist trên server; heartbeat không tự cấp grant. Request bind owner/job/item/sourceVersion/imageSHA/modelrevision/policyrevision, bounded signedinputref, no arbitraryURL/path/command.
- Result identity và digests, category/color/pattern, unknown/abstention và evidence; rawOCR tách approvedtext. Tận dụng review-envelope.v2/human-confirmation.v1 PR7 làm **proposal**, không assume đã thànhwire. Input image không được dùng làm instruction/toolcall.
- Approvedvalues chỉ do authenticated human action, kiểm currentowner/source/tombstone/result/digest/confirmation replay và atomicupdate. Late result sau delete/versionchange/cancel không apply. Không nhận model field tự khai approved.
- Size/imagebounds/token/timebudget/strictschema/maxattempts (tái dùng192tokens/8192bytes/2schemaattempts nếu phù hợp, đo lại khi thay); malformed/unknownversion/OOM/memorypressure/modelunavailable/timeout/GPUbusy phân loại riêng. GPUbusy đợi boundedbackoff không tiêu inferenceattempt; không giả ready.
- Idempotency dedupe theo owner/item/sourcehash+model/policyrevision; cached approved result không reloadGPU, không mất user edits. Không tự bỏ lịch sử/look/cached3D hiện có. Credentials khônglog/git.

## GPU serialization bắt buộc — QINT-G + Claude transport + QINT-P

1. PC3D xử lý Q03-GUARD-01 finite/type/windowmetadata bằng nhánh riêng và nativeCPUtest, cả2PC ACK exactnewguardhash+absolute gpu0.lock path+byte0. SlotJSON chỉ là admissionmetadata; **OS lock là exclusion**. Không đủ chỉ thoả thuận giờ chạy hoặc kiểm VRAMfree.
2. Chốt **một lockowner** mỗiGPU execution. Nếu guard giữ lock thì worker gọi child qua guardedrunner không lấy lại cùnglock; nếu worker giữ lock thì không nestguard lấylock lần2. Ghi rõ placement; CPUtest phát hiện deadlock/nested/bypass.
3. PC-QUIESCENCE-01 phải được Claude sửa production transport trên nhánh QINT-C (scoped handoff mới này cấp quyền): giữ lock tới khi actual interpreter và mọi owned descendant đã exit, không chỉ Popenlauncher.poll. Windows JobObject containmentfailclosed, timeout/cancel/crash phải dọn ownedtree trước release; không killforeignprocess, PID identitycreationtime. Nếu không xác minh drain thì quarantineworker/không nhận job tiếp, giữ safety bằng owned containment; không fake release để queue tiến.
4. Qwen load **sau khi** lock+slot hợp lệ, recheckRAM/VRAM; không resident saujob. Release sau unload/ownedtreeexit; logGPUbaseline/peak/after và stage timestamps. Cùng quy tắc cho mọi3DCUDA/renderheavy entrypoint; CLI benchmark khôngbypassguard.
5. Không preempt đang chạy. Khi GPUbusy job chờ, leaseheartbeat maintained hoặc defer/requeue có fencing theo contract; không claim vôhạn nhiềujobs. FIFO/no starvation cơ bản; memoryadmission không đạt thì trạng thái retryable rõ, không load bất chấp. ViewerWebGL của người dùng không phải3DworkerGPUjob.

## Lệnh PC Qwen — QINT-P

Tiếp selectedquality02 runtime và quality03controller/schemas. Tạo adapter test dùng JSON schema doClaude publish, pinned modelrevision và existingre-shards; không newmodeldownload. CPUconformance/errorboundtests trước, rồi controlledloadedruntime timeout/pressureinjection theo H-PC-017 sauguardACK. Bàn giao runnable source+diff/hash, không chỉreport. Chỉ đăng ký Qwen capability trên testserver sau contract+guard/drainreview, scopedworkercredential qua privateconfig, không tự dùng productionproject. Thử licensedimagecase→result thật, unloadgiữđúnglock; phối hợp timestamp vớiPC3D. Không broadcorpus benchmark trước verticalslice. Lưu rawdiagnostics theo job binding, không dùng publicGit cho personalinputs/OCR; physicalcleanup receipts riêng, không tuyên bố clouddelete xóaPCcopy.

## Lệnh PC3D — QINT-G

Ưu tiên guardfix/newhash/ACK, cung cấp nativequiescenceharness choClaude. Chạy original18workerunit trên Claude final và newtransportrevision; thêm nativeactualinterpreter/grandchild tests. Cung cấp test3Dworkload an toàn đi qua **đúng shared runner**. Nếu compiler vẫnpause, dùng CPUdummy contention trước; có thể guarded smallBlenderGPUtask nếu supported và slot, ghi rõ chưaactualSiTH. Test đồng thời request3D+Qwen: chỉ1criticalGPUinterval; challenger khôngloadCUDA/model khi chưalock. Giữassets004/006, khôngtemplateiteration để trìhoãn integration.

## Lệnh Claude — QINT-C

Đọc PR6quiescence,PR7schemas và PR8ownreport; giữ521972e/2bfa6ad/0c8f936 cùng Codex92c..7be. Continue ownbranch từ d17ca355 descendant trên nhánh codex/qwen-app-test,actualreceipt. Đọc relevantNextdocs trước code. Làm theo thứ tự:
1. Productiondrainfix và regressions (P1, phối hợpPCnative), không nhầm test-onlylauncherfix đã đủ.
2. Minimalcontract+fixtures+appjob/resultstorage/API/registrygrants/migrations additive; không ràng buộc model job với GLB. Tận dụng existingqueue primitives; schema tiếp nhậnJSON và leasefence phải có negativecases.
3. Wardrobe button +progress/resultreview UI, humanconfirm từ ownsourceversion, rulesfallback và existing3ownedoutfits. Featureflag server-side OFF mặc định, enabled chỉ dedicatedtestconfig saugate; flagoff giữ luồngapp hiện có.
4. Testenvrunbook bootstrap auth/privateStorage/migrationorder/testworker enrollment/stop/rollback; tạo configexample khôngsecret. Chạy localCPUfixtures trước, giữ3Dregressions. Publish sourcebranch/diff/contracts qua existingworkflow đểPC đọc ngay; report receipt mỗi checkpoint, không đợi finaltoàngói.
5. Chạy test thật vớiPC sau contract/drainreview và dedicated testendpoint có sẵn; nếu chưa có HTTPS reachable testenv/privatecredentials, ghi blocker chính xác, tiếp tục CPU/localendtoend. Không tự mở publicport/deployproduction/migrateproject thật. Không báo integratedPASS từmock. Sourcecleanup/privacychanges PR8 chưa independentreview vẫn phải giữ và regressiontest.

## Tiêu chí nghiệm thu QINT-R

- Real Qwen trênPC trả đúng1licensedimage qua browser/API/queue/resultreview; source/job/model identities và exactcommits/hash được ghi. Có userconfirm lưumetadata đúngitem, không modelselfapproval.
-2testaccounts: foreignjob/image/result/confirm đều bịchặn; workerinputleastprivilege, publicstorageoff. Tombstone/versionchange/cancel/fencedlease/duplicateclaim/completionloss/idempotency kiểm DB/API thật, không chỉunit.
- GPUcontention cả2thứtựQwen→3D/3D→Qwen; timestamps/lock+PIDtree chứng minh khôngoverlap. MockCPU và actualGPU có nhãn riêng. Native timeout/launchercrash/childsurvival/lockrecovery; noforeignkill/noleakedresidentmodel.
- PCoffline/busy/memorygate UI phảnánh đúng, rules-v1 fallback dùngđược; cachedresult/reopen khônginfer lại. Thử ảnhambiguous/invalidschema/wrongversion/OCRunknown, không inventlogo.
- Unit/lint/build +DB/HTTP/browser phùhợp và nativeworker/adapterconformance; log commands/exits/sourceSHAs. Không build chồng nextstart khi chạybrowsertests.
- Evidence rawđãsanitize, RAM/VRAM/time, screenshot và lifecyclecleanuplimitations; realpersonalquality/3Dgates vẫn NOTVERIFIED.

## Bàn giao

Mỗi owner: STARTreceipt, baseline/branch/finalSHA, changedfiles, contract/guardhashACK, commands/exits/logs, mockvsreal, blockersvànextowner. Report/PR riêng; không merge/main/deploy. Codex reviewPASS/NEEDSCHANGES/NOTVERIFIED trước bật Qwen testcapability. Quyền user đã cấp là tích hợp chạy thử; không đòi hỏi hỏi lại quyền viếtcode/CPUtests, chỉ báo missingenvironment/credentials khi thực sự cần.
