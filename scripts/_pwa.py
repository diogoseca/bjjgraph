"""Shared PWA inputs; no Android keys or account credentials belong in this tree.

The template's example package and all-zero certificate intentionally verify NO app.
Set BOTH public build variables TWA_PACKAGE_ID and TWA_SHA256_CERT_FINGERPRINTS
(comma-separated SHA-256 certificates, or one per line) after owner confirmation.
Use the Play APP SIGNING certificate(s), not just the upload certificate; a sideloaded
build may need its own certificate. Multiple certificates support those cases and
key rotation. The manifest id '/' identifies the web install, not the Android app.

Both deploy workflows pass the same variables to emitter + checker. --release rejects
placeholders; it is a local artifact check, not proof of HTTPS/DAL/device verification.
"""
from __future__ import annotations

import json
import os
import re
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / "pwa"
DEFAULT_OUTPUT = ROOT / "source" / "public"
PLACEHOLDER_PACKAGE = "org.example.bjjgraph"
PLACEHOLDER_CERT = ":".join(["00"] * 32)
FINGERPRINT = re.compile(r"(?:[0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}")
PACKAGE = re.compile(r"[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+")


def manifest() -> dict:
    return json.loads((INPUT / "manifest.json").read_text())


def asset_links(release: bool = False) -> list:
    links = json.loads((INPUT / "assetlinks.template.json").read_text())
    package = os.environ.get("TWA_PACKAGE_ID", "").strip()
    certificates = os.environ.get("TWA_SHA256_CERT_FINGERPRINTS", "").strip()
    if bool(package) != bool(certificates):
        raise ValueError("Set BOTH TWA_PACKAGE_ID and TWA_SHA256_CERT_FINGERPRINTS, or neither")
    if package:
        if not PACKAGE.fullmatch(package) or len(package) > 255:
            raise ValueError("TWA_PACKAGE_ID must be a valid Android application ID")
        fingerprints = [s.strip().upper() for s in re.split(r"[,\n]", certificates)]
        if not fingerprints or any(not FINGERPRINT.fullmatch(s) for s in fingerprints):
            raise ValueError("TWA_SHA256_CERT_FINGERPRINTS must contain colon-separated 32-byte SHA-256 values")
        if PLACEHOLDER_CERT in fingerprints or package == PLACEHOLDER_PACKAGE:
            raise ValueError("Configured Android identity must not contain the example package or zero certificate")
        links[0]["target"]["package_name"] = package
        links[0]["target"]["sha256_cert_fingerprints"] = list(dict.fromkeys(fingerprints))
    elif release:
        raise ValueError("Release requires owner-confirmed TWA_PACKAGE_ID and TWA_SHA256_CERT_FINGERPRINTS; placeholders cannot verify a TWA")
    return links


def png_size(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError(f"Not a PNG: {path}")
    return struct.unpack(">II", data[16:24])


def icon_path(icon: dict) -> Path:
    # All install icons are same-origin assets, outside Quartz's input static tree:
    # only the final copies are emitted, after the engine clears its output.
    src = icon["src"]
    if not re.fullmatch(r"/static/pwa/[a-z0-9-]+\.png", src):
        raise ValueError(f"PWA icon must be a local /static/pwa/*.png path: {src}")
    return Path(src.lstrip("/"))
