"""
Build data/geo/house-districts.geojson from Census cartographic boundary KML.

Source: U.S. Census Bureau GENZ2023 cb_2023_20_sldl_500k (Kansas State House, 1:500k).
Normalizes properties to { district, office, label } for Map Explorer.
"""
from __future__ import annotations

import json
import re
import urllib.request
import zipfile
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "geo" / "house-districts.geojson"
CACHE = ROOT / "data" / "geo" / "_sldl_kml.zip"
URL = "https://www2.census.gov/geo/tiger/GENZ2023/kml/cb_2023_20_sldl_500k.zip"
NS = {"k": "http://www.opengis.net/kml/2.2"}


def fetch_zip() -> bytes:
    if CACHE.exists() and CACHE.stat().st_size > 1000:
        return CACHE.read_bytes()
    req = urllib.request.Request(URL, headers={"User-Agent": "KCFE-geo-builder/1.0"})
    with urllib.request.urlopen(req, timeout=120) as res:
        data = res.read()
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_bytes(data)
    return data


def parse_coords(text: str) -> list[list[float]]:
    pts: list[list[float]] = []
    for token in text.strip().split():
        parts = token.split(",")
        if len(parts) < 2:
            continue
        lon, lat = float(parts[0]), float(parts[1])
        pts.append([lon, lat])
    return pts


def ring_from_coords(el: ET.Element | None) -> list[list[float]] | None:
    if el is None or not (el.text or "").strip():
        return None
    ring = parse_coords(el.text or "")
    if len(ring) < 4:
        return None
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


def polygon_coords(poly: ET.Element) -> list[list[list[float]]] | None:
    outer = ring_from_coords(poly.find("k:outerBoundaryIs/k:LinearRing/k:coordinates", NS))
    if not outer:
        return None
    rings = [outer]
    for inner in poly.findall("k:innerBoundaryIs/k:LinearRing/k:coordinates", NS):
        ring = ring_from_coords(inner)
        if ring:
            rings.append(ring)
    return rings


def geometry_from_placemark(pm: ET.Element) -> dict | None:
    polys = pm.findall(".//k:Polygon", NS)
    if not polys:
        return None
    all_polys = []
    for poly in polys:
        coords = polygon_coords(poly)
        if coords:
            all_polys.append(coords)
    if not all_polys:
        return None
    if len(all_polys) == 1:
        return {"type": "Polygon", "coordinates": all_polys[0]}
    return {"type": "MultiPolygon", "coordinates": all_polys}


def district_from_description(desc: str | None) -> str | None:
    if not desc:
        return None
    m = re.search(r"<th>NAME</th>\s*<td>(\d+)</td>", desc)
    if m:
        return str(int(m.group(1)))
    m = re.search(r"<th>SLDLST</th>\s*<td>(\d+)</td>", desc)
    if m:
        return str(int(m.group(1)))
    return None


def build() -> dict:
    data = fetch_zip()
    with zipfile.ZipFile(BytesIO(data)) as z:
        kml_name = next(n for n in z.namelist() if n.endswith(".kml") and "iso" not in n)
        root = ET.fromstring(z.read(kml_name))

    features = []
    for pm in root.findall(".//k:Placemark", NS):
        desc_el = pm.find("k:description", NS)
        district = district_from_description(desc_el.text if desc_el is not None else None)
        if not district:
            continue
        geom = geometry_from_placemark(pm)
        if not geom:
            continue
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "district": district,
                    "office": "kansas-house",
                    "label": f"House District {district}",
                },
                "geometry": geom,
            }
        )

    features.sort(key=lambda f: int(f["properties"]["district"]))
    return {
        "type": "FeatureCollection",
        "name": "kansas-house-districts",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
        "metadata": {
            "source": URL,
            "sourceLabel": "U.S. Census Bureau cartographic boundaries (GENZ2023, 1:500k SLDL)",
            "notes": "2022 enacted Kansas House districts as published in Census 2023 boundaries.",
        },
    }


def main() -> None:
    fc = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fc, separators=(",", ":")), encoding="utf-8")
    print(f"Wrote {OUT} ({len(fc['features'])} districts, {OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
