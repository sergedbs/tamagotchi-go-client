"""Validate bundled local links, contract tables and snapshot integrity."""

import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]


def anchors(text):
    result = set()
    for heading in re.findall(r"^#{1,6} (.+)$", text, re.MULTILINE):
        label = re.sub(r"[^\w\s-]", "", heading.lower()).replace(" ", "-")
        result.add(label)
    return result


def check():
    errors = []
    markdown = [p for p in ROOT.rglob("*.md")
                if not {"node_modules", ".git", "dist", ".local"}.intersection(p.relative_to(ROOT).parts)]
    for path in markdown:
        text = path.read_text()
        for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", text):
            parsed = urlsplit(target)
            if parsed.scheme or target.startswith("<"):
                continue
            destination = (path.parent / unquote(parsed.path)).resolve() if parsed.path else path
            if not destination.is_relative_to(ROOT) or not destination.is_file():
                errors.append(f"{path.relative_to(ROOT)}: missing local link {target}")
            elif parsed.fragment and parsed.fragment not in anchors(destination.read_text()):
                errors.append(f"{path.relative_to(ROOT)}: missing anchor {target}")
        if "\u2014" in text:
            errors.append(f"{path.relative_to(ROOT)}: em dash")

    snapshot = json.loads((ROOT / "docs/CONTRACT_SNAPSHOT.json").read_text())
    for key, expected in snapshot["bundled_files"].items():
        name = key.removesuffix("_sha256")
        actual = hashlib.sha256((ROOT / "docs" / name).read_bytes()).hexdigest()
        if actual != expected:
            errors.append(f"Snapshot checksum differs for {name}; record intentional changes")

    payloads = (ROOT / "docs/PAYLOADS.md").read_text()
    shapes = set(re.findall(r"^### (\w+)\s*$", payloads, re.MULTILINE))
    if len(shapes) != snapshot["payload_shape_count"]:
        errors.append("Payload count differs from snapshot")
    rows = snapshot["endpoints"]
    if len(rows) != snapshot["endpoint_count"]:
        errors.append("Endpoint count differs from snapshot")
    unique = {(row["method"], row["path"]) for row in rows}
    if len(unique) != len(rows):
        errors.append("Duplicate endpoint method/path in snapshot")
    api = (ROOT / "docs/API.md").read_text()
    for row in rows:
        if f'`{row["method"]} {row["path"]}`' not in api:
            errors.append(f'Endpoint absent from API.md: {row["method"]} {row["path"]}')
        for column in ("request", "response"):
            content = re.sub(r"Idempotency-Key|If-Match|X-Service-Secret", "", row[column])
            for name in re.findall(r"\b[A-Z][A-Za-z]+\b", content):
                if name in {"Idempotency", "Key", "If", "Match", "WebSocket", "Bearer", "JSON"}:
                    continue
                if name not in shapes:
                    errors.append(f'Unknown payload {name} at {row["path"]}')

    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"Specification OK: {len(markdown)} documents, {len(rows)} endpoints, {len(shapes)} payload definitions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(check())
