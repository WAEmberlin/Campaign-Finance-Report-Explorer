/**
 * Comparison engine — candidate / district / cycle comparisons.
 * @module services/comparison/comparison-engine
 */

import { getAll } from '../storage/db.js';
import { compute } from '../analytics/analytics-engine.js';

/**
 * Compare candidates by id (side-by-side metrics).
 * @param {string[]} candidateIds
 * @param {Partial<import('../../shared/filters.js').AppFilters>} [baseFilters]
 */
export async function compareCandidates(candidateIds, baseFilters = {}) {
  const rows = [];
  for (const id of candidateIds) {
    const snap = await compute({
      cycle: baseFilters.cycle || '',
      office: baseFilters.office || '',
      district: baseFilters.district || '',
      candidateId: id,
    });
    const c = snap.primaryCandidate;
    rows.push({
      candidateId: id,
      name: c?.name || id,
      party: c?.party || '',
      raised: snap.raised,
      spent: snap.spent,
      cash: snap.cash,
      loans: snap.loans,
      pacPercent: snap.pacPercent,
      individualPercent: snap.individualPercent,
      selfFundingPercent: snap.selfFundingPercent,
      contributionCount: snap.contributionCount,
      expenseCount: snap.expenseCount,
      reportCount: snap.reports.length,
      averageDonation: snap.averageDonation,
      pacDonors: aggregatePacDonors(snap.contributions || []),
    });
  }
  return rows.sort((a, b) => b.raised - a.raised);
}

/**
 * @param {Array<{ donorName?: string, donorType?: string, amount?: number }>} contributions
 * @returns {Array<{ name: string, total: number, count: number }>}
 */
function aggregatePacDonors(contributions) {
  /** @type {Map<string, { name: string, total: number, count: number }>} */
  const map = new Map();
  for (const row of contributions) {
    if (row.donorType !== 'pac') continue;
    const name = row.donorName || 'Unknown PAC';
    const cur = map.get(name) || { name, total: 0, count: 0 };
    cur.total += row.amount || 0;
    cur.count += 1;
    map.set(name, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/**
 * Compare all candidates in a cycle/office (optionally across districts).
 * @param {{ cycle: string, office: string }} filters
 */
export async function compareDistricts(filters) {
  const candidates = await getAll('candidates');
  const cycleId = `cycle_${filters.cycle}`;
  const officeId = `off_${filters.office}`;
  const matched = candidates.filter((c) => c.cycleId === cycleId && c.officeId === officeId);

  /** @type {Map<string, {districtId: string, raised: number, spent: number, cash: number, candidates: number}>} */
  const byDistrict = new Map();
  for (const c of matched) {
    const snap = await compute({
      cycle: filters.cycle,
      office: filters.office,
      district: c.districtId.replace(/^dist_(house|senate)_/, ''),
      candidateId: c.id,
    });
    const cur = byDistrict.get(c.districtId) || {
      districtId: c.districtId,
      raised: 0,
      spent: 0,
      cash: 0,
      candidates: 0,
    };
    cur.raised += snap.raised;
    cur.spent += snap.spent;
    cur.cash += snap.cash;
    cur.candidates += 1;
    byDistrict.set(c.districtId, cur);
  }
  return Array.from(byDistrict.values()).sort((a, b) => b.raised - a.raised);
}

/**
 * Side-by-side cycle comparison for a district/office.
 * @param {{ office: string, district: string, cycles: string[] }} opts
 */
export async function compareCycles(opts) {
  const rows = [];
  for (const cycle of opts.cycles) {
    const snap = await compute({
      cycle,
      office: opts.office,
      district: opts.district,
      candidateId: null,
    });
    rows.push({
      cycle,
      raised: snap.raised,
      spent: snap.spent,
      cash: snap.cash,
      pacPercent: snap.pacPercent,
    });
  }
  return rows;
}
