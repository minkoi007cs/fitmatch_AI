"""Python3.10 CPU-only format tests; no secrets, HTTP or native probe."""
from datetime import datetime, timezone
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

FILE = Path(__file__).with_name('heartbeat-window-once.py')
spec = importlib.util.spec_from_file_location('heartbeat_format_under_test', FILE)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
PS7 = '2026-11-14T03:19:28.7621188+00:00'  # Actual W006 APPROVAL_READY sample.


class FormatTests(unittest.TestCase):
    def test_actual_ps7_sample_preserves_original_and_100ns_remainder(self):
        parsed=m.parse_stamp(PS7)
        self.assertEqual(parsed['original'],PS7)
        self.assertEqual(parsed['pythonParserInput'],'2026-11-14T03:19:28.762118+00:00')
        self.assertEqual(parsed['fractionRemainderNanoseconds'],800)
        base=datetime.fromisoformat('2026-11-14T03:19:28.762118+00:00')
        self.assertEqual(parsed['epochNanoseconds'],m.datetime_ns(base)+800)

    def test_ps7_z_equivalent_to_explicit_utc_offset(self):
        self.assertEqual(m.parse_stamp(PS7)['epochNanoseconds'],
                         m.parse_stamp('2026-11-14T03:19:28.7621188Z')['epochNanoseconds'])

    def test_positive_offset_equivalent_instant(self):
        self.assertEqual(m.parse_stamp(PS7)['epochNanoseconds'],
                         m.parse_stamp('2026-11-14T08:49:28.7621188+05:30')['epochNanoseconds'])

    def test_negative_offset_equivalent_instant(self):
        self.assertEqual(m.parse_stamp(PS7)['epochNanoseconds'],
                         m.parse_stamp('2026-11-13T22:19:28.7621188-05:00')['epochNanoseconds'])

    def test_fresh_ps7_age_uses_preserved_submicrosecond_part(self):
        now=datetime.fromisoformat('2026-11-14T03:19:29.762118+00:00')
        self.assertEqual(m.fresh_stamp(PS7,now,300)['ageNanoseconds'],999999200)

    def test_future_submicrosecond_sample_refused_instead_of_rounded_fresh(self):
        now=datetime.fromisoformat('2026-11-14T03:19:28.762118+00:00')
        with self.assertRaises(ValueError):m.fresh_stamp(PS7,now,300)

    def test_future_whole_second_refused(self):
        now=datetime.fromisoformat('2026-11-14T03:19:27.762118+00:00')
        with self.assertRaises(ValueError):m.fresh_stamp(PS7,now,300)

    def test_stale_actual_sample_refused(self):
        now=datetime.fromisoformat('2026-11-14T03:24:28.762119+00:00')
        with self.assertRaises(ValueError):m.fresh_stamp(PS7,now,300)

    def test_exact_300_second_boundary_remains_refused(self):
        now=datetime.fromisoformat('2026-11-14T03:24:28.762118+00:00')
        with self.assertRaises(ValueError):m.fresh_stamp('2026-11-14T03:19:28.762118Z',now,300)

    def test_six_digit_and_whole_second_explicit_timestamps(self):
        self.assertEqual(m.parse_stamp('2026-11-14T03:19:28.762118Z')['fractionRemainderNanoseconds'],0)
        self.assertEqual(m.parse_stamp('2026-11-14T03:19:28+00:00')['fractionRemainderNanoseconds'],0)

    def test_missing_offset_invalid_date_and_non_string_refused(self):
        for value in ['2026-11-14T03:19:28.7621188','2026-02-30T03:19:28Z',None,123]:
            with self.subTest(value=value),self.assertRaises(ValueError):m.parse_stamp(value)
        with self.assertRaises(ValueError):m.datetime_ns(datetime(2026,11,14))

    def test_import_is_safe_without_file_secret_or_http_side_effects(self):
        spec=importlib.util.spec_from_file_location('heartbeat_import_safety',FILE)
        module=importlib.util.module_from_spec(spec)
        with patch.object(Path,'read_bytes',side_effect=AssertionError('No secret/file IO on import')) as files, \
             patch.object(m.urllib.request.OpenerDirector,'open',side_effect=AssertionError('No HTTP on import')) as http:
            spec.loader.exec_module(module)
        files.assert_not_called();http.assert_not_called()


if __name__=='__main__':unittest.main(verbosity=2)
