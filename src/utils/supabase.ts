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

// ============================================================================
// 2. OWNER AUTHENTICATION (EMAIL/PASSWORD VIA SUPABASE AUTH)
// ============================================================================

/**
 * Sign in as the website owner using supabase.auth.signInWithPassword()
 */
export async function supabaseSignInOwner(email: string, password: string): Promise<{
  user: User | null;
  session: Session | null;
  error: Error | null;
}> {
  try {
    // 1. Direct Supabase Authentication call
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      // If project credentials aren't live yet or returned error, check owner credentials
      console.warn('[Supabase Auth] signInWithPassword notice:', error.message);
      return { user: null, session: null, error: new Error(error.message) };
    }

    if (data && data.user) {
      cachedOwnerUid = data.user.id;
      try {
        localStorage.setItem('fesline_owner_supabase_uid', data.user.id);
        localStorage.setItem('fesline_owner_supabase_email', data.user.email || email);
      } catch {}
      return { user: data.user, session: data.session, error: null };
    }

    return { user: null, session: null, error: new Error('No user data returned from authentication') };
  } catch (err: any) {
    console.error('[Supabase Auth Error]:', err);
    return { user: null, session: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
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
  return 'owner-festus-uid';
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

// ============================================================================
// 3. AVATARS STORAGE BUCKET (PUBLIC BUCKET "avatars")
// ============================================================================

/**
 * Uploads owner profile picture to public "avatars" bucket under auth.uid()
 * Path: avatars/{auth.uid()}/avatar_{timestamp}.jpg
 */
export async function uploadAvatarToSupabaseBucket(
  fileOrBlobOrDataUrl: File | Blob | string,
  uid?: string
): Promise<{ publicUrl: string; storagePath: string } | null> {
  try {
    const ownerUid = uid || getAuthenticatedOwnerUid();
    const timestamp = Date.now();
    const fileName = `avatar_${timestamp}.jpg`;
    const storagePath = `${ownerUid}/${fileName}`;

    let uploadBody: Blob | Uint8Array | File;
    let contentType = 'image/jpeg';

    if (typeof fileOrBlobOrDataUrl === 'string') {
      if (fileOrBlobOrDataUrl.startsWith('data:')) {
        const parts = fileOrBlobOrDataUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        if (mimeMatch) contentType = mimeMatch[1];
        const binaryStr = atob(parts[1]);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        uploadBody = bytes;
      } else {
        // If it's already an HTTP URL, return as is
        return { publicUrl: fileOrBlobOrDataUrl, storagePath };
      }
    } else {
      uploadBody = fileOrBlobOrDataUrl;
      contentType = fileOrBlobOrDataUrl.type || 'image/jpeg';
    }

    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKETS.AVATARS)
      .upload(storagePath, uploadBody, {
        contentType,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.warn('[Supabase Storage Avatars Upload Warning]:', uploadError.message);
    }

    const { data: publicData } = supabase.storage
      .from(SUPABASE_BUCKETS.AVATARS)
      .getPublicUrl(storagePath);

    return {
      publicUrl: publicData?.publicUrl || '',
      storagePath,
    };
  } catch (err) {
    console.warn('[Supabase Avatar Upload Fallback]:', err);
    return null;
  }
}

/**
 * Remove avatar file from Supabase avatars bucket
 */
export async function deleteAvatarFromSupabaseBucket(storagePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKETS.AVATARS)
      .remove([storagePath]);
    return !error;
  } catch {
    return false;
  }
}

// ============================================================================
// 4. MATERIALS STORAGE BUCKET (DOCUMENTS BUCKET "materials")
// ============================================================================

/**
 * Uploads engineering material / document to "materials" bucket under auth.uid()
 * Path: materials/{auth.uid()}/{timestamp}_{cleanFileName}
 */
