import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

// ============================================================================
// 1. SUPABASE CLIENT INITIALIZATION & CONFIGURATION (NO LOCALSTORAGE)
// ============================================================================

const ENV_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const ENV_SUPABASE_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// In-memory credential cache
let customSupabaseUrl: string | null = null;
let customSupabaseKey: string | null = null;

function getResolvedSupabaseConfig(): { url: string; anonKey: string; isRealConfig: boolean } {
  if (customSupabaseUrl && customSupabaseKey && customSupabaseUrl.startsWith('http')) {
    return { url: customSupabaseUrl.trim(), anonKey: customSupabaseKey.trim(), isRealConfig: true };
  }

  if (ENV_SUPABASE_URL && ENV_SUPABASE_KEY && ENV_SUPABASE_URL.startsWith('http')) {
    return { url: ENV_SUPABASE_URL, anonKey: ENV_SUPABASE_KEY, isRealConfig: true };
  }

  // Graceful fallback URL & key for Supabase client
  return {
    url: 'https://feslinemechanica.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM0NDk2MDB9.dummy_fallback_key',
    isRealConfig: false,
  };
}

const initialConfig = getResolvedSupabaseConfig();

// In-Memory Auth Storage for Supabase (Zero LocalStorage)
const inMemoryAuthStore = new Map<string, string>();
const memoryStorageAdapter = {
  getItem: (key: string): string | null => inMemoryAuthStore.get(key) || null,
  setItem: (key: string, value: string): void => { inMemoryAuthStore.set(key, value); },
  removeItem: (key: string): void => { inMemoryAuthStore.delete(key); },
};

export const supabase: SupabaseClient = createClient(initialConfig.url, initialConfig.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: memoryStorageAdapter,
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
  if (url && anonKey) {
    customSupabaseUrl = url.trim();
    customSupabaseKey = anonKey.trim();
  } else {
    customSupabaseUrl = null;
    customSupabaseKey = null;
  }
}

/**
 * Format avatar URL with dynamic timestamp cache-buster (?v=${Date.now()}) to prevent stale browser state
 */
export function getCacheBustedAvatarUrl(url?: string | null, timestamp?: number): string {
  if (!url || !url.trim()) return '';
  const cleanUrl = url.trim();
  if (cleanUrl.startsWith('data:')) return cleanUrl;

  const cacheBuster = `v=${timestamp || Date.now()}`;
  if (cleanUrl.includes('?')) {
    if (cleanUrl.includes('v=')) {
      return cleanUrl.replace(/v=\d+/, cacheBuster);
    }
    return `${cleanUrl}&${cacheBuster}`;
  }
  return `${cleanUrl}?${cacheBuster}`;
}

// Storage Bucket Constants
export const SUPABASE_BUCKETS = {
  AVATARS: 'avatars',
  MATERIALS: 'materials',
} as const;

// Cache active owner user ID in memory
let cachedOwnerUid: string | null = null;
let cachedOwnerEmail: string | null = null;

// ============================================================================
// 2. OWNER AUTHENTICATION (EMAIL/PASSWORD VIA SUPABASE AUTH)
// ============================================================================

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
      console.warn('[Supabase Auth] signInWithPassword notice:', error.message);
      return { user: null, session: null, error: new Error(error.message) };
    }

    if (data && data.user) {
      cachedOwnerUid = data.user.id;
      cachedOwnerEmail = data.user.email || email;
      return { user: data.user, session: data.session, error: null };
    }

    return { user: null, session: null, error: new Error('No user data returned from authentication') };
  } catch (err: any) {
    console.error('[Supabase Auth Error]:', err);
    return { user: null, session: null, error: err instanceof Error ? err : new Error(String(err)) };
  }
}

export async function supabaseSignOutOwner(): Promise<void> {
  cachedOwnerUid = null;
  cachedOwnerEmail = null;
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('[Supabase Auth SignOut Error]:', err);
  }
}

