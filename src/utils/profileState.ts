import { useEffect, useState, useCallback } from 'react';
import { 
  saveDocumentsPersistently, 
  getDeletedDocIds, 
  sortDocumentsDescending 
} from './documentStorage';
import {
  saveAvatarToIndexedDB,
  loadAvatarFromIndexedDB,
  clearAvatarFromIndexedDB,
} from './avatarStorage';
import { 
  saveProfileToFirestore, 
  fetchProfileFromFirestore, 
  subscribeToProfile, 
  type PersistentProfileRecord
} from './firebase';
import { broadcastMemoryEvent, subscribeToDynamicMemory } from './dynamicMemory';
import {
  uploadAvatarToSupabaseBucket,
  deleteAvatarFromSupabaseBucket,
  saveProfileToSupabaseTable,
  fetchProfileFromSupabaseTable,
  getAuthenticatedOwnerUid,
  supabaseSignInOwner,
  supabaseSignOutOwner,
  getSupabaseCurrentUser,
  hasActiveOwnerSession,
} from './supabase';

export const STORAGE_KEY_AVATAR = 'fesline_custom_profile_avatar';
export const STORAGE_KEY_BIO = 'fesline_custom_profile_bio';
export const STORAGE_KEY_DOCS = 'fesline_custom_documents';
export const STORAGE_KEY_AUTH = 'fesline_owner_auth';
export const EVENT_PROFILE_UPDATED = 'fesline_profile_updated';

export const OWNER_EMAIL = 'festusjohnson028@gmail.com';
export const OWNER_PASSWORD = 'Festus1999.';

export const DEFAULT_AVATAR = '';

export interface ProfileBioData {
  fullName: string;
  email: string;
  discipline: string;
  badges: string;
  country: string;
  header: string;
  degree: string;
  academicHonors: string;
  leadership: string;
  skills: string;
  description: string;
  availabilityStatus?: string;
  workClearance?: string;
  targetLocations?: string;
  // Follow Me Social Links
  linkedinUrl?: string;
  facebookUrl?: string;
  indeedUrl?: string;
  emailUrl?: string;
  twitterUrl?: string;
  tiktokUrl?: string;
  instagramUrl?: string;
}

export interface DocumentItem {
  id: string;
  title: string;
  issuer: string;
  credentialId: string;
  date: string;
  category: 'Certification' | 'Accreditation' | 'Technical Report' | 'CAD Specification' | 'Engineering License' | 'Patent' | 'Technical Drawing' | 'Other Document';
  description: string;
  competencies: string[];
  attachmentName?: string;
  attachmentDataUrl?: string;
  attachmentSize?: string;
  fileType?: string;
  verifiedLink?: string;
  previewImageDataUrl?: string;
}

