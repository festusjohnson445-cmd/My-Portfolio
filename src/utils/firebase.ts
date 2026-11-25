import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocFromServer,
  disableNetwork,
  enableNetwork,
  increment,
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  uploadString,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };
import type { ProfileBioData, DocumentItem } from './profileState';
import type { PublicEngineeringDocument } from '../components/EngineeringDocumentHub';
import type { Conversation } from '../components/MessagingSection';

// ============================================================================
// 1. CENTRALIZED FIREBASE SINGLETON INITIALIZATION
// ============================================================================
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const storage = getStorage(app, `gs://${firebaseConfig.storageBucket}`);
export const auth = getAuth(app);

// Collection Identifiers
export const COLLECTIONS = {
  PROFILES: 'profiles',
  USERS: 'users',
  DOCUMENTS: 'documents',
  CONVERSATIONS: 'conversations',
  LEARNING_SESSIONS: 'learning_sessions',
  INQUIRIES: 'inquiries',
} as const;

export const GLOBAL_PROFILE_DOC_ID = 'festus_johnson_global';

export interface PersistentProfileRecord {
  avatar: string;
  bio: ProfileBioData;
  documents: DocumentItem[];
  updatedAt: string;
}

// Error Handling helper
export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationType = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };

  if (
    errMessage.includes('the client is offline') ||
    errMessage.includes('offline') ||
    (error as any)?.code === 'unavailable'
  ) {
    console.warn(`[Firestore ${operationType.toUpperCase()} Offline on ${path}]:`, errMessage);
    return;
  }
  console.warn('Firestore Error:', JSON.stringify(errInfo));
}

let firestoreReachable: boolean | null = null;
let firestoreCheckPromise: Promise<boolean> | null = null;

/**
 * Test connectivity to Firestore on boot (and disable background SDK timers before the 10s
 * SDK timeout if backend is unreachable so Supabase & Postgres operate seamlessly offline).
 */
export async function testFirestoreConnection(force = false): Promise<boolean> {
  if (!force && firestoreReachable !== null) return firestoreReachable;
  if (!force && firestoreCheckPromise) return firestoreCheckPromise;

  firestoreCheckPromise = (async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      firestoreReachable = false;
      await disableNetwork(db).catch(() => {});
      return false;
    }

    try {
      await enableNetwork(db).catch(() => {});
      const connPromise = getDocFromServer(doc(db, 'test', 'connection'));
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Firestore connection timeout')), 5000)
      );
      await Promise.race([connPromise, timeoutPromise]);
      firestoreReachable = true;
      return true;
    } catch (error) {
      firestoreReachable = false;
      // Cancel pending Firestore Listen/channel streams before SDK hits its 10s error log
      await disableNetwork(db).catch(() => {});
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('Firestore connection note: Please check your Firebase configuration.');
      } else {
        console.warn('Firestore connection note: Operating via Supabase/PostgreSQL primary database.');
      }
      return false;
    } finally {
      firestoreCheckPromise = null;
    }
  })();

  return firestoreCheckPromise;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (firestoreReachable === false) {
      firestoreReachable = null;
      void testFirestoreConnection(true);
    }
  });
}

// ============================================================================
// 2. USER PROFILES & AVATARS (FIREBASE STORAGE & FIRESTORE)
// ============================================================================
let profileQueuePromise: Promise<void> = Promise.resolve();

/**
 * Uploads an avatar image to Firebase Storage, returning a permanent public CDN download URL
 */
export async function uploadAvatarImageToStorage(
  imageSource: File | Blob | string, 
  fileNamePrefix = 'avatar'
): Promise<string> {
  try {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const storagePath = `avatars/${fileNamePrefix}_${timestamp}_${randomSuffix}.jpg`;
    const storageRef = ref(storage, storagePath);

    if (typeof imageSource === 'string') {
      if (imageSource.startsWith('data:')) {
        const uploadResult = await uploadString(storageRef, imageSource, 'data_url', {
          contentType: 'image/jpeg',
          cacheControl: 'public,max-age=31536000',
        });
        return await getDownloadURL(uploadResult.ref);
      } else if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
        return imageSource;
      }
    }

    const metadata = {
      contentType: 'image/jpeg',
      cacheControl: 'public,max-age=31536000',
    };
    const uploadResult = await uploadBytes(storageRef, imageSource as Blob, metadata);
    return await getDownloadURL(uploadResult.ref);
  } catch (err) {
    console.warn('Firebase Cloud Storage upload note:', err);
    return typeof imageSource === 'string' ? imageSource : '';
  }
}

