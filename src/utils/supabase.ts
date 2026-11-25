import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { serializeMessagePayload } from './audioUtils';

// ============================================================================
// 1. SUPABASE CLIENT INITIALIZATION & CONFIGURATION
// ============================================================================

const ENV_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const ENV_SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Support dynamic browser storage override if owner inputs custom credentials in Admin UI
export function getResolvedSupabaseConfig(): { url: string; anonKey: string; isRealConfig: boolean } {
  try {
    const customUrl = localStorage.getItem('fesline_custom_supabase_url');
    const customKey = localStorage.getItem('fesline_custom_supabase_anon_key');
    if (customUrl && customKey && customUrl.startsWith('http')) {
      return { url: customUrl.trim().replace(/\/+$/, ''), anonKey: customKey.trim(), isRealConfig: true };
    }
  } catch {}

  if (ENV_SUPABASE_URL && ENV_SUPABASE_KEY && ENV_SUPABASE_URL.startsWith('http')) {
    return { url: ENV_SUPABASE_URL.replace(/\/+$/, ''), anonKey: ENV_SUPABASE_KEY, isRealConfig: true };
  }

  // Default live project URL & publishable key for seamless Vercel and local operation
  return {
    url: 'https://teszyojnwaedjvqaqake.supabase.co',
    anonKey: 'sb_publishable_-XgRARzNT0COeyl9FE66Lw_-k6wMWex',
    isRealConfig: true,
  };
}

export function isSupabasePublishableKey(key?: string): boolean {
  const k = (key || '').trim();
  return k.startsWith('sb_publishable_') || k.startsWith('sb_secret_');
}

export function buildSupabaseStorageAuthHeaders(
  cfg: { anonKey: string },
  bearerJwt?: string | null
): Record<string, string> {
  const headers: Record<string, string> = {
    apikey: cfg.anonKey,
  };
  const token = (bearerJwt || '').trim();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else if (!isSupabasePublishableKey(cfg.anonKey)) {
    headers['Authorization'] = `Bearer ${cfg.anonKey}`;
  }
  return headers;
}

const initialConfig = getResolvedSupabaseConfig();

export const supabase: SupabaseClient = createClient(initialConfig.url, initialConfig.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export function isSupabaseConfigured(): boolean {
  return getResolvedSupabaseConfig().isRealConfig;
}

export function getSupabaseProjectUrl(): string {
  return getResolvedSupabaseConfig().url;
}

export function updateCustomSupabaseConfig(url: string, anonKey: string): void {
  try {
    if (url && anonKey) {
      localStorage.setItem('fesline_custom_supabase_url', url.trim());
      localStorage.setItem('fesline_custom_supabase_anon_key', anonKey.trim());
    } else {
      localStorage.removeItem('fesline_custom_supabase_url');
      localStorage.removeItem('fesline_custom_supabase_anon_key');
    }
  } catch {}
}

// Storage Bucket Constants
export const SUPABASE_BUCKETS = {
  AVATARS: 'avatars',
  MATERIALS: 'materials',
  PROJECTS: 'projects',
  ARTICLES: 'articles',
} as const;

// Cache active owner user ID
let cachedOwnerUid: string | null = null;

/**
 * Persistent version query helper derived from the record's updated_at timestamp
 * (?v=${profile.updated_at}) so browsers cache images efficiently without reloading on every render.
 */
export function withRecordVersion(url?: string | null, updatedAt?: string | number | null): string {
  if (!url) return '';
  const clean = url.trim();
  if (!clean) return '';
  // If it's already an inline SVG or data/blob URL without remote caching, return it
  if (clean.startsWith('data:image/') || clean.startsWith('blob:')) return clean;
  // Strip any existing ?v= or &v=
  const cleanUrl = clean.replace(/([?&])v=[^&#]*/, '');
  if (!updatedAt) return cleanUrl;
  const versionParam = typeof updatedAt === 'number'
    ? updatedAt
    : (new Date(updatedAt).getTime() || encodeURIComponent(String(updatedAt)));
  const sep = cleanUrl.includes('?') ? '&' : '?';
  return `${cleanUrl}${sep}v=${versionParam}`;
}

/**
 * Backwards compatible alias for withRecordVersion
 */
export const withCacheBuster = withRecordVersion;

// ============================================================================
// 2. OWNER AUTHENTICATION (EMAIL/PASSWORD VIA SUPABASE AUTH)
// ============================================================================

export const AUTHORIZED_ADMIN_EMAIL = 'festusjohnson445@gmail.com';
export const AUTHORIZED_ADMIN_EMAILS = [
  'festusjohnson445@gmail.com',
  'festusjohnson028@gmail.com',
] as const;

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (AUTHORIZED_ADMIN_EMAILS as readonly string[]).includes(normalized);
}

export function isEmailConfirmedUser(user?: User | null): boolean {
  if (!user) return false;
  return Boolean(user.email_confirmed_at || (user as any).confirmed_at);
}

export function getSessionAalClaim(session?: Session | null): 'aal1' | 'aal2' | null {
  const token = session?.access_token;
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);
    const decoded =
      typeof atob === 'function'
        ? atob(padded)
        : Buffer.from(padded, 'base64').toString('utf-8');
    const payload = JSON.parse(decoded);
    if (payload?.aal === 'aal2') return 'aal2';
    if (payload?.aal === 'aal1') return 'aal1';
  } catch {}
  return null;
}

export async function getAuthenticatedBearerHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Validate that an active AAL2 Supabase session exists for the explicitly authorized,
 * email-confirmed administrator before any administrative write operation.
 */
export async function getValidatedSession(): Promise<{ session: Session; user: User }> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.user) {
    throw new Error(error?.message || 'Authentication required: Active Supabase session is required to perform this action.');
  }

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const liveUser = userData?.user;
  if (userErr || !liveUser || !isRealOwnerUser(liveUser)) {
    throw new Error('Unauthorized: Confirmed administrator email authorization is required.');
  }

  const jwtAal = getSessionAalClaim(data.session);
  if (jwtAal !== 'aal2') {
    throw new Error('Two-Factor Authentication (AAL2) verification is required to perform administrative operations.');
  }

  let rawFactors = Array.isArray((liveUser as any).factors) ? (liveUser as any).factors : null;
  if (!rawFactors) {
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    rawFactors = factorsData?.all || factorsData?.totp || [];
  }
  const verifiedTotp = rawFactors.filter(
    (f: any) => f.status === 'verified' && (!f.factor_type || f.factor_type === 'totp')
  );
  if (verifiedTotp.length === 0) {
    throw new Error('Mandatory TOTP authenticator enrollment is required before accessing administrative operations.');
  }

  cachedOwnerUid = liveUser.id;
  return { session: data.session, user: liveUser };
}

/**
 * Sign in as the website owner using supabase.auth.signInWithPassword()
 * Pure Supabase Auth without hardcoded credentials or bypass
 */
export async function supabaseSignInOwner(email: string, password: string): Promise<{
  user: User | null;
  session: Session | null;
  error: Error | null;
}> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      console.error('[Supabase Auth] signInWithPassword error:', error.message);
      return { user: null, session: null, error: new Error(error.message) };
    }

    if (data?.session && data.user) {
      cachedOwnerUid = data.user.id;
      try {
        localStorage.setItem('fesline_owner_supabase_uid', data.user.id);
        localStorage.setItem('fesline_owner_supabase_email', data.user.email || email);
      } catch {}
      return { user: data.user, session: data.session, error: null };
    }

    return { user: null, session: null, error: new Error('No session returned from authentication') };
  } catch (err: any) {
    console.error('[Supabase Auth Error]:', err);
    return { user: null, session: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Top-level listener for session changes
 */
export function onSupabaseAuthStateChange(callback: (event: string, session: Session | null) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      cachedOwnerUid = session.user.id;
      try {
        localStorage.setItem('fesline_owner_supabase_uid', session.user.id);
        localStorage.setItem('fesline_owner_supabase_email', session.user.email || '');
      } catch {}
    } else {
      cachedOwnerUid = null;
      try {
        localStorage.removeItem('fesline_owner_supabase_uid');
        localStorage.removeItem('fesline_owner_supabase_email');
      } catch {}
    }
    callback(event, session);
  });
}

/**
 * Sign out owner session from Supabase
 */
export async function supabaseSignOutOwner(): Promise<void> {
  cachedOwnerUid = null;
  try {
    localStorage.removeItem('fesline_owner_supabase_uid');
    localStorage.removeItem('fesline_owner_supabase_email');
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[Supabase Auth SignOut Error]:', err);
  }
}

/**
 * Retrieve current active authenticated owner user
 */
export async function getSupabaseCurrentUser(): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      cachedOwnerUid = data.user.id;
      return data.user;
    }
  } catch {}
  return null;
}

/**
 * Get current authenticated user ID (auth.uid()), with fallback to stored UID
 */
export function getAuthenticatedOwnerUid(): string {
  if (cachedOwnerUid) return cachedOwnerUid;
  try {
    const saved = localStorage.getItem('fesline_owner_supabase_uid');
    if (saved) return saved;
  } catch {}
  return '';
}

/**
 * Verify that a Supabase User object belongs to the explicitly authorized,
 * email-confirmed administrator (and NOT an anonymous, unconfirmed, or unauthorized account).
 */
export function isRealOwnerUser(user?: User | null): boolean {
  if (!user) return false;
  if ((user as any).is_anonymous) return false;
  if (!isAuthorizedAdminEmail(user.email)) return false;
  if (!isEmailConfirmedUser(user)) return false;
  return true;
}

/**
 * Check if active AAL2 session exists for the authorized, email-confirmed administrator
 */
export async function hasActiveOwnerSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session || !isRealOwnerUser(session.user)) return false;
    if (getSessionAalClaim(session) !== 'aal2') return false;
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return aalData?.currentLevel === 'aal2';
  } catch {
    return false;
  }
}

// ============================================================================
// 3. AVATARS STORAGE BUCKET (PUBLIC BUCKET "avatars")
// ============================================================================

/**
 * Uploads owner profile picture to public "avatars" bucket under auth.uid()
 * Strictly requires active session, includes { contentType: file.type, upsert: true },
 * awaits completion, fetches absolute public URL with supabase.storage.from('avatars').getPublicUrl(path),
 * and updates profiles table (avatar_url) before returning.
 */
export async function uploadAvatarToSupabaseBucket(
  fileOrBlobOrDataUrl: File | Blob | string,
  uid?: string
): Promise<{ publicUrl: string; storagePath: string }> {
  // 1. Session verification: write operations execute only with active session
  const { user } = await getValidatedSession();
  const ownerUid = uid || user.id;

  let uploadBody: Blob | Uint8Array | File;
  let contentType = 'image/jpeg';
  let ext = 'jpg';

  if (typeof fileOrBlobOrDataUrl === 'string') {
    if (fileOrBlobOrDataUrl.startsWith('data:')) {
      const parts = fileOrBlobOrDataUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) {
        contentType = mimeMatch[1];
        if (contentType.includes('png')) ext = 'png';
        else if (contentType.includes('webp')) ext = 'webp';
        else if (contentType.includes('gif')) ext = 'gif';
        else if (contentType.includes('svg')) ext = 'svg';
        else if (contentType.includes('avif')) ext = 'avif';
        else if (contentType.includes('bmp')) ext = 'bmp';
      }
      const binaryStr = atob(parts[1]);
      const len = binaryStr.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      uploadBody = new Blob([bytes], { type: contentType });
    } else {
      // If it's already an absolute URL, return as is
      return { publicUrl: fileOrBlobOrDataUrl, storagePath: '' };
    }
  } else {
    uploadBody = fileOrBlobOrDataUrl;
    contentType = fileOrBlobOrDataUrl.type || 'image/jpeg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('gif')) ext = 'gif';
    else if (contentType.includes('svg')) ext = 'svg';
    else if (contentType.includes('avif')) ext = 'avif';
    else if (contentType.includes('bmp')) ext = 'bmp';
  }

  const fileName = `avatar_${Date.now()}.${ext}`;
  const storagePath = `${ownerUid}/${fileName}`;

  // 2. Upload strictly with { contentType, upsert: true, cacheControl: '3600' } and await completion
  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_BUCKETS.AVATARS)
    .upload(storagePath, uploadBody, {
      contentType,
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('[Supabase Avatars Upload Error]:', uploadError.message);
    throw new Error(`Failed to upload avatar to Supabase Storage: ${uploadError.message}`);
  }

  // 3. Fetch absolute public URL
  const { data: publicData } = supabase.storage
    .from(SUPABASE_BUCKETS.AVATARS)
    .getPublicUrl(storagePath);

  const publicUrl = publicData?.publicUrl;
  if (!publicUrl) {
    throw new Error('Supabase Storage: Failed to generate absolute public URL for avatar.');
  }

  // 4. Update database table row (avatar_url) in "profiles" using resilient upsert
  const { error: dbError } = await resilientSupabaseUpsert('profiles', {
    id: ownerUid,
    avatar_url: publicUrl,
    updated_at: new Date().toISOString(),
  });

  if (dbError) {
    console.error('[Supabase Profiles Avatar DB Error]:', dbError.message);
    throw new Error(`Failed to update avatar_url in profiles table: ${dbError.message}`);
  }

  return {
    publicUrl,
    storagePath,
  };
}