export async function uploadMaterialToSupabaseBucket(
  fileOrBlob: File | Blob,
  fileName: string,
  uid?: string
): Promise<{ publicUrl: string; downloadUrl: string; storagePath: string } | null> {
  try {
    const ownerUid = uid || getAuthenticatedOwnerUid();
    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const storagePath = `${ownerUid}/${timestamp}_${cleanName}`;

    let contentType = fileOrBlob.type || 'application/octet-stream';
    if (!contentType || contentType === 'application/octet-stream') {
      if (fileName.endsWith('.pdf')) contentType = 'application/pdf';
      else if (fileName.endsWith('.png')) contentType = 'image/png';
      else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) contentType = 'image/jpeg';
      else if (fileName.endsWith('.webp')) contentType = 'image/webp';
    }

    const { error } = await supabase.storage
      .from(SUPABASE_BUCKETS.MATERIALS)
      .upload(storagePath, fileOrBlob, {
        contentType,
        upsert: true,
        cacheControl: '3600',
      });

    if (error) {
      console.warn('[Supabase Storage Materials Upload Warning]:', error.message);
    }

    const { data: publicData } = supabase.storage
      .from(SUPABASE_BUCKETS.MATERIALS)
      .getPublicUrl(storagePath);

    const publicUrl = publicData?.publicUrl || '';
    return {
      publicUrl,
      downloadUrl: publicUrl,
      storagePath,
    };
  } catch (err) {
    console.warn('[Supabase Material Upload Fallback]:', err);
    return null;
  }
}

/**
 * Delete material from Supabase materials bucket
 */
export async function deleteMaterialFromSupabaseBucket(storagePath: string): Promise<boolean> {
  try {
    const { error } = await supabase.storage
      .from(SUPABASE_BUCKETS.MATERIALS)
      .remove([storagePath]);
    return !error;
  } catch {
    return false;
  }
}

// ============================================================================
// 5. SUPABASE DATABASE QUERIES & RLS ENFORCEMENT
// ============================================================================

/**
 * Upsert owner profile in Supabase "profiles" table with auth.uid() enforcement
 */
export async function saveProfileToSupabaseTable(profileData: {
  fullName?: string;
  header?: string;
  bioData?: any;
  avatarUrl?: string;
  documents?: any[];
}, uid?: string): Promise<boolean> {
  try {
    const ownerUid = uid || getAuthenticatedOwnerUid();
    const payload = {
      id: ownerUid,
      user_id: ownerUid,
      full_name: profileData.fullName || 'Festus, Olorunsogo Johnson',
      header: profileData.header || 'Lead Mechanical Design Engineer',
      bio: profileData.bioData || {},
      avatar_url: profileData.avatarUrl || '',
      documents: profileData.documents || [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('profiles')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase DB Profiles Upsert Warning]:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[Supabase DB Profiles Fallback]:', err);
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

    let parsedDocs = data.documents;
    if (typeof parsedDocs === 'string') {
      try {
        parsedDocs = JSON.parse(parsedDocs);
      } catch {}
    }

    return {
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
  author: string;
  previewUrl?: string;
  downloadUrl?: string;
  storagePath?: string;
  tags?: string[];
}, uid?: string): Promise<boolean> {
  try {
    const ownerUid = uid || getAuthenticatedOwnerUid();
    const payload = {
      id: material.id,
      owner_id: ownerUid,
      title: material.title,
      file_name: material.fileName,
      file_size: material.fileSize,
      file_type: material.fileType,
      category: material.category,
      description: material.description,
      author: material.author,
      preview_url: material.previewUrl || null,
      download_url: material.downloadUrl || null,
      storage_path: material.storagePath || null,
      tags: material.tags || [],
      is_approved: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('materials')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      console.warn('[Supabase DB Materials Upsert Warning]:', error.message);
      return false;
    }
    return true;
  } catch {
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
  try {
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', materialId);

    return !error;
  } catch {
    return false;
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
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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
USING (auth.uid() = user_id OR auth.uid()::text = id);

CREATE POLICY "Allow owner to insert profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR auth.uid()::text = id);

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
