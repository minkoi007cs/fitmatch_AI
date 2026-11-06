import copy
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from check_handoff import InvalidEvidence, ROLES, strict_json, validate


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        identity = {"ownerRef": "subject-01", "avatarVersion": "av-01"}
        artifacts = []
        for role in sorted(ROLES):
            data = ("synthetic fixture " + role).encode()
            (self.root / (role + ".bin")).write_bytes(data)
            artifacts.append({"id": role, "role": role, "path": role + ".bin",
                              "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data),
                              "assetVersion": "v1", "engineRevision": "fixture-v1",
                              "provenance": "fixture", "transformRef": "common-v1", **identity})
        self.document = {"schemaVersion": "fitmatch.evidence.v1", "profile": "technical",
                         "sourceRevision": "a" * 40, "identity": identity,
                         "coordinates": {"unit": "meter", "up": "+Y", "front": "+Z", "sharedTransformRef": "common-v1"},
                         "artifacts": artifacts, "look": {**identity, "bodyArtifactId": "body",
                         "topArtifactId": "top", "bottomArtifactId": "bottom"},
                         "measurements": {"wallSeconds": 1, "peakVramMiB": 0, "peakRamMiB": 12},
                         "humanReview": {"status": "pending"}}

    def bad(self, document, code):
        with self.assertRaisesRegex(InvalidEvidence, "^" + code + "$"):
            validate(document, self.root)

    def test_technical_pack_never_proves_product_quality(self):
        result = validate(self.document, self.root)
        self.assertEqual(result["evidenceIntegrity"], "PASS")
        self.assertEqual(result["productGate"], "NOT_VERIFIED")

    def test_same_size_tampering(self):
        item = self.document["artifacts"][0]
        (self.root / item["path"]).write_bytes(b"x" * item["bytes"])
        self.bad(self.document, "HASH_MISMATCH")

    def test_path_escape_absolute_and_windows_paths(self):
        for path in ("../elsewhere", "/tmp/private", "C:/private", "..\\private"):
            with self.subTest(path=path):
                document = copy.deepcopy(self.document)
                document["artifacts"][0]["path"] = path
                self.bad(document, "INVALID_PATH")

    def test_symlink(self):
        item = self.document["artifacts"][0]
        link = self.root / "alias.bin"
        try:
            link.symlink_to(self.root / item["path"])
        except OSError:
            self.skipTest("OS does not permit symlink creation")
        item["path"] = "alias.bin"
        self.bad(self.document, "SYMLINK_FORBIDDEN")

    def test_wrong_avatar_or_owner(self):
        for key in ("avatarVersion", "ownerRef"):
            document = copy.deepcopy(self.document)
            document["artifacts"][0][key] = "other"
            self.bad(document, "IDENTITY_MISMATCH")

    def test_top_does_not_substitute_bottom(self):
        self.document["look"]["bottomArtifactId"] = "top"
        self.bad(self.document, "LOOK_BINDING_MISMATCH")

    def test_transform_binding_mismatch(self):
        self.document["artifacts"][0]["transformRef"] = "independently-normalized"
        self.bad(self.document, "TRANSFORM_BINDING_MISMATCH")

    def test_duplicate_role(self):
        self.document["artifacts"][1]["role"] = self.document["artifacts"][0]["role"]
        self.bad(self.document, "DUPLICATE_ROLE")

    def test_fixture_cannot_claim_personal_pilot(self):
        self.document["profile"] = "personal-pilot"
        self.bad(self.document, "PERSONAL_EVIDENCE_REQUIRED")

    def test_invalid_metrics(self):
        for value in (True, -1, float("nan"), float("inf"), "12"):
            with self.subTest(value=value):
                document = copy.deepcopy(self.document)
                document["measurements"]["peakRamMiB"] = value
                self.bad(document, "INVALID_MEASUREMENT")

    def test_duplicate_keys_and_nonfinite_json(self):
        for raw in ('{"x":1,"x":2}', '{"x":NaN}'):
            with self.assertRaises(InvalidEvidence):
                strict_json(raw)

    def test_approval_requires_record_and_still_not_product_pass(self):
        self.document["humanReview"] = {"status": "approved"}
        self.bad(self.document, "REVIEW_RECORD_REQUIRED")
        self.document["humanReview"].update(reviewerRef="reviewer-01", recordRef="private-review-01")
        self.assertEqual(validate(self.document, self.root)["productGate"], "NOT_VERIFIED")

    def test_cli_exit_status_and_no_private_path_on_failure(self):
        path = self.root / "evidence.json"
        path.write_text(json.dumps(self.document))
        command = [sys.executable, str(Path(__file__).with_name("check_handoff.py")), str(path)]
        first = subprocess.run(command, text=True, capture_output=True)
        self.assertEqual(first.returncode, 0, first.stderr)
        self.document["look"]["bottomArtifactId"] = "top"
        path.write_text(json.dumps(self.document))
        failed = subprocess.run(command, text=True, capture_output=True)
        self.assertEqual(failed.returncode, 1)
        self.assertEqual(json.loads(failed.stdout)["code"], "LOOK_BINDING_MISMATCH")
        self.assertNotIn(str(self.root), failed.stdout + failed.stderr)


if __name__ == "__main__":
    unittest.main()