export const DEFAULT_BIO_DATA: ProfileBioData = {
  fullName: 'Festus, Olorunsogo Johnson',
  email: 'festusjohnson028@gmail.com',
  discipline: 'Mechanical Hardware & Thermal Systems',
  badges: 'Verified Engineer · CSWP · ASME GDTP Senior · FE EIT',
  country: 'United States',
  header: 'Lead Mechanical Design Engineer · Precision Mechanisms',
  degree: 'B.S. in Mechanical Engineering (BSME)',
  academicHonors: 'ABET Accredited · Honors (GPA 3.84 / 4.00)',
  leadership: 'Lead Mechanical Hardware Engineer · Airborne Gimbal Mechanism Lead · ASME Section Officer',
  skills: 'SolidWorks (CSWP/CSWE), PTC Creo, Autodesk Inventor, Siemens NX, Fusion 360, AutoCAD Mechanical, CNC Machine, Laser Engraver/Cutter, 3D Animation, FEA Analysis',
  description: 'Lead Mechanical Design Engineer with 6+ years of specialized experience in high-precision hardware mechanisms, complex flight-rated assemblies, and mission-critical robotic systems. My engineering philosophy is founded on first-principles physics: rigorous hand calculations that provide mathematical sanity checks before computational FEA, and continuous DFM integration that respects physical shop-floor realities.\n\nThroughout my career, I have taken mechanical systems from initial constraint definition and napkin sketches through topology optimization, multi-DOF dynamic vibration simulation, and 5-axis CNC fabrication. My technical contributions include cutting the structural mass of an airborne optical gimbal yoke by 41.8% (1,420g down to 826g) while raising natural resonance from 180 Hz to 342 Hz, engineering a 115 N·m zero-backlash harmonic robotic actuator, and generating more than $120,000 in quantifiable manufacturing cost reductions.\n\nAs a certified practitioner of ASME Y14.5 GD&T and a Certified SolidWorks Professional (CSWP), I ensure that all 2D manufacturing drawings convey unequivocal design intent with maximum allowable tolerances under Maximum Material Condition (MMC), eliminating assembly interference and vendor scrap.',
  availabilityStatus: 'Active & Available for Q4 2026 Roles',
  workClearance: 'US Authorized · No Visa Sponsorship Required',
  targetLocations: 'San Francisco / Silicon Valley, Seattle, Austin, Boston',
  linkedinUrl: 'https://linkedin.com',
  facebookUrl: 'https://facebook.com',
  indeedUrl: 'https://indeed.com',
  emailUrl: 'mailto:festusjohnson028@gmail.com',
  twitterUrl: 'https://x.com',
  tiktokUrl: 'https://tiktok.com',
  instagramUrl: 'https://instagram.com',
};

/**
 * Dispatch update event to sync all open tabs and components in real time
 */
export function notifyProfileUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_PROFILE_UPDATED));
  }
}

/**
 * Compress an image data URL or file to fit safely and render quickly
 */
export function compressImage(file: File, maxDimension = 640, quality = 0.88): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) {
        reject(new Error('Failed to read image file'));
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

// In-memory persistent cache to guarantee instant, reliable hydration across all components
let memoryAvatar: string = '';
let memoryBio: ProfileBioData | null = null;
let memoryDocuments: DocumentItem[] | null = null;
let isSyncingWithServer = false;
let isRealtimeListenerAttached = false;
let isProfileHydrated = false;

/**
 * Helper to push profile updates to server endpoint as redundant backup
 */
export async function pushProfileToServer(payload: { avatar?: string; bio?: ProfileBioData; documents?: DocumentItem[] }) {
  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      if (json && json.success && json.profile) {
        applyPersistentProfile(json.profile, false);
      }
    }
  } catch (err) {
    console.warn('Backup server sync note:', err);
  }
}

/**
 * Fetch global persistent profile from Firestore database & server so all visitors on any device receive permanent changes
 */
