import { DocumentItem } from './profileState';
import { isMockDrawingPreview } from './pdfRenderer';

// (LocalStorage removed completely; managed via Supabase Database and memory/IndexedDB)

const DB_NAME = 'FeslineEngineeringDocsDB';
const DB_VERSION = 2;
const STORE_NAME = 'documents';
const HUB_STORE_NAME = 'hub_documents';

// In-memory deleted IDs tombstone set
const inMemoryDeletedDocIds = new Set<string>();

/**
 * Retrieve the set of permanently deleted document IDs (in-memory)
 */
export function getDeletedDocIds(): Set<string> {
  return inMemoryDeletedDocIds;
}

/**
 * Record a deleted document ID so it can never be reloaded or resurrected
 */
export function recordDeletedDocId(id: string): void {
  inMemoryDeletedDocIds.add(id);
}

/**
 * Deterministic descending sort helper (Newest uploaded first)
 */
export function sortDocumentsDescending<T extends { id?: string; uploadDate?: string; uploadTimestamp?: number; date?: string; createdAt?: string }>(docs: T[]): T[] {
  if (!Array.isArray(docs)) return [];
  return [...docs].sort((a, b) => {
    const tA = (a as any).uploadTimestamp || (a.id && a.id.startsWith('doc-') ? parseInt(a.id.replace(/\D/g, ''), 10) : 0) || (a.uploadDate ? new Date(a.uploadDate).getTime() : ((a as any).date ? new Date((a as any).date).getTime() : 0));
    const tB = (b as any).uploadTimestamp || (b.id && b.id.startsWith('doc-') ? parseInt(b.id.replace(/\D/g, ''), 10) : 0) || (b.uploadDate ? new Date(b.uploadDate).getTime() : ((b as any).date ? new Date((b as any).date).getTime() : 0));
    if (tB !== tA) {
      return tB - tA;
    }
    return (b.id || '').localeCompare(a.id || '');
  });
}

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
 * Save all documents to IndexedDB (Zero LocalStorage)
 */
export async function saveDocumentsPersistently(docs: DocumentItem[]): Promise<void> {
  const sorted = sortDocumentsDescending(docs);

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
    for (const doc of sorted) {
      store.put(doc);
    }

    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (idbErr) {
    console.warn('IndexedDB save note:', idbErr);
  }
}

function sanitizeLoadedDoc<T>(d: T): T {
  if (!d || typeof d !== 'object') return d;
  const doc = { ...(d as any) };
  if (doc.previewImageDataUrl && isMockDrawingPreview(doc.previewImageDataUrl)) {
    doc.previewImageDataUrl = undefined;
  }
  if (doc.previewUrl && isMockDrawingPreview(doc.previewUrl)) {
    doc.previewUrl = undefined;
  }
  return doc as T;
}

/**
 * Load documents from IndexedDB (Zero LocalStorage)
 */
export async function loadDocumentsPersistently(): Promise<DocumentItem[]> {
  const deletedIds = getDeletedDocIds();

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
      const cleaned = allDocs
        .filter((d) => d && d.id && !deletedIds.has(d.id))
        .map(sanitizeLoadedDoc);
      return sortDocumentsDescending(cleaned);
    }
  } catch (e) {
    console.warn('IndexedDB read note:', e);
  }

  return [];
}

/**
 * Permanently delete a profile document (Zero LocalStorage)
 */
export async function deleteDocumentPersistently(id: string): Promise<void> {
  recordDeletedDocId(id);

  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
  } catch (err) {
    console.warn('Failed to delete doc from IndexedDB:', err);
  }
}

/**
 * Permanently delete a hub document (Zero LocalStorage)
 */
export async function deleteHubDocumentPersistently(id: string): Promise<void> {
  recordDeletedDocId(id);

  try {
    const db = await openDB();
    const tx = db.transaction(HUB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(HUB_STORE_NAME);
    store.delete(id);
  } catch (err) {
    console.warn('Failed to delete hub doc from IndexedDB:', err);
  }
}

/**
 * Save public engineering hub documents to IndexedDB (Zero LocalStorage)
 */
export async function saveHubDocumentsPersistently<T extends { id: string; dataUrl?: string }>(docs: T[]): Promise<void> {
  const deletedIds = getDeletedDocIds();
  const validDocs = docs.filter((d) => d && d.id && !deletedIds.has(d.id));
  const sorted = sortDocumentsDescending(validDocs);

  try {
    const db = await openDB();
    const tx = db.transaction(HUB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(HUB_STORE_NAME);

    await new Promise<void>((res, rej) => {
      const clearReq = store.clear();
      clearReq.onsuccess = () => res();
      clearReq.onerror = () => rej(clearReq.error);
    });

    for (const doc of sorted) {
      store.put(doc);
    }

    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (idbErr) {
    console.warn('IndexedDB hub docs save note:', idbErr);
  }
}

/**
 * Load public engineering hub documents from IndexedDB (Zero LocalStorage)
 */
export async function loadHubDocumentsPersistently<T extends { id: string }>(): Promise<T[]> {
  const deletedIds = getDeletedDocIds();

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
      const cleaned = allDocs
        .filter((d) => d && d.id && !deletedIds.has(d.id))
        .map(sanitizeLoadedDoc);
      return sortDocumentsDescending(cleaned);
    }
  } catch (e) {
    console.warn('IndexedDB hub read note:', e);
  }

  return [];
}
