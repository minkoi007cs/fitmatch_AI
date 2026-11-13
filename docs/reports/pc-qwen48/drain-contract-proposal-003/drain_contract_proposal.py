"""Private audit contract candidate, NOT installed in the coordinator/runtime.

Pure metadata validation only: acceptance here never proves native/server execution.
Real evidence must be collected/read from the same run and ACKed by its producers.
"""
from datetime import datetime

WORKER_SHA = 'ef25136b10ad14ea8a9f1f000d2cdf17d5ca61b65a9a04937d6696f2af4016b6'
BASIS = 'reviewed_completed_checkpoint_control_path'


class Hold(ValueError):
    pass


def need(condition, reason):
    if not condition:
        raise Hold(reason)


def epoch(value):
    need(isinstance(value, str), 'timestamp_missing')
    stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
    need(stamp.tzinfo is not None, 'timestamp_timezone_missing')
    return stamp.timestamp()


def validate_control_path_drain(peer, issued):
    """Proposed audit shape, not authentication or independent kernel measurement.

    issued is the real coordinator receipt; peer references real start/checkpoint/
    authenticated backend/observer evidence, not booleans inferred from exit alone.
    """
    need(peer.get('kind') == 'fitmatch.qwen48.worker-drain-control-path.v1', 'wrong_contract')
    need(issued.get('kind') == 'fitmatch.qwen48.bounded-issued.v1'
         and issued.get('workerSHA256') == WORKER_SHA, 'unreviewed_issue')
    for key in ('goId', 'jobId', 'slotSHA256'):
        need(isinstance(issued.get(key), str) and bool(issued[key])
             and peer.get(key) == issued[key], 'wrong_run_' + key)
    need(peer.get('workerSHA256') == WORKER_SHA, 'unreviewed_worker')
    need(peer.get('transportDrainEvidenceBasis') == BASIS
         and peer.get('counterIndependentlyRecorded') is False
         and peer.get('modelPythonUnloadCallbackNotExported') is True,
         'wrong_evidence_basis')
    # Never synthesize unavailable measurements to satisfy the obsolete contract.
    need(not {'activeProcessesAtDrain', 'actualPeerJobActiveCount', 'modelUnloaded'}
         .intersection(peer), 'unexported_measurement_claim')
    need(peer.get('targetDirectoryAbsentBeforeLaunch') is True,
         'old_output_or_freshness_unproven')
    issued_at = epoch(issued.get('issuedAtUtc'))
    checked = epoch(peer.get('targetDirectoryCheckedAtUtc'))
    launched = epoch(peer.get('workerLaunchedAtUtc'))
    drained = epoch(peer.get('drainVerifiedAtUtc'))
    need(issued_at <= checked <= launched <= drained, 'launch_evidence_not_same_window')
    cp, server = peer.get('checkpoint'), peer.get('serverResult')
    need(isinstance(cp, dict) and isinstance(server, dict), 'checkpoint_and_server_required')
    for item in (cp, server):
        need(item.get('jobId') == issued['jobId'] and type(item.get('attempt')) is int
             and item['attempt'] == 1, 'fresh_same_job_attempt1_required')
        need(launched <= epoch(item.get('observedAtUtc')) <= drained, 'old_completion_evidence')
    need(cp.get('stage') in ('output_ready', 'completed'), 'no_success_path_checkpoint')
    need(server.get('state') == 'SUCCEEDED', 'actual_server_success_required')
    need(type(peer.get('workerExitCode')) is int and peer['workerExitCode'] == 0
         and peer.get('quarantined') is False, 'worker_exit_or_quarantine_refused')
    need(type(peer.get('unknownNativeCount')) is int and peer['unknownNativeCount'] == 0
         and peer.get('noOwnedModelProcessSurvives') is True, 'native_exit_unproven')
    handles = peer.get('nativeProcessHandles')
    need(isinstance(handles, list) and len(handles) >= 2, 'worker_and_adapter_handles_required')
    identities = set(); roles = set()
    for h in handles:
        need(isinstance(h, dict) and type(h.get('pid')) is int and h['pid'] > 0
             and type(h.get('creationFILETIME')) is int and h['creationFILETIME'] > 0,
             'native_identity_missing')
        key = (h['pid'], h['creationFILETIME'])
        need(key not in identities, 'duplicate_native_identity')
        identities.add(key)
        need(h.get('role') in ('worker', 'adapter', 'descendant')
             and h.get('handleRetainedBeforeExit') is True
             and h.get('signalledExited') is True, 'native_handle_exit_unproven')
        roles.add(h['role'])
    need({'worker', 'adapter'} <= roles, 'worker_and_adapter_binding_required')
    return handles


def validate_coordinator_closeout(closeout, peer, issued):
    """Separate coordinator-owned evidence, never accepted from peer alone.

    Candidate integration must perform actual native/resource/process/bound byte0
    checks; this pure function cannot supply those observations or release a lock.
    """
    handles = validate_control_path_drain(peer, issued)
    need(closeout.get('goId') == issued['goId']
         and closeout.get('slotSHA256BeforeWithdrawal') == issued['slotSHA256'], 'closeout_wrong_run')
    need(epoch(closeout.get('checkedAtUtc')) >= epoch(peer['drainVerifiedAtUtc']), 'old_closeout')
    need(type(closeout.get('unknownNativeCount')) is int and closeout['unknownNativeCount'] == 0,
         'closeout_native_unknown')
    expected = {(h['pid'], h['creationFILETIME']) for h in handles}
    checks = closeout.get('nativeIdentityChecks')
    need(isinstance(checks, list) and len(checks) == len(expected), 'closeout_handles_incomplete')
    seen = set()
    for h in checks:
        need(isinstance(h, dict) and type(h.get('pid')) is int
             and type(h.get('savedCreationFILETIME')) is int, 'closeout_identity_missing')
        key = (h['pid'], h['savedCreationFILETIME'])
        need(key in expected and key not in seen and h.get('sameOwnedObjectLive') is False,
             'closeout_identity_or_live_refused')
        seen.add(key)
    need(closeout.get('canonicalByte0AcquiredNonblockingAndReleased') is True
         and closeout.get('canonicalBindingVerified') is True
         and closeout.get('processInventoryChecked') is True
         and closeout.get('knownEngineProcessPresent') is False, 'closeout_binding_process_lock_unproven')
    # Observe post-run resources; do not turn preload floors into a revocation gate.
    need(type(closeout.get('RAMAvailableBytes')) is int and closeout['RAMAvailableBytes'] >= 0
         and type(closeout.get('VRAMFreeMiB')) is int and closeout['VRAMFreeMiB'] >= 0,
         'closeout_resources_unproven')
