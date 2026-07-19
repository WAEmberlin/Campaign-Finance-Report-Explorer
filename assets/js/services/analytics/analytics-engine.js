/**
 * Analytics engine — deterministic metrics from IndexedDB entities.
 * @module services/analytics/analytics-engine
 */

import { getAll } from '../storage/db.js';
import { summarizeVendors } from '../vendor/vendor-service.js';
import { normalizeName } from '../../shared/format.js';

/**
 * @typedef {Object} AnalyticsSnapshot
 * @property {number} raised
 * @property {number} spent
 * @property {number} cash
 * @property {number} loans
 * @property {number} averageDonation
 * @property {number} medianDonation
 * @property {number} largestDonation
 * @property {number} contributionCount
 * @property {number} expenseCount
 * @property {number} pacPercent
 * @property {number} individualPercent
 * @property {number} selfFundingPercent
 * @property {number} smallDonorPercent
 * @property {Array<{name: string, total: number, count: number, city?: string, state?: string, occupation?: string}>} topDonors
 * @property {Array<{name: string, total: number, count: number, category: string}>} topVendors
 * @property {Array<{category: string, total: number}>} expenseCategories
 * @property {Array<{date: string, amount: number}>} fundraisingTimeline
 * @property {Array<{date: string, amount: number}>} expenseTimeline
 * @property {Array<object>} candidates
 * @property {Array<object>} reports
 * @property {Array<object>} contributions
 * @property {Array<object>} expenses
 * @property {object|null} primaryCandidate
 */

/**
 * @param {import('../../shared/filters.js').AppFilters} filters
 * @returns {Promise<AnalyticsSnapshot>}
 */
export async function compute(filters) {
  const [candidates, reports, contributions, expenses] = await Promise.all([
    getAll('candidates'),
    getAll('reports'),
    getAll('contributions'),
    getAll('expenses'),
  ]);

  const cycleId = filters.cycle ? `cycle_${filters.cycle}` : null;
  const officeId = filters.office ? `off_${filters.office}` : null;
  const districtId = districtIdFromFilters(filters);

  let filteredCandidates = candidates.filter((c) => {
    if (cycleId && c.cycleId !== cycleId) return false;
    if (officeId && c.officeId !== officeId) return false;
    if (districtId && c.districtId !== districtId) return false;
    if (filters.candidateId && c.id !== filters.candidateId) return false;
    return true;
  });

  const candidateIds = new Set(filteredCandidates.map((c) => c.id));
  let filteredReports = reports.filter((r) => candidateIds.has(r.candidateId));
  let filteredContribs = contributions.filter((c) => candidateIds.has(c.candidateId));
  let filteredExpenses = expenses.filter((e) => candidateIds.has(e.candidateId));

  const raisedFromRows = sum(filteredContribs.map((c) => c.amount));
  const spentFromRows = sum(filteredExpenses.map((e) => e.amount));
  const raisedFromReports = sum(filteredReports.map((r) => r.totalReceipts));
  const spentFromReports = sum(filteredReports.map((r) => r.totalExpenditures));
  // Report summary totals are authoritative; itemized rows fill donor/vendor explorers
  const raised = raisedFromReports > 0 ? raisedFromReports : raisedFromRows;
  const spent = spentFromReports > 0 ? spentFromReports : spentFromRows;
  const cash = sum(filteredReports.map((r) => r.cashOnHand));
  const loans = sum(filteredReports.map((r) => r.totalLoans));

  const amounts = filteredContribs.map((c) => c.amount).sort((a, b) => a - b);
  const averageDonation = amounts.length ? raisedFromRows / amounts.length : 0;
  const medianDonation = median(amounts);
  const largestDonation = amounts.length ? amounts[amounts.length - 1] : 0;

  const denom = raisedFromRows || raised;
  const pacTotal = sum(filteredContribs.filter((c) => c.donorType === 'pac').map((c) => c.amount));
  const individualTotal = sum(
    filteredContribs.filter((c) => c.donorType === 'individual').map((c) => c.amount)
  );
  const primary = filteredCandidates[0] || null;
  const selfTotal = sum(
    filteredContribs
      .filter(
        (c) =>
          c.selfFunding === true ||
          (primary?.name && c.donorName && isSelfDonor(c.donorName, primary.name))
      )
      .map((c) => c.amount)
  );

  const smallDonorTotal = sum(filteredContribs.filter((c) => c.amount < 100).map((c) => c.amount));

  const topDonors = aggregateDonors(filteredContribs).slice(0, 25);
  const topVendors = summarizeVendors(filteredExpenses).slice(0, 25);
  const expenseCategories = aggregateBy(filteredExpenses, (e) => e.category || 'Other', (e) => e.amount);

  return {
    raised,
    spent,
    cash,
    loans,
    averageDonation,
    medianDonation,
    largestDonation,
    contributionCount: filteredContribs.length,
    expenseCount: filteredExpenses.length,
    pacPercent: denom ? pacTotal / denom : 0,
    individualPercent: denom ? individualTotal / denom : 0,
    selfFundingPercent: denom ? selfTotal / denom : 0,
    smallDonorPercent: denom ? smallDonorTotal / denom : 0,
    topDonors,
    topVendors,
    expenseCategories,
    fundraisingTimeline: timeline(filteredContribs),
    expenseTimeline: timeline(filteredExpenses),
    candidates: filteredCandidates,
    reports: filteredReports,
    contributions: filteredContribs,
    expenses: filteredExpenses,
    primaryCandidate: primary,
  };
}

