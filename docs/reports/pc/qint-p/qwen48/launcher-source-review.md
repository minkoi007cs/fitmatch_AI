# QWEN48 one-run launcher: read-only source review

Execution remains closed. This is the current prepared helper, not an approved executable revision. Candidate runtime, transport, model, schema, config and 98-source manifest were not changed. Historical 99/99 CPU checks do not test this external observer helper.

Actual private launcher raw SHA256: `60d2079cdcb527f09bc0df7c79028713162853636bc47950b7bcf14f1c4db3bb`.

Sanitized source SHA256 (UTF-8, below): `14e3ff77339fc9dfada626cc5d4a59cb2e5b39f93e1610ed33c3c9cb4fbf7815`. The only source transformation replaces the literal machine root with `Path(os.environ['FITMATCH_GPU_ROOT'])`; no private env or JSON contents are included. The sanitized representation has a different hash and is for review only.

Review findings before another execution window:

- Approval disable is not in a try/finally. Exceptions after enabling (log open, Popen, checkpoint read or receipt write) can leave approval enabled.
- The observer loop has no independent timeout or failure/quarantine reporting path. Engine 240s and drain 30s come from the unchanged transport config; forcing worker termination would risk losing lock ownership while descendants survive.
- Failed OpenProcess/stamp observations are skipped. An empty observed set passes all(...), so this helper must not claim complete native drain from that condition.
- Anonymous adapter Job0 is checked inside reviewed transport; this observer does not query that Job independently. It does not directly verify model cleanup/unload, and a successful process exit alone is not a separate unload measurement.
- GO-155, its 14:00 deadline and the 13:51 heartbeat are historical hardcoded bindings. The actual authorization receipt is inactive. A fresh reviewed binding is required before any later launch.

