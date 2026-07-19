/**
 * Chart.js wrappers with PNG export helpers.
 * @module modules/charts/chart-factory
 */

import { chartToPng } from '../../services/export/export-service.js';
import { formatCurrency } from '../../shared/format.js';

/** @type {Map<string, any>} */
const registry = new Map();

const COLORS = ['#4da3ff', '#3dd68c', '#f0b429', '#e85d5d', '#a78bfa', '#38bdf8', '#fb7185', '#34d399'];

/**
 * @param {string} canvasId
 * @returns {any}
 */
function destroyExisting(canvasId) {
  const existing = registry.get(canvasId);
  if (existing) {
    existing.destroy();
    registry.delete(canvasId);
  }
}

/**
 * @param {string} canvasId
 * @param {any} config
 */
function create(canvasId, config) {
  destroyExisting(canvasId);
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return null;
  const chart = new window.Chart(canvas, config);
  registry.set(canvasId, chart);
  return chart;
}

/**
 * @param {string} canvasId
 * @param {Array<{name: string, total: number}>} items
 * @param {string} [label]
 */
export function renderBar(canvasId, items, label = 'Amount') {
  return create(canvasId, {
    type: 'bar',
    data: {
      labels: items.map((i) => i.name || i.category),
      datasets: [
        {
          label,
          data: items.map((i) => i.total),
          backgroundColor: COLORS[0],
          borderRadius: 4,
        },
      ],
    },
    options: chartOptions(),
  });
}

/**
 * @param {string} canvasId
 * @param {Array<{name?: string, category?: string, total: number}>} items
 */
export function renderDoughnut(canvasId, items) {
  return create(canvasId, {
    type: 'doughnut',
    data: {
      labels: items.map((i) => i.name || i.category),
      datasets: [
        {
          data: items.map((i) => i.total),
          backgroundColor: items.map((_, idx) => COLORS[idx % COLORS.length]),
          borderWidth: 0,
        },
      ],
    },
    options: {
      ...chartOptions(),
      plugins: {
        legend: { position: 'bottom', labels: { color: '#9aa8bc' } },
        tooltip: currencyTooltip(),
      },
    },
  });
}

/**
 * @param {string} canvasId
 * @param {Array<{date: string, amount: number}>} points
 * @param {string} [label]
 */
export function renderLine(canvasId, points, label = 'Amount') {
  return create(canvasId, {
    type: 'line',
    data: {
      labels: points.map((p) => p.date),
      datasets: [
        {
          label,
          data: points.map((p) => p.amount),
          borderColor: COLORS[0],
          backgroundColor: 'rgba(77, 163, 255, 0.15)',
          fill: true,
          tension: 0.25,
        },
      ],
    },
    options: chartOptions(),
  });
}

/**
 * @param {string} canvasId
 * @param {string} [filename]
 */
export function exportChartPng(canvasId, filename) {
  const canvas = document.getElementById(canvasId);
  if (canvas instanceof HTMLCanvasElement) chartToPng(canvas, filename);
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: currencyTooltip(),
    },
    scales: {
      x: {
        ticks: { color: '#9aa8bc', maxRotation: 45 },
        grid: { color: 'rgba(255,255,255,0.06)' },
      },
      y: {
        ticks: {
          color: '#9aa8bc',
          callback: (v) => formatCurrency(Number(v)),
        },
        grid: { color: 'rgba(255,255,255,0.06)' },
      },
    },
  };
}

function currencyTooltip() {
  return {
    callbacks: {
      label: (ctx) => formatCurrency(Number(ctx.raw || 0)),
    },
  };
}
