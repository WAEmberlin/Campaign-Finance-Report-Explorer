"""Scrape KPDC House 2026 page for District 70 candidate report links."""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

URL = "http://www.kansas.gov/ethics/CFAScanned/House/2026ElecCycle/HLinks2026EC.htm"
BASE = "http://www.kansas.gov/ethics/CFAScanned/House/2026ElecCycle/"
NAMES = ["Kilmer, Kylie", "Rein, Brandon", "Wilson, Greg"]


def main() -> None:
    raw = urllib.request.urlopen(URL, timeout=60).read().decode("latin-1", errors="replace")
    out = {}
    for name in NAMES:
        idx = raw.find(name)
        chunk = raw[max(0, idx - 800) : idx + 5000]
        hrefs = re.findall(r'href=["\']([^"\']+)["\']', chunk, re.I)
        abs_hrefs = []
        for h in hrefs:
            if h.startswith("http"):
                abs_hrefs.append(h)
            elif h.startswith("/"):
                abs_hrefs.append("http://www.kansas.gov" + h)
            else:
                abs_hrefs.append(urllib.parse.urljoin(BASE, h))
        out[name] = {
            "index": idx,
            "hrefs": abs_hrefs[:30],
            "snippet": re.sub(r"\s+", " ", chunk)[:1200],
        }
        print("====", name)
        for h in abs_hrefs[:30]:
            print(" ", h)

    Path("scripts/d70_scrape.json").write_text(json.dumps(out, indent=2), encoding="utf-8")


if __name__ == "__main__":
    import urllib.parse

    main()
