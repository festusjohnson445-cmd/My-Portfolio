-- ============================================================================
-- FESLINE ENGINEERING PORTFOLIO: SUPABASE PROJECTS, ARTICLES, ADMIN & PROFILE SQL
-- ============================================================================
-- Safe, non-destructive setup script. Preserves all existing tables, records,
-- buckets ('avatars', 'Materials', 'materials'), and authentication setups.
-- Run this complete script in your Supabase Dashboard -> SQL Editor.
-- ============================================================================

-- 1. OWNER IDENTITY HELPER FUNCTION (Prevents anonymous/guest accounts from admin writes)
CREATE OR REPLACE FUNCTION public.is_portfolio_owner()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND COALESCE(auth.jwt() ->> 'email', '') <> ''
    AND COALESCE(auth.jwt() ->> 'email', '') <> 'public_visitor@feslineguest.com'
  );
$$;

-- 2. STORAGE BUCKETS: 'projects' AND 'articles'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('projects', 'projects', true, 104857600, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 104857600;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('articles', 'articles', true, 104857600, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 104857600;

-- Storage Policies for 'projects' bucket (Public Read, Owner-Only Write/Update/Delete)
DROP POLICY IF EXISTS "Public Read Projects Bucket" ON storage.objects;
CREATE POLICY "Public Read Projects Bucket"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'projects');

DROP POLICY IF EXISTS "Owner Upload Projects Bucket" ON storage.objects;
CREATE POLICY "Owner Upload Projects Bucket"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'projects' AND public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Update Projects Bucket" ON storage.objects;
CREATE POLICY "Owner Update Projects Bucket"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'projects' AND public.is_portfolio_owner())
WITH CHECK (bucket_id = 'projects' AND public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Delete Projects Bucket" ON storage.objects;
CREATE POLICY "Owner Delete Projects Bucket"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'projects' AND public.is_portfolio_owner());

-- Storage Policies for 'articles' bucket (Public Read, Public & Owner Upload for submissions, Owner-Only Update/Delete)
DROP POLICY IF EXISTS "Public Read Articles Bucket" ON storage.objects;
CREATE POLICY "Public Read Articles Bucket"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'articles');

DROP POLICY IF EXISTS "Public Upload Articles Bucket" ON storage.objects;
CREATE POLICY "Public Upload Articles Bucket"
ON storage.objects FOR INSERT TO public
WITH CHECK (bucket_id = 'articles');

DROP POLICY IF EXISTS "Owner Update Articles Bucket" ON storage.objects;
CREATE POLICY "Owner Update Articles Bucket"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'articles' AND public.is_portfolio_owner())
WITH CHECK (bucket_id = 'articles' AND public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Delete Articles Bucket" ON storage.objects;
CREATE POLICY "Owner Delete Articles Bucket"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'articles' AND public.is_portfolio_owner());

