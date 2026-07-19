/**
 * Kansas import service — catalog refresh + drag/drop. No UI.
 * @module services/import/import-service
 */

import { emit } from '../../shared/events.js';
import { ImportError } from '../../shared/errors.js';
import { createLogger } from '../../shared/logger.js';
import { parseReport } from '../parser/pdf-parser.js';
import { persistParsedReport } from './persist-report.js';
import { getFilters } from '../../shared/filters.js';

const log = createLogger('import');

/**
 * Load the static filings catalog.
 * @returns {Promise<object>}
 */
export async function getCatalog() {
  const res = await fetch(`data/filings-index.json?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new ImportError(`Failed to load filings catalog (${res.status})`);
  return res.json();
}

/**
 * Hash a buffer for sourceKey dedupe.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<string>}
 */
async function hashBuffer(buffer) {
  if (crypto?.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 24);
  }
  // Fallback
  let h = 0;
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i++) h = (Math.imul(31, h) + view[i]) | 0;
  return `fb_${(h >>> 0).toString(16)}`;
}

/**
 * Import local files (PDF or JSON).
 * @param {FileList|File[]} files
 * @returns {Promise<{imported: number, skipped: number, errors: Array<{file: string, message: string}>}>}
 */
export async function importFiles(files) {
  const list = Array.from(files || []);
  const result = { imported: 0, skipped: 0, errors: [] };
  const total = list.length;

  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    emit('import:progress', {
      phase: 'file',
      current: i + 1,
      total,
      message: `Parsing ${file.name}`,
    });
    try {
      const buffer = await file.arrayBuffer();
      const sourceKey = `file:${await hashBuffer(buffer)}`;
      const parsed = await parseReport(buffer, { fileName: file.name });
      const out = await persistParsedReport(parsed, {
        sourceKey,
        fileName: file.name,
        pdfBlob: /\.pdf$/i.test(file.name) ? buffer : undefined,
      });
      if (out.skipped) result.skipped += 1;
      else result.imported += 1;
    } catch (err) {
      log.error('File import failed', file.name, err);
      result.errors.push({ file: file.name, message: err.message || String(err) });
      emit('import:error', { message: err.message, details: { file: file.name } });
    }
  }

  emit('import:complete', result);
  return result;
}

/**
 * Refresh from Kansas catalog (mirrored JSON/PDFs under data/).
 * Filters default to current app filters but architecture is statewide.
 * @param {{ cycle?: string, office?: string, district?: string }} [opts]
 */
export async function refreshFromKansas(opts = {}) {
  const filters = { ...getFilters(), ...opts };
  const catalog = await getCatalog();
  /** @type {any[]} */
  const reports = [];

  // Import is statewide for the selected cycle/office. District is a view filter only.
  for (const cycleBlock of catalog.cycles || []) {
    if (filters.cycle && String(cycleBlock.cycle) !== String(filters.cycle)) continue;
    for (const officeBlock of cycleBlock.offices || []) {
      if (filters.office && officeBlock.office !== filters.office) continue;
      reports.push(...(officeBlock.reports || []));
    }
  }

  // If office-specific catalog is empty, pull entire cycle (still statewide-first)
  if (!reports.length) {
    for (const cycleBlock of catalog.cycles || []) {
      if (filters.cycle && String(cycleBlock.cycle) !== String(filters.cycle)) continue;
      for (const officeBlock of cycleBlock.offices || []) {
        reports.push(...(officeBlock.reports || []));
      }
    }
  }

  const result = { imported: 0, skipped: 0, errors: [] };
  const total = reports.length;

  if (!total) {
    emit('import:complete', result);
    emit('import:error', {
      message:
        'No catalog reports available for the current filters. Use drag-and-drop or expand data/filings-index.json via kansas-sync.',
    });
    return result;
  }

  for (let i = 0; i < reports.length; i++) {
    const entry = reports[i];
    emit('import:progress', {
      phase: 'catalog',
      current: i + 1,
      total,
      message: `Importing ${entry.candidateName || entry.id}`,
    });

    try {
      if (entry.localPath) {
        // Bust HTTP + service-worker caches so catalog updates (e.g. new Schedule A rows) apply
        const res = await fetch(`${entry.localPath}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new ImportError(`Missing mirrored report: ${entry.localPath}`);
        const buffer = await res.arrayBuffer();
        const parsed = await parseReport(buffer, { fileName: entry.localPath });
        const contribCount = parsed.contributions?.length || 0;
        log.info(`Catalog ${entry.id}: ${contribCount} contributions, raised=${parsed.summary?.totalReceipts}`);
        const out = await persistParsedReport(parsed, {
          sourceKey: `catalog:${entry.id}`,
          sourceUrl: entry.sourceUrl || undefined,
          fileName: entry.localPath,
          replace: true,
        });
        if (out.skipped) result.skipped += 1;
        else result.imported += 1;
        continue;
      }

      if (entry.sourceUrl) {
        // Attempt live fetch — likely blocked by CORS; surface clear error
        try {
          const res = await fetch(entry.sourceUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buffer = await res.arrayBuffer();
          const parsed = await parseReport(buffer, { fileName: entry.sourceUrl });
          const out = await persistParsedReport(parsed, {
            sourceKey: `url:${entry.id}`,
            sourceUrl: entry.sourceUrl,
          });
          if (out.skipped) result.skipped += 1;
          else result.imported += 1;
        } catch (corsErr) {
          throw new ImportError(
            `Could not download ${entry.sourceUrl} (likely CORS). Mirror the PDF/JSON via kansas-sync or drag-and-drop.`,
            { cause: corsErr, details: { id: entry.id } }
          );
        }
        continue;
      }

      throw new ImportError(`Catalog entry ${entry.id} has no localPath or sourceUrl`);
    } catch (err) {
      log.error('Catalog import failed', entry.id, err);
      result.errors.push({ file: entry.id, message: err.message || String(err) });
      emit('import:error', { message: err.message, details: { id: entry.id } });
    }
  }

  emit('import:complete', result);
  return result;
}
