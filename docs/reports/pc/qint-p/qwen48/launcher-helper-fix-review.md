# QWEN48 helper-only finally/deadline correction — pending root review

All execution GO remains inactive and all approvals remain OFF. No real worker, heartbeat, claim, model, native full probe or GPU was started while preparing this correction. The installed candidate runtime, 98-source manifest, config, transport, model and schema were not changed; the historical 99 CPU suite was not repeated.

Actual private helper raw SHA256: `06d5c57f82210bbf1c900a7ad381d1648dacf8e02fff834fa82c2e1f5b6d4e1d`.
Previous actual helper raw SHA256: `60d2079cdcb527f09bc0df7c79028713162853636bc47950b7bcf14f1c4db3bb`.
Sanitized LF source SHA256: `3e85994e51ae1d5b412f1ab72397e41e096def4ae6ba870ff4253337b0c0bae7`.

The public source replaces the literal machine root with `Path(os.environ['FITMATCH_GPU_ROOT'])` and normalizes CRLF to LF. Its hash intentionally differs from the actual private helper. Neither env/private JSON contents nor token values/digests or image data are included.

Approval activation, log open, Popen and observation now run within try/finally. Finally restores the exact original disabled approval bytes, records actual native wait states, then closes retained query handles. Disable/receipt/close failures are reported as QUARANTINE. No empty/missing/unknown observation is accepted as drain.

The observation deadline is 330s; starting requires a fresh 600s slot with at least 360s remaining. The unchanged transport engine240s/drain30s bounds remain authoritative. On deadline/error/live/unknown tree, this observer does not kill a process, release byte0, write/withdraw/renew a slot or retry. Coordinator/root must continue actual drain verification. Approval OFF is revocation, not proof of quiescence. Job0 and model unload are not independently claimed by this observer.

Invocation now requires `--go NEW_EXPLICIT_MAC_GO_ID` matching the actual active exact-job authorization receipt. The coordinator should issue the slot and then standby without a Python watcher: all non-ancestor Python/Blender processes remain refused, with no coordinator regex exemption.

Compile PASS. 13/13 focused CPU fixture tests PASS (0 failures/errors/skips, 0.174s); these do not establish real native/GPU proof. The actual helper invocation with closed GO-155 returned CPU_REFUSED/exit75 before any heartbeat/claim/GPU. Actual approvals, disabled approval hash, 98 source pins, config and manifest were verified unchanged after testing.

## Proof

```json
{
  "utc": "2026-11-13T14:39:29.859243+00:00",
  "state": "HELPER_ONLY_FIX_READY_FOR_ROOT_REVIEW;ALL_APPROVALS_OFF;NO_EXECUTION",
  "actualHelperRawSHA256": "06d5c57f82210bbf1c900a7ad381d1648dacf8e02fff834fa82c2e1f5b6d4e1d",
  "previousActualHelperRawSHA256": "60d2079cdcb527f09bc0df7c79028713162853636bc47950b7bcf14f1c4db3bb",
  "sanitizedLFSourceSHA256": "3e85994e51ae1d5b412f1ab72397e41e096def4ae6ba870ff4253337b0c0bae7",
  "focusedTestRawSHA256": "a5b0ca71786f3e135d82a66ac8313bcfb22845cc7bbf97eed7968c0ede868209",
  "compileHelperAndTestsPASS": true,
  "focusedCPUTests": {
    "run": 13,
    "passed": 13,
    "errors": 0,
    "failures": 0,
    "skips": 0,
    "seconds": 0.174,
    "fixtureOnlyNotNativeGPUProof": true
  },
  "actualClosedGO155CLIRefusal": {
    "exitCode": 75,
    "state": "CPU_REFUSED",
    "workerStarted": false,
    "claimGPUOrHeartbeatStarted": false
  },
  "outerObservationSeconds": 330,
  "minimumSlotRemainingSeconds": 360,
  "approvalOFFInFinally": true,
  "restoreOriginalApprovalBytes": true,
  "quarantineOnLiveUnknownDeadlineObserverOrIOError": true,
  "observerKillsReleasesOrWithdraws": false,
  "independentModelUnloadOrAnonymousJob0Claimed": false,
  "sourcePinsCount": 98,
  "sourcePinsAllMatch": true,
  "candidateConfigManifestUnchanged": true,
  "allApprovalsOFF": true,
  "oldGOInactive": true,
  "launchMarkerAbsent": true,
  "coordinatorMustIssueSlotThenStandbyWithoutPythonWatcher": true,
  "nextInvocationShape": "python -B execute-once-20261113.py --go NEW_EXPLICIT_MAC_GO_ID",
  "coordinatorSlotAndFreshBackendGORequired": true
}
```

## Helper diff

