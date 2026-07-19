/**
 * Persist a ParsedReportJSON into normalized IndexedDB entities.
 * @module services/import/persist-report
 */

import { createId, deterministicId } from '../../shared/ids.js';
import { normalizeName } from '../../shared/format.js';
import { put, putMany, getAllByIndex, remove, getAll } from '../storage/db.js';
import { resolveOffice, resolveDistrict, resolveCycle, parseMoney } from '../parser/normalize.js';
import { classifyContributor } from '../pac/pac-engine.js';
import { normalizeVendor, resolveCategory } from '../vendor/vendor-service.js';
import { emit } from '../../shared/events.js';
import { createLogger } from '../../shared/logger.js';

const log = createLogger('persist');

/**
 * @param {import('../../models/entities.js').ParsedReportJSON} parsed
 * @param {{ sourceKey: string, sourceUrl?: string, fileName?: string, pdfBlob?: ArrayBuffer, replace?: boolean }} meta
 */
export async function persistParsedReport(parsed, meta) {
  const existing = await getAllByIndex('reports', 'sourceKey', meta.sourceKey);
  if (existing.length) {
    if (!meta.replace) {
      log.info('Skipping duplicate sourceKey', meta.sourceKey);
      return { skipped: true, reportId: existing[0].id };
    }
    for (const report of existing) {
      await deleteReportCascade(report.id);
    }
    log.info('Replacing existing sourceKey', meta.sourceKey);
  }

  const office = resolveOffice(parsed.candidate.office || 'Kansas House');
  const district = resolveDistrict(parsed.candidate.district || '', office.officeId);
  const cycle = resolveCycle(parsed.candidate.cycle || '2026');

  await put('offices', { id: office.officeId, label: office.label, slug: office.slug });
  await put('cycles', { id: cycle.cycleId, label: cycle.label, year: cycle.year });
  await put('districts', {
    id: district.districtId,
    officeId: office.officeId,
    number: district.number,
    label: district.label,
  });

  const candidateName = parsed.candidate.name.trim();
  const candidateId = deterministicId(
    'candidate',
    `${normalizeName(candidateName)}|${office.officeId}|${district.districtId}|${cycle.cycleId}`
  );

  /** @type {import('../../models/entities.js').Candidate} */
  const candidate = {
    id: candidateId,
    name: candidateName,
    officeId: office.officeId,
    districtId: district.districtId,
    cycleId: cycle.cycleId,
    party: parsed.candidate.party,
    normalizedName: normalizeName(candidateName),
  };
  await put('candidates', candidate);

  const reportId = createId('report');
  const summary = parsed.summary || {};
  /** @type {import('../../models/entities.js').Report} */
  const report = {
    id: reportId,
    candidateId,
    sourceKey: meta.sourceKey,
    sourceUrl: meta.sourceUrl,
    fileName: meta.fileName,
    cycleId: cycle.cycleId,
    officeId: office.officeId,
    districtId: district.districtId,
    periodStart: summary.periodStart,
    periodEnd: summary.periodEnd,
    filedDate: summary.filedDate,
    beginningBalance: parseMoney(summary.beginningBalance),
    cashOnHand: parseMoney(summary.cashOnHand),
    totalReceipts: parseMoney(summary.totalReceipts),
    totalExpenditures: parseMoney(summary.totalExpenditures),
    totalLoans: parseMoney(summary.totalLoans),
    importedAt: Date.now(),
    status: parsed.warnings?.length ? 'partial' : 'parsed',
    errorMessage: parsed.warnings?.join('; '),
  };
  await put('reports', report);

  if (meta.pdfBlob) {
    await put('pdfBlobs', { reportId, blob: meta.pdfBlob, fileName: meta.fileName });
  }

  /** @type {import('../../models/entities.js').Contribution[]} */
  const contributions = [];
  /** @type {import('../../models/entities.js').Donor[]} */
  const donors = [];
  /** @type {import('../../models/entities.js').Pac[]} */
  const pacs = [];
  /** @type {import('../../models/entities.js').Relationship[]} */
  const relationships = [];

  for (const row of parsed.contributions || []) {
    const donorName = String(row.donorName || '').trim();
    if (!donorName) continue;
    const amount = parseMoney(row.amount);
    const classification = classifyContributor(donorName, {
      occupation: row.occupation,
      employer: row.employer,
      amount,
    });
    const donorType =
      row.donorType === 'pac' || row.donorType === 'individual' || row.donorType === 'committee'
        ? row.donorType
        : classification.type;
    const donorId = deterministicId('donor', normalizeName(donorName));
    donors.push({
      id: donorId,
      name: donorName,
      normalizedName: normalizeName(donorName),
      type: donorType,
      city: row.city,
      state: row.state,
      zip: row.zip,
      occupation: row.occupation,
    });
    if (donorType === 'pac') {
      pacs.push({
        id: deterministicId('pac', normalizeName(classification.matchedName || donorName)),
        name: classification.matchedName || donorName,
        normalizedName: normalizeName(classification.matchedName || donorName),
        confidence: classification.confidence || 0.95,
      });
    }
    const contribId = createId('contribution');
    const selfFunding =
      row.selfFunding === true || isSelfContribution(donorName, candidateName);
    contributions.push({
      id: contribId,
      reportId,
      candidateId,
      donorId,
      donorName,
      donorType: selfFunding ? 'individual' : donorType,
      selfFunding,
      amount,
      date: row.date,
      city: row.city,
      state: row.state,
      zip: row.zip,
      county: row.county,
      occupation: row.occupation || (selfFunding ? 'Candidate' : undefined),
      employer: row.employer,
      schedule: row.schedule || 'A',
    });
    relationships.push({
      id: createId('relationship'),
      type: 'donation',
      fromId: donorId,
      toId: candidateId,
      amount,
      date: row.date,
      meta: { reportId },
    });
  }

  /** @type {import('../../models/entities.js').Expense[]} */
  const expenses = [];
  /** @type {import('../../models/entities.js').Vendor[]} */
  const vendors = [];

  for (const row of parsed.expenses || []) {
    const vendorName = String(row.vendorName || '').trim();
    if (!vendorName) continue;
    const v = normalizeVendor(vendorName);
    const category = resolveCategory(row.purpose, row.category);
    vendors.push({ ...v, category });
    const amount = parseMoney(row.amount);
    const expenseId = createId('expense');
    expenses.push({
      id: expenseId,
      reportId,
      candidateId,
      vendorId: v.id,
      vendorName,
      amount,
      date: row.date,
      purpose: row.purpose,
      category,
      city: row.city,
      state: row.state,
      zip: row.zip,
      schedule: row.schedule || 'B',
    });
    relationships.push({
      id: createId('relationship'),
      type: 'payment',
      fromId: candidateId,
      toId: v.id,
      amount,
      date: row.date,
      meta: { reportId, category },
    });
  }

  await putMany('donors', dedupeById(donors));
  await putMany('pacs', dedupeById(pacs));
  await putMany('vendors', dedupeById(vendors));
  await putMany('contributions', contributions);
  await putMany('expenses', expenses);
  await putMany('relationships', relationships);

  emit('report:imported', { reportId, candidateId });
  log.info('Persisted report', { reportId, contributions: contributions.length, expenses: expenses.length });
  return { skipped: false, reportId, candidateId };
}

