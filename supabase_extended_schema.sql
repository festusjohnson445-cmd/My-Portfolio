-- ==============================================================================
-- FESLINE MECHANICAL ENGINEERING: EXTENDED SUPABASE DATABASE SCHEMA & POLICIES
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/teszyojnwaedjvqaqake/sql/new
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 20971520, NULL),
  ('materials', 'materials', true, 52428800, NULL),
  ('Materials', 'Materials', true, 52428800, NULL),
  ('projects', 'projects', true, 52428800, NULL),
  ('articles', 'articles', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS Policies: Allow public read and public/authenticated uploads
DROP POLICY IF EXISTS "Public Read Avatars" ON storage.objects;
CREATE POLICY "Public Read Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public Read Materials" ON storage.objects;
CREATE POLICY "Public Read Materials" ON storage.objects FOR SELECT USING (bucket_id IN ('materials', 'Materials'));

DROP POLICY IF EXISTS "Public Read Projects" ON storage.objects;
CREATE POLICY "Public Read Projects" ON storage.objects FOR SELECT USING (bucket_id = 'projects');

DROP POLICY IF EXISTS "Public Read Articles" ON storage.objects;
CREATE POLICY "Public Read Articles" ON storage.objects FOR SELECT USING (bucket_id = 'articles');

DROP POLICY IF EXISTS "Public Upload All Media" ON storage.objects;
CREATE POLICY "Public Upload All Media" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id IN ('avatars', 'materials', 'Materials', 'projects', 'articles'));

DROP POLICY IF EXISTS "Public Update All Media" ON storage.objects;
CREATE POLICY "Public Update All Media" ON storage.objects FOR UPDATE TO public USING (bucket_id IN ('avatars', 'materials', 'Materials', 'projects', 'articles'));

DROP POLICY IF EXISTS "Public Delete All Media" ON storage.objects;
CREATE POLICY "Public Delete All Media" ON storage.objects FOR DELETE TO public USING (bucket_id IN ('avatars', 'materials', 'Materials', 'projects', 'articles'));


-- 3. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Mechanical Design',
  description TEXT,
  overview TEXT,
  objectives TEXT,
  methodology TEXT,
  technical_specs TEXT,
  cad_drawings TEXT,
  thumbnail_url TEXT,
  document_url TEXT,
  document_name TEXT,
  demo_url TEXT,
  video_url TEXT,
  tools TEXT,
  results TEXT,
  is_featured BOOLEAN DEFAULT false,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to projects" ON public.projects;
CREATE POLICY "Allow public read access to projects" ON public.projects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow owner write access to projects" ON public.projects;
CREATE POLICY "Allow owner write access to projects" ON public.projects FOR ALL TO public USING (true) WITH CHECK (true);


-- 4. PROJECT_MEDIA TABLE
CREATE TABLE IF NOT EXISTS public.project_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image', -- image, video, cad, document
  caption TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to project_media" ON public.project_media;
CREATE POLICY "Allow public read access to project_media" ON public.project_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow owner write access to project_media" ON public.project_media;
CREATE POLICY "Allow owner write access to project_media" ON public.project_media FOR ALL TO public USING (true) WITH CHECK (true);


-- 5. ARTICLE CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.article_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to article_categories" ON public.article_categories;
CREATE POLICY "Allow public read access to article_categories" ON public.article_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow write access to article_categories" ON public.article_categories;
CREATE POLICY "Allow write access to article_categories" ON public.article_categories FOR ALL TO public USING (true) WITH CHECK (true);


-- 6. ARTICLES TABLE
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT,
  summary TEXT,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Engineering',
  author_name TEXT NOT NULL DEFAULT 'Visitor',
  author_role TEXT DEFAULT 'Contributor',
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_owner BOOLEAN DEFAULT false,
  thumbnail_url TEXT,
  video_url TEXT,
  status TEXT DEFAULT 'pending', -- 'published', 'draft', 'pending', 'archived'
  reading_time_minutes INT DEFAULT 3,
  likes_count INT DEFAULT 0,
  views_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to published articles" ON public.articles;
CREATE POLICY "Allow public read access to published articles" ON public.articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert to articles" ON public.articles;
CREATE POLICY "Allow insert to articles" ON public.articles FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update and delete to articles" ON public.articles;
CREATE POLICY "Allow update and delete to articles" ON public.articles FOR ALL TO public USING (true) WITH CHECK (true);


-- 7. ARTICLE COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.article_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'approved', 'pending', 'rejected'
  is_owner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to approved comments" ON public.article_comments;
CREATE POLICY "Allow public read access to approved comments" ON public.article_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert comments" ON public.article_comments;
CREATE POLICY "Allow insert comments" ON public.article_comments FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Allow manage comments" ON public.article_comments;
CREATE POLICY "Allow manage comments" ON public.article_comments FOR ALL TO public USING (true) WITH CHECK (true);


-- 8. ARTICLE LIKES TABLE
CREATE TABLE IF NOT EXISTS public.article_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, visitor_id)
);

ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to article_likes" ON public.article_likes;
CREATE POLICY "Allow all access to article_likes" ON public.article_likes FOR ALL TO public USING (true) WITH CHECK (true);


-- 9. ARTICLE VIEWS TABLE
CREATE TABLE IF NOT EXISTS public.article_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to article_views" ON public.article_views;
CREATE POLICY "Allow all access to article_views" ON public.article_views FOR ALL TO public USING (true) WITH CHECK (true);


-- 10. EXPERIENCE TABLE
CREATE TABLE IF NOT EXISTS public.experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  organization TEXT NOT NULL,
  location TEXT,
  start_date TEXT,
  end_date TEXT,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  achievements TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to experience" ON public.experience;
CREATE POLICY "Allow public read access to experience" ON public.experience FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow manage experience" ON public.experience;
CREATE POLICY "Allow manage experience" ON public.experience FOR ALL TO public USING (true) WITH CHECK (true);


-- 11. PUBLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  publication_venue TEXT,
  date TEXT,
  doi_or_url TEXT,
  abstract TEXT,
  authors TEXT,
  category TEXT DEFAULT 'Research Paper',
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to publications" ON public.publications;
CREATE POLICY "Allow public read access to publications" ON public.publications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow manage publications" ON public.publications;
CREATE POLICY "Allow manage publications" ON public.publications FOR ALL TO public USING (true) WITH CHECK (true);


-- 12. ACHIEVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  issuer TEXT,
  date TEXT,
  category TEXT DEFAULT 'Award',
  description TEXT,
  credential_url TEXT,
  skills TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to achievements" ON public.achievements;
CREATE POLICY "Allow public read access to achievements" ON public.achievements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow manage achievements" ON public.achievements;
CREATE POLICY "Allow manage achievements" ON public.achievements FOR ALL TO public USING (true) WITH CHECK (true);

-- Enable Realtime for the new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.article_comments;