export async function syncGlobalProfileWithServer(): Promise<void> {
  if (isSyncingWithServer) return;
  isSyncingWithServer = true;

  try {
    let remoteLoaded = false;

    // 1. Primary Persistent Source: Firestore Database
    try {
      const dbProfile = await fetchProfileFromFirestore();
      if (dbProfile && (dbProfile.avatar || dbProfile.bio || (dbProfile.documents && dbProfile.documents.length > 0))) {
        applyPersistentProfile(dbProfile);
        remoteLoaded = true;
      }
    } catch (e) {
      console.warn('Firestore direct fetch attempt:', e);
    }

    // 2. Secondary Sync / Cloud SQL Server Endpoint
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && json.profile) {
          const { avatar, bio, documents } = json.profile;
          if (avatar || bio || (documents && documents.length > 0)) {
            applyPersistentProfile({
              avatar: avatar || dbProfileAvatar(),
              bio: bio || dbProfileBio(),
              documents: documents || [],
              updatedAt: json.profile.updatedAt || new Date().toISOString(),
            });
            remoteLoaded = true;
          }

          // If Firestore was empty but server had data, seed Firestore
          if (!remoteLoaded && (avatar || bio)) {
            saveProfileToFirestore({
              avatar: avatar || undefined,
              bio: bio || DEFAULT_BIO_DATA,
              documents: documents || [],
            }).catch(() => {});
          }
        }
      }
    } catch (serverErr) {
      console.warn('Server profile fetch note:', serverErr);
    }

    // 2b. Supabase Profiles Table Sync (Public read for unauthenticated visitors)
    try {
      const supaProfile = await fetchProfileFromSupabaseTable();
      if (supaProfile && (supaProfile.avatar_url || supaProfile.bio || supaProfile.documents?.length)) {
        applyPersistentProfile({
          avatar: supaProfile.avatar_url || dbProfileAvatar(),
          bio: supaProfile.bio || dbProfileBio(),
          documents: supaProfile.documents || [],
          updatedAt: supaProfile.updated_at || new Date().toISOString(),
        });
      }
    } catch (supaFetchErr) {
      console.warn('Supabase profile fetch note:', supaFetchErr);
    }

    isProfileHydrated = true;

    // 3. Attach real-time listener if not already active
    if (!isRealtimeListenerAttached && typeof window !== 'undefined') {
      isRealtimeListenerAttached = true;
      subscribeToProfile(
        (updatedRecord) => {
          if (updatedRecord) {
            applyPersistentProfile(updatedRecord);
          }
        },
        (err) => console.warn('Realtime subscription notice:', err)
      );
    }
  } catch (err) {
    console.warn('Could not sync global profile from persistent storage:', err);
  } finally {
    isSyncingWithServer = false;
  }
}

function dbProfileAvatar(): string {
  return memoryAvatar || '';
}

function dbProfileBio(): ProfileBioData {
  return memoryBio || DEFAULT_BIO_DATA;
}

/**
 * Apply fetched persistent record to local browser storage and notify subscribers
 */
function applyPersistentProfile(
  record: PersistentProfileRecord | { avatar?: string; bio?: ProfileBioData; documents?: DocumentItem[] },
  shouldNotify = true
) {
  let updatedLocally = false;
  const { bio, documents, avatar } = record as any;

  if (avatar !== undefined && typeof avatar === 'string') {
    const cleanAvatar = avatar.trim();
    if (cleanAvatar !== memoryAvatar) {
      memoryAvatar = cleanAvatar;
      try {
        if (cleanAvatar) {
          localStorage.setItem(STORAGE_KEY_AVATAR, cleanAvatar);
        } else {
          localStorage.removeItem(STORAGE_KEY_AVATAR);
        }
      } catch {}
      updatedLocally = true;
    }
  }

  if (bio && typeof bio === 'object') {
    const mergedBio: ProfileBioData = {
      ...DEFAULT_BIO_DATA,
      ...(memoryBio || {}),
      ...bio,
    };
    if (JSON.stringify(memoryBio) !== JSON.stringify(mergedBio)) {
      memoryBio = mergedBio;
      updatedLocally = true;
    }
    try {
      localStorage.setItem(STORAGE_KEY_BIO, JSON.stringify(mergedBio));
    } catch (e) {
      // Ignore quota exceeded error
    }
  }

  if (Array.isArray(documents)) {
    const currentLocalDocs = getStoredDocuments();
    const deletedIds = getDeletedDocIds();
    const mergedMap = new Map<string, DocumentItem>();

    // 1. Add incoming remote docs
    documents.forEach((d) => {
      if (d && d.id && !deletedIds.has(d.id)) {
        mergedMap.set(d.id, d);
      }
    });

    // 2. Merge existing local docs
    currentLocalDocs.forEach((d) => {
      if (d && d.id && !deletedIds.has(d.id)) {
        if (!mergedMap.has(d.id)) {
          mergedMap.set(d.id, d);
        } else {
          const existing = mergedMap.get(d.id)!;
          mergedMap.set(d.id, {
            ...existing,
            attachmentDataUrl: d.attachmentDataUrl || existing.attachmentDataUrl,
            previewImageDataUrl: d.previewImageDataUrl || existing.previewImageDataUrl,
            attachmentName: existing.attachmentName || d.attachmentName,
            attachmentSize: existing.attachmentSize || d.attachmentSize,
          });
        }
      }
    });

    const finalDocs = sortDocumentsDescending(Array.from(mergedMap.values()));
    memoryDocuments = finalDocs;
    try {
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(finalDocs));
    } catch (e) {}
    saveDocumentsPersistently(finalDocs).catch(() => {});
    updatedLocally = true;
  }

  if (updatedLocally && shouldNotify) {
    notifyProfileUpdated();
  }
}