```python
from datetime import datetime,timezone
import ctypes as C
from ctypes import wintypes as W
import hashlib,importlib.util,json,os,subprocess,sys,time
from pathlib import Path
import psutil
G=Path(os.environ['FITMATCH_GPU_ROOT']);P=G/'worker-data/qwen-pilot/private';Q=G/'coordination';OUT=G/'reports/ai/qint_p/qwen48'
sys.path.insert(0,str(G/'ai-service/qint_p_qwen48'));import worker_admission as a
JOB='7a7362b8-c134-4501-9e91-deef68dd0da2'
def utc():return datetime.now(timezone.utc).isoformat()
def sha(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(p):return json.loads(Path(p).read_text(encoding='utf-8-sig'))
def save(p,d):Path(p).write_text(json.dumps(d,indent=2)+'\n',encoding='utf-8')
authorization=read(Q/'qint-p-qwen48-phase-b-execution-ready-20261113.json').get('executionAuthorization',{})
assert authorization.get('active') is True and authorization.get('id')=='GO-155' and authorization.get('jobId')==JOB and authorization.get('maxStarts')==1, 'Require current GO-155 exact job authorization'
ap=Q/'qint-worker-qwen48-approval.json';cp=P/'qwen48-worker.active.json';mp=P/'qwen48-runtime-manifest.json'
assert sha(ap)=='4a8f39f3d6a3cbe3fd822943614bded7f2b3e2c0284bcd86c93f334e0ae2968b'
assert sha(cp)=='643b8b47b6eac98e27083ff4ea86e971a8e9fc4a733ef293917cd610abfcef31'
assert sha(mp)=='d79a0738e31f08e04de2fc41b8b825ef04e1f78732bcdaeae5ede3e58f383f0e'
assert sha(a.__file__)=='bbbee7778eb8690fbaa9b0191d4acfea7d7e03cd0c9bdd8b3004bfa86a8b7b37'
config,manifest,policy=read(cp),read(mp),read(ap)
assert len(manifest['files'])==98 and all(sha(G/r['path'])==r['sha256'] for r in manifest['files'])
assert policy['approved_job_id']==JOB and not policy['enabled']
assert manifest['appRevision']==policy['app_revision']=='f58024703bf4ec8be365bee2f8b3e1bd2248fdec'
assert sha(policy['transport_path'])=='ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6'
assert config['engines']['garment.analyze']['revision']=='ebb281ec70b05090aa6165b016eac8ec08e71b17'
assert not read(P/'qwen48-offline-approval.json')['enabled'] and not read(Q/'qint-test-approval.json')['enabled']
a.validate_worker_config(config,policy);identity=a.coordinator_binding(policy)
assert sha(a.GUARD)==a.GUARD_HASH
spec=importlib.util.spec_from_file_location('execute_native_guard',a.GUARD);g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g);g.no_surviving_child()
slot=read(Q/'gpu0-slot.json');now=time.time()
assert now<authorization['notAfterUnix'], 'GO-155 expired at 14:00 UTC; fresh backend GO required'
assert slot['owner']=='pc-ai' and slot['issuedAtUnix']>=authorization['minimumSlotIssuedUnix'] and 599<=slot['admitUntilUnix']-slot['issuedAtUnix']<=601
assert 300<=slot['admitUntilUnix']-now<=600 and slot['issuedAtUnix']<=now+5
g.validate_slot(slot,now)
hb=read(Q/'qint-p-qwen48-heartbeat-only-20261113-1350.json')
assert hb['gatePass'] and hb['HTTPstatus']==200 and hb['backendProjectRef']=='gohczmqykjkrgdblgbog' and hb['grantedCapabilities']==['garment.analyze']
assert now-datetime.fromisoformat(hb['completedUTC']).timestamp()<1800
native=[];ancestors={p.pid for p in psutil.Process().parents()}
for proc in psutil.process_iter(['pid','name']):
 if proc.pid==os.getpid() or (proc.info['name'] or '').lower() not in ['python.exe','pythonw.exe','blender.exe','blender-launcher.exe']:continue
 stamp=g.live_stamp(proc.pid);args=proc.cmdline();exe=proc.exe();parent=proc.ppid();again=g.live_stamp(proc.pid)
 own=proc.pid in ancestors and any(Path(x)==Path(__file__) for x in args) and Path(exe)==G/'envs/qwen-vl/Scripts/python.exe'
 r={'pid':proc.pid,'nativeCreationFILETIME':stamp,'nativeRecheckFILETIME':again,'exe':exe,'parent':parent,'command':args if own else '<unreviewed command withheld>','exactOwnCPULauncher':own};native.append(r)
 assert own and stamp is not None and stamp==again,'Unreviewed GPU-capable process; do not launch'
ram=psutil.virtual_memory().available
v=subprocess.run(['nvidia-smi','--query-gpu=memory.free','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=15,check=True).stdout.strip();free=int(v.splitlines()[0])
assert ram>=4294967296 and free>=8192
plan=read(P/'connect45-worker.disabled.json');raw=(P/'connect45-worker.env').read_text(encoding='utf-8').strip();assert raw.startswith('FITMATCH_WORKER_TOKEN=');token=raw.split('=',1)[1]
assert hashlib.sha256(token.encode()).hexdigest()==plan['tokenSHA256'];raw=None
root=Path(config['workDir']);assert root.is_dir()
for old in root.glob('jobs/*/checkpoint.json'):assert read(old).get('stage') in ['completed','failed','rejected'],'Unreviewed pending output'
assert not (root/'jobs'/JOB).exists()
marker=P/'qwen48-execute-once-20261113-attempt.json'
with marker.open('x',encoding='utf-8') as f:json.dump({'utc':utc(),'jobId':JOB,'maxWorkerStarts':1,'slotSHA256':sha(Q/'gpu0-slot.json')},f)
policy['enabled']=True;policy['reviews']['backend_preflight']='PASS';a.validate_policy(policy)
save(ap,policy);approval_enabled=sha(ap)
start={'utc':utc(),'state':'STARTING_EXACT_ONCE','executionGO':'GO-155','jobId':JOB,'workerApprovalSHA256':approval_enabled,'approvalChanges':['enabled false to true','reviews.backend_preflight PENDING to PASS backed by 13:51:59 heartbeat and fresh Mac DB GO-155'],'slotSHA256':sha(Q/'gpu0-slot.json'),'slotIssuedAtUTC':slot['issuedAtUtc'],'slotAdmitUntilUnix':slot['admitUntilUnix'],'RAMAvailableBytes':ram,'VRAMFreeMiB':free,'sourcePinsVerified':98,'canonicalLockIdentity':list(identity),'nativeCPULaunchers':native,'noExternalGuardOrOfflineApproval':True,'maxWorkerStarts':1}
save(Q/'qint-p-qwen48-worker-start-20261113.json',start)
env=os.environ.copy();env['FITMATCH_WORKER_TOKEN']=token;env['PYTHONDONTWRITEBYTECODE']='1';token=None
handles={};records=[];k=g.CDLL if hasattr(g,'CDLL') else C.WinDLL('kernel32',use_last_error=True)
k=C.WinDLL('kernel32',use_last_error=True);k.OpenProcess.argtypes=[W.DWORD,W.BOOL,W.DWORD];k.OpenProcess.restype=W.HANDLE;k.GetExitCodeProcess.argtypes=[W.HANDLE,C.POINTER(W.DWORD)];k.GetExitCodeProcess.restype=W.BOOL
started=time.monotonic();samples=[]
with (OUT/'worker-once-20261113.private.log').open('xb') as log:
 worker=subprocess.Popen([policy['transport_python_exe'],policy['transport_path'],'--config',str(cp),'--once'],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT)
 env.pop('FITMATCH_WORKER_TOKEN',None)
 start.update(workerPID=worker.pid,launchedUTC=utc());save(Q/'qint-p-qwen48-worker-start-20261113.json',start);print(json.dumps({'state':'WORKER_STARTED','pid':worker.pid,'approvalSHA256':approval_enabled,'slotIssuedAtUTC':slot['issuedAtUtc']}),flush=True)
 while True:
  pids=[worker.pid]
  try:pids += [p.pid for p in psutil.Process(worker.pid).children(recursive=True)]
  except psutil.Error:pass
  for pid in pids:
   if pid in handles:continue
   h=k.OpenProcess(0x1000|0x100000,False,pid)
   if h:
    try:stamp=g.stamp_handle(h)
    except Exception:g.close(h);continue
    handles[pid]=h;records.append({'pid':pid,'nativeCreationFILETIME':stamp,'handleRetainedBeforeExit':g.wait(h,0)!=0,'observedUTC':utc()})
  checkpoint=root/'jobs'/JOB/'checkpoint.json';stage=read(checkpoint).get('stage') if checkpoint.exists() else None
  samples.append({'utc':utc(),'RAMAvailableBytes':psutil.virtual_memory().available,'checkpointStage':stage,'liveRetainedHandles':sum(g.wait(h,0)!=0 for h in handles.values())})
  save(Q/'qint-p-qwen48-worker-progress-20261113.json',{'utc':utc(),'workerPID':worker.pid,'stage':stage,'observedHandles':len(handles),'elapsedSeconds':round(time.monotonic()-started,2),'lastSample':samples[-1]})
  if worker.poll() is not None:break
  time.sleep(.2)
 exitcode=worker.wait()
for r in records:
 h=handles[r['pid']];code=W.DWORD();ok=k.GetExitCodeProcess(h,C.byref(code));r.update(nativeHandleSignalledExited=g.wait(h,0)==0,exitCode=int(code.value) if ok else None);g.close(h)
all_exit=all(r['nativeHandleSignalledExited'] for r in records)
jobroot=root/'jobs'/JOB;checkpoint=read(jobroot/'checkpoint.json') if (jobroot/'checkpoint.json').exists() else {}
results=list(jobroot.glob('a*/result.json'));result=read(results[-1]) if results else None
summary={'utc':utc(),'jobId':JOB,'workerExitCode':exitcode,'seconds':round(time.monotonic()-started,3),'checkpointStage':checkpoint.get('stage'),'attempt':checkpoint.get('attempt'),'resultPresent':result is not None,'abstainReason':result.get('abstainReason') if result else None,'attributesNull':result.get('attributes') is None if result else None,'approvedForAutoApply':result.get('approvedForAutoApply') if result else None,'evidence':result.get('evidence') if result else None,'resultStatus':result.get('outcome') if result else None,'nativeProcessHandles':records,'allObservedHandlesExited':all_exit,'ownedLiveAtObserverEnd':sum(not r['nativeHandleSignalledExited'] for r in records),'minimumSampledRAMAvailableBytes':min(s['RAMAvailableBytes'] for s in samples),'externalGuardOrSlotWrite':False,'workerStarts':1,'claimRetriesByObserver':0,'transportDrainEvidence':'Normal worker return after reviewed transport per-adapter kernel Job activeProcesses==0 and retained-handle drain; observer did not separately query anonymous adapter Job','workerApprovalSHA256Enabled':approval_enabled,'workerApprovalDisabledAfterRun':False}
if all_exit:
 policy['enabled']=False;save(ap,policy);summary.update(workerApprovalDisabledAfterRun=True,workerApprovalSHA256Disabled=sha(ap))
save(Q/'qint-p-qwen48-worker-result-20261113.json',summary);save(OUT/'worker-result-20261113.json',summary)
print(json.dumps(summary),flush=True)
```
