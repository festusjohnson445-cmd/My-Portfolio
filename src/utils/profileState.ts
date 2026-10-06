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
import {
  uploadAvatarToSupabaseBucket,
  deleteAvatarFromSupabaseBucket,
  saveProfileToSupabaseTable,
  fetchProfileFromSupabaseTable,
  subscribeToSupabaseProfileChanges,
  getAuthenticatedOwnerUid,
  getValidatedSession,
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
 * Resize and compress profile avatar to max 400x400 WebP format at 80% quality (0.80)
 * prior to calling Supabase Storage or backend server.
 */
export async function compressAvatarToWebP(
  fileOrBlobOrDataUrl: File | Blob | string,
  maxDimension = 400,
  quality = 0.80
): Promise<{ dataUrl: string; blob: Blob; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const processImage = (dataUrl: string) => {
      // If SVG, return as is
      if (dataUrl.startsWith('data:image/svg')) {
        const parts = dataUrl.split(',');
        const binaryStr = atob(parts[1] || '');
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'image/svg+xml' });
        resolve({ dataUrl, blob, mimeType: 'image/svg+xml' });
        return;
      }

      const img = new Image();
      img.onerror = () => {
        const parts = dataUrl.split(',');
        const binaryStr = atob(parts[1] || '');
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        const blob = new Blob([bytes], { type: 'image/webp' });
        resolve({ dataUrl, blob, mimeType: 'image/webp' });
      };
      img.onload = () => {
        try {
          let { width, height } = img;
          // Scale to max 400x400 preserving aspect ratio
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
            resolve({ dataUrl, blob: new Blob([]), mimeType: 'image/webp' });
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          // Attempt WebP export at 80% (0.80) quality
          let webpDataUrl = canvas.toDataURL('image/webp', quality);
          let mime = 'image/webp';
          if (!webpDataUrl.startsWith('data:image/webp')) {
            webpDataUrl = canvas.toDataURL('image/jpeg', quality);
            mime = 'image/jpeg';
          }

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ dataUrl: webpDataUrl, blob, mimeType: mime });
              } else {
                const parts = webpDataUrl.split(',');
                const bin = atob(parts[1] || '');
                const bytes = new Uint8Array(bin.length);
                for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                resolve({ dataUrl: webpDataUrl, blob: new Blob([bytes], { type: mime }), mimeType: mime });
              }
            },
            mime,
            quality
          );
        } catch {
          resolve({ dataUrl, blob: new Blob([]), mimeType: 'image/webp' });
        }
      };
      img.src = dataUrl;
    };

    if (typeof fileOrBlobOrDataUrl === 'string') {
      if (fileOrBlobOrDataUrl.startsWith('data:')) {
        processImage(fileOrBlobOrDataUrl);
      } else {
        resolve({ dataUrl: fileOrBlobOrDataUrl, blob: new Blob([]), mimeType: 'image/webp' });
      }
    } else {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file for compression'));
      reader.onload = (e) => {
        const sourceDataUrl = (e.target?.result as string) || '';
        processImage(sourceDataUrl);
      };
      reader.readAsDataURL(fileOrBlobOrDataUrl);
    }
  });
}

/**
 * Compress or process an image data URL or file to fit safely and render quickly (defaults to 400x400 WebP at 80% quality)
 */
export async function compressImage(file: File, maxDimension = 400, quality = 0.80): Promise<string> {
  const res = await compressAvatarToWebP(file, maxDimension, quality);
  return res.dataUrl;
}

