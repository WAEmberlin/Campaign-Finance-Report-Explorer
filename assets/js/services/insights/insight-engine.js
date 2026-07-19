/**
 * Deterministic rule-based insights. No AI.
 * @module services/insights/insight-engine
 */

import { formatCurrency, formatPercent } from '../../shared/format.js';

/**
 * @param {import('../analytics/analytics-engine.js').AnalyticsSnapshot} snap
 * @returns {string[]}
 */
export function generateInsights(snap) {
  /** @type {string[]} */
  const cards = [];
  if (!snap.contributionCount && !snap.expenseCount) {
    return ['No imported reports match the current filters. Refresh From Kansas or drop PDF files to begin.'];
  }

  if (snap.raised > 0) {
    cards.push(`Campaign raised ${formatCurrency(snap.raised)} across ${snap.contributionCount} contributions.`);
  }
  if (snap.spent > 0) {
    cards.push(`Campaign spent ${formatCurrency(snap.spent)} across ${snap.expenseCount} expenditures.`);
  }
  if (snap.cash > 0) {
    cards.push(`Cash on hand totals ${formatCurrency(snap.cash)}.`);
  }
  if (snap.individualPercent > 0) {
    cards.push(`${formatPercent(snap.individualPercent)} of contributions came from individuals.`);
  }
  if (snap.pacPercent > 0) {
    cards.push(`PAC funding represents ${formatPercent(snap.pacPercent)} of contributions.`);
  }
  if (snap.selfFundingPercent > 0.05) {
    cards.push(`Self-funding accounts for ${formatPercent(snap.selfFundingPercent)} of receipts.`);
  }
  if (snap.topDonors[0]) {
    const d = snap.topDonors[0];
    const share = snap.raised ? d.total / snap.raised : 0;
    cards.push(`Largest donor ${d.name} contributed ${formatCurrency(d.total)} (${formatPercent(share)}).`);
  }
  if (snap.topVendors[0]) {
    const v = snap.topVendors[0];
    cards.push(`Top vendor ${v.name} received ${formatCurrency(v.total)}.`);
  }
  const printing = snap.expenseCategories.find((c) => c.category === 'Printing' || c.name === 'Printing');
  if (printing && snap.spent > 0) {
    const total = printing.total;
    cards.push(`Printing represented ${formatPercent(total / snap.spent)} of campaign spending.`);
  }
  const advertising = snap.expenseCategories.find(
    (c) => c.category === 'Advertising' || c.name === 'Advertising'
  );
  if (advertising && snap.spent > 0) {
    cards.push(`Advertising represented ${formatPercent(advertising.total / snap.spent)} of spending.`);
  }
  if (snap.largestDonation > 0) {
    cards.push(`Largest single contribution was ${formatCurrency(snap.largestDonation)}.`);
  }
  if (snap.averageDonation > 0) {
    cards.push(
      `Average donation ${formatCurrency(snap.averageDonation)}; median ${formatCurrency(snap.medianDonation)}.`
    );
  }
  if (snap.smallDonorPercent > 0) {
    cards.push(`Small donors (<$100) provided ${formatPercent(snap.smallDonorPercent)} of fundraising.`);
  }

  return cards.slice(0, 12);
}