/**
 * Recursively removes undefined values and converts unsupported fields for Firestore
 */
export function cleanForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as unknown as T;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanForFirestore(item)) as unknown as T;
  }
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj as Record<string, any>)) {
    if (value !== undefined) {
      cleaned[key] = cleanForFirestore(value);
    }
  }
  return cleaned as T;
}

/**
 * Atomically save complete or partial profile updates to Firestore
 */
export async function saveProfileToFirestore(
  updates: Partial<PersistentProfileRecord>
): Promise<PersistentProfileRecord | null> {
  return new Promise((resolve, reject) => {
    profileQueuePromise = profileQueuePromise
      .then(async () => {
        try {
          const online = await testFirestoreConnection();
          if (!online) {
            resolve(null);
            return;
          }
          const profileDocRef = doc(db, COLLECTIONS.PROFILES, GLOBAL_PROFILE_DOC_ID);

          let existingData: Partial<PersistentProfileRecord> = {};
          try {
            const snap = await getDoc(profileDocRef);
            if (snap.exists()) {
              existingData = snap.data() as PersistentProfileRecord;
            }
          } catch (e) {
            console.warn('Could not read prior profile document during merge:', e);
          }

          let newAvatar = updates.avatar !== undefined ? updates.avatar : (existingData.avatar || '/api/profile/picture');

          if (updates.avatar && typeof updates.avatar === 'string' && updates.avatar.startsWith('data:image/')) {
            // Keep Firestore ultra lightweight and fast by using dedicated cloud picture URL with deterministic version
            const versionParam = updates.updatedAt ? new Date(updates.updatedAt).getTime() : '1';
            newAvatar = `/api/profile/picture?v=${versionParam}`;
          } else if (updates.avatar === '') {
            newAvatar = '';
          }

          // Sanitize documents to prevent exceeding Firestore 1MB document limit
          const rawDocs = updates.documents !== undefined ? updates.documents : (existingData.documents || []);
          const sanitizedDocs = (Array.isArray(rawDocs) ? rawDocs : []).map((docItem) => {
            const isLarge = docItem.attachmentDataUrl && docItem.attachmentDataUrl.length > 50000;
            return {
              ...docItem,
              // Strip massive base64 from Firestore doc; full binary is stored in PostgreSQL & IndexedDB
              attachmentDataUrl: isLarge ? undefined : docItem.attachmentDataUrl,
              previewImageDataUrl: docItem.previewImageDataUrl && docItem.previewImageDataUrl.length > 50000 ? undefined : docItem.previewImageDataUrl,
              verifiedLink: docItem.verifiedLink || `/api/documents/files/${docItem.id}`,
            };
          });

          const mergedRecord: PersistentProfileRecord = {
            avatar: newAvatar || '',
            bio: {
              ...(existingData.bio || {}),
              ...(updates.bio || {}),
            } as ProfileBioData,
            documents: sanitizedDocs,
            updatedAt: new Date().toISOString(),
          };

          const cleanPayload = cleanForFirestore(mergedRecord);
          await setDoc(profileDocRef, cleanPayload, { merge: true });
          resolve(mergedRecord);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.PROFILES}/${GLOBAL_PROFILE_DOC_ID}`);
          reject(err);
        }
      })
      .catch((err) => {
        reject(err);
      });
  });
}

/**
 * Fetch profile record from Firestore
 */
export async function fetchProfileFromFirestore(): Promise<PersistentProfileRecord | null> {
  try {
    const online = await testFirestoreConnection();
    if (!online) return null;
    const profileDocRef = doc(db, COLLECTIONS.PROFILES, GLOBAL_PROFILE_DOC_ID);
    const snap = await getDoc(profileDocRef);
    if (snap.exists()) {
      return snap.data() as PersistentProfileRecord;
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${COLLECTIONS.PROFILES}/${GLOBAL_PROFILE_DOC_ID}`);
    return null;
  }
}

/**
 * Subscribe to real-time updates for global profile
 */
export function subscribeToProfile(
  onData: (data: PersistentProfileRecord) => void,
  onError?: (err: unknown) => void
) {
  let cancelled = false;
  let unsub: (() => void) | null = null;

  void testFirestoreConnection().then((online) => {
    if (cancelled || !online) return;
    const profileDocRef = doc(db, COLLECTIONS.PROFILES, GLOBAL_PROFILE_DOC_ID);
    unsub = onSnapshot(
      profileDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as PersistentProfileRecord;
          onData(data);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `${COLLECTIONS.PROFILES}/${GLOBAL_PROFILE_DOC_ID}`);
        if (onError) onError(err);
      }
    );
  });

  return () => {
    cancelled = true;
    unsub?.();
  };
}

