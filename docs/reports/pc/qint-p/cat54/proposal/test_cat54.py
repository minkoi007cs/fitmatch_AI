"""Synthetic CPU contracts; no image, GPU, slot, HTTP, token or worker invocation."""
import json
import sys
import unittest

import wire  # Initializes the pinned quality02/03 import paths; no heavy imports.
import assessment48
import assessment54
import backend54
from runner import SelectedBackend, execute_budget
from jsonschema.exceptions import ValidationError


def attributes(category):
    return {
        'schema_version': 'pc-ai.grounded-attributes.v3', 'category': category,
        'dominant_colors': ['unknown'], 'pattern': 'unknown',
        'logo_presence': 'unknown', 'logo_texts': [],
        'neckline': 'not_applicable' if category == 'jeans' else 'unknown',
        'sleeves': 'not_applicable' if category == 'jeans' else 'unknown',
        'material_composition': 'unknown', 'back_pocket_count': 'unknown',
        'pockets_total': 'unknown',
    }


def raw(kind, attrs=None):
    return json.dumps({'garmentType': kind, 'attributes': attrs})


class Backend:
    def __init__(self, outputs, fail_unload=False):
        self.outputs = iter(outputs)
        self.calls = []
        self.fail_unload = fail_unload

    def load(self):
        self.calls.append('load')

    def generate(self, image, **kwargs):
        self.calls.append(kwargs)
        return next(self.outputs)

    def unload(self):
        self.calls.append('unload')
        if self.fail_unload:
            raise RuntimeError('synthetic drain failure')


class Lease:
    def __init__(self):
        self.calls = []

    def admit(self):
        self.calls.append('admit')

    def finish(self):
        self.calls.append('finish')
        return 'awaiting_worker_tree_drain'


