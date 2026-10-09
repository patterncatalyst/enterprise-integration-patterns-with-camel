#!/usr/bin/env python3
"""Static content checks for the tutorial and its runnable examples.

Catches the classes of error that the Camel 4.22 upgrade surfaced only by
accident: endpoint URIs naming components that do not exist, YAML DSL routes
that do not match the schema's shape, and version-scoped documentation links
that rot on every upgrade.

    ./scripts/validate-content.py                 # offline checks
    ./scripts/validate-content.py --links         # also resolve external links
    ./scripts/validate-content.py --catalog PATH  # use a specific catalog jar

The component catalog is read from a camel-catalog jar so the check is pinned
to the same Camel version the examples build against, rather than to whatever
this script's author happened to remember.
"""

import argparse
import json
import pathlib
import re
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DEFAULT_CATALOG = "/tmp/camel-catalog-4.22.1.jar"
CATALOG_GAV = "org/apache/camel/camel-catalog/{v}/camel-catalog-{v}.jar"

# Endpoint URIs appear as from("x:.."), .to("x:.."), uri: "x:..", and friends.
JAVA_URI = re.compile(r'(?:from|toD?|enrich|pollEnrich|wireTap|interceptSendToEndpoint)\s*\(\s*"([a-zA-Z][\w+.-]*):')
YAML_URI = re.compile(r'^\s*uri:\s*["\']?([a-zA-Z][\w+.-]*):', re.M)
MD_LINK = re.compile(r'\]\((https?://[^)\s]+)\)')

# Schemes that are legitimately not Camel components.
NON_COMPONENT = {"http", "https", "classpath", "file", "jar", "ref", "bean"}


def load_schemes(catalog_path):
    p = pathlib.Path(catalog_path)
    if not p.exists():
        return None
    schemes = set()
    with zipfile.ZipFile(p) as z:
        for name in z.namelist():
            if re.match(r".*/components/[a-z0-9-]+\.json$", name):
                comp = json.loads(z.read(name)).get("component", {})
                if comp.get("scheme"):
                    schemes.add(comp["scheme"])
                if comp.get("alternativeSchemes"):
                    schemes.update(comp["alternativeSchemes"].split(","))
    return schemes


def iter_files(*globs):
    for g in globs:
        for p in sorted(ROOT.glob(g)):
            # Skip build output and the runtime working directories the Camel
            # CLI and Citrus create next to the examples.
            if any(part == "_site" or part == "target" or part.startswith(".")
                   for part in p.parts):
                continue
            yield p


def check_schemes(schemes, findings):
    """Every endpoint URI must name a component that exists in the catalog."""
    if schemes is None:
        findings.append(("catalog", "-", "camel-catalog jar not found; scheme check skipped"))
        return

    def scan(path, pattern, text):
        for m in pattern.finditer(text):
            scheme = m.group(1)
            if scheme in NON_COMPONENT or scheme in schemes:
                continue
            line = text[: m.start()].count("\n") + 1
            findings.append(
                ("scheme", f"{path.relative_to(ROOT)}:{line}", f"unknown component '{scheme}:'")
            )

    for p in iter_files("examples/**/*.java", "_docs/*.md", "README.md", "GETTING-STARTED.md"):
        scan(p, JAVA_URI, p.read_text(encoding="utf-8", errors="replace"))
    for p in iter_files("examples/**/*.yaml", "_docs/*.md"):
        scan(p, YAML_URI, p.read_text(encoding="utf-8", errors="replace"))


def check_yaml_shape(findings):
    """In the YAML DSL, `steps` belongs inside `from`, not beside it."""
    for p in iter_files("examples/**/*.yaml"):
        if p.name == "compose.yaml":
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        f = re.search(r"^(\s*)from:", text, re.M)
        s = re.search(r"^(\s*)steps:", text, re.M)
        if not (f and s):
            continue
        if len(s.group(1)) <= len(f.group(1)):
            line = text[: s.start()].count("\n") + 1
            findings.append(
                ("yaml-shape", f"{p.relative_to(ROOT)}:{line}",
                 "`steps:` is a sibling of `from:`; the schema requires it nested inside")
            )


