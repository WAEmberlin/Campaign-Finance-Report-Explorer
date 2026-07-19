import re
import urllib.request

raw = urllib.request.urlopen(
    "http://www.kansas.gov/ethics/CFAScanned/House/2026ElecCycle/HLinks2026EC.htm",
    timeout=60,
).read().decode("latin-1", "replace")
for h in sorted(set(re.findall(r"H070[A-Z0-9_./-]+\.pdf", raw, re.I))):
    print(h)
