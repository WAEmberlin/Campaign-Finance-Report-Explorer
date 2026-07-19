/**
 * Global search via Fuse.js over normalized entities.
 * @module services/search/search-engine
 */

import { getAll } from '../storage/db.js';
import { createLogger } from '../../shared/logger.js';
import { emit } from '../../shared/events.js';

const log = createLogger('search');

/** @type {any} */
let fuse = null;
/** @type {Array<object>} */
let documents = [];
/** @type {string[]} */
const history = [];

/**
 * Rebuild the search index from IndexedDB.
 */
export async function rebuildIndex() {
  const [candidates, donors, pacs, vendors, committees, expenses, contributions] = await Promise.all([
    getAll('candidates'),
    getAll('donors'),
    getAll('pacs'),
    getAll('vendors'),
    getAll('committees'),
    getAll('expenses'),
    getAll('contributions'),
  ]);

  documents = [];
  for (const c of candidates) {
    documents.push({
      id: c.id,
      type: 'candidate',
      title: c.name,
      subtitle: 'Candidate',
      search: `${c.name} ${c.districtId} ${c.officeId} ${c.cycleId}`,
    });
  }
  for (const d of donors) {
    documents.push({
      id: d.id,
      type: 'donor',
      title: d.name,
      subtitle: d.type || 'Donor',
      search: `${d.name} ${d.city || ''} ${d.zip || ''} ${d.occupation || ''}`,
    });
  }
  for (const p of pacs) {
    documents.push({
      id: p.id,
      type: 'pac',
      title: p.name,
      subtitle: 'PAC',
      search: p.name,
    });
  }
  for (const v of vendors) {
    documents.push({
      id: v.id,
      type: 'vendor',
      title: v.name,
      subtitle: v.category || 'Vendor',
      search: `${v.name} ${v.category || ''}`,
    });
  }
  for (const c of committees) {
    documents.push({
      id: c.id,
      type: 'committee',
      title: c.name,
      subtitle: 'Committee',
      search: c.name,
    });
  }
  for (const e of expenses.slice(0, 5000)) {
    documents.push({
      id: e.id,
      type: 'expense',
      title: e.vendorName,
      subtitle: e.purpose || e.category || 'Expense',
      search: `${e.vendorName} ${e.purpose || ''} ${e.category || ''}`,
    });
  }
  for (const c of contributions.slice(0, 5000)) {
    documents.push({
      id: c.id,
      type: 'contribution',
      title: c.donorName,
      subtitle: `Contribution ${c.amount}`,
      search: `${c.donorName} ${c.city || ''} ${c.occupation || ''}`,
    });
  }

  const Fuse = window.Fuse;
  if (!Fuse) {
    log.warn('Fuse.js not loaded — search will use naive filter');
    fuse = null;
    return documents.length;
  }

  fuse = new Fuse(documents, {
    keys: ['title', 'subtitle', 'search', 'type'],
    threshold: 0.35,
    includeMatches: true,
    ignoreLocation: true,
  });
  log.info(`Search index rebuilt with ${documents.length} docs`);
  return documents.length;
}

/**
 * @param {string} query
 * @param {{ limit?: number, types?: string[] }} [opts]
 */
export function search(query, opts = {}) {
  const q = String(query || '').trim();
  emit('search:query', { query: q });
  if (!q) return [];
  if (history[0] !== q) {
    history.unshift(q);
    if (history.length > 20) history.pop();
  }

  const limit = opts.limit ?? 20;
  let results;
  if (fuse) {
    results = fuse.search(q, { limit: limit * 2 }).map((r) => ({
      ...r.item,
      score: r.score,
      matches: r.matches,
    }));
  } else {
    const lower = q.toLowerCase();
    results = documents.filter((d) => d.search.toLowerCase().includes(lower)).slice(0, limit * 2);
  }

  if (opts.types?.length) {
    results = results.filter((r) => opts.types.includes(r.type));
  }
  return results.slice(0, limit);
}

/**
 * @param {string} query
 * @param {number} [limit=8]
 */
export function autocomplete(query, limit = 8) {
  return search(query, { limit });
}

export function getSearchHistory() {
  return [...history];
}
