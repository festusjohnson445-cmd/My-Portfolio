// src/utils/avatarStorage.ts
const AVATAR_DB_NAME = 'FeslineEngineeringDocsDB';
const AVATAR_DB_VERSION = 2;
const AVATAR_STORE_NAME = 'avatar_storage';

export interface StoredAvatarRecord {
  id: 'current_profile_avatar';
  dataUrl: string;
  updatedAt: string;
  fileSize?: string;
  fileType?: string;
  dimensions?: string;
}

/**
 * Open IndexedDB for Avatar storage
 */
function openAvatarDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(AVATAR_DB_NAME, AVATAR_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AVATAR_STORE_NAME)) {
        db.createObjectStore(AVATAR_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(AVATAR_STORE_NAME)) {
        db.close();
        const upgradeReq = window.indexedDB.open(AVATAR_DB_NAME, db.version + 1);
        upgradeReq.onupgradeneeded = () => {
          const uDb = upgradeReq.result;
          if (!uDb.objectStoreNames.contains(AVATAR_STORE_NAME)) {
            uDb.createObjectStore(AVATAR_STORE_NAME, { keyPath: 'id' });
          }
        };
        upgradeReq.onsuccess = () => resolve(upgradeReq.result);
        upgradeReq.onerror = () => reject(upgradeReq.error);
        return;
      }
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save profile avatar persistently to IndexedDB and LocalStorage
 */
export async function saveAvatarToIndexedDB(record: StoredAvatarRecord): Promise<void> {
  // 1. Save to IndexedDB
  try {
    const db = await openAvatarDB();
    const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AVATAR_STORE_NAME);
    await new Promise<void>((res, rej) => {
      const putReq = store.put(record);
      putReq.onsuccess = () => res();
      putReq.onerror = () => rej(putReq.error);
    });
  } catch (err) {
    console.warn('IndexedDB avatar put note:', err);
  }

  // 2. Save to LocalStorage
  try {
    if (record.dataUrl && record.dataUrl.trim()) {
      localStorage.setItem('fesline_custom_profile_avatar', record.dataUrl);
      localStorage.setItem('fesline_custom_profile_avatar_meta', JSON.stringify(record));
    } else {
      localStorage.removeItem('fesline_custom_profile_avatar');
      localStorage.removeItem('fesline_custom_profile_avatar_meta');
    }
  } catch (err) {
    console.warn('LocalStorage avatar note:', err);
  }
}

/**
 * Load avatar record persistently from IndexedDB or LocalStorage
 */
export async function loadAvatarFromIndexedDB(): Promise<StoredAvatarRecord | null> {
  // 1. Try IndexedDB
  try {
    const db = await openAvatarDB();
    const tx = db.transaction(AVATAR_STORE_NAME, 'readonly');
    const store = tx.objectStore(AVATAR_STORE_NAME);
    const record = await new Promise<StoredAvatarRecord | null>((res) => {
      const req = store.get('current_profile_avatar');
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
    if (record && record.dataUrl) {
      return record;
    }
  } catch (err) {
    console.warn('IndexedDB avatar load note:', err);
  }

  // 2. Fallback to LocalStorage
  try {
    const savedUrl = localStorage.getItem('fesline_custom_profile_avatar');
    if (savedUrl && savedUrl.trim()) {
      const rawMeta = localStorage.getItem('fesline_custom_profile_avatar_meta');
      const meta = rawMeta ? JSON.parse(rawMeta) : {};
      return {
        id: 'current_profile_avatar',
        dataUrl: savedUrl,
        updatedAt: meta.updatedAt || new Date().toISOString(),
        fileSize: meta.fileSize,
        fileType: meta.fileType,
        dimensions: meta.dimensions,
      };
    }
  } catch {}

  return null;
}

/**
 * Remove avatar persistently from IndexedDB and LocalStorage
 */
export async function clearAvatarFromIndexedDB(): Promise<void> {
  try {
    const db = await openAvatarDB();
    const tx = db.transaction(AVATAR_STORE_NAME, 'readwrite');
    const store = tx.objectStore(AVATAR_STORE_NAME);
    await new Promise<void>((res, rej) => {
      const delReq = store.delete('current_profile_avatar');
      delReq.onsuccess = () => res();
      delReq.onerror = () => rej(delReq.error);
    });
  } catch {}

  try {
    localStorage.removeItem('fesline_custom_profile_avatar');
    localStorage.removeItem('fesline_custom_profile_avatar_meta');
  } catch {}
}
