"""Run compatibility + CAT54 contracts without altering earlier test reports."""
import contextlib
import importlib
import io
import json
from pathlib import Path
import sys
import unittest

import wire


def main():
    modules = ['test_adapter', 'test_wire', 'test_worker_bridge', 'test_assessment48',
               'test_offline_regression48', 'test_control', 'test_envelope',
               'test_retention', 'test_metrics', 'test_corpus', 'retest_candidate',
               'test_cat54', 'test_cat54_wire']
    suite = unittest.TestSuite(unittest.defaultTestLoader.loadTestsFromModule(importlib.import_module(name))
                               for name in modules)
    stream = io.StringIO()
    with contextlib.redirect_stdout(stream), contextlib.redirect_stderr(stream):
        result = unittest.TextTestRunner(stream=stream, verbosity=2).run(suite)
    heavy = sorted(set(sys.modules) & {'torch', 'transformers', 'bitsandbytes'})
    report = {'tests': result.testsRun, 'failures': len(result.failures),
              'errors': len(result.errors), 'skips': len(result.skipped),
              'heavyModulesImported': heavy, 'gpuExecuted': False,
              'contractSource': '1cef14d6fc866b21ade675fb425b383be3dcd6ed'}
    # New CAT54 paths only; do not overwrite historical CPU evidence.
    target = Path(__file__).resolve().parents[2] / 'reports/ai/qint_p/cat54'
    target.mkdir(parents=True, exist_ok=True)
    (target / 'cpu-suite.log').write_text(stream.getvalue(), encoding='utf-8')
    (target / 'cpu-suite.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(stream.getvalue())
    print(json.dumps(report))
    return 0 if result.wasSuccessful() and not heavy and not result.skipped else 1


if __name__ == '__main__':
    raise SystemExit(main())