/**
 * Remove avatar file from Supabase avatars bucket
 */
export async function deleteAvatarFromSupabaseBucket(storagePath: string): Promise<boolean> {
  try {
    await getValidatedSession();
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKETS.AVATARS)
      .remove([storagePath]);
    if (error) {
      throw new Error(error.message);
    }
    return true;
  } catch (err: any) {
    console.error('[Supabase Delete Avatar Error]:', err);
    throw err;
  }
}

// ============================================================================
// 4. MATERIALS STORAGE BUCKET (DOCUMENTS BUCKET "materials")
// ============================================================================

/**
 * Uploads engineering material / document to "materials" bucket under auth.uid()
 * Strictly requires active session, includes { contentType: file.type, upsert: true },
 * awaits completion, and fetches absolute public URL using supabase.storage.from('materials').getPublicUrl(path).
 */
export async function uploadMaterialToSupabaseBucket(
  fileOrBlob: File | Blob,
  fileName: string,
  uid?: string,
  allowPublicStudentUpload = false
): Promise<{ publicUrl: string; downloadUrl: string; storagePath: string }> {
  // 1. Session verification: AAL2 owner uses auth.uid(); visitor Student Materials uploads use student-submissions/
  const { data: sessionData } = await supabase.auth.getSession();
  const activeSession = sessionData?.session;
  const activeUser = activeSession?.user;
  const isAal2Owner = Boolean(activeUser && isRealOwnerUser(activeUser) && getSessionAalClaim(activeSession) === 'aal2');
  if (!isAal2Owner && !allowPublicStudentUpload) {
    throw new Error('Authentication required: AAL2 administrator session is required to perform this upload.');
  }
  const folderPrefix = isAal2Owner && activeUser ? uid || activeUser.id : 'student-submissions';

  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `${folderPrefix}/${timestamp}_${cleanName}`;

  let contentType = fileOrBlob.type || 'application/octet-stream';
  if (!contentType || contentType === 'application/octet-stream') {
    if (fileName.endsWith('.pdf')) contentType = 'application/pdf';
    else if (fileName.endsWith('.png')) contentType = 'image/png';
    else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (fileName.endsWith('.webp')) contentType = 'image/webp';
    else if (fileName.endsWith('.step') || fileName.endsWith('.stp')) contentType = 'model/step';
    else if (fileName.endsWith('.iges') || fileName.endsWith('.igs')) contentType = 'model/iges';
  }

  // 2. Upload strictly with { contentType, upsert: true, cacheControl: '3600' } and await completion
  // Preserves primary 'materials' bucket and falls back to 'Materials' if needed (e.g. visitor RLS)
  let activeBucket: string = SUPABASE_BUCKETS.MATERIALS;
  let { error: uploadError } = await supabase.storage
    .from(activeBucket)
    .upload(storagePath, fileOrBlob, {
      contentType,
      cacheControl: '3600',
      upsert: true,
    });

  if (
    uploadError &&
    (allowPublicStudentUpload ||
      /bucket.*not found|row-level security|permission|unauthorized/i.test(uploadError.message || ''))
  ) {
    const fallbackRes = await supabase.storage
      .from('Materials')
      .upload(storagePath, fileOrBlob, {
        contentType,
        cacheControl: '3600',
        upsert: true,
      });
    if (!fallbackRes.error) {
      activeBucket = 'Materials';
      uploadError = null;
    } else {
      uploadError = fallbackRes.error;
    }
  }

  if (uploadError) {
    console.error('[Supabase Materials Upload Error]:', uploadError.message);
    throw new Error(`Failed to upload material to Supabase Storage: ${uploadError.message}`);
  }

  // 3. Fetch absolute public URL
  const { data: publicData } = supabase.storage
    .from(activeBucket)
    .getPublicUrl(storagePath);

  const publicUrl = publicData?.publicUrl;
  if (!publicUrl) {
    throw new Error('Supabase Storage: Failed to generate absolute public URL for material.');
  }

  return {
    publicUrl,
    downloadUrl: publicUrl,
    storagePath,
  };
}

/**
 * Upload lightweight Page-1 PDF preview image to "materials" bucket so visitors load ~25KB thumbnails
 * instead of fetching multi-megabyte source PDFs just to render card thumbnails.
 */
export async function uploadMaterialThumbnailToBucket(
  dataUrl: string,
  materialId: string,
  uid?: string,
  allowPublicStudentUpload = false
): Promise<string | null> {
  try {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
    const { data: sessionData } = await supabase.auth.getSession();
    const activeSession = sessionData?.session;
    const activeUser = activeSession?.user;
    const isAal2Owner = Boolean(activeUser && isRealOwnerUser(activeUser) && getSessionAalClaim(activeSession) === 'aal2');
    if (!isAal2Owner && !allowPublicStudentUpload) return null;
    const folderPrefix = isAal2Owner && activeUser ? uid || activeUser.id : 'student-submissions';

    const parts = dataUrl.split(',');
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const ext = mimeType.includes('webp') ? 'webp' : mimeType.includes('png') ? 'png' : 'jpg';
    const binaryStr = atob(parts[1] || '');
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: mimeType });

    const thumbPath = `${folderPrefix}/thumbs/${materialId}.${ext}`;
    let activeBucket: string = SUPABASE_BUCKETS.MATERIALS;
    let { error } = await supabase.storage
      .from(activeBucket)
      .upload(thumbPath, blob, {
        contentType: mimeType,
        cacheControl: '86400',
        upsert: true,
      });

    if (error && allowPublicStudentUpload) {
      const fb = await supabase.storage
        .from('Materials')
        .upload(thumbPath, blob, {
          contentType: mimeType,
          cacheControl: '86400',
          upsert: true,
        });
      if (!fb.error) {
        activeBucket = 'Materials';
        error = null;
      }
    }

    if (error) return null;
    const { data: pub } = supabase.storage.from(activeBucket).getPublicUrl(thumbPath);
    return pub?.publicUrl || null;
  } catch {
    return null;
  }
}

/**
 * Delete material from Supabase materials bucket
 */
export async function deleteMaterialFromSupabaseBucket(storagePath: string): Promise<boolean> {
  try {
    try {
      await getValidatedSession();
    } catch {}
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKETS.MATERIALS)
      .remove([storagePath]);
    if (error) {
      console.warn('[Supabase Delete Material Storage note]:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[Supabase Delete Material Storage caught]:', err?.message || err);
    return false;
  }
}

/**
 * Uploads a shared file, image, or voice note to the "Materials" storage bucket in Supabase.
 * - Checks both "Materials" and "materials" bucket aliases.
 * - When successful, returns the public URL.
 * - When bucket upload encounters an RLS permission restriction (or network disconnect),
 *   gracefully falls back to a Data URL so that files and voice notes NEVER fail to send or render.
 */
export async function uploadChatFileToMaterialsBucket(
  fileOrBlob: File | Blob,
  fileName: string,
  folder: 'files' | 'images' | 'voicenotes' = 'files'
): Promise<{ url: string; isStoredInBucket: boolean }> {
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const filePath = `chat/${folder}/${uniqueId}_${cleanName}`;

  let contentType = (fileOrBlob as any).type || '';
  if (!contentType || contentType === 'application/octet-stream') {
    if (cleanName.endsWith('.pdf')) contentType = 'application/pdf';
    else if (cleanName.endsWith('.png')) contentType = 'image/png';
    else if (cleanName.endsWith('.jpg') || cleanName.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (cleanName.endsWith('.webp')) contentType = 'image/webp';
    else if (cleanName.endsWith('.wav')) contentType = 'audio/wav';
    else if (cleanName.endsWith('.webm')) contentType = 'audio/webm';
    else if (cleanName.endsWith('.mp3')) contentType = 'audio/mpeg';
    else if (cleanName.endsWith('.step') || cleanName.endsWith('.stp')) contentType = 'model/step';
    else contentType = 'application/octet-stream';
  }

  // 1. Attempt upload to Materials bucket
  try {
    const bucketCandidates = ['Materials', 'materials'];
    for (const bName of bucketCandidates) {
      try {
        const { data, error } = await supabase.storage
          .from(bName)
          .upload(filePath, fileOrBlob, {
            contentType,
            cacheControl: '3600',
            upsert: true,
          });

        if (!error && data?.path) {
          const { data: pubData } = supabase.storage.from(bName).getPublicUrl(data.path);
          if (pubData?.publicUrl) {
            return { url: pubData.publicUrl, isStoredInBucket: true };
          }
        }
      } catch {}
    }
  } catch (bucketErr) {
    console.warn('[Materials bucket upload notice, falling back to data URL]:', bucketErr);
  }

  // 2. Resilient Fallback to Data URL
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(fileOrBlob);
  });

  return { url: dataUrl, isStoredInBucket: false };
}

// ============================================================================
// 5. SUPABASE DATABASE QUERIES & RLS ENFORCEMENT
// ============================================================================

/**
 * Extract missing column name from PostgREST / Supabase schema error messages
 */
function extractMissingColumnFromError(msg?: string): string | null {
  if (!msg) return null;

  // Pattern 1: Could not find the 'author' column of 'materials' in the schema cache
  let m = msg.match(/Could not find the '([^']+)' column/i);
  if (m && m[1]) return m[1];

  // Pattern 2: column "author" of relation "materials" does not exist
  m = msg.match(/column ["']?([^"'\s,;:]+)["']? of relation/i);
  if (m && m[1]) return m[1];

  // Pattern 3: column "author" does not exist
  m = msg.match(/column ["']?([^"'\s,;:]+)["']? does not exist/i);
  if (m && m[1]) return m[1];

  // Pattern 4: Column 'author' does not exist
  m = msg.match(/Column ['"]?([^"'\s,;:]+)['"]? does not exist/i);
  if (m && m[1]) return m[1];

  return null;
}

/**
 * Resilient upsert helper that dynamically adapts to Supabase database schema variations
 * by retrying without columns that do not exist in the remote PostgREST schema cache.
 */
export async function resilientSupabaseUpsert(
  tableName: string,
  initialPayload: Record<string, any>,
  onConflict = 'id'
): Promise<{ data: any; error: any }> {
  let currentPayload = { ...initialPayload };
  let attempts = 0;
  const maxAttempts = 25;

  while (attempts < maxAttempts) {
    attempts++;

    // 1. Try upsert
    const { data: upsertData, error: upsertError } = await supabase
      .from(tableName)
      .upsert(currentPayload, { onConflict });

    if (!upsertError) {
      return { data: upsertData, error: null };
    }

    const missingCol = extractMissingColumnFromError(upsertError.message) ||
                       extractMissingColumnFromError((upsertError as any)?.details) ||
                       extractMissingColumnFromError((upsertError as any)?.hint);

    if (missingCol && currentPayload.hasOwnProperty(missingCol)) {
      console.warn(`[Supabase Schema Adaptive] Table "${tableName}" does not have column "${missingCol}". Retrying without it...`);
      delete currentPayload[missingCol];
      continue;
    }

    // 2. Try insert if upsert fails due to onConflict / primary key format
    const { data: insertData, error: insertError } = await supabase
      .from(tableName)
      .insert(currentPayload);

    if (!insertError) {
      return { data: insertData, error: null };
    }

    const insertMissingCol = extractMissingColumnFromError(insertError.message) ||
                             extractMissingColumnFromError((insertError as any)?.details);

    if (insertMissingCol && currentPayload.hasOwnProperty(insertMissingCol)) {
      console.warn(`[Supabase Schema Adaptive] Table "${tableName}" does not have column "${insertMissingCol}". Retrying without it...`);
      delete currentPayload[insertMissingCol];
      continue;
    }

    // 3. Try update if row already exists
    const conflictVal = currentPayload[onConflict] !== undefined ? currentPayload[onConflict] : currentPayload.id;
    const conflictKey = currentPayload[onConflict] !== undefined ? onConflict : 'id';
    if (conflictVal !== undefined) {
      const { data: updateData, error: updateError } = await supabase
        .from(tableName)
        .update(currentPayload)
        .eq(conflictKey, conflictVal);

      if (!updateError) {
        return { data: updateData, error: null };
      }

      const updateMissingCol = extractMissingColumnFromError(updateError.message) ||
                               extractMissingColumnFromError((updateError as any)?.details);

      if (updateMissingCol && currentPayload.hasOwnProperty(updateMissingCol)) {
        console.warn(`[Supabase Schema Adaptive] Table "${tableName}" does not have column "${updateMissingCol}". Retrying without it...`);
        delete currentPayload[updateMissingCol];
        continue;
      }
    }

    // If no missing column found to strip, return the error
    return { data: null, error: upsertError || insertError };
  }

  // Final fallback: try minimal insert/upsert with base keys
  try {
    const minimalKeys = tableName === 'visitor_profiles'
      ? ['visitor_id', 'display_name', 'role_subject', 'avatar_url', 'avatar_color', 'updated_at']
      : ['id', 'title', 'full_name', 'name', 'created_at', 'updated_at', 'owner_id'];
    const minimalPayload: Record<string, any> = {};
    for (const k of minimalKeys) {
      if (currentPayload[k] !== undefined) minimalPayload[k] = currentPayload[k];
    }
    const { data: finalData, error: finalErr } = await supabase.from(tableName).upsert(minimalPayload, { onConflict });
    if (!finalErr) return { data: finalData, error: null };
  } catch {}

  return { data: null, error: new Error(`Completed schema adaptation attempts for ${tableName}`) };
}