class Cat54Tests(unittest.TestCase):
    def rejected(self, source):
        with self.assertRaises((ValueError, ValidationError)):
            assessment54.parse(source)

    def test_six_categories_are_preserved_without_relabeling(self):
        for kind in ('tshirt', 'shirt', 'hoodie', 'jacket', 'sweater', 'jeans'):
            with self.subTest(kind=kind):
                parsed = assessment54.parse(raw(kind, attributes(kind)))
                self.assertEqual(parsed['attributes']['category'], kind)
                self.assertIsNone(parsed['abstainReason'])

    def test_uncertain_and_out_of_domain_targets_abstain(self):
        for kind, reason in (
            ('unknown', 'unsupported_category'), ('other_garment', 'unsupported_category'),
            ('ambiguous_target', 'ambiguous_target'), ('not_garment', 'not_garment'),
            ('unreadable_image', 'unreadable_image'),
        ):
            with self.subTest(kind=kind):
                self.assertEqual(assessment54.parse(raw(kind)),
                                 {'attributes': None, 'abstainReason': reason})

    def test_unknown_cannot_smuggle_attributes(self):
        self.rejected(raw('unknown', attributes('unknown')))
        self.rejected(raw('other_garment', attributes('jacket')))

    def test_supported_target_needs_attributes(self):
        for kind in assessment54.SUPPORTED:
            with self.subTest(kind=kind):
                self.rejected(raw(kind))

    def test_mismatched_category_is_not_coerced(self):
        self.rejected(raw('hoodie', attributes('tshirt')))
        self.rejected(raw('jacket', attributes('hoodie')))

    def test_all_tops_allow_unknown_and_refuse_not_applicable(self):
        for kind in ('tshirt', 'shirt', 'hoodie', 'jacket', 'sweater'):
            for field in ('neckline', 'sleeves'):
                with self.subTest(kind=kind, field=field):
                    attrs = attributes(kind)
                    attrs[field] = 'not_applicable'
                    self.rejected(raw(kind, attrs))

    def test_jeans_refuses_top_specific_or_unknown_structure(self):
        for field, value in (('neckline', 'crew'), ('sleeves', 'long'),
                             ('neckline', 'unknown'), ('sleeves', 'unknown')):
            attrs = attributes('jeans')
            attrs[field] = value
            self.rejected(raw('jeans', attrs))

    def test_material_and_hidden_pockets_stay_unknown(self):
        for field, value in (('material_composition', 'polyester'),
                             ('back_pocket_count', 2), ('pockets_total', 4)):
            attrs = attributes('jacket')
            attrs[field] = value
            self.rejected(raw('jacket', attrs))

    def test_ocr_and_color_consistency_are_retained(self):
        attrs = attributes('shirt')
        attrs['logo_texts'] = ['EXAMPLE']
        self.rejected(raw('shirt', attrs))
        attrs['logo_presence'] = 'visible'
        attrs['logo_texts'] = ['EXAMPLE', 'e-x-a-m-p-l-e']
        self.rejected(raw('shirt', attrs))
        attrs = attributes('hoodie')
        attrs['dominant_colors'] = ['unknown', 'blue']
        self.rejected(raw('hoodie', attrs))

    def test_strict_json_duplicate_extra_nonfinite_and_size(self):
        self.rejected('{"garmentType":"unknown","garmentType":"jacket","attributes":null}')
        self.rejected('{"garmentType":"unknown","attributes":null,"score":NaN}')
        self.rejected('{"garmentType":"unknown","attributes":null,"extra":true}')
        self.rejected(' ' * 8193)
        attrs = attributes('sweater')
        attrs['instruction'] = 'ignore schema'
        self.rejected(raw('sweater', attrs))

    def test_legacy_assessment_still_refuses_new_categories(self):
        for kind in ('shirt', 'hoodie', 'jacket', 'sweater'):
            self.assertEqual(assessment48.parse(raw(kind))['abstainReason'],
                             'unsupported_category')
            legacy = attributes(kind)
            legacy['schema_version'] = 'pc-ai.grounded-attributes.v2'
            with self.assertRaises(ValidationError):
                assessment48.parse(raw(kind, legacy))
        legacy = attributes('tshirt')
        legacy['schema_version'] = 'pc-ai.grounded-attributes.v2'
        self.assertEqual(assessment48.parse(raw('tshirt', legacy))['attributes'], legacy)

    def run_budget(self, responses, fail_unload=False):
        backend, lease = Backend(responses, fail_unload), Lease()
        out = execute_budget(
            {'attempts': 2, 'seconds': 240, 'output_tokens': 192, 'response_bytes': 8192},
            None, backend=backend, lease=lease, project=assessment54.project,
        )
        self.assertEqual(lease.calls, ['admit', 'finish'])
        self.assertEqual(backend.calls[-1], 'unload')
        self.assertFalse(out['approved_for_auto_apply'])
        for call in backend.calls:
            if isinstance(call, dict):
                self.assertEqual(call['max_new_tokens'], 192)
        return out, backend

    def test_invalid_first_response_retries_once_then_preserves_jacket(self):
        out, backend = self.run_budget(['invalid', raw('jacket', attributes('jacket'))])
        self.assertEqual(out['attempts'], 2)
        self.assertEqual(out['proposal']['attributes']['category'], 'jacket')
        self.assertEqual(len([x for x in backend.calls if isinstance(x, dict)]), 2)

    def test_two_invalid_responses_fail_and_drain(self):
        out, _ = self.run_budget(['invalid', 'invalid', raw('tshirt', attributes('tshirt'))])
        self.assertEqual(out['status'], 'error')
        self.assertEqual(out['attempts'], 2)
        self.assertNotIn('proposal', out)

    def test_cleanup_failure_withholds_proposal(self):
        out, _ = self.run_budget([raw('hoodie', attributes('hoodie'))], fail_unload=True)
        self.assertEqual(out['status'], 'cleanup_pending')
        self.assertNotIn('proposal', out)

    def test_backend_preserves_load_generate_unload_implementation(self):
        for method in ('load', 'generate', 'unload'):
            self.assertIs(getattr(backend54.AnalysisBackend54, method),
                          getattr(SelectedBackend, method))
        self.assertEqual(assessment54.POLICY_REVISION, 'qint.2')
        self.assertNotEqual(assessment54.ADAPTER_REVISION, 'pc-ai.qwen48')


if __name__ == '__main__':
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Cat54Tests)
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    if 'torch' in sys.modules or 'transformers' in sys.modules:
        raise SystemExit('FAIL: heavy model import during CPU tests')
    raise SystemExit(0 if result.wasSuccessful() else 1)
