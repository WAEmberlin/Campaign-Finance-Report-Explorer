/**
 * Leaflet GIS mapping — Kansas House district boundaries (Census cartographic GeoJSON).
 * @module modules/map-explorer
 */

import { computeStatewide } from '../services/analytics/analytics-engine.js';
import { setFilters } from '../shared/filters.js';
import { formatCurrency } from '../shared/format.js';
import { createLogger } from '../shared/logger.js';

const log = createLogger('map');

/** @type {any} */
let map;
/** @type {any} */
let layer;
/** @type {GeoJSON.FeatureCollection|null} */
let cachedGeo = null;

/**
 * Approximate Kansas grid — last-resort fallback if GeoJSON is missing.
 * @returns {GeoJSON.FeatureCollection}
 */
function buildSyntheticDistricts() {
  const features = [];
  const cols = 15;
  const minLon = -102.05;
  const maxLon = -94.6;
  const minLat = 37.0;
  const maxLat = 40.0;
  const cellW = (maxLon - minLon) / cols;
  const cellH = (maxLat - minLat) / Math.ceil(125 / cols);

  for (let i = 1; i <= 125; i++) {
    const idx = i - 1;
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x0 = minLon + col * cellW;
    const y0 = maxLat - (row + 1) * cellH;
    const x1 = x0 + cellW * 0.95;
    const y1 = y0 + cellH * 0.95;
    features.push({
      type: 'Feature',
      properties: { district: String(i), office: 'kansas-house', label: `House District ${i}` },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
            [x0, y0],
          ],
        ],
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

/**
 * @param {Record<string, any>} props
 * @returns {string}
 */
function districtNumber(props = {}) {
  const raw = props.district ?? props.NAME ?? props.SLDLST ?? props.name;
  if (raw == null) return '';
  const n = parseInt(String(raw).replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? String(n) : String(raw);
}

async function loadHouseDistrictGeo() {
  if (cachedGeo) return cachedGeo;
  try {
    const res = await fetch(`data/geo/house-districts.geojson?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      cachedGeo = await res.json();
      log.info(`Loaded ${cachedGeo.features?.length || 0} real House district boundaries`);
      return cachedGeo;
    }
  } catch (err) {
    log.warn('Could not load house-districts.geojson', err);
  }
  log.warn('Falling back to synthetic district grid');
  return buildSyntheticDistricts();
}

/**
 * @param {{ cycle: string, office: string, district?: string }} filters
 * @param {'raised'|'spent'|'cash'|'pacPercent'} [metric='raised']
 */
export async function renderMap(filters, metric = 'raised') {
  const container = document.getElementById('map-container');
  if (!container || !window.L) {
    log.warn('Leaflet or container missing');
    return;
  }

  if (!map) {
    map = window.L.map(container, { scrollWheelZoom: true }).setView([38.5, -98.3], 7);
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO | Districts: U.S. Census Bureau',
      maxZoom: 18,
    }).addTo(map);
  }

  setTimeout(() => map.invalidateSize(), 100);

  const snap = await computeStatewide({ ...filters, district: '', candidateId: null });

  /** @type {Map<string, Array<{ name: string, party: string, raised: number, spent: number, cash: number, pacPercent: number }>>} */
  const candidatesByDistrict = new Map();

  for (const c of snap.candidates) {
    const num = c.districtId?.replace(/^dist_(house|senate)_/, '');
    if (!num) continue;
    const raisedFromRows = snap.contributions
      .filter((x) => x.candidateId === c.id)
      .reduce((s, x) => s + x.amount, 0);
    const raisedFromReports = snap.reports
      .filter((r) => r.candidateId === c.id)
      .reduce((s, r) => s + (r.totalReceipts || 0), 0);
    const raised = raisedFromReports > 0 ? raisedFromReports : raisedFromRows;
    const spentFromRows = snap.expenses
      .filter((x) => x.candidateId === c.id)
      .reduce((s, x) => s + x.amount, 0);
    const spentFromReports = snap.reports
      .filter((r) => r.candidateId === c.id)
      .reduce((s, r) => s + (r.totalExpenditures || 0), 0);
    const spent = spentFromReports > 0 ? spentFromReports : spentFromRows;
    const cash = snap.reports
      .filter((r) => r.candidateId === c.id)
      .reduce((s, r) => s + r.cashOnHand, 0);
    const pacAmt = snap.contributions
      .filter((x) => x.candidateId === c.id && x.donorType === 'pac')
      .reduce((s, x) => s + x.amount, 0);
    const pacPercent = raised ? pacAmt / raised : 0;
    const list = candidatesByDistrict.get(num) || [];
    list.push({
      name: c.name,
      party: c.party || '',
      raised,
      spent,
      cash,
      pacPercent,
    });
    candidatesByDistrict.set(num, list);
  }

  for (const list of candidatesByDistrict.values()) {
    list.sort((a, b) => b.raised - a.raised);
  }

  /** @type {Map<string, number>} */
  const byDistrict = new Map();
  for (const [num, list] of candidatesByDistrict) {
    const value =
      metric === 'spent'
        ? list.reduce((s, c) => s + c.spent, 0)
        : metric === 'cash'
          ? list.reduce((s, c) => s + c.cash, 0)
          : metric === 'pacPercent'
            ? (() => {
                const raised = list.reduce((s, c) => s + c.raised, 0);
                const pac = list.reduce((s, c) => s + c.pacPercent * c.raised, 0);
                return raised ? pac / raised : 0;
              })()
            : list.reduce((s, c) => s + c.raised, 0);
    byDistrict.set(num, value);
  }

  const values = Array.from(byDistrict.values());
  const max = Math.max(1, ...values);
  const selected = filters.district ? String(filters.district) : '';

  const geo = await loadHouseDistrictGeo();

  if (layer) map.removeLayer(layer);
  layer = window.L.geoJSON(geo, {
    style: (feature) => {
      const d = districtNumber(feature.properties);
      const v = byDistrict.get(d) || 0;
      const t = metric === 'pacPercent' ? v : v / max;
      const isSelected = selected && d === selected;
      return {
        color: isSelected ? '#f0b429' : '#4da3ff',
        weight: isSelected ? 2.5 : 1,
        fillColor: '#1a5fbf',
        fillOpacity: 0.12 + t * 0.75,
      };
    },
    onEachFeature: (feature, lyr) => {
      const d = districtNumber(feature.properties);
      const name = feature.properties?.label || `House District ${d}`;
      lyr.bindTooltip(() => districtHoverHtml(name, candidatesByDistrict.get(d) || []), {
        sticky: true,
        opacity: 1,
        className: 'map-district-tooltip',
        direction: 'top',
      });
      lyr.on('click', () => {
        setFilters({ office: 'kansas-house', district: d, candidateId: null });
      });
    },
  }).addTo(map);

  try {
    const bounds = layer.getBounds();
    if (bounds?.isValid()) {
      if (selected) {
        let selectedLayer = null;
        layer.eachLayer((lyr) => {
          const d = districtNumber(lyr.feature?.properties);
          if (d === selected) selectedLayer = lyr;
        });
        if (selectedLayer) {
          map.fitBounds(selectedLayer.getBounds(), { padding: [40, 40], maxZoom: 10 });
        } else {
          map.fitBounds(bounds, { padding: [20, 20] });
        }
      } else {
        map.fitBounds(bounds, { padding: [20, 20] });
      }
    }
  } catch {
    /* keep default view */
  }

  log.info('Map rendered', { metric, districtsWithData: byDistrict.size, selected });
}

/**
 * @param {string} districtLabel
 * @param {Array<{ name: string, party: string, raised: number }>} candidates
 */
function districtHoverHtml(districtLabel, candidates) {
  const total = candidates.reduce((s, c) => s + c.raised, 0);
  if (!candidates.length) {
    return `<div class="map-tip"><strong>${escapeHtml(districtLabel)}</strong><div class="map-tip-muted">No imported candidates</div></div>`;
  }
  const rows = candidates
    .map((c) => {
      const party = c.party ? ` <span class="map-tip-party">(${escapeHtml(c.party)})</span>` : '';
      return `<li><span class="map-tip-name">${escapeHtml(c.name)}${party}</span><span class="map-tip-amt">${formatCurrency(c.raised)}</span></li>`;
    })
    .join('');
  return `<div class="map-tip">
    <strong>${escapeHtml(districtLabel)}</strong>
    <div class="map-tip-total">District raised: ${formatCurrency(total)}</div>
    <ul>${rows}</ul>
  </div>`;
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