def check_stale_versions(findings):
    """Version strings that should have moved with the upgrade."""
    stale = {
        # Matches both components/4.20.x/ and the unpinned components/4.x/ form.
        r"components/4\.(?!22\.x)(?:\d+\.)?x/": "version-scoped Camel doc link is not 4.22.x",
        r"\b4\.20\.0\b": "stale Camel version 4.20.0",
        r"\b3\.37\.0\b": "stale Quarkus version 3.37.0",
        r"\b4\.0\.7\b": "stale Spring Boot version 4.0.7",
        r"redis-lettuce": "redis-lettuce is not a Camel component; use spring-redis",
    }
    for p in iter_files("_docs/*.md", "README.md", "GETTING-STARTED.md",
                        "examples/**/*.java", "examples/**/*.yaml",
                        "examples/**/*.properties", "examples/**/pom.xml"):
        text = p.read_text(encoding="utf-8", errors="replace")
        for pat, msg in stale.items():
            for m in re.finditer(pat, text):
                line = text[: m.start()].count("\n") + 1
                findings.append(("stale", f"{p.relative_to(ROOT)}:{line}", msg))


CAMEL_COMPONENT_PROP = re.compile(r"^\s*(camel\.component\.([a-z0-9-]+))\.", re.M)


def check_config_keys(schemes, findings):
    """camel.component.<name>.* must name a component that exists."""
    if schemes is None:
        return
    for p in iter_files("examples/**/*.properties", "_docs/*.md",
                        "examples/**/*.yaml", "README.md", "GETTING-STARTED.md"):
        text = p.read_text(encoding="utf-8", errors="replace")
        for m in CAMEL_COMPONENT_PROP.finditer(text):
            key, comp = m.group(1), m.group(2)
            if comp in schemes:
                continue
            line = text[: m.start()].count("\n") + 1
            findings.append(
                ("config-key", f"{p.relative_to(ROOT)}:{line}",
                 f"'{key}' names component '{comp}', which is not in the catalog")
            )


def check_links(findings):
    import urllib.error
    import urllib.request

    seen = {}
    for p in iter_files("_docs/*.md", "README.md", "GETTING-STARTED.md"):
        text = p.read_text(encoding="utf-8", errors="replace")
        for m in MD_LINK.finditer(text):
            url = m.group(1)
            # Dashboard URLs the reader opens against their own stack, not links to resolve.
            if re.match(r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)([:/]|$)", url):
                continue
            line = text[: m.start()].count("\n") + 1
            if url not in seen:
                req = urllib.request.Request(url, method="HEAD",
                                             headers={"User-Agent": "eip-link-check"})
                try:
                    with urllib.request.urlopen(req, timeout=20) as r:
                        seen[url] = r.status
                except urllib.error.HTTPError as e:
                    seen[url] = e.code
                except Exception as e:
                    seen[url] = type(e).__name__
            status = seen[url]
            if status != 200:
                findings.append(("link", f"{p.relative_to(ROOT)}:{line}", f"{status}  {url}"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--links", action="store_true", help="resolve external links (slow, network)")
    ap.add_argument("--catalog", default=DEFAULT_CATALOG, help="path to a camel-catalog jar")
    args = ap.parse_args()

    findings = []
    schemes = load_schemes(args.catalog)
    if schemes:
        print(f"catalog: {len(schemes)} component schemes from {args.catalog}")
    else:
        print(f"catalog: NOT FOUND at {args.catalog}")
        print(f"  fetch with: curl -sO https://repo1.maven.org/maven2/{CATALOG_GAV.format(v='4.22.1')}")

    check_schemes(schemes, findings)
    check_yaml_shape(findings)
    check_stale_versions(findings)
    check_config_keys(schemes, findings)
    if args.links:
        check_links(findings)

    if not findings:
        print("\nNo findings.")
        return 0

    by_kind = {}
    for kind, loc, msg in findings:
        by_kind.setdefault(kind, []).append((loc, msg))
    print()
    for kind in sorted(by_kind):
        print(f"{kind}  ({len(by_kind[kind])})")
        for loc, msg in by_kind[kind]:
            print(f"  {loc}\n      {msg}")
        print()
    print(f"{len(findings)} finding(s)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
