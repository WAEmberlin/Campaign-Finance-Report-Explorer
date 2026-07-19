/**
 * PAC / contributor type classification with known list + rules.
 * @module services/pac/pac-engine
 */

import { normalizeName } from '../../shared/format.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('pac');

const DEFAULT_PATTERNS = [
  { regex: '\\bpac\\b', confidence: 0.85 },
  { regex: '\\bcommittee\\b', confidence: 0.7 },
  { regex: '\\bpolitical action\\b', confidence: 0.9 },
  { regex: '\\bfor (kansas|house|senate)\\b', confidence: 0.65 },
];

/** @type {{ pacs: Array<{name: string, aliases?: string[]}>, patterns: Array<{regex: string, confidence: number}> }} */
let db = { pacs: [], patterns: DEFAULT_PATTERNS };

/** @type {Map<string, string>} */
const overrides = new Map();

/**
 * Load known PAC database from data/known-pacs.json
 * @returns {Promise<void>}
 */
export async function loadKnownPacs() {
  try {
    const res = await fetch('data/known-pacs.json');
    const loaded = await res.json();
    db = {
      pacs: loaded.pacs || [],
      patterns: loaded.patterns?.length ? loaded.patterns : DEFAULT_PATTERNS,
    };
    log.info(`Loaded ${db.pacs.length} known PACs`);
  } catch (err) {
    log.warn('Could not load known-pacs.json', err);
    db = { pacs: [], patterns: DEFAULT_PATTERNS };
  }
}

/**
 * Manual override for a normalized name.
 * @param {string} name
 * @param {'individual'|'pac'|'committee'|'organization'|'unknown'} type
 */
export function setOverride(name, type) {
  overrides.set(normalizeName(name), type);
}

/**
 * Classify a contributor name.
 *
 * Kansas Schedule A note: "Occupation of Individual Giving More Than $150" is blank for
 * PACs/committees (field is for individuals). Individuals ≤ $150 also leave it blank, so
 * blank occupation alone is not proof — use it with amount + name shape.
 *
 * @param {string} name
 * @param {{ occupation?: string, employer?: string, amount?: number }} [ctx]
 * @returns {{ type: string, confidence: number, matchedName?: string }}
 */
export function classifyContributor(name, ctx = {}) {
  const norm = normalizeName(name);
  if (!norm) return { type: 'unknown', confidence: 0 };

  if (overrides.has(norm)) {
    return { type: overrides.get(norm), confidence: 1, matchedName: name };
  }

  if (db?.pacs) {
    for (const pac of db.pacs) {
      const names = [pac.name, ...(pac.aliases || [])].map(normalizeName);
      if (names.includes(norm) || names.some((n) => norm.includes(n) || n.includes(norm))) {
        return { type: 'pac', confidence: 0.95, matchedName: pac.name };
      }
    }
  }

  for (const p of db?.patterns || []) {
    try {
      if (new RegExp(p.regex, 'i').test(norm)) {
        return { type: 'pac', confidence: p.confidence, matchedName: name };
      }
    } catch {
      /* bad regex */
    }
  }

  const occ = normalizeName(ctx.occupation || '');
  const amount = Number(ctx.amount);
  const over150 = Number.isFinite(amount) && amount > 150;
  const hasOccupation = Boolean(occ);

  // Filled occupation ⇒ individual (KS form only asks this for individual donors > $150)
  if (hasOccupation) {
    if (/candidate|self/.test(occ) || /candidate/.test(norm)) {
      return { type: 'individual', confidence: 0.9 };
    }
    return { type: 'individual', confidence: 0.85 };
  }

  if (/candidate/.test(norm)) {
    return { type: 'individual', confidence: 0.8 };
  }

  // Trade / industry group labels often omit "PAC" in OCR (e.g. "Kansas Automobile Dealers")
  if (
    /\b(dealers|realtors|bankers|builders|dentists|physicians|nurses|teachers|truckers)\b/.test(
      norm
    ) ||
    /\b(farm bureau|chamber of commerce|automobile|auto dealers)\b/.test(norm) ||
    /\b(democratic|republican)\s+(house|senate)\b/.test(norm)
  ) {
    return { type: 'pac', confidence: 0.8, matchedName: name };
  }

  if (/llc|inc\b|corp|company|ltd|llp|pc\b|association|union|church/.test(norm)) {
    // "… Association" without PAC is usually a Kansas industry PAC, not a business gift
    if (/\bassociation\b/.test(norm) && !/\b(llc|inc|corp|company)\b/.test(norm)) {
      return { type: 'pac', confidence: 0.75, matchedName: name };
    }
    return { type: 'organization', confidence: 0.75 };
  }

  if (/committee|for\s+\w+\s+(house|senate|governor)/.test(norm)) {
    return { type: 'committee', confidence: 0.7 };
  }

  const tokens = norm.split(' ').filter(Boolean);
  const orgish =
    /\b(kansas|missouri|oklahoma|nebraska|national|american|united|state)\b/.test(norm) &&
    tokens.length >= 3;
  const looksLikePerson =
    !orgish &&
    tokens.length >= 2 &&
    tokens.length <= 4 &&
    tokens.every((t) => t.length > 1) &&
    !/\b(of|for|and|&)\b/.test(norm);

  // >$150, blank occupation, org-shaped name ⇒ PAC/committee (KS leaves occupation blank for non-individuals)
  if (over150 && !hasOccupation && orgish) {
    return { type: 'pac', confidence: 0.7, matchedName: name };
  }

  if (looksLikePerson) {
    // Blank occupation is normal for ≤$150 individuals; still treat person-shaped names as individual
    return { type: 'individual', confidence: over150 ? 0.55 : 0.65 };
  }

  if (over150 && !hasOccupation) {
    return { type: 'pac', confidence: 0.55, matchedName: name };
  }

  return { type: 'unknown', confidence: 0.3 };
}

/**
 * Export known + override list for backup.
 */
export function exportPacList() {
  return {
    known: db,
    overrides: Object.fromEntries(overrides),
  };
}
