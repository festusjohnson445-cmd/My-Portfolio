-- ==============================================================================
-- SUPABASE PORTFOLIO & CMS SCHEMA
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql/new
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. PROJECTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY DEFAULT ('proj-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  title TEXT NOT NULL,
  slug TEXT,
  category TEXT NOT NULL DEFAULT 'CAD & Mechanical',
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT,
  overview TEXT,
  objectives TEXT,
  methodology TEXT,
  technical_specs JSONB DEFAULT '[]'::jsonb,
  cad_drawings JSONB DEFAULT '[]'::jsonb,
  media_gallery JSONB DEFAULT '[]'::jsonb,
  tools_used JSONB DEFAULT '[]'::jsonb,
  results TEXT,
  demo_url TEXT,
  github_url TEXT,
  technical_docs JSONB DEFAULT '[]'::jsonb,
  is_featured BOOLEAN DEFAULT false,
  completion_date TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view projects" ON public.projects;
CREATE POLICY "Public can view projects" ON public.projects
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins can manage projects" ON public.projects;
CREATE POLICY "Admins can manage projects" ON public.projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 3. PROJECT MEDIA TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_media (
  id TEXT PRIMARY KEY DEFAULT ('pmed-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL DEFAULT 'image', -- 'image' | 'video' | 'cad'
  url TEXT NOT NULL,
  caption TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view project media" ON public.project_media;
CREATE POLICY "Public can view project media" ON public.project_media
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins can manage project media" ON public.project_media;
CREATE POLICY "Admins can manage project media" ON public.project_media
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 4. ARTICLE CATEGORIES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.article_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view categories" ON public.article_categories;
CREATE POLICY "Public can view categories" ON public.article_categories
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins can manage categories" ON public.article_categories;
CREATE POLICY "Admins can manage categories" ON public.article_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default categories if none
INSERT INTO public.article_categories (id, name, description)
VALUES 
  ('engineering', 'Mechanical Engineering', 'CAD, GD&T, FEA, and hardware mechanisms'),
  ('manufacturing', 'Advanced Manufacturing', 'CNC Machining, 3D Printing, DFM/DFA'),
  ('aerospace', 'Aerospace & Robotics', 'Flight gimbals, actuators, precision dynamics'),
  ('software', 'Software & Web Dev', 'Modern web architecture, real-time apps, tools'),
  ('opinion', 'Industry Insights', 'Perspectives on engineering leadership & design')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 5. ARTICLES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY DEFAULT ('art-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  title TEXT NOT NULL,
  slug TEXT,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Mechanical Engineering',
  cover_image TEXT,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  author_email TEXT,
  author_role TEXT DEFAULT 'Contributor',
  is_admin_post BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'published', -- 'published' | 'pending' | 'draft' | 'archived'
  reading_time_minutes INT DEFAULT 3,
  likes_count INT DEFAULT 0,
  views_count INT DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  video_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published articles" ON public.articles;
CREATE POLICY "Public can view published articles" ON public.articles
  FOR SELECT TO public USING (status = 'published');

DROP POLICY IF EXISTS "Authenticated can view all articles" ON public.articles;
CREATE POLICY "Authenticated can view all articles" ON public.articles
  FOR SELECT TO authenticated USING (true);

-- Visitors can submit articles with 'pending' status
DROP POLICY IF EXISTS "Anyone can submit pending article" ON public.articles;
CREATE POLICY "Anyone can submit pending article" ON public.articles
  FOR INSERT TO public WITH CHECK (status = 'pending' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can update articles" ON public.articles;
CREATE POLICY "Admins can update articles" ON public.articles
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can delete articles" ON public.articles;
CREATE POLICY "Admins can delete articles" ON public.articles
  FOR DELETE TO authenticated USING (true);

-- ==============================================================================
-- 6. ARTICLE COMMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.article_comments (
  id TEXT PRIMARY KEY DEFAULT ('comm-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved', -- 'approved' | 'pending' | 'rejected'
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view approved comments" ON public.article_comments;
CREATE POLICY "Public can view approved comments" ON public.article_comments
  FOR SELECT TO public USING (status = 'approved');

DROP POLICY IF EXISTS "Anyone can insert comments" ON public.article_comments;
CREATE POLICY "Anyone can insert comments" ON public.article_comments
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can moderate comments" ON public.article_comments;
CREATE POLICY "Admins can moderate comments" ON public.article_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 7. ARTICLE LIKES & VIEWS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.article_likes (
  id TEXT PRIMARY KEY DEFAULT ('like-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_ip_or_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, visitor_ip_or_id)
);

ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert likes" ON public.article_likes;
CREATE POLICY "Anyone can insert likes" ON public.article_likes
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view likes count" ON public.article_likes;
CREATE POLICY "Public can view likes count" ON public.article_likes
  FOR SELECT TO public USING (true);

CREATE TABLE IF NOT EXISTS public.article_views (
  id TEXT PRIMARY KEY DEFAULT ('view-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT,
  viewed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can record views" ON public.article_views;
CREATE POLICY "Anyone can record views" ON public.article_views
  FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view view metrics" ON public.article_views;
CREATE POLICY "Public can view view metrics" ON public.article_views
  FOR SELECT TO public USING (true);

-- ==============================================================================
-- 8. EXPERIENCE & CAREER TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.experience (
  id TEXT PRIMARY KEY DEFAULT ('exp-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  location TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL DEFAULT 'Present',
  is_current BOOLEAN DEFAULT false,
  description TEXT NOT NULL DEFAULT '',
  achievements JSONB DEFAULT '[]'::jsonb,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view experience" ON public.experience;
CREATE POLICY "Public can view experience" ON public.experience
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins can manage experience" ON public.experience;
CREATE POLICY "Admins can manage experience" ON public.experience
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 9. RESEARCH & PUBLICATIONS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.publications (
  id TEXT PRIMARY KEY DEFAULT ('pub-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  title TEXT NOT NULL,
  publication_venue TEXT NOT NULL,
  publication_type TEXT NOT NULL DEFAULT 'Whitepaper',
  publication_date TEXT NOT NULL,
  authors TEXT NOT NULL DEFAULT 'Festus, Olorunsogo Johnson',
  doi_or_url TEXT,
  abstract TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view publications" ON public.publications;
CREATE POLICY "Public can view publications" ON public.publications
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins can manage publications" ON public.publications;
CREATE POLICY "Admins can manage publications" ON public.publications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 10. ACHIEVEMENTS & AWARDS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY DEFAULT ('ach-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6)),
  title TEXT NOT NULL,
  issuer TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Award',
  description TEXT,
  credential_url TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view achievements" ON public.achievements;
CREATE POLICY "Public can view achievements" ON public.achievements
  FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins can manage achievements" ON public.achievements;
CREATE POLICY "Admins can manage achievements" ON public.achievements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
