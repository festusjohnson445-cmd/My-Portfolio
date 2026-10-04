import { DocumentItem } from './profileState';
import { isMockDrawingPreview } from './pdfRenderer';

const DB_NAME = 'FeslineEngineeringDocsDB';
const DB_VERSION = 2;
const STORE_NAME = 'documents';
const HUB_STORE_NAME = 'hub_documents';
const STORAGE_KEY_DOCS = 'fesline_custom_documents';
const STORAGE_KEY_HUB_DOCS = 'fesline_public_hub_documents';
export const STORAGE_KEY_DELETED_DOCS = 'fesline_deleted_document_ids';

/**
 * Retrieve the set of permanently deleted document IDs
 */
export function getDeletedDocIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_DOCS);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr);
      }
    }
  } catch {}
  return new Set();
}

/**
 * Record a deleted document ID so it can never be reloaded or resurrected
 */
export function recordDeletedDocId(id: string): void {
  try {
    const current = getDeletedDocIds();
    current.add(id);
    localStorage.setItem(STORAGE_KEY_DELETED_DOCS, JSON.stringify(Array.from(current)));
  } catch {}
}

/**
 * Deterministic descending sort helper (Newest uploaded first)
 * Prevents any flipping or jumping between client storage and server fetches
 */
export function sortDocumentsDescending<T extends { id?: string; uploadDate?: string; uploadTimestamp?: number; date?: string; createdAt?: string }>(docs: T[]): T[] {
  if (!Array.isArray(docs)) return [];
  return [...docs].sort((a, b) => {
    // 1. Explicit uploadTimestamp (numeric ms)
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
 * Save all documents to IndexedDB and localStorage (with safe fallback)
 */
export async function saveDocumentsPersistently(docs: DocumentItem[]): Promise<void> {
  const sorted = sortDocumentsDescending(docs);

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
    for (const doc of sorted) {
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
    const serialized = JSON.stringify(sorted);
    localStorage.setItem(STORAGE_KEY_DOCS, serialized);
  } catch (storageErr) {
    console.warn('LocalStorage full, stripping attachmentDataUrl for localStorage cache:', storageErr);
    try {
      // Store lightweight version without full attachments in localStorage
      const lightweightDocs = sorted.map((d) => ({
        ...d,
        attachmentDataUrl: d.attachmentDataUrl && d.attachmentDataUrl.length > 200000 ? undefined : d.attachmentDataUrl,
      }));
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(lightweightDocs));
    } catch {
      // ignore
    }
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
 * Load documents from IndexedDB if available, otherwise fallback to localStorage
 */
export async function loadDocumentsPersistently(): Promise<DocumentItem[]> {
  const deletedIds = getDeletedDocIds();

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
      const cleaned = allDocs
        .filter((d) => d && d.id && !deletedIds.has(d.id))
        .map(sanitizeLoadedDoc);
      return sortDocumentsDescending(cleaned);
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
        const cleaned = parsed
          .filter((d) => d && d.id && !deletedIds.has(d.id))
          .map(sanitizeLoadedDoc);
        return sortDocumentsDescending(cleaned);
      }
    }
  } catch {}

  return [];
}

/**
 * Permanently delete a profile document from IndexedDB, localStorage, and record tombstone
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

  try {
    const saved = localStorage.getItem(STORAGE_KEY_DOCS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((d: any) => d && d.id !== id);
        localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(filtered));
      }
    }
  } catch {}
}

/**
 * Permanently delete a hub document from IndexedDB, localStorage, and record tombstone
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

  try {
    const saved = localStorage.getItem(STORAGE_KEY_HUB_DOCS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((d: any) => d && d.id !== id);
        localStorage.setItem(STORAGE_KEY_HUB_DOCS, JSON.stringify(filtered));
      }
    }
  } catch {}
}

/**
 * Save public engineering hub documents to IndexedDB and localStorage (handles large files safely)
 */
export async function saveHubDocumentsPersistently<T extends { id: string; dataUrl?: string }>(docs: T[]): Promise<void> {
  const deletedIds = getDeletedDocIds();
  const validDocs = docs.filter((d) => d && d.id && !deletedIds.has(d.id));
  const sorted = sortDocumentsDescending(validDocs);

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

    for (const doc of sorted) {
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
    const lightweightDocs = sorted.map((d) => ({
      ...d,
      dataUrl: d.dataUrl && d.dataUrl.length > 200000 ? undefined : d.dataUrl,
    }));
    localStorage.setItem(STORAGE_KEY_HUB_DOCS, JSON.stringify(lightweightDocs));
  } catch {
    // ignore
  }
}

/**
 * Load public engineering hub documents from IndexedDB, falling back to localStorage
 */
export async function loadHubDocumentsPersistently<T extends { id: string }>(): Promise<T[]> {
  const deletedIds = getDeletedDocIds();

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
      const cleaned = allDocs
        .filter((d) => d && d.id && !deletedIds.has(d.id))
        .map(sanitizeLoadedDoc);
      return sortDocumentsDescending(cleaned);
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
        const cleaned = parsed
          .filter((d: any) => d && d.id && !deletedIds.has(d.id))
          .map(sanitizeLoadedDoc);
        return sortDocumentsDescending(cleaned as T[]);
      }
    }
  } catch {}

  return [];
}
