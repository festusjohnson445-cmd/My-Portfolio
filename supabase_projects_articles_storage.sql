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

-- 2. STORAGE BUCKETS: 'projects' AND 'articles' (200 MB file limit, unrestricted MIME types)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('projects', 'projects', true, 209715200, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 209715200, allowed_mime_types = NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('articles', 'articles', true, 209715200, NULL)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 209715200, allowed_mime_types = NULL;

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
  hero_inscription TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Non-destructive upgrade if projects table already exists without hero_inscription or views_count
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS hero_inscription TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Non-destructive upgrade if articles table already exists without hero_inscription or views_count
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS hero_inscription TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;

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

-- Real-time project views, article views, and article unlike RPCs
CREATE OR REPLACE FUNCTION public.increment_project_views(target_project_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.projects
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = target_project_id AND status = 'published'
  RETURNING views_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_project_views(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_article_views(target_article_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.articles
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = target_article_id AND status = 'published'
  RETURNING views_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_article_views(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.decrement_article_likes(target_article_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.articles
  SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1)
  WHERE id = target_article_id AND status = 'published'
  RETURNING likes_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_article_likes(TEXT) TO anon, authenticated;

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

-- Non-destructive upgrade if media_assets already existed before fallback_urls or 'document' media_type
ALTER TABLE public.media_assets
  ADD COLUMN IF NOT EXISTS fallback_urls JSONB DEFAULT '{}'::jsonb;

DO $$
DECLARE
  chk_name TEXT;
BEGIN
  SELECT conname INTO chk_name
  FROM pg_constraint
  WHERE conrelid = 'public.media_assets'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%media_type%';

  IF chk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.media_assets DROP CONSTRAINT %I', chk_name);
  END IF;

  ALTER TABLE public.media_assets
    ADD CONSTRAINT media_assets_media_type_check
    CHECK (media_type IN ('image', 'video', 'document'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

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
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'projects',
    'articles',
    'article_comments',
    'profile_experiences',
    'profile_publications',
    'profile_achievements',
    'website_settings',
    'media_assets',
    'materials'
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

-- 9. ENGINEERING HUB: STUDENT MATERIALS FIELDS, REAL-TIME VIEWS & LIKES, VISITOR UPLOAD POLICIES
ALTER TABLE public.materials
  ADD COLUMN IF NOT EXISTS level TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS institution TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_material_views(target_material_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.materials
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = target_material_id
  RETURNING views_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_material_views(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_material_likes(target_material_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.materials
  SET likes_count = COALESCE(likes_count, 0) + 1
  WHERE id = target_material_id
  RETURNING likes_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_material_likes(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.decrement_material_likes(target_material_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.materials
  SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1)
  WHERE id = target_material_id
  RETURNING likes_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_material_likes(TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS "Public Insert Student Materials" ON public.materials;
CREATE POLICY "Public Insert Student Materials"
ON public.materials FOR INSERT TO public
WITH CHECK (category = 'Students Materials');

DROP POLICY IF EXISTS "Owner Manage All Materials Delete" ON public.materials;
CREATE POLICY "Owner Manage All Materials Delete"
ON public.materials FOR DELETE TO authenticated
USING (public.is_portfolio_owner());

DROP POLICY IF EXISTS "Public Upload Student Materials to materials" ON storage.objects;
CREATE POLICY "Public Upload Student Materials to materials"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'materials'
  AND (storage.foldername(name))[1] = 'student-submissions'
);

DROP POLICY IF EXISTS "Owner Delete Student Materials Objects" ON storage.objects;
CREATE POLICY "Owner Delete Student Materials Objects"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'materials' AND public.is_portfolio_owner());

-- 10. CAREER STUDIO DOCUMENTS TABLE & STORAGE POLICIES
CREATE TABLE IF NOT EXISTS public.career_studio_documents (
  id TEXT PRIMARY KEY,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  client_token TEXT DEFAULT '',
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  section_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  pdf_url TEXT DEFAULT '',
  docx_url TEXT DEFAULT '',
  preview_image_url TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  views_count INTEGER DEFAULT 0,
  downloads_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.career_studio_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Career Studio Documents" ON public.career_studio_documents;
CREATE POLICY "Public Read Career Studio Documents"
ON public.career_studio_documents FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "Public Insert Career Studio Documents" ON public.career_studio_documents;
CREATE POLICY "Public Insert Career Studio Documents"
ON public.career_studio_documents FOR INSERT TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Career Studio Documents" ON public.career_studio_documents;
CREATE POLICY "Public Update Career Studio Documents"
ON public.career_studio_documents FOR UPDATE TO public
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Public Delete Career Studio Documents" ON public.career_studio_documents;
CREATE POLICY "Public Delete Career Studio Documents"
ON public.career_studio_documents FOR DELETE TO public
USING (true);

CREATE INDEX IF NOT EXISTS idx_career_studio_status_updated ON public.career_studio_documents(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_career_studio_category ON public.career_studio_documents(category);

DROP POLICY IF EXISTS "Public Upload Career Studio to materials" ON storage.objects;
CREATE POLICY "Public Upload Career Studio to materials"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'materials'
  AND (storage.foldername(name))[1] = 'career-studio'
);

DROP POLICY IF EXISTS "Public Upload Generated Docs to materials" ON storage.objects;
CREATE POLICY "Public Upload Generated Docs to materials"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'materials'
  AND (storage.foldername(name))[1] = 'generated-docs'
);

DROP POLICY IF EXISTS "Public Update Generated Docs in materials" ON storage.objects;
CREATE POLICY "Public Update Generated Docs in materials"
ON storage.objects FOR UPDATE TO public
USING (
  bucket_id = 'materials'
  AND (storage.foldername(name))[1] = 'generated-docs'
)
WITH CHECK (
  bucket_id = 'materials'
  AND (storage.foldername(name))[1] = 'generated-docs'
);

DROP POLICY IF EXISTS "Public Delete Generated Docs in materials" ON storage.objects;
CREATE POLICY "Public Delete Generated Docs in materials"
ON storage.objects FOR DELETE TO public
USING (
  bucket_id = 'materials'
  AND (storage.foldername(name))[1] = 'generated-docs'
);

DROP POLICY IF EXISTS "Owner Delete Career Studio Objects" ON storage.objects;
CREATE POLICY "Owner Delete Career Studio Objects"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'materials' AND public.is_portfolio_owner());

-- 11. GENERATED DOCUMENTS (CAREER STUDIO LIVE SCHEMA & RPC COUNTERS)
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
CREATE POLICY "Public Read Generated Documents"
ON public.generated_documents FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "Public Insert Generated Documents" ON public.generated_documents;
CREATE POLICY "Public Insert Generated Documents"
ON public.generated_documents FOR INSERT TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update Generated Documents" ON public.generated_documents;
CREATE POLICY "Public Update Generated Documents"
ON public.generated_documents FOR UPDATE TO public
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Public Delete Generated Documents" ON public.generated_documents;
CREATE POLICY "Public Delete Generated Documents"
ON public.generated_documents FOR DELETE TO public
USING (true);

CREATE INDEX IF NOT EXISTS idx_generated_docs_status_created ON public.generated_documents(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_docs_category ON public.generated_documents(category);

CREATE OR REPLACE FUNCTION public.increment_generated_document_views(target_doc_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE public.generated_documents
  SET views_count = COALESCE(views_count, 0) + 1
  WHERE id = target_doc_id
  RETURNING views_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_generated_document_views(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_generated_document_downloads(target_doc_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_count INTEGER;
BEGIN
  UPDATE public.generated_documents
  SET downloads_count = COALESCE(downloads_count, 0) + 1
  WHERE id = target_doc_id
  RETURNING downloads_count INTO new_count;
  RETURN COALESCE(new_count, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_generated_document_downloads(TEXT) TO anon, authenticated;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'career_studio_documents',
    'generated_documents',
    'visitor_profiles',
    'conversations',
    'messages',
    'profiles'
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