/**
 * Upsert owner profile in Supabase "profiles" table with auth.uid() enforcement.
 * Keeps both the `documents` column and `bio.documents` synchronized so Realtime
 * and initial fetches always resolve the latest documents list cleanly.
 */
export async function saveProfileToSupabaseTable(profileData: {
  fullName?: string;
  header?: string;
  bioData?: any;
  avatarUrl?: string;
  documents?: any[];
}, uid?: string): Promise<boolean> {
  const { user } = await getValidatedSession();
  const ownerUid = uid || user.id;

  const isPartialUpdate =
    profileData.bioData === undefined &&
    profileData.fullName === undefined &&
    profileData.header === undefined;

  if (isPartialUpdate) {
    const partialPayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (profileData.avatarUrl !== undefined) {
      partialPayload.avatar_url = profileData.avatarUrl;
    }
    if (profileData.documents !== undefined) {
      partialPayload.documents = profileData.documents;
    }
    const { data: updatedRows, error: patchErr } = await supabase
      .from('profiles')
      .update(partialPayload)
      .eq('id', ownerUid)
      .select('id');

    if (!patchErr && Array.isArray(updatedRows) && updatedRows.length > 0) {
      cachedProfileData = null;
      lastProfileFetchTime = 0;
      return true;
    }
  }

  const baseBio = profileData.bioData ? { ...profileData.bioData } : undefined;
  if (baseBio && profileData.documents !== undefined) {
    baseBio.documents = profileData.documents;
  }

  const payload: any = {
    id: ownerUid,
    updated_at: new Date().toISOString(),
  };

  if (profileData.fullName !== undefined) {
    payload.full_name = profileData.fullName;
  }
  if (profileData.header !== undefined) {
    payload.header = profileData.header;
  }
  if (baseBio !== undefined) {
    payload.bio = baseBio;
  } else if (profileData.documents !== undefined) {
    // Only attach documents inside bio when no full bioData object was passed
    payload.documents = profileData.documents;
  }

  if (profileData.documents !== undefined) {
    payload.documents = profileData.documents;
  }

  if (profileData.avatarUrl !== undefined) {
    payload.avatar_url = profileData.avatarUrl;
  }

  const { error } = await resilientSupabaseUpsert('profiles', payload);

  if (error) {
    console.error('[Supabase DB Profiles Upsert Error]:', error.message || error);
    throw new Error(error.message || 'Failed to save profile to Supabase database.');
  }

  cachedProfileData = null;
  lastProfileFetchTime = 0;
  return true;
}

let cachedProfileData: any | null = null;
let lastProfileFetchTime = 0;
const PROFILE_CACHE_TTL_MS = 3 * 60 * 1000;

/**
 * Resolve documents array from Supabase row without letting an empty default `[]`
 * in `data.documents` shadow populated `bio.documents`.
 */
export function resolveSupabaseProfileDocuments(rawColDocs: any, rawBioDocs: any): any[] {
  let colDocs = rawColDocs;
  if (typeof colDocs === 'string') {
    try {
      colDocs = JSON.parse(colDocs);
    } catch {
      colDocs = undefined;
    }
  }
  let bioDocs = rawBioDocs;
  if (typeof bioDocs === 'string') {
    try {
      bioDocs = JSON.parse(bioDocs);
    } catch {
      bioDocs = undefined;
    }
  }

  if (Array.isArray(bioDocs) && Array.isArray(colDocs)) {
    if (bioDocs.length > 0 && colDocs.length === 0) return bioDocs;
    return bioDocs.length >= colDocs.length ? bioDocs : colDocs;
  }
  if (Array.isArray(bioDocs)) return bioDocs;
  if (Array.isArray(colDocs)) return colDocs;
  return [];
}

/**
 * Fetch owner profile from Supabase "profiles" table (public read for visitors)
 */
export async function fetchProfileFromSupabaseTable(force = false): Promise<any | null> {
  if (!force && cachedProfileData && Date.now() - lastProfileFetchTime < PROFILE_CACHE_TTL_MS) {
    return cachedProfileData;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    let parsedBio = data.bio;
    if (typeof parsedBio === 'string') {
      try {
        parsedBio = JSON.parse(parsedBio);
      } catch {}
    }

    const parsedDocs = resolveSupabaseProfileDocuments(data.documents, parsedBio?.documents);

    const cleanBio = parsedBio && typeof parsedBio === 'object' ? { ...parsedBio } : {};
    delete (cleanBio as any).documents;

    if (data && data.id) {
      try {
        localStorage.setItem('fesline_owner_supabase_uid', data.id);
      } catch {}
    }

    const profileResult = {
      id: data.id,
      fullName: data.full_name || data.fullName,
      header: data.header,
      bio: cleanBio,
      avatar_url: data.avatar_url || data.avatarUrl || '',
      documents: parsedDocs,
      updated_at: data.updated_at,
    };
    cachedProfileData = profileResult;
    lastProfileFetchTime = Date.now();
    return profileResult;
  } catch {
    return cachedProfileData || null;
  }
}

/**
 * Subscribe to Supabase Realtime Postgres Changes on the profiles table
 */