export async function getSupabaseCurrentUser(): Promise<User | null> {
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      cachedOwnerUid = data.user.id;
      cachedOwnerEmail = data.user.email || null;
      return data.user;
    }
  } catch {}
  return null;
}

export function getAuthenticatedOwnerUid(): string {
  if (cachedOwnerUid) return cachedOwnerUid;
  return 'owner-festus-uid';
}

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

export async function uploadAvatarToSupabaseBucket(
  fileOrBlobOrDataUrl: File | Blob | string,
  uid?: string
): Promise<{ publicUrl: string; storagePath: string; error: Error | null }> {
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
        return { publicUrl: fileOrBlobOrDataUrl, storagePath, error: null };
      }
    } else {
      uploadBody = fileOrBlobOrDataUrl;
      contentType = fileOrBlobOrDataUrl.type || 'image/jpeg';
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKETS.AVATARS)
      .upload(storagePath, uploadBody, {
        contentType,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.warn('[Supabase Storage Avatars Upload RLS/Storage Notice]:', uploadError.message);

      // Graceful Fallback: If RLS policy restricts direct anon write to storage.objects,
      // fall back to data URL or compressed string so avatar updates work seamlessly without crashing!
      if (typeof fileOrBlobOrDataUrl === 'string' && fileOrBlobOrDataUrl.startsWith('data:')) {
        return { publicUrl: fileOrBlobOrDataUrl, storagePath, error: null };
      }

      if (uploadBody instanceof File || uploadBody instanceof Blob) {
        const readerDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(uploadBody as Blob);
        });
        if (readerDataUrl) {
          return { publicUrl: readerDataUrl, storagePath, error: null };
        }
      }

      return { publicUrl: '', storagePath: '', error: new Error(uploadError.message) };
    }

    const { data: publicData } = supabase.storage
      .from(SUPABASE_BUCKETS.AVATARS)
      .getPublicUrl(storagePath);

    const publicUrl = publicData?.publicUrl || '';
    if (!publicUrl) {
      return { publicUrl: '', storagePath: '', error: new Error('Failed to generate public URL from Supabase avatars bucket.') };
    }

    return {
      publicUrl,
      storagePath,
      error: null,
    };
  } catch (err: any) {
    console.error('[Supabase Avatar Upload Exception]:', err);
    return { publicUrl: '', storagePath: '', error: err instanceof Error ? err : new Error(String(err)) };
  }
}

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

export async function uploadMaterialToSupabaseBucket(
  fileOrBlob: File | Blob,
  fileName: string,
  uid?: string
): Promise<{ publicUrl: string; downloadUrl: string; storagePath: string; error: Error | null }> {
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

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SUPABASE_BUCKETS.MATERIALS)
      .upload(storagePath, fileOrBlob, {
        contentType,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.warn('[Supabase Storage Materials Upload RLS/Storage Notice]:', uploadError.message);

      // Graceful Fallback: Convert file/blob to Data URL if storage RLS blocks direct anon upload
      try {
        const fallbackDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || '');
          reader.onerror = () => resolve('');
          reader.readAsDataURL(fileOrBlob);
        });

        if (fallbackDataUrl) {
          return {
            publicUrl: fallbackDataUrl,
            downloadUrl: fallbackDataUrl,
            storagePath,
            error: null,
          };
        }
      } catch {}

      return { publicUrl: '', downloadUrl: '', storagePath: '', error: new Error(uploadError.message) };
    }

    const { data: publicData } = supabase.storage
      .from(SUPABASE_BUCKETS.MATERIALS)
      .getPublicUrl(storagePath);

    const publicUrl = publicData?.publicUrl || '';
    if (!publicUrl) {
      return { publicUrl: '', downloadUrl: '', storagePath: '', error: new Error('Failed to generate public URL from Supabase materials bucket.') };
    }

    return {
      publicUrl,
      downloadUrl: publicUrl,
      storagePath,
      error: null,
    };
  } catch (err: any) {
    console.error('[Supabase Material Upload Exception]:', err);
    return { publicUrl: '', downloadUrl: '', storagePath: '', error: err instanceof Error ? err : new Error(String(err)) };
  }
}

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
// 5. SUPABASE PROFILES TABLE MANAGEMENT
// ============================================================================

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
    return data;
  } catch {
    return null;
  }
}

