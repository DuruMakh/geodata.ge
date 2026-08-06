import argparse
import hashlib
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path


MOF_BASE = "https://mof.ge"
DATA_URL = MOF_BASE + "/ka/GovBudget/GetData"
CATEGORIES = {
    1: "state_budget",
    3: "execution_report",
    4: "quarterly_plan",
}


def fetch_bytes(url: str) -> tuple[bytes, dict[str, str], str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Referer": "https://mof.ge/ka/govbudget",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read(), dict(response.headers.items()), response.geturl()


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def clean_label(raw: str) -> str:
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def extract_links(markup: str) -> list[dict[str, str]]:
    links = []
    for match in re.finditer(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', markup, flags=re.S | re.I):
        href, raw_label = match.groups()
        label = clean_label(raw_label)
        if not href.startswith("/files/download/"):
            continue
        absolute = urllib.parse.urljoin(MOF_BASE, href)
        links.append({"href": absolute, "label": label})

    deduped = []
    seen = set()
    for link in links:
        if link["href"] in seen:
            continue
        seen.add(link["href"])
        deduped.append(link)
    return deduped


def local_files(root: Path) -> list[dict[str, object]]:
    rows = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        data = path.read_bytes()
        year_match = re.search(r"(20\d{2}|19\d{2})", path.name)
        rows.append(
            {
                "relative_path": str(path).replace("\\", "/"),
                "file_name": path.name,
                "year_hint": int(year_match.group(1)) if year_match else None,
                "size": len(data),
                "sha256": sha256(data),
            }
        )
    return rows


def audit(root: Path, start_year: int, end_year: int) -> dict[str, object]:
    locals_ = local_files(root)
    local_by_hash = {row["sha256"]: row for row in locals_}
    results = {
        "official_index": "https://mof.ge/ka/govbudget",
        "official_endpoint": DATA_URL,
        "local_root": str(root).replace("\\", "/"),
        "years": {},
        "local_files": locals_,
    }

    for year in range(start_year, end_year + 1):
        year_result = {"categories": {}, "hash_matches": []}
        for category_id, category_name in CATEGORIES.items():
            url = f"{DATA_URL}?year={year}&categoryId={category_id}&showOnlyHidden=false"
            try:
                page_bytes, _, final_url = fetch_bytes(url)
            except Exception as exc:
                year_result["categories"][category_name] = {
                    "url": url,
                    "error": repr(exc),
                    "links": [],
                }
                continue

            markup = page_bytes.decode("utf-8", "replace")
            links = extract_links(markup)
            category = {
                "url": final_url,
                "links_count": len(links),
                "links": [],
            }

            for link in links:
                time.sleep(0.05)
                try:
                    file_bytes, headers, final_file_url = fetch_bytes(link["href"])
                    file_hash = sha256(file_bytes)
                    local_match = local_by_hash.get(file_hash)
                    row = {
                        "label": link["label"],
                        "href": final_file_url,
                        "content_type": headers.get("Content-Type"),
                        "content_disposition": headers.get("Content-Disposition"),
                        "size": len(file_bytes),
                        "sha256": file_hash,
                        "local_match": local_match["relative_path"] if local_match else None,
                    }
                    if local_match:
                        year_result["hash_matches"].append(
                            {
                                "category": category_name,
                                "label": link["label"],
                                "href": final_file_url,
                                "local_match": local_match["relative_path"],
                                "sha256": file_hash,
                            }
                        )
                except Exception as exc:
                    row = {
                        "label": link["label"],
                        "href": link["href"],
                        "error": repr(exc),
                    }
                category["links"].append(row)

            year_result["categories"][category_name] = category
        results["years"][str(year)] = year_result
    return results


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--start-year", type=int, default=2004)
    parser.add_argument("--end-year", type=int, default=2025)
    args = parser.parse_args()

    sys.stdout.reconfigure(encoding="utf-8")
    report = audit(Path(args.root), args.start_year, args.end_year)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {out}")
    for year, row in report["years"].items():
        matches = row["hash_matches"]
        print(f"{year}: {len(matches)} exact official hash match(es)")
        for match in matches[:5]:
            print(f"  - {match['category']}: {match['local_match']} :: {match['label'][:90]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
