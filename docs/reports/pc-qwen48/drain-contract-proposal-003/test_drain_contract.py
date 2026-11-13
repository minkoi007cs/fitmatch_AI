"""Synthetic contract tests only. No OS/native/job/server/model/lock execution."""
import copy
import unittest
import drain_contract_proposal as m


def fixtures():
    issued = {'kind':'fitmatch.qwen48.bounded-issued.v1', 'goId':'synthetic-only',
        'jobId':'synthetic-job', 'slotSHA256':'a'*64, 'workerSHA256':m.WORKER_SHA,
        'issuedAtUtc':'2026-11-13T15:00:00Z'}
    peer = {'kind':'fitmatch.qwen48.worker-drain-control-path.v1',
        **{k:issued[k] for k in ('goId','jobId','slotSHA256','workerSHA256')},
        'transportDrainEvidenceBasis':m.BASIS, 'counterIndependentlyRecorded':False,
        'modelPythonUnloadCallbackNotExported':True, 'targetDirectoryAbsentBeforeLaunch':True,
        'targetDirectoryCheckedAtUtc':'2026-11-13T15:00:01Z',
        'workerLaunchedAtUtc':'2026-11-13T15:00:02Z', 'drainVerifiedAtUtc':'2026-11-13T15:02:00Z',
        'checkpoint':{'jobId':issued['jobId'], 'attempt':1, 'stage':'completed',
                      'observedAtUtc':'2026-11-13T15:01:50Z'},
        'serverResult':{'jobId':issued['jobId'], 'attempt':1, 'state':'SUCCEEDED',
                        'observedAtUtc':'2026-11-13T15:01:59Z'},
        'workerExitCode':0, 'quarantined':False, 'unknownNativeCount':0,
        'noOwnedModelProcessSurvives':True,
        'nativeProcessHandles':[
            {'role':'worker','pid':11,'creationFILETIME':123,'handleRetainedBeforeExit':True,'signalledExited':True},
            {'role':'adapter','pid':12,'creationFILETIME':124,'handleRetainedBeforeExit':True,'signalledExited':True}]}
    close = {'goId':issued['goId'],'slotSHA256BeforeWithdrawal':issued['slotSHA256'],
        'checkedAtUtc':'2026-11-13T15:02:01Z','unknownNativeCount':0,
        'nativeIdentityChecks':[{'pid':h['pid'],'savedCreationFILETIME':h['creationFILETIME'],
                                'sameOwnedObjectLive':False} for h in peer['nativeProcessHandles']],
        'canonicalByte0AcquiredNonblockingAndReleased':True,'canonicalBindingVerified':True,
        'processInventoryChecked':True,'knownEngineProcessPresent':False,
        'RAMAvailableBytes':4000000000,'VRAMFreeMiB':11000}
    return issued, peer, close


