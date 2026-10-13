#!/usr/bin/env python3
"""Build host-specific Tactic plugins from shared sources using only stdlib."""

import argparse
import copy
import hashlib
import json
from pathlib import Path
import re
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TARGETS = ("portable", "chatgpt", "claude")


def json_bytes(value):
    return (json.dumps(value, indent=2, ensure_ascii=False) + "\n").encode()


def read_json(root, path):
    return json.loads((root / path).read_text())


def read_file(path):
    if path.is_symlink():
        raise ValueError(f"Symlinks are not bundle sources: {path}")
    return path.read_bytes()


def package_files(root, target):
    if target not in TARGETS:
        raise ValueError(f"Unknown target: {target}")
    manifest = read_json(root, "plugin.json")
    mcp = read_json(root, "mcp.json")
    version = manifest.get("version", "")
    if not re.fullmatch(r"\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?", version):
        raise ValueError("plugin.json needs a filename-safe semantic version")
    if manifest.get("name") != "tactic":
        raise ValueError("The published plugin identity must remain tactic")

    files = {
        "README.md": read_file(root / "platforms/bundle-readme.md"),
        "LICENSE": read_file(root / "LICENSE"),
        "assets/icon.png": read_file(root / "assets/icon.png"),
    }
    skill_dirs = sorted((root / "skills").iterdir())
    if not skill_dirs:
        raise ValueError("At least one skill is required")
    for skill in skill_dirs:
        if skill.name.startswith("."):
            continue
        if skill.is_symlink() or not skill.is_dir():
            raise ValueError(f"Expected a skill directory: {skill}")
        entry = skill / "SKILL.md"
        content = read_file(entry).decode()
        if not content.startswith("---\n") or "\n---\n" not in content[4:]:
            raise ValueError(f"Missing frontmatter: {entry}")
        frontmatter = content.split("---", 2)[1]
        if not re.search(rf"^name: {re.escape(skill.name)}$", frontmatter, re.M):
            raise ValueError(f"Skill name must match its folder: {entry}")
        if not re.search(r"^description: \S.+$", frontmatter, re.M):
            raise ValueError(f"Missing skill description: {entry}")
        files[entry.relative_to(root).as_posix()] = content.encode()
        # Package only explicitly supported instruction resources, never arbitrary
        # working-directory files, caches, credentials, scripts, or nested archives.
        refs = skill / "references"
        if refs.is_symlink():
            raise ValueError(f"Symlinks are not bundle sources: {refs}")
        if refs.exists():
            for path in sorted(refs.rglob("*")):
                if path.is_symlink():
                    raise ValueError(f"Symlinks are not bundle sources: {path}")
                if path.is_file() and path.suffix == ".md" and not any(
                    part.startswith(".") for part in path.relative_to(refs).parts
                ):
                    files[path.relative_to(root).as_posix()] = read_file(path)

    if target == "claude":
        claude = {key: value for key, value in manifest.items() if key != "$schema"}
        files[".claude-plugin/plugin.json"] = json_bytes(claude)
        servers = copy.deepcopy(mcp["mcpServers"])
        for server in servers.values():
            if server["type"] != "streamable-http":
                raise ValueError("Claude adapter currently supports remote HTTP only")
            server["type"] = "http"
        files[".mcp.json"] = json_bytes({"mcpServers": servers})
    else:
        if target == "chatgpt":
            manifest["extensions"] = {"com.openai": read_json(root, "platforms/openai.json")}
            mcp["mcpServers"]["tactic"]["extensions"] = {
                "com.openai": read_json(root, "platforms/openai-auth.json")
            }
        files["plugin.json"] = json_bytes(manifest)
        files["mcp.json"] = json_bytes(mcp)
    return version, files


def write_zip(path, files):
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(2020, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, data, compresslevel=9)


def sync_bundle(directory, files, check):
    if directory.is_symlink():
        raise ValueError(f"Refusing a symlinked output directory: {directory}")
    actual = {}
    if directory.exists():
        for path in directory.rglob("*"):
            if path.is_symlink():
                raise ValueError(f"Refusing symlinked output: {path}")
            if path.is_file():
                actual[path.relative_to(directory).as_posix()] = path.read_bytes()
    if actual == files:
        return True
    if check:
        return False
    # This directory is generated and owned by this builder.
    if directory.exists():
        shutil.rmtree(directory)
    for name, data in files.items():
        path = directory / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Check tracked bundles without writing")
    args = parser.parse_args()
    stale = []
    checksums = []
    for target in TARGETS:
        version, files = package_files(ROOT, target)
        directory = ROOT / "bundles" / target
        if not sync_bundle(directory, files, args.check):
            stale.append(target)
        if not args.check:
            dist = ROOT / "dist"
            dist.mkdir(exist_ok=True)
            path = dist / f"tactic-{target}-{version}.zip"
            write_zip(path, files)
            checksums.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {path.name}\n")
            print(path.relative_to(ROOT))
    if args.check:
        if stale:
            parser.exit(1, f"Stale bundles: {', '.join(stale)}; run python3 scripts/build.py\n")
        print("All tracked bundles match shared sources.")
    else:
        (ROOT / "dist/SHA256SUMS").write_text("".join(checksums))


if __name__ == "__main__":
    main()