```diff
--- prepared-go155-helper.py
+++ helper-finally-deadline-fix.py
@@ -1,94 +1,404 @@
-from datetime import datetime,timezone
+"""One authorized transport start; observer never owns/releases GPU byte0 or kills processes."""
+import argparse
 import ctypes as C
 from ctypes import wintypes as W
-import hashlib,importlib.util,json,os,subprocess,sys,time
+from datetime import datetime, timezone
+import hashlib
+import importlib.util
+import json
+import os
 from pathlib import Path
+import subprocess
+import sys
+import time
 import psutil
-G=Path(os.environ['FITMATCH_GPU_ROOT']);P=G/'worker-data/qwen-pilot/private';Q=G/'coordination';OUT=G/'reports/ai/qint_p/qwen48'
-sys.path.insert(0,str(G/'ai-service/qint_p_qwen48'));import worker_admission as a
-JOB='7a7362b8-c134-4501-9e91-deef68dd0da2'
-def utc():return datetime.now(timezone.utc).isoformat()
-def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
-def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
-def save(p,d):Path(p).write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8')
-authorization=read(Q/'qint-p-qwen48-phase-b-execution-ready-20261113.json').get('executionAuthorization',{})
-assert authorization.get('active') is True and authorization.get('id')=='GO-155' and authorization.get('jobId')==JOB and authorization.get('maxStarts')==1, 'Require current GO-155 exact job authorization'
-ap=Q/'qint-worker-qwen48-approval.json';cp=P/'qwen48-worker.active.json';mp=P/'qwen48-runtime-manifest.json'
-assert sha(ap)=='4a8f39f3d6a3cbe3fd822943614bded7f2b3e2c0284bcd86c93f334e0ae2968b'
-assert sha(cp)=='643b8b47b6eac98e27083ff4ea86e971a8e9fc4a733ef293917cd610abfcef31'
-assert sha(mp)=='d79a0738e31f08e04de2fc41b8b825ef04e1f78732bcdaeae5ede3e58f383f0e'
-assert sha(a.__file__)=='bbbee7778eb8690fbaa9b0191d4acfea7d7e03cd0c9bdd8b3004bfa86a8b7b37'
-config,manifest,policy=read(cp),read(mp),read(ap)
-assert len(manifest['files'])==98 and all(sha(G/r['path'])==r['sha256'] for r in manifest['files'])
-assert policy['approved_job_id']==JOB and not policy['enabled']
-assert manifest['appRevision']==policy['app_revision']=='f58024703bf4ec8be365bee2f8b3e1bd2248fdec'
-assert sha(policy['transport_path'])=='ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6'
-assert config['engines']['garment.analyze']['revision']=='ebb281ec70b05090aa6165b016eac8ec08e71b17'
-assert not read(P/'qwen48-offline-approval.json')['enabled'] and not read(Q/'qint-test-approval.json')['enabled']
-a.validate_worker_config(config,policy);identity=a.coordinator_binding(policy)
-assert sha(a.GUARD)==a.GUARD_HASH
-spec=importlib.util.spec_from_file_location('execute_native_guard',a.GUARD);g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g);g.no_surviving_child()
-slot=read(Q/'gpu0-slot.json');now=time.time()
-assert now<authorization['notAfterUnix'], 'GO-155 expired at 14:00 UTC; fresh backend GO required'
-assert slot['owner']=='pc-ai' and slot['issuedAtUnix']>=authorization['minimumSlotIssuedUnix'] and 599<=slot['admitUntilUnix']-slot['issuedAtUnix']<=601
-assert 300<=slot['admitUntilUnix']-now<=600 and slot['issuedAtUnix']<=now+5
-g.validate_slot(slot,now)
-hb=read(Q/'qint-p-qwen48-heartbeat-only-20261113-1350.json')
-assert hb['gatePass'] and hb['HTTPstatus']==200 and hb['backendProjectRef']=='gohczmqykjkrgdblgbog' and hb['grantedCapabilities']==['garment.analyze']
-assert now-datetime.fromisoformat(hb['completedUTC']).timestamp()<1800
-native=[];ancestors={p.pid for p in psutil.Process().parents()}
-for proc in psutil.process_iter(['pid','name']):
- if proc.pid==os.getpid() or (proc.info['name'] or '').lower() not in ['python.exe','pythonw.exe','blender.exe','blender-launcher.exe']:continue
- stamp=g.live_stamp(proc.pid);args=proc.cmdline();exe=proc.exe();parent=proc.ppid();again=g.live_stamp(proc.pid)
- own=proc.pid in ancestors and any(Path(x)==Path(__file__) for x in args) and Path(exe)==G/'envs/qwen-vl/Scripts/python.exe'
- r={'pid':proc.pid,'nativeCreationFILETIME':stamp,'nativeRecheckFILETIME':again,'exe':exe,'parent':parent,'command':args if own else '<unreviewed command withheld>','exactOwnCPULauncher':own};native.append(r)
- assert own and stamp is not None and stamp==again,'Unreviewed GPU-capable process; do not launch'
-ram=psutil.virtual_memory().available
-v=subprocess.run(['nvidia-smi','--query-gpu=memory.free','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=15,check=True).stdout.strip();free=int(v.splitlines()[0])
-assert ram>=4294967296 and free>=8192
-plan=read(P/'connect45-worker.disabled.json');raw=(P/'connect45-worker.env').read_text(encoding='utf-8').strip();assert raw.startswith('FITMATCH_WORKER_TOKEN=');token=raw.split('=',1)[1]
-assert hashlib.sha256(token.encode()).hexdigest()==plan['tokenSHA256'];raw=None
-root=Path(config['workDir']);assert root.is_dir()
-for old in root.glob('jobs/*/checkpoint.json'):assert read(old).get('stage') in ['completed','failed','rejected'],'Unreviewed pending output'
-assert not (root/'jobs'/JOB).exists()
-marker=P/'qwen48-execute-once-20261113-attempt.json'
-with marker.open('x',encoding='utf-8') as f:json.dump({'utc':utc(),'jobId':JOB,'maxWorkerStarts':1,'slotSHA256':sha(Q/'gpu0-slot.json')},f)
-policy['enabled']=True;policy['reviews']['backend_preflight']='PASS';a.validate_policy(policy)
-save(ap,policy);approval_enabled=sha(ap)
-start={'utc':utc(),'state':'STARTING_EXACT_ONCE','executionGO':'GO-155','jobId':JOB,'workerApprovalSHA256':approval_enabled,'approvalChanges':['enabled false to true','reviews.backend_preflight PENDING to PASS backed by 13:51:59 heartbeat and fresh Mac DB GO-155'],'slotSHA256':sha(Q/'gpu0-slot.json'),'slotIssuedAtUTC':slot['issuedAtUtc'],'slotAdmitUntilUnix':slot['admitUntilUnix'],'RAMAvailableBytes':ram,'VRAMFreeMiB':free,'sourcePinsVerified':98,'canonicalLockIdentity':list(identity),'nativeCPULaunchers':native,'noExternalGuardOrOfflineApproval':True,'maxWorkerStarts':1}
-save(Q/'qint-p-qwen48-worker-start-20261113.json',start)
-env=os.environ.copy();env['FITMATCH_WORKER_TOKEN']=token;env['PYTHONDONTWRITEBYTECODE']='1';token=None
-handles={};records=[];k=g.CDLL if hasattr(g,'CDLL') else C.WinDLL('kernel32',use_last_error=True)
-k=C.WinDLL('kernel32',use_last_error=True);k.OpenProcess.argtypes=[W.DWORD,W.BOOL,W.DWORD];k.OpenProcess.restype=W.HANDLE;k.GetExitCodeProcess.argtypes=[W.HANDLE,C.POINTER(W.DWORD)];k.GetExitCodeProcess.restype=W.BOOL
-started=time.monotonic();samples=[]
-with (OUT/'worker-once-20261113.private.log').open('xb') as log:
- worker=subprocess.Popen([policy['transport_python_exe'],policy['transport_path'],'--config',str(cp),'--once'],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
- env.pop('FITMATCH_WORKER_TOKEN',None)
- start.update(workerPID=worker.pid,launchedUTC=utc());save(Q/'qint-p-qwen48-worker-start-20261113.json',start);print(json.dumps({'state':'WORKER_STARTED','pid':worker.pid,'approvalSHA256':approval_enabled,'slotIssuedAtUTC':slot['issuedAtUtc']}),flush=True)
- while True:
-  pids=[worker.pid]
-  try:pids += [p.pid for p in psutil.Process(worker.pid).children(recursive=True)]
-  except psutil.Error:pass
-  for pid in pids:
-   if pid in handles:continue
-   h=k.OpenProcess(0x1000|0x100000,False,pid)
-   if h:
-    try:stamp=g.stamp_handle(h)
-    except Exception:g.close(h);continue
-    handles[pid]=h;records.append({'pid':pid,'nativeCreationFILETIME':stamp,'handleRetainedBeforeExit':g.wait(h,0)!=0,'observedUTC':utc()})
-  checkpoint=root/'jobs'/JOB/'checkpoint.json';stage=read(checkpoint).get('stage') if checkpoint.exists() else None
-  samples.append({'utc':utc(),'RAMAvailableBytes':psutil.virtual_memory().available,'checkpointStage':stage,'liveRetainedHandles':sum(g.wait(h,0)!=0 for h in handles.values())})
-  save(Q/'qint-p-qwen48-worker-progress-20261113.json',{'utc':utc(),'workerPID':worker.pid,'stage':stage,'observedHandles':len(handles),'elapsedSeconds':round(time.monotonic()-started,2),'lastSample':samples[-1]})
-  if worker.poll() is not None:break
-  time.sleep(.2)
- exitcode=worker.wait()
-for r in records:
- h=handles[r['pid']];code=W.DWORD();ok=k.GetExitCodeProcess(h,C.byref(code));r.update(nativeHandleSignalledExited=g.wait(h,0)==0,exitCode=int(code.value) if ok else None);g.close(h)
-all_exit=all(r['nativeHandleSignalledExited'] for r in records)
-jobroot=root/'jobs'/JOB;checkpoint=read(jobroot/'checkpoint.json') if (jobroot/'checkpoint.json').exists() else {}
-results=list(jobroot.glob('a*/result.json'));result=read(results[-1]) if results else None
-summary={'utc':utc(),'jobId':JOB,'workerExitCode':exitcode,'seconds':round(time.monotonic()-started,3),'checkpointStage':checkpoint.get('stage'),'attempt':checkpoint.get('attempt'),'resultPresent':result is not None,'abstainReason':result.get('abstainReason') if result else None,'attributesNull':result.get('attributes') is None if result else None,'approvedForAutoApply':result.get('approvedForAutoApply') if result else None,'evidence':result.get('evidence') if result else None,'resultStatus':result.get('outcome') if result else None,'nativeProcessHandles':records,'allObservedHandlesExited':all_exit,'ownedLiveAtObserverEnd':sum(not r['nativeHandleSignalledExited'] for r in records),'minimumSampledRAMAvailableBytes':min(s['RAMAvailableBytes'] for s in samples),'externalGuardOrSlotWrite':False,'workerStarts':1,'claimRetriesByObserver':0,'transportDrainEvidence':'Normal worker return after reviewed transport per-adapter kernel Job activeProcesses==0 and retained-handle drain; observer did not separately query anonymous adapter Job','workerApprovalSHA256Enabled':approval_enabled,'workerApprovalDisabledAfterRun':False}
-if all_exit:
- policy['enabled']=False;save(ap,policy);summary.update(workerApprovalDisabledAfterRun=True,workerApprovalSHA256Disabled=sha(ap))
-save(Q/'qint-p-qwen48-worker-result-20261113.json',summary);save(OUT/'worker-result-20261113.json',summary)
-print(json.dumps(summary),flush=True)
+
+G = Path(os.environ['FITMATCH_GPU_ROOT'])
+Q = G / 'coordination'
+P = G / 'worker-data/qwen-pilot/private'
+OUT = G / 'reports/ai/qint_p/qwen48'
+JOB = '7a7362b8-c134-4501-9e91-deef68dd0da2'
+APP = 'f58024703bf4ec8be365bee2f8b3e1bd2248fdec'
+ADMISSION_SHA = 'bbbee7778eb8690fbaa9b0191d4acfea7d7e03cd0c9bdd8b3004bfa86a8b7b37'
+MANIFEST_SHA = 'd79a0738e31f08e04de2fc41b8b825ef04e1f78732bcdaeae5ede3e58f383f0e'
+CONFIG_SHA = '643b8b47b6eac98e27083ff4ea86e971a8e9fc4a733ef293917cd610abfcef31'
+APPROVAL_SHA = '4a8f39f3d6a3cbe3fd822943614bded7f2b3e2c0284bcd86c93f334e0ae2968b'
+TRANSPORT_SHA = 'ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6'
+GUARD_SHA = '47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c'
+MODEL = 'ebb281ec70b05090aa6165b016eac8ec08e71b17'
+OBSERVATION_SECONDS = 330
+MIN_SLOT_REMAINING = 360
+
+
+def utc():
+    return datetime.now(timezone.utc).isoformat()
+
+
+def sha(path):
+    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
+
+
+def read(path):
+    data = Path(path).read_bytes()
+    if len(data) > 1024 * 1024:
+        raise ValueError('Metadata exceeds bound')
+    return json.loads(data.decode('utf-8-sig'))
+
+
+def write_bytes(path, data):
+    # In-place write preserves the existing owner-only file ACL.
+    with Path(path).open('wb') as stream:
+        stream.write(data)
+        stream.flush()
+        os.fsync(stream.fileno())
+
+
+def save(path, value):
+    write_bytes(path, (json.dumps(value, indent=2) + '\n').encode('utf-8'))
+
+
+def validate_window(auth, slot, go, now):
+    if not (auth.get('active') is True and auth.get('id') == go
+            and auth.get('jobId') == JOB and auth.get('maxStarts') == 1
+            and now < auth['notAfterUnix']):
+        raise ValueError('No current exact-job execution GO')
+    if not (slot.get('owner') == 'pc-ai'
+            and slot['issuedAtUnix'] >= auth['minimumSlotIssuedUnix']
+            and slot['issuedAtUnix'] <= now + 5
+            and 599 <= slot['admitUntilUnix'] - slot['issuedAtUnix'] <= 601
+            and MIN_SLOT_REMAINING <= slot['admitUntilUnix'] - now <= 600):
+        raise ValueError('Require new 600s slot with at least 360s remaining')
+
+
+def preflight(go):
+    # Coordinator must issue the slot then standby WITHOUT a Python watcher.
+    # Every other Python/Blender process is refused; no coordinator-name exemption.
+    auth = read(Q / 'qint-p-qwen48-phase-b-execution-ready-20261113.json')['executionAuthorization']
+    slot = read(Q / 'gpu0-slot.json')
+    validate_window(auth, slot, go, time.time())
+    ap = Q / 'qint-worker-qwen48-approval.json'
+    cp = P / 'qwen48-worker.active.json'
+    mp = P / 'qwen48-runtime-manifest.json'
+    if (sha(ap), sha(cp), sha(mp)) != (APPROVAL_SHA, CONFIG_SHA, MANIFEST_SHA):
+        raise ValueError('Approval/config/manifest pin mismatch')
+    policy, config, manifest = read(ap), read(cp), read(mp)
+    if not (policy['approved_job_id'] == JOB and policy['enabled'] is False
+            and policy['app_revision'] == manifest['appRevision'] == APP
+            and len(manifest['files']) == 98
+            and all(sha(G / row['path']) == row['sha256'] for row in manifest['files'])
+            and sha(policy['transport_path']) == TRANSPORT_SHA
+            and config['engines']['garment.analyze']['revision'] == MODEL
+            and config['engines']['garment.analyze']['timeoutSeconds'] == 240
+            and config['engines']['garment.analyze']['drainSeconds'] == 30):
+        raise ValueError('Reviewed source/job/model/bounds mismatch')
+    if read(P / 'qwen48-offline-approval.json')['enabled'] or read(Q / 'qint-test-approval.json')['enabled']:
+        raise ValueError('Offline/external guard approval must remain OFF')
+    sys.path.insert(0, str(G / 'ai-service/qint_p_qwen48'))
+    import worker_admission as admission
+    if sha(admission.__file__) != ADMISSION_SHA or sha(admission.GUARD) != GUARD_SHA:
+        raise ValueError('Admission/guard pin mismatch')
+    admission.validate_worker_config(config, policy)
+    identity = admission.coordinator_binding(policy)
+    spec = importlib.util.spec_from_file_location('once_native_guard', admission.GUARD)
+    guard = importlib.util.module_from_spec(spec)
+    spec.loader.exec_module(guard)
+    guard.no_surviving_child()
+    guard.validate_slot(slot, time.time())
+    hb_name = auth['heartbeatReceipt']
+    if Path(hb_name).name != hb_name or not hb_name.startswith('qint-p-qwen48-heartbeat-only-'):
+        raise ValueError('Invalid heartbeat receipt reference')
+    hb = read(Q / hb_name)
+    age = time.time() - datetime.fromisoformat(hb['completedUTC']).timestamp()
+    if not (hb['gatePass'] and hb['HTTPstatus'] == 200 and 0 <= age <= 600
+            and hb['backendProjectRef'] == 'gohczmqykjkrgdblgbog'
+            and hb['grantedCapabilities'] == ['garment.analyze']
+            and hb['workerIdExpected'] == '8f1cc6bb-6446-4a7f-9d67-6144deba29be'
+            and hb['configSHA256'] == CONFIG_SHA and hb['runtimeManifestSHA256'] == MANIFEST_SHA):
+        raise ValueError('Fresh exact backend heartbeat required')
+    ancestors = {item.pid for item in psutil.Process().parents()}
+    native = []
+    for proc in psutil.process_iter(['pid', 'name']):
+        if proc.pid == os.getpid() or (proc.info['name'] or '').lower() not in {
+                'python.exe', 'pythonw.exe', 'blender.exe', 'blender-launcher.exe'}:
+            continue
+        stamp = guard.live_stamp(proc.pid)
+        args, exe, parent = proc.cmdline(), proc.exe(), proc.ppid()
+        again = guard.live_stamp(proc.pid)
+        own = (proc.pid in ancestors and Path(exe) == G / 'envs/qwen-vl/Scripts/python.exe'
+               and args[1:] == ['-B', str(Path(__file__)), '--go', go])
+        if not (own and stamp is not None and stamp == again):
+            raise ValueError('Unreviewed GPU-capable process; coordinator must standby')
+        native.append({'pid': proc.pid, 'creationFILETIME': stamp, 'recheckFILETIME': again,
+                       'exe': exe, 'parent': parent, 'command': args})
+    ram = psutil.virtual_memory().available
+    free = int(subprocess.run(['nvidia-smi', '--query-gpu=memory.free',
+               '--format=csv,noheader,nounits'], capture_output=True, text=True,
+               timeout=15, check=True).stdout.strip().splitlines()[0])
+    if ram < 4294967296 or free < 8192:
+        raise ValueError('RAM/VRAM below reviewed gates')
+    plan = read(P / 'connect45-worker.disabled.json')
+    raw = (P / 'connect45-worker.env').read_text(encoding='utf-8').strip()
+    if not raw.startswith('FITMATCH_WORKER_TOKEN='):
+        raise ValueError('Token file shape mismatch')
+    token = raw.split('=', 1)[1]
+    if hashlib.sha256(token.encode()).hexdigest() != plan['tokenSHA256']:
+        raise ValueError('Reserved token mismatch')
+    root = Path(config['workDir'])
+    if not root.is_dir() or (root / 'jobs' / JOB).exists():
+        raise ValueError('Existing exact-job attempt; no retry')
+    if any(read(old).get('stage') != 'completed' for old in root.glob('jobs/*/checkpoint.json')):
+        raise ValueError('Unreviewed pending output')
+    enabled = {**policy, 'enabled': True, 'reviews': {**policy['reviews'], 'backend_preflight': 'PASS'}}
+    admission.validate_policy(enabled)
+    # Freshly re-read GO and slot after IO/native/resource/token checks, before any activation.
+    current_auth = read(Q / 'qint-p-qwen48-phase-b-execution-ready-20261113.json')['executionAuthorization']
+    current_slot = read(Q / 'gpu0-slot.json')
+    validate_window(current_auth, current_slot, go, time.time())
+    if current_auth != auth or current_slot != slot or sha(ap) != APPROVAL_SHA:
+        raise ValueError('Execution binding changed during admission')
+    return {'go': go, 'policyPath': ap, 'originalApproval': ap.read_bytes(),
+            'enabledPolicy': enabled, 'root': root, 'token': token, 'slot': slot,
+            'configPath': cp, 'marker': P / 'qwen48-execute-once-20261113-attempt.json',
+            'logPath': OUT / 'worker-once-20261113.private.log',
+            'resultPath': Q / 'qint-p-qwen48-worker-result-20261113.json',
+            'progressPath': Q / 'qint-p-qwen48-worker-progress-20261113.json',
+            'startPath': Q / 'qint-p-qwen48-worker-start-20261113.json',
+            'RAMAvailableBytes': ram, 'VRAMFreeMiB': free, 'lockIdentity': list(identity),
+            'nativeCPULaunchers': native}
+
+
+class NativeObserver:
+    def __init__(self):
+        self.k = C.WinDLL('kernel32', use_last_error=True)
+        self.k.OpenProcess.argtypes = [W.DWORD, W.BOOL, W.DWORD]
+        self.k.OpenProcess.restype = W.HANDLE
+        self.k.GetProcessTimes.argtypes = [W.HANDLE] + [C.POINTER(W.FILETIME)] * 4
+        self.k.GetProcessTimes.restype = W.BOOL
+        self.k.WaitForSingleObject.argtypes = [W.HANDLE, W.DWORD]
+        self.k.WaitForSingleObject.restype = W.DWORD
+        self.k.GetExitCodeProcess.argtypes = [W.HANDLE, C.POINTER(W.DWORD)]
+        self.k.GetExitCodeProcess.restype = W.BOOL
+        self.k.CloseHandle.argtypes = [W.HANDLE]
+        self.k.CloseHandle.restype = W.BOOL
+        self.handles = {}
+        self.records = []
+        self.errors = []
+
+    def track(self, worker):
+        try:
+            root = psutil.Process(worker.pid)
+            candidates = [root] + root.children(recursive=True)
+        except psutil.NoSuchProcess:
+            if worker.poll() is not None and self.handles:
+                return
+            raise RuntimeError('Worker exited before native handle retention')
+        for proc in candidates:
+            expected = proc.create_time()
+            handle = self.k.OpenProcess(0x1000 | 0x100000, False, proc.pid)
+            if not handle:
+                self.errors.append({'pid': proc.pid, 'phase': 'OpenProcess', 'winerror': C.get_last_error()})
+                raise RuntimeError('Native process observation unresolved')
+            try:
+                values = [W.FILETIME() for _ in range(4)]
+                if not self.k.GetProcessTimes(handle, *(C.byref(v) for v in values)):
+                    raise C.WinError(C.get_last_error())
+                stamp = (values[0].dwHighDateTime << 32) | values[0].dwLowDateTime
+                if abs(stamp / 10000000 - 11644473600 - expected) > .00001:
+                    raise RuntimeError('PID creation identity changed')
+                key = (proc.pid, stamp)
+                if key not in self.handles:
+                    state = int(self.k.WaitForSingleObject(handle, 0))
+                    self.handles[key] = handle
+                    self.records.append({'pid': proc.pid, 'nativeCreationFILETIME': stamp,
+                                         'handleRetainedBeforeExit': state == 258, 'observedUTC': utc()})
+                    handle = None
+            finally:
+                if handle:
+                    self.k.CloseHandle(handle)
+
+    def snapshot(self):
+        records = []
+        unknown = len(self.errors)
+        for record in self.records:
+            row = dict(record)
+            h = self.handles[(row['pid'], row['nativeCreationFILETIME'])]
+            state = int(self.k.WaitForSingleObject(h, 0))
+            code = W.DWORD()
+            ok = self.k.GetExitCodeProcess(h, C.byref(code))
+            row.update(nativeWaitResult=state, nativeHandleSignalledExited=state == 0,
+                       exitCode=int(code.value) if ok else None)
+            if state not in (0, 258) or not ok:
+                unknown += 1
+            records.append(row)
+        return {'records': records, 'unknownCount': unknown,
+                'liveCount': sum(not r['nativeHandleSignalledExited'] for r in records),
+                'allObservedExited': bool(records) and unknown == 0
+                    and all(r['nativeHandleSignalledExited'] for r in records),
+                'observationErrors': list(self.errors)}
+
+    def close(self):
+        errors = []
+        for key, handle in list(self.handles.items()):
+            try:
+                if not self.k.CloseHandle(handle):
+                    errors.append({'pid': key[0], 'winerror': C.get_last_error()})
+            except BaseException as error:
+                errors.append({'pid': key[0], 'errorType': type(error).__name__})
+        self.handles.clear()
+        return errors
+
+
+def read_outcome(root):
+    checkpoint = root / 'jobs' / JOB / 'checkpoint.json'
+    cp = read(checkpoint) if checkpoint.exists() else {}
+    paths = sorted((root / 'jobs' / JOB).glob('a*/result.json'))
+    result = read(paths[-1]) if paths else {}
+    # Never include attributes, OCR, raw output/hash, image, lease or private input.
+    return {'checkpointStage': cp.get('stage'), 'attempt': cp.get('attempt'),
+            'resultPresent': bool(result), 'resultStatus': result.get('outcome'),
+            'abstainReason': result.get('abstainReason'),
+            'attributesNull': result.get('attributes') is None if result else None,
+            'approvedForAutoApply': result.get('approvedForAutoApply'),
+            'evidence': {k: result.get('evidence', {}).get(k)
+                         for k in ('attempts', 'outputTokens', 'durationMs', 'gpuMiB')}}
+
+
+def run_once(plan):
+    """No retry/kill/GPU-lock release/slot write, including exception/deadline paths."""
+    result = {'utc': utc(), 'executionGO': plan['go'], 'jobId': JOB,
+              'state': 'START_NOT_ATTEMPTED', 'workerStarts': 0,
+              'outerObservationSeconds': OBSERVATION_SECONDS,
+              'automaticRetry': False, 'observerKilledProcess': False,
+              'observerReleasedGPULock': False, 'observerWroteSlot': False,
+              'anonymousAdapterJobIndependentlyQueried': False,
+              'modelUnloadedIndependentlyVerified': False,
+              'requiresIndependentCoordinatorDrainAndWithdraw': True}
+    worker = native = log = None
+    env = {}
+    started = time.monotonic()
+    deadline = min(started + OBSERVATION_SECONDS,
+                   started + plan['slot']['admitUntilUnix'] - time.time() - 30)
+    minimum_ram = None
+    marker_created = False
+    try:
+        # Rechecking here makes the observation deadline meaningful even for delayed callers.
+        if plan['slot']['admitUntilUnix'] - time.time() < MIN_SLOT_REMAINING:
+            raise ValueError('Slot too short before activation')
+        with plan['marker'].open('x', encoding='utf-8') as stream:
+            json.dump({'utc': utc(), 'executionGO': plan['go'], 'jobId': JOB, 'maxWorkerStarts': 1}, stream)
+        marker_created = True
+        native = NativeObserver()
+        save(plan['policyPath'], plan['enabledPolicy'])
+        result['workerApprovalSHA256Enabled'] = sha(plan['policyPath'])
+        result['approvalChanges'] = ['enabled false to true', 'backend_preflight PENDING to PASS from current reviewed heartbeat/GO']
+        log = plan['logPath'].open('xb')
+        env = os.environ.copy()
+        env['FITMATCH_WORKER_TOKEN'] = plan['token']
+        env['PYTHONDONTWRITEBYTECODE'] = '1'
+        policy = plan['enabledPolicy']
+        worker = subprocess.Popen([policy['transport_python_exe'], policy['transport_path'],
+                  '--config', str(plan['configPath']), '--once'], cwd=plan['root'],
+                  env=env, stdout=log, stderr=subprocess.STDOUT)
+        result.update(workerStarts=1, workerPID=worker.pid, launchedUTC=utc(), state='OBSERVING')
+        env.pop('FITMATCH_WORKER_TOKEN', None)
+        plan['token'] = None
+        save(plan['startPath'], {**result, 'RAMAvailableBytes': plan['RAMAvailableBytes'],
+             'VRAMFreeMiB': plan['VRAMFreeMiB'], 'slot': plan['slot'], 'sourcePinsVerified': 98,
+             'canonicalLockIdentity': plan['lockIdentity'], 'nativeCPULaunchers': plan['nativeCPULaunchers']})
+        print(json.dumps({'state': 'WORKER_STARTED', 'pid': worker.pid,
+                          'executionGO': plan['go'], 'approvalSHA256': result['workerApprovalSHA256Enabled']}), flush=True)
+        while True:
+            if time.monotonic() >= deadline:
+                result.update(state='QUARANTINE', failure='outer_observation_deadline')
+                break
+            native.track(worker)
+            snapshot = native.snapshot()
+            if snapshot['unknownCount']:
+                raise RuntimeError('Native wait/exit state unresolved')
+            available = psutil.virtual_memory().available
+            minimum_ram = available if minimum_ram is None else min(minimum_ram, available)
+            save(plan['progressPath'], {'utc': utc(), 'workerPID': worker.pid,
+                 'elapsedSeconds': round(time.monotonic() - started, 3),
+                 'observedHandles': len(snapshot['records']), 'liveCount': snapshot['liveCount'],
+                 'unknownCount': snapshot['unknownCount'], 'RAMAvailableBytes': available})
+            code = worker.poll()
+            if code is not None:
+                result.update(workerExitCode=code, **read_outcome(plan['root']))
+                result['state'] = 'WORKER_EXITED_AWAIT_NATIVE_FINAL_SNAPSHOT'
+                break
+            time.sleep(.2)
+    except BaseException as error:
+        result.update(state='QUARANTINE' if worker is not None else 'START_FAILED_NO_WORKER',
+                      failure=type(error).__name__)
+    finally:
+        env.pop('FITMATCH_WORKER_TOKEN', None)
+        plan['token'] = None
+        # Always attempt OFF, even on Popen/IO/observer exceptions and live/unknown trees.
+        # OFF is revocation, not evidence that a worker drained or a slot may be withdrawn.
+        try:
+            write_bytes(plan['policyPath'], plan['originalApproval'])
+            result['workerApprovalOFF'] = read(plan['policyPath']).get('enabled') is False
+            result['workerApprovalSHA256Disabled'] = sha(plan['policyPath'])
+        except BaseException as error:
+            result.update(workerApprovalOFF=False, approvalDisableError=type(error).__name__, state='QUARANTINE')
+        try:
+            snapshot = native.snapshot() if native is not None else {
+                'records': [], 'unknownCount': 1 if worker is not None else 0,
+                'liveCount': 0, 'allObservedExited': False, 'observationErrors': []}
+            result['nativeFinalSnapshot'] = snapshot
+            if worker is not None:
+                result['workerExitCode'] = worker.poll()
+                if not snapshot['allObservedExited'] or result['workerExitCode'] is None:
+                    result['state'] = 'QUARANTINE'
+                elif result['state'] == 'WORKER_EXITED_AWAIT_NATIVE_FINAL_SNAPSHOT':
+                    result['state'] = 'WORKER_EXITED_OBSERVED_NATIVE_DRAIN'
+                    result['transportDrainPathReturned'] = result['workerExitCode'] == 0
+        except BaseException as error:
+            result.update(state='QUARANTINE', nativeSnapshotError=type(error).__name__)
+        result.update(utc=utc(), seconds=round(time.monotonic() - started, 3),
+                      minimumSampledRAMAvailableBytes=minimum_ram, singleStartMarkerConsumed=marker_created)
+        close_errors = []
+        try:
+            # Record actual wait states before closing our query/synchronize handles.
+            save(plan['resultPath'], result)
+        except BaseException as error:
+            result.update(state='QUARANTINE', receiptWriteError=type(error).__name__)
+            print(json.dumps(result), flush=True)  # Bounded secret-free fallback receipt before close.
+        finally:
+            try:
+                if native is not None:
+                    close_errors.extend(native.close() or [])
+            except BaseException as error:
+                close_errors.append({'nativeCloseError': type(error).__name__})
+            finally:
+                try:
+                    if log is not None:
+                        log.close()
+                except BaseException as error:
+                    close_errors.append({'logCloseError': type(error).__name__})
+        if close_errors:
+            result.update(state='QUARANTINE', observerCloseErrors=close_errors)
+            try:
+                save(plan['resultPath'], result)
+            except BaseException as error:
+                result['finalReceiptWriteError'] = type(error).__name__
+    print(json.dumps(result), flush=True)
+    return result
+
+
+def main():
+    parser = argparse.ArgumentParser(description=__doc__)
+    parser.add_argument('--go', required=True, help='Exact NEW active Mac execution GO identifier')
+    args = parser.parse_args()
+    try:
+        plan = preflight(args.go)
+    except Exception as error:
+        print(json.dumps({'state': 'CPU_REFUSED', 'errorType': type(error).__name__,
+                          'workerStarted': False, 'claimGPUOrHeartbeatStarted': False}))
+        return 75
+    result = run_once(plan)
+    return 0 if result['state'] == 'WORKER_EXITED_OBSERVED_NATIVE_DRAIN' and result.get('workerExitCode') == 0 else 75
+
+
+if __name__ == '__main__':
+    raise SystemExit(main())
```