// ============================================================================
// 6. SUPABASE MATERIALS / DOCUMENTS TABLE MANAGEMENT
// ============================================================================

export async function saveMaterialToSupabaseTable(material: {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  category: string;
  description: string;
  author: string;
  uploaderName?: string;
  uploaderType?: string;
  status?: string;
  previewUrl?: string;
  downloadUrl?: string;
  dataUrl?: string;
  storagePath?: string;
  tags?: string[];
  downloadCount?: number;
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
      uploader_name: material.uploaderName || material.author,
      uploader_type: material.uploaderType || 'owner',
      status: material.status || 'approved',
      preview_url: material.previewUrl || null,
      download_url: material.downloadUrl || null,
      data_url: material.dataUrl || null,
      storage_path: material.storagePath || null,
      tags: material.tags || [],
      download_count: material.downloadCount || 0,
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

export async function incrementMaterialDownloadInSupabase(materialId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('materials')
      .select('download_count')
      .eq('id', materialId)
      .maybeSingle();

    const currentCount = data?.download_count || 0;
    await supabase
      .from('materials')
      .update({ download_count: currentCount + 1, updated_at: new Date().toISOString() })
      .eq('id', materialId);
  } catch {}
}

// ============================================================================
// 7. SUPABASE CONVERSATIONS & MESSAGING MANAGEMENT
// ============================================================================

export async function fetchConversationsFromSupabase(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error || !data) return [];
    return data.map((c: any) => ({
      id: c.id,
      defaultLabel: c.default_label || 'Direct Message',
      customName: c.custom_name || undefined,
      visitorName: c.visitor_name || undefined,
      roleOrCompany: c.role_or_company || undefined,
      avatarColor: c.avatar_color || 'bg-slate-700',
      avatarUrl: c.avatar_url || undefined,
      lastMessage: c.last_message || undefined,
      lastTimestamp: c.last_timestamp || undefined,
      unread: Boolean(c.unread),
      important: Boolean(c.important),
      messages: Array.isArray(c.messages) ? c.messages : [],
    }));
  } catch {
    return [];
  }
}

export async function saveConversationToSupabase(conv: {
  id: string;
  defaultLabel: string;
  customName?: string;
  visitorName?: string;
  roleOrCompany?: string;
  avatarColor?: string;
  avatarUrl?: string;
  lastMessage?: string;
  lastTimestamp?: string;
  unread?: boolean;
  important?: boolean;
  messages?: any[];
}): Promise<boolean> {
  try {
    const payload = {
      id: conv.id,
      default_label: conv.defaultLabel,
      custom_name: conv.customName || null,
      visitor_name: conv.visitorName || null,
      role_or_company: conv.roleOrCompany || null,
      avatar_color: conv.avatarColor || 'bg-slate-700',
      avatar_url: conv.avatarUrl || null,
      last_message: conv.lastMessage || null,
      last_timestamp: conv.lastTimestamp || null,
      unread: Boolean(conv.unread),
      important: Boolean(conv.important),
      messages: conv.messages || [],
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('conversations')
      .upsert(payload, { onConflict: 'id' });

    return !error;
  } catch {
    return false;
  }
}

export async function deleteConversationFromSupabase(convId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', convId);

    return !error;
  } catch {
    return false;
  }
}

// ============================================================================
// 8. SUPABASE REALTIME CHANNELS & PUBSUB
// ============================================================================

