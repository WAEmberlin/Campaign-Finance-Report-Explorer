/**
 * Global filter state. District 70 is the default filter only — never an architectural assumption.
 * @module shared/filters
 */

import { emit, on } from './events.js';

const STORAGE_KEY = 'kcfe:filters';

/** @typedef {{ cycle: string, office: string, district: string, candidateId: string|null }} AppFilters */

/** @type {AppFilters} */
export const DEFAULT_FILTERS = Object.freeze({
  cycle: '2026',
  office: 'kansas-house',
  district: '70',
  candidateId: null,
});

/**
 * Parse filters from URL query string.
 * @returns {Partial<AppFilters>}
 */
export function filtersFromUrl() {
  const params = new URLSearchParams(window.location.search);
  /** @type {Partial<AppFilters>} */
  const out = {};
  if (params.has('cycle')) out.cycle = params.get('cycle') || undefined;
  if (params.has('office')) out.office = params.get('office') || undefined;
  if (params.has('district')) out.district = params.get('district') || undefined;
  if (params.has('candidate')) out.candidateId = params.get('candidate');
  return out;
}

/**
 * Persist filters to LocalStorage and URL.
 * @param {AppFilters} filters
 */
export function persistFilters(filters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  } catch {
    /* ignore quota */
  }
  const params = new URLSearchParams();
  if (filters.cycle) params.set('cycle', filters.cycle);
  if (filters.office) params.set('office', filters.office);
  if (filters.district) params.set('district', filters.district);
  if (filters.candidateId) params.set('candidate', filters.candidateId);
  const qs = params.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
  window.history.replaceState(null, '', url);
}

/**
 * Load filters: URL > LocalStorage > defaults.
 * @returns {AppFilters}
 */
export function loadFilters() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
  } catch {
    stored = {};
  }
  return {
    ...DEFAULT_FILTERS,
    ...stored,
    ...filtersFromUrl(),
  };
}

/** @type {AppFilters} */
let current = { ...DEFAULT_FILTERS };

/** @returns {AppFilters} */
export function getFilters() {
  return { ...current };
}

/**
 * Update filters and notify listeners.
 * @param {Partial<AppFilters>} patch
 */
export function setFilters(patch) {
  current = { ...current, ...patch };
  persistFilters(current);
  emit('filters:changed', getFilters());
}

/** Initialize filter state from persistence. */
export function initFilters() {
  current = loadFilters();
  persistFilters(current);
  return getFilters();
}

export { on as onFiltersChanged };
