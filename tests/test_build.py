import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("build", ROOT / "scripts/build.py")
build = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(build)


class BundleTests(unittest.TestCase):
    def test_platform_layouts_and_auth(self):
        for target in build.TARGETS:
            with self.subTest(target=target):
                _, files = build.package_files(ROOT, target)
                if target == "claude":
                    self.assertIn(".claude-plugin/plugin.json", files)
                    self.assertNotIn("plugin.json", files)
                    self.assertNotIn("mcp.json", files)
                    server = json.loads(files[".mcp.json"])["mcpServers"]["tactic"]
                    self.assertEqual(server["type"], "http")
                else:
                    self.assertIn("plugin.json", files)
                    self.assertNotIn(".claude-plugin/plugin.json", files)
                    server = json.loads(files["mcp.json"])["mcpServers"]["tactic"]
                    self.assertEqual(server["type"], "streamable-http")
                self.assertEqual(server["url"], "https://ai.gettactic.com/mcp")
                if target == "chatgpt":
                    auth = server["extensions"]["com.openai"]["auth"]
                    self.assertEqual(auth["type"], "oauth")
                    self.assertEqual(auth["client"], {"mode": "dcr"})
                    self.assertEqual(auth["baseScopes"], ["tactic", "offline_access"])
                else:
                    self.assertNotIn("extensions", server)

    def test_identical_skills_and_resolved_asset_paths(self):
        expected = {p.relative_to(ROOT).as_posix(): p.read_bytes()
                    for p in (ROOT / "skills").rglob("*.md")}
        self.assertGreaterEqual(len(expected), 2)
        for target in build.TARGETS:
            _, files = build.package_files(ROOT, target)
            self.assertEqual({k: v for k, v in files.items() if k.startswith("skills/")}, expected)
        _, files = build.package_files(ROOT, "chatgpt")
        interface = json.loads(files["plugin.json"])["extensions"]["com.openai"]["interface"]
        for key in ("logo", "composerIcon"):
            self.assertIn(interface[key].removeprefix("./"), files)

    def test_archives_are_deterministic_and_have_no_wrapper(self):
        with tempfile.TemporaryDirectory() as temp:
            for target in build.TARGETS:
                _, files = build.package_files(ROOT, target)
                first, second = Path(temp) / "first.zip", Path(temp) / "second.zip"
                build.write_zip(first, files)
                build.write_zip(second, files)
                self.assertEqual(first.read_bytes(), second.read_bytes())
                with zipfile.ZipFile(first) as archive:
                    self.assertIsNone(archive.testzip())
                    self.assertEqual(set(archive.namelist()), set(files))
                    for name in files:
                        self.assertEqual(archive.read(name), files[name])

    def test_check_detects_stale_and_extra_files_without_writing(self):
        with tempfile.TemporaryDirectory() as temp:
            directory = Path(temp) / "bundle"
            files = {"plugin.json": b"{}"}
            self.assertFalse(build.sync_bundle(directory, files, check=True))
            self.assertFalse(directory.exists())
            build.sync_bundle(directory, files, check=False)
            self.assertTrue(build.sync_bundle(directory, files, check=True))
            extra = directory / "unexpected.txt"
            extra.write_text("stale")
            self.assertFalse(build.sync_bundle(directory, files, check=True))
            self.assertTrue(extra.exists())
            build.sync_bundle(directory, files, check=False)
            self.assertFalse(extra.exists())

    def test_unrelated_files_are_not_packaged(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for directory in ("skills", "platforms", "assets"):
                shutil.copytree(ROOT / directory, root / directory)
            for name in ("plugin.json", "mcp.json", "LICENSE"):
                shutil.copy(ROOT / name, root / name)
            skill = root / "skills/tactic-plan-office-week"
            (root / ".env").write_text("TOKEN=not-a-real-secret")
            (skill / "debug.json").write_text("{}")
            (skill / "run.sh").write_text("echo unwanted")
            (skill / ".private.md").write_text("private")
            _, files = build.package_files(root, "portable")
            self.assertFalse(any(".env" in name or "debug" in name or "run.sh" in name
                                 or ".private" in name for name in files))

    def test_symlinked_skill_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for directory in ("platforms", "assets"):
                shutil.copytree(ROOT / directory, root / directory)
            for name in ("plugin.json", "mcp.json", "LICENSE"):
                shutil.copy(ROOT / name, root / name)
            (root / "skills").mkdir()
            (root / "skills/external").symlink_to(ROOT / "skills/tactic-plan-office-week")
            with self.assertRaisesRegex(ValueError, "Expected a skill directory"):
                build.package_files(root, "portable")


if __name__ == "__main__":
    unittest.main()