## Full sanitized helper source

```python
"""One authorized transport start; observer never owns/releases GPU byte0 or kills processes."""
import argparse
import ctypes as C
from ctypes import wintypes as W
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import psutil

G = Path(os.environ['FITMATCH_GPU_ROOT'])
Q = G / 'coordination'
P = G / 'worker-data/qwen-pilot/private'
OUT = G / 'reports/ai/qint_p/qwen48'
JOB = '7a7362b8-c134-4501-9e91-deef68dd0da2'
APP = 'f58024703bf4ec8be365bee2f8b3e1bd2248fdec'
ADMISSION_SHA = 'bbbee7778eb8690fbaa9b0191d4acfea7d7e03cd0c9bdd8b3004bfa86a8b7b37'
MANIFEST_SHA = 'd79a0738e31f08e04de2fc41b8b825ef04e1f78732bcdaeae5ede3e58f383f0e'
CONFIG_SHA = '643b8b47b6eac98e27083ff4ea86e971a8e9fc4a733ef293917cd610abfcef31'
APPROVAL_SHA = '4a8f39f3d6a3cbe3fd822943614bded7f2b3e2c0284bcd86c93f334e0ae2968b'
TRANSPORT_SHA = 'ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6'
GUARD_SHA = '47331c56dfabb09e9eb714fdb933de6b789be6195ccfc50d3040b800ae99d61c'
MODEL = 'ebb281ec70b05090aa6165b016eac8ec08e71b17'
OBSERVATION_SECONDS = 330
MIN_SLOT_REMAINING = 360


def utc():
    return datetime.now(timezone.utc).isoformat()


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    data = Path(path).read_bytes()
    if len(data) > 1024 * 1024:
        raise ValueError('Metadata exceeds bound')
    return json.loads(data.decode('utf-8-sig'))


def write_bytes(path, data):
    # In-place write preserves the existing owner-only file ACL.
    with Path(path).open('wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def save(path, value):
    write_bytes(path, (json.dumps(value, indent=2) + '\n').encode('utf-8'))


def validate_window(auth, slot, go, now):
    if not (auth.get('active') is True and auth.get('id') == go
            and auth.get('jobId') == JOB and auth.get('maxStarts') == 1
            and now < auth['notAfterUnix']):
        raise ValueError('No current exact-job execution GO')
    if not (slot.get('owner') == 'pc-ai'
            and slot['issuedAtUnix'] >= auth['minimumSlotIssuedUnix']
            and slot['issuedAtUnix'] <= now + 5
            and 599 <= slot['admitUntilUnix'] - slot['issuedAtUnix'] <= 601
            and MIN_SLOT_REMAINING <= slot['admitUntilUnix'] - now <= 600):
        raise ValueError('Require new 600s slot with at least 360s remaining')


def preflight(go):
    # Coordinator must issue the slot then standby WITHOUT a Python watcher.
    # Every other Python/Blender process is refused; no coordinator-name exemption.
    auth = read(Q / 'qint-p-qwen48-phase-b-execution-ready-20261113.json')['executionAuthorization']
    slot = read(Q / 'gpu0-slot.json')
    validate_window(auth, slot, go, time.time())
    ap = Q / 'qint-worker-qwen48-approval.json'
    cp = P / 'qwen48-worker.active.json'
    mp = P / 'qwen48-runtime-manifest.json'
    if (sha(ap), sha(cp), sha(mp)) != (APPROVAL_SHA, CONFIG_SHA, MANIFEST_SHA):
        raise ValueError('Approval/config/manifest pin mismatch')
    policy, config, manifest = read(ap), read(cp), read(mp)
    if not (policy['approved_job_id'] == JOB and policy['enabled'] is False
            and policy['app_revision'] == manifest['appRevision'] == APP
            and len(manifest['files']) == 98
            and all(sha(G / row['path']) == row['sha256'] for row in manifest['files'])
            and sha(policy['transport_path']) == TRANSPORT_SHA
            and config['engines']['garment.analyze']['revision'] == MODEL
            and config['engines']['garment.analyze']['timeoutSeconds'] == 240
            and config['engines']['garment.analyze']['drainSeconds'] == 30):
        raise ValueError('Reviewed source/job/model/bounds mismatch')
    if read(P / 'qwen48-offline-approval.json')['enabled'] or read(Q / 'qint-test-approval.json')['enabled']:
        raise ValueError('Offline/external guard approval must remain OFF')
    sys.path.insert(0, str(G / 'ai-service/qint_p_qwen48'))
    import worker_admission as admission
    if sha(admission.__file__) != ADMISSION_SHA or sha(admission.GUARD) != GUARD_SHA:
        raise ValueError('Admission/guard pin mismatch')
    admission.validate_worker_config(config, policy)
    identity = admission.coordinator_binding(policy)
    spec = importlib.util.spec_from_file_location('once_native_guard', admission.GUARD)
    guard = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(guard)
    guard.no_surviving_child()
    guard.validate_slot(slot, time.time())
    hb_name = auth['heartbeatReceipt']
    if Path(hb_name).name != hb_name or not hb_name.startswith('qint-p-qwen48-heartbeat-only-'):
        raise ValueError('Invalid heartbeat receipt reference')
    hb = read(Q / hb_name)
    age = time.time() - datetime.fromisoformat(hb['completedUTC']).timestamp()
    if not (hb['gatePass'] and hb['HTTPstatus'] == 200 and 0 <= age <= 600
            and hb['backendProjectRef'] == 'gohczmqykjkrgdblgbog'
            and hb['grantedCapabilities'] == ['garment.analyze']
            and hb['workerIdExpected'] == '8f1cc6bb-6446-4a7f-9d67-6144deba29be'
            and hb['configSHA256'] == CONFIG_SHA and hb['runtimeManifestSHA256'] == MANIFEST_SHA):
        raise ValueError('Fresh exact backend heartbeat required')
    ancestors = {item.pid for item in psutil.Process().parents()}
    native = []
    for proc in psutil.process_iter(['pid', 'name']):
        if proc.pid == os.getpid() or (proc.info['name'] or '').lower() not in {
                'python.exe', 'pythonw.exe', 'blender.exe', 'blender-launcher.exe'}:
            continue
        stamp = guard.live_stamp(proc.pid)
        args, exe, parent = proc.cmdline(), proc.exe(), proc.ppid()
        again = guard.live_stamp(proc.pid)
        own = (proc.pid in ancestors and Path(exe) == G / 'envs/qwen-vl/Scripts/python.exe'
               and args[1:] == ['-B', str(Path(__file__)), '--go', go])
        if not (own and stamp is not None and stamp == again):
            raise ValueError('Unreviewed GPU-capable process; coordinator must standby')
        native.append({'pid': proc.pid, 'creationFILETIME': stamp, 'recheckFILETIME': again,
                       'exe': exe, 'parent': parent, 'command': args})
    ram = psutil.virtual_memory().available
    free = int(subprocess.run(['nvidia-smi', '--query-gpu=memory.free',
               '--format=csv,noheader,nounits'], capture_output=True, text=True,
               timeout=15, check=True).stdout.strip().splitlines()[0])
    if ram < 4294967296 or free < 8192:
        raise ValueError('RAM/VRAM below reviewed gates')
    plan = read(P / 'connect45-worker.disabled.json')
    raw = (P / 'connect45-worker.env').read_text(encoding='utf-8').strip()
    if not raw.startswith('FITMATCH_WORKER_TOKEN='):
        raise ValueError('Token file shape mismatch')
    token = raw.split('=', 1)[1]
    if hashlib.sha256(token.encode()).hexdigest() != plan['tokenSHA256']:
        raise ValueError('Reserved token mismatch')
    root = Path(config['workDir'])
    if not root.is_dir() or (root / 'jobs' / JOB).exists():
        raise ValueError('Existing exact-job attempt; no retry')
    if any(read(old).get('stage') != 'completed' for old in root.glob('jobs/*/checkpoint.json')):
        raise ValueError('Unreviewed pending output')
    enabled = {**policy, 'enabled': True, 'reviews': {**policy['reviews'], 'backend_preflight': 'PASS'}}
    admission.validate_policy(enabled)
    # Freshly re-read GO and slot after IO/native/resource/token checks, before any activation.
    current_auth = read(Q / 'qint-p-qwen48-phase-b-execution-ready-20261113.json')['executionAuthorization']
    current_slot = read(Q / 'gpu0-slot.json')
    validate_window(current_auth, current_slot, go, time.time())
    if current_auth != auth or current_slot != slot or sha(ap) != APPROVAL_SHA:
        raise ValueError('Execution binding changed during admission')
    return {'go': go, 'policyPath': ap, 'originalApproval': ap.read_bytes(),
            'enabledPolicy': enabled, 'root': root, 'token': token, 'slot': slot,
            'configPath': cp, 'marker': P / 'qwen48-execute-once-20261113-attempt.json',
            'logPath': OUT / 'worker-once-20261113.private.log',
            'resultPath': Q / 'qint-p-qwen48-worker-result-20261113.json',
            'progressPath': Q / 'qint-p-qwen48-worker-progress-20261113.json',
            'startPath': Q / 'qint-p-qwen48-worker-start-20261113.json',
            'RAMAvailableBytes': ram, 'VRAMFreeMiB': free, 'lockIdentity': list(identity),
            'nativeCPULaunchers': native}


class NativeObserver:
    def __init__(self):
        self.k = C.WinDLL('kernel32', use_last_error=True)
        self.k.OpenProcess.argtypes = [W.DWORD, W.BOOL, W.DWORD]
        self.k.OpenProcess.restype = W.HANDLE
        self.k.GetProcessTimes.argtypes = [W.HANDLE] + [C.POINTER(W.FILETIME)] * 4
        self.k.GetProcessTimes.restype = W.BOOL
        self.k.WaitForSingleObject.argtypes = [W.HANDLE, W.DWORD]
        self.k.WaitForSingleObject.restype = W.DWORD
        self.k.GetExitCodeProcess.argtypes = [W.HANDLE, C.POINTER(W.DWORD)]
        self.k.GetExitCodeProcess.restype = W.BOOL
        self.k.CloseHandle.argtypes = [W.HANDLE]
        self.k.CloseHandle.restype = W.BOOL
        self.handles = {}
        self.records = []
        self.errors = []

    def track(self, worker):
        try:
            root = psutil.Process(worker.pid)
            candidates = [root] + root.children(recursive=True)
        except psutil.NoSuchProcess:
            if worker.poll() is not None and self.handles:
                return
            raise RuntimeError('Worker exited before native handle retention')
        for proc in candidates:
            expected = proc.create_time()
            handle = self.k.OpenProcess(0x1000 | 0x100000, False, proc.pid)
            if not handle:
                self.errors.append({'pid': proc.pid, 'phase': 'OpenProcess', 'winerror': C.get_last_error()})
                raise RuntimeError('Native process observation unresolved')
            try:
                values = [W.FILETIME() for _ in range(4)]
                if not self.k.GetProcessTimes(handle, *(C.byref(v) for v in values)):
                    raise C.WinError(C.get_last_error())
                stamp = (values[0].dwHighDateTime << 32) | values[0].dwLowDateTime
                if abs(stamp / 10000000 - 11644473600 - expected) > .00001:
                    raise RuntimeError('PID creation identity changed')
                key = (proc.pid, stamp)
                if key not in self.handles:
                    state = int(self.k.WaitForSingleObject(handle, 0))
                    self.handles[key] = handle
                    self.records.append({'pid': proc.pid, 'nativeCreationFILETIME': stamp,
                                         'handleRetainedBeforeExit': state == 258, 'observedUTC': utc()})
                    handle = None
            finally:
                if handle:
                    self.k.CloseHandle(handle)

    def snapshot(self):
        records = []
        unknown = len(self.errors)
        for record in self.records:
            row = dict(record)
            h = self.handles[(row['pid'], row['nativeCreationFILETIME'])]
            state = int(self.k.WaitForSingleObject(h, 0))
            code = W.DWORD()
            ok = self.k.GetExitCodeProcess(h, C.byref(code))
            row.update(nativeWaitResult=state, nativeHandleSignalledExited=state == 0,
                       exitCode=int(code.value) if ok else None)
            if state not in (0, 258) or not ok:
                unknown += 1
            records.append(row)
        return {'records': records, 'unknownCount': unknown,
                'liveCount': sum(not r['nativeHandleSignalledExited'] for r in records),
                'allObservedExited': bool(records) and unknown == 0
                    and all(r['nativeHandleSignalledExited'] for r in records),
                'observationErrors': list(self.errors)}

    def close(self):
        errors = []
        for key, handle in list(self.handles.items()):
            try:
                if not self.k.CloseHandle(handle):
                    errors.append({'pid': key[0], 'winerror': C.get_last_error()})
            except BaseException as error:
                errors.append({'pid': key[0], 'errorType': type(error).__name__})
        self.handles.clear()
        return errors


def read_outcome(root):
    checkpoint = root / 'jobs' / JOB / 'checkpoint.json'
    cp = read(checkpoint) if checkpoint.exists() else {}
    paths = sorted((root / 'jobs' / JOB).glob('a*/result.json'))
    result = read(paths[-1]) if paths else {}
    # Never include attributes, OCR, raw output/hash, image, lease or private input.
    return {'checkpointStage': cp.get('stage'), 'attempt': cp.get('attempt'),
            'resultPresent': bool(result), 'resultStatus': result.get('outcome'),
            'abstainReason': result.get('abstainReason'),
            'attributesNull': result.get('attributes') is None if result else None,
            'approvedForAutoApply': result.get('approvedForAutoApply'),
            'evidence': {k: result.get('evidence', {}).get(k)
                         for k in ('attempts', 'outputTokens', 'durationMs', 'gpuMiB')}}


def run_once(plan):
    """No retry/kill/GPU-lock release/slot write, including exception/deadline paths."""
    result = {'utc': utc(), 'executionGO': plan['go'], 'jobId': JOB,
              'state': 'START_NOT_ATTEMPTED', 'workerStarts': 0,
              'outerObservationSeconds': OBSERVATION_SECONDS,
              'automaticRetry': False, 'observerKilledProcess': False,
              'observerReleasedGPULock': False, 'observerWroteSlot': False,
              'anonymousAdapterJobIndependentlyQueried': False,
              'modelUnloadedIndependentlyVerified': False,
              'requiresIndependentCoordinatorDrainAndWithdraw': True}
    worker = native = log = None
    env = {}
    started = time.monotonic()
    deadline = min(started + OBSERVATION_SECONDS,
                   started + plan['slot']['admitUntilUnix'] - time.time() - 30)
    minimum_ram = None
    marker_created = False
    try:
        # Rechecking here makes the observation deadline meaningful even for delayed callers.
        if plan['slot']['admitUntilUnix'] - time.time() < MIN_SLOT_REMAINING:
            raise ValueError('Slot too short before activation')
        with plan['marker'].open('x', encoding='utf-8') as stream:
            json.dump({'utc': utc(), 'executionGO': plan['go'], 'jobId': JOB, 'maxWorkerStarts': 1}, stream)
        marker_created = True
        native = NativeObserver()
        save(plan['policyPath'], plan['enabledPolicy'])
        result['workerApprovalSHA256Enabled'] = sha(plan['policyPath'])
        result['approvalChanges'] = ['enabled false to true', 'backend_preflight PENDING to PASS from current reviewed heartbeat/GO']
        log = plan['logPath'].open('xb')
        env = os.environ.copy()
        env['FITMATCH_WORKER_TOKEN'] = plan['token']
        env['PYTHONDONTWRITEBYTECODE'] = '1'
        policy = plan['enabledPolicy']
        worker = subprocess.Popen([policy['transport_python_exe'], policy['transport_path'],
                  '--config', str(plan['configPath']), '--once'], cwd=plan['root'],
                  env=env, stdout=log, stderr=subprocess.STDOUT)
        result.update(workerStarts=1, workerPID=worker.pid, launchedUTC=utc(), state='OBSERVING')
        env.pop('FITMATCH_WORKER_TOKEN', None)
        plan['token'] = None
        save(plan['startPath'], {**result, 'RAMAvailableBytes': plan['RAMAvailableBytes'],
             'VRAMFreeMiB': plan['VRAMFreeMiB'], 'slot': plan['slot'], 'sourcePinsVerified': 98,
             'canonicalLockIdentity': plan['lockIdentity'], 'nativeCPULaunchers': plan['nativeCPULaunchers']})
        print(json.dumps({'state': 'WORKER_STARTED', 'pid': worker.pid,
                          'executionGO': plan['go'], 'approvalSHA256': result['workerApprovalSHA256Enabled']}), flush=True)
        while True:
            if time.monotonic() >= deadline:
                result.update(state='QUARANTINE', failure='outer_observation_deadline')
                break
            native.track(worker)
            snapshot = native.snapshot()
            if snapshot['unknownCount']:
                raise RuntimeError('Native wait/exit state unresolved')
            available = psutil.virtual_memory().available
            minimum_ram = available if minimum_ram is None else min(minimum_ram, available)
            save(plan['progressPath'], {'utc': utc(), 'workerPID': worker.pid,
                 'elapsedSeconds': round(time.monotonic() - started, 3),
                 'observedHandles': len(snapshot['records']), 'liveCount': snapshot['liveCount'],
                 'unknownCount': snapshot['unknownCount'], 'RAMAvailableBytes': available})
            code = worker.poll()
            if code is not None:
                result.update(workerExitCode=code, **read_outcome(plan['root']))
                result['state'] = 'WORKER_EXITED_AWAIT_NATIVE_FINAL_SNAPSHOT'
                break
            time.sleep(.2)
    except BaseException as error:
        result.update(state='QUARANTINE' if worker is not None else 'START_FAILED_NO_WORKER',
                      failure=type(error).__name__)
    finally:
        env.pop('FITMATCH_WORKER_TOKEN', None)
        plan['token'] = None
        # Always attempt OFF, even on Popen/IO/observer exceptions and live/unknown trees.
        # OFF is revocation, not evidence that a worker drained or a slot may be withdrawn.
        try:
            write_bytes(plan['policyPath'], plan['originalApproval'])
            result['workerApprovalOFF'] = read(plan['policyPath']).get('enabled') is False
            result['workerApprovalSHA256Disabled'] = sha(plan['policyPath'])
        except BaseException as error:
            result.update(workerApprovalOFF=False, approvalDisableError=type(error).__name__, state='QUARANTINE')
        try:
            snapshot = native.snapshot() if native is not None else {
                'records': [], 'unknownCount': 1 if worker is not None else 0,
                'liveCount': 0, 'allObservedExited': False, 'observationErrors': []}
            result['nativeFinalSnapshot'] = snapshot
            if worker is not None:
                result['workerExitCode'] = worker.poll()
                if not snapshot['allObservedExited'] or result['workerExitCode'] is None:
                    result['state'] = 'QUARANTINE'
                elif result['state'] == 'WORKER_EXITED_AWAIT_NATIVE_FINAL_SNAPSHOT':
                    result['state'] = 'WORKER_EXITED_OBSERVED_NATIVE_DRAIN'
                    result['transportDrainPathReturned'] = result['workerExitCode'] == 0
        except BaseException as error:
            result.update(state='QUARANTINE', nativeSnapshotError=type(error).__name__)
        result.update(utc=utc(), seconds=round(time.monotonic() - started, 3),
                      minimumSampledRAMAvailableBytes=minimum_ram, singleStartMarkerConsumed=marker_created)
        close_errors = []
        try:
            # Record actual wait states before closing our query/synchronize handles.
            save(plan['resultPath'], result)
        except BaseException as error:
            result.update(state='QUARANTINE', receiptWriteError=type(error).__name__)
            print(json.dumps(result), flush=True)  # Bounded secret-free fallback receipt before close.
        finally:
            try:
                if native is not None:
                    close_errors.extend(native.close() or [])
            except BaseException as error:
                close_errors.append({'nativeCloseError': type(error).__name__})
            finally:
                try:
                    if log is not None:
                        log.close()
                except BaseException as error:
                    close_errors.append({'logCloseError': type(error).__name__})
        if close_errors:
            result.update(state='QUARANTINE', observerCloseErrors=close_errors)
            try:
                save(plan['resultPath'], result)
            except BaseException as error:
                result['finalReceiptWriteError'] = type(error).__name__
    print(json.dumps(result), flush=True)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--go', required=True, help='Exact NEW active Mac execution GO identifier')
    args = parser.parse_args()
    try:
        plan = preflight(args.go)
    except Exception as error:
        print(json.dumps({'state': 'CPU_REFUSED', 'errorType': type(error).__name__,
                          'workerStarted': False, 'claimGPUOrHeartbeatStarted': False}))
        return 75
    result = run_once(plan)
    return 0 if result['state'] == 'WORKER_EXITED_OBSERVED_NATIVE_DRAIN' and result.get('workerExitCode') == 0 else 75


if __name__ == '__main__':
    raise SystemExit(main())
```

