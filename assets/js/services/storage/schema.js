/**
 * IndexedDB schema definition and migrations.
 * @module services/storage/schema
 */

export const DB_NAME = 'kcfe';
export const DB_VERSION = 1;

/**
 * @param {IDBDatabase} db
 * @param {IDBVersionChangeEvent} event
 */
export function upgrade(db, event) {
  const from = event.oldVersion || 0;

  if (from < 1) {
    createStore(db, 'candidates', 'id', ['normalizedName', 'districtId', 'officeId', 'cycleId']);
    createStore(db, 'reports', 'id', ['candidateId', 'sourceKey', 'cycleId', 'districtId', 'officeId']);
    createStore(db, 'contributions', 'id', ['reportId', 'candidateId', 'donorId', 'date', 'amount']);
    createStore(db, 'expenses', 'id', ['reportId', 'candidateId', 'vendorId', 'date', 'amount', 'category']);
    createStore(db, 'vendors', 'id', ['normalizedName', 'category']);
    createStore(db, 'donors', 'id', ['normalizedName', 'type', 'zip']);
    createStore(db, 'pacs', 'id', ['normalizedName']);
    createStore(db, 'committees', 'id', ['normalizedName']);
    createStore(db, 'organizations', 'id', ['normalizedName']);
    createStore(db, 'cycles', 'id', ['year']);
    createStore(db, 'offices', 'id', ['slug']);
    createStore(db, 'districts', 'id', ['officeId', 'number']);
    createStore(db, 'relationships', 'id', ['type', 'fromId', 'toId']);
    createStore(db, 'pdfBlobs', 'reportId');
    createStore(db, 'settings', 'key');
    createStore(db, 'meta', 'key');
  }
}

/**
 * @param {IDBDatabase} db
 * @param {string} name
 * @param {string} keyPath
 * @param {string[]} [indexes]
 */
function createStore(db, name, keyPath, indexes = []) {
  if (db.objectStoreNames.contains(name)) return;
  const store = db.createObjectStore(name, { keyPath });
  for (const idx of indexes) {
    store.createIndex(idx, idx, { unique: false });
  }
}
