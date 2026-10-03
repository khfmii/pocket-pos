// Copy the seeded demo shop between IndexedDBs with the raw API (the production APK exposes no modules to seed with).
import { sleep } from './chrome.mjs';

export async function exportDb(c) {
  return c.evaluate(`(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('pocket-pos'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const out = {};
    for (const name of db.objectStoreNames) out[name] = await new Promise((res, rej) => { const q = db.transaction(name).objectStore(name).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    db.close();
    return JSON.stringify(out);
  })()`);
}

export async function importDb(c, json) {
  const n = await c.evaluate(`(async (data) => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('pocket-pos'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const names = Object.keys(data).filter((k) => db.objectStoreNames.contains(k));
    await new Promise((res, rej) => {
      const tx = db.transaction(names, 'readwrite');
      for (const k of names) { const st = tx.objectStore(k); st.clear(); for (const rec of data[k]) st.put(rec); }
      tx.oncomplete = res; tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    });
    db.close();
    return names.map((k) => k + ':' + data[k].length).join(' ');
  })(${json})`);
  return n;
}
