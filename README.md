# Kansas Campaign Finance Explorer

Browser-only analytics platform for Kansas campaign finance filings. Built for journalists, researchers, campaigns, watchdogs, and citizens — closer to Power BI / Tableau than a PDF viewer.

**No backend. No accounts. No API keys. Deploy on GitHub Pages. Works offline after reports are imported.**

![Screenshot placeholder: District dashboard](docs/screenshots/dashboard.svg)

## Features (v1.0)

- District dashboard (default filters: **2026 · Kansas House · District 70**)
- Statewide Campaign Intelligence Center
- Refresh From Kansas (static catalog) + drag-and-drop PDF/JSON import
- PDF.js parsing + structured JSON import
- Analytics: raised, spent, cash, PAC %, timelines, top donors/vendors
- Deterministic insight cards (no AI)
- Fuse.js global search
- D3 relationship explorer (flagship)
- Leaflet district map
- Comparison explorer
- CSV / JSON / PNG / SVG / share URL exports
- Installable PWA with Service Worker

## Quick start

```bash
# From the repo root — any static file server
npx --yes serve -l 5173 .
# open http://localhost:5173
```

Or open via GitHub Pages after enabling Pages (workflow: `.github/workflows/pages.yml`).

1. Click **Refresh From Kansas** to import real House District 70 catalog reports
   (Kylie Christine Kilmer, Brandon L. Rein, Greg H. Wilson — mirrored from KPDC)
2. Explore dashboards, search, graph, and map
3. Drop additional Receipts & Expenditures PDFs anytime

Rebuild the District 70 catalog from KPDC PDFs anytime with:

`python scripts/build_d70_reports.py`

## Architecture

See [docs/architecture.md](docs/architecture.md) and [docs/interfaces/README.md](docs/interfaces/README.md).

```
assets/js/
  shared/       # ids, events, filters, logging
  models/       # entity contracts
  services/     # storage, import, parser, analytics, search, …
  modules/      # dashboards, charts, graph, map
  components/   # presentational UI helpers
data/           # filings-index.json, known-pacs, mirrored reports
tests/          # unit tests (open tests/run.html)
```

## Data model

Normalized entities with stable IDs: Candidate, Report, Contribution, Expense, Vendor, Donor, PAC, Committee, Organization, ElectionCycle, Office, District, Relationship.

UI never binds to raw PDF text.

## Kansas import & CORS

Live PDF downloads from `kansas.gov` / KPDC are blocked by browser CORS.

- **Drag & drop** always works
- **Refresh From Kansas** reads [`data/filings-index.json`](data/filings-index.json) and mirrored files under `data/reports/`
- GitHub Action [`kansas-sync`](.github/workflows/kansas-sync.yml) refreshes catalog metadata (build-time, not a runtime backend)

## Deployment

1. Push to `main`
2. Enable GitHub Pages → Source: **GitHub Actions**
3. Workflow publishes the repository root

No environment variables or secrets required.

## Tests

Open [`tests/run.html`](tests/run.html) via the static server:

`http://localhost:5173/tests/run.html`

## Roadmap

- **1.0** — District dashboards, import, parse, charts, search, relationship explorer, exports
- **1.5** — Statewide analytics polish, official GeoJSON, advanced filters, performance
- **2.0** — Historical comparisons, donor networks, anomaly detection, conflict indicators

## Contributing

1. Keep modules single-purpose; follow interface docs
2. Prefer statewide-safe APIs (never hardcode District 70)
3. Add unit tests for parser/analytics changes
4. Document public functions with JSDoc

## License

[MIT](LICENSE)

## Known limitations

- Scanned image-only PDFs need OCR upstream; text-layer PDFs and mirrored JSON work best
- Map uses synthetic district polygons until official GeoJSON is added
- Catalog coverage grows as mirrored reports are added via `kansas-sync` / PRs

## FAQ

**Why isn’t live Kansas download working?** Browser CORS. Mirror reports into `data/reports/` or drag-and-drop PDFs.

**Where is my data stored?** IndexedDB in your browser only.

**Can this run fully offline?** Yes, after the app shell and reports are cached/imported.
