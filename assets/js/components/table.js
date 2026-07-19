/**
 * Simple virtualized-ish table renderer for large lists.
 * @module components/table
 */

/**
 * @param {HTMLElement|string} target
 * @param {Array<Record<string, any>>} rows
 * @param {Array<{key: string, label: string, format?: (v:any, row:any)=>string}>} columns
 * @param {{ maxRows?: number }} [opts]
 */
export function renderTable(target, rows, columns, opts = {}) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) return;
  const maxRows = opts.maxRows ?? 500;
  const slice = rows.slice(0, maxRows);
  const thead = columns.map((c) => `<th scope="col">${escapeHtml(c.label)}</th>`).join('');
  const tbody = slice
    .map((row) => {
      const cells = columns
        .map((c) => {
          const raw = row[c.key];
          const val = c.format ? c.format(raw, row) : raw ?? '';
          return `<td>${escapeHtml(String(val))}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  el.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr>${thead}</tr></thead>
        <tbody>${tbody || `<tr><td colspan="${columns.length}">No rows</td></tr>`}</tbody>
      </table>
    </div>
    ${rows.length > maxRows ? `<p class="text-muted" style="color:var(--text-muted);font-size:0.85rem">Showing ${maxRows} of ${rows.length} rows</p>` : ''}
  `;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