/**
 * Remove a report and its contributions, expenses, relationships, and PDF blob.
 * @param {string} reportId
 */
async function deleteReportCascade(reportId) {
  const [contributions, expenses, relationships] = await Promise.all([
    getAllByIndex('contributions', 'reportId', reportId),
    getAllByIndex('expenses', 'reportId', reportId),
    getAll('relationships'),
  ]);
  for (const row of contributions) await remove('contributions', row.id);
  for (const row of expenses) await remove('expenses', row.id);
  for (const rel of relationships) {
    if (rel.meta?.reportId === reportId) await remove('relationships', rel.id);
  }
  try {
    await remove('pdfBlobs', reportId);
  } catch {
    /* optional */
  }
  await remove('reports', reportId);
}

/**
 * Match donor to candidate for self-funding (e.g. "Kylie Kilmer" vs "Kylie Christine Kilmer").
 * @param {string} donorName
 * @param {string} candidateName
 */
function isSelfContribution(donorName, candidateName) {
  const a = normalizeName(donorName);
  const b = normalizeName(candidateName);
  if (!a || !b) return false;
  if (a === b) return true;
  const ap = a.split(' ').filter(Boolean);
  const bp = b.split(' ').filter(Boolean);
  if (ap.length < 2 || bp.length < 2) return false;
  return ap[0] === bp[0] && ap[ap.length - 1] === bp[bp.length - 1];
}

/**
 * @template {{id: string}} T
 * @param {T[]} items
 * @returns {T[]}
 */
function dedupeById(items) {
  const map = new Map();
  for (const item of items) map.set(item.id, item);
  return Array.from(map.values());
}