-- 3. PROJECTS TABLE & RLS
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Published Projects" ON public.projects;
CREATE POLICY "Public Read Published Projects"
ON public.projects FOR SELECT TO public
USING (status = 'published' OR public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Insert Projects" ON public.projects;
CREATE POLICY "Owner Insert Projects"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Update Projects" ON public.projects;
CREATE POLICY "Owner Update Projects"
ON public.projects FOR UPDATE TO authenticated
USING (public.is_portfolio_owner())
WITH CHECK (public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Delete Projects" ON public.projects;
CREATE POLICY "Owner Delete Projects"
ON public.projects FOR DELETE TO authenticated
USING (public.is_portfolio_owner());

CREATE INDEX IF NOT EXISTS idx_projects_status_created ON public.projects(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(category);

-- 4. ARTICLES TABLE & RLS
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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Published Articles" ON public.articles;
CREATE POLICY "Public Read Published Articles"
ON public.articles FOR SELECT TO public
USING (status = 'published' OR public.is_portfolio_owner());

-- Visitors may submit articles strictly in 'pending' state and non-admin flag; owner can insert any state
DROP POLICY IF EXISTS "Public Submit Pending Articles or Owner Insert" ON public.articles;
CREATE POLICY "Public Submit Pending Articles or Owner Insert"
ON public.articles FOR INSERT TO public
WITH CHECK (
  (status = 'pending' AND COALESCE(is_admin_author, false) = false)
  OR public.is_portfolio_owner()
);

DROP POLICY IF EXISTS "Owner Update Articles" ON public.articles;
CREATE POLICY "Owner Update Articles"
ON public.articles FOR UPDATE TO authenticated
USING (public.is_portfolio_owner())
WITH CHECK (public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Delete Articles" ON public.articles;
CREATE POLICY "Owner Delete Articles"
ON public.articles FOR DELETE TO authenticated
USING (public.is_portfolio_owner());

CREATE INDEX IF NOT EXISTS idx_articles_status_created ON public.articles(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles(category);

-- Secure RPC function allowing any visitor to increment article likes without granting broad UPDATE permissions
CREATE OR REPLACE FUNCTION public.increment_article_likes(target_article_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.articles
  SET likes_count = COALESCE(likes_count, 0) + 1
  WHERE id = target_article_id AND status = 'published'
  RETURNING likes_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_article_likes(TEXT) TO anon, authenticated;

-- 5. ARTICLE COMMENTS TABLE & RLS
CREATE TABLE IF NOT EXISTS public.article_comments (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_role TEXT DEFAULT 'Visitor',
  content_markdown TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.article_comments
  ALTER COLUMN status SET DEFAULT 'approved';

-- Non-destructive upgrade if article_comments already exists without 'archived' in its CHECK constraint
DO $$
DECLARE
  chk_name TEXT;
BEGIN
  SELECT conname INTO chk_name
  FROM pg_constraint
  WHERE conrelid = 'public.article_comments'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF chk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.article_comments DROP CONSTRAINT %I', chk_name);
  END IF;

  ALTER TABLE public.article_comments
    ADD CONSTRAINT article_comments_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'archived'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Approved Comments" ON public.article_comments;
CREATE POLICY "Public Read Approved Comments"
ON public.article_comments FOR SELECT TO public
USING (status = 'approved' OR public.is_portfolio_owner());

DROP POLICY IF EXISTS "Public Submit Pending Comment or Owner Approved" ON public.article_comments;
DROP POLICY IF EXISTS "Public Submit Comment Immediately" ON public.article_comments;
CREATE POLICY "Public Submit Comment Immediately"
ON public.article_comments FOR INSERT TO public
WITH CHECK (status IN ('approved', 'pending') OR public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Update Comments" ON public.article_comments;
CREATE POLICY "Owner Update Comments"
ON public.article_comments FOR UPDATE TO authenticated
USING (public.is_portfolio_owner())
WITH CHECK (public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Delete Comments" ON public.article_comments;
CREATE POLICY "Owner Delete Comments"
ON public.article_comments FOR DELETE TO authenticated
USING (public.is_portfolio_owner());

CREATE INDEX IF NOT EXISTS idx_article_comments_article ON public.article_comments(article_id, status, created_at DESC);

-- 6. PROFILE STRUCTURED SECTIONS TABLES (EXPERIENCE, PUBLICATIONS, ACHIEVEMENTS, WEBSITE SETTINGS)
CREATE TABLE IF NOT EXISTS public.profile_experiences (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role_title TEXT NOT NULL,
  organization TEXT NOT NULL,
  location TEXT DEFAULT '',
  start_date TEXT NOT NULL DEFAULT '',
  end_date TEXT DEFAULT '',
  is_current BOOLEAN DEFAULT false,
  summary TEXT DEFAULT '',
  highlights TEXT[] DEFAULT ARRAY[]::TEXT[],
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_experiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Experiences" ON public.profile_experiences;
CREATE POLICY "Public Read Experiences" ON public.profile_experiences FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner Manage Experiences Insert" ON public.profile_experiences;
CREATE POLICY "Owner Manage Experiences Insert" ON public.profile_experiences FOR INSERT TO authenticated WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Manage Experiences Update" ON public.profile_experiences;
CREATE POLICY "Owner Manage Experiences Update" ON public.profile_experiences FOR UPDATE TO authenticated USING (public.is_portfolio_owner()) WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Manage Experiences Delete" ON public.profile_experiences;
CREATE POLICY "Owner Manage Experiences Delete" ON public.profile_experiences FOR DELETE TO authenticated USING (public.is_portfolio_owner());

CREATE TABLE IF NOT EXISTS public.profile_publications (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  venue_or_journal TEXT NOT NULL DEFAULT '',
  year TEXT DEFAULT '',
  authors TEXT DEFAULT '',
  doi_or_url TEXT DEFAULT '',
  abstract TEXT DEFAULT '',
  category TEXT DEFAULT 'Journal Article',
  attachment_url TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Publications" ON public.profile_publications;
CREATE POLICY "Public Read Publications" ON public.profile_publications FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner Manage Publications Insert" ON public.profile_publications;
CREATE POLICY "Owner Manage Publications Insert" ON public.profile_publications FOR INSERT TO authenticated WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Manage Publications Update" ON public.profile_publications;
CREATE POLICY "Owner Manage Publications Update" ON public.profile_publications FOR UPDATE TO authenticated USING (public.is_portfolio_owner()) WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Manage Publications Delete" ON public.profile_publications;
CREATE POLICY "Owner Manage Publications Delete" ON public.profile_publications FOR DELETE TO authenticated USING (public.is_portfolio_owner());

CREATE TABLE IF NOT EXISTS public.profile_achievements (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  issuer TEXT DEFAULT '',
  date_str TEXT DEFAULT '',
  category TEXT DEFAULT 'Award',
  description TEXT DEFAULT '',
  certificate_url TEXT DEFAULT '',
  verified BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Achievements" ON public.profile_achievements;
CREATE POLICY "Public Read Achievements" ON public.profile_achievements FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner Manage Achievements Insert" ON public.profile_achievements;
CREATE POLICY "Owner Manage Achievements Insert" ON public.profile_achievements FOR INSERT TO authenticated WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Manage Achievements Update" ON public.profile_achievements;
CREATE POLICY "Owner Manage Achievements Update" ON public.profile_achievements FOR UPDATE TO authenticated USING (public.is_portfolio_owner()) WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Manage Achievements Delete" ON public.profile_achievements;
CREATE POLICY "Owner Manage Achievements Delete" ON public.profile_achievements FOR DELETE TO authenticated USING (public.is_portfolio_owner());

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

-- Non-destructive upgrade if website_settings already exists without appearance_config JSONB
ALTER TABLE public.website_settings
  ADD COLUMN IF NOT EXISTS appearance_config JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.website_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Website Settings" ON public.website_settings;
CREATE POLICY "Public Read Website Settings" ON public.website_settings FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner Manage Website Settings Insert" ON public.website_settings;
CREATE POLICY "Owner Manage Website Settings Insert" ON public.website_settings FOR INSERT TO authenticated WITH CHECK (public.is_portfolio_owner());
DROP POLICY IF EXISTS "Owner Manage Website Settings Update" ON public.website_settings;
CREATE POLICY "Owner Manage Website Settings Update" ON public.website_settings FOR UPDATE TO authenticated USING (public.is_portfolio_owner()) WITH CHECK (public.is_portfolio_owner());

-- 7. OPTIMIZED MEDIA ASSETS METADATA TABLE & RLS
CREATE TABLE IF NOT EXISTS public.media_assets (
  id TEXT PRIMARY KEY,
  bucket TEXT NOT NULL CHECK (bucket IN ('projects', 'articles', 'materials', 'avatars')),
  storage_path TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
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

-- Non-destructive upgrade if media_assets already existed before fallback_urls column
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS fallback_urls JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Media Assets" ON public.media_assets;
CREATE POLICY "Public Read Media Assets"
ON public.media_assets FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "Public Insert Media Assets" ON public.media_assets;
CREATE POLICY "Public Insert Media Assets"
ON public.media_assets FOR INSERT TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Owner Update Media Assets" ON public.media_assets;
CREATE POLICY "Owner Update Media Assets"
ON public.media_assets FOR UPDATE TO authenticated
USING (public.is_portfolio_owner())
WITH CHECK (public.is_portfolio_owner());

DROP POLICY IF EXISTS "Owner Delete Media Assets" ON public.media_assets;
CREATE POLICY "Owner Delete Media Assets"
ON public.media_assets FOR DELETE TO authenticated
USING (public.is_portfolio_owner());

CREATE INDEX IF NOT EXISTS idx_media_assets_bucket_created ON public.media_assets(bucket, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_assets_status ON public.media_assets(status);

-- 8. ENABLE REALTIME PUBLICATIONS SAFELY
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.article_comments;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_experiences;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_publications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_achievements;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.website_settings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.media_assets;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
