"""Exact app snapshot through the isolated CLI/mapper, entirely synthetic CPU."""
import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import wire
import worker_cli
from boundary import MODEL_REVISION, Refused
from runner import GuardedChild
from test_cat54 import Backend, attributes, raw


class Cat54WireTests(unittest.TestCase):
    def setUp(self):
        self.input = json.loads((wire.SNAPSHOT / 'fixtures/qwen-v1/adapter-input.json').read_text())
        self.input['modelRevision']['revision'] = MODEL_REVISION
        self.input['policy']['policyRevision'] = 'qint.2'

    def execute(self, kind, attrs=None, policy='qint.2'):
        value = copy.deepcopy(self.input)
        value['policy']['policyRevision'] = policy
        return wire.execute(value, None, backend=Backend([raw(kind, attrs)]),
                            lease=GuardedChild(lambda: None))

    def test_each_category_reaches_exact_public_schema(self):
        for kind in ('tshirt', 'shirt', 'hoodie', 'jacket', 'sweater', 'jeans'):
            with self.subTest(kind=kind):
                out = self.execute(kind, attributes(kind))
                wire.validator('analysis-result').validate(out)
                self.assertEqual(out['attributes']['category'], kind)
                self.assertEqual(out['binding'], self.input['binding'])
                self.assertEqual(out['policyRevision'], 'qint.2')
                self.assertFalse(out['approvedForAutoApply'])
                self.assertNotIn('material_composition', out['attributes'])
                self.assertEqual(out['candidateLogoTexts'], [])
                self.assertIsNone(out['evidence']['gpuMiB'])

    def test_legacy_policy_keeps_abstention(self):
        for kind in ('hoodie', 'jacket', 'shirt', 'sweater'):
            out = self.execute(kind, policy='qint.1')
            self.assertEqual(out['outcome'], 'abstained')
            self.assertIsNone(out['attributes'])

    def test_legacy_schema_refuses_new_category_even_with_valid_envelope(self):
        out = self.execute('jacket', attributes('jacket'))
        out['policyRevision'] = 'qint.1'
        self.assertFalse(wire.validator('analysis-result').is_valid(out))

    def test_unknown_abstains_with_no_proposal_or_ocr(self):
        out = self.execute('unknown')
        self.assertEqual(out['outcome'], 'abstained')
        self.assertEqual(out['abstainReason'], 'unsupported_category')
        self.assertIsNone(out['attributes'])
        self.assertEqual(out['candidateLogoTexts'], [])
        self.assertEqual(out['ocrStatus'], 'not_extracted')

    def test_input_accepts_both_versions_and_refuses_unknown_version(self):
        for revision in ('qint.1', 'qint.2'):
            self.input['policy']['policyRevision'] = revision
            wire.validate_input(self.input)
        self.input['policy']['policyRevision'] = 'qint.3'
        with self.assertRaisesRegex(Refused, 'INVALID_INPUT'):
            wire.validate_input(self.input)

    def test_confirmation_accepts_six_types_and_rejects_unknown(self):
        value = {'confirmationId': '55555555-6666-4777-8888-999999999999',
                 'expectedResultSha256': 'c' * 64, 'decision': 'approve', 'fields': {}}
        for kind in ('tshirt', 'shirt', 'hoodie', 'jacket', 'sweater', 'jeans'):
            value['fields'] = {'category': kind}
            wire.validator('analysis-confirm-request').validate(value)
        for kind in ('unknown', 'dress', 't-shirt'):
            value['fields'] = {'category': kind}
            self.assertFalse(wire.validator('analysis-confirm-request').is_valid(value))

    def test_cli_selects_new_prompt_and_writes_only_a_new_result(self):
        backend = Backend([raw('jacket', attributes('jacket'))])
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.input['outputPath'] = str(root / 'result.json')
            (root / 'input.json').write_text(json.dumps(self.input))
            with patch('wire.image_for', return_value=None), \
                 patch('backend54.AnalysisBackend54', return_value=backend) as factory, \
                 patch('worker_cli.WorkerChild', return_value=GuardedChild(lambda: None)):
                code = worker_cli.main(['--input', str(root / 'input.json'),
                                        '--output', str(root / 'result.json')],
                                       verifier=lambda *args: {'synthetic': True})
            self.assertEqual(code, 0)
            factory.assert_called_once()
            out = json.loads((root / 'result.json').read_text())
            self.assertEqual(out['attributes']['category'], 'jacket')
            self.assertEqual(out['policyRevision'], 'qint.2')
            self.assertFalse(out['approvedForAutoApply'])
            self.assertEqual(backend.calls[-1], 'unload')


if __name__ == '__main__':
    unittest.main(verbosity=2)
