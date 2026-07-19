/**
 * Lightweight typed event bus for cross-module communication.
 * @module shared/events
 */

/** @typedef {'db:ready'|'filters:changed'|'report:imported'|'import:progress'|'import:error'|'import:complete'|'view:changed'|'theme:changed'|'search:query'} AppEventName */

/** @type {Map<string, Set<Function>>} */
const listeners = new Map();

/**
 * Subscribe to an application event.
 * @param {AppEventName|string} event
 * @param {(payload: any) => void} handler
 * @returns {() => void} unsubscribe
 */
export function on(event, handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(handler);
  return () => off(event, handler);
}

/**
 * Unsubscribe a handler.
 * @param {AppEventName|string} event
 * @param {Function} handler
 */
export function off(event, handler) {
  listeners.get(event)?.delete(handler);
}

/**
 * Emit an application event.
 * @param {AppEventName|string} event
 * @param {any} [payload]
 */
export function emit(event, payload) {
  const set = listeners.get(event);
  if (!set) return;
  for (const handler of set) {
    try {
      handler(payload);
    } catch (err) {
      console.error(`[events] handler error for ${event}`, err);
    }
  }
}

/**
 * Subscribe once.
 * @param {AppEventName|string} event
 * @param {(payload: any) => void} handler
 */
export function once(event, handler) {
  const unsub = on(event, (payload) => {
    unsub();
    handler(payload);
  });
  return unsub;
}
