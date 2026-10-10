/**
 * Minimal IndexedDB blob store for the per-user SQLite files. IndexedDB holds
 * hundreds of MB (vs ~5 MB for localStorage), which removes the v1 size cap
 * (REQUIREMENTS_V2 NFR-05).
 */
const DB_NAME = "life-v2";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const idbGet = (key: string) => run<Uint8Array | undefined>("readonly", (s) => s.get(key));
export const idbPut = (key: string, value: Uint8Array) => run("readwrite", (s) => s.put(value, key));
export const idbDelete = (key: string) => run("readwrite", (s) => s.delete(key));
