/**
 * Typed application errors.
 * @module shared/errors
 */

export class AppError extends Error {
  /**
   * @param {string} message
   * @param {{ code?: string, cause?: Error, details?: any }} [opts]
   */
  constructor(message, opts = {}) {
    super(message, { cause: opts.cause });
    this.name = 'AppError';
    this.code = opts.code || 'APP_ERROR';
    this.details = opts.details;
  }
}

export class ParseError extends AppError {
  /** @param {string} message @param {any} [details] */
  constructor(message, details) {
    super(message, { code: 'PARSE_ERROR', details });
    this.name = 'ParseError';
  }
}

export class StorageError extends AppError {
  /** @param {string} message @param {any} [details] */
  constructor(message, details) {
    super(message, { code: 'STORAGE_ERROR', details });
    this.name = 'StorageError';
  }
}

export class ImportError extends AppError {
  /** @param {string} message @param {any} [details] */
  constructor(message, details) {
    super(message, { code: 'IMPORT_ERROR', details });
    this.name = 'ImportError';
  }
}
