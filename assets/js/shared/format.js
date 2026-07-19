/**
 * Display formatting helpers.
 * @module shared/format
 */

/**
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function formatCurrency(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * @param {number|null|undefined} n
 * @param {number} [digits=1]
 * @returns {string}
 */
export function formatPercent(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

/**
 * @param {number|null|undefined} n
 * @returns {string}
 */
export function formatNumber(n) {
  if (n == null || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US').format(n);
}

/**
 * @param {string|null|undefined} iso
 * @returns {string}
 */
export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Normalize a name for matching / dedupe.
 * @param {string} name
 * @returns {string}
 */
export function normalizeName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s&'-]/g, '')
    .replace(/\s+/g, ' ');
}