/**
 * Get profile avatar from in-memory cache, storage, or default
 */
export function getStoredAvatar(): string {
  if (memoryAvatar && memoryAvatar.trim()) return memoryAvatar;
  try {
    const saved = localStorage.getItem(STORAGE_KEY_AVATAR);
    if (saved && saved.trim()) {
      memoryAvatar = saved;
      return saved;
    }
  } catch {}
  return DEFAULT_AVATAR;
}

/**
 * Persist profile avatar to server database and sync across website
 */
export async function saveStoredAvatar(avatarUrlOrFile: string | File | Blob): Promise<string> {
  let rawBase64 = '';

  if (typeof avatarUrlOrFile === 'string') {
    rawBase64 = avatarUrlOrFile;
  } else if (avatarUrlOrFile instanceof File || avatarUrlOrFile instanceof Blob) {
    rawBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = reject;
      reader.readAsDataURL(avatarUrlOrFile);
    });
  }

  // Handle remove/reset
  if (!rawBase64 || !rawBase64.trim()) {
    return await resetStoredAvatar();
  }

  let finalUrl = `/api/profile/picture?v=${Date.now()}`;

  // 1. Persist directly to dedicated Cloud SQL table (Separate persistent cloud database)
  try {
    const res = await fetch('/api/profile/picture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar: rawBase64 }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.url) {
        finalUrl = data.url;
      }
    }
  } catch (serverErr) {
    console.warn('Dedicated profile picture API note:', serverErr);
  }

  // 2. Update in-memory and local browser caches
  memoryAvatar = finalUrl;
  try {
    localStorage.setItem(STORAGE_KEY_AVATAR, finalUrl);
  } catch (err) {}

  // 3. Save to IndexedDB
  try {
    await saveAvatarToIndexedDB({
      id: 'current_profile_avatar',
      dataUrl: rawBase64.length < 500000 ? rawBase64 : finalUrl,
      updatedAt: new Date().toISOString(),
      dimensions: '640 x 640 px',
    });
  } catch {}

  notifyProfileUpdated();

  // 4. Save lightweight URL reference to Firestore & Cloud SQL profile record
  try {
    await saveProfileToFirestore({ avatar: finalUrl });
    pushProfileToServer({ avatar: finalUrl }).catch(() => {});
  } catch (dbErr) {
    console.warn('Firestore profile avatar update note:', dbErr);
  }

  // 5. Upload to public "avatars" Supabase Storage bucket permanently under owner auth.uid()
  try {
    const ownerUid = getAuthenticatedOwnerUid();
    const supaRes = await uploadAvatarToSupabaseBucket(rawBase64, ownerUid);
    if (supaRes && supaRes.publicUrl) {
      saveProfileToSupabaseTable({ avatarUrl: supaRes.publicUrl }, ownerUid).catch(() => {});
    }
  } catch (supaErr) {
    console.warn('Supabase avatars bucket upload note:', supaErr);
  }

  broadcastMemoryEvent('profile', 'avatar_updated', { avatar: finalUrl });
  return finalUrl;
}

/**
 * Reset profile avatar back to default portrait
 */
