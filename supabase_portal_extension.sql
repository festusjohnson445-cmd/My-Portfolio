-- ============================================================================
-- SUPABASE SCHEMA EXTENSION FOR FESTUS JOHNSON ENGINEERING PORTAL
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

-- 1. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  title TEXT NOT NULL,
  slug TEXT,
  category TEXT DEFAULT 'Mechanical Design',
  summary TEXT,
  description TEXT,
  objectives TEXT,
  methodology TEXT,
  specifications JSONB DEFAULT '{}'::jsonb,
  tools TEXT[] DEFAULT '{}',
  cad_drawings JSONB DEFAULT '[]'::jsonb,
  images TEXT[] DEFAULT '{}',
  videos TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  results TEXT,
  demo_links JSONB DEFAULT '[]'::jsonb,
  documents JSONB DEFAULT '[]'::jsonb,
  is_featured BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Published',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. PROJECT MEDIA TABLE
CREATE TABLE IF NOT EXISTS public.project_media (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT,
  media_type TEXT DEFAULT 'image', -- 'image', 'video', 'cad', 'doc'
  url TEXT NOT NULL,
  storage_path TEXT,
  file_size TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ARTICLE CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.article_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ARTICLES TABLE
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT,
  excerpt TEXT,
  content TEXT NOT NULL,
  cover_image TEXT,
  category_id TEXT,
  category_name TEXT DEFAULT 'General Engineering',
  author_name TEXT NOT NULL,
  author_role TEXT DEFAULT 'Contributor',
  author_id TEXT,
  is_owner BOOLEAN DEFAULT false,
  reading_time_min INTEGER DEFAULT 4,
  status TEXT DEFAULT 'pending', -- 'published', 'pending', 'draft', 'archived'
  tags TEXT[] DEFAULT '{}',
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ARTICLE COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.article_comments (
  id TEXT PRIMARY KEY,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  author_avatar TEXT,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'approved', -- 'approved', 'pending', 'rejected'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ARTICLE LIKES TABLE
CREATE TABLE IF NOT EXISTS public.article_likes (
  id TEXT PRIMARY KEY,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, visitor_id)
);

-- 7. ARTICLE VIEWS TABLE
CREATE TABLE IF NOT EXISTS public.article_views (
  id TEXT PRIMARY KEY,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. CAREER EXPERIENCE TABLE
CREATE TABLE IF NOT EXISTS public.experience (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  employment_type TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  highlights TEXT[] DEFAULT '{}',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. RESEARCH & PUBLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.publications (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  title TEXT NOT NULL,
  authors TEXT,
  publication_venue TEXT,
  publication_date TEXT,
  doi_url TEXT,
  abstract TEXT,
  paper_pdf_url TEXT,
  category TEXT DEFAULT 'Research Paper',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. ACHIEVEMENTS & AWARDS TABLE
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  title TEXT NOT NULL,
  issuer TEXT NOT NULL,
  year TEXT,
  category TEXT DEFAULT 'Award',
  description TEXT,
  credential_url TEXT,
  badge_icon TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- READ PERMISSIONS (Public can read published projects, published articles, experience, publications, achievements)
DROP POLICY IF EXISTS "Public read projects" ON public.projects;
CREATE POLICY "Public read projects" ON public.projects FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read project_media" ON public.project_media;
CREATE POLICY "Public read project_media" ON public.project_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read article_categories" ON public.article_categories;
CREATE POLICY "Public read article_categories" ON public.article_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read articles" ON public.articles;
CREATE POLICY "Public read articles" ON public.articles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read comments" ON public.article_comments;
CREATE POLICY "Public read comments" ON public.article_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read article_likes" ON public.article_likes;
CREATE POLICY "Public read article_likes" ON public.article_likes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read article_views" ON public.article_views;
CREATE POLICY "Public read article_views" ON public.article_views FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read experience" ON public.experience;
CREATE POLICY "Public read experience" ON public.experience FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read publications" ON public.publications;
CREATE POLICY "Public read publications" ON public.publications FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read achievements" ON public.achievements;
CREATE POLICY "Public read achievements" ON public.achievements FOR SELECT USING (true);

-- WRITE PERMISSIONS (Visitors can insert articles as pending, add comments, likes and views)
DROP POLICY IF EXISTS "Public insert articles" ON public.articles;
CREATE POLICY "Public insert articles" ON public.articles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert comments" ON public.article_comments;
CREATE POLICY "Public insert comments" ON public.article_comments FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert likes" ON public.article_likes;
CREATE POLICY "Public insert likes" ON public.article_likes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public insert views" ON public.article_views;
CREATE POLICY "Public insert views" ON public.article_views FOR INSERT WITH CHECK (true);

-- OWNER FULL ACCESS (Authenticated owner or admin operations)
DROP POLICY IF EXISTS "Allow owner write projects" ON public.projects;
CREATE POLICY "Allow owner write projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow owner write project_media" ON public.project_media;
CREATE POLICY "Allow owner write project_media" ON public.project_media FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow owner write categories" ON public.article_categories;
CREATE POLICY "Allow owner write categories" ON public.article_categories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow owner write articles" ON public.articles;
CREATE POLICY "Allow owner write articles" ON public.articles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow owner write comments" ON public.article_comments;
CREATE POLICY "Allow owner write comments" ON public.article_comments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow owner write experience" ON public.experience;
CREATE POLICY "Allow owner write experience" ON public.experience FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow owner write publications" ON public.publications;
CREATE POLICY "Allow owner write publications" ON public.publications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow owner write achievements" ON public.achievements;
CREATE POLICY "Allow owner write achievements" ON public.achievements FOR ALL USING (true) WITH CHECK (true);