// ============================================================================
// 3. ENGINEERING HUB DOCUMENTS & ARCHIVES (FIREBASE STORAGE & FIRESTORE)
// ============================================================================

/**
 * Uploads a document binary or CAD file to Firebase Storage (/hub_documents/)
 */
export async function uploadHubDocumentToStorage(
  file: File | Blob,
  fileName: string
): Promise<{ downloadUrl: string; storagePath: string }> {
  const timestamp = Date.now();
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `hub_documents/${timestamp}_${cleanName}`;
  const storageRef = ref(storage, storagePath);

  let contentType = 'application/octet-stream';
  if (fileName.endsWith('.pdf')) contentType = 'application/pdf';
  else if (fileName.endsWith('.png')) contentType = 'image/png';
  else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) contentType = 'image/jpeg';
  else if (fileName.endsWith('.webp')) contentType = 'image/webp';

  const metadata = {
    contentType,
    cacheControl: 'public,max-age=31536000',
  };

  const uploadResult = await uploadBytes(storageRef, file, metadata);
  const downloadUrl = await getDownloadURL(uploadResult.ref);
  return { downloadUrl, storagePath };
}

/**
 * Saves or updates an Engineering Document in Firestore
 */
export async function saveHubDocumentToFirestore(document: PublicEngineeringDocument): Promise<void> {
  try {
    const online = await testFirestoreConnection();
    if (!online) return;
    const docRef = doc(db, COLLECTIONS.DOCUMENTS, document.id);
    
    // Sanitize document for Firestore:
    // Strip massive in-memory base64 (>50KB) so Firestore document is ultra-lightweight (<5KB) and stays within 1MB limit
    const sanitizedDoc: any = {
      ...document,
      dataUrl: document.dataUrl && document.dataUrl.length > 50000 ? undefined : document.dataUrl,
      previewUrl: document.previewUrl && document.previewUrl.length > 50000 ? undefined : document.previewUrl,
      downloadUrl: document.downloadUrl || `/api/documents/files/${document.id}`,
      hasServerFile: true,
      updatedAt: new Date().toISOString(),
    };

    const cleanPayload = cleanForFirestore(sanitizedDoc);
    await setDoc(docRef, cleanPayload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.DOCUMENTS}/${document.id}`);
  }
}

/**
 * Fetches all engineering documents from Firestore
 */
export async function fetchHubDocumentsFromFirestore(): Promise<PublicEngineeringDocument[]> {
  try {
    const online = await testFirestoreConnection();
    if (!online) return [];
    const colRef = collection(db, COLLECTIONS.DOCUMENTS);
    const snap = await getDocs(colRef);
    const docs: PublicEngineeringDocument[] = [];
    snap.forEach((d) => {
      docs.push(d.data() as PublicEngineeringDocument);
    });
    return docs;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.DOCUMENTS);
    return [];
  }
}

/**
 * Real-time subscription to Engineering Documents
 */
export function subscribeToHubDocuments(
  onData: (docs: PublicEngineeringDocument[]) => void,
  onError?: (err: unknown) => void
) {
  let cancelled = false;
  let unsub: (() => void) | null = null;

  void testFirestoreConnection().then((online) => {
    if (cancelled || !online) return;
    const colRef = collection(db, COLLECTIONS.DOCUMENTS);
    unsub = onSnapshot(
      colRef,
      (snap) => {
        const docs: PublicEngineeringDocument[] = [];
        snap.forEach((d) => {
          docs.push(d.data() as PublicEngineeringDocument);
        });
        onData(docs);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, COLLECTIONS.DOCUMENTS);
        if (onError) onError(err);
      }
    );
  });

  return () => {
    cancelled = true;
    unsub?.();
  };
}

/**
 * Delete an Engineering Document permanently from Firestore and Firebase Storage
 */
export async function deleteHubDocumentFromFirestore(docId: string, storagePath?: string): Promise<void> {
  try {
    const online = await testFirestoreConnection();
    if (!online) return;
    const docRef = doc(db, COLLECTIONS.DOCUMENTS, docId);
    await deleteDoc(docRef);

    if (storagePath) {
      try {
        const fileRef = ref(storage, storagePath);
        await deleteObject(fileRef);
      } catch (storageErr) {
        console.warn('Storage file cleanup note:', storageErr);
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.DOCUMENTS}/${docId}`);
    throw err;
  }
}

/**
 * Atomically increment document download count
 */