export async function resetStoredAvatar(): Promise<string> {
  memoryAvatar = '';
  try {
    localStorage.removeItem(STORAGE_KEY_AVATAR);
    localStorage.removeItem('fesline_custom_profile_avatar_meta');
    await clearAvatarFromIndexedDB();
    await fetch('/api/profile/picture', { method: 'DELETE' });
    await saveProfileToFirestore({ avatar: '' });
    pushProfileToServer({ avatar: '' }).catch(() => {});
    const ownerUid = getAuthenticatedOwnerUid();
    saveProfileToSupabaseTable({ avatarUrl: '' }, ownerUid).catch(() => {});
  } catch {}
  broadcastMemoryEvent('profile', 'avatar_deleted', { avatar: '' });
  notifyProfileUpdated();
  return '';
}

/**
 * Get profile bio data
 */
export function getStoredBio(): ProfileBioData {
  if (memoryBio) {
    return {
      ...DEFAULT_BIO_DATA,
      ...memoryBio,
    };
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY_BIO);
    if (saved) {
      const parsed = JSON.parse(saved);
      const merged = {
        ...DEFAULT_BIO_DATA,
        ...parsed,
      };
      memoryBio = merged;
      return merged;
    }
  } catch {}
  return DEFAULT_BIO_DATA;
}

/**
 * Save profile bio data permanently to Firestore database and sync across website
 */
export async function saveStoredBio(bio: ProfileBioData, avatar?: string): Promise<void> {
  const mergedBio: ProfileBioData = {
    ...DEFAULT_BIO_DATA,
    ...bio,
  };
  memoryBio = mergedBio;

  // Only update avatar if explicitly supplied as non-empty or empty string (never if undefined)
  if (avatar !== undefined && avatar !== null) {
    if (avatar && avatar.trim()) {
      memoryAvatar = avatar;
      try {
        localStorage.setItem(STORAGE_KEY_AVATAR, avatar);
      } catch (e) {}
    } else if (avatar === '') {
      memoryAvatar = '';
      try {
        localStorage.removeItem(STORAGE_KEY_AVATAR);
        localStorage.removeItem('fesline_custom_profile_avatar_meta');
      } catch (e) {}
    }
  }

  // 1. Optimistic instant local update
  try {
    localStorage.setItem(STORAGE_KEY_BIO, JSON.stringify(mergedBio));
  } catch (err) {
    console.warn('LocalStorage save failed for bio:', err);
  }
  notifyProfileUpdated();
  broadcastMemoryEvent('profile', 'bio_updated', { bio: mergedBio, avatar });

  // 2. Atomic, persistent Firestore database write & Cloud SQL write
  try {
    const payload: { bio: ProfileBioData; avatar?: string } = { bio: mergedBio };
    if (avatar !== undefined && avatar !== null) {
      payload.avatar = avatar;
    }

    await Promise.allSettled([
      saveProfileToFirestore(payload),
      pushProfileToServer(payload),
    ]);

    const ownerUid = getAuthenticatedOwnerUid();
    saveProfileToSupabaseTable({
      fullName: mergedBio.fullName,
      header: mergedBio.header,
      bioData: mergedBio,
      avatarUrl: avatar,
    }, ownerUid).catch(() => {});
  } catch (err) {
    console.warn('Note on saving bio to persistent database:', err);
  }
}

/**
 * Get documents list
 */
export function getStoredDocuments(): DocumentItem[] {
  if (memoryDocuments && Array.isArray(memoryDocuments)) {
    return memoryDocuments;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY_DOCS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        memoryDocuments = parsed;
        return parsed;
      }
    }
  } catch {}
  return [];
}

/**
 * Save documents list permanently to Firestore database and sync across website
 */