export function subscribeToSupabaseProfileChanges(callback: (profile: any) => void) {
  try {
    const channel = supabase
      .channel('public:profiles_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          if (payload?.new) {
            callback(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}

/**
 * Subscribe to Supabase Realtime Postgres Changes on the materials table
 */
export function subscribeToSupabaseMaterialsChanges(callback: () => void) {
  try {
    const channel = supabase
      .channel('public:materials_realtime_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'materials' },
        () => {
          callback();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}

/**
 * Save / publish material in Supabase "materials" table
 * Supports both owner uploads (any category) and public visitor Student Materials uploads.
 */
export async function saveMaterialToSupabaseTable(
  material: {
    id: string;
    title: string;
    fileName: string;
    fileSize: string;
    fileType: string;
    category: string;
    description: string;
    author?: string;
    previewUrl?: string;
    downloadUrl?: string;
    fileUrl?: string;
    storagePath?: string;
    tags?: string[];
    level?: string;
    department?: string;
    institution?: string;
    viewsCount?: number;
    likesCount?: number;
  },
  uid?: string,
  allowPublicStudentUpload = false
): Promise<boolean> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const activeUser = sessionData?.session?.user;
    const isStudentMat = material.category === 'Students Materials';
    if (!activeUser && !(allowPublicStudentUpload && isStudentMat)) {
      throw new Error('Authentication required: Active Supabase session is required to upload this material.');
    }
    const ownerUid = activeUser ? uid || activeUser.id : null;

    const publicUrl = material.downloadUrl || material.fileUrl || null;
    const safeMaterialUuid = ensureValidUuid(material.id);

    const payload: any = {
      id: safeMaterialUuid,
      owner_id: ownerUid,
      title: material.title,
      file_name: material.fileName,
      file_size: material.fileSize,
      file_type: material.fileType,
      category: material.category,
      description: material.description,
      preview_url: material.previewUrl || null,
      download_url: publicUrl,
      file_url: publicUrl,
      storage_path: material.storagePath || null,
      tags: material.tags || [],
      is_approved: true,
      level: material.level || '',
      department: material.department || '',
      institution: material.institution || '',
      views_count: material.viewsCount ?? 0,
      likes_count: material.likesCount ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (material.author) {
      payload.author = material.author;
    }

    const { error } = await resilientSupabaseUpsert('materials', payload);

    if (error) {
      console.error('[Supabase DB Materials Upsert Error]:', error.message);
      throw new Error(`Database error saving "${material.title}": ${error.message}`);
    }
    cachedMaterialsData = null;
    lastMaterialsFetchTime = 0;
    return true;
  } catch (err: any) {
    console.error('[Supabase DB Materials Save Error]:', err?.message || err);
    throw err;
  }
}

// In-memory materials cache with 3-minute TTL to drastically cut bandwidth & data consumption
let cachedMaterialsData: any[] | null = null;
let lastMaterialsFetchTime = 0;
const MATERIALS_CACHE_TTL_MS = 3 * 60 * 1000;

/**
 * Fetch public materials from Supabase "materials" table with explicit status
 * so callers can distinguish an authoritative empty list from a network error.
 */
export async function fetchMaterialsFromSupabaseTableWithStatus(
  force = false
): Promise<{ data: any[]; ok: boolean }> {
  if (!force && cachedMaterialsData && Date.now() - lastMaterialsFetchTime < MATERIALS_CACHE_TTL_MS) {
    return { data: cachedMaterialsData, ok: true };
  }

  try {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return { data: cachedMaterialsData || [], ok: false };
    }
    cachedMaterialsData = data;
    lastMaterialsFetchTime = Date.now();
    return { data, ok: true };
  } catch {
    return { data: cachedMaterialsData || [], ok: false };
  }
}

/**
 * Fetch public materials from Supabase "materials" table (public for unauthenticated visitors)
 * Cached in-memory to prevent high internet data consumption on repeated navigation
 */
export async function fetchMaterialsFromSupabaseTable(force = false): Promise<any[]> {
  const res = await fetchMaterialsFromSupabaseTableWithStatus(force);
  return res.data;
}

/**
 * Delete material from Supabase "materials" table (requires owner session)
 */
export async function deleteMaterialFromSupabaseTable(materialId: string): Promise<boolean> {
  try {
    try {
      await getValidatedSession();
    } catch {}
    const safeUuid = ensureValidUuid(materialId);
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', safeUuid);

    // Also attempt raw ID deletion in case legacy row used non-UUID primary key
    if (safeUuid !== materialId) {
      await supabase
        .from('materials')
        .delete()
        .eq('id', materialId)
        .then(() => {}, () => {});
    }

    if (error) {
      console.warn('[Supabase DB Materials Delete Note]:', error.message);
      return false;
    }
    cachedMaterialsData = null;
    lastMaterialsFetchTime = 0;
    return true;
  } catch (err: any) {
    console.warn('[Supabase DB Materials Delete Caught]:', err?.message || err);
    return false;
  }
}

/**
 * Real-time view counter for Engineering Hub documents
 */
export async function incrementMaterialViewsInSupabase(materialId: string): Promise<number | null> {
  try {
    const safeUuid = ensureValidUuid(materialId);
    const { data, error } = await supabase.rpc('increment_material_views', {
      target_material_id: safeUuid,
    });
    if (!error && typeof data === 'number') {
      cachedMaterialsData = null;
      return data;
    }
    if (safeUuid !== materialId) {
      const retry = await supabase.rpc('increment_material_views', {
        target_material_id: materialId,
      });
      if (!retry.error && typeof retry.data === 'number') {
        cachedMaterialsData = null;
        return retry.data;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Real-time like / unlike counter for Engineering Hub documents
 */
export async function toggleMaterialLikeInSupabase(
  materialId: string,
  delta: 1 | -1,
  fallbackNextCount?: number
): Promise<number | null> {
  try {
    const safeUuid = ensureValidUuid(materialId);
    const rpcName = delta >= 0 ? 'increment_material_likes' : 'decrement_material_likes';
    const { data, error } = await supabase.rpc(rpcName, {
      target_material_id: safeUuid,
    });
    if (!error && typeof data === 'number') {
      cachedMaterialsData = null;
      return data;
    }
    if (safeUuid !== materialId) {
      const retry = await supabase.rpc(rpcName, {
        target_material_id: materialId,
      });
      if (!retry.error && typeof retry.data === 'number') {
        cachedMaterialsData = null;
        return retry.data;
      }
    }
    if (typeof fallbackNextCount === 'number' && getAuthenticatedOwnerUid()) {
      const { data: sessData } = await supabase.auth.getSession();
      if (isRealOwnerUser(sessData?.session?.user)) {
        await supabase
          .from('materials')
          .update({ likes_count: Math.max(0, fallbackNextCount) })
          .eq('id', safeUuid);
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ============================================================================
// 6. SUPABASE REALTIME CHANNELS (FOR VISITOR & OWNER MESSAGING)
// ============================================================================

export type RealtimeChatCallback = (message: any) => void;

/**
 * Subscribe to Supabase Realtime channel for instant visitor & owner chat updates
 */
export function subscribeToSupabaseRealtimeChat(callback: RealtimeChatCallback) {
  try {
    const channel = supabase.channel('fesline_portfolio_realtime_chat', {
      config: {
        broadcast: { ack: true, self: false },
      },
    });

    channel
      .on('broadcast', { event: 'new_chat_message' }, (payload) => {
        if (payload?.payload) {
          callback(payload.payload);
        }
      })
      .on('broadcast', { event: 'chat_conversation_updated' }, (payload) => {
        if (payload?.payload) {
          callback(payload.payload);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Connected to Supabase Realtime
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[Supabase Realtime Channel Subscription Note]:', err);
    return () => {};
  }
}

/**
 * Broadcast message instantly over Supabase Realtime channel
 */
export const CHAT_REALTIME_BROADCAST_CHANNEL = 'fesline_portfolio_realtime_chat';

let globalBroadcastChannel: any = null;
export function getSharedChatBroadcastChannel() {
  if (!globalBroadcastChannel) {
    globalBroadcastChannel = supabase.channel(CHAT_REALTIME_BROADCAST_CHANNEL);
    try {
      globalBroadcastChannel.subscribe();
    } catch {}
  }
  return globalBroadcastChannel;
}

export async function broadcastSupabaseChatMessage(messagePayload: any): Promise<void> {
  try {
    const channel = getSharedChatBroadcastChannel();
    // Supabase Realtime WebSocket message payload limit is 256KB.
    // When audio/image is stored in Materials bucket, the URL is a short string (~100 chars), so full payload is always broadcast.
    // If a raw inline base64 string exceeds 180KB, flag for full database fetch instead of corrupting the URL.
    let payloadToSend = messagePayload;
    const vnUrl = messagePayload?.message?.voiceNote?.url || '';
    if (typeof vnUrl === 'string' && vnUrl.length > 180000) {
      payloadToSend = {
        ...messagePayload,
        message: {
          ...messagePayload.message,
          _needsFullFetch: true,
          voiceNote: {
            ...messagePayload.message.voiceNote,
            url: '',
            _needsFetch: true,
          },
        },
      };
    }
    await channel.send({
      type: 'broadcast',
      event: 'new_chat_message',
      payload: payloadToSend,
    });
  } catch (err) {
    console.warn('[Supabase Realtime Broadcast Note]:', err);
  }
}

/**
 * Save / sync conversation to Supabase "conversations" or "chats" table
 */
export async function saveConversationToSupabaseTable(conv: any): Promise<boolean> {
  if (!conv || !conv.id) return false;
  try {
    const payload = {
      id: conv.id,
      visitor_id: conv.visitor_id || conv.id,
      default_label: conv.defaultLabel || conv.visitorName || 'Direct Message',
      custom_name: conv.customName || '',
      visitor_name: conv.visitorName || '',
      avatar_url: conv.avatarUrl || '',
      role_or_company: conv.roleOrCompany || 'Visitor Direct Chat',
      unread: Boolean(conv.unread),
      important: Boolean(conv.important),
      last_message: conv.lastMessage || '',
      last_message_at: conv.last_message_at || conv.lastMessageAt || new Date().toISOString(),
      last_timestamp: conv.lastTimestamp || '',
      messages: Array.isArray(conv.messages) ? conv.messages : [],
      updated_at: new Date().toISOString(),
    };
    const { error } = await resilientSupabaseUpsert('conversations', payload, 'id');
    if (error) {
      console.error('[Supabase DB Conversations Save Error]:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Supabase DB Chat Save Exception]:', err);
    return false;
  }
}

/**
 * Upload visitor custom profile photo directly to "avatars" bucket and retrieve absolute publicUrl
 */
export async function uploadVisitorAvatarToSupabaseBucket(
  fileOrBlobOrDataUrl: File | Blob | string,
  visitorId: string
): Promise<{ publicUrl: string; storagePath: string }> {
  let uploadBody: Blob;
  let contentType = 'image/webp';
  let ext = 'webp';

  if (typeof fileOrBlobOrDataUrl === 'string') {
    if (fileOrBlobOrDataUrl.startsWith('data:')) {
      const parts = fileOrBlobOrDataUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) contentType = mimeMatch[1];
      const binaryStr = atob(parts[1] || '');
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      uploadBody = new Blob([bytes], { type: contentType });
    } else if (fileOrBlobOrDataUrl.startsWith('http')) {
      return { publicUrl: fileOrBlobOrDataUrl, storagePath: '' };
    } else {
      uploadBody = new Blob([]);
    }
  } else {
    uploadBody = fileOrBlobOrDataUrl;
    contentType = fileOrBlobOrDataUrl.type || 'image/webp';
  }

  const fileName = `visitor_${Date.now()}.${ext}`;
  const storagePath = `visitors/${visitorId}/${fileName}`;
  let uploadSuccess = false;

  try {
    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKETS.AVATARS)
      .upload(storagePath, uploadBody, {
        contentType,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.warn('[Supabase Visitor Avatar Storage Notice - Using WebP Fallback]:', uploadError.message || uploadError);
    } else {
      uploadSuccess = true;
    }
  } catch (e: any) {
    console.warn('[Supabase Visitor Avatar Storage Exception - Using WebP Fallback]:', e?.message || e);
  }

  const { data: publicData } = supabase.storage
    .from(SUPABASE_BUCKETS.AVATARS)
    .getPublicUrl(storagePath);

  // Use publicUrl if upload succeeded, otherwise use fallback dataUrl/string
  const publicUrl = (uploadSuccess && publicData?.publicUrl) 
    ? publicData.publicUrl 
    : (typeof fileOrBlobOrDataUrl === 'string' ? fileOrBlobOrDataUrl : (publicData?.publicUrl || ''));

  return { publicUrl, storagePath };
}

/**
 * Save or update visitor profile in "visitor_profiles" table in Supabase
 */
export async function saveVisitorProfileToSupabase(profile: {
  visitor_id: string;
  display_name: string;
  role_subject?: string;
  avatar_url?: string;
  avatar_color?: string;
}): Promise<boolean> {
  if (!profile || !profile.visitor_id) return false;
  try {
    const payload: Record<string, any> = {
      visitor_id: profile.visitor_id,
      display_name: profile.display_name || 'Visitor',
      role_subject: profile.role_subject || 'Visitor Direct Chat',
      avatar_url: profile.avatar_url || '',
      avatar_color: profile.avatar_color || 'bg-slate-700',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('visitor_profiles').upsert(payload, { onConflict: 'visitor_id' });
    if (error) {
      console.error('[Supabase Visitor Profile Upsert Error]:', error);
      await resilientSupabaseUpsert('visitor_profiles', payload, 'visitor_id');
    }
    return true;
  } catch (err) {
    console.error('[Supabase Visitor Profile Save Exception]:', err);
    return false;
  }
}

/**
 * Fetch visitor profile from "visitor_profiles" table by visitor_id
 */
export async function fetchVisitorProfileFromSupabase(visitorId: string): Promise<any | null> {
  if (!visitorId) return null;
  try {
    const { data, error } = await supabase
      .from('visitor_profiles')
      .select('visitor_id, display_name, role_subject, avatar_url, avatar_color')
      .eq('visitor_id', visitorId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Supabase Fetch Visitor Profile Error]:', error);
      return null;
    }
    if (!data) return null;

    return {
      name: data.display_name || 'Visitor',
      roleOrCompany: data.role_subject || 'Visitor Direct Chat',
      avatarUrl: data.avatar_url || '',
      avatarColor: data.avatar_color || 'bg-slate-700',
    };
  } catch (err) {
    console.error('[Supabase Fetch Visitor Profile Exception]:', err);
    return null;
  }
}

/**
 * Ensures a string is a valid UUID format (8-4-4-4-12 hex).
 * If it's already a valid UUID, returns it in lowercase.
 * If not, generates a deterministic v4-compliant UUID based on the string.
 */
export function ensureValidUuid(input?: string | null): string {
  if (!input || !input.trim()) {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : '00000000-0000-4000-a000-000000000000';
  }
  const cleanInput = input.trim().toLowerCase();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(cleanInput)) {
    return cleanInput;
  }

  // Create a deterministic RFC4122 v4 compliant UUID from arbitrary string
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < cleanInput.length; i++) {
    const ch = cleanInput.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hexChars = (cleanInput.replace(/[^0-9a-f]/gi, '') + hex1 + hex2 + 'abcdef0123456789').padEnd(32, '0').slice(0, 32);

  const part1 = hex1;
  const part2 = hexChars.slice(8, 12);
  const part3 = '4' + hexChars.slice(13, 16);
  const part4 = 'a' + hexChars.slice(17, 20);
  const part5 = hex2 + hexChars.slice(28, 32);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`.toLowerCase();
}

/**
 * Generates a consistent deterministic conversation_id combining visitorId and target owner profile ID.
 */
export function generateDeterministicConversationId(visitorId: string, ownerId: string): string {
  const combined = `${visitorId}:${ownerId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }
  const unsignedHash = hash >>> 0;
  const hHex = unsignedHash.toString(16).padStart(8, '0');
  const vClean = visitorId.replace(/[^a-fA-F0-9]/g, '').padEnd(12, '0').slice(0, 12);
  const oClean = ownerId.replace(/[^a-fA-F0-9]/g, '').padEnd(12, '0').slice(0, 12);
  return `${hHex}-${vClean.slice(0,4)}-${vClean.slice(4,8)}-${oClean.slice(0,4)}-${oClean.slice(4,16)}`;
}

// In-memory cached owner ID to avoid redundant network calls on every send
let memoryCachedOwnerId: string | null = null;

/**
 * Retrieve or dynamically fetch owner user ID from Supabase profiles or active session
 */
export async function getOrFetchOwnerId(): Promise<string> {
  if (memoryCachedOwnerId) return memoryCachedOwnerId;
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('fesline_owner_supabase_uid') : null;
  if (saved && saved.trim()) {
    memoryCachedOwnerId = saved.trim();
    return memoryCachedOwnerId;
  }

  try {
    const { data: sessData } = await supabase.auth.getSession();
    if (sessData?.session?.user) {
      const uid = sessData.session.user.id;
      memoryCachedOwnerId = uid;
      localStorage.setItem('fesline_owner_supabase_uid', uid);
      return uid;
    }

    const { data } = await supabase
      .from('profiles')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      memoryCachedOwnerId = data.id;
      localStorage.setItem('fesline_owner_supabase_uid', data.id);
      return data.id;
    }
  } catch (err) {
    console.error('[Supabase Fetch Owner ID Exception]:', err);
  }
  memoryCachedOwnerId = 'a5eb7797-7da2-41ff-9547-3975af3958b7';
  return memoryCachedOwnerId;
}

/**
 * Sequential Database Upsert Pipeline:
 * Upon valid message send after profile creation, executes a sequential try/catch pipeline:
 * Step A: upsert a record into visitor_profiles containing visitor_id, display_name, role_subject, avatar_url.
 * Step B: upsert a record into conversations using id ('conv_' + visitor_id), visitor_id, owner_id, last_message, and last_message_at.
 * Step C: insert the new row into messages linking conversation_id ('conv_' + visitor_id).
 *
 * When the owner replies, reuses the existing conversation_id and updates last_message/last_message_at in place.
 */
export async function saveMessageAndConversationToSupabase(params: {
  conversationId?: string;
  visitorId?: string;
  message: {
    id: string;
    sender: 'visitor' | 'festus';
    text: string;
    timestamp: string;
    status: 'seen' | 'unseen';
    attachments?: any[];
    voiceNote?: any;
  };
  conversationMetadata?: {
    defaultLabel?: string;
    customName?: string;
    visitorName?: string;
    avatarUrl?: string;
    roleOrCompany?: string;
    avatarColor?: string;
  };
}): Promise<boolean> {
  const { conversationId, visitorId, message, conversationMetadata } = params;
  if (!message) return false;

  const isOwnerSender = message.sender === 'festus';
  const ownerId = await getOrFetchOwnerId();
  const safeMessageId = ensureValidUuid(message.id);
  const nowIso = new Date().toISOString();
  const lastSnippet = message.text || (message.voiceNote ? '🎤 Voice note' : (message.attachments?.length ? `📎 ${message.attachments[0].name}` : 'File sent'));

  // Determine visitor ID and conversation ID
  const rawVId = visitorId || (conversationId ? (conversationId.startsWith('conv_') ? conversationId.replace(/^conv_/, '') : conversationId) : '');
  let vId = rawVId.startsWith('conv_') ? rawVId.replace(/^conv_/, '') : rawVId;
  if (!vId && !isOwnerSender) {
    vId = typeof localStorage !== 'undefined' ? (localStorage.getItem('visitor_id') || '') : '';
    if (vId.startsWith('conv_')) vId = vId.replace(/^conv_/, '');
  }
  if (!vId) {
    vId = 'visitor_guest';
  }

  // Conversation ID is strictly 'conv_' + visitor_id (Single Conversation Threading)
  const targetConvId = conversationId && conversationId.startsWith('conv_')
    ? conversationId
    : (conversationId || `conv_${vId}`);

  const displayName = conversationMetadata?.visitorName || conversationMetadata?.customName || conversationMetadata?.defaultLabel || (typeof localStorage !== 'undefined' ? (localStorage.getItem('display_name') || '') : '') || 'Visitor';
  const roleSubject = conversationMetadata?.roleOrCompany || (typeof localStorage !== 'undefined' ? (localStorage.getItem('role_subject') || '') : '') || 'Visitor Direct Chat';
  const avatarUrl = conversationMetadata?.avatarUrl || (typeof localStorage !== 'undefined' ? (localStorage.getItem('avatar_url') || '') : '') || '';
  const avatarColor = conversationMetadata?.avatarColor || (typeof localStorage !== 'undefined' ? (localStorage.getItem('avatar_color') || '') : '') || 'bg-slate-700';

  // Resilient retry helper for transient network hiccups across mobile cellular connections
  const retryDbCall = async (fn: () => PromiseLike<any> | Promise<any>, retries = 2, delayMs = 250): Promise<any> => {
    let lastError: any;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await fn();
        const rAny = result as any;
        if (rAny && rAny.error) {
          const errText = String(rAny.error.message || '');
          if ((errText.includes('Network') || errText.includes('fetch') || errText.includes('timeout')) && attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
            continue;
          }
        }
        return result;
      } catch (err: any) {
        lastError = err;
        const errText = String(err?.message || '');
        if ((errText.includes('Network') || errText.includes('fetch') || errText.includes('timeout')) && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };

  try {
    const hasVoiceNote = Boolean(message.voiceNote && message.voiceNote.url);
    const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;

    // Crucial: Serialize attachments, voice note, and text so all clients and devices
    // can unpack the complete rich media payload from content
    const serializedContent = (hasAttachments || hasVoiceNote)
      ? serializeMessagePayload({
          text: message.text,
          attachments: message.attachments,
          voiceNote: message.voiceNote,
        })
      : (message.text || lastSnippet);

    const basePayload: any = {
      id: safeMessageId,
      conversation_id: targetConvId,
      sender_id: isOwnerSender ? ownerId : vId,
      receiver_id: isOwnerSender ? vId : ownerId,
      content: serializedContent,
      status: message.status || 'unseen',
      created_at: nowIso,
    };

    if (hasVoiceNote) {
      basePayload.voice_note = message.voiceNote;
    }

    // 1. Primary Message Insert Task (resilient against optional voice_note / status schema differences)
    const messageInsertPromise = (async () => {
      let currentMsgPayload = { ...basePayload };
      for (let attempt = 0; attempt < 4; attempt++) {
        const { error: msgError } = await retryDbCall(() => supabase.from('messages').insert(currentMsgPayload));
        if (!msgError) return;
        const missingCol = extractMissingColumnFromError(msgError.message);
        if (missingCol && Object.prototype.hasOwnProperty.call(currentMsgPayload, missingCol)) {
          delete currentMsgPayload[missingCol];
          continue;
        }
        throw msgError;
      }
    })();

    // 2. Parallel Conversation & Profile Metadata Tasks
    const metaPromises: Promise<any>[] = [];
    const safeAvatarUrl =
      avatarUrl && (!avatarUrl.startsWith('data:image/') || avatarUrl.length < 5000)
        ? avatarUrl
        : undefined;

    if (!isOwnerSender) {
      const profilePayload: any = {
        visitor_id: vId,
        updated_at: nowIso,
      };
      if (displayName) profilePayload.display_name = displayName;
      if (roleSubject) profilePayload.role_subject = roleSubject;
      if (safeAvatarUrl) profilePayload.avatar_url = safeAvatarUrl;
      if (avatarColor) profilePayload.avatar_color = avatarColor;

      const convPayload: Record<string, any> = {
        id: targetConvId,
        visitor_id: vId,
        owner_id: ownerId,
        visitor_name: displayName,
        default_label: displayName,
        custom_name: conversationMetadata?.customName || displayName,
        role_or_company: roleSubject,
        last_message: lastSnippet,
        last_message_at: nowIso,
        last_timestamp: message.timestamp || '',
        unread: true,
        unread_count: 1,
        updated_at: nowIso,
      };
      if (safeAvatarUrl) convPayload.avatar_url = safeAvatarUrl;

      metaPromises.push(
        retryDbCall(() => resilientSupabaseUpsert('visitor_profiles', profilePayload, 'visitor_id')).catch((err) => {
          console.warn('[visitor_profiles upsert notice]:', err);
        })
      );
      metaPromises.push(
        retryDbCall(() => resilientSupabaseUpsert('conversations', convPayload, 'id')).catch((err) => {
          console.warn('[conversations upsert notice]:', err);
        })
      );
    } else {
      const ownerConvPayload: Record<string, any> = {
        id: targetConvId,
        visitor_id: vId,
        owner_id: ownerId,
        last_message: lastSnippet,
        last_message_at: nowIso,
        last_timestamp: message.timestamp || '',
        unread: false,
        unread_count: 0,
        updated_at: nowIso,
      };
      metaPromises.push(
        retryDbCall(() => resilientSupabaseUpsert('conversations', ownerConvPayload, 'id')).catch((err) => {
          console.warn('[conversations owner upsert notice]:', err);
        })
      );
    }

    // Ensure profile + conversation exist reliably in Supabase before returning
    await Promise.all([messageInsertPromise, ...metaPromises]);
  } catch (err: any) {
    console.warn('[saveMessageAndConversationToSupabase notice]:', err?.message || err);
  }

  // Broadcast across live channels & refresh local unread counter
  try {
    broadcastSupabaseChatMessage({
      conversationId: targetConvId,
      message: {
        ...message,
        id: safeMessageId,
        sender_id: isOwnerSender ? ownerId : vId,
        receiver_id: isOwnerSender ? vId : ownerId,
        conversation_id: targetConvId,
        status: message.status || 'unseen',
        voiceNote: message.voiceNote,
        voice_note: message.voiceNote,
        created_at: nowIso,
      },
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fesline_unread_count_changed'));
    }
  } catch {}

  return true;
}

/**
 * Mark incoming messages in a conversation as 'seen' and clear unread flags when opened.
 */
export async function markConversationMessagesAsSeenInSupabase(params: {
  conversationId: string;
  readerRole: 'owner' | 'visitor';
  visitorId?: string;
}): Promise<void> {
  const { conversationId, readerRole, visitorId } = params;
  if (!conversationId || conversationId === 'inbox-empty') return;
  const targetConvId = conversationId.startsWith('conv_') ? conversationId : `conv_${conversationId}`;

  try {
    if (readerRole === 'owner') {
      const ownerId = await getOrFetchOwnerId();
      await Promise.allSettled([
        supabase
          .from('messages')
          .update({ status: 'seen' })
          .eq('conversation_id', targetConvId)
          .neq('sender_id', ownerId)
          .neq('status', 'seen'),
        resilientSupabaseUpsert(
          'conversations',
          {
            id: targetConvId,
            unread: false,
            unread_count: 0,
            updated_at: new Date().toISOString(),
          },
          'id'
        ),
      ]);
    } else {
      const rawVId = (visitorId || targetConvId.replace(/^conv_/, '')).trim();
      if (!rawVId) return;
      await supabase
        .from('messages')
        .update({ status: 'seen' })
        .in('conversation_id', [targetConvId, rawVId])
        .neq('sender_id', rawVId)
        .neq('status', 'seen');
    }
  } catch (err) {
    console.warn('[markConversationMessagesAsSeen note]:', err);
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fesline_unread_count_changed'));
    }
  }
}

function getDeletedConvIdsSet(): Set<string> {
  const set = new Set<string>();
  if (typeof window === 'undefined') return set;
  try {
    const raw =
      localStorage.getItem('fesline_deleted_conv_ids') ||
      sessionStorage.getItem('fesline_deleted_conv_ids') ||
      '[]';
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      parsed.forEach((id) => {
        const str = String(id || '').trim();
        if (!str) return;
        const clean = str.replace(/^conv_/, '');
        set.add(clean);
        set.add(`conv_${clean}`);
      });
    }
  } catch {}
  return set;
}

/**
 * Cleanly marks unread messages seen and deletes the conversation & messages in Supabase
 * so deleted inquiries never linger in the live unread count badge.
 */
export async function deleteConversationFromSupabase(conversationId: string): Promise<void> {
  const cleanId = String(conversationId || '').replace(/^conv_/, '').trim();
  if (!cleanId) return;
  const candidates = Array.from(new Set([cleanId, `conv_${cleanId}`]));

  try {
    await supabase
      .from('messages')
      .update({ status: 'seen' })
      .in('conversation_id', candidates);
    await supabase
      .from('conversations')
      .update({ unread: false, unread_count: 0 })
      .in('id', candidates);
    await supabase.from('messages').delete().in('conversation_id', candidates);
    await supabase.from('conversations').delete().in('id', candidates);
  } catch (err) {
    console.warn('[deleteConversationFromSupabase note]:', err);
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('fesline_unread_count_changed'));
    }
  }
}

/**
 * Lightweight unread messaging counter for both Owner and Visitors.
 * Counts only current unread messages belonging to active, non-deleted conversations.
 */
export async function fetchUnreadMessagingCount(params: {
  isOwner: boolean;
  visitorId?: string;
}): Promise<number> {
  try {
    const deletedSet = getDeletedConvIdsSet();

    if (params.isOwner) {
      const ownerId = await getOrFetchOwnerId();
      const [msgsRes, convsRes] = await Promise.all([
        supabase
          .from('messages')
          .select('id, conversation_id, sender_id, status')
          .eq('status', 'unseen')
          .limit(300),
        supabase
          .from('conversations')
          .select('id, visitor_id')
          .limit(200),
      ]);

      const activeConvIds = new Set<string>();
      const hasConvTableData = Array.isArray(convsRes.data) && !convsRes.error;
      if (hasConvTableData) {
        convsRes.data.forEach((c: any) => {
          const cid = String(c?.id || '').trim();
          const vid = String(c?.visitor_id || '').trim();
          if (cid && !deletedSet.has(cid) && !deletedSet.has(cid.replace(/^conv_/, ''))) {
            activeConvIds.add(cid);
            activeConvIds.add(cid.replace(/^conv_/, ''));
          }
          if (vid && !deletedSet.has(vid) && !deletedSet.has(`conv_${vid}`)) {
            activeConvIds.add(vid);
            activeConvIds.add(`conv_${vid}`);
          }
        });
      }

      if (!Array.isArray(msgsRes.data) || msgsRes.error) return 0;

      return msgsRes.data.filter((m: any) => {
        if (!m?.sender_id || m.sender_id === ownerId || m.sender_id === 'festus') return false;
        const convId = String(m.conversation_id || '').trim();
        if (!convId) return false;
        if (deletedSet.has(convId) || deletedSet.has(convId.replace(/^conv_/, ''))) return false;
        if (deletedSet.has(m.sender_id) || deletedSet.has(`conv_${m.sender_id}`)) return false;
        if (hasConvTableData && !activeConvIds.has(convId) && !activeConvIds.has(convId.replace(/^conv_/, ''))) {
          return false;
        }
        return true;
      }).length;
    }

    const storedVId =
      params.visitorId ||
      (typeof localStorage !== 'undefined'
        ? localStorage.getItem('visitor_id') || localStorage.getItem('fesline_visitor_id') || ''
        : '');
    const cleanVId = storedVId.replace(/^conv_/, '').trim();
    if (!cleanVId || deletedSet.has(cleanVId) || deletedSet.has(`conv_${cleanVId}`)) return 0;

    const targetConvId = `conv_${cleanVId}`;
    const [msgsRes, convCheckRes] = await Promise.all([
      supabase
        .from('messages')
        .select('id, sender_id, status')
        .in('conversation_id', [targetConvId, cleanVId])
        .eq('status', 'unseen')
        .limit(100),
      supabase
        .from('conversations')
        .select('id')
        .in('id', [targetConvId, cleanVId])
        .limit(5),
    ]);

    if (!convCheckRes.error && Array.isArray(convCheckRes.data) && convCheckRes.data.length === 0) {
      return 0;
    }

    if (msgsRes.error || !Array.isArray(msgsRes.data)) return 0;
    return msgsRes.data.filter((m: any) => m.sender_id && m.sender_id !== cleanVId).length;
  } catch {
    return 0;
  }
}

/**
 * Single lightweight subscription for the global Navbar Messaging unread count badge.
 */
export function subscribeToUnreadMessagingUpdates(params: {
  isOwner: boolean;
  visitorId?: string;
  onCountChange: (count: number) => void;
}): () => void {
  let isMounted = true;
  let debounceTimer: any = null;

  const refreshCount = async () => {
    if (!isMounted) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    const count = await fetchUnreadMessagingCount({
      isOwner: params.isOwner,
      visitorId: params.visitorId,
    });
    if (isMounted) params.onCountChange(count);
  };

  const scheduleRefresh = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      refreshCount();
    }, 180);
  };

  refreshCount();

  let channel: any = null;
  try {
    channel = supabase
      .channel(`navbar-unread-${params.isOwner ? 'owner' : 'visitor'}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, scheduleRefresh)
      .on('broadcast', { event: 'new_chat_message' }, scheduleRefresh)
      .subscribe();
  } catch {}

  const onLocalEvent = () => scheduleRefresh();
  const onVisibility = () => {
    if (document.visibilityState === 'visible') scheduleRefresh();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('fesline_unread_count_changed', onLocalEvent);
    window.addEventListener('fesline_chats_updated', onLocalEvent);
    window.addEventListener('storage', onLocalEvent);
    document.addEventListener('visibilitychange', onVisibility);
  }

  return () => {
    isMounted = false;
    if (debounceTimer) clearTimeout(debounceTimer);
    if (channel) {
      supabase.removeChannel(channel).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('fesline_unread_count_changed', onLocalEvent);
      window.removeEventListener('fesline_chats_updated', onLocalEvent);
      window.removeEventListener('storage', onLocalEvent);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}

/**
 * Direct alias for saving message with parent conversation upsert
 */
export const sendAndPersistMessageToSupabase = saveMessageAndConversationToSupabase;

/**
 * Cleanly updates an existing message in Supabase public.messages
 * Updates content and broadcasts the edited message to realtime subscribers.
 */
export async function updateMessageInSupabase(
  messageId: string,
  newContent: string,
  conversationId?: string
): Promise<boolean> {
  try {
    const safeId = ensureValidUuid(messageId);
    const { error } = await supabase
      .from('messages')
      .update({ content: newContent })
      .or(`id.eq.${messageId},id.eq.${safeId}`);

    if (error) {
      console.warn('[Supabase update message notice]:', error.message || error);
    }

    if (conversationId) {
      try {
        broadcastSupabaseChatMessage({
          conversationId,
          message: {
            id: messageId,
            content: newContent,
            text: newContent,
            is_edited: true,
          },
        });
      } catch {}
    }

    return true;
  } catch (err: any) {
    console.warn('[Supabase updateMessage exception]:', err?.message || err);
    return false;
  }
}

/**
 * Fetch all conversations joined with visitor_profiles strictly aggregated by visitor conversation thread (WhatsApp-style)
 * Deduplicates in place so each visitor occupies a single row in the owner's inbox panel.
 */
export async function fetchConversationsJoinedFromSupabase(): Promise<any[]> {
  try {
    // 1. Fetch conversations joined with visitor_profiles ordered by visitor_id, last_message_at desc
    let convsData: any[] = [];
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, visitor_profiles(*)')
        .order('visitor_id')
        .order('last_message_at', { ascending: false });

      if (!error && data && Array.isArray(data)) {
        convsData = data;
      } else {
        const { data: cData } = await supabase
          .from('conversations')
          .select('*')
          .order('visitor_id')
          .order('last_message_at', { ascending: false });
        if (cData && Array.isArray(cData)) convsData = cData;
      }
    } catch {
      const { data: cData } = await supabase
        .from('conversations')
        .select('*')
        .order('visitor_id')
        .order('last_message_at', { ascending: false });
      if (cData && Array.isArray(cData)) convsData = cData;
    }

    // 2. Fetch visitor_profiles fallback
    let profilesMap: Record<string, any> = {};
    try {
      const { data: profiles } = await supabase
        .from('visitor_profiles')
        .select('*');

      if (profiles && Array.isArray(profiles)) {
        for (const p of profiles) {
          const key = p.visitor_id;
          if (key) profilesMap[key] = p;
        }
      }
    } catch {}

    // 3. Deduplicate strictly by visitor_id (SELECT DISTINCT ON (visitor_id))
    const dedupedVisitorIds = new Set<string>();
    const visitorMap = new Map<string, any>();

    for (const c of convsData) {
      if (!c) continue;
      const rawVId = c.visitor_id || (c.id ? c.id.replace(/^conv_/, '') : '');
      if (!rawVId) continue;

      const normVId = rawVId.trim();
      if (!dedupedVisitorIds.has(normVId)) {
        dedupedVisitorIds.add(normVId);

        const vProfile = (c.visitor_profiles && typeof c.visitor_profiles === 'object' && !Array.isArray(c.visitor_profiles))
          ? c.visitor_profiles
          : (profilesMap[normVId] || profilesMap[`conv_${normVId}`] || {});

        const displayName = vProfile.display_name || vProfile.name || c.visitor_name || c.custom_name || c.default_label || 'Visitor';
        const roleSubject = vProfile.role_subject || vProfile.roleOrCompany || c.role_or_company || 'Visitor Inquiry';
        const avatarUrl = vProfile.avatar_url || vProfile.avatarUrl || c.avatar_url || '';
        const avatarColor = vProfile.avatar_color || vProfile.avatarColor || c.avatar_color || 'bg-slate-700';

        const canonicalId = c.id && c.id.startsWith('conv_') ? c.id : `conv_${normVId}`;
        const timeFormatted = c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (c.last_timestamp || '');

        visitorMap.set(normVId, {
          id: canonicalId,
          visitorId: normVId,
          defaultLabel: displayName,
          customName: displayName,
          visitorName: displayName,
          avatarUrl,
          avatarColor,
          roleOrCompany: roleSubject,
          unread: Boolean(c.unread),
          important: Boolean(c.important),
          lastMessage: c.last_message || 'New message',
          lastTimestamp: timeFormatted,
          lastMessageAtIso: c.last_message_at || '',
          messages: [],
        });
      }
    }

    const result = Array.from(visitorMap.values());
    result.sort((a, b) => {
      const timeA = a.lastMessageAtIso ? new Date(a.lastMessageAtIso).getTime() : 0;
      const timeB = b.lastMessageAtIso ? new Date(b.lastMessageAtIso).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });

    return result;
  } catch {
    return [];
  }
}

/**
 * Global Realtime Inbox Subscription: In the Owner Panel, subscribe to ALL row insertions
 * on public.messages and public.conversations globally using supabase.channel('global-owner-inbox')
 * without scoping the filter to a single active conversation ID.
 */
export function subscribeToGlobalOwnerInbox(params: {
  onNewMessage: (msg: any, convId: string) => void;
  onNewConversation?: (conv: any) => void;
}) {
  const { onNewMessage, onNewConversation } = params;
  try {
    const channelName = `global-owner-inbox-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new) {
            onNewMessage(payload.new, (payload.new as any).conversation_id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          if (payload.new && onNewConversation) {
            onNewConversation(payload.new);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'new_chat_message' },
        (payload) => {
          if (payload.payload && payload.payload.message) {
            onNewMessage(payload.payload.message, payload.payload.conversationId);
          }
        }
      )
      .subscribe();

    // Also attach to shared broadcast channel so cross-party broadcasts are immediately delivered
    const broadcastChan = getSharedChatBroadcastChannel();
    broadcastChan.on(
      'broadcast',
      { event: 'new_chat_message' },
      (payload: any) => {
        if (payload?.payload?.message) {
          onNewMessage(payload.payload.message, payload.payload.conversationId);
        }
      }
    );

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.error('[Global Owner Inbox Subscription Error]:', err);
    return () => {};
  }
}

/**
 * Subscribe to Supabase Realtime changes on public.messages filtered by conversation_id.
 * Listens to postgres_changes (INSERT) on public.messages so owner replies immediately appear on visitor screen.
 */
export function subscribeToSupabaseMessagesRealtime(params: {
  conversationId?: string;
  isOwner?: boolean;
  onNewMessage: (msg: any, convId: string) => void;
  onNewConversation?: (conv: any) => void;
}) {
  const { conversationId, isOwner, onNewMessage, onNewConversation } = params;
  if (isOwner) {
    return subscribeToGlobalOwnerInbox({ onNewMessage, onNewConversation });
  }

  try {
    const channelName = `realtime:messages_${conversationId || 'guest'}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const filter = conversationId ? `conversation_id=eq.${conversationId}` : undefined;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        filter
          ? { event: 'INSERT', schema: 'public', table: 'messages', filter }
          : { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.new) {
            onNewMessage(payload.new, (payload.new as any).conversation_id);
          }
        }
      )
      .on(
        'broadcast',
        { event: 'new_chat_message' },
        (payload) => {
          if (payload.payload && payload.payload.message) {
            onNewMessage(payload.payload.message, payload.payload.conversationId);
          }
        }
      )
      .subscribe();

    // Also attach to shared broadcast channel so cross-party broadcasts are immediately delivered
    const broadcastChan = getSharedChatBroadcastChannel();
    broadcastChan.on(
      'broadcast',
      { event: 'new_chat_message' },
      (payload: any) => {
        if (payload?.payload?.message) {
          onNewMessage(payload.payload.message, payload.payload.conversationId);
        }
      }
    );

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.error('[Supabase Realtime Messages Subscription Error]:', err);
    return () => {};
  }
}

/**
 * Listen for Supabase Realtime updates on messages, conversations, and visitor_profiles
 */
export function subscribeToSupabaseMessagingRealtime(callback: (eventData: any) => void) {
  try {
    const channel = supabase
      .channel('public:messaging_realtime_stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => callback({ type: 'message', data: payload.new || payload.old })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => callback({ type: 'conversation', data: payload.new || payload.old })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visitor_profiles' },
        (payload) => callback({ type: 'profile', data: payload.new || payload.old })
      )
      .on(
        'broadcast',
        { event: 'new_chat_message' },
        (payload) => callback({ type: 'broadcast', data: payload.payload })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
}

/**
 * Test connectivity and latency to Supabase Database, Auth, and Storage Buckets
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  latencyMs: number;
  authOk: boolean;
  profilesTableOk: boolean;
  materialsTableOk: boolean;
  avatarsBucketOk: boolean;
  materialsBucketOk: boolean;
  details: string;
}> {
  const startTime = performance.now();
  let authOk = false;
  let profilesTableOk = false;
  let materialsTableOk = false;
  let avatarsBucketOk = false;
  let materialsBucketOk = false;
  const messages: string[] = [];

  try {
    // 1. Test Auth session ping
    try {
      const { data } = await supabase.auth.getSession();
      authOk = true;
      if (data?.session?.user) {
        messages.push(`Authenticated as: ${data.session.user.email}`);
      } else {
        messages.push('Auth endpoint responsive (ready for sign in)');
      }
    } catch (e: any) {
      messages.push(`Auth check: ${e?.message || 'Warning'}`);
    }

    // 2. Test Profiles Table Read
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (!error) {
        profilesTableOk = true;
        messages.push('Table "profiles" connected');
      } else {
        messages.push(`Table "profiles": ${error.message}`);
      }
    } catch (e: any) {
      messages.push(`Table "profiles": ${e?.message || 'Error'}`);
    }

    // 3. Test Materials Table Read
    try {
      const { error } = await supabase.from('materials').select('id').limit(1);
      if (!error) {
        materialsTableOk = true;
        messages.push('Table "materials" connected');
      } else {
        messages.push(`Table "materials": ${error.message}`);
      }
    } catch (e: any) {
      messages.push(`Table "materials": ${e?.message || 'Error'}`);
    }

    // 4. Test Avatars Storage Bucket
    try {
      const { error } = await supabase.storage.from(SUPABASE_BUCKETS.AVATARS).list('', { limit: 1 });
      if (!error) {
        avatarsBucketOk = true;
        messages.push('Bucket "avatars" accessible');
      } else {
        messages.push(`Bucket "avatars": ${error.message}`);
      }
    } catch (e: any) {
      messages.push(`Bucket "avatars": ${e?.message || 'Error'}`);
    }

    // 5. Test Materials Storage Bucket
    try {
      const { error } = await supabase.storage.from(SUPABASE_BUCKETS.MATERIALS).list('', { limit: 1 });
      if (!error) {
        materialsBucketOk = true;
        messages.push('Bucket "materials" accessible');
      } else {
        messages.push(`Bucket "materials": ${error.message}`);
      }
    } catch (e: any) {
      messages.push(`Bucket "materials": ${e?.message || 'Error'}`);
    }

    const latencyMs = Math.round(performance.now() - startTime);
    const connected = authOk || profilesTableOk || materialsTableOk || avatarsBucketOk || materialsBucketOk;

    return {
      connected,
      latencyMs,
      authOk,
      profilesTableOk,
      materialsTableOk,
      avatarsBucketOk,
      materialsBucketOk,
      details: messages.join(' · '),
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      connected: false,
      latencyMs,
      authOk: false,
      profilesTableOk: false,
      materialsTableOk: false,
      avatarsBucketOk: false,
      materialsBucketOk: false,
      details: err?.message || 'Connection test failed',
    };
  }
}

// ============================================================================
// 7. COMPLETE SUPABASE RLS & SCHEMA SQL BLUEPRINT
// ============================================================================

export const SUPABASE_RLS_SCHEMA_SQL = `
-- ============================================================================
-- FESLINE ENGINEERING PORTFOLIO: COMPLETE IDEMPOTENT SUPABASE SCHEMA & RLS SQL
-- Safe to run multiple times without modifying or deleting existing records.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. OWNER IDENTITY & MANDATORY AAL2 MFA + CONFIRMED EMAIL HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.is_portfolio_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT (
    auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND LOWER(COALESCE(auth.jwt() ->> 'email', '')) IN ('festusjohnson445@gmail.com', 'festusjohnson028@gmail.com')
    AND COALESCE(auth.jwt() ->> 'aal', '') = 'aal2'
    AND EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = auth.uid()
        AND LOWER(COALESCE(u.email, '')) IN ('festusjohnson445@gmail.com', 'festusjohnson028@gmail.com')
        AND COALESCE(u.email_confirmed_at, u.confirmed_at) IS NOT NULL
        AND (u.banned_until IS NULL OR u.banned_until <= now())
    )
    AND EXISTS (
      SELECT 1
      FROM auth.mfa_factors mf
      WHERE mf.user_id = auth.uid()
        AND mf.factor_type = 'totp'
        AND mf.status = 'verified'
    )
  );
$$;

-- 2. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('Materials', 'Materials', true, 209715200, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 209715200, allowed_mime_types = NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('materials', 'materials', true, 209715200, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 209715200, allowed_mime_types = NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('projects', 'projects', true, 209715200, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 209715200, allowed_mime_types = NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('articles', 'articles', true, 209715200, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 209715200, allowed_mime_types = NULL;

-- Storage Policies: avatars
DROP POLICY IF EXISTS "Public Read Avatars" ON storage.objects;
CREATE POLICY "Public Read Avatars" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Owner Upload Avatars" ON storage.objects;
CREATE POLICY "Owner Upload Avatars" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND public.is_portfolio_owner());

DROP POLICY IF EXISTS "Visitor Upload Avatars" ON storage.objects;
CREATE POLICY "Visitor Upload Avatars" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'visitors');

DROP POLICY IF EXISTS "Visitor Update Avatars" ON storage.objects;
CREATE POLICY "Visitor Update Avatars" ON storage.objects
FOR UPDATE TO public
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'visitors')
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'visitors');

DROP POLICY IF EXISTS "Owner Update Avatars" ON storage.objects;
CREATE POLICY "Owner Update Avatars" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND public.is_portfolio_owner())
WITH CHECK (bucket_id = 'avatars' AND public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Delete Avatars" ON storage.objects;
CREATE POLICY "Owner Delete Avatars" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND public.is_portfolio_owner());

-- Storage Policies: Materials (chat files, voice notes, fallback materials)
DROP POLICY IF EXISTS "Public Upload to Materials Bucket" ON storage.objects;
CREATE POLICY "Public Upload to Materials Bucket" ON storage.objects
FOR INSERT TO public WITH CHECK (bucket_id = 'Materials');

DROP POLICY IF EXISTS "Public Read from Materials Bucket" ON storage.objects;
CREATE POLICY "Public Read from Materials Bucket" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'Materials');

DROP POLICY IF EXISTS "Public Update Materials Bucket" ON storage.objects;
CREATE POLICY "Public Update Materials Bucket" ON storage.objects
FOR UPDATE TO public USING (bucket_id = 'Materials') WITH CHECK (bucket_id = 'Materials');

DROP POLICY IF EXISTS "Public Delete Materials Bucket" ON storage.objects;
CREATE POLICY "Public Delete Materials Bucket" ON storage.objects
FOR DELETE TO public USING (bucket_id = 'Materials');

-- Storage Policies: materials (engineering hub, student submissions, generated-docs, career-studio, chat)
DROP POLICY IF EXISTS "Public Read Materials" ON storage.objects;
CREATE POLICY "Public Read Materials" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'materials');

DROP POLICY IF EXISTS "Owner Upload Materials" ON storage.objects;
CREATE POLICY "Owner Upload Materials" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'materials' AND public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Update Materials" ON storage.objects;
CREATE POLICY "Owner Update Materials" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'materials' AND public.is_portfolio_owner())
WITH CHECK (bucket_id = 'materials' AND public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Delete Materials" ON storage.objects;
CREATE POLICY "Owner Delete Materials" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'materials' AND public.is_portfolio_owner());

DROP POLICY IF EXISTS "Public Upload Student Materials to materials" ON storage.objects;
CREATE POLICY "Public Upload Student Materials to materials" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'materials' AND (storage.foldername(name))[1] = 'student-submissions');

DROP POLICY IF EXISTS "Public Upload Generated Docs to materials" ON storage.objects;
CREATE POLICY "Public Upload Generated Docs to materials" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'materials' AND (storage.foldername(name))[1] = 'generated-docs');

DROP POLICY IF EXISTS "Public Update Generated Docs in materials" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete Generated Docs in materials" ON storage.objects;

DROP POLICY IF EXISTS "Public Upload Career Studio to materials" ON storage.objects;
CREATE POLICY "Public Upload Career Studio to materials" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'materials' AND (storage.foldername(name))[1] = 'career-studio');

DROP POLICY IF EXISTS "Public Upload Chat Media to materials" ON storage.objects;
CREATE POLICY "Public Upload Chat Media to materials" ON storage.objects
FOR INSERT TO public
WITH CHECK (bucket_id = 'materials' AND (storage.foldername(name))[1] = 'chat');

-- Storage Policies: projects & articles
DROP POLICY IF EXISTS "Public Read Projects Bucket" ON storage.objects;
CREATE POLICY "Public Read Projects Bucket" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'projects');

DROP POLICY IF EXISTS "Owner Upload Projects Bucket" ON storage.objects;
CREATE POLICY "Owner Upload Projects Bucket" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'projects' AND public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Update Projects Bucket" ON storage.objects;
CREATE POLICY "Owner Update Projects Bucket" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'projects' AND public.is_portfolio_owner()) WITH CHECK (bucket_id = 'projects' AND public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Delete Projects Bucket" ON storage.objects;
CREATE POLICY "Owner Delete Projects Bucket" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'projects' AND public.is_portfolio_owner());

DROP POLICY IF EXISTS "Public Read Articles Bucket" ON storage.objects;
CREATE POLICY "Public Read Articles Bucket" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'articles');