export async function incrementHubDocumentDownload(docId: string): Promise<void> {
  try {
    const online = await testFirestoreConnection();
    if (!online) return;
    const docRef = doc(db, COLLECTIONS.DOCUMENTS, docId);
    await updateDoc(docRef, {
      downloadCount: increment(1),
    });
  } catch (err) {
    console.warn('Could not increment download count:', err);
  }
}

// ============================================================================
// 4. MESSAGING, JOB DISCUSSIONS & CHAT (FIRESTORE & STORAGE)
// ============================================================================

/**
 * Uploads a chat attachment or voice note to Firebase Storage
 */
export async function uploadChatAttachmentToStorage(
  file: File | Blob,
  fileName: string
): Promise<string> {
  const timestamp = Date.now();
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `chat_attachments/${timestamp}_${cleanName}`;
  const storageRef = ref(storage, storagePath);

  const uploadResult = await uploadBytes(storageRef, file);
  return await getDownloadURL(uploadResult.ref);
}

/**
 * Saves a conversation to Firestore
 */
export async function saveConversationToFirestore(conversation: Conversation): Promise<void> {
  try {
    const online = await testFirestoreConnection();
    if (!online) return;
    const convRef = doc(db, COLLECTIONS.CONVERSATIONS, conversation.id);
    await setDoc(convRef, {
      ...conversation,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${COLLECTIONS.CONVERSATIONS}/${conversation.id}`);
    throw err;
  }
}

/**
 * Fetches all conversations from Firestore
 */
export async function fetchConversationsFromFirestore(): Promise<Conversation[]> {
  try {
    const online = await testFirestoreConnection();
    if (!online) return [];
    const colRef = collection(db, COLLECTIONS.CONVERSATIONS);
    const snap = await getDocs(colRef);
    const convs: Conversation[] = [];
    snap.forEach((d) => {
      convs.push(d.data() as Conversation);
    });
    return convs;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, COLLECTIONS.CONVERSATIONS);
    return [];
  }
}

/**
 * Real-time subscription to conversations
 */
export function subscribeToConversations(
  onData: (conversations: Conversation[]) => void,
  onError?: (err: unknown) => void
) {
  let cancelled = false;
  let unsub: (() => void) | null = null;

  void testFirestoreConnection().then((online) => {
    if (cancelled || !online) return;
    const colRef = collection(db, COLLECTIONS.CONVERSATIONS);
    unsub = onSnapshot(
      colRef,
      (snap) => {
        const convs: Conversation[] = [];
        snap.forEach((d) => {
          convs.push(d.data() as Conversation);
        });
        onData(convs);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, COLLECTIONS.CONVERSATIONS);
        if (onError) onError(err);
      }
    );
  });

  return () => {
    cancelled = true;
    unsub?.();
  };
}

/**
 * Delete a conversation permanently from Firestore
 */
export async function deleteConversationFromFirestore(conversationId: string): Promise<void> {
  try {
    const online = await testFirestoreConnection();
    if (!online) return;
    const convRef = doc(db, COLLECTIONS.CONVERSATIONS, conversationId);
    await deleteDoc(convRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.CONVERSATIONS}/${conversationId}`);
    throw err;
  }
}

// ============================================================================
// 5. DIRECT INQUIRIES & RECRUITER CONTACTS (FIRESTORE)
// ============================================================================

export interface DirectInquiryData {
  id?: string;
  name: string;
  email: string;
  company?: string;
  roleTitle?: string;
  message: string;
  createdAt?: string;
}

/**
 * Saves a direct contact or recruiter inquiry to Firestore
 */
export async function saveDirectInquiryToFirestore(inquiry: DirectInquiryData): Promise<string> {
  const id = inquiry.id || `inquiry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  try {
    const online = await testFirestoreConnection();
    if (!online) return id;
    const inquiryRef = doc(db, COLLECTIONS.INQUIRIES, id);
    await setDoc(inquiryRef, {
      ...inquiry,
      id,
      createdAt: inquiry.createdAt || new Date().toISOString(),
    });
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, COLLECTIONS.INQUIRIES);
    throw err;
  }
}

/**
 * Deletes a direct contact or recruiter inquiry from Firestore
 */
export async function deleteDirectInquiryFromFirestore(inquiryId: string): Promise<void> {
  try {
    const online = await testFirestoreConnection();
    if (!online) return;
    const inquiryRef = doc(db, COLLECTIONS.INQUIRIES, inquiryId);
    await deleteDoc(inquiryRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${COLLECTIONS.INQUIRIES}/${inquiryId}`);
  }
}
