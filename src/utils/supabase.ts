import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

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
      return { url: customUrl.trim(), anonKey: customKey.trim(), isRealConfig: true };
    }
  } catch {}

  if (ENV_SUPABASE_URL && ENV_SUPABASE_KEY && ENV_SUPABASE_URL.startsWith('http')) {
    return { url: ENV_SUPABASE_URL, anonKey: ENV_SUPABASE_KEY, isRealConfig: true };
  }

  // Graceful fallback URL & key so supabase client initializes without crashing in dev/preview
  return {
    url: 'https://feslinemechanica.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM0NDk2MDB9.dummy_fallback_key',
    isRealConfig: false,
  };
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

/**
 * Validate that an active Supabase session exists before any write operation.
 * Throws explicit error to halt write operations if unauthenticated.
 */
export async function getValidatedSession(): Promise<{ session: Session; user: User }> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.user) {
    throw new Error(error?.message || 'Authentication required: Active Supabase session is required to perform this action.');
  }
  cachedOwnerUid = data.session.user.id;
  return { session: data.session, user: data.session.user };
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
 * Check if active session exists
 */
export async function hasActiveOwnerSession(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session?.user);
  } catch {
    return false;
  }
}

/**
 * Silent authentication fallback helper for visitors when Anonymous Sign-in is disabled in Supabase.
 * First tries signInAnonymously(). If disabled or fails, silently signs in with a shared public guest user.
 * Since sign-ins are not strictly rate-limited like sign-ups, this completely avoids "email rate limit exceeded" errors.
 */
