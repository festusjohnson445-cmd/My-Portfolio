-- ==============================================================================
-- SUPABASE SCHEMA EXTENSION FOR FESTUS JOHNSON'S PORTFOLIO
-- Tables: projects, project_media, articles, article_categories, article_comments,
--         article_likes, article_views, experience, publications, achievements
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/teszyojnwaedjvqaqake/sql/new
-- ==============================================================================

-- 1. Enable UUID Extension if not already active
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. PROJECTS TABLE & POLICIES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'Mechanical & CAD',
  status TEXT DEFAULT 'Production Deployed',
  featured BOOLEAN DEFAULT false,
  thumbnail_url TEXT DEFAULT '',
  hero_image TEXT DEFAULT '',
  overview TEXT DEFAULT '',
  objectives TEXT DEFAULT '',
  methodology TEXT DEFAULT '',
  technical_specs JSONB DEFAULT '{}'::jsonb,
  cad_drawings JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  videos JSONB DEFAULT '[]'::jsonb,
  tools_used JSONB DEFAULT '[]'::jsonb,
  results TEXT DEFAULT '',
  demo_links JSONB DEFAULT '[]'::jsonb,
  document_url TEXT DEFAULT '',
  document_name TEXT DEFAULT '',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view projects" ON public.projects;
CREATE POLICY "Public can view projects"
  ON public.projects FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Owner can manage projects" ON public.projects;
CREATE POLICY "Owner can manage projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 3. PROJECT MEDIA TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_media (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  media_type TEXT DEFAULT 'image',
  title TEXT DEFAULT '',
  url TEXT NOT NULL,
  storage_path TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view project media" ON public.project_media;
CREATE POLICY "Public can view project media"
  ON public.project_media FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Owner can manage project media" ON public.project_media;
CREATE POLICY "Owner can manage project media"
  ON public.project_media FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 4. ARTICLES & BLOG TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  title TEXT NOT NULL,
  slug TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  content TEXT DEFAULT '',
  category TEXT DEFAULT 'Mechanical Engineering',
  difficulty TEXT DEFAULT 'Intermediate',
  author_name TEXT DEFAULT 'Visitor',
  author_email TEXT DEFAULT '',
  author_role TEXT DEFAULT 'Contributing Engineer',
  is_chief_admin BOOLEAN DEFAULT false,
  thumbnail_url TEXT DEFAULT '',
  hero_media_type TEXT DEFAULT 'image',
  hero_media_url TEXT DEFAULT '',
  reading_time TEXT DEFAULT '5 min read',
  tldr TEXT DEFAULT '',
  table_of_contents JSONB DEFAULT '[]'::jsonb,
  equations JSONB DEFAULT '[]'::jsonb,
  schematics JSONB DEFAULT '[]'::jsonb,
  code_blocks JSONB DEFAULT '[]'::jsonb,
  charts_data JSONB DEFAULT '[]'::jsonb,
  bom_items JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_approved BOOLEAN DEFAULT false,
  is_draft BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published and approved articles" ON public.articles;
CREATE POLICY "Public can view published and approved articles"
  ON public.articles FOR SELECT
  TO public
  USING (is_approved = true AND is_draft = false AND is_archived = false);

DROP POLICY IF EXISTS "Authenticated owner can view all articles" ON public.articles;
CREATE POLICY "Authenticated owner can view all articles"
  ON public.articles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can submit an article for review" ON public.articles;
CREATE POLICY "Anyone can submit an article for review"
  ON public.articles FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated owner can manage articles" ON public.articles;
