/**
 * Dashboard views — district, intelligence, explorers.
 * @module modules/dashboard
 */

import { compute, computeStatewide } from '../services/analytics/analytics-engine.js';
import { generateInsights } from '../services/insights/insight-engine.js';
import { formatCurrency, formatPercent, formatNumber } from '../shared/format.js';
import { renderBar, renderDoughnut, renderLine, exportChartPng } from './charts/chart-factory.js';
import { renderTable } from '../components/table.js';
import { compareCandidates, compareDistricts } from '../services/comparison/comparison-engine.js';
import { getFilters, setFilters } from '../shared/filters.js';

/**
 * @param {string} label
 * @param {string} value
 */
function metricHtml(label, value) {
  return `<div class="metric-card"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

/**
 * Refresh the main district dashboard.
 * Multi-candidate (no candidateId): side-by-side comparison.
 * Single candidate: detailed dashboard.
 * @param {import('../shared/filters.js').AppFilters} filters
 */
export async function renderDistrictDashboard(filters) {
  const snap = await compute(filters);
  const empty = document.getElementById('district-empty');
  const content = document.getElementById('district-content');
  const comparison = document.getElementById('district-comparison');
  const detail = document.getElementById('district-detail');
  const title = document.getElementById('district-title');
  const subtitle = document.getElementById('district-subtitle');

  const officeLabel = (filters.office || '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const hasData =
    snap.contributionCount > 0 ||
    snap.expenseCount > 0 ||
    snap.reports.length > 0 ||
    snap.candidates.length > 0;

  if (empty) {
    empty.hidden = hasData;
    empty.setAttribute('aria-hidden', hasData ? 'true' : 'false');
  }
  if (content) {
    content.hidden = !hasData;
    content.setAttribute('aria-hidden', hasData ? 'false' : 'true');
  }

  if (!hasData) {
    if (comparison) comparison.hidden = true;
    if (detail) detail.hidden = true;
    return snap;
  }

  const multiCompare = snap.candidates.length > 1 && !filters.candidateId;

  if (title) {
    title.textContent = multiCompare
      ? `District ${filters.district || '—'} — Candidate Comparison`
      : snap.primaryCandidate?.name || `District ${filters.district || '—'} Dashboard`;
  }
  if (subtitle) {
    subtitle.textContent = multiCompare
      ? `${filters.cycle} · ${officeLabel} · District ${filters.district} · ${snap.candidates.length} candidates side by side`
      : `${filters.cycle} · ${officeLabel} · District ${filters.district}`;
  }

  if (multiCompare) {
    if (comparison) comparison.hidden = false;
    if (detail) detail.hidden = true;
    await renderCandidateComparison(filters, snap.candidates);
  } else {
    if (comparison) comparison.hidden = true;
    if (detail) detail.hidden = false;
    await renderCandidateDetail(filters, snap);
  }

  return snap;
}

/**
 * Side-by-side comparison of every candidate in the district.
 * @param {import('../shared/filters.js').AppFilters} filters
 * @param {Array<{id: string, name: string, party?: string}>} candidates
 */
async function renderCandidateComparison(filters, candidates) {
  const rows = await compareCandidates(
    candidates.map((c) => c.id),
    filters
  );

  /** @type {Map<string, { name: string, pacDonors: Array<{name: string, total: number, count: number}> }>} */
  const pacByCandidate = new Map(
    rows.map((r) => [r.candidateId, { name: r.name, pacDonors: r.pacDonors || [] }])
  );

  const columns = document.getElementById('district-compare-columns');
  if (columns) {
    columns.innerHTML = rows
      .map(
        (r) => `
      <article class="compare-card">
        <header>
          <h2>${escapeHtml(r.name)}</h2>
          <p class="party">${escapeHtml(r.party || '—')}</p>
        </header>
        <dl class="compare-metrics">
          <div><dt>Raised</dt><dd>${formatCurrency(r.raised)}</dd></div>
          <div><dt>Spent</dt><dd>${formatCurrency(r.spent)}</dd></div>
          <div><dt>Cash on Hand</dt><dd>${formatCurrency(r.cash)}</dd></div>
          <div><dt>Loans</dt><dd>${formatCurrency(r.loans)}</dd></div>
          <div><dt>PAC %</dt><dd>${formatPercent(r.pacPercent)}</dd></div>
          <div><dt>Individual %</dt><dd>${formatPercent(r.individualPercent)}</dd></div>
          <div><dt>Self-Funding %</dt><dd>${formatPercent(r.selfFundingPercent)}</dd></div>
          <div><dt>Avg Donation</dt><dd>${formatCurrency(r.averageDonation)}</dd></div>
          <div><dt>Itemized gifts</dt><dd>${formatNumber(r.contributionCount)}</dd></div>
          <div><dt>Itemized expenses</dt><dd>${formatNumber(r.expenseCount)}</dd></div>
        </dl>
        <div class="compare-actions">
          <button type="button" class="btn btn-ghost" data-pac-list="${r.candidateId}">
            PAC list${(r.pacDonors || []).length ? ` (${r.pacDonors.length})` : ''}
          </button>
          <button type="button" class="btn btn-primary" data-candidate-id="${r.candidateId}">
            View filings
          </button>
        </div>
      </article>`
      )
      .join('');

    columns.querySelectorAll('[data-candidate-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setFilters({ candidateId: btn.getAttribute('data-candidate-id') });
      });
    });
    columns.querySelectorAll('[data-pac-list]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-pac-list');
        const entry = id ? pacByCandidate.get(id) : null;
        openPacListDialog(entry?.name || 'Candidate', entry?.pacDonors || []);
      });
    });
  }

  renderBar(
    'chart-compare-raised',
    rows.map((r) => ({ name: shortName(r.name), total: r.raised })),
    'Raised'
  );
  renderBar(
    'chart-compare-cash',
    rows.map((r) => ({ name: shortName(r.name), total: r.cash })),
    'Cash'
  );

  renderTable('#district-compare-table', rows, [
    { key: 'name', label: 'Candidate' },
    { key: 'party', label: 'Party' },
    { key: 'raised', label: 'Raised', format: (v) => formatCurrency(v) },
    { key: 'spent', label: 'Spent', format: (v) => formatCurrency(v) },
    { key: 'cash', label: 'Cash', format: (v) => formatCurrency(v) },
    { key: 'loans', label: 'Loans', format: (v) => formatCurrency(v) },
    { key: 'pacPercent', label: 'PAC %', format: (v) => formatPercent(v) },
    { key: 'selfFundingPercent', label: 'Self %', format: (v) => formatPercent(v) },
  ]);
}

/**
 * Single-candidate (or sole-candidate) detailed dashboard.
 * @param {import('../shared/filters.js').AppFilters} filters
 * @param {import('../services/analytics/analytics-engine.js').AnalyticsSnapshot} snap
 */
async function renderCandidateDetail(filters, snap) {
  const candidatePanel = document.getElementById('district-candidates');
  const metrics = document.getElementById('district-metrics');
  const insights = document.getElementById('district-insights');

  if (candidatePanel) {
    if (filters.candidateId) {
      candidatePanel.hidden = false;
      candidatePanel.innerHTML = `
        <p class="hint">
          Showing <strong>${escapeHtml(snap.primaryCandidate?.name || 'selected candidate')}</strong>.
          <button type="button" class="btn btn-ghost btn-sm" id="btn-clear-candidate">Back to candidate comparison</button>
        </p>
      `;
      document.getElementById('btn-clear-candidate')?.addEventListener('click', () => {
        setFilters({ candidateId: null });
      });
    } else {
      candidatePanel.hidden = true;
      candidatePanel.innerHTML = '';
    }
  }

  if (metrics) {
    metrics.innerHTML = [
      metricHtml('Raised', formatCurrency(snap.raised)),
      metricHtml('Spent', formatCurrency(snap.spent)),
      metricHtml('Cash on Hand', formatCurrency(snap.cash)),
      metricHtml('Loans', formatCurrency(snap.loans)),
      metricHtml('Avg Donation', formatCurrency(snap.averageDonation)),
      metricHtml('PAC %', formatPercent(snap.pacPercent)),
      metricHtml('Individual %', formatPercent(snap.individualPercent)),
      metricHtml('Self-Funding %', formatPercent(snap.selfFundingPercent)),
    ].join('');
  }

  if (insights) {
    insights.innerHTML = generateInsights(snap)
      .map((t) => `<div class="insight-card">${t}</div>`)
      .join('');
  }

  renderBar(
    'chart-top-donors',
    snap.topDonors.slice(0, 8).map((d) => ({ name: d.name, total: d.total })),
    'Donations'
  );
  renderBar(
    'chart-top-vendors',
    snap.topVendors.slice(0, 8).map((v) => ({ name: v.name, total: v.total })),
    'Spending'
  );
  renderDoughnut(
    'chart-categories',
    snap.expenseCategories.slice(0, 8).map((c) => ({ name: c.name, total: c.total }))
  );
  renderLine('chart-timeline', snap.fundraisingTimeline, 'Fundraising');

  const pacDonors = aggregatePacDonors(snap.contributions || []);
  const pacSummary = document.getElementById('pac-donations-summary');
  if (pacSummary) {
    const pacTotal = pacDonors.reduce((s, p) => s + p.total, 0);
    pacSummary.textContent = pacDonors.length
      ? `${pacDonors.length} PAC${pacDonors.length === 1 ? '' : 's'} · ${formatCurrency(pacTotal)}`
      : 'No PAC donations in itemized gifts';
  }
  renderTable('#table-pac-donations', pacDonors, [
    { key: 'name', label: 'PAC' },
    { key: 'total', label: 'Total', format: (v) => formatCurrency(v) },
    { key: 'count', label: 'Gifts', format: (v) => formatNumber(v) },
  ]);

  const typeFilter = /** @type {HTMLSelectElement|null} */ (document.getElementById('contrib-type-filter'));
  const contribColumns = [
    { key: 'date', label: 'Date' },
    { key: 'donorName', label: 'Donor' },
    { key: 'donorType', label: 'Type' },
    { key: 'amount', label: 'Amount', format: (v) => formatCurrency(v) },
    { key: 'city', label: 'City' },
  ];

  const paintContributions = () => {
    const type = typeFilter?.value || 'all';
    const rows = filterContributionsByType(snap.contributions || [], type);
    renderTable('#table-contributions', rows, contribColumns);
  };
  paintContributions();
  if (typeFilter) {
    typeFilter.onchange = paintContributions;
  }

  renderTable('#table-expenses', snap.expenses, [
    { key: 'date', label: 'Date' },
    { key: 'vendorName', label: 'Vendor' },
    { key: 'category', label: 'Category' },
    { key: 'amount', label: 'Amount', format: (v) => formatCurrency(v) },
    { key: 'purpose', label: 'Purpose' },
  ]);
}

/**
 * @param {Array<{ donorName?: string, donorType?: string, amount?: number, selfFunding?: boolean }>} contributions
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
 * @param {Array<{ donorType?: string, selfFunding?: boolean }>} contributions
 * @param {string} type
 */
function filterContributionsByType(contributions, type) {
  if (type === 'all') return contributions;
  if (type === 'pac') return contributions.filter((c) => c.donorType === 'pac');
  if (type === 'self') return contributions.filter((c) => c.selfFunding === true);
  if (type === 'individual') {
    return contributions.filter((c) => c.donorType === 'individual' && !c.selfFunding);
  }
  return contributions.filter(
    (c) => c.donorType !== 'pac' && c.donorType !== 'individual' && !c.selfFunding
  );
}

/**
 * @param {string} candidateName
 * @param {Array<{ name: string, total: number, count: number }>} pacDonors
 */
function openPacListDialog(candidateName, pacDonors) {
  const dialog = /** @type {HTMLDialogElement|null} */ (document.getElementById('pac-list-dialog'));
  const title = document.getElementById('pac-list-dialog-title');
  const body = document.getElementById('pac-list-dialog-body');
  if (!dialog || !body) return;
  if (title) title.textContent = `PAC donations — ${candidateName}`;
  if (!pacDonors.length) {
    body.innerHTML = '<p class="hint">No PAC donations in itemized gifts for this candidate.</p>';
  } else {
    const total = pacDonors.reduce((s, p) => s + p.total, 0);
    body.innerHTML = `
      <p class="pac-dialog-summary">${pacDonors.length} PAC${pacDonors.length === 1 ? '' : 's'} · ${formatCurrency(total)}</p>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th scope="col">PAC</th><th scope="col">Amount</th><th scope="col">Gifts</th></tr></thead>
          <tbody>
            ${pacDonors
              .map(
                (p) => `<tr>
              <td>${escapeHtml(p.name)}</td>
              <td>${formatCurrency(p.total)}</td>
              <td>${formatNumber(p.count)}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`;
  }
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

/**
 * Campaign Intelligence Center (statewide).
 * @param {import('../shared/filters.js').AppFilters} filters
 */
export async function renderIntelligenceCenter(filters) {
  const snap = await computeStatewide(filters);
  const metrics = document.getElementById('intel-metrics');
  const list = document.getElementById('intel-lists');

  if (metrics) {
    metrics.innerHTML = [
      metricHtml('Statewide Raised', formatCurrency(snap.raised)),
      metricHtml('Statewide Spent', formatCurrency(snap.spent)),
      metricHtml('Candidates', formatNumber(snap.candidates.length)),
      metricHtml('Reports', formatNumber(snap.reports.length)),
      metricHtml('Contributions', formatNumber(snap.contributionCount)),
      metricHtml('Top PAC Share', formatPercent(snap.pacPercent)),
    ].join('');
  }

  const largestFundraiser = [...snap.candidates]
    .map((c) => {
      const fromRows = snap.contributions
        .filter((x) => x.candidateId === c.id)
        .reduce((s, x) => s + x.amount, 0);
      const fromReports = snap.reports
        .filter((r) => r.candidateId === c.id)
        .reduce((s, r) => s + (r.totalReceipts || 0), 0);
      return { name: c.name, total: fromReports > 0 ? fromReports : fromRows };
    })
    .sort((a, b) => b.total - a.total)[0];

  const largestCash = [...snap.reports].sort((a, b) => b.cashOnHand - a.cashOnHand)[0];
  const cashCandidate = snap.candidates.find((c) => c.id === largestCash?.candidateId);

  if (list) {
    list.innerHTML = `
      <div class="panel-grid">
        <div class="panel">
          <h2>Largest Fundraiser</h2>
          <p>${largestFundraiser ? `${escapeHtml(largestFundraiser.name)} — ${formatCurrency(largestFundraiser.total)}` : '—'}</p>
        </div>
        <div class="panel">
          <h2>Largest Cash on Hand</h2>
          <p>${cashCandidate && largestCash ? `${escapeHtml(cashCandidate.name)} — ${formatCurrency(largestCash.cashOnHand)}` : '—'}</p>
        </div>
        <div class="panel">
          <h2>Top 10 Donors</h2>
          <ol>${snap.topDonors.slice(0, 10).map((d) => `<li>${escapeHtml(d.name)} — ${formatCurrency(d.total)}</li>`).join('') || '<li>None</li>'}</ol>
        </div>
        <div class="panel">
          <h2>Top 10 Vendors</h2>
          <ol>${snap.topVendors.slice(0, 10).map((v) => `<li>${escapeHtml(v.name)} — ${formatCurrency(v.total)}</li>`).join('') || '<li>None</li>'}</ol>
        </div>
        <div class="panel">
          <h2>Top Expense Categories</h2>
          <ol>${snap.expenseCategories.slice(0, 10).map((c) => `<li>${escapeHtml(c.name)} — ${formatCurrency(c.total)}</li>`).join('') || '<li>None</li>'}</ol>
        </div>
        <div class="panel">
          <h2>Insights</h2>
          <div class="insight-list">${generateInsights(snap).map((t) => `<div class="insight-card">${escapeHtml(t)}</div>`).join('')}</div>
        </div>
      </div>
    `;
  }

  renderBar(
    'chart-intel-donors',
    snap.topDonors.slice(0, 10).map((d) => ({ name: d.name, total: d.total }))
  );
}

/**
 * Donor explorer — stacked per-candidate tables for the active filters.
 * @param {import('../shared/filters.js').AppFilters} filters
 */
export async function renderDonorExplorer(filters) {
  const root = document.getElementById('donor-explorer-by-candidate');
  if (!root) return;

  const base = await compute(filters);
  let candidates = base.candidates || [];
  if (filters.candidateId) {
    candidates = candidates.filter((c) => c.id === filters.candidateId);
  }

  if (!candidates.length) {
    root.innerHTML =
      '<div class="empty-state"><p>No candidates match the current filters. Refresh From Kansas or adjust filters.</p></div>';
    return;
  }

  /** @type {Array<{ candidate: {id: string, name: string, party?: string}, snap: import('../services/analytics/analytics-engine.js').AnalyticsSnapshot }>} */
  const sections = [];
  for (const candidate of candidates) {
    const snap = await compute({
      cycle: filters.cycle || '',
      office: filters.office || '',
      district: filters.district || '',
      candidateId: candidate.id,
    });
    sections.push({ candidate, snap });
  }

  sections.sort((a, b) => b.snap.raised - a.snap.raised);

  root.innerHTML = sections
    .map(
      ({ candidate, snap }, i) => `
    <section class="donor-candidate-section" aria-labelledby="donor-candidate-${i}">
      <header class="donor-candidate-header">
        <h2 id="donor-candidate-${i}">${escapeHtml(candidate.name)}</h2>
        <p class="party">${escapeHtml(candidate.party || '—')}</p>
        <p class="donor-candidate-meta">${formatNumber(snap.contributionCount)} itemized gifts · ${formatCurrency(snap.raised)} raised</p>
      </header>
      <div class="panel"><div class="donor-table-mount" data-idx="${i}"></div></div>
    </section>`
    )
    .join('');

  const columns = [
    { key: 'name', label: 'Donor' },
    { key: 'city', label: 'City', format: (v) => v || '—' },
    { key: 'state', label: 'State', format: (v) => v || '—' },
    { key: 'occupation', label: 'Occupation', format: (v) => v || '—' },
    { key: 'total', label: 'Total', format: (v) => formatCurrency(v) },
    { key: 'count', label: 'Gifts', format: (v) => formatNumber(v) },
  ];

  root.querySelectorAll('.donor-table-mount').forEach((el) => {
    const idx = Number(el.getAttribute('data-idx'));
    const section = sections[idx];
    if (!section) return;
    renderTable(el, section.snap.topDonors, columns);
  });
}

/**
 * Comparison explorer.
 */
export async function renderComparison(filters = getFilters()) {
  const rows = await compareDistricts({ cycle: filters.cycle, office: filters.office });
  renderTable('#comparison-table', rows, [
    { key: 'districtId', label: 'District' },
    { key: 'candidates', label: 'Candidates' },
    { key: 'raised', label: 'Raised', format: (v) => formatCurrency(v) },
    { key: 'spent', label: 'Spent', format: (v) => formatCurrency(v) },
    { key: 'cash', label: 'Cash', format: (v) => formatCurrency(v) },
  ]);
  renderBar(
    'chart-comparison',
    rows.slice(0, 15).map((r) => ({
      name: r.districtId.replace('dist_house_', 'HD ').replace('dist_senate_', 'SD '),
      total: r.raised,
    }))
  );
}

/** @param {string} name */
function shortName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export { exportChartPng };
