/**
 * Stable internal ID generation for normalized entities.
 * @module shared/ids
 */

const PREFIX = {
  candidate: 'cand',
  report: 'rpt',
  contribution: 'contrib',
  expense: 'exp',
  vendor: 'vend',
  pac: 'pac',
  committee: 'comm',
  donor: 'donor',
  organization: 'org',
  cycle: 'cycle',
  office: 'off',
  district: 'dist',
  city: 'city',
  zip: 'zip',
  county: 'cty',
  occupation: 'occ',
  relationship: 'rel',
};

/**
 * Create a cryptographically-unique ID with entity prefix.
 * @param {keyof typeof PREFIX} kind
 * @returns {string}
 */
export function createId(kind) {
  const prefix = PREFIX[kind];
  if (!prefix) throw new Error(`Unknown entity kind: ${kind}`);
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

/**
 * Deterministic ID from a normalized key (for dedupe across imports).
 * @param {keyof typeof PREFIX} kind
 * @param {string} key
 * @returns {string}
 */
export function deterministicId(kind, key) {
  const prefix = PREFIX[kind];
  if (!prefix) throw new Error(`Unknown entity kind: ${kind}`);
  const normalized = String(key || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export { PREFIX };
