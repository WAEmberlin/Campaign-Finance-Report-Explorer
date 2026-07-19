/**
 * Toast notifications (presentational).
 * @module components/toast
 */

/**
 * @param {string} message
 * @param {'info'|'success'|'error'} [type='info']
 * @param {number} [ms=4000]
 */
export function showToast(message, type = 'info', ms = 4000) {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast ${type === 'info' ? '' : type}`.trim();
  el.setAttribute('role', 'status');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.remove();
  }, ms);
}
