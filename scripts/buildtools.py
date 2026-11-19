import json
import subprocess

DEFAULT_MANIFEST = "src/manifest.json"


def readFileToJson(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def writeJsonToFile(path, obj):
    with open(path, "w+", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False, indent=4) + "\n")


def setManifestDesignWidth(width, path=DEFAULT_MANIFEST):
    manifest = readFileToJson(path)
    manifest["config"]["designWidth"] = width
    writeJsonToFile(path, manifest)


def setManifestVersion(version_name, version_code, path=DEFAULT_MANIFEST):
    manifest = readFileToJson(path)
    manifest["versionName"] = version_name
    manifest["versionCode"] = version_code
    writeJsonToFile(path, manifest)


def getGitCommitHash():
    result = subprocess.run(["git", "rev-parse", "HEAD"], capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"取提交号失败：{result.stderr.strip()}")
    return result.stdout.strip()[:7]