CREATE POLICY "Authenticated owner can manage articles"
  ON public.articles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 5. ARTICLE CATEGORIES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.article_categories (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  name TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view article categories" ON public.article_categories;
CREATE POLICY "Public can view article categories"
  ON public.article_categories FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Owner can manage article categories" ON public.article_categories;
CREATE POLICY "Owner can manage article categories"
  ON public.article_categories FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed default initial categories
INSERT INTO public.article_categories (name, description, display_order)
VALUES
  ('Mechanical & Optomechanical Design', 'Precision hardware, optomechanical mounts, kinematics, and gimbals', 1),
  ('Structural & Thermal FEA', 'First-principles validation, non-linear FEA, and thermal stress dissipation', 2),
  ('ASME Y14.5 GD&T & Metrology', 'Geometric dimensioning, datums, CMM verification, and stack-up analysis', 3),
  ('CNC Machining & DFM/DFA', '5-axis milling, lathe tooling, design for manufacture, and cost cutting', 4),
  ('Mechatronics & Robotics', 'Servo drives, harmonic gearboxes, embedded control, and actuators', 5),
  ('Materials Science & Composites', 'Aerospace titanium, carbon fiber layup, thermal expansion, and alloys', 6)
ON CONFLICT (name) DO NOTHING;

-- ==============================================================================
-- 6. ARTICLE COMMENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.article_comments (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT DEFAULT '',
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT true,
  is_chief_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view approved article comments" ON public.article_comments;
CREATE POLICY "Public can view approved article comments"
  ON public.article_comments FOR SELECT
  TO public
  USING (is_approved = true);

DROP POLICY IF EXISTS "Authenticated owner can view all comments" ON public.article_comments;
CREATE POLICY "Authenticated owner can view all comments"
  ON public.article_comments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Public can submit comments" ON public.article_comments;
CREATE POLICY "Public can submit comments"
  ON public.article_comments FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated owner can manage comments" ON public.article_comments;
CREATE POLICY "Authenticated owner can manage comments"
  ON public.article_comments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 7. ARTICLE LIKES & VIEWS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.article_likes (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(article_id, user_identifier)
);

ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view and add likes" ON public.article_likes;
CREATE POLICY "Public can view and add likes"
  ON public.article_likes FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.article_views (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT DEFAULT '',
  viewed_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can log views" ON public.article_views;
CREATE POLICY "Public can log views"
  ON public.article_views FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 8. EXPERIENCE TABLE (EXPERIENCE & CAREER)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.experience (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT DEFAULT '',
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  is_current BOOLEAN DEFAULT false,
  description TEXT DEFAULT '',
  key_achievements JSONB DEFAULT '[]'::jsonb,
  technologies JSONB DEFAULT '[]'::jsonb,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view experience" ON public.experience;
CREATE POLICY "Public can view experience"
  ON public.experience FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Owner can manage experience" ON public.experience;
CREATE POLICY "Owner can manage experience"
  ON public.experience FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 9. PUBLICATIONS TABLE (RESEARCH & PUBLICATIONS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.publications (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  title TEXT NOT NULL,
  publisher TEXT DEFAULT '',
  publication_date TEXT DEFAULT '',
  authors TEXT DEFAULT 'Festus Johnson',
  doi_url TEXT DEFAULT '',
  abstract TEXT DEFAULT '',
  file_url TEXT DEFAULT '',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view publications" ON public.publications;
CREATE POLICY "Public can view publications"
  ON public.publications FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Owner can manage publications" ON public.publications;
CREATE POLICY "Owner can manage publications"
  ON public.publications FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 10. ACHIEVEMENTS & AWARDS TABLE (WITH SKILLS MANAGEMENT)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  title TEXT NOT NULL,
  issuer TEXT DEFAULT '',
  date_awarded TEXT DEFAULT '',
  category TEXT DEFAULT 'Award',
  description TEXT DEFAULT '',
  skills_managed JSONB DEFAULT '[]'::jsonb,
  credential_url TEXT DEFAULT '',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view achievements" ON public.achievements;
CREATE POLICY "Public can view achievements"
  ON public.achievements FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Owner can manage achievements" ON public.achievements;
CREATE POLICY "Owner can manage achievements"
  ON public.achievements FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ==============================================================================
-- 11. STORAGE BUCKET VERIFICATION
-- Ensure "Materials" and "avatars" buckets allow uploads
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('Materials', 'Materials', true, 104857600, NULL),
  ('avatars', 'avatars', true, 20971520, NULL)
ON CONFLICT (id) DO UPDATE SET public = true;
