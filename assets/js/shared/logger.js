/**
 * Structured console logging. Never silently fail — always surface useful debug info.
 * @module shared/logger
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let currentLevel = LEVELS.debug;

/**
 * @param {'debug'|'info'|'warn'|'error'} level
 */
export function setLogLevel(level) {
  currentLevel = LEVELS[level] ?? LEVELS.info;
}

/**
 * @param {string} scope
 * @returns {{ debug: Function, info: Function, warn: Function, error: Function }}
 */
export function createLogger(scope) {
  const prefix = `[${scope}]`;
  return {
    debug: (...args) => {
      if (currentLevel <= LEVELS.debug) console.debug(prefix, ...args);
    },
    info: (...args) => {
      if (currentLevel <= LEVELS.info) console.info(prefix, ...args);
    },
    warn: (...args) => {
      if (currentLevel <= LEVELS.warn) console.warn(prefix, ...args);
    },
    error: (...args) => {
      if (currentLevel <= LEVELS.error) console.error(prefix, ...args);
    },
  };
}
