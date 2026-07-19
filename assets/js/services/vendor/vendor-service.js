/**
 * Vendor normalization, categorization, and stats helpers.
 * @module services/vendor/vendor-service
 */

import { normalizeName } from '../../shared/format.js';
import { categorizePurpose } from '../parser/normalize.js';
import { deterministicId } from '../../shared/ids.js';

/**
 * @param {string} name
 * @returns {{ id: string, name: string, normalizedName: string }}
 */
export function normalizeVendor(name) {
  const cleaned = String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
  const normalizedName = normalizeName(cleaned)
    .replace(/\b(llc|inc|corp|co|ltd|llp)\b\.?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    id: deterministicId('vendor', normalizedName || cleaned),
    name: cleaned,
    normalizedName: normalizedName || cleaned,
  };
}

/**
 * @param {string} purpose
 * @param {string} [existing]
 * @returns {string}
 */
export function resolveCategory(purpose, existing) {
  if (existing && existing !== 'Other') return existing;
  return categorizePurpose(purpose || '');
}

/**
 * Aggregate vendor spending from expense list.
 * @param {Array<{vendorId: string, vendorName: string, amount: number, category?: string}>} expenses
 * @returns {Array<{vendorId: string, name: string, total: number, count: number, category: string}>}
 */
export function summarizeVendors(expenses) {
  /** @type {Map<string, {vendorId: string, name: string, total: number, count: number, category: string}>} */
  const map = new Map();
  for (const e of expenses) {
    const key = e.vendorId || normalizeVendor(e.vendorName).id;
    const cur = map.get(key) || {
      vendorId: key,
      name: e.vendorName,
      total: 0,
      count: 0,
      category: e.category || 'Other',
    };
    cur.total += e.amount || 0;
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/**
 * Find vendors shared across multiple candidates.
 * @param {Array<{candidateId: string, vendorId: string}>} expenses
 * @returns {Array<{vendorId: string, candidateIds: string[]}>}
 */
export function findSharedVendors(expenses) {
  /** @type {Map<string, Set<string>>} */
  const map = new Map();
  for (const e of expenses) {
    if (!e.vendorId || !e.candidateId) continue;
    if (!map.has(e.vendorId)) map.set(e.vendorId, new Set());
    map.get(e.vendorId).add(e.candidateId);
  }
  return Array.from(map.entries())
    .filter(([, set]) => set.size > 1)
    .map(([vendorId, set]) => ({ vendorId, candidateIds: Array.from(set) }));
}
