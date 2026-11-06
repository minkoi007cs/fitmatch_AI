"""Offline evidence-integrity check. Never proves likeness, GLB validity or product acceptance."""
import argparse
import hashlib
import json
import math
from pathlib import Path, PurePosixPath, PureWindowsPath
import re

SCHEMA = "fitmatch.evidence.v1"
ROLES = {"body", "top", "bottom", "preview_front", "preview_side", "preview_back"}


class InvalidEvidence(ValueError):
    pass


def require(condition, code):
    if not condition:
        raise InvalidEvidence(code)


def identifier(value):
    return isinstance(value, str) and bool(re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}", value))


def local_file(root, raw):
    require(isinstance(raw, str) and 0 < len(raw) <= 500, "INVALID_PATH")
    require("\\" not in raw and not PureWindowsPath(raw).drive, "INVALID_PATH")
    relative = PurePosixPath(raw)
    require(not relative.is_absolute() and ".." not in relative.parts, "INVALID_PATH")
    candidate = root
    for part in relative.parts:
        candidate = candidate / part
        require(not candidate.is_symlink(), "SYMLINK_FORBIDDEN")
    resolved = candidate.resolve()
    require(resolved.is_relative_to(root) and resolved.is_file(), "FILE_UNAVAILABLE")
    return resolved


def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate(document, root):
    root = Path(root).resolve()
    require(isinstance(document, dict) and document.get("schemaVersion") == SCHEMA, "SCHEMA_MISMATCH")
    require(document.get("profile") in ("technical", "personal-pilot"), "INVALID_PROFILE")
    require(isinstance(document.get("sourceRevision"), str) and
            bool(re.fullmatch(r"[0-9a-f]{40}", document["sourceRevision"])), "INVALID_REVISION")
    identity = document.get("identity")
    require(isinstance(identity, dict), "INVALID_IDENTITY")
    require(all(identifier(identity.get(k)) for k in ("ownerRef", "avatarVersion")), "INVALID_IDENTITY")
    coordinates = document.get("coordinates")
    require(isinstance(coordinates, dict) and coordinates.get("unit") == "meter" and
            coordinates.get("up") == "+Y" and coordinates.get("front") == "+Z" and
            identifier(coordinates.get("sharedTransformRef")), "COORDINATE_DECLARATION_REQUIRED")
    artifacts = document.get("artifacts")
    require(isinstance(artifacts, list) and 6 <= len(artifacts) <= 100, "INVALID_ARTIFACT_LIST")
    by_id, by_role, files = {}, {}, set()
    for item in artifacts:
        require(isinstance(item, dict) and identifier(item.get("id")), "INVALID_ARTIFACT")
        require(item["id"] not in by_id, "DUPLICATE_ARTIFACT_ID")
        require(item.get("role") in ROLES | {"lookbook"}, "INVALID_ROLE")
        require(item["role"] not in by_role, "DUPLICATE_ROLE")
        require(all(item.get(k) == identity[k] for k in ("ownerRef", "avatarVersion")), "IDENTITY_MISMATCH")
        require(item.get("transformRef") == coordinates["sharedTransformRef"], "TRANSFORM_BINDING_MISMATCH")
        require(identifier(item.get("assetVersion")) and identifier(item.get("engineRevision")), "PROVENANCE_REQUIRED")
        require(item.get("provenance") in ("fixture", "template", "personal-capture"), "PROVENANCE_REQUIRED")
        if document["profile"] == "personal-pilot":
            require(item["provenance"] == "personal-capture", "PERSONAL_EVIDENCE_REQUIRED")
        path = local_file(root, item.get("path"))
        require(path not in files, "DUPLICATE_ARTIFACT_FILE")
        files.add(path)
        require(type(item.get("bytes")) is int and 0 < item["bytes"] <= 100 * 1024 * 1024, "INVALID_SIZE")
        require(path.stat().st_size == item["bytes"], "SIZE_MISMATCH")
        require(isinstance(item.get("sha256"), str) and bool(re.fullmatch(r"[0-9a-f]{64}", item["sha256"])), "INVALID_HASH")
        require(file_hash(path) == item["sha256"], "HASH_MISMATCH")
        by_id[item["id"]], by_role[item["role"]] = item, item
    require(ROLES <= by_role.keys(), "FULL_LOOK_EVIDENCE_INCOMPLETE")
    look = document.get("look")
    require(isinstance(look, dict) and all(look.get(k) == identity[k]
            for k in ("ownerRef", "avatarVersion")), "LOOK_IDENTITY_MISMATCH")
    require(look.get("topArtifactId") == by_role["top"]["id"] and
            look.get("bottomArtifactId") == by_role["bottom"]["id"] and
            look.get("bodyArtifactId") == by_role["body"]["id"], "LOOK_BINDING_MISMATCH")
    measurements = document.get("measurements")
    require(isinstance(measurements, dict), "MEASUREMENTS_REQUIRED")
    for key in ("wallSeconds", "peakVramMiB", "peakRamMiB"):
        value = measurements.get(key)
        require(type(value) in (int, float) and math.isfinite(value) and value >= 0, "INVALID_MEASUREMENT")
    require(measurements["wallSeconds"] > 0, "INVALID_MEASUREMENT")
    review = document.get("humanReview")
    require(isinstance(review, dict) and review.get("status") in
            ("pending", "changes-requested", "approved"), "HUMAN_REVIEW_REQUIRED")
    if review["status"] == "approved":
        require(identifier(review.get("reviewerRef")) and isinstance(review.get("recordRef"), str)
                and 0 < len(review["recordRef"]) < 500, "REVIEW_RECORD_REQUIRED")
    return {"evidenceIntegrity": "PASS", "profile": document["profile"],
            "artifactCount": len(artifacts), "declaredHumanReview": review["status"],
            "productGate": "NOT_VERIFIED", "limitations": [
                "No GLB/image decoding or geometry/units inspection performed",
                "Provenance, measurement and review declarations are not independently authenticated",
                "Likeness, garment fidelity and complete application flow require independent review"]}


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, "DUPLICATE_JSON_KEY")
            result[key] = value
        return result
    def constant(_):
        raise InvalidEvidence("NON_FINITE_JSON")
    return json.loads(raw, object_pairs_hook=pairs, parse_constant=constant)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest")
    parser.add_argument("--root", help="Local evidence directory; defaults to manifest parent")
    args = parser.parse_args()
    try:
        path = Path(args.manifest)
        require(path.stat().st_size <= 256 * 1024, "MANIFEST_TOO_LARGE")
        result = validate(strict_json(path.read_text(encoding="utf-8")), args.root or path.parent)
    except (InvalidEvidence, OSError, UnicodeError, ValueError, TypeError, KeyError) as error:
        code = str(error) if isinstance(error, InvalidEvidence) else "INVALID_OR_UNREADABLE_EVIDENCE"
        print(json.dumps({"evidenceIntegrity": "FAIL", "code": code, "productGate": "NOT_VERIFIED"}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