class Contract(unittest.TestCase):
    def setUp(self): self.issued,self.peer,self.close=fixtures()
    def refused(self, peer=None, close=None):
        with self.assertRaises((m.Hold, ValueError, TypeError)):
            if close is None: m.validate_control_path_drain(peer or self.peer,self.issued)
            else: m.validate_coordinator_closeout(close,peer or self.peer,self.issued)

    def test_complete_synthetic_chain_is_metadata_only(self):
        m.validate_coordinator_closeout(self.close,self.peer,self.issued)
    def test_output_ready_also_requires_actual_server_success(self):
        self.peer['checkpoint']['stage']='output_ready'
        m.validate_control_path_drain(self.peer,self.issued)
        self.peer['serverResult']['state']='REVIEW'; self.refused()
    def test_unexported_numeric_counter_or_callback_claim_refused(self):
        for key,val in [('activeProcessesAtDrain',0),('actualPeerJobActiveCount',0),('modelUnloaded',True)]:
            with self.subTest(key=key):
                p=copy.deepcopy(self.peer);p[key]=val;self.refused(p)
    def test_wrong_basis_or_independent_counter_label_refused(self):
        for key,val in [('transportDrainEvidenceBasis','independent_kernel_measurement'),
                        ('counterIndependentlyRecorded',True),('modelPythonUnloadCallbackNotExported',False)]:
            with self.subTest(key=key):
                p=copy.deepcopy(self.peer);p[key]=val;self.refused(p)
    def test_wrong_go_slot_job_or_worker_refused(self):
        for key in ('goId','slotSHA256','jobId','workerSHA256'):
            with self.subTest(key=key):
                p=copy.deepcopy(self.peer);p[key]='wrong';self.refused(p)
    def test_old_directory_or_missing_absence_proof_refused(self):
        self.peer['targetDirectoryAbsentBeforeLaunch']=False;self.refused()
        del self.peer['targetDirectoryAbsentBeforeLaunch'];self.refused()
    def test_absence_observed_after_launch_refused(self):
        self.peer['targetDirectoryCheckedAtUtc']='2026-11-13T15:00:03Z';self.refused()
    def test_checkpoint_not_on_success_control_path_refused(self):
        self.peer['checkpoint']['stage']='inferring';self.refused()
    def test_old_checkpoint_or_server_sample_refused(self):
        for name in ('checkpoint','serverResult'):
            with self.subTest(name=name):
                p=copy.deepcopy(self.peer);p[name]['observedAtUtc']='2026-11-13T14:59:00Z';self.refused(p)
    def test_other_job_retry_or_boolean_attempt_refused(self):
        for name in ('checkpoint','serverResult'):
            for key,val in [('jobId','other'),('attempt',2),('attempt',True)]:
                with self.subTest(name=name,key=key,value=val):
                    p=copy.deepcopy(self.peer);p[name][key]=val;self.refused(p)
    def test_worker_exit_alone_without_server_not_sufficient(self):
        del self.peer['serverResult'];self.refused()
    def test_worker_failure_quarantine_live_or_unknown_refused(self):
        for key,val in [('workerExitCode',1),('workerExitCode',False),('quarantined',True),
                        ('unknownNativeCount',1),('unknownNativeCount',False),('noOwnedModelProcessSurvives',False)]:
            with self.subTest(key=key):
                p=copy.deepcopy(self.peer);p[key]=val;self.refused(p)
    def test_both_real_worker_and_adapter_roles_required(self):
        self.peer['nativeProcessHandles'][1]['role']='descendant';self.refused()
    def test_handle_must_be_retained_and_signalled(self):
        for key in ('handleRetainedBeforeExit','signalledExited'):
            with self.subTest(key=key):
                p=copy.deepcopy(self.peer);p['nativeProcessHandles'][1][key]=False;self.refused(p)
    def test_duplicate_identity_not_two_independent_processes(self):
        self.peer['nativeProcessHandles'][1].update(pid=11,creationFILETIME=123);self.refused()
    def test_coordinator_unknown_live_wrong_identity_or_incomplete_refused(self):
        variants=[]
        c=copy.deepcopy(self.close);c['unknownNativeCount']=1;variants.append(c)
        c=copy.deepcopy(self.close);c['nativeIdentityChecks'][1]['sameOwnedObjectLive']=True;variants.append(c)
        c=copy.deepcopy(self.close);c['nativeIdentityChecks'][1]['savedCreationFILETIME']=999;variants.append(c)
        c=copy.deepcopy(self.close);c['nativeIdentityChecks'].pop();variants.append(c)
        for c in variants:
            with self.subTest(c=c):self.refused(close=c)
    def test_old_coordinator_check_refused(self):
        self.close['checkedAtUtc']='2026-11-13T15:01:59Z';self.refused(close=self.close)
    def test_lock_binding_inventory_or_resources_unproven_refused(self):
        for key,val in [('canonicalByte0AcquiredNonblockingAndReleased',False),('canonicalBindingVerified',False),
                        ('processInventoryChecked',False),('knownEngineProcessPresent',True),
                        ('RAMAvailableBytes',None),('VRAMFreeMiB',-1)]:
            with self.subTest(key=key):
                c=copy.deepcopy(self.close);c[key]=val;self.refused(close=c)


if __name__=='__main__':unittest.main(verbosity=2)