## Focused CPU fixture source

```python
"""Focused CPU fixtures only: no network/model/native process probe or production approval writes."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('once_helper_under_test', HERE / 'execute-once-20261113.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Worker:
    pid = 123456
    def __init__(self, code=None): self.code = code
    def poll(self): return self.code
    def kill(self): raise AssertionError('Observer must never kill')
    def terminate(self): raise AssertionError('Observer must never terminate')


class Clock:
    value = 0
    def monotonic(self): return self.value
    def sleep(self, _): self.value += 200


class HelperTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.original = b'{"enabled": false, "reviews": {"backend_preflight": "PENDING"}}\n'
        ap = self.root / 'approval.json'; ap.write_bytes(self.original)
        self.plan = {'go':'GO-TEST', 'policyPath':ap, 'originalApproval':self.original,
            'enabledPolicy':{'enabled':True, 'reviews':{'backend_preflight':'PASS'},
                             'transport_python_exe':'unused-python', 'transport_path':'unused-worker'},
            'root':self.root, 'token':'cpu-fixture-placeholder', 'slot':{'admitUntilUnix':1600},
            'configPath':self.root/'config.json','marker':self.root/'once.json',
            'logPath':self.root/'private.log','resultPath':self.root/'result.json',
            'progressPath':self.root/'progress.json','startPath':self.root/'start.json',
            'RAMAvailableBytes':5000000000,'VRAMFreeMiB':11000,
            'lockIdentity':[1,2],'nativeCPULaunchers':[]}
        self.closed = False
        self.snapshot = {'records':[{'pid':123456,'nativeHandleSignalledExited':False}],
                         'unknownCount':0,'liveCount':1,'allObservedExited':False,'observationErrors':[]}
        outer = self
        class Native:
            def track(self, worker): pass
            def snapshot(self): return outer.snapshot
            def close(self):
                # Native wait state must be written before retained handles are closed.
                record = json.loads(outer.plan['resultPath'].read_text())
                assert record['nativeFinalSnapshot'] == outer.snapshot
                outer.closed = True
        self.Native = Native

    def run_fixture(self, popen, native=None, save=None):
        clock = Clock()
        with contextlib.ExitStack() as stack:
            stack.enter_context(patch.object(m,'NativeObserver',native or self.Native))
            stack.enter_context(patch.object(m.subprocess,'Popen',side_effect=popen))
            stack.enter_context(patch.object(m.time,'time',return_value=1000))
            stack.enter_context(patch.object(m.time,'monotonic',side_effect=clock.monotonic))
            stack.enter_context(patch.object(m.time,'sleep',side_effect=clock.sleep))
            stack.enter_context(patch.object(m.psutil,'virtual_memory',return_value=type('RAM',(),{'available':5000000000})()))
            stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
            if save is not None: stack.enter_context(patch.object(m,'save',side_effect=save))
            result=m.run_once(self.plan)
        self.assertEqual(self.plan['policyPath'].read_bytes(),self.original)
        self.assertTrue(result['workerApprovalOFF'])
        self.assertFalse(result['observerKilledProcess'])
        self.assertFalse(result['observerReleasedGPULock'])
        self.assertFalse(result['observerWroteSlot'])
        self.assertFalse(result['modelUnloadedIndependentlyVerified'])
        self.assertIsNone(self.plan['token'])
        return result

    def factory(self, worker):
        def start(command, **kwargs):
            self.assertTrue(json.loads(self.plan['policyPath'].read_text())['enabled'])
            self.assertEqual(command[-1],'--once')
            return worker
        return start

    def test_popen_failure_always_restores_off_and_closes_after_record(self):
        def fail(*args, **kwargs):
            self.assertTrue(json.loads(self.plan['policyPath'].read_text())['enabled'])
            raise OSError('CPU fixture')
        result=self.run_fixture(fail)
        self.assertEqual(result['state'],'START_FAILED_NO_WORKER')
        self.assertEqual(result['workerStarts'],0)
        self.assertTrue(self.closed)
        self.assertTrue(self.plan['marker'].exists())

    def test_deadline_live_tree_is_quarantine_no_kill_retry_or_release(self):
        result=self.run_fixture(self.factory(Worker()))
        self.assertEqual(result['state'],'QUARANTINE')
        self.assertEqual(result['failure'],'outer_observation_deadline')
        self.assertEqual(result['workerStarts'],1)
        self.assertEqual(result['nativeFinalSnapshot']['liveCount'],1)
        self.assertFalse(result['automaticRetry'])
        self.assertTrue(self.closed)

    def test_observer_exception_live_worker_is_quarantine_and_off(self):
        outer=self
        class Broken(self.Native):
            def track(self, worker): raise RuntimeError('CPU fixture unknown')
        result=self.run_fixture(self.factory(Worker()),Broken)
        self.assertEqual(result['state'],'QUARANTINE')
        self.assertEqual(result['failure'],'RuntimeError')
        self.assertTrue(self.closed)

    def test_unknown_native_state_never_becomes_drain_pass(self):
        self.snapshot.update(unknownCount=1)
        result=self.run_fixture(self.factory(Worker()))
        self.assertEqual(result['state'],'QUARANTINE')
        self.assertFalse(result['nativeFinalSnapshot']['allObservedExited'])

    def test_empty_native_set_never_becomes_drain_pass(self):
        self.snapshot.update(records=[],liveCount=0,allObservedExited=False)
        result=self.run_fixture(self.factory(Worker(0)))
        self.assertEqual(result['state'],'QUARANTINE')
        self.assertTrue(self.closed)

    def test_progress_io_error_after_start_keeps_live_tree_quarantined(self):
        original_save=m.save
        def write(path,value):
            if path==self.plan['progressPath']: raise OSError('CPU fixture IO')
            original_save(path,value)
        result=self.run_fixture(self.factory(Worker()),save=write)
        self.assertEqual(result['state'],'QUARANTINE')
        self.assertEqual(result['failure'],'OSError')
        self.assertTrue(self.closed)

    def test_completed_observed_handles_still_do_not_claim_independent_job_or_unload(self):
        self.snapshot.update(records=[{'pid':123456,'nativeHandleSignalledExited':True}],liveCount=0,allObservedExited=True)
        result=self.run_fixture(self.factory(Worker(0)))
        self.assertEqual(result['state'],'WORKER_EXITED_OBSERVED_NATIVE_DRAIN')
        self.assertTrue(result['transportDrainPathReturned'])
        self.assertFalse(result['anonymousAdapterJobIndependentlyQueried'])
        self.assertFalse(result['modelUnloadedIndependentlyVerified'])

    def test_slot_short_before_activation_consumes_no_marker_or_start(self):
        self.plan['slot']['admitUntilUnix']=1359
        result=self.run_fixture(lambda *args,**kwargs:self.fail('Popen forbidden'))
        self.assertEqual(result['workerStarts'],0)
        self.assertFalse(self.plan['marker'].exists())
        self.assertFalse(self.closed)

    def test_duplicate_marker_cannot_start_again(self):
        self.plan['marker'].write_text('existing consumed marker')
        result=self.run_fixture(lambda *args,**kwargs:self.fail('Popen forbidden'))
        self.assertEqual(result['workerStarts'],0)
        self.assertEqual(self.plan['marker'].read_text(),'existing consumed marker')

    def test_close_error_is_recorded_as_quarantine_after_off(self):
        outer=self
        class CloseError(self.Native):
            def close(self):
                super().close()
                raise OSError('CPU fixture close failure')
        self.snapshot.update(records=[{'pid':123456,'nativeHandleSignalledExited':True}],liveCount=0,allObservedExited=True)
        result=self.run_fixture(self.factory(Worker(0)),CloseError)
        self.assertEqual(result['state'],'QUARANTINE')
        self.assertTrue(result['observerCloseErrors'])
        self.assertTrue(self.closed)

    def test_activation_write_error_still_restores_original_off(self):
        original_save=m.save
        def write(path,value):
            if path==self.plan['policyPath']: raise OSError('CPU fixture activation IO')
            original_save(path,value)
        result=self.run_fixture(lambda *args,**kwargs:self.fail('Popen forbidden'),save=write)
        self.assertEqual(result['state'],'START_FAILED_NO_WORKER')
        self.assertEqual(result['workerStarts'],0)
        self.assertTrue(self.closed)

    def test_real_snapshot_empty_set_is_not_pass_without_native_calls(self):
        obj=object.__new__(m.NativeObserver)
        obj.records=[];obj.errors=[];obj.handles={}
        self.assertFalse(obj.snapshot()['allObservedExited'])

    def test_window_refuses_closed_wrong_job_old_slot_and_short_remainder(self):
        auth={'active':True,'id':'GO-TEST','jobId':m.JOB,'maxStarts':1,'notAfterUnix':2000,'minimumSlotIssuedUnix':1000}
        slot={'owner':'pc-ai','issuedAtUnix':1000,'admitUntilUnix':1600}
        m.validate_window(auth,slot,'GO-TEST',1240)
        bad_cases=[({**auth,'active':False},slot,'GO-TEST',1240),
          ({**auth,'jobId':'wrong'},slot,'GO-TEST',1240),
          (auth,{**slot,'issuedAtUnix':999},'GO-TEST',1240),
          (auth,slot,'WRONG-GO',1240),(auth,slot,'GO-TEST',1241),
          ({**auth,'notAfterUnix':1240},slot,'GO-TEST',1240)]
        for args in bad_cases:
            with self.subTest(args=args),self.assertRaises(ValueError):m.validate_window(*args)


if __name__=='__main__':unittest.main(verbosity=2)
```
