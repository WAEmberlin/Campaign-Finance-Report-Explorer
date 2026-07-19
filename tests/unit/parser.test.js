/**
 * Parser unit tests — run via tests/run.html or Node with --experimental-vm-modules
 */
import { parseTextToReport } from '../../assets/js/services/parser/pdf-parser.js';
import { resolveOffice, resolveDistrict, parseMoney, categorizePurpose } from '../../assets/js/services/parser/normalize.js';

/** @type {Array<{name: string, fn: () => void}>} */
export const tests = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

tests.push({
  name: 'resolveOffice maps house/senate',
  fn() {
    assert(resolveOffice('Kansas House of Representatives').slug === 'kansas-house');
    assert(resolveOffice('State Senate').slug === 'kansas-senate');
    assert(resolveOffice('Governor').slug === 'governor');
  },
});

tests.push({
  name: 'resolveDistrict builds statewide IDs',
  fn() {
    const d = resolveDistrict('70', 'off_kansas-house');
    assert(d.districtId === 'dist_house_70');
    assert(resolveDistrict(5, 'off_kansas-senate').districtId === 'dist_senate_5');
  },
});

tests.push({
  name: 'parseMoney handles currency strings',
  fn() {
    assert(parseMoney('$1,234.50') === 1234.5);
    assert(parseMoney(100) === 100);
    assert(parseMoney('nope') === 0);
  },
});

tests.push({
  name: 'categorizePurpose detects printing/ads',
  fn() {
    assert(categorizePurpose('Yard signs and mailers') === 'Printing');
    assert(categorizePurpose('Facebook digital ads') === 'Advertising');
  },
});

tests.push({
  name: 'parseTextToReport extracts candidate and totals',
  fn() {
    const text = `
      Name of Candidate: Alex Rivera
      Office Sought: Kansas House
      District: 70
      Election Cycle: 2026
      Beginning Cash: $10,000.00
      Cash on Hand: $15,000.00
      Total Receipts: $8,000.00
      Total Expenditures: $3,000.00
      Schedule A
      Pat Morgan 01/02/2025 $500.00 Salina KS
      Schedule B
      PrintWorks 02/03/2025 $200.00 yard signs
    `;
    const parsed = parseTextToReport(text);
    assert(parsed.candidate.name.includes('Alex Rivera'), 'name');
    assert(parsed.candidate.district === '70', 'district');
    assert(parsed.summary.cashOnHand === 15000, 'cash');
    assert(parsed.contributions.length >= 1, 'contribs');
    assert(parsed.expenses.length >= 1, 'expenses');
  },
});

/**
 * @returns {{ passed: number, failed: number, errors: string[] }}
 */
export function runParserTests() {
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
