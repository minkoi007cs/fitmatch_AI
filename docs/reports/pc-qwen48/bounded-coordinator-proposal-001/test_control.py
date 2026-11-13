"""Synthetic metadata/control tests only; no native IO, GPU, slot or real job."""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('bounded_proposal', Path(__file__).with_name('bounded_coordinator.sanitized.py'))
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def go():
    return {'kind': 'fitmatch.qwen48.operator-go.v1', 'phase': 'worker-single-job',
        'jobId': m.JOB, 'appSHA': m.APP, 'pins': dict(m.PINS), 'backendReady': True,
        'oneEligibleJob': True, 'slotSeconds': 600, 'engineSeconds': 240, 'drainSeconds': 30,
        'autoRenew': False, 'goId': 'unit-only', 'issuedAtUtc': '2026-11-13T13:52:00Z',
        'issueBeforeUtc': '2026-11-13T14:00:00Z', 'previousSlotSHA256': 'a'*64}


class Control(unittest.TestCase):
    def test_expired_go155_refuses(self):
        with self.assertRaisesRegex(m.Hold, 'go_expired'):
            m.validate_go(go(), m.epoch('2026-11-13T14:00:00Z'))

    def test_two_second_write_margin(self):
        with self.assertRaisesRegex(m.Hold, 'go_expired'):
            m.validate_go(go(), m.epoch('2026-11-13T13:59:58Z'))

    def test_valid_metadata_is_not_admission(self):
        m.validate_go(go(), m.epoch('2026-11-13T13:53:00Z'))

    def test_other_job_refused(self):
        d = go(); d['jobId'] = 'other'
        with self.assertRaisesRegex(m.Hold, 'wrong_job'):
            m.validate_go(d, m.epoch('2026-11-13T13:53:00Z'))

    def test_old_source_pin_refused(self):
        d = go(); d['pins']['manifest'] = '0'*64
        with self.assertRaisesRegex(m.Hold, 'go_pin'):
            m.validate_go(d, m.epoch('2026-11-13T13:53:00Z'))

    def test_float_duration_refused(self):
        d = go(); d['slotSeconds'] = 600.0
        with self.assertRaisesRegex(m.Hold, 'wrong_bounds'):
            m.validate_go(d, m.epoch('2026-11-13T13:53:00Z'))

    def test_missing_actual_job_counter_blocks_withdrawal(self):
        issued = {'slotSHA256': 'a'*64, 'issuedAtUtc': '2026-11-13T13:53:00Z'}
        d = {'kind': 'fitmatch.qwen48.worker-drain.v1', 'jobId': m.JOB,
             'slotSHA256': 'a'*64, 'workerSHA256': m.PINS['worker'],
             'allJobProcessesExited': True, 'ownedLiveCount': 0, 'quarantined': False}
        with self.assertRaisesRegex(m.Hold, 'owned_tree_not_drained'):
            m.validate_drain(d, issued)

    def test_boolean_zero_counter_refused(self):
        issued = {'slotSHA256': 'a'*64, 'issuedAtUtc': '2026-11-13T13:53:00Z'}
        d = {'kind': 'fitmatch.qwen48.worker-drain.v1', 'jobId': m.JOB,
             'slotSHA256': 'a'*64, 'workerSHA256': m.PINS['worker'],
             'allJobProcessesExited': True, 'activeProcessesAtDrain': False,
             'ownedLiveCount': 0, 'quarantined': False}
        with self.assertRaisesRegex(m.Hold, 'owned_tree_not_drained'):
            m.validate_drain(d, issued)

    def test_wrong_run_drain_refused(self):
        with self.assertRaisesRegex(m.Hold, 'drain_wrong_run'):
            m.validate_drain({'kind': 'fitmatch.qwen48.worker-drain.v1', 'jobId': 'wrong'},
                             {'slotSHA256': 'a'*64})

    def test_complete_synthetic_metadata_is_not_native_execution(self):
        issued = {'slotSHA256': 'a'*64, 'issuedAtUtc': '2026-11-13T13:53:00Z'}
        handles = [{'pid': 11, 'creationFILETIME': 123, 'signalledExited': True},
                   {'pid': 12, 'creationFILETIME': 124, 'signalledExited': True}]
        d = {'kind': 'fitmatch.qwen48.worker-drain.v1', 'jobId': m.JOB,
             'slotSHA256': 'a'*64, 'workerSHA256': m.PINS['worker'],
             'allJobProcessesExited': True, 'activeProcessesAtDrain': 0,
             'ownedLiveCount': 0, 'quarantined': False, 'modelUnloaded': True,
             'allRetainedHandlesExited': True, 'nativeProcessHandles': handles,
             'drainVerifiedAtUtc': '2026-11-13T13:54:00Z'}
        self.assertEqual(m.validate_drain(d, issued), handles)

    def test_heartbeat_cannot_omit_no_claim_evidence(self):
        d = go(); d['heartbeatNotBeforeUtc'] = '2026-11-13T13:52:00Z'
        h = {'observedAtUTC': '2026-11-13T13:52:30Z', 'HTTPstatus': 200,
             'appSuccess': True, 'backendProjectRef': 'gohczmqykjkrgdblgbog',
             'grantedCapabilities': ['garment.analyze'], 'configSHA256': m.PINS['config'],
             'runtimeManifestSHA256': m.PINS['manifest'], 'GPUOrModelStarted': False}
        with self.assertRaisesRegex(m.Hold, 'heartbeat_started_execution'):
            m.validate_heartbeat(h, d, m.epoch('2026-11-13T13:53:00Z'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
