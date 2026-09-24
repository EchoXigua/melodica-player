let database;
function open() {
  if (!database)
    database = new Promise((resolve, reject) => {
      const request = indexedDB.open('melodica-library', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('library');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        database = null;
        reject(request.error);
      };
    });
  return database;
}
export async function libraryDB(value) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('library', value === undefined ? 'readonly' : 'readwrite');
    const store = tx.objectStore('library');
    const request = value === undefined ? store.get('current') : store.put(value, 'current');
    tx.oncomplete = () => resolve(request.result ?? null);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || Error('曲库保存被中断'));
  });
}
