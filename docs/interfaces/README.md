# Subsystem Interfaces

Dependency rule: `models` → `services` → `modules` → `components`.

## Events (`shared/events.js`)

| Event | Payload | Emitter |
|-------|---------|---------|
| `db:ready` | `{ name, version }` | storage |
| `filters:changed` | `AppFilters` | filters |
| `report:imported` | `{ reportId, candidateId }` | import |
| `import:progress` | `{ phase, current, total, message }` | import |
| `import:error` | `{ message, details }` | import |
| `import:complete` | `{ imported, skipped, errors }` | import |
| `view:changed` | `{ view }` | UI router |
| `theme:changed` | `{ theme }` | settings |
| `search:query` | `{ query }` | search UI |

## Storage (`services/storage/db.js`)

- `openDb()`, `put`, `putMany`, `get`, `getAll`, `getAllByIndex`, `remove`, `count`, `clearAll`, `seedReferenceData`

## Import (`services/import/import-service.js`)

- `importFiles(FileList|File[])` — drag/drop path
- `refreshFromKansas({ cycle?, office?, district? })` — catalog path
- `getCatalog()` — load `data/filings-index.json`

## Parser (`services/parser/pdf-parser.js`)

- `parseReport(ArrayBuffer|Uint8Array|File) → ParsedReportJSON`

## Analytics (`services/analytics/analytics-engine.js`)

- `compute(filters) → AnalyticsSnapshot`

## Search (`services/search/search-engine.js`)

- `rebuildIndex()`, `search(query, opts)`, `autocomplete(query)`

## Export (`services/export/export-service.js`)

- `toCsv(rows, columns)`, `toJson(data)`, `chartToPng(canvas)`, `copyText(text)`, `shareUrl(filters)`
