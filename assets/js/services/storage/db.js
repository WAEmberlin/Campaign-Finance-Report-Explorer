/**
 * IndexedDB access layer with migrations and typed helpers.
 * @module services/storage/db
 */

import { DB_NAME, DB_VERSION, upgrade } from './schema.js';
import { StorageError } from '../../shared/errors.js';
import { createLogger } from '../../shared/logger.js';
import { emit } from '../../shared/events.js';

const log = createLogger('storage');

/** @type {IDBDatabase|null} */
let dbInstance = null;

/**
 * Open (or return) the application database.
 * @returns {Promise<IDBDatabase>}
 */
export async function openDb() {
  if (dbInstance) return dbInstance;

  dbInstance = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      log.info(`Upgrading DB from v${event.oldVersion} to v${DB_VERSION}`);
      upgrade(req.result, event);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(new StorageError('Failed to open IndexedDB', { cause: req.error }));
  });

  emit('db:ready', { name: DB_NAME, version: DB_VERSION });
  log.info('Database ready');
  return dbInstance;
}

/**
 * @template T
 * @param {string} storeName
 * @param {IDBTransactionMode} mode
 * @param {(store: IDBObjectStore) => IDBRequest|Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withStore(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let reqOrPromise;
    try {
      reqOrPromise = fn(store);
    } catch (err) {
      reject(err);
      return;
    }

    if (reqOrPromise && typeof reqOrPromise.then === 'function') {
      reqOrPromise.then(resolve, reject);
      tx.onerror = () => reject(new StorageError(tx.error?.message || 'Transaction failed'));
      return;
    }

    const req = /** @type {IDBRequest} */ (reqOrPromise);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () =>
      reject(new StorageError(req.error?.message || 'Request failed', { cause: req.error }));
  });
}

/**
 * @template T
 * @param {string} storeName
 * @param {T} value
 * @returns {Promise<T>}
 */
export async function put(storeName, value) {
  await withStore(storeName, 'readwrite', (store) => store.put(value));
  return value;
}

/**
 * @template T
 * @param {string} storeName
 * @param {T[]} values
 * @returns {Promise<number>}
 */
export async function putMany(storeName, values) {
  if (!values.length) return 0;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const v of values) store.put(v);
    tx.oncomplete = () => resolve(values.length);
    tx.onerror = () => reject(new StorageError(tx.error?.message || 'Bulk put failed'));
  });
}

/**
 * @template T
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @returns {Promise<T|undefined>}
 */
export async function get(storeName, key) {
  return withStore(storeName, 'readonly', (store) => store.get(key));
}

/**
 * @template T
 * @param {string} storeName
 * @returns {Promise<T[]>}
 */
export async function getAll(storeName) {
  return withStore(storeName, 'readonly', (store) => store.getAll());
}

/**
 * @template T
 * @param {string} storeName
 * @param {string} indexName
 * @param {IDBValidKey} value
 * @returns {Promise<T[]>}
 */
export async function getAllByIndex(storeName, indexName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(new StorageError(req.error?.message || 'Index query failed'));
  });
}

/**
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @returns {Promise<void>}
 */
export async function remove(storeName, key) {
  await withStore(storeName, 'readwrite', (store) => store.delete(key));
}

/**
 * @param {string} storeName
 * @returns {Promise<number>}
 */
export async function count(storeName) {
  return withStore(storeName, 'readonly', (store) => store.count());
}

/**
 * Clear all object stores (settings preserved unless wipeSettings).
 * @param {{ wipeSettings?: boolean }} [opts]
 */
export async function clearAll(opts = {}) {
  const db = await openDb();
  const names = Array.from(db.objectStoreNames);
  await new Promise((resolve, reject) => {
    const tx = db.transaction(names, 'readwrite');
    for (const name of names) {
      if (!opts.wipeSettings && (name === 'settings' || name === 'meta')) continue;
      tx.objectStore(name).clear();
    }
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(new StorageError('Clear failed'));
  });
  log.info('Database cleared');
}

/**
 * Seed reference data for offices/cycles used statewide.
 */
export async function seedReferenceData() {
  const cycles = [
    { id: 'cycle_2026', label: '2026', year: 2026 },
    { id: 'cycle_2024', label: '2024', year: 2024 },
    { id: 'cycle_2022', label: '2022', year: 2022 },
    { id: 'cycle_2020', label: '2020', year: 2020 },
  ];
  const offices = [
    { id: 'off_kansas-house', label: 'Kansas House', slug: 'kansas-house' },
    { id: 'off_kansas-senate', label: 'Kansas Senate', slug: 'kansas-senate' },
    { id: 'off_governor', label: 'Governor', slug: 'governor' },
    { id: 'off_secretary-of-state', label: 'Secretary of State', slug: 'secretary-of-state' },
    { id: 'off_attorney-general', label: 'Attorney General', slug: 'attorney-general' },
    { id: 'off_treasurer', label: 'Treasurer', slug: 'treasurer' },
    { id: 'off_insurance-commissioner', label: 'Insurance Commissioner', slug: 'insurance-commissioner' },
    { id: 'off_judicial', label: 'Judicial', slug: 'judicial' },
    { id: 'off_pac', label: 'PAC', slug: 'pac' },
    { id: 'off_party-committee', label: 'Party Committee', slug: 'party-committee' },
  ];

  const existingCycles = await count('cycles');
  if (!existingCycles) await putMany('cycles', cycles);
  const existingOffices = await count('offices');
  if (!existingOffices) await putMany('offices', offices);

  // Pre-seed House districts 1–125 and Senate 1–40 (statewide-ready)
  const existingDistricts = await count('districts');
  if (!existingDistricts) {
    /** @type {import('../../models/entities.js').District[]} */
    const districts = [];
    for (let i = 1; i <= 125; i++) {
      districts.push({
        id: `dist_house_${i}`,
        officeId: 'off_kansas-house',
        number: String(i),
        label: `House District ${i}`,
      });
    }
    for (let i = 1; i <= 40; i++) {
      districts.push({
        id: `dist_senate_${i}`,
        officeId: 'off_kansas-senate',
        number: String(i),
        label: `Senate District ${i}`,
      });
    }
    await putMany('districts', districts);
  }

  await put('meta', { key: 'appVersion', value: '1.0.0' });
  await put('meta', { key: 'seededAt', value: Date.now() });
}
