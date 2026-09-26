import { useEffect, useState, useCallback } from 'react';
import { saveDocumentsPersistently } from './documentStorage';

export const STORAGE_KEY_AVATAR = 'fesline_custom_profile_avatar';
export const STORAGE_KEY_BIO = 'fesline_custom_profile_bio';
export const STORAGE_KEY_DOCS = 'fesline_custom_documents';
export const STORAGE_KEY_AUTH = 'fesline_owner_auth';
export const EVENT_PROFILE_UPDATED = 'fesline_profile_updated';

export const OWNER_EMAIL = 'festusjohnson028@gmail.com';
export const OWNER_PASSWORD = 'Festus1999.';

export const DEFAULT_AVATAR = '/src/assets/images/engineer_profile_portrait_1790197188682.jpg';

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
  discipline: 'Mechanical & Optomechanical Design Engineering',
  badges: 'Verified Engineer · CSWP · ASME GDTP Senior · FE EIT · Active & Available',
  country: 'United States',
  header: 'A mechanical Engineer with knowledge on, Precision mechanism design, non-linear structural & thermal FEA, CNC and Laser cutting/engraving machine, for flight-ready aerospace, quantum computing, and robotics systems.',
  degree: 'B.S. in Mechanical Engineering (BSME)',
  academicHonors: 'ABET Accredited · Honors (GPA 3.84 / 4.00)',
  leadership: 'Lead Mechanical Hardware Engineer · Airborne Gimbal Mechanism Lead · ASME Section Officer · Senior Capstone Design Lead',
  skills: 'SolidWorks (CSWP), PTC Creo, Ansys Workbench (Static / Modal / Transient / Thermal FEA), ASME Y14.5-2018 GD&T, 5-Axis CNC Milling (Haas/Mastercam), Wire EDM, Zeiss CMM Metrology',
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
 * Compress an image data URL or file to fit safely within localStorage and render quickly
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
      img.onerror = () => resolve(dataUrl); // fallback to raw data
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

/**
 * Get profile avatar from storage or default
 */
export function getStoredAvatar(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_AVATAR);
    if (saved && saved.trim()) return saved;
  } catch {}
  return DEFAULT_AVATAR;
}

/**
 * Persist profile avatar and sync across website
 */
export function saveStoredAvatar(avatarUrl: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_AVATAR, avatarUrl);
  } catch (err) {
    console.warn('LocalStorage save failed for avatar:', err);
  }
  notifyProfileUpdated();
}

/**
 * Reset profile avatar back to default portrait
 */
export function resetStoredAvatar(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_AVATAR);
  } catch {}
  notifyProfileUpdated();
}

/**
 * Get profile bio data
 */
export function getStoredBio(): ProfileBioData {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_BIO);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_BIO_DATA,
        ...parsed,
      };
    }
  } catch {}
  return DEFAULT_BIO_DATA;
}

/**
 * Save profile bio data
 */
export function saveStoredBio(bio: ProfileBioData): void {
  try {
    localStorage.setItem(STORAGE_KEY_BIO, JSON.stringify(bio));
  } catch (err) {
    console.warn('LocalStorage save failed for bio:', err);
  }
  notifyProfileUpdated();
}

/**
 * Get documents list
 */
export function getStoredDocuments(): DocumentItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_DOCS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Save documents list
 */
export function saveStoredDocuments(docs: DocumentItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(docs));
  } catch (err) {
    console.warn('LocalStorage save failed for docs:', err);
  }
  // Also persist to IndexedDB asynchronously for large attachments
  saveDocumentsPersistently(docs).catch((e) => console.warn('Persistent storage failed:', e));
  notifyProfileUpdated();
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

  // 1. Look for uploaded certifications/accreditations/licenses in documents
  const certDocs = currentDocs.filter(
    (d) =>
      d.category === 'Certification' ||
      d.category === 'Accreditation' ||
      d.category === 'Engineering License'
  );

  if (certDocs.length > 0) {
    // Collect titles (cleaned up if long)
    const titles = certDocs.map((c) => {
      // If CSWP or ASME or similar is in title, keep concise
      return c.title;
    });
    return titles.slice(0, 4).join(' · ');
  }

  // 2. Otherwise check user customized bio badges
  if (currentBio.badges && currentBio.badges.trim()) {
    // If user provided custom badges, format or use them
    return currentBio.badges.replace(/Active & Available/gi, '').replace(/Verified Engineer/gi, '').replace(/^(\s*·\s*)+|(\s*·\s*)+$/g, '').trim() || currentBio.badges;
  }

  // 3. Fallback standard
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

  const sync = useCallback(() => {
    setAvatar(getStoredAvatar());
    setBio(getStoredBio());
    setDocuments(getStoredDocuments());
    setIsOwner(isOwnerAuthenticated());
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener(EVENT_PROFILE_UPDATED, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener(EVENT_PROFILE_UPDATED, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, [sync]);

  return {
    avatar,
    bio,
    documents,
    isOwner,
    sync,
    saveAvatar: saveStoredAvatar,
    resetAvatar: resetStoredAvatar,
    saveBio: saveStoredBio,
    saveDocuments: saveStoredDocuments,
    setOwner: setOwnerAuthenticated,
  };
}
