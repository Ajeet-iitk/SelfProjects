#!/usr/bin/env python3
"""
Finds a screenshot for every public repository and writes
assets/data/thumbs.json  ->  { "repo-name-lowercase": "https://...image url" }

Where it looks, best first:
  1. An image used in the repo's README (a "screenshot"-style name wins over
     badges, logos and icons).
  2. Image files in the repo, scored by folder and file name
     (screenshots/, docs/, images/, assets/, preview, demo, cover, home...).

Run by .github/workflows/sync-repos.yml with a token, so the GitHub API rate
limit is not a problem. Thumbnails committed to this site's thumbnails/ folder
still take priority in the browser; this only fills the gaps.
"""

import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

TOKEN = os.environ.get("GH_TOKEN", "")
OWNER = os.environ.get("OWNER", "")
IMG_EXT = (".png", ".jpg", ".jpeg", ".webp", ".gif")
MIN_BYTES = 6 * 1024
MAX_BYTES = 6 * 1024 * 1024

GOOD_NAME = re.compile(r"screenshot|screen[-_ ]?shot|preview|demo|thumb|cover|banner|hero|gameplay|snap|home|main|interface", re.I)
GOOD_DIR = re.compile(r"(^|/)(screenshots?|screens?|docs?|images?|img|media|preview|previews|assets|pics|pictures|gallery)(/|$)", re.I)
BAD = re.compile(r"icon|favicon|logo|sprite|avatar|badge|shield|texture|font|node_modules|vendor|dist/|build/|\.github|tile|emoji|button|arrow|cursor|flag|\bbg\b|background|android-chrome|apple-touch|manifest|splash", re.I)


def api(path):
    req = urllib.request.Request(
        "https://api.github.com" + path,
        headers={
            "Accept": "application/vnd.github+json",
            "User-Agent": "portfolio-thumb-finder",
            **({"Authorization": f"Bearer {TOKEN}"} if TOKEN else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code in (403, 429):
            print("rate limited, stopping early", file=sys.stderr)
            raise
        return None
    except Exception:
        return None


def get_text(url):
    req = urllib.request.Request(url, headers={"User-Agent": "portfolio-thumb-finder"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.read().decode("utf-8", "replace")
    except Exception:
        return ""


def raw_url(repo, branch, path):
    quoted = "/".join(urllib.parse.quote(p) for p in path.split("/"))
    return f"https://raw.githubusercontent.com/{OWNER}/{repo}/{branch}/{quoted}"


def score_path(path, size):
    if BAD.search(path):
        return -1
    name = path.rsplit("/", 1)[-1]
    s = 1
    if GOOD_NAME.search(name):
        s += 6
    if GOOD_DIR.search(path):
        s += 4
    depth = path.count("/")
    s -= min(depth, 4) * 0.4
    if size > 60 * 1024:
        s += 1
    if size > 250 * 1024:
        s += 1
    if name.lower().endswith(".gif"):
        s -= 1
    return s


def from_readme(repo, branch, tree_paths):
    data = api(f"/repos/{OWNER}/{repo}/readme")
    if not data or not data.get("download_url"):
        return None
    text = get_text(data["download_url"])
    if not text:
        return None

    refs = re.findall(r"!\[[^\]]*\]\(\s*<?([^)\s>]+)", text)
    refs += re.findall(r"<img[^>]+src=[\"']([^\"']+)[\"']", text, re.I)

    best = None
    best_score = -1
    base_dir = (data.get("path") or "README.md").rsplit("/", 1)[0] if "/" in (data.get("path") or "") else ""
    for i, ref in enumerate(refs):
        ref = ref.strip()
        if BAD.search(ref) and not GOOD_NAME.search(ref):
            continue
        if ref.startswith("data:"):
            continue
        if ref.startswith("http://") or ref.startswith("https://"):
            clean = ref.split("?")[0].lower()
            looks_img = clean.endswith(IMG_EXT) or "user-attachments" in clean or "githubusercontent" in clean
            if not looks_img or "shields.io" in clean or "badge" in clean:
                continue
            url = ref
            path_for_score = clean
        else:
            rel = ref.split("?")[0].split("#")[0].lstrip("./")
            if not rel.lower().endswith(IMG_EXT):
                continue
            full = (base_dir + "/" + rel).lstrip("/") if base_dir else rel
            if full not in tree_paths and rel not in tree_paths:
                continue
            full = full if full in tree_paths else rel
            url = raw_url(repo, branch, full)
            path_for_score = full
        sc = 3 + (6 if GOOD_NAME.search(path_for_score) else 0) - i * 0.15
        if sc > best_score:
            best, best_score = url, sc
    return best


def main():
    repos = json.load(open("assets/data/repos.json", encoding="utf-8"))
    old = {}
    try:
        old = json.load(open("assets/data/thumbs.json", encoding="utf-8"))
    except Exception:
        pass

    out = {}
    try:
        for d in repos:
            if d.get("fork") or d.get("archived") or d.get("private") or not d.get("size"):
                continue
            name = d["name"]
            branch = d.get("default_branch") or "main"

            tree = api(f"/repos/{OWNER}/{name}/git/trees/{urllib.parse.quote(branch)}?recursive=1")
            if not tree or "tree" not in tree:
                if name.lower() in old:
                    out[name.lower()] = old[name.lower()]
                continue

            files = {
                t["path"]: t.get("size", 0)
                for t in tree["tree"]
                if t.get("type") == "blob"
                and t["path"].lower().endswith(IMG_EXT)
                and MIN_BYTES <= t.get("size", 0) <= MAX_BYTES
            }

            url = from_readme(name, branch, files)
            if not url:
                scored = sorted(
                    ((score_path(p, s), p) for p, s in files.items()), reverse=True
                )
                if scored and scored[0][0] > 0:
                    url = raw_url(name, branch, scored[0][1])

            if url:
                out[name.lower()] = url
                print(f"{name}: {url}")
            else:
                print(f"{name}: no screenshot found")
    except Exception as e:  # rate limit: keep whatever we had
        print("stopped early:", e, file=sys.stderr)
        for k, v in old.items():
            out.setdefault(k, v)

    with open("assets/data/thumbs.json", "w", encoding="utf-8") as f:
        json.dump(dict(sorted(out.items())), f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    main()
