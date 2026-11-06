# Full-look evidence preflight — Codex QA-PACK-01

Standalone Python3.9+ stdlib tool, owned by Codex. No dependency on Claude's API/UI, PC model env, Supabase or GPU. It reads local files only and never uploads, runs inference, changes assets or contacts a server. Keep private packs local; only sanitized reports go to public GitHub.

```sh
python3 tools/acceptance/check_handoff.py /private/evidence/manifest.json
python3 tools/acceptance/check_handoff.py /private/evidence/manifest.json --root /private/evidence
python3 -m unittest discover -s tools/acceptance -p 'test_*.py' -v
```

Exit0 = evidence integrity valid, **not product acceptance**. Exit1 = missing/invalid/mismatched evidence. Even a declared approved human review always returns `productGate: NOT_VERIFIED`; Codex must read the actual artifacts/review record. CLI errors print only a fixed code, not raw private paths. Do not run against untrusted files being actively modified; this local review preflight is not a security sandbox.

## Manifest v1

Top-level fields:

| Field | Contract |
|---|---|
| schemaVersion | `fitmatch.evidence.v1` |
| profile | `technical` or `personal-pilot`; personal profile rejects fixture/template provenance |
| sourceRevision | Full40lowercase Git SHA of producing code, not `latest` |
| identity | `{ownerRef, avatarVersion}`; pseudonymous references, no email/name needed |
| coordinates | `{unit:"meter",up:"+Y",front:"+Z",sharedTransformRef:"<common-transform-id>"}`; a declaration to inspect, not measured proof |
| artifacts |6–100records, unique id/role/file; required roles body/top/bottom/preview_front/preview_side/preview_back; optional lookbook |
| look | ownerRef/avatarVersion matching identity and bodyArtifactId/topArtifactId/bottomArtifactId referencing correct role records |
| measurements | wallSeconds>0, peakVramMiB>=0, peakRamMiB>=0, finite numeric; no bool/string/NaN |
| humanReview | status pending/changes-requested/approved; approved additionally requires reviewerRef and nonempty recordRef |

Each artifact record:

```json
{
  "id": "top-01",
  "role": "top",
  "ownerRef": "subject-01",
  "avatarVersion": "av-01",
  "assetVersion": "shirt-v1",
  "engineRevision": "engine-v1",
  "transformRef": "shared-frame-v1",
  "provenance": "personal-capture",
  "path": "assets/top.glb",
  "bytes": 123,
  "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
}
```

Example is a shape illustration, **not a valid artifact receipt**; use actual sizes/hashes and all required records. `provenance` means origin of source data, including renders derived from that source. Allowed: fixture/template/personal-capture. Identifiers use letters/digits/dot/underscore/hyphen, up to128chars, not secret or personal data. All paths relative POSIX-style inside evidence root, no symlink/absolute/Windows drive/traversal; files <=100MiB each. Duplicate JSON keys and non-finite JSON constants are rejected.

## This does not replace engine or app contract

The tool validates evidence files, SHA256/bytes and cross-record identity/slot/transform references. It intentionally **does not parse GLB, images or video**, measure scale/pose, verify provenance statements, authenticate human approval, or assess face likeness/texture/form/collision. A .bin synthetic file can test this tool; it is not evidence of a valid GLB. Use PC structural validators, Khronos/independent reload/render and actual app/DB/E2E QA as separate checks.

This is a review-tool format, not a new worker protocol or production schema. Claude does not need to change app API to adopt it; PC/Claude can generate a small local evidence manifest after exporting artifacts. Once real artifacts arrive, Codex runs the preflight then independently examines geometry/render/flow. Wrong or incomplete evidence fails fast before costly integration review.
