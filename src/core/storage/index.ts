function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('timeline-visualizer', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('timelines')) db.createObjectStore('timelines');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTimeline(key: string, data: unknown): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('timelines', 'readwrite');
    const store = tx.objectStore('timelines');
    store.put(data, key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function loadTimeline(key: string): Promise<unknown | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('timelines', 'readonly');
    const store = tx.objectStore('timelines');
    const g = store.get(key);
    g.onsuccess = () => { db.close(); resolve(g.result ?? null); };
    g.onerror = () => { db.close(); reject(g.error); };
  });
}

export async function clearTimeline(key: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('timelines', 'readwrite');
    tx.objectStore('timelines').delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function estimateStorageQuota(): Promise<{ usage: number; quota: number; percentUsed: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    const usage = est.usage ?? 0;
    const quota = est.quota ?? 0;
    return { usage, quota, percentUsed: quota > 0 ? (usage / quota) * 100 : 0 };
  }
  return { usage: 0, quota: 0, percentUsed: 0 };
}

export async function listTimelines(): Promise<string[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('timelines', 'readonly');
    const store = tx.objectStore('timelines');
    const keys = store.getAllKeys();
    keys.onsuccess = () => { db.close(); resolve(keys.result as string[]); };
    keys.onerror = () => { db.close(); reject(keys.error); };
  });
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('timelines', 'readwrite');
    tx.objectStore('timelines').clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}