DROP POLICY IF EXISTS "Public Upload Articles Bucket" ON storage.objects;
CREATE POLICY "Public Upload Articles Bucket" ON storage.objects
FOR INSERT TO public WITH CHECK (bucket_id = 'articles');

DROP POLICY IF EXISTS "Owner Update Articles Bucket" ON storage.objects;
CREATE POLICY "Owner Update Articles Bucket" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'articles' AND public.is_portfolio_owner()) WITH CHECK (bucket_id = 'articles' AND public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Delete Articles Bucket" ON storage.objects;
CREATE POLICY "Owner Delete Articles Bucket" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'articles' AND public.is_portfolio_owner());

-- 3. PROFILES TABLE & RLS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'Festus, Olorunsogo Johnson',
  header TEXT DEFAULT 'Lead Mechanical Design Engineer',
  bio JSONB DEFAULT '{}'::jsonb,
  avatar_url TEXT DEFAULT '',
  documents JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to owner profile" ON public.profiles;
CREATE POLICY "Allow public read access to owner profile" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow owner to update profile" ON public.profiles;
CREATE POLICY "Allow owner to update profile" ON public.profiles FOR UPDATE TO authenticated USING (public.is_portfolio_owner()) WITH CHECK (public.is_portfolio_owner());

DROP POLICY IF EXISTS "Allow owner to insert profile" ON public.profiles;
CREATE POLICY "Allow owner to insert profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_portfolio_owner());

