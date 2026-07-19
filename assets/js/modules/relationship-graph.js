/**
 * Flagship D3 force-directed relationship explorer.
 * @module modules/relationship-graph
 */

import { getAll } from '../services/storage/db.js';
import { setFilters } from '../shared/filters.js';
import { createLogger } from '../shared/logger.js';

const log = createLogger('graph');

/** @type {any} */
let simulation = null;

/**
 * Build and render the relationship graph into #graph-container.
 * @param {{ cycle?: string, office?: string, district?: string }} [filters]
 * @param {{ onNodeClick?: (node: any) => void }} [opts]
 */
export async function renderRelationshipGraph(filters = {}, opts = {}) {
  const container = document.getElementById('graph-container');
  if (!container || !window.d3) {
    log.warn('D3 or container missing');
    return;
  }

  const [candidates, donors, vendors, pacs, relationships] = await Promise.all([
    getAll('candidates'),
    getAll('donors'),
    getAll('vendors'),
    getAll('pacs'),
    getAll('relationships'),
  ]);

  const cycleId = filters.cycle ? `cycle_${filters.cycle}` : null;
  const officeId = filters.office ? `off_${filters.office}` : null;
  let filteredCandidates = candidates;
  if (cycleId) filteredCandidates = filteredCandidates.filter((c) => c.cycleId === cycleId);
  if (officeId) filteredCandidates = filteredCandidates.filter((c) => c.officeId === officeId);
  // Statewide by default for the flagship view — district filter highlights but does not isolate unless few nodes

  const candidateIds = new Set(filteredCandidates.map((c) => c.id));
  const edges = relationships.filter(
    (r) =>
      (r.type === 'donation' || r.type === 'payment') &&
      (candidateIds.has(r.fromId) || candidateIds.has(r.toId))
  );

  const nodeMap = new Map();
  for (const c of filteredCandidates) {
    nodeMap.set(c.id, { id: c.id, label: c.name, type: 'candidate', districtId: c.districtId });
  }
  for (const e of edges) {
    const endpoints = [e.fromId, e.toId];
    for (const id of endpoints) {
      if (nodeMap.has(id)) continue;
      const donor = donors.find((d) => d.id === id);
      if (donor) {
        nodeMap.set(id, { id, label: donor.name, type: donor.type === 'pac' ? 'pac' : 'donor' });
        continue;
      }
      const pac = pacs.find((p) => p.id === id);
      if (pac) {
        nodeMap.set(id, { id, label: pac.name, type: 'pac' });
        continue;
      }
      const vendor = vendors.find((v) => v.id === id);
      if (vendor) nodeMap.set(id, { id, label: vendor.name, type: 'vendor' });
    }
  }

  const nodes = Array.from(nodeMap.values());
  const links = edges
    .filter((e) => nodeMap.has(e.fromId) && nodeMap.has(e.toId))
    .map((e) => ({ source: e.fromId, target: e.toId, amount: e.amount || 1, type: e.type }));

  container.innerHTML = '';
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  const d3 = window.d3;
  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('role', 'img')
    .attr('aria-label', 'Campaign relationship graph');

  const g = svg.append('g');
  svg.call(
    d3.zoom().scaleExtent([0.2, 4]).on('zoom', (event) => {
      g.attr('transform', event.transform);
    })
  );

  // Keep in sync with .graph-legend swatches in main.css
  const styles = getComputedStyle(document.documentElement);
  const color = {
    candidate: styles.getPropertyValue('--ks-accent').trim() || '#4da3ff',
    donor: styles.getPropertyValue('--ks-success').trim() || '#3dd68c',
    pac: styles.getPropertyValue('--ks-warning').trim() || '#f0b429',
    vendor: styles.getPropertyValue('--ks-danger').trim() || '#e85d5d',
  };

  if (simulation) simulation.stop();
  simulation = d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(70)
        .strength(0.4)
    )
    .force('charge', d3.forceManyBody().strength(-180))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide(18));

  const link = g
    .append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', 'rgba(255,255,255,0.2)')
    .attr('stroke-width', (d) => Math.max(1, Math.min(6, Math.log10((d.amount || 1) + 1) * 2)));

  const node = g
    .append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', (d) => (d.type === 'candidate' ? 10 : 6))
    .attr('fill', (d) => color[d.type] || '#9aa8bc')
    .attr('stroke', '#0f141c')
    .attr('stroke-width', 1.5)
    .style('cursor', 'pointer')
    .call(
      d3
        .drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

  node.append('title').text((d) => `${d.label} (${d.type})`);

  const labels = g
    .append('g')
    .selectAll('text')
    .data(nodes.filter((n) => n.type === 'candidate' || nodes.length < 40))
    .join('text')
    .text((d) => d.label)
    .attr('font-size', 10)
    .attr('fill', '#c5d0de')
    .attr('dx', 12)
    .attr('dy', 3);

  node.on('click', (event, d) => {
    event.stopPropagation();
    highlightConnected(d.id, node, link);
    if (d.type === 'candidate' && d.districtId) {
      const num = d.districtId.replace(/^dist_(house|senate)_/, '');
      setFilters({ district: num, candidateId: d.id });
    }
    opts.onNodeClick?.(d);
  });

  node.on('mouseover', (_event, d) => highlightConnected(d.id, node, link));

  simulation.on('tick', () => {
    link
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);
    node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);
    labels.attr('x', (d) => d.x).attr('y', (d) => d.y);
  });

  log.info(`Graph rendered: ${nodes.length} nodes, ${links.length} edges`);
}

function highlightConnected(id, node, link) {
  const connected = new Set([id]);
  link.each((d) => {
    const s = typeof d.source === 'object' ? d.source.id : d.source;
    const t = typeof d.target === 'object' ? d.target.id : d.target;
    if (s === id || t === id) {
      connected.add(s);
      connected.add(t);
    }
  });
  node.attr('opacity', (d) => (connected.has(d.id) ? 1 : 0.15));
  link.attr('opacity', (d) => {
    const s = typeof d.source === 'object' ? d.source.id : d.source;
    const t = typeof d.target === 'object' ? d.target.id : d.target;
    return connected.has(s) && connected.has(t) ? 0.9 : 0.05;
  });
}

/**
 * Export graph SVG.
 */
export function exportGraphSvg() {
  const svg = document.querySelector('#graph-container svg');
  if (!svg) return;
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svg);
  const blob = new Blob([source], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'relationship-graph.svg';
  a.click();
  URL.revokeObjectURL(url);
}
