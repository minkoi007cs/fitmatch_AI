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


def heartbeat():
    # Actual producer field names; synthetic values, no POST/native/runtime execution.
    return {'completedUTC': '2026-11-13T13:52:30Z', 'HTTPstatus': 200,
        'appSuccess': True, 'backendProjectRef': 'gohczmqykjkrgdblgbog',
        'grantedCapabilities': ['garment.analyze'], 'configSHA256': m.PINS['config'],
        'runtimeManifestSHA256': m.PINS['manifest'], 'admissionSHA256': m.PINS['admission'],
        'appRevisionConfirmedByMac': m.APP, 'workerApprovalSHA256': m.DISABLED_APPROVAL_SHA,
        'workerApprovalEnabled': False, 'approvalUnchanged': True,
        'allApprovalsRemainDisabled': True, 'claimSent': False, 'GPUOrModelStarted': False}


def disabled_approval():
    return {'enabled': False, 'approved_job_id': m.JOB, 'app_revision': m.APP,
        'config_sha256': m.PINS['config'], 'transport_sha256': m.PINS['worker'],
        'coordinator_sha256': m.PINS['policy'], 'guard_sha256': m.PINS['guard']}


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
        h = heartbeat(); del h['claimSent']
        with self.assertRaisesRegex(m.Hold, 'heartbeat_started_execution'):
            m.validate_heartbeat(h, d, m.epoch('2026-11-13T13:53:00Z'))

    def test_actual_shaped_disabled_approval_metadata_only(self):
        m.validate_disabled_approval(disabled_approval(), m.DISABLED_APPROVAL_SHA)

    def test_enabled_approval_refused_even_with_expected_hash_argument(self):
        a = disabled_approval(); a['enabled'] = True
        with self.assertRaisesRegex(m.Hold, 'exact_disabled'):
            m.validate_disabled_approval(a, m.DISABLED_APPROVAL_SHA)

    def test_changed_disabled_approval_bytes_refused(self):
        with self.assertRaisesRegex(m.Hold, 'approval_hash_mismatch'):
            m.validate_disabled_approval(disabled_approval(), '0'*64)

    def test_wrong_approval_job_or_config_refused(self):
        for field in ('approved_job_id', 'config_sha256'):
            with self.subTest(field=field):
                a = disabled_approval(); a[field] = 'wrong'
                with self.assertRaisesRegex(m.Hold, 'exact_disabled'):
                    m.validate_disabled_approval(a, m.DISABLED_APPROVAL_SHA)

    def test_actual_shaped_completedUTC_heartbeat_metadata_only(self):
        d = go(); d['heartbeatNotBeforeUtc'] = '2026-11-13T13:52:00Z'
        m.validate_heartbeat(heartbeat(), d, m.epoch('2026-11-13T13:53:00Z'))

    def test_observedAtUTC_is_not_a_completedUTC_alias(self):
        h = heartbeat(); h['observedAtUTC'] = h.pop('completedUTC')
        with self.assertRaisesRegex(m.Hold, 'missing_completedUTC'):
            m.validate_heartbeat(h, go(), m.epoch('2026-11-13T13:53:00Z'))

    def test_actual_shaped_heartbeat_stale_future_or_before_gate_refused(self):
        for stamp in ('2026-11-13T13:49:00Z', '2026-11-13T13:54:00Z',
                      '2026-11-13T13:51:59Z'):
            with self.subTest(stamp=stamp):
                h = heartbeat(); h['completedUTC'] = stamp
                d = go(); d['heartbeatNotBeforeUtc'] = '2026-11-13T13:52:00Z'
                with self.assertRaisesRegex(m.Hold, 'heartbeat_stale'):
                    m.validate_heartbeat(h, d, m.epoch('2026-11-13T13:53:00Z'))

    def test_actual_shaped_heartbeat_wrong_backend_or_grant_refused(self):
        for field, value in [('HTTPstatus', 503), ('appSuccess', False),
                             ('backendProjectRef', 'wrong'), ('grantedCapabilities', [])]:
            with self.subTest(field=field):
                h = heartbeat(); h[field] = value
                d = go(); d['heartbeatNotBeforeUtc'] = '2026-11-13T13:52:00Z'
                with self.assertRaisesRegex(m.Hold, 'heartbeat_binding'):
                    m.validate_heartbeat(h, d, m.epoch('2026-11-13T13:53:00Z'))

    def test_actual_shaped_heartbeat_changed_pins_refused(self):
        for field in ('configSHA256', 'runtimeManifestSHA256', 'admissionSHA256',
                      'appRevisionConfirmedByMac', 'workerApprovalSHA256'):
            with self.subTest(field=field):
                h = heartbeat(); h[field] = 'wrong'
                d = go(); d['heartbeatNotBeforeUtc'] = '2026-11-13T13:52:00Z'
                with self.assertRaisesRegex(m.Hold, 'heartbeat_old_pins'):
                    m.validate_heartbeat(h, d, m.epoch('2026-11-13T13:53:00Z'))

    def test_actual_shaped_heartbeat_execution_or_approval_change_refused(self):
        for field, value in [('claimSent', True), ('GPUOrModelStarted', True),
                             ('workerApprovalEnabled', True), ('approvalUnchanged', False),
                             ('allApprovalsRemainDisabled', False)]:
            with self.subTest(field=field):
                h = heartbeat(); h[field] = value
                d = go(); d['heartbeatNotBeforeUtc'] = '2026-11-13T13:52:00Z'
                with self.assertRaisesRegex(m.Hold, 'heartbeat_started_execution'):
                    m.validate_heartbeat(h, d, m.epoch('2026-11-13T13:53:00Z'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
