import { generateInsights } from '../../assets/js/services/insights/insight-engine.js';
import { summarizeVendors } from '../../assets/js/services/vendor/vendor-service.js';

export const tests = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

tests.push({
  name: 'summarizeVendors aggregates spend',
  fn() {
    const rows = summarizeVendors([
      { vendorId: 'v1', vendorName: 'Print', amount: 100, category: 'Printing' },
      { vendorId: 'v1', vendorName: 'Print', amount: 50, category: 'Printing' },
      { vendorId: 'v2', vendorName: 'Ads', amount: 200, category: 'Advertising' },
    ]);
    assert(rows[0].vendorId === 'v2');
    assert(rows.find((r) => r.vendorId === 'v1').total === 150);
  },
});

tests.push({
  name: 'generateInsights returns empty-state guidance',
  fn() {
    const cards = generateInsights({
      raised: 0,
      spent: 0,
      cash: 0,
      loans: 0,
      averageDonation: 0,
      medianDonation: 0,
      largestDonation: 0,
      contributionCount: 0,
      expenseCount: 0,
      pacPercent: 0,
      individualPercent: 0,
      selfFundingPercent: 0,
      smallDonorPercent: 0,
      topDonors: [],
      topVendors: [],
      expenseCategories: [],
      fundraisingTimeline: [],
      expenseTimeline: [],
      candidates: [],
      reports: [],
      contributions: [],
      expenses: [],
      primaryCandidate: null,
    });
    assert(cards.length === 1);
    assert(/No imported reports/i.test(cards[0]));
  },
});

tests.push({
  name: 'generateInsights includes PAC and printing shares',
  fn() {
    const cards = generateInsights({
      raised: 1000,
      spent: 500,
      cash: 200,
      loans: 0,
      averageDonation: 100,
      medianDonation: 100,
      largestDonation: 400,
      contributionCount: 10,
      expenseCount: 2,
      pacPercent: 0.25,
      individualPercent: 0.7,
      selfFundingPercent: 0.05,
      smallDonorPercent: 0.1,
      topDonors: [{ name: 'Pat', total: 400, count: 2 }],
      topVendors: [{ name: 'PrintCo', total: 200, count: 1, category: 'Printing' }],
      expenseCategories: [{ name: 'Printing', total: 190 }],
      fundraisingTimeline: [],
      expenseTimeline: [],
      candidates: [{ id: 'c1', name: 'Alex' }],
      reports: [],
      contributions: [],
      expenses: [],
      primaryCandidate: { id: 'c1', name: 'Alex' },
    });
    assert(cards.some((c) => /PAC/i.test(c)));
    assert(cards.some((c) => /Printing/i.test(c)));
  },
});

export function runAnalyticsTests() {
  let passed = 0;
  let failed = 0;
  const errors = [];
  for (const t of tests) {
    try {
      t.fn();
      passed += 1;
    } catch (err) {
      failed += 1;
      errors.push(`${t.name}: ${err.message}`);
    }
  }
  return { passed, failed, errors };
}