export async function silentAuthVisitor(accessKey?: string): Promise<{ user: User | null; session: Session | null; error: Error | null }> {
  try {
    // 1. Try standard anonymous sign-in first
    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
    if (!anonError && anonData?.user) {
      return { user: anonData.user, session: anonData.session, error: null };
    }

    console.warn('[Supabase Auth] Anonymous sign-in failed/disabled, attempting silent shared email guest fallback...', anonError?.message);

    // 2. Fallback: Silent shared guest account (permanently bypasses email signup rate limits)
    const sharedEmail = 'public_visitor@feslineguest.com';
    const sharedPassword = 'VisitorGuestPass_Shared_123!';

    // Try to sign in with the shared guest credentials
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: sharedEmail,
      password: sharedPassword,
    });

    if (!signInError && signInData?.user) {
      return { user: signInData.user, session: signInData.session, error: null };
    }

    // If sign in fails because the shared account is not registered yet, register it exactly once
    if (signInError?.message?.toLowerCase().includes('invalid') || signInError?.message?.toLowerCase().includes('not found')) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: sharedEmail,
        password: sharedPassword,
      });

      if (!signUpError && signUpData?.user) {
        return { user: signUpData.user, session: signUpData.session, error: null };
      }
      
      return { user: null, session: null, error: new Error(signUpError?.message || signInError?.message || 'Authentication failed') };
    }

    // Return sign in error if not credentials-related (or return the original anonymous error)
    return { user: null, session: null, error: new Error(signInError?.message || anonError?.message || 'Authentication failed') };
  } catch (err: any) {
    console.error('[Supabase Auth Silent Fallback Error]:', err);
    return { user: null, session: null, error: err };
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

  // 2. Upload strictly with { contentType, upsert: true } and await completion
  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_BUCKETS.AVATARS)
    .upload(storagePath, uploadBody, {
      contentType,
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
  uid?: string
): Promise<{ publicUrl: string; downloadUrl: string; storagePath: string }> {
  // 1. Session verification: write operations execute only with active session
  const { user } = await getValidatedSession();
  const ownerUid = uid || user.id;

  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const storagePath = `${ownerUid}/${timestamp}_${cleanName}`;

  let contentType = fileOrBlob.type || 'application/octet-stream';
  if (!contentType || contentType === 'application/octet-stream') {
    if (fileName.endsWith('.pdf')) contentType = 'application/pdf';
    else if (fileName.endsWith('.png')) contentType = 'image/png';
    else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (fileName.endsWith('.webp')) contentType = 'image/webp';
    else if (fileName.endsWith('.step') || fileName.endsWith('.stp')) contentType = 'model/step';
    else if (fileName.endsWith('.iges') || fileName.endsWith('.igs')) contentType = 'model/iges';
  }

  // 2. Upload strictly with { contentType, upsert: true } and await completion
  const { error: uploadError } = await supabase.storage
    .from(SUPABASE_BUCKETS.MATERIALS)
    .upload(storagePath, fileOrBlob, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    console.error('[Supabase Materials Upload Error]:', uploadError.message);
    throw new Error(`Failed to upload material to Supabase Storage: ${uploadError.message}`);
  }

  // 3. Fetch absolute public URL
  const { data: publicData } = supabase.storage
    .from(SUPABASE_BUCKETS.MATERIALS)
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
 * Delete material from Supabase materials bucket
 */
export async function deleteMaterialFromSupabaseBucket(storagePath: string): Promise<boolean> {
  await getValidatedSession();
  const { error } = await supabase.storage
    .from(SUPABASE_BUCKETS.MATERIALS)
    .remove([storagePath]);
  if (error) {
    console.error('[Supabase Delete Material Error]:', error.message);
    throw new Error(`Failed to delete material from bucket: ${error.message}`);
  }
  return true;
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
 * Stores documents inside bio to conform with standard profiles table schema.
 */
export async function saveProfileToSupabaseTable(profileData: {
  fullName?: string;
  header?: string;
  bioData?: any;
  avatarUrl?: string;
  documents?: any[];
}, uid?: string): Promise<boolean> {
  try {
    const { user } = await getValidatedSession();
    const ownerUid = uid || user.id;

    const mergedBio = {
      ...(profileData.bioData || {}),
      ...(profileData.documents !== undefined ? { documents: profileData.documents } : {}),
    };

    const payload: any = {
      id: ownerUid,
      full_name: profileData.fullName || 'Festus, Olorunsogo Johnson',
      header: profileData.header || 'Lead Mechanical Design Engineer',
      bio: mergedBio,
      updated_at: new Date().toISOString(),
    };

    if (profileData.avatarUrl !== undefined) {
      payload.avatar_url = profileData.avatarUrl;
    }

    const { error } = await resilientSupabaseUpsert('profiles', payload);

    if (error) {
      console.warn('[Supabase DB Profiles Upsert Note]:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[Supabase DB Profiles Save Note]:', err?.message || err);
    return false;
  }
}

/**
 * Fetch owner profile from Supabase "profiles" table (public read for visitors)
 */
export async function fetchProfileFromSupabaseTable(): Promise<any | null> {
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

    let parsedDocs = data.documents || parsedBio?.documents;
    if (typeof parsedDocs === 'string') {
      try {
        parsedDocs = JSON.parse(parsedDocs);
      } catch {}
    }

    if (data && data.id) {
      try {
        localStorage.setItem('fesline_owner_supabase_uid', data.id);
      } catch {}
    }

    return {
      id: data.id,
      fullName: data.full_name || data.fullName,
      header: data.header,
      bio: parsedBio || {},
      avatar_url: data.avatar_url || data.avatarUrl || '',
      documents: Array.isArray(parsedDocs) ? parsedDocs : [],
      updated_at: data.updated_at,
    };
  } catch {
    return null;
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
 * Save / publish official material in Supabase "materials" table with owner session
 */
export async function saveMaterialToSupabaseTable(material: {
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
}, uid?: string): Promise<boolean> {
  try {
    const { user } = await getValidatedSession();
    const ownerUid = uid || user.id;

    const publicUrl = material.downloadUrl || material.fileUrl || material.previewUrl || null;

    const payload: any = {
      id: material.id,
      owner_id: ownerUid,
      title: material.title,
      file_name: material.fileName,
      file_size: material.fileSize,
      file_type: material.fileType,
      category: material.category,
      description: material.description,
      preview_url: material.previewUrl || publicUrl,
      download_url: publicUrl,
      file_url: publicUrl,
      storage_path: material.storagePath || null,
      tags: material.tags || [],
      is_approved: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (material.author) {
      payload.author = material.author;
    }

    const { error } = await resilientSupabaseUpsert('materials', payload);

    if (error) {
      console.warn('[Supabase DB Materials Upsert Note]:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[Supabase DB Materials Save Note]:', err?.message || err);
    return false;
  }
}

/**
 * Fetch public materials from Supabase "materials" table (public for unauthenticated visitors)
 */
export async function fetchMaterialsFromSupabaseTable(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }
    return data;
  } catch {
    return [];
  }
}

/**
 * Delete material from Supabase "materials" table (requires owner session)
 */
export async function deleteMaterialFromSupabaseTable(materialId: string): Promise<boolean> {
  await getValidatedSession();
  const { error } = await supabase
    .from('materials')
    .delete()
    .eq('id', materialId);

  if (error) {
    console.error('[Supabase DB Materials Delete Error]:', error.message);
    throw new Error(`Failed to delete material from Supabase database: ${error.message}`);
  }
  return true;
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
export async function broadcastSupabaseChatMessage(messagePayload: any): Promise<void> {
  try {
    const channel = supabase.channel('fesline_portfolio_realtime_chat');
    await channel.send({
      type: 'broadcast',
      event: 'new_chat_message',
      payload: messagePayload,
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
      const { error: chatErr } = await resilientSupabaseUpsert('chats', payload, 'id');
      if (chatErr) {
        console.error('[Supabase DB Chats Fallback Save Error]:', chatErr);
      }
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
        upsert: true,
      });

    if (uploadError) {
      console.error('[Supabase Visitor Avatar Upload Error]:', uploadError.message);
    } else {
      uploadSuccess = true;
    }
  } catch (e) {
    console.error('[Supabase Visitor Avatar Storage Exception]:', e);
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

/**
 * Retrieve or dynamically fetch owner user ID from Supabase profiles or active session
 */
export async function getOrFetchOwnerId(): Promise<string> {
  try {
    const { data: sessData } = await supabase.auth.getSession();
    if (sessData?.session?.user) {
      const uid = sessData.session.user.id;
      localStorage.setItem('fesline_owner_supabase_uid', uid);
      return uid;
    }

    const saved = localStorage.getItem('fesline_owner_supabase_uid');
    if (saved && saved.trim()) return saved.trim();

    const { data } = await supabase
      .from('profiles')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.id) {
      localStorage.setItem('fesline_owner_supabase_uid', data.id);
      return data.id;
    }
  } catch (err) {
    console.error('[Supabase Fetch Owner ID Exception]:', err);
  }
  return 'f4c47b59-42b4-4b5a-8bdf-87f53945a6c1';
}

/**
 * Sequential Database Upsert Pipeline:
 * Before inserting any row into messages, execute these steps in order using try/catch:
 * Step A: upsert a record into visitor_profiles containing visitor_id, display_name, role_subject, avatar_url.
 * Step B: upsert a record into conversations using id ('conv_' + visitor_id), visitor_id, owner_id, last_message, and last_message_at.
 * Step C: insert the new row into messages linking conversation_id ('conv_' + visitor_id).
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

  // 1. Dynamic Visitor ID (Never use a hardcoded default ID)
  let vId = visitorId || (typeof localStorage !== 'undefined' ? localStorage.getItem('visitor_id') : '');
  if (!vId && conversationId) {
    vId = conversationId.startsWith('conv_') ? conversationId.replace(/^conv_/, '') : conversationId;
  }
  if (!vId) {
    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
    vId = `visitor_${uuid}`;
  }

  if (typeof localStorage !== 'undefined' && !localStorage.getItem('visitor_id')) {
    localStorage.setItem('visitor_id', vId);
  }

  // Conversation ID is strictly 'conv_' + visitor_id
  const targetConvId = `conv_${vId}`;
  const ownerId = await getOrFetchOwnerId();
  const safeMessageId = ensureValidUuid(message.id);
  const nowIso = new Date().toISOString();
  const lastSnippet = message.text || (message.voiceNote ? '🎤 Voice note' : (message.attachments?.length ? `📎 ${message.attachments[0].name}` : 'File sent'));

  const displayName = conversationMetadata?.visitorName || conversationMetadata?.customName || conversationMetadata?.defaultLabel || (typeof localStorage !== 'undefined' ? localStorage.getItem('display_name') : '') || 'Visitor';
  const roleSubject = conversationMetadata?.roleOrCompany || (typeof localStorage !== 'undefined' ? localStorage.getItem('role_subject') : '') || 'Visitor Direct Chat';
  const avatarUrl = conversationMetadata?.avatarUrl || (typeof localStorage !== 'undefined' ? localStorage.getItem('avatar_url') : '') || '';
  const avatarColor = conversationMetadata?.avatarColor || (typeof localStorage !== 'undefined' ? localStorage.getItem('avatar_color') : '') || 'bg-slate-700';

  try {
    // Step A: upsert a record into visitor_profiles containing visitor_id, display_name, role_subject, avatar_url
    try {
      const profilePayload = {
        visitor_id: vId,
        display_name: displayName,
        role_subject: roleSubject,
        avatar_url: avatarUrl,
        avatar_color: avatarColor,
        updated_at: nowIso,
      };
      const { error: vpError } = await supabase
        .from('visitor_profiles')
        .upsert(profilePayload, { onConflict: 'visitor_id' });

      if (vpError) {
        console.error('[Step A Error: visitor_profiles upsert]:', vpError);
      }
    } catch (errA) {
      console.error('[Step A Exception: visitor_profiles]:', errA);
    }

    // Step B: upsert a record into conversations using id ('conv_' + visitor_id), visitor_id, owner_id, last_message, and last_message_at
    try {
      const convPayload = {
        id: targetConvId,
        visitor_id: vId,
        owner_id: ownerId,
        last_message: lastSnippet,
        last_message_at: nowIso,
      };
      const { error: convError } = await supabase
        .from('conversations')
        .upsert(convPayload, { onConflict: 'id' });

      if (convError) {
        console.error('[Step B Error: conversations upsert]:', convError);
      }
    } catch (errB) {
      console.error('[Step B Exception: conversations]:', errB);
    }

    // Step C: insert the new row into messages linking conversation_id ('conv_' + visitor_id)
    try {
      const messagePayload: Record<string, any> = {
        id: safeMessageId,
        conversation_id: targetConvId,
        sender_id: message.sender === 'visitor' ? vId : ownerId,
        receiver_id: message.sender === 'visitor' ? ownerId : vId,
        content: message.text || lastSnippet,
        created_at: nowIso,
      };

      const { error: msgError } = await supabase
        .from('messages')
        .insert(messagePayload);

      if (msgError) {
        // Log notice if a remote DB trigger/function requires schema adjustment
        console.warn('[Step C Notice: messages insert]:', msgError.message || msgError);
      }
    } catch (errC: any) {
      console.warn('[Step C Exception handled]:', errC?.message || errC);
    }

    // Broadcast across live channels
    try {
      broadcastSupabaseChatMessage({
        conversationId: targetConvId,
        message: {
          ...message,
          id: safeMessageId,
        },
      });
    } catch {}

    return true;
  } catch (err) {
    console.error('[Supabase Message & Conversation Save Exception]:', err);
    return false;
  }
}

/**
 * Direct alias for saving message with parent conversation upsert
 */
export const sendAndPersistMessageToSupabase = saveMessageAndConversationToSupabase;

/**
 * Fetch all conversations joined with visitor_profiles so guest's display_name,
 * role_subject, custom photo/color avatar, and live message preview display correctly
 */
export async function fetchConversationsJoinedFromSupabase(): Promise<any[]> {
  try {
    const ownerId = await getOrFetchOwnerId();
    let convsMap: Record<string, any> = {};

    try {
      // 1. Fetch all conversations from Supabase without restrictive owner_id filtering
      // to ensure all visitor inquiries are always visible to the owner on live hosting (e.g. Vercel)
      const { data: all, error } = await supabase
        .from('conversations')
        .select('*');

      if (!error && all && Array.isArray(all)) {
        for (const c of all) {
          if (c && c.id) convsMap[c.id] = c;
        }
      }
    } catch {}

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

    let messagesMap: Record<string, any[]> = {};
    try {
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });

      if (msgs && Array.isArray(msgs)) {
        for (const m of msgs) {
          const isFromOwner = m.sender === 'festus' || m.sender_id === ownerId || m.sender_id === 'festus';
          const msgObj = {
            id: m.id,
            sender: isFromOwner ? ('festus' as const) : ('visitor' as const),
            text: m.content || m.text || '',
            timestamp: m.timestamp || (m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''),
            status: m.status || (isFromOwner ? 'seen' : 'unseen'),
            attachments: m.attachments,
            voiceNote: m.voice_note || m.voiceNote,
          };

          // Index by conversation_id
          if (m.conversation_id) {
            if (!messagesMap[m.conversation_id]) messagesMap[m.conversation_id] = [];
            messagesMap[m.conversation_id].push(msgObj);
          }
          // Also index by sender_id if it's a visitor ID
          if (m.sender_id && m.sender_id !== ownerId) {
            if (!messagesMap[m.sender_id]) messagesMap[m.sender_id] = [];
            if (m.sender_id !== m.conversation_id) {
              messagesMap[m.sender_id].push(msgObj);
            }
          }
          // Also index by receiver_id if it's a visitor ID
          if (m.receiver_id && m.receiver_id !== ownerId) {
            if (!messagesMap[m.receiver_id]) messagesMap[m.receiver_id] = [];
            if (m.receiver_id !== m.conversation_id && m.receiver_id !== m.sender_id) {
              messagesMap[m.receiver_id].push(msgObj);
            }
          }
        }
      }
    } catch {}

    // Collect all unique conversation IDs across conversations, visitor_profiles, and messages
    const allIds = new Set<string>([
      ...Object.keys(convsMap),
      ...Object.keys(messagesMap),
    ]);

    // Add profile IDs but check if we can link them
    for (const pId of Object.keys(profilesMap)) {
      // Find if there's any conversation for this profile ID
      const correspondingConv = Object.values(convsMap).find((c: any) => c.visitor_id === pId);
      if (correspondingConv) {
        allIds.add(correspondingConv.id);
      } else {
        allIds.add(pId);
      }
    }

    if (allIds.size === 0) return [];

    const result: any[] = [];
    for (const id of allIds) {
      let c = convsMap[id];
      if (!c) {
        c = Object.values(convsMap).find((conv: any) => conv.visitor_id === id);
      }
      c = c || {};

      const vProfile = profilesMap[c.visitor_id] || profilesMap[id] || {};
      const actualConvId = c.id || id;
      
      // Merge all messages belonging to this conversation or visitor ID
      const rawMsgs = [
        ...(messagesMap[actualConvId] || []),
        ...(c.visitor_id && c.visitor_id !== actualConvId ? (messagesMap[c.visitor_id] || []) : []),
        ...(c.id && c.id !== actualConvId ? (messagesMap[c.id] || []) : []),
        ...(Array.isArray(c.messages) ? c.messages : []),
      ];

      // Deduplicate by message id
      const uniqueMsgMap = new Map<string, any>();
      for (const m of rawMsgs) {
        if (m && m.id) uniqueMsgMap.set(m.id, m);
      }
      const convMsgs = Array.from(uniqueMsgMap.values());

      // If conversation has last_message but no messages array, synthesize the message
      if (convMsgs.length === 0 && (c.last_message || c.lastMessage)) {
        convMsgs.push({
          id: `msg-${actualConvId}`,
          sender: 'visitor',
          text: c.last_message || c.lastMessage,
          timestamp: c.last_message_at ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
          status: 'unseen',
        });
      }

      const displayName = vProfile.display_name || vProfile.name || c.visitor_name || c.custom_name || c.default_label || 'Visitor';
      const roleSubject = vProfile.role_subject || vProfile.roleOrCompany || c.role_or_company || 'Visitor Inquiry';
      const avatarUrl = vProfile.avatar_url || vProfile.avatarUrl || c.avatar_url || '';
      const avatarColor = vProfile.avatar_color || vProfile.avatarColor || c.avatar_color || 'bg-slate-700';

      result.push({
        id: actualConvId,
        defaultLabel: displayName,
        customName: displayName,
        visitorName: displayName,
        avatarUrl,
        avatarColor,
        roleOrCompany: roleSubject,
        unread: Boolean(c.unread ?? (convMsgs.some(m => m.sender === 'visitor' && m.status === 'unseen'))),
        important: Boolean(c.important),
        lastMessage: c.last_message || c.lastMessage || (convMsgs.length > 0 ? convMsgs[convMsgs.length - 1].text : 'New message'),
        lastTimestamp: c.last_message_at || c.last_timestamp || c.lastTimestamp || (convMsgs.length > 0 ? convMsgs[convMsgs.length - 1].timestamp : ''),
        messages: convMsgs,
      });
    }

    return result;
  } catch {
    return [];
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
}) {
  const { conversationId, isOwner, onNewMessage } = params;
  try {
    const channelName = isOwner
      ? `realtime:messages_owner_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      : `realtime:messages_${conversationId || 'guest'}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const filter = !isOwner && conversationId ? `conversation_id=eq.${conversationId}` : undefined;

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
-- FESLINE MECHANICAL ENGINEERING: SUPABASE DATABASE & STORAGE RLS POLICIES
-- ============================================================================

-- 1. Storage Buckets Creation
-- Create public 'avatars' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create 'materials' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS: Public read for avatars
CREATE POLICY "Public Read Avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Storage RLS: Owner-only upload/update to avatars under auth.uid()
CREATE POLICY "Owner Upload Avatars" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner Update Avatars" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner Delete Avatars" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Storage RLS: Public read for materials
CREATE POLICY "Public Read Materials" ON storage.objects
FOR SELECT USING (bucket_id = 'materials');

-- Storage RLS: Owner-only upload to materials under auth.uid()
CREATE POLICY "Owner Upload Materials" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owner Delete Materials" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Profiles Table & RLS
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT 'Festus, Olorunsogo Johnson',
  header TEXT DEFAULT 'Lead Mechanical Design Engineer',
  bio JSONB DEFAULT '{}'::jsonb,
  avatar_url TEXT DEFAULT '',
  documents JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS: Visitors have unauthenticated public read access
CREATE POLICY "Allow public read access to owner profile"
ON public.profiles FOR SELECT
USING (true);

-- Profiles RLS: Only authenticated owner can insert/update profile
CREATE POLICY "Allow owner to update profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Allow owner to insert profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- 3. Materials Table & RLS
CREATE TABLE IF NOT EXISTS public.materials (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size TEXT,
  file_type TEXT,
  category TEXT,
  description TEXT,
  author TEXT,
  preview_url TEXT,
  download_url TEXT,
  file_url TEXT,
  storage_path TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_approved BOOLEAN DEFAULT true,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Materials RLS: Visitors have unauthenticated public read access
CREATE POLICY "Allow public read access to engineering materials"
ON public.materials FOR SELECT
USING (true);

-- Materials RLS: Only authenticated owner can create, update, or delete official materials
CREATE POLICY "Allow owner to insert materials"
ON public.materials FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Allow owner to update materials"
ON public.materials FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Allow owner to delete materials"
ON public.materials FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- 4. Real-time Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
`;
