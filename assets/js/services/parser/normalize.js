/**
 * Map free-text office/district/cycle labels to statewide reference IDs.
 * @module services/parser/normalize
 */

import { normalizeName } from '../../shared/format.js';

/**
 * @param {string} officeText
 * @returns {{ officeId: string, slug: string, label: string }}
 */
export function resolveOffice(officeText) {
  const t = normalizeName(officeText);
  if (/senate/.test(t)) return { officeId: 'off_kansas-senate', slug: 'kansas-senate', label: 'Kansas Senate' };
  if (/house|representative|rep\b/.test(t)) return { officeId: 'off_kansas-house', slug: 'kansas-house', label: 'Kansas House' };
  if (/governor/.test(t)) return { officeId: 'off_governor', slug: 'governor', label: 'Governor' };
  if (/secretary/.test(t)) return { officeId: 'off_secretary-of-state', slug: 'secretary-of-state', label: 'Secretary of State' };
  if (/attorney/.test(t)) return { officeId: 'off_attorney-general', slug: 'attorney-general', label: 'Attorney General' };
  if (/treasurer/.test(t)) return { officeId: 'off_treasurer', slug: 'treasurer', label: 'Treasurer' };
  if (/insurance/.test(t)) return { officeId: 'off_insurance-commissioner', slug: 'insurance-commissioner', label: 'Insurance Commissioner' };
  if (/judicial|judge|court/.test(t)) return { officeId: 'off_judicial', slug: 'judicial', label: 'Judicial' };
  if (/\bpac\b|political action/.test(t)) return { officeId: 'off_pac', slug: 'pac', label: 'PAC' };
  if (/party|committee/.test(t)) return { officeId: 'off_party-committee', slug: 'party-committee', label: 'Party Committee' };
  return { officeId: 'off_kansas-house', slug: 'kansas-house', label: 'Kansas House' };
}

/**
 * @param {string|number} districtText
 * @param {string} officeId
 * @returns {{ districtId: string, number: string, label: string }}
 */
export function resolveDistrict(districtText, officeId) {
  const num = String(districtText || '')
    .replace(/[^\d]/g, '')
    .replace(/^0+/, '') || '0';
  if (officeId === 'off_kansas-senate') {
    return { districtId: `dist_senate_${num}`, number: num, label: `Senate District ${num}` };
  }
  if (officeId === 'off_kansas-house') {
    return { districtId: `dist_house_${num}`, number: num, label: `House District ${num}` };
  }
  return { districtId: `dist_other_${officeId}_${num}`, number: num, label: `District ${num}` };
}

/**
 * @param {string|number} cycleText
 * @returns {{ cycleId: string, label: string, year: number }}
 */
export function resolveCycle(cycleText) {
  const year = Number(String(cycleText || '2026').replace(/[^\d]/g, '').slice(0, 4)) || 2026;
  return { cycleId: `cycle_${year}`, label: String(year), year };
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function parseMoney(value) {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (value == null) return 0;
  const n = Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Heuristic expense category from purpose text.
 * @param {string} purpose
 * @returns {string}
 */
export function categorizePurpose(purpose) {
  const t = normalizeName(purpose);
  if (/print|sign|mailer|flyer|brochure/.test(t)) return 'Printing';
  if (/ad|media|radio|tv|digital|facebook|google/.test(t)) return 'Advertising';
  if (/postage|usps|shipping/.test(t)) return 'Postage';
  if (/consult|strateg/.test(t)) return 'Consulting';
  if (/event|dinner|rally|hall|venue/.test(t)) return 'Events';
  if (/travel|gas|hotel|mileage/.test(t)) return 'Travel';
  if (/legal|attorney|compliance/.test(t)) return 'Legal';
  if (/salary|wage|staff|payroll/.test(t)) return 'Payroll';
  if (/office|rent|utilities|supplies/.test(t)) return 'Office';
  return 'Other';
}