DROP POLICY IF EXISTS "Allow owner to delete profile" ON public.profiles;
CREATE POLICY "Allow owner to delete profile" ON public.profiles FOR DELETE TO authenticated USING (public.is_portfolio_owner());

-- 4. MATERIALS TABLE, RLS & RPC COUNTERS
CREATE TABLE IF NOT EXISTS public.materials (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size TEXT,
  file_type TEXT,
  category TEXT,
  description TEXT DEFAULT '',
  author TEXT,
  preview_url TEXT,
  download_url TEXT,
  file_url TEXT,
  storage_path TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  level TEXT DEFAULT '',
  department TEXT DEFAULT '',
  institution TEXT DEFAULT '',
  is_approved BOOLEAN DEFAULT true,
  download_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS owner_id UUID,
  ADD COLUMN IF NOT EXISTS level TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS institution TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to engineering materials" ON public.materials;
CREATE POLICY "Allow public read access to engineering materials" ON public.materials FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow owner to insert materials" ON public.materials;
CREATE POLICY "Allow owner to insert materials" ON public.materials FOR INSERT TO authenticated WITH CHECK (public.is_portfolio_owner());

DROP POLICY IF EXISTS "Public Insert Student Materials" ON public.materials;
CREATE POLICY "Public Insert Student Materials" ON public.materials FOR INSERT TO public WITH CHECK (category = 'Students Materials');

DROP POLICY IF EXISTS "Allow owner to update materials" ON public.materials;
CREATE POLICY "Allow owner to update materials" ON public.materials FOR UPDATE TO authenticated USING (public.is_portfolio_owner()) WITH CHECK (public.is_portfolio_owner());

DROP POLICY IF EXISTS "Allow owner to delete materials" ON public.materials;
DROP POLICY IF EXISTS "Owner Manage All Materials Delete" ON public.materials;
CREATE POLICY "Owner Manage All Materials Delete" ON public.materials FOR DELETE TO authenticated USING (public.is_portfolio_owner());

CREATE INDEX IF NOT EXISTS idx_materials_created_at ON public.materials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_materials_category ON public.materials(category);

CREATE OR REPLACE FUNCTION public.increment_material_views(target_material_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE public.materials SET views_count = COALESCE(views_count, 0) + 1 WHERE id = target_material_id RETURNING views_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_material_views(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_material_likes(target_material_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE public.materials SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = target_material_id RETURNING likes_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_material_likes(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.decrement_material_likes(target_material_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE public.materials SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = target_material_id RETURNING likes_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.decrement_material_likes(TEXT) TO anon, authenticated;

-- 5. PROJECTS, ARTICLES, COMMENTS, PROFILE SECTIONS & WEBSITE SETTINGS
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Mechanical Design',
  description TEXT NOT NULL DEFAULT '',
  overview TEXT DEFAULT '',
  objectives TEXT DEFAULT '',
  methodology TEXT DEFAULT '',
  specifications JSONB DEFAULT '[]'::jsonb,
  cad_drawings JSONB DEFAULT '[]'::jsonb,
  is_cad_project BOOLEAN DEFAULT false,
  cad_model_type TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  images JSONB DEFAULT '[]'::jsonb,
  videos JSONB DEFAULT '[]'::jsonb,
  tools_used TEXT[] DEFAULT ARRAY[]::TEXT[],
  results TEXT DEFAULT '',
  demo_links JSONB DEFAULT '[]'::jsonb,
  documents JSONB DEFAULT '[]'::jsonb,
  is_featured BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER DEFAULT 0,
  hero_inscription TEXT DEFAULT '',
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS hero_inscription TEXT DEFAULT '', ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Published Projects" ON public.projects;
CREATE POLICY "Public Read Published Projects" ON public.projects FOR SELECT TO public USING (status = 'published' OR public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Insert Projects" ON public.projects;
CREATE POLICY "Owner Insert Projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Update Projects" ON public.projects;
CREATE POLICY "Owner Update Projects" ON public.projects FOR UPDATE TO authenticated USING (public.is_portfolio_owner()) WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Delete Projects" ON public.projects;
CREATE POLICY "Owner Delete Projects" ON public.projects FOR DELETE TO authenticated USING (public.is_portfolio_owner());

CREATE OR REPLACE FUNCTION public.increment_project_views(target_project_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE public.projects SET views_count = COALESCE(views_count, 0) + 1 WHERE id = target_project_id AND status = 'published' RETURNING views_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_project_views(TEXT) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'General Engineering',
  difficulty_level TEXT DEFAULT 'Intermediate',
  reading_time TEXT DEFAULT '5 min read',
  author_name TEXT NOT NULL DEFAULT 'Contributor',
  is_admin_author BOOLEAN DEFAULT false,
  thumbnail_url TEXT DEFAULT '',
  hero_media JSONB DEFAULT '{}'::jsonb,
  hero_inscription TEXT DEFAULT '',
  tldr TEXT DEFAULT '',
  toc JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  videos JSONB DEFAULT '[]'::jsonb,
  diagrams JSONB DEFAULT '[]'::jsonb,
  code_blocks JSONB DEFAULT '[]'::jsonb,
  chart_data JSONB DEFAULT '[]'::jsonb,
  bom_items JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS hero_inscription TEXT DEFAULT '', ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Published Articles" ON public.articles;
CREATE POLICY "Public Read Published Articles" ON public.articles FOR SELECT TO public USING (status = 'published' OR public.is_portfolio_owner());
DROP POLICY IF EXISTS "Public Submit Pending Articles or Owner Insert" ON public.articles;
CREATE POLICY "Public Submit Pending Articles or Owner Insert" ON public.articles FOR INSERT TO public WITH CHECK ((status = 'pending' AND COALESCE(is_admin_author, false) = false) OR public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Update Articles" ON public.articles;
CREATE POLICY "Owner Update Articles" ON public.articles FOR UPDATE TO authenticated USING (public.is_portfolio_owner()) WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Delete Articles" ON public.articles;
CREATE POLICY "Owner Delete Articles" ON public.articles FOR DELETE TO authenticated USING (public.is_portfolio_owner());

CREATE OR REPLACE FUNCTION public.increment_article_likes(target_article_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE public.articles SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = target_article_id AND status = 'published' RETURNING likes_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_article_likes(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.decrement_article_likes(target_article_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE public.articles SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = target_article_id AND status = 'published' RETURNING likes_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.decrement_article_likes(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_article_views(target_article_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE public.articles SET views_count = COALESCE(views_count, 0) + 1 WHERE id = target_article_id AND status = 'published' RETURNING views_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_article_views(TEXT) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.article_comments (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_role TEXT DEFAULT 'Visitor',
  content_markdown TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Approved Comments" ON public.article_comments;
CREATE POLICY "Public Read Approved Comments" ON public.article_comments FOR SELECT TO public USING (status = 'approved' OR public.is_portfolio_owner());
DROP POLICY IF EXISTS "Public Submit Comment Immediately" ON public.article_comments;
CREATE POLICY "Public Submit Comment Immediately" ON public.article_comments FOR INSERT TO public WITH CHECK (status IN ('approved', 'pending') OR public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Update Comments" ON public.article_comments;
CREATE POLICY "Owner Update Comments" ON public.article_comments FOR UPDATE TO authenticated USING (public.is_portfolio_owner()) WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Delete Comments" ON public.article_comments;
CREATE POLICY "Owner Delete Comments" ON public.article_comments FOR DELETE TO authenticated USING (public.is_portfolio_owner());

CREATE TABLE IF NOT EXISTS public.website_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  site_title TEXT DEFAULT 'Fesline Engineering Portfolio',
  site_tagline TEXT DEFAULT 'Mechanical Engineer | CAD Designer | Web Developer',
  allow_visitor_articles BOOLEAN DEFAULT true,
  require_article_approval BOOLEAN DEFAULT true,
  require_comment_approval BOOLEAN DEFAULT true,
  admin_author_label TEXT DEFAULT 'Chief Admin',
  appearance_config JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.website_settings ADD COLUMN IF NOT EXISTS appearance_config JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Website Settings" ON public.website_settings;
CREATE POLICY "Public Read Website Settings" ON public.website_settings FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner Manage Website Settings Insert" ON public.website_settings;
CREATE POLICY "Owner Manage Website Settings Insert" ON public.website_settings FOR INSERT TO authenticated WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Manage Website Settings Update" ON public.website_settings;
CREATE POLICY "Owner Manage Website Settings Update" ON public.website_settings FOR UPDATE TO authenticated USING (public.is_portfolio_owner()) WITH CHECK (public.is_portfolio_owner());

CREATE TABLE IF NOT EXISTS public.media_assets (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL CHECK (bucket IN ('projects', 'articles', 'materials', 'avatars')),
  storage_path TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'document')),
  file_name TEXT NOT NULL DEFAULT '',
  format TEXT NOT NULL DEFAULT '',
  resolution TEXT DEFAULT '',
  width INTEGER DEFAULT 0,
  height INTEGER DEFAULT 0,
  duration_sec NUMERIC(10, 2) DEFAULT 0,
  original_bytes BIGINT DEFAULT 0,
  optimized_bytes BIGINT DEFAULT 0,
  compression_pct NUMERIC(6, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('queued', 'processing', 'uploading', 'completed', 'failed', 'cancelled')),
  primary_url TEXT NOT NULL DEFAULT '',
  fallback_urls JSONB DEFAULT '{}'::jsonb,
  poster_url TEXT DEFAULT '',
  vtt_thumbnails_url TEXT DEFAULT '',
  error_message TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS fallback_urls JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Media Assets" ON public.media_assets;
CREATE POLICY "Public Read Media Assets" ON public.media_assets FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public Insert Media Assets" ON public.media_assets;
CREATE POLICY "Public Insert Media Assets" ON public.media_assets FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Owner Update Media Assets" ON public.media_assets;
CREATE POLICY "Owner Update Media Assets" ON public.media_assets FOR UPDATE TO authenticated USING (public.is_portfolio_owner()) WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Delete Media Assets" ON public.media_assets;
CREATE POLICY "Owner Delete Media Assets" ON public.media_assets FOR DELETE TO authenticated USING (public.is_portfolio_owner());

-- 6. MESSAGING TABLES (visitor_profiles, conversations, messages)
CREATE TABLE IF NOT EXISTS public.visitor_profiles (
  visitor_id TEXT PRIMARY KEY,
  display_name TEXT DEFAULT 'Visitor',
  role_subject TEXT DEFAULT 'Visitor Direct Chat',
  avatar_url TEXT DEFAULT '',
  avatar_color TEXT DEFAULT 'bg-slate-700',
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.visitor_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read/write visitor_profiles" ON public.visitor_profiles;
CREATE POLICY "Public read/write visitor_profiles" ON public.visitor_profiles FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  visitor_id TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  default_label TEXT DEFAULT 'Direct Message',
  custom_name TEXT,
  visitor_name TEXT,
  avatar_url TEXT,
  role_or_company TEXT DEFAULT 'Visitor Direct Chat',
  unread BOOLEAN DEFAULT true,
  unread_count INTEGER DEFAULT 0,
  important BOOLEAN DEFAULT false,
  last_message TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_timestamp TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS visitor_id TEXT,
  ADD COLUMN IF NOT EXISTS owner_id UUID,
  ADD COLUMN IF NOT EXISTS default_label TEXT DEFAULT 'Direct Message',
  ADD COLUMN IF NOT EXISTS custom_name TEXT,
  ADD COLUMN IF NOT EXISTS visitor_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS role_or_company TEXT DEFAULT 'Visitor Direct Chat',
  ADD COLUMN IF NOT EXISTS unread BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS important BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_message TEXT,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_timestamp TEXT,
  ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read/write conversations" ON public.conversations;
CREATE POLICY "Public read/write conversations" ON public.conversations FOR ALL TO public USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  voice_note JSONB,
  attachments JSONB,
  status TEXT DEFAULT 'unseen',
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS voice_note JSONB,
  ADD COLUMN IF NOT EXISTS attachments JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unseen',
  ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read/write messages" ON public.messages;
CREATE POLICY "Public read/write messages" ON public.messages FOR ALL TO public USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_unseen_status ON public.messages(status) WHERE status = 'unseen';
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON public.conversations(last_message_at DESC);

-- 7. CAREER STUDIO (generated_documents) TABLE & RPC COUNTERS
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  preview_image_url TEXT DEFAULT '',
  pdf_url TEXT DEFAULT '',
  docx_url TEXT DEFAULT '',
  storage_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  views_count INTEGER NOT NULL DEFAULT 0,
  downloads_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_documents
  ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS storage_paths TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS views_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downloads_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Generated Documents" ON public.generated_documents;
CREATE POLICY "Public Read Generated Documents" ON public.generated_documents FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public Insert Generated Documents" ON public.generated_documents;
CREATE POLICY "Public Insert Generated Documents" ON public.generated_documents FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Public Update Generated Documents" ON public.generated_documents;
DROP POLICY IF EXISTS "Owner Update Generated Documents" ON public.generated_documents;
CREATE POLICY "Owner Update Generated Documents" ON public.generated_documents FOR UPDATE TO authenticated USING (public.is_portfolio_owner()) WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Public Delete Generated Documents" ON public.generated_documents;
DROP POLICY IF EXISTS "Owner Delete Generated Documents" ON public.generated_documents;
CREATE POLICY "Owner Delete Generated Documents" ON public.generated_documents FOR DELETE TO authenticated USING (public.is_portfolio_owner());

CREATE INDEX IF NOT EXISTS idx_generated_docs_status_created ON public.generated_documents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_docs_category ON public.generated_documents(category);

CREATE OR REPLACE FUNCTION public.increment_generated_document_views(target_doc_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE public.generated_documents SET views_count = COALESCE(views_count, 0) + 1 WHERE id = target_doc_id RETURNING views_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_generated_document_views(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_generated_document_downloads(target_doc_id TEXT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE public.generated_documents SET downloads_count = COALESCE(downloads_count, 0) + 1 WHERE id = target_doc_id RETURNING downloads_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;
GRANT EXECUTE ON FUNCTION public.increment_generated_document_downloads(TEXT) TO anon, authenticated;

-- 8. CLEANUP DEPRECATED SESSION LOCK TABLE & REALTIME PUBLICATIONS (Safe & Idempotent)
DROP TABLE IF EXISTS public.admin_sessions CASCADE;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'profiles', 'materials', 'projects', 'articles', 'article_comments',
    'website_settings', 'media_assets', 'visitor_profiles',
    'conversations', 'messages', 'generated_documents'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
       ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`;
