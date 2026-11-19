#!/usr/bin/env python3
"""编译单份 rpk：写入设计宽度（可选版本号），清理旧产物，再调 aiot 打包。

用法：
    python3 scripts/build.py --width 466 --label S3S4
    python3 scripts/build.py --width 432 --label RW5 --version 2.5.1

产物落在 out/ 下，文件名带版本号和机型后缀，方便直接传到 release。
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import buildtools

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "src" / "manifest.json"
DIST = ROOT / "dist"
OUT = ROOT / "out"
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def parse_args(argv):
    parser = argparse.ArgumentParser(description="编译 HyperBilibili 的 rpk")
    parser.add_argument("--width", type=int, required=True, help="设计宽度，比如 466")
    parser.add_argument("--label", default="", help="产物名后缀，比如 S3S4")
    parser.add_argument("--version", default=os.environ.get("VERSION", ""), help="版本号，比如 2.5.1；不填就不改版本")
    parser.add_argument("--dry-run", action="store_true", help="只改 manifest，不编译")
    return parser.parse_args(argv)


def to_version_code(version):
    matched = SEMVER.match(version)
    if not matched:
        raise SystemExit(f"版本号格式不对：{version}，应该是 2.5.1 这种")
    major, minor, patch = (int(part) for part in matched.groups())
    return major * 10000 + minor * 100 + patch


def run_build():
    code = subprocess.run("yarn run build", cwd=ROOT, shell=True).returncode
    if code != 0:
        raise SystemExit(f"编译失败，yarn run build 退出码 {code}")


def find_rpk():
    rpks = sorted(DIST.rglob("*.rpk"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not rpks:
        raise SystemExit("编译结束了，但 dist 里没有 rpk")
    return rpks[0]


def main(argv=None):
    args = parse_args(argv)
    version = args.version.strip()
    code = to_version_code(version) if version else None

    buildtools.setManifestDesignWidth(args.width, str(MANIFEST))
    if version:
        buildtools.setManifestVersion(version, code, str(MANIFEST))

    summary = f"设计宽度 {args.width}"
    if version:
        summary += f"，版本 {version}（versionCode {code}）"
    print(summary)

    if args.dry_run:
        return 0

    for path in (DIST, OUT):
        if path.exists():
            shutil.rmtree(path)
    OUT.mkdir(parents=True, exist_ok=True)

    run_build()

    name_version = version or f"dev-{buildtools.getGitCommitHash()}"
    suffix = f"-{args.label}" if args.label else ""
    target = OUT / f"HyperBilibili-{name_version}{suffix}.rpk"
    shutil.copyfile(find_rpk(), target)
    print(f"产物：{target.relative_to(ROOT)}（{target.stat().st_size // 1024} KB）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