/**
 * Statewide intelligence aggregates (ignore district filter).
 */
export async function computeStatewide(filters) {
  return compute({ ...filters, district: '', candidateId: null });
}

/**
 * @param {import('../../shared/filters.js').AppFilters} filters
 */
function districtIdFromFilters(filters) {
  if (!filters.district) return null;
  if (filters.office === 'kansas-senate') return `dist_senate_${filters.district}`;
  if (filters.office === 'kansas-house') return `dist_house_${filters.district}`;
  return null;
}

function sum(nums) {
  return nums.reduce((a, b) => a + (Number(b) || 0), 0);
}

function median(sorted) {
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function normalizeEq(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

/** Match "Kylie Kilmer" to candidate "Kylie Christine Kilmer". */
function isSelfDonor(donorName, candidateName) {
  const a = normalizeName(donorName);
  const b = normalizeName(candidateName);
  if (!a || !b) return false;
  if (a === b) return true;
  const ap = a.split(' ').filter(Boolean);
  const bp = b.split(' ').filter(Boolean);
  if (ap.length < 2 || bp.length < 2) return false;
  // Same first + last (ignore middle names)
  return ap[0] === bp[0] && ap[ap.length - 1] === bp[bp.length - 1];
}

/**
 * @template T
 * @param {T[]} rows
 * @param {(row: T) => string} keyFn
 * @param {(row: T) => number} amountFn
 */
function aggregateBy(rows, keyFn, amountFn) {
  /** @type {Map<string, {name: string, total: number, count: number}>} */
  const map = new Map();
  for (const row of rows) {
    const name = keyFn(row) || 'Unknown';
    const cur = map.get(name) || { name, total: 0, count: 0 };
    cur.total += amountFn(row) || 0;
    cur.count += 1;
    map.set(name, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/**
 * Aggregate donors with city/state/occupation from contribution rows (first non-empty wins).
 * @param {Array<{ donorName?: string, amount?: number, city?: string, state?: string, occupation?: string }>} contributions
 * @returns {Array<{ name: string, total: number, count: number, city: string, state: string, occupation: string }>}
 */
function aggregateDonors(contributions) {
  /** @type {Map<string, { name: string, total: number, count: number, city: string, state: string, occupation: string }>} */
  const map = new Map();
  for (const row of contributions) {
    const name = row.donorName || 'Unknown';
    const cur = map.get(name) || {
      name,
      total: 0,
      count: 0,
      city: '',
      state: '',
      occupation: '',
    };
    cur.total += row.amount || 0;
    cur.count += 1;
    if (!cur.city && row.city) cur.city = String(row.city).trim();
    if (!cur.state && row.state) cur.state = String(row.state).trim();
    if (!cur.occupation && row.occupation) cur.occupation = String(row.occupation).trim();
    map.set(name, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/**
 * @param {Array<{date?: string, amount: number}>} rows
 */
function timeline(rows) {
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const row of rows) {
    const key = (row.date || 'unknown').slice(0, 10);
    map.set(key, (map.get(key) || 0) + (row.amount || 0));
  }
  return Array.from(map.entries())
    .filter(([d]) => d !== 'unknown')
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, amount]) => ({ date, amount }));
}