// In-memory persistent cache to guarantee instant, reliable hydration across all components
let memoryAvatar: string = '';
let memoryBio: ProfileBioData | null = null;
let memoryDocuments: DocumentItem[] | null = null;
let memoryUpdatedAt: string = '';
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
export async function syncGlobalProfileWithServer(force = false): Promise<void> {
  if (isSyncingWithServer || (!force && isProfileHydrated)) return;
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

    // 3. Attach real-time listeners if not already active
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

      subscribeToSupabaseProfileChanges((supaPayload) => {
        if (supaPayload) {
          applyPersistentProfile({
            avatar: supaPayload.avatar_url || supaPayload.avatarUrl,
            bio: typeof supaPayload.bio === 'string' ? JSON.parse(supaPayload.bio) : supaPayload.bio,
            documents: typeof supaPayload.documents === 'string' ? JSON.parse(supaPayload.documents) : supaPayload.documents,
            updatedAt: supaPayload.updated_at || new Date().toISOString(),
          });
        }
      });
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
 * Get last profile updated timestamp
 */
export function getStoredProfileUpdatedAt(): string {
  return memoryUpdatedAt || '';
}

/**
 * Persist profile avatar to server database and sync across website
 * Strictly requires validated Supabase session before executing write
 * Performs client-side WebP compression (400x400 max, 80% quality) and optimistic UI update
 */
export async function saveStoredAvatar(avatarUrlOrFile: string | File | Blob): Promise<string> {
  // Handle remove/reset
  if (!avatarUrlOrFile) {
    return await resetStoredAvatar();
  }

  // 1. Session verification: write operations execute only with active session
  const { user } = await getValidatedSession();
  const ownerUid = user.id;

  // 2. Client-side WebP compression: resize to max 400x400px WebP at 80% quality
  let compressedDataUrl = '';
  let uploadPayload: Blob | File | string = avatarUrlOrFile;
  try {
    const compressed = await compressAvatarToWebP(avatarUrlOrFile, 400, 0.80);
    compressedDataUrl = compressed.dataUrl;
    uploadPayload = compressed.blob;
  } catch (compErr) {
    console.warn('Avatar compression note:', compErr);
  }

  // 3. OPTIMISTIC UI UPDATE: update memory & local caches immediately for 0ms visual delay
  const nowIso = new Date().toISOString();
  if (compressedDataUrl) {
    memoryAvatar = compressedDataUrl;
    memoryUpdatedAt = nowIso;
    try {
      localStorage.setItem(STORAGE_KEY_AVATAR, compressedDataUrl);
    } catch {}
    notifyProfileUpdated();
  }

  // 4. Upload compressed WebP to Supabase Storage bucket 'avatars'
  let finalUrl = '';
  try {
    const supaRes = await uploadAvatarToSupabaseBucket(uploadPayload, ownerUid);
    if (supaRes && supaRes.publicUrl && supaRes.publicUrl.startsWith('http')) {
      finalUrl = supaRes.publicUrl;
    } else {
      throw new Error('Supabase Storage: Did not receive valid public URL.');
    }
  } catch (supaErr: any) {
    console.error('[saveStoredAvatar Supabase Error]:', supaErr);
    throw supaErr;
  }

  // 5. Update in-memory and local browser caches with final URL
  memoryAvatar = finalUrl;
  memoryUpdatedAt = nowIso;
  try {
    localStorage.setItem(STORAGE_KEY_AVATAR, finalUrl);
  } catch (err) {}

  // 6. Save to IndexedDB
  try {
    await saveAvatarToIndexedDB({
      id: 'current_profile_avatar',
      dataUrl: finalUrl,
      updatedAt: nowIso,
      dimensions: '400 x 400 px',
    });
  } catch {}

  notifyProfileUpdated();

  // 7. Save URL reference to Firestore & Cloud SQL profile record
  try {
    await saveProfileToFirestore({ avatar: finalUrl });
    pushProfileToServer({ avatar: finalUrl }).catch(() => {});
  } catch (dbErr) {
    console.warn('Firestore profile avatar update note:', dbErr);
  }

  return finalUrl;
}

/**
 * Reset profile avatar back to default portrait (Owner Gated via Supabase Session)
 */
export async function resetStoredAvatar(): Promise<string> {
  const { user } = await getValidatedSession();
  const ownerUid = user.id;

  memoryAvatar = '';
  try {
    localStorage.removeItem(STORAGE_KEY_AVATAR);
    localStorage.removeItem('fesline_custom_profile_avatar_meta');
    await clearAvatarFromIndexedDB();
    await fetch('/api/profile/picture', { method: 'DELETE' });
    await saveProfileToFirestore({ avatar: '' });
    pushProfileToServer({ avatar: '' }).catch(() => {});
    await saveProfileToSupabaseTable({ avatarUrl: '' }, ownerUid).catch(() => {});
  } catch {}
  notifyProfileUpdated();
  return '';
}

/**
 * Get profile bio data (Public read for unauthenticated visitors)
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
 * Save profile bio data permanently to Supabase Database (Owner Gated via Supabase Session)
 */
export async function saveStoredBio(bio: ProfileBioData, avatar?: string): Promise<void> {
  // Validate active session
  const { user } = await getValidatedSession();
  const ownerUid = user.id;

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

  // 2. Persist to Supabase Profiles Table under auth.uid()
  await saveProfileToSupabaseTable({
    fullName: mergedBio.fullName,
    header: mergedBio.header,
    bioData: mergedBio,
    avatarUrl: avatar,
  }, ownerUid);

  // 3. Backup write to Firestore & Server
  try {
    const payload: { bio: ProfileBioData; avatar?: string } = { bio: mergedBio };
    if (avatar !== undefined && avatar !== null) {
      payload.avatar = avatar;
    }

    await Promise.allSettled([
      saveProfileToFirestore(payload),
      pushProfileToServer(payload),
    ]);
  } catch (err: any) {
    console.warn('Backup database write note:', err);
  }
}

/**
 * Get documents list (Public read for unauthenticated visitors)
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
 * Save documents list permanently to Supabase Database (Owner Gated via Supabase Session)
 */
export async function saveStoredDocuments(docs: DocumentItem[]): Promise<void> {
  // Validate active session
  const { user } = await getValidatedSession();
  const ownerUid = user.id;

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

  // 2. Persist to Supabase with owner UID
  await saveProfileToSupabaseTable({ documents: docs }, ownerUid);

  // 3. Backup to Firestore & Server
  try {
    await Promise.allSettled([
      saveProfileToFirestore({ documents: docs }),
      pushProfileToServer({ documents: docs }),
    ]);
  } catch (err) {
    console.warn('Backup database save note:', err);
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
 * Set owner authentication mode with optional Supabase UID
 */
export function setOwnerAuthenticated(auth: boolean, uid?: string): void {
  try {
    if (auth) {
      localStorage.setItem(STORAGE_KEY_AUTH, 'true');
      if (uid) {
        localStorage.setItem('fesline_owner_supabase_uid', uid);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH);
      localStorage.removeItem('fesline_owner_supabase_uid');
      localStorage.removeItem('fesline_owner_supabase_email');
    }
  } catch {}
  notifyProfileUpdated();
}

/**
 * Verify owner email helper
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
  const [updatedAt, setUpdatedAt] = useState<string>(getStoredProfileUpdatedAt);

  const sync = useCallback(() => {
    setAvatar(getStoredAvatar());
    setBio(getStoredBio());
    setDocuments(getStoredDocuments());
    setIsOwner(isOwnerAuthenticated());
    setOwnerUid(getAuthenticatedOwnerUid());
    setUpdatedAt(getStoredProfileUpdatedAt());
  }, []);

  useEffect(() => {
    syncGlobalProfileWithServer().then(() => sync());
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
    updatedAt,
    sync,
    saveAvatar: saveStoredAvatar,
    resetAvatar: resetStoredAvatar,
    saveBio: saveStoredBio,
    saveDocuments: saveStoredDocuments,
    setOwner: setOwnerAuthenticated,
  };
}
