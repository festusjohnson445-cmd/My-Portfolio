-- ============================================================================
-- FESLINE ENGINEERING PORTFOLIO: SUPABASE PIPELINE & SCHEMA UPDATE (IDEMPOTENT)
-- Covers: Messaging (Unread/Seen Counts), Profile, and Engineering Hub Materials
-- Safe to run multiple times without modifying or deleting existing storage files.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. MESSAGING TABLES (visitor_profiles, conversations, messages)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.visitor_profiles (
  visitor_id TEXT PRIMARY KEY,
  display_name TEXT DEFAULT 'Visitor',
  role_subject TEXT DEFAULT 'Visitor Direct Chat',
  avatar_url TEXT DEFAULT '',
  avatar_color TEXT DEFAULT 'bg-slate-700',
  updated_at TIMESTAMPTZ DEFAULT now()
);

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

-- Safely add any columns that may be missing on pre-existing conversations table
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS visitor_id TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS default_label TEXT DEFAULT 'Direct Message';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS custom_name TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS visitor_name TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS role_or_company TEXT DEFAULT 'Visitor Direct Chat';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS unread BOOLEAN DEFAULT true;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS important BOOLEAN DEFAULT false;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_timestamp TEXT;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  content TEXT NOT NULL,
  voice_note JSONB,
  attachments JSONB,
  status TEXT DEFAULT 'unseen',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS voice_note JSONB;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachments JSONB;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unseen';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_unseen_status ON public.messages (status) WHERE status = 'unseen';
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON public.conversations (last_message_at DESC);

ALTER TABLE public.visitor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read/write visitor_profiles" ON public.visitor_profiles;
CREATE POLICY "Public read/write visitor_profiles" ON public.visitor_profiles
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read/write conversations" ON public.conversations;
CREATE POLICY "Public read/write conversations" ON public.conversations
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public read/write messages" ON public.messages;
CREATE POLICY "Public read/write messages" ON public.messages
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. PROFILE TABLE (public.profiles)
-- ============================================================================

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
CREATE POLICY "Allow public read access to owner profile" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow owner to insert profile" ON public.profiles;
CREATE POLICY "Allow owner to insert profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow owner to update profile" ON public.profiles;
CREATE POLICY "Allow owner to update profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 3. ENGINEERING HUB TABLE (public.materials)
-- ============================================================================

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
  is_approved BOOLEAN DEFAULT true,
  download_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS file_size TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS author TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS preview_url TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS download_url TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_materials_created_at ON public.materials (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_materials_category ON public.materials (category);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to engineering materials" ON public.materials;
CREATE POLICY "Allow public read access to engineering materials" ON public.materials
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow owner to insert materials" ON public.materials;
CREATE POLICY "Allow owner to insert materials" ON public.materials
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow owner to update materials" ON public.materials;
CREATE POLICY "Allow owner to update materials" ON public.materials
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow owner to delete materials" ON public.materials;
CREATE POLICY "Allow owner to delete materials" ON public.materials
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- ============================================================================
-- 4. PRESERVE EXISTING STORAGE BUCKETS & ENSURE POLICIES EXIST
--    (Does NOT overwrite existing bucket settings like file_size_limit or mime_types)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Read Materials" ON storage.objects;
CREATE POLICY "Public Read Materials" ON storage.objects
  FOR SELECT USING (bucket_id = 'materials');

DROP POLICY IF EXISTS "Owner Upload Materials" ON storage.objects;
CREATE POLICY "Owner Upload Materials" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owner Update Materials" ON storage.objects;
CREATE POLICY "Owner Update Materials" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Owner Delete Materials" ON storage.objects;
CREATE POLICY "Owner Delete Materials" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'materials' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- 5. REALTIME PUBLICATIONS (Safe idempotent registration)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'materials'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
