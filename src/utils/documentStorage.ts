import { DocumentItem } from './profileState';

const DB_NAME = 'FeslineEngineeringDocsDB';
const DB_VERSION = 2;
const STORE_NAME = 'documents';
const HUB_STORE_NAME = 'hub_documents';
const STORAGE_KEY_DOCS = 'fesline_custom_documents';
const STORAGE_KEY_HUB_DOCS = 'fesline_public_hub_documents';

/**
 * Open or create IndexedDB
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(HUB_STORE_NAME)) {
        db.createObjectStore(HUB_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save all documents to IndexedDB and localStorage (with safe fallback)
 */
export async function saveDocumentsPersistently(docs: DocumentItem[]): Promise<void> {
  // 1. Save to IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // Clear existing
    await new Promise<void>((res, rej) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => res();
      clearReq.onerror = () => rej(clearReq.error);
    });

    // Put all docs
    for (const doc of docs) {
      store.put(doc);
    }

    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (idbErr) {
    console.warn('IndexedDB save failed, falling back to localStorage:', idbErr);
  }

  // 2. Save to localStorage with safety check
  try {
    const serialized = JSON.stringify(docs);
    localStorage.setItem(STORAGE_KEY_DOCS, serialized);
  } catch (storageErr) {
    console.warn('LocalStorage full, stripping attachmentDataUrl for localStorage cache:', storageErr);
    try {
      // Store lightweight version without full attachments in localStorage
      const lightweightDocs = docs.map((d) => ({
        ...d,
        // Keep preview image if reasonably small, truncate huge base64 from localStorage
        attachmentDataUrl: d.attachmentDataUrl && d.attachmentDataUrl.length > 200000 ? undefined : d.attachmentDataUrl,
      }));
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(lightweightDocs));
    } catch {
      // ignore
    }
  }
}

/**
 * Load documents from IndexedDB if available, otherwise fallback to localStorage
 */
export async function loadDocumentsPersistently(): Promise<DocumentItem[]> {
  // 1. Try IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const allDocs = await new Promise<DocumentItem[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    if (allDocs && allDocs.length > 0) {
      return allDocs;
    }
  } catch (e) {
    console.warn('IndexedDB read failed, falling back to localStorage:', e);
  }

  // 2. Fallback to localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY_DOCS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch {}

  return [];
}

/**
 * Save public engineering hub documents to IndexedDB and localStorage (handles large files safely)
 */
export async function saveHubDocumentsPersistently<T extends { id: string; dataUrl?: string }>(docs: T[]): Promise<void> {
  // 1. Save to IndexedDB (virtually unlimited quota for large PDFs / books / CAD files)
  try {
    const db = await openDB();
    const tx = db.transaction(HUB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(HUB_STORE_NAME);

    await new Promise<void>((res, rej) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => res();
      clearReq.onerror = () => rej(clearReq.error);
    });

    for (const doc of docs) {
      store.put(doc);
    }

    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (idbErr) {
    console.warn('IndexedDB hub docs save failed:', idbErr);
  }

  // 2. Safe save to localStorage (strip massive base64 if needed to avoid QuotaExceededError)
  try {
    localStorage.setItem(STORAGE_KEY_HUB_DOCS, JSON.stringify(docs));
  } catch {
    try {
      const lightweightDocs = docs.map((d) => ({
        ...d,
        dataUrl: d.dataUrl && d.dataUrl.length > 300000 ? undefined : d.dataUrl,
      }));
      localStorage.setItem(STORAGE_KEY_HUB_DOCS, JSON.stringify(lightweightDocs));
    } catch {
      // ignore
    }
  }
}

/**
 * Load public engineering hub documents from IndexedDB, falling back to localStorage
 */
export async function loadHubDocumentsPersistently<T extends { id: string }>(): Promise<T[]> {
  // 1. Try IndexedDB
  try {
    const db = await openDB();
    const tx = db.transaction(HUB_STORE_NAME, 'readonly');
    const store = tx.objectStore(HUB_STORE_NAME);

    const allDocs = await new Promise<T[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result || []) as T[]);
      req.onerror = () => reject(req.error);
    });

    if (allDocs && allDocs.length > 0) {
      return allDocs;
    }
  } catch (e) {
    console.warn('IndexedDB hub read failed, trying localStorage:', e);
  }

  // 2. Fallback to localStorage
  try {
    const saved = localStorage.getItem(STORAGE_KEY_HUB_DOCS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as T[];
      }
    }
  } catch {}

  return [];
}

