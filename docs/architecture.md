# Architecture

## Principles

- Entirely client-side (GitHub Pages)
- Statewide-first data model; District 70 is only a default filter
- PDF → parser → normalized entities → IndexedDB → analytics / search / UI
- No circular dependencies: `models` → `services` → `modules` → `components`

## Runtime stack

HTML5, CSS3, Bootstrap 5, Vanilla ES Modules, Chart.js, PDF.js, Fuse.js, Leaflet, D3.js, PapaParse, IndexedDB, Service Worker / PWA.

## Data flow

1. **Import** reads `data/filings-index.json` and/or user File drops
2. **Parser** returns `ParsedReportJSON` (never raw text to UI)
3. **Persist** writes candidates, reports, contributions, expenses, vendors, donors, PACs, relationships
4. **Analytics / Search / Insights / Graph / Map** read IndexedDB
5. **UI** reacts to `filters:changed` and `report:imported` events

## CORS strategy

Browsers block live `fetch()` of kansas.gov PDFs from GitHub Pages. Refresh From Kansas uses mirrored catalog entries (`localPath`). The `kansas-sync` workflow updates catalog metadata; contributors add mirrored JSON/PDFs under `data/reports/`.

## Extension points

- Replace synthetic map geometry with `data/geo/house-districts.geojson`
- Expand `data/known-pacs.json`
- Add relationship types without UI changes
- New offices/cycles via reference seed + catalog
