-- ============================================================================
-- FESLINE MECHANICAL ENGINEERING: SUPABASE DATABASE EXTENSION
-- Tables for Projects, Media, Articles, Comments, Experience, Publications, Achievements
-- ============================================================================

-- 1. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'CAD & Mechanical',
  description TEXT NOT NULL,
  overview TEXT,
  objectives TEXT,
  methodology TEXT,
  results TEXT,
  demo_link TEXT,
  thumbnail_url TEXT,
  tools TEXT[] DEFAULT ARRAY[]::TEXT[],
  specs JSONB DEFAULT '{}'::jsonb,
  cad_drawings JSONB DEFAULT '[]'::jsonb,
  is_featured BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view projects" ON public.projects;
CREATE POLICY "Public can view projects" ON public.projects
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner can manage projects" ON public.projects;
CREATE POLICY "Owner can manage projects" ON public.projects
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. PROJECT MEDIA TABLE
CREATE TABLE IF NOT EXISTS public.project_media (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'image', -- 'image', 'video', 'drawing', 'document'
  caption TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view project media" ON public.project_media;
CREATE POLICY "Public can view project media" ON public.project_media
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner can manage project media" ON public.project_media;
CREATE POLICY "Owner can manage project media" ON public.project_media
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. ARTICLE CATEGORIES
CREATE TABLE IF NOT EXISTS public.article_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view article categories" ON public.article_categories;
CREATE POLICY "Public can view article categories" ON public.article_categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner can manage article categories" ON public.article_categories;
CREATE POLICY "Owner can manage article categories" ON public.article_categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. ARTICLES TABLE
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  author_role TEXT DEFAULT 'Visitor',
  author_email TEXT,
  is_owner BOOLEAN DEFAULT false,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Mechanical Design',
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  cover_image TEXT,
  reading_time_minutes INT DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending', -- 'draft', 'pending', 'published', 'archived'
  likes_count INT DEFAULT 0,
  views_count INT DEFAULT 0,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published articles" ON public.articles;
CREATE POLICY "Public can view published articles" ON public.articles
  FOR SELECT USING (status = 'published' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone can submit articles" ON public.articles;
CREATE POLICY "Anyone can submit articles" ON public.articles
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Owner can manage articles" ON public.articles;
CREATE POLICY "Owner can manage articles" ON public.articles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. ARTICLE COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.article_comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view approved comments" ON public.article_comments;
CREATE POLICY "Public can view approved comments" ON public.article_comments
  FOR SELECT USING (is_approved = true OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Anyone can submit comments" ON public.article_comments;
CREATE POLICY "Anyone can submit comments" ON public.article_comments
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Owner can manage comments" ON public.article_comments;
CREATE POLICY "Owner can manage comments" ON public.article_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. ARTICLE LIKES TABLE
CREATE TABLE IF NOT EXISTS public.article_likes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_article_visitor_like UNIQUE(article_id, visitor_id)
);

ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read and add likes" ON public.article_likes;
CREATE POLICY "Public can read and add likes" ON public.article_likes
  FOR ALL USING (true) WITH CHECK (true);

-- 7. ARTICLE VIEWS TABLE
CREATE TABLE IF NOT EXISTS public.article_views (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can record views" ON public.article_views;
CREATE POLICY "Public can record views" ON public.article_views
  FOR ALL USING (true) WITH CHECK (true);

-- 8. EXPERIENCE TABLE (Career history)
CREATE TABLE IF NOT EXISTS public.experience (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  achievements TEXT[] DEFAULT ARRAY[]::TEXT[],
  skills TEXT[] DEFAULT ARRAY[]::TEXT[],
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view experience" ON public.experience;
CREATE POLICY "Public can view experience" ON public.experience
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner can manage experience" ON public.experience;
CREATE POLICY "Owner can manage experience" ON public.experience
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. PUBLICATIONS TABLE (Research & publications)
CREATE TABLE IF NOT EXISTS public.publications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  authors TEXT NOT NULL,
  publisher TEXT,
  publication_date TEXT,
  doi_url TEXT,
  abstract TEXT,
  pdf_url TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view publications" ON public.publications;
CREATE POLICY "Public can view publications" ON public.publications
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner can manage publications" ON public.publications;
CREATE POLICY "Owner can manage publications" ON public.publications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 10. ACHIEVEMENTS TABLE (Awards, Certifications, Honors)
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  issuer TEXT NOT NULL,
  date_awarded TEXT,
  description TEXT,
  badge_url TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view achievements" ON public.achievements;
CREATE POLICY "Public can view achievements" ON public.achievements
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Owner can manage achievements" ON public.achievements;
CREATE POLICY "Owner can manage achievements" ON public.achievements
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.article_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.experience;
ALTER PUBLICATION supabase_realtime ADD TABLE public.publications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.achievements;
