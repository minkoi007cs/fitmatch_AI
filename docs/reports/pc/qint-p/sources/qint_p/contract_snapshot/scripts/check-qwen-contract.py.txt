"""Conformance check for the Qwen garment-analysis contract v1 (QINT-C proposal).

PC Qwen can run this against the exported schemas/fixtures, or pass its own adapter output:
    python scripts/check-qwen-contract.py [result.json ...]
Requires the `jsonschema` package (Draft 2020-12). Exit 0 = all checks passed.
"""
import glob
import json
import sys
from pathlib import Path

import jsonschema

ROOT = Path(__file__).resolve().parent.parent


def validator(name):
    schema = json.loads((ROOT / 'schemas' / 'qwen-v1' / (name + '.json')).read_text(encoding='utf8'))
    return jsonschema.Draft202012Validator(schema, format_checker=jsonschema.FormatChecker())


def main(paths):
    result = validator('analysis-result')
    failures = []
    for path in sorted(glob.glob(str(ROOT / 'fixtures/qwen-v1/valid/*.json'))):
        if not result.is_valid(json.loads(Path(path).read_text(encoding='utf8'))):
            failures.append('valid fixture rejected: ' + Path(path).name)
    for path in sorted(glob.glob(str(ROOT / 'fixtures/qwen-v1/invalid/*.json'))):
        case = json.loads(Path(path).read_text(encoding='utf8'))
        if result.is_valid(case['value']):
            failures.append('invalid fixture accepted: ' + Path(path).name + ' (' + case['reason'] + ')')
    if not validator('analysis-adapter-input').is_valid(json.loads((ROOT / 'fixtures/qwen-v1/adapter-input.json').read_text(encoding='utf8'))):
        failures.append('adapter-input fixture rejected')
    errors = json.loads((ROOT / 'fixtures/qwen-v1/adapter-errors.json').read_text(encoding='utf8'))
    error_validator = validator('analysis-adapter-error')
    failures += ['valid error rejected: ' + json.dumps(e) for e in errors['valid'] if not error_validator.is_valid(e)]
    failures += ['invalid error accepted: ' + json.dumps(e) for e in errors['invalid'] if error_validator.is_valid(e)]
    for path in paths:
        data = Path(path).read_bytes()
        if len(data) > 8192:
            failures.append(path + ': larger than 8192 bytes')
            continue
        for error in result.iter_errors(json.loads(data)):
            failures.append(path + ': ' + error.message)
    for line in failures:
        print('FAIL', line)
    print('qwen-v1 conformance:', 'PASS' if not failures else 'FAIL (%d)' % len(failures))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
