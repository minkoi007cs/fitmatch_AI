"""Unit tests for worker checkpoint safety and error classification (stdlib unittest, no network)."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import struct
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('worker', Path(__file__).with_name('worker.py'))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)

JOB_ID = '11111111-2222-4333-8444-555555555555'


def glb_bytes(extra=b'\0' * 8):
    body = struct.pack('<III', 0x46546C67, 2, 12 + len(extra)) + extra
    return body


def job(revision='r'):
    return {'jobId': JOB_ID, 'modelId': 'm1', 'kind': 'avatar.reconstruct', 'modelRevision': {'model': 'x', 'revision': revision},
            'lease': {'token': 't', 'attempt': 1},
            'input': {'params': {'heightCm': 170}, 'assets': [{'role': 'front', 'assetId': 'a', 'sha256': 's', 'bytes': 1}]}}


class CheckpointTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())

    def make(self, revision='r', tamper=False, file_name='a1-x/output.glb'):
        cp = worker.Checkpoint(self.root, JOB_ID)
        out = cp.dir / 'a1-x' / 'output.glb'
        out.parent.mkdir(parents=True)
        data = glb_bytes()
        out.write_bytes(data)
        sha = hashlib.sha256(data).hexdigest()
        j = job(revision)
        cp.save(jobId=JOB_ID, modelId='m1', kind='avatar.reconstruct', modelRevision=j['modelRevision'],
                inputDigest=worker.input_digest(j), stage='finalized', leaseToken='t',
                output={'file': file_name, 'bytes': len(data), 'sha256': sha})
        if tamper:
            out.write_bytes(glb_bytes(b'\1' * 8))
        reloaded = worker.Checkpoint(self.root, JOB_ID)
        reloaded.load()
        return reloaded

    def test_valid_output_is_reused(self):
        cp = self.make()
        self.assertIsNotNone(cp.recoverable_output(job(), worker.input_digest(job())))

    def test_tampered_output_is_refused(self):
        cp = self.make(tamper=True)
        self.assertIsNone(cp.recoverable_output(job(), worker.input_digest(job())))

    def test_other_engine_revision_is_refused(self):
        cp = self.make()
        other = job('newer')
        self.assertIsNone(cp.recoverable_output(other, worker.input_digest(other)))

    def test_path_outside_job_dir_is_refused(self):
        cp = self.make(file_name='../../../outside.glb')
        (self.root / 'outside.glb').write_bytes(glb_bytes())
        self.assertIsNone(cp.recoverable_output(job(), worker.input_digest(job())))

    def test_garbage_checkpoint_is_set_aside_not_deleted(self):
        cp = worker.Checkpoint(self.root, JOB_ID)
        cp.dir.mkdir(parents=True)
        cp.file.write_text('{not json', encoding='utf8')
        self.assertIsNone(cp.load())
        self.assertFalse(cp.file.exists())
        self.assertEqual(len(list(cp.dir.glob('checkpoint.rejected.*.json'))), 1)

    def test_unknown_version_is_set_aside(self):
        cp = worker.Checkpoint(self.root, JOB_ID)
        cp.dir.mkdir(parents=True)
        cp.file.write_text(json.dumps({'version': 99}), encoding='utf8')
        self.assertIsNone(cp.load())

    def test_job_id_must_be_uuid(self):
        for bad in ('../x', 'a/b', '', 'not-a-uuid'):
            with self.assertRaises(ValueError):
                worker.Checkpoint(self.root, bad)


class ClassificationTests(unittest.TestCase):
    def test_exit_codes(self):
        log = Path(tempfile.mkdtemp()) / 'adapter.log'
        log.write_bytes(b'')
        self.assertEqual(worker.classify_exit(3, {}, log), 'OOM')
        self.assertEqual(worker.classify_exit(4, {}, log), 'INVALID_INPUT')
        self.assertEqual(worker.classify_exit(5, {}, log), 'EXPORT_FAILED')
        self.assertEqual(worker.classify_exit(1, {}, log), 'INFERENCE_FAILED')
        self.assertEqual(worker.classify_exit(7, {'exitCodes': {'7': 'OOM', '8': 'NOT_A_CODE'}}, log), 'OOM')
        self.assertEqual(worker.classify_exit(8, {'exitCodes': {'8': 'NOT_A_CODE'}}, log), 'INFERENCE_FAILED')
        log.write_bytes(b'... torch.cuda.OutOfMemoryError: CUDA out of memory ...')
        self.assertEqual(worker.classify_exit(1, {}, log), 'OOM')

    def test_adapter_environment_drops_secrets(self):
        token = 'fmw_' + 'z' * 43
        saved = dict(os.environ)
        try:
            os.environ.update({'FITMATCH_WORKER_TOKEN': token, 'FITMATCH_WORKER_TOKEN_2': 'x', 'MY_API_KEY': 'k',
                               'SUPABASE_SERVICE_ROLE_KEY': 'k', 'HF_TOKEN': 'h', 'COPY': 'prefix-' + token, 'SAFE_VALUE': 'ok'})
            env = worker.adapter_environment(token)
        finally:
            os.environ.clear()
            os.environ.update(saved)
        for name in ('FITMATCH_WORKER_TOKEN', 'FITMATCH_WORKER_TOKEN_2', 'MY_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'HF_TOKEN', 'COPY'):
            self.assertNotIn(name, env)
        self.assertEqual(env.get('SAFE_VALUE'), 'ok')

    def test_job_failure_unknown_code_maps_to_inference_failed(self):
        self.assertEqual(worker.JobFailure('WHATEVER').code, 'INFERENCE_FAILED')
        self.assertEqual(worker.JobFailure('TIMEOUT').code, 'TIMEOUT')


if __name__ == '__main__':
    unittest.main()