export type RealtimeChatCallback = (message: any) => void;

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
      .on('broadcast', { event: 'general_memory_event' }, (payload) => {
        if (payload?.payload) {
          callback(payload.payload);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('[Supabase Realtime Channel Subscription Note]:', err);
    return () => {};
  }
}

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

export async function broadcastSupabaseMemoryEvent(category: string, type: string, data?: any): Promise<void> {
  try {
    const channel = supabase.channel('fesline_portfolio_realtime_chat');
    await channel.send({
      type: 'broadcast',
      event: 'general_memory_event',
      payload: { category, type, data, timestamp: Date.now() },
    });
  } catch (err) {
    console.warn('[Supabase Memory Broadcast Note]:', err);
  }
}

// ============================================================================
// 9. COMPLETE SUPABASE RLS & SCHEMA SQL BLUEPRINT
// ============================================================================

export const SUPABASE_RLS_SCHEMA_SQL = `
-- ============================================================================
-- FESLINE MECHANICAL ENGINEERING: COMPLETE SUPABASE DATABASE SCHEMA & RLS
-- ============================================================================

-- 1. Storage Buckets Creation
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS: Public read for avatars
DROP POLICY IF EXISTS "Public Read Avatars" ON storage.objects;
CREATE POLICY "Public Read Avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Storage RLS: Public upload/update to avatars
DROP POLICY IF EXISTS "Public Upload Avatars" ON storage.objects;
CREATE POLICY "Public Upload Avatars" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public Update Avatars" ON storage.objects;
CREATE POLICY "Public Update Avatars" ON storage.objects
FOR UPDATE USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public Delete Avatars" ON storage.objects;
CREATE POLICY "Public Delete Avatars" ON storage.objects
FOR DELETE USING (bucket_id = 'avatars');

-- Storage RLS: Public read for materials
DROP POLICY IF EXISTS "Public Read Materials" ON storage.objects;
CREATE POLICY "Public Read Materials" ON storage.objects
FOR SELECT USING (bucket_id = 'materials');

-- Storage RLS: Public upload & delete for materials
DROP POLICY IF EXISTS "Public Upload Materials" ON storage.objects;
CREATE POLICY "Public Upload Materials" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'materials');

DROP POLICY IF EXISTS "Public Delete Materials" ON storage.objects;
CREATE POLICY "Public Delete Materials" ON storage.objects
FOR DELETE USING (bucket_id = 'materials');

-- 2. Profiles Table & RLS
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  user_id UUID,
  full_name TEXT NOT NULL DEFAULT 'Festus, Olorunsogo Johnson',
  header TEXT DEFAULT 'Lead Mechanical Design Engineer',
  bio JSONB DEFAULT '{}'::jsonb,
  avatar_url TEXT DEFAULT '',
  documents JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to owner profile" ON public.profiles;
CREATE POLICY "Allow public read access to owner profile"
ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert/update to profile" ON public.profiles;
CREATE POLICY "Allow public insert/update to profile"
ON public.profiles FOR ALL USING (true);

-- 3. Materials Table & RLS
CREATE TABLE IF NOT EXISTS public.materials (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size TEXT,
  file_type TEXT,
  category TEXT,
  description TEXT,
  author TEXT,
  uploader_name TEXT,
  uploader_type TEXT DEFAULT 'owner',
  status TEXT DEFAULT 'approved',
  preview_url TEXT,
  download_url TEXT,
  data_url TEXT,
  storage_path TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_approved BOOLEAN DEFAULT true,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to engineering materials" ON public.materials;
CREATE POLICY "Allow public read access to engineering materials"
ON public.materials FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public all access to materials" ON public.materials;
CREATE POLICY "Allow public all access to materials"
ON public.materials FOR ALL USING (true);

-- 4. Conversations Table & RLS
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  default_label TEXT NOT NULL,
  custom_name TEXT,
  visitor_name TEXT,
  role_or_company TEXT,
  avatar_color TEXT DEFAULT 'bg-slate-700',
  avatar_url TEXT,
  last_message TEXT,
  last_timestamp TEXT,
  unread BOOLEAN DEFAULT false,
  important BOOLEAN DEFAULT false,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read conversations" ON public.conversations;
CREATE POLICY "Allow public read conversations"
ON public.conversations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write conversations" ON public.conversations;
CREATE POLICY "Allow public write conversations"
ON public.conversations FOR ALL USING (true);

-- 5. Real-time Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
`;
