/**
 * Persistência local de projetos (IndexedDB): metadados do projeto + arquivos de mídia importados.
 * Funciona offline, no navegador e no app Android.
 */
const DB_NAME = 'motioncut';
const DB_VERSION = 1;
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        let result;
        Promise.resolve(fn(s)).then((r) => (result = r));
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

const reqP = (r) => new Promise((res, rej) => ((r.onsuccess = () => res(r.result)), (r.onerror = () => rej(r.error))));

export async function putMedia(key, blob) {
  return tx('media', 'readwrite', (s) => s.put(blob, key));
}

export async function getMedia(key) {
  return tx('media', 'readonly', (s) => reqP(s.get(key)));
}

export async function deleteMedia(key) {
  return tx('media', 'readwrite', (s) => s.delete(key));
}

export async function saveProjectRecord(record) {
  return tx('projects', 'readwrite', (s) => s.put(record));
}

export async function loadProjectRecord(id) {
  return tx('projects', 'readonly', (s) => reqP(s.get(id)));
}

export async function listProjects() {
  const all = await tx('projects', 'readonly', (s) => reqP(s.getAll()));
  return (all || [])
    .map(({ id, title, aspect, updatedAt, createdAt, thumb, duration, clipCount }) => ({ id, title, aspect, updatedAt, createdAt, thumb, duration, clipCount }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Remove o projeto e as mídias que nenhum outro projeto usa. */
export async function deleteProjectRecord(id) {
  const rec = await loadProjectRecord(id);
  await tx('projects', 'readwrite', (s) => s.delete(id));
  if (!rec) return;
  const others = await tx('projects', 'readonly', (s) => reqP(s.getAll()));
  const used = new Set(others.flatMap((p) => (p.assets || []).map((a) => a.mediaKey)));
  for (const a of rec.assets || []) if (a.mediaKey && !used.has(a.mediaKey)) await deleteMedia(a.mediaKey);
}

export const storageAvailable = () => typeof indexedDB !== 'undefined';
