/**
 * Application bootstrap — Kansas Campaign Finance Explorer
 * @module app
 */

import { openDb, seedReferenceData, getAll, clearAll } from './services/storage/db.js';
import { initFilters, getFilters, setFilters } from './shared/filters.js';
import { on as onEvent, emit } from './shared/events.js';
import { createLogger } from './shared/logger.js';
import { loadKnownPacs } from './services/pac/pac-engine.js';
import { importFiles, refreshFromKansas } from './services/import/import-service.js';
import { rebuildIndex, autocomplete } from './services/search/search-engine.js';
import { showToast } from './components/toast.js';
import { setLoading } from './components/loading.js';
import {
  renderDistrictDashboard,
  renderIntelligenceCenter,
  renderDonorExplorer,
  renderComparison,
  exportChartPng,
} from './modules/dashboard.js';
import { renderRelationshipGraph, exportGraphSvg } from './modules/relationship-graph.js';
import { renderMap } from './modules/map-explorer.js';
import { exportSnapshot, shareUrl, copyText, toJson, downloadText } from './services/export/export-service.js';
import { compute } from './services/analytics/analytics-engine.js';

const log = createLogger('app');
let currentView = 'district';
/** @type {import('./services/analytics/analytics-engine.js').AnalyticsSnapshot|null} */
let lastSnap = null;

async function boot() {
  initFilters();
  await openDb();
  await seedReferenceData();
  await loadKnownPacs();
  wireUi();
  applyFiltersToForm(getFilters());
  await refreshAll();
  registerServiceWorker();
  log.info('Application ready');
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  navigator.serviceWorker
    .register('./sw.js')
    .then((reg) => {
      // Pick up cache-busting SW updates (e.g. network-first /data/)
      reg.update().catch(() => {});
    })
    .catch((err) => log.warn('SW registration failed', err));
}

function wireUi() {
  document.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      if (view) navigate(view);
    });
  });

  document.getElementById('btn-refresh')?.addEventListener('click', onRefreshKansas);
  document.getElementById('btn-theme')?.addEventListener('click', toggleTheme);
  document.getElementById('btn-share')?.addEventListener('click', async () => {
    const url = shareUrl();
    await copyText(url);
    showToast('Share URL copied', 'success');
  });
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
  });

  ['filter-cycle', 'filter-office', 'filter-district'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', onFilterFormChange);
  });

  const fileInput = document.getElementById('file-input');
  fileInput?.addEventListener('change', async (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    if (input.files?.length) await runImport(() => importFiles(input.files));
    input.value = '';
  });

  const dropZone = document.getElementById('drop-zone');
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = e.dataTransfer?.files;
      if (files?.length) await runImport(() => importFiles(files));
    });
  }

  const searchInput = document.getElementById('global-search');
  const searchResults = document.getElementById('search-results');
  searchInput?.addEventListener('input', () => {
    const q = searchInput.value;
    const hits = autocomplete(q, 10);
    if (!searchResults) return;
    if (!q.trim() || !hits.length) {
      searchResults.classList.remove('open');
      searchResults.innerHTML = '';
      return;
    }
    searchResults.innerHTML = hits
      .map(
        (h) =>
          `<button type="button" data-id="${h.id}" data-type="${h.type}"><strong>${escapeHtml(h.title)}</strong><br><span style="color:var(--text-muted);font-size:0.8rem">${escapeHtml(h.subtitle)} · ${h.type}</span></button>`
      )
      .join('');
    searchResults.classList.add('open');
    searchResults.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        const id = btn.getAttribute('data-id');
        searchResults.classList.remove('open');
        searchInput.value = btn.querySelector('strong')?.textContent || '';
        if (type === 'candidate' && id) {
          setFilters({ candidateId: id });
          navigate('district');
        } else if (type === 'donor') navigate('donors');
        else if (type === 'vendor') navigate('expenses');
        else navigate('search');
      });
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      searchInput?.focus();
    }
    if (e.key === 'Escape') {
      searchResults?.classList.remove('open');
      document.getElementById('sidebar')?.classList.remove('open');
    }
  });

  document.querySelectorAll('[data-export-chart]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-export-chart');
      if (id) exportChartPng(id, `${id}.png`);
    });
  });

  document.getElementById('btn-export-contrib')?.addEventListener('click', () => {
    if (lastSnap) exportSnapshot(lastSnap, 'contributions');
  });
  document.getElementById('btn-export-expenses')?.addEventListener('click', () => {
    if (lastSnap) exportSnapshot(lastSnap, 'expenses');
  });
  document.getElementById('btn-export-json')?.addEventListener('click', () => {
    if (lastSnap) downloadText('analytics.json', toJson(lastSnap), 'application/json');
  });
  document.getElementById('btn-export-graph')?.addEventListener('click', exportGraphSvg);
  document.getElementById('map-metric')?.addEventListener('change', async (e) => {
    const metric = /** @type {HTMLSelectElement} */ (e.target).value;
    await renderMap(getFilters(), /** @type {any} */ (metric));
  });

  document.getElementById('btn-clear-data')?.addEventListener('click', async () => {
    if (!window.confirm('Clear all imported reports from this browser?')) return;
    setLoading(true, 'Clearing local data…');
    try {
      await clearAll();
      await seedReferenceData();
      await rebuildIndex();
      setFilters({ candidateId: null });
      await refreshAll();
      showToast('Imported data cleared. Click Refresh From Kansas to reload the catalog.', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to clear data', 'error');
    } finally {
      setLoading(false);
    }
  });

  onEvent('filters:changed', () => refreshAll());
  onEvent('report:imported', async () => {
    await rebuildIndex();
    await refreshAll();
  });
  onEvent('import:progress', (p) => setLoading(true, p.message || 'Importing…'));
  onEvent('import:complete', (r) => {
    setLoading(false);
    const msg =
      r.errors?.length
        ? `Import finished with errors: ${r.imported} imported, ${r.errors.length} failed`
        : `Import complete: ${r.imported} report(s) loaded`;
    showToast(msg, r.errors?.length ? 'error' : 'success');
  });
  onEvent('import:error', (e) => showToast(e.message, 'error', 6000));

  // Theme
  const saved = localStorage.getItem('kcfe:theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function applyFiltersToForm(filters) {
  const cycle = document.getElementById('filter-cycle');
  const office = document.getElementById('filter-office');
  const district = document.getElementById('filter-district');
  if (cycle instanceof HTMLSelectElement) cycle.value = filters.cycle;
  if (office instanceof HTMLSelectElement) office.value = filters.office;
  if (district instanceof HTMLSelectElement) district.value = filters.district;
}

function onFilterFormChange() {
  const cycle = /** @type {HTMLSelectElement} */ (document.getElementById('filter-cycle'));
  const office = /** @type {HTMLSelectElement} */ (document.getElementById('filter-office'));
  const district = /** @type {HTMLSelectElement} */ (document.getElementById('filter-district'));
  setFilters({
    cycle: cycle.value,
    office: office.value,
    district: district.value,
    candidateId: null,
  });
}

async function onRefreshKansas() {
  const ok = window.confirm(
    'Refresh From Kansas will clear imported reports in this browser (including dropped PDFs), then reload the catalog. Continue?'
  );
  if (!ok) return;

  setLoading(true, 'Clearing local data…');
  try {
    await clearAll();
    await seedReferenceData();
    setFilters({ candidateId: null });
    setLoading(true, 'Importing reports…');
    await refreshFromKansas(getFilters());
    await rebuildIndex();
    await refreshAll();
  } catch (err) {
    log.error(err);
    showToast(err.message || 'Refresh failed', 'error');
  } finally {
    setLoading(false);
  }
}

async function runImport(fn) {
  setLoading(true, 'Importing reports…');
  try {
    await fn();
    await rebuildIndex();
    await refreshAll();
  } catch (err) {
    log.error(err);
    showToast(err.message || 'Import failed', 'error');
  } finally {
    setLoading(false);
  }
}

function navigate(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach((el) => {
    const active = el.id === `view-${view}`;
    el.classList.toggle('active', active);
    el.hidden = !active;
    el.setAttribute('aria-hidden', active ? 'false' : 'true');
  });
  document.querySelectorAll('.nav-link').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-view') === view);
  });
  document.getElementById('sidebar')?.classList.remove('open');
  emit('view:changed', { view });
  refreshView();
}

