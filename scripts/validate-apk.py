#!/usr/bin/env python3
"""Fail the build if an APK does not actually contain the offline HMI.

A launcher that builds but ships no bundle installs perfectly and then
shows the recovery panel on the head unit, which is an expensive way to
discover a packaging mistake. These checks are cheap and catch it in CI.
"""

import sys
import zipfile

REQUIRED = [
    "AndroidManifest.xml",
    "classes.dex",
    "assets/web/index.html",
    # The approved startup sequence and its Arabic type. If either is
    # missing the HMI still runs, but not as the design was approved.
    "assets/web/brand/mustang-pony.webp",
    "assets/web/fonts/plex-arabic.css",
]


def main(path: str) -> int:
    problems = []
    with zipfile.ZipFile(path) as apk:
        names = set(apk.namelist())

        for required in REQUIRED:
            if required not in names:
                problems.append(f"missing {required}")

        if not any(n.startswith("assets/web/assets/") and n.endswith(".js") for n in names):
            problems.append("no bundled JavaScript under assets/web/assets/")
        if not any(n.startswith("assets/web/assets/") and n.endswith(".css") for n in names):
            problems.append("no bundled CSS under assets/web/assets/")
        if not any(n.endswith(".woff2") for n in names):
            problems.append("no web fonts bundled")

        if "assets/web/index.html" in names:
            index = apk.read("assets/web/index.html").decode("utf-8", "replace")
            # The inline black first paint is the start of the approved
            # startup chain. Losing it reintroduces a white flash. The
            # production build minifies this, so match without spaces.
            squashed = "".join(index.split())
            if "background:#000" not in squashed:
                problems.append("index.html has no inline black first paint")
            if "color-scheme:dark" not in squashed:
                problems.append("index.html does not settle the UA canvas to dark")
            if "http://" in index or "https://" in index:
                problems.append("index.html references a remote URL; the UI must be offline")

    if problems:
        print(f"APK validation FAILED for {path}", file=sys.stderr)
        for problem in problems:
            print(f"  - {problem}", file=sys.stderr)
        return 1

    print(f"APK OK: manifest, dex, offline HMI, fonts and pony present in {path}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: validate-apk.py <path-to.apk>", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(main(sys.argv[1]))
