import { classifyContributor, setOverride } from '../../assets/js/services/pac/pac-engine.js';

export const tests = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

tests.push({
  name: 'classifyContributor detects PAC patterns',
  fn() {
    const r = classifyContributor('Friends of Kansas House PAC');
    assert(r.type === 'pac', `expected pac got ${r.type}`);
  },
});

tests.push({
  name: 'classifyContributor detects organizations',
  fn() {
    const r = classifyContributor('Midwest Ag Solutions LLC');
    assert(r.type === 'organization');
  },
});

tests.push({
  name: 'classifyContributor respects overrides',
  fn() {
    setOverride('Mystery Entity', 'committee');
    assert(classifyContributor('Mystery Entity').type === 'committee');
  },
});

tests.push({
  name: 'filled occupation marks individual even for org-like names',
  fn() {
    const r = classifyContributor('Jordan Avery', {
      occupation: 'Teacher',
      amount: 200,
    });
    assert(r.type === 'individual', `expected individual got ${r.type}`);
  },
});

tests.push({
  name: 'blank occupation + over $150 + org-shaped name → pac',
  fn() {
    const r = classifyContributor('Kansas Widget Coalition', {
      amount: 250,
    });
    assert(r.type === 'pac', `expected pac got ${r.type}`);
  },
});

tests.push({
  name: 'blank occupation under $150 person still individual',
  fn() {
    const r = classifyContributor('Jane Donor', { amount: 50 });
    assert(r.type === 'individual', `expected individual got ${r.type}`);
  },
});

export function runPacTests() {
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
