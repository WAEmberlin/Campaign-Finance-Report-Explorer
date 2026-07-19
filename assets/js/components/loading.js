/**
 * Loading overlay (presentational).
 * @module components/loading
 */

/**
 * @param {boolean} open
 * @param {string} [message]
 */
export function setLoading(open, message = 'Working…') {
  const overlay = document.getElementById('loading-overlay');
  const msg = document.getElementById('loading-message');
  if (!overlay) return;
  overlay.classList.toggle('open', open);
  overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
  if (msg) msg.textContent = message;
}
