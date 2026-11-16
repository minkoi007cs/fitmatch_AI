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
spec = importlib.util.spec_from_file_location('once_helper_under_test', HERE / 'execute-once-20261116.py')
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
            'transportArgv':['unused-python','unused-worker','--config',str(self.root/'config.json'),'--once'],
            'engineCommandTemplate':['env-python','worker_cli.py','--input','{input}','--output','{output}','--policy','approval.json'],
            'basePythonExe':'unused-python','observerPID':4321,
            'logPath':self.root/'private.log','resultPath':self.root/'result.json',
            'progressPath':self.root/'progress.json','startPath':self.root/'start.json',
            'RAMAvailableBytes':5000000000,'VRAMFreeMiB':11000,
            'lockIdentity':[1,2],'nativeCPULaunchers':[]}
        self.closed = False
        self.snapshot = {'records':[{'pid':123456,'nativeHandleSignalledExited':False}],
                         'unknownCount':0,'liveCount':1,'allObservedExited':False,'observationErrors':[]}
        outer = self
        class Native:
            def __init__(self, plan): pass
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

    def test_exit0_handles_without_completed_binding_do_not_prove_drain_path(self):
        self.snapshot.update(records=[{'pid':123456,'nativeHandleSignalledExited':True}],liveCount=0,allObservedExited=True)
        result=self.run_fixture(self.factory(Worker(0)))
        self.assertEqual(result['state'],'WORKER_EXITED_OBSERVED_NATIVE_DRAIN')
        self.assertFalse(result['transportDrainPathReturned'])
        self.assertFalse(result['controlFlowDrainAudit']['localProducerEvidenceComplete'])
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

    def test_exact_worker_and_adapter_roles_reject_wrong_job_and_never_copy_unknown_argv(self):
        worker_args=self.plan['transportArgv']
        worker=m.process_role(self.plan,10,4321,'unused-python',worker_args,10)
        self.assertTrue(worker['isWorker'])
        self.assertFalse(m.process_role(self.plan,10,9999,'unused-python',worker_args,10)['isWorker'])
        attempt=self.root/'jobs'/m.JOB/'a1-01234567'
        engine=[v.replace('{input}',str(attempt/'input.json')).replace('{output}',str(attempt/'result.json'))
                for v in self.plan['engineCommandTemplate']]
        launcher=m.process_role(self.plan,20,10,'env-python',engine,10)
        actual=m.process_role(self.plan,30,20,'unused-python',engine,10)
        self.assertEqual(launcher['argvRole'],'adapter_launcher')
        self.assertEqual(actual['argvRole'],'adapter_interpreter')
        self.assertEqual(actual['observedAttemptDir'],'a1-01234567')
        bad=list(engine);bad[3]=str(self.root/'jobs'/'wrong-job'/'a1-01234567'/'input.json')
        self.assertFalse(m.process_role(self.plan,30,20,'unused-python',bad,10)['isAdapter'])
        bad=list(engine);bad[2]='cpu-fixture-secret-must-not-be-copied'
        role=m.process_role(self.plan,30,20,'unused-python',bad,10)
        self.assertNotIn('cpu-fixture-secret-must-not-be-copied',json.dumps(role))
        self.assertIsNone(role['matchedArgv'])

    def test_inferring_adapter_pid_is_preserved_when_completed_checkpoint_clears_it(self):
        jobroot=self.root/'jobs'/m.JOB;attempt='a1-01234567';(jobroot/attempt).mkdir(parents=True)
        cp={'jobId':m.JOB,'kind':'garment.analyze','modelRevision':{'model':'Qwen/Qwen3-VL-4B-Instruct','revision':m.MODEL},
            'attempt':1,'instance':'01234567-89ab-4cde-8fab-0123456789ab','attemptDir':attempt,
            'stage':'inferring','adapterPid':20,'updatedAt':1001}
        path=jobroot/'checkpoint.json';path.write_text(json.dumps(cp))
        m.checkpoint_view(self.plan)
        out=jobroot/attempt/'result.json';out.write_bytes(b'{"outcome":"abstained"}')
        cp.update(stage='completed',adapterPid=None,completedAt=1010,
                  output={'file':attempt+'/result.json','bytes':out.stat().st_size,'sha256':m.sha(out),'format':'json-v1'})
        path.write_text(json.dumps(cp));completed=m.completed_binding(self.plan)
        self.assertEqual(self.plan['inferringCheckpointObservation']['adapterPid'],20)
        self.assertIsNone(completed['adapterPid'])
        self.assertTrue(completed['checkpointOutputMatchesActualFile'])
        self.assertNotIn('sha256',json.dumps(completed))
        self.assertNotIn('leaseToken',json.dumps(completed))

    def test_control_flow_producer_requires_bound_native_roles_and_same_attempt_not_any_two_pids(self):
        import copy
        stamp=116444736000000000
        worker={'pid':10,'nativeCreationFILETIME':stamp,'isWorker':True,'nativeHandleSignalledExited':True,
                'argvMatchesPinned':True,'argvRole':'worker','nativeWaitResult':0}
        launcher={'pid':20,'nativeCreationFILETIME':stamp+10000000,'isAdapter':True,
            'observedParentPID':10,'observedParentCreationFILETIME':stamp,'observedAttemptDir':'a1-01234567','nativeHandleSignalledExited':True,'argvMatchesPinned':True,'nativeWaitResult':0}
        actual={'pid':30,'nativeCreationFILETIME':stamp+20000000,'isAdapter':True,
            'observedParentPID':20,'observedParentCreationFILETIME':stamp+10000000,'observedAttemptDir':'a1-01234567','nativeHandleSignalledExited':True,'argvMatchesPinned':True,'nativeWaitResult':0}
        binding={'jobId':m.JOB,'kind':'garment.analyze','modelRevision':{'model':'Qwen/Qwen3-VL-4B-Instruct','revision':m.MODEL},
                 'attempt':1,'instance':'01234567-89ab-4cde-8fab-0123456789ab','attemptDir':'a1-01234567'}
        self.plan.update(slotSHA256='cpu-fixture-slot',
            prelaunchBinding={'targetDirectoryAbsent':True,'jobId':m.JOB,'executionGO':'GO-TEST','slotSHA256':'cpu-fixture-slot'},
            inferringCheckpointObservation={**binding,'stage':'inferring','adapterPid':20})
        result={'workerPID':10,'workerStarts':1,'workerExitCode':0,'workerApprovalOFF':True,'singleStartMarkerConsumed':True,
                'state':'WORKER_EXITED_OBSERVED_NATIVE_DRAIN',
                'privateCompletedCheckpointBinding':{**binding,'stage':'completed','checkpointOutputMatchesActualFile':True},
                'privateAdmissionIdentityBinding':{'worker_pid':10,'worker_creation_time':0,'actual_pid':30,'actual_creation_time':2,'placement':'worker_owns_byte0'},
                'nativeFinalSnapshot':{'records':[worker,launcher,actual],'allObservedExited':True,'unknownCount':0}}
        proof=m.control_flow_audit(self.plan,result)
        self.assertTrue(proof['localProducerEvidenceComplete'])
        self.assertFalse(proof['counterIndependentlyRecorded'])
        self.assertFalse(proof['modelPythonUnloadCallbackExported'])
        self.assertEqual(proof['canonicalServerResultVerification'],'PENDING_MAC_INDEPENDENT_CHECK')
        for mutation in ['wrong_parent_creation','wrong_attempt','wrong_actual_pid','arbitrary_pids','no_inferring','unmatched_argv','nonsignalled_record']:
            plan=copy.deepcopy(self.plan);changed=copy.deepcopy(result)
            if mutation=='wrong_parent_creation':changed['nativeFinalSnapshot']['records'][2]['observedParentCreationFILETIME']=1
            if mutation=='wrong_attempt':changed['privateCompletedCheckpointBinding']['instance']='different-instance'
            if mutation=='wrong_actual_pid':changed['privateAdmissionIdentityBinding']['actual_pid']=40
            if mutation=='arbitrary_pids':changed['nativeFinalSnapshot']['records']=[{'pid':10},{'pid':20}]
            if mutation=='no_inferring':plan.pop('inferringCheckpointObservation')
            if mutation=='unmatched_argv':changed['nativeFinalSnapshot']['records'][2]['argvMatchesPinned']=False
            if mutation=='nonsignalled_record':changed['nativeFinalSnapshot']['records'][2]['nativeWaitResult']=258
            with self.subTest(mutation=mutation):self.assertFalse(m.control_flow_audit(plan,changed)['localProducerEvidenceComplete'])

    def test_producer_exception_still_restores_off_records_failure_and_closes(self):
        with patch.object(m,'control_flow_audit',side_effect=RuntimeError('CPU fixture producer failure')):
            result=self.run_fixture(self.factory(Worker(0)))
        self.assertEqual(result['state'],'QUARANTINE')
        self.assertEqual(result['producerError'],'RuntimeError')
        self.assertFalse(result['controlFlowDrainAudit']['localProducerEvidenceComplete'])
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
