-- ==============================================================================
-- FESLINE SUPABASE DATABASE EXTENSION & SCHEMA SETUP
-- Run this SQL in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/teszyojnwaedjvqaqake/sql/new
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Engineering',
  thumbnail_url TEXT,
  overview TEXT,
  objectives TEXT,
  methodology TEXT,
  technical_specifications TEXT,
  cad_drawings JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  videos JSONB DEFAULT '[]'::jsonb,
  tools_used JSONB DEFAULT '[]'::jsonb,
  results TEXT,
  demo_links JSONB DEFAULT '[]'::jsonb,
  document_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROJECT MEDIA TABLE
CREATE TABLE IF NOT EXISTS public.project_media (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ARTICLES TABLE
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  content TEXT NOT NULL,
  excerpt TEXT,
  thumbnail_url TEXT,
  video_url TEXT,
  file_url TEXT,
  author_name TEXT NOT NULL DEFAULT 'Visitor',
  author_role TEXT DEFAULT 'Engineering Contributor',
  is_chief_admin BOOLEAN DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'published',
  reading_time_minutes INTEGER DEFAULT 3,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ARTICLE CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.article_categories (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ARTICLE COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.article_comments (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ARTICLE LIKES TABLE
CREATE TABLE IF NOT EXISTS public.article_likes (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, user_identifier)
);

-- 8. ARTICLE VIEWS TABLE
CREATE TABLE IF NOT EXISTS public.article_views (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_ip_or_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. EXPERIENCE TABLE
CREATE TABLE IF NOT EXISTS public.experience (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_current BOOLEAN DEFAULT FALSE,
  description TEXT NOT NULL,
  key_achievements JSONB DEFAULT '[]'::jsonb,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. PUBLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.publications (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  title TEXT NOT NULL,
  publisher TEXT NOT NULL,
  date TEXT,
  doi_or_url TEXT,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'Research',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ACHIEVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  title TEXT NOT NULL,
  issuer TEXT NOT NULL,
  date TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Award',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- PUBLIC READ POLICIES (Everyone can read public content)
CREATE POLICY "Public Read Projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Public Read Project Media" ON public.project_media FOR SELECT USING (true);
CREATE POLICY "Public Read Articles" ON public.articles FOR SELECT USING (status = 'published');
CREATE POLICY "Public Read Categories" ON public.article_categories FOR SELECT USING (true);
CREATE POLICY "Public Read Comments" ON public.article_comments FOR SELECT USING (is_approved = true);
CREATE POLICY "Public Read Likes" ON public.article_likes FOR SELECT USING (true);
CREATE POLICY "Public Read Experience" ON public.experience FOR SELECT USING (true);
CREATE POLICY "Public Read Publications" ON public.publications FOR SELECT USING (true);
CREATE POLICY "Public Read Achievements" ON public.achievements FOR SELECT USING (true);

-- PUBLIC INSERT POLICIES (Visitors can submit articles, comments, likes)
CREATE POLICY "Public Insert Articles" ON public.articles FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Insert Comments" ON public.article_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Insert Likes" ON public.article_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Delete Likes" ON public.article_likes FOR DELETE USING (true);
CREATE POLICY "Public Insert Views" ON public.article_views FOR INSERT WITH CHECK (true);

-- AUTHENTICATED OWNER FULL CONTROL POLICIES
CREATE POLICY "Owner All Projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Project Media" ON public.project_media FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Articles" ON public.articles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Categories" ON public.article_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Comments" ON public.article_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Experience" ON public.experience FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Publications" ON public.publications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Achievements" ON public.achievements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- STORAGE PERMISSIONS FOR MATERIALS BUCKET
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('materials', 'materials', true, 104857600, NULL)
ON CONFLICT (id) DO UPDATE SET public = true;