export async function saveStoredDocuments(docs: DocumentItem[]): Promise<void> {
  memoryDocuments = docs;

  // 1. Optimistic instant local update
  try {
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
  } catch (err) {
    console.warn('LocalStorage save quota note for docs:', err);
  }
  
  // Persist to IndexedDB asynchronously for large attachments
  saveDocumentsPersistently(docs).catch((e) => console.warn('Persistent storage failed:', e));
  notifyProfileUpdated();
  broadcastMemoryEvent('documents', 'profile_docs_updated', { count: docs.length });

  // 2. Atomic, persistent Firestore database write & Cloud SQL write
  try {
    await Promise.allSettled([
      saveProfileToFirestore({ documents: docs }),
      pushProfileToServer({ documents: docs }),
    ]);

    const ownerUid = getAuthenticatedOwnerUid();
    saveProfileToSupabaseTable({ documents: docs }, ownerUid).catch(() => {});
  } catch (err) {
    console.warn('Note on saving documents to persistent database:', err);
  }
}

/**
 * Check if owner mode is authenticated
 */
export function isOwnerAuthenticated(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY_AUTH) === 'true';
  } catch {}
  return false;
}

/**
 * Set owner authentication mode
 */
export function setOwnerAuthenticated(auth: boolean): void {
  try {
    if (auth) {
      localStorage.setItem(STORAGE_KEY_AUTH, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    }
  } catch {}
  notifyProfileUpdated();
}

/**
 * Verify owner password - ONLY "Festus1999." is accepted
 */
export function verifyOwnerPassword(password: string): boolean {
  return password === OWNER_PASSWORD;
}

/**
 * Verify owner email
 */
export function verifyOwnerEmail(email: string): boolean {
  return email.trim().toLowerCase() === OWNER_EMAIL.toLowerCase();
}

/**
 * Calculate the dynamic right part for "Lead Mechanical Design Engineer"
 * based on user certification inputs or uploaded certificate documents
 */
export function getRightBadgeCertifications(bio?: ProfileBioData, docs?: DocumentItem[]): string {
  const currentBio = bio || getStoredBio();
  const currentDocs = docs || getStoredDocuments();

  const certDocs = currentDocs.filter(
    (d) =>
      d.category === 'Certification' ||
      d.category === 'Accreditation' ||
      d.category === 'Engineering License'
  );

  if (certDocs.length > 0) {
    const titles = certDocs.map((c) => c.title);
    return titles.slice(0, 4).join(' · ');
  }

  if (currentBio.badges && currentBio.badges.trim()) {
    return currentBio.badges.replace(/Active & Available/gi, '').replace(/Verified Engineer/gi, '').replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, '').trim() || currentBio.badges;
  }

  return 'CSWP · ASME GDTP Senior · FE Exam';
}

/**
 * React hook for components to subscribe to profile updates across all pages
 */
export function useProfileSync() {
  const [avatar, setAvatar] = useState<string>(getStoredAvatar);
  const [bio, setBio] = useState<ProfileBioData>(getStoredBio);
  const [documents, setDocuments] = useState<DocumentItem[]>(getStoredDocuments);
  const [isOwner, setIsOwner] = useState<boolean>(isOwnerAuthenticated);
  const [ownerUid, setOwnerUid] = useState<string>(getAuthenticatedOwnerUid);

  const sync = useCallback(() => {
    setAvatar(getStoredAvatar());
    setBio(getStoredBio());
    setDocuments(getStoredDocuments());
    setIsOwner(isOwnerAuthenticated());
    setOwnerUid(getAuthenticatedOwnerUid());
  }, []);

  useEffect(() => {
    syncGlobalProfileWithServer().then(() => sync());
    const unsubMemory = subscribeToDynamicMemory((ev) => {
      if (ev.category === 'profile' || ev.category === 'documents') {
        sync();
      }
    });
    window.addEventListener(EVENT_PROFILE_UPDATED, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncGlobalProfileWithServer().then(() => sync());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubMemory();
      window.removeEventListener(EVENT_PROFILE_UPDATED, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [sync]);

  return {
    avatar,
    bio,
    documents,
    isOwner,
    ownerUid,
    sync,
    saveAvatar: saveStoredAvatar,
    resetAvatar: resetStoredAvatar,
    saveBio: saveStoredBio,
    saveDocuments: saveStoredDocuments,
    setOwner: setOwnerAuthenticated,
  };
}