async function refreshAll() {
  applyFiltersToForm(getFilters());
  await populateDistrictOptions();
  await rebuildIndex();
  await refreshView();
}

async function refreshView() {
  const filters = getFilters();
  try {
    if (currentView === 'district') {
      lastSnap = await renderDistrictDashboard(filters);
    } else if (currentView === 'intelligence') {
      await renderIntelligenceCenter(filters);
    } else if (currentView === 'donors') {
      await renderDonorExplorer(filters);
    } else if (currentView === 'expenses') {
      lastSnap = await compute(filters);
      const { renderTable } = await import('./components/table.js');
      const { formatCurrency } = await import('./shared/format.js');
      renderTable('#expense-explorer-table', lastSnap.expenses, [
        { key: 'date', label: 'Date' },
        { key: 'vendorName', label: 'Vendor' },
        { key: 'category', label: 'Category' },
        { key: 'amount', label: 'Amount', format: (v) => formatCurrency(v) },
        { key: 'purpose', label: 'Purpose' },
      ]);
    } else if (currentView === 'relationships') {
      await renderRelationshipGraph(filters);
    } else if (currentView === 'map') {
      const metric = /** @type {HTMLSelectElement} */ (document.getElementById('map-metric'))?.value || 'raised';
      await renderMap(filters, /** @type {any} */ (metric));
    } else if (currentView === 'comparison') {
      await renderComparison(filters);
    } else if (currentView === 'search') {
      // search is topbar-driven; show history tip
    }
  } catch (err) {
    log.error('View refresh failed', err);
    showToast(err.message || 'Failed to refresh view', 'error');
  }
}

async function populateDistrictOptions() {
  const select = document.getElementById('filter-district');
  if (!(select instanceof HTMLSelectElement)) return;
  const filters = getFilters();
  const districts = await getAll('districts');
  const officeId = `off_${filters.office}`;
  const relevant = districts
    .filter((d) => d.officeId === officeId)
    .sort((a, b) => Number(a.number) - Number(b.number));
  const current = filters.district;
  select.innerHTML = relevant
    .map((d) => `<option value="${d.number}" ${d.number === current ? 'selected' : ''}>${d.label}</option>`)
    .join('');
  if (!relevant.some((d) => d.number === current) && relevant.length) {
    // keep statewide-ready: if current missing, don't force change silently beyond default seed
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('kcfe:theme', next);
  emit('theme:changed', { theme: next });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

boot().catch((err) => {
  console.error(err);
  showToast('Failed to start application', 'error');
});
