/**
 * Export engine — CSV, JSON, PNG, clipboard, share URLs.
 * @module services/export/export-service
 */

import { getFilters, persistFilters } from '../../shared/filters.js';

/**
 * @param {Array<Record<string, any>>} rows
 * @param {string[]} [columns]
 * @returns {string}
 */
export function toCsv(rows, columns) {
  if (!rows?.length) return '';
  const cols = columns || Object.keys(rows[0]);
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [cols.join(',')];
  for (const row of rows) {
    lines.push(cols.map((c) => escape(row[c])).join(','));
  }
  return lines.join('\n');
}

/**
 * @param {any} data
 * @returns {string}
 */
export function toJson(data) {
  return JSON.stringify(data, null, 2);
}

/**
 * Download a text blob.
 * @param {string} filename
 * @param {string} content
 * @param {string} [mime]
 */
export function downloadText(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export chart canvas to PNG.
 * @param {HTMLCanvasElement} canvas
 * @param {string} [filename='chart.png']
 */
export function chartToPng(canvas, filename = 'chart.png') {
  if (!canvas) return;
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = filename;
  a.click();
}

/**
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

/**
 * Build a shareable URL for current (or provided) filters.
 * @param {Partial<import('../../shared/filters.js').AppFilters>} [filters]
 * @returns {string}
 */
export function shareUrl(filters) {
  const f = { ...getFilters(), ...filters };
  persistFilters(f);
  return window.location.href;
}

/**
 * Export analytics tables as CSV download.
 * @param {import('../analytics/analytics-engine.js').AnalyticsSnapshot} snap
 * @param {'contributions'|'expenses'|'donors'|'vendors'} kind
 */
export function exportSnapshot(snap, kind) {
  if (kind === 'contributions') {
    downloadText('contributions.csv', toCsv(snap.contributions), 'text/csv');
  } else if (kind === 'expenses') {
    downloadText('expenses.csv', toCsv(snap.expenses), 'text/csv');
  } else if (kind === 'donors') {
    downloadText('donors.csv', toCsv(snap.topDonors), 'text/csv');
  } else if (kind === 'vendors') {
    downloadText('vendors.csv', toCsv(snap.topVendors), 'text/csv');
  }
}
