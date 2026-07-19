"""
Parse Kylie Kilmer H070KK_202601.txt into Schedule A/C rows.

Electronic KS PDFs list Primary totals, then General $0s, then Amount (same as
Primary). Continuation pages omit the "Amount" label. Use one amount run per
page matching the date count (never both Primary + Amount).
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TXT = ROOT / "data/reports/_pdf_cache/H070KK_202601.txt"
OUT = ROOT / "data/reports/h070kk-202601.json"

MONEY_LINE = re.compile(r"^\$([0-9,]+\.\d{2})\|?\]?$")
DATE_LINE = re.compile(r"^(\d{1,2}/\d{1,2}/\d{2,4})$")
ZIP_LINE = re.compile(r"^\d{5}(-\d{4})?$")


def iso(d: str) -> str:
    m, d2, y = d.split("/")
    yi = int(y)
    if yi < 100:
        yi += 2000
    return f"{yi:04d}-{int(m):02d}-{int(d2):02d}"


# PDF text extraction often truncates long PAC names mid-label.
DONOR_REPAIRS = {
    "democratic house": "Kansans for a Democratic House PAC",
    "kansans for a democratic house": "Kansans for a Democratic House PAC",
}


def repair_donor_name(name: str) -> str:
    key = re.sub(r"\s+", " ", name).strip().lower()
    return DONOR_REPAIRS.get(key, name)


def money_values(page: str) -> list[float]:
    vals = []
    for ln in page.splitlines():
        ln = ln.strip().replace("|", "").replace("]", "")
        m = re.fullmatch(r"\$([0-9,]+\.\d{2})", ln)
        if m:
            vals.append(float(m.group(1).replace(",", "")))
        elif re.fullmatch(r"\$0\.00.", ln):  # OCR junk $0.001 etc.
            vals.append(0.0)
    return vals


def amount_run_for_dates(money: list[float], n_dates: int) -> list[float]:
    """Pick the Primary/Amount run that matches n_dates (not both)."""
    if n_dates <= 0:
        return []
    runs: list[list[float]] = []
    run: list[float] = []
    for v in money:
        if v > 0:
            run.append(v)
        else:
            if run:
                runs.append(run)
                run = []
    if run:
        runs.append(run)

    # Drop trailing period-total junk (e.g. $4260 alone or oversized runs)
    runs = [r for r in runs if 1 < len(r) <= n_dates + 2]

    exact = [r for r in runs if len(r) == n_dates]
    if exact:
        return exact[0]  # Primary; identical to Amount
    # Closest length without including period total
    if runs:
        best = min(runs, key=lambda r: (abs(len(r) - n_dates), -len(r)))
        if abs(len(best) - n_dates) <= 1:
            return best[:n_dates]
    nonzero = [v for v in money if v > 0 and v < 4000]
    if len(nonzero) >= n_dates:
        return nonzero[:n_dates]
    return nonzero


def is_name_line(line: str) -> bool:
    line = line.strip()
    if not line or len(line) > 55:
        return False
    if DATE_LINE.match(line) or ZIP_LINE.match(line) or line.startswith("$"):
        return False
    if len(line) <= 2:  # "St", "Dr" fragments
        return False
    if re.search(
        r"\d|street|ave\b|avenue|road|\brd\b|\bdr\b|drive|blvd|lane|\bln\b|"
        r"apt|suite|ter\b|loop|way\b|court|\bct\b|box|"
        r"\bks\b|\bid\b|\bma\b|\bca\b|\bne\b|\bmo\b|"
        r"contributions|contributor|payment|occupation|primary|general|amount|schedule|"
        r"candidate:|print this|campaign finance|credit card|not employed|"
        r"\btotal\b|type of|giving|more than|^cash$|^check$|^loan$|"
        r"^date$|^name and$|^address$|^of contributor$",
        line,
        re.I,
    ):
        return False
    if line.lower() in {
        "washington",
        "council grove",
        "abilene",
        "salina",
        "herington",
        "topeka",
        "wichita",
        "meriden",
        "hope",
        "street",
        "address",
        "date",
        "village",
        "terrace",
        "place",
        "circle",
        "heights",
        "park",
        "plaza",
        "north",
        "south",
        "east",
        "west",
    }:
        return False
    words = line.replace(",", " ").split()
    if not (1 <= len(words) <= 4):
        return False
    caps = sum(1 for w in words if w[:1].isupper())
    if len(words) == 1:
        return caps == 1 and words[0][:1].isupper() and words[0][1:].islower()
    return caps >= 2


def extract_names(page: str, expected: int) -> list[str]:
    lines = [re.sub(r"\s+", " ", ln).strip() for ln in page.splitlines() if ln.strip()]
    joined = "\n".join(lines)
    # Start after contributor header when present
    start = re.search(r"(?:of Contributor|Name and\s*\nAddress)", joined, re.I)
    if start:
        joined = joined[start.end() :]
    cut = re.split(
        r"\n(?:Type of Payment|Credit Card|Cash|Check)\n",
        joined,
        maxsplit=1,
    )
    region_lines = cut[0].splitlines() if cut else joined.splitlines()

    names: list[str] = []
    i = 0
    while i < len(region_lines) and len(names) < expected + 2:
        ln = region_lines[i]
        if not is_name_line(ln):
            i += 1
            continue
        name = ln
        if (
            i + 1 < len(region_lines)
            and is_name_line(region_lines[i + 1])
            and len(name.split()) == 1
            and len(region_lines[i + 1].split()) == 1
        ):
            name = f"{name} {region_lines[i + 1]}"
            i += 1
        name = re.sub(r"\s+", " ", name).replace("Ky lie", "Kylie").strip()
        names.append(name)
        i += 1
        # Consume the rest of this address block; do not treat mid-address
        # words (e.g. "Village") as the next contributor.
        while i < len(region_lines):
            cur = region_lines[i]
            if ZIP_LINE.match(cur) or re.search(r"\b[A-Z]{2}\s+\d{5}", cur):
                i += 1
                break
            if re.fullmatch(r"[A-Za-z .'-]+\s+[A-Z]{2}", cur):
                i += 1
                if i < len(region_lines) and ZIP_LINE.match(region_lines[i]):
                    i += 1
                break
            i += 1

    return names[:expected] if expected else names


def parse_schedule_a(text: str) -> list[dict]:
    body = text.split("SCHEDULE A", 1)[-1].split("SCHEDULE C", 1)[0]
    pages = re.split(r"(?m)^\d+ of \d+.*$", body)
    rows: list[dict] = []
    for page in pages:
        # Strip period totals footer
        page = re.split(r"Total Itemized Receipts for Period", page, maxsplit=1)[0]
        dates = [m.group(1) for m in (DATE_LINE.match(ln.strip()) for ln in page.splitlines()) if m]
        if not dates:
            continue
        money = money_values(page)
        # Remove a trailing 4260 period total if present in money list
        money = [v for v in money if v != 4260.0]
        amounts = amount_run_for_dates(money, len(dates))
        if not amounts:
            continue
        names = extract_names(page, len(amounts))
        n = min(len(names), len(amounts), len(dates))
        # If names short, still emit with Unknown Donor N — better than dropping amounts
        for i in range(len(amounts)):
            donor = names[i] if i < len(names) else f"Contributor {len(rows) + 1}"
            donor = repair_donor_name(donor)
            row = {
                "donorName": donor,
                "amount": amounts[i],
                "date": iso(dates[i]) if i < len(dates) else None,
                "state": "KS",
                "schedule": "A",
            }
            # "Kylie Kilmer" gifts → candidate self-funding
            if re.search(r"\bkilmer\b", donor, re.I) and re.search(r"\bkylie\b", donor, re.I):
                row["selfFunding"] = True
                row["occupation"] = "Candidate"
            if re.search(r"\bpac\b", donor, re.I):
                row["donorType"] = "pac"
            rows.append(row)
    return rows


def parse_schedule_c(text: str) -> list[dict]:
    """Itemize Schedule C; if sum drifts, scale is not applied — summary stays authoritative."""
    if "SCHEDULE C" not in text:
        return []
    body = text.split("SCHEDULE C", 1)[-1]
    pages = re.split(r"(?m)^\d+ of \d+.*$", body)
    rows = []
    for page in pages:
        page = re.split(r"TOTAL EXPENDITURES", page, maxsplit=1)[0]
        dates = [m.group(1) for m in (DATE_LINE.match(ln.strip()) for ln in page.splitlines()) if m]
        money = money_values(page)
        if not dates or not money:
            continue
        amounts = amount_run_for_dates(money, len(dates))
        # Vendor labels often repeat once per payee row in the name column
        raw_vendors = []
        for ln in page.splitlines():
            ln = re.sub(r"\s+", " ", ln).strip()
            if re.search(r"ActBlue", ln, re.I):
                raw_vendors.append("ActBlue")
            elif re.search(r"Wix", ln, re.I):
                raw_vendors.append("Wix")
            elif re.search(
                r"Facebook|Meta Platforms|USPS|Amazon|Canva|Google|FedEx|Office Depot|Walmart",
                ln,
                re.I,
            ):
                raw_vendors.append(ln[:80])
        collapsed = []
        for v in raw_vendors:
            if not collapsed or collapsed[-1] != v:
                collapsed.append(v)
        if len(collapsed) == 1 and amounts:
            vendors = [collapsed[0]] * len(amounts)
        elif len(collapsed) == len(amounts):
            vendors = collapsed
        elif collapsed:
            vendors = (collapsed * ((len(amounts) // len(collapsed)) + 1))[: len(amounts)]
        else:
            vendors = ["Unknown vendor"] * len(amounts)
        for i, amount in enumerate(amounts):
            vendor = vendors[i]
            purpose = "Campaign expenditure"
            category = "Other"
            if vendor == "ActBlue":
                purpose = "ActBlue processing fees"
            elif vendor == "Wix":
                purpose = "Website hosting"
                category = "Advertising"
            rows.append(
                {
                    "vendorName": vendor,
                    "amount": amount,
                    "date": iso(dates[i]) if i < len(dates) else None,
                    "purpose": purpose,
                    "category": category,
                    "schedule": "C",
                }
            )
    # Deduplicate exact rows; if still ~2x summary, keep unique by date+amount+vendor
    seen = set()
    out = []
    for r in rows:
        key = (r["vendorName"], r["amount"], r.get("date"))
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def main() -> None:
    text = TXT.read_text(encoding="utf-8")
    data = json.loads(OUT.read_text(encoding="utf-8"))
    contribs = parse_schedule_a(text)
    expenses = parse_schedule_c(text)
    sa = sum(c["amount"] for c in contribs)
    sc = sum(e["amount"] for e in expenses)
    data["contributions"] = contribs
    data["expenses"] = expenses
    warnings = []
    if abs(sa - data["summary"]["totalReceipts"]) > 1:
        warnings.append(
            f"Itemized Schedule A ${sa:,.2f} ({len(contribs)} rows) vs summary "
            f"${data['summary']['totalReceipts']:,.2f}."
        )
    else:
        warnings.append(f"Schedule A: {len(contribs)} itemized contributions = ${sa:,.2f}.")
    if abs(sc - data["summary"]["totalExpenditures"]) > 1:
        warnings.append(
            f"Itemized Schedule C ${sc:,.2f} ({len(expenses)} rows) vs summary "
            f"${data['summary']['totalExpenditures']:,.2f}."
        )
    else:
        warnings.append(f"Schedule C: {len(expenses)} itemized expenditures = ${sc:,.2f}.")
    data["warnings"] = warnings
    OUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"A: {len(contribs)} sum=${sa:,.2f} target=${data['summary']['totalReceipts']:,.2f}")
    print(f"C: {len(expenses)} sum=${sc:,.2f} target=${data['summary']['totalExpenditures']:,.2f}")
    print("donors sample:", [(c["donorName"], c["amount"]) for c in contribs[:12]])


if __name__ == "__main__":
    main()
