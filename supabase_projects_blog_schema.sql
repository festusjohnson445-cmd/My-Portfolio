-- ==============================================================================
-- SUPABASE DATABASE SCHEMA EXTENSION: PROJECTS, BLOG / ARTICLES, 
-- COMMENTS, EXPERIENCE, PUBLICATIONS, AND ACHIEVEMENTS
-- Run this SQL in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/teszyojnwaedjvqaqake/sql/new
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY DEFAULT ('proj_' || replace(uuid_generate_v4()::text, '-', '')),
  title TEXT NOT NULL,
  slug TEXT,
  tagline TEXT,
  description TEXT,
  category TEXT DEFAULT 'CAD',
  status TEXT DEFAULT 'Validated Prototype',
  featured BOOLEAN DEFAULT false,
  thumbnail_url TEXT,
  overview TEXT,
  objectives TEXT,
  methodology TEXT,
  technical_specifications JSONB DEFAULT '{}'::jsonb,
  cad_drawings JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  videos JSONB DEFAULT '[]'::jsonb,
  tools_used JSONB DEFAULT '[]'::jsonb,
  results TEXT,
  demonstration_links JSONB DEFAULT '[]'::jsonb,
  downloadable_documents JSONB DEFAULT '[]'::jsonb,
  views_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PROJECT MEDIA TABLE
CREATE TABLE IF NOT EXISTS public.project_media (
  id TEXT PRIMARY KEY DEFAULT ('media_' || replace(uuid_generate_v4()::text, '-', '')),
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL DEFAULT 'image', -- 'image', 'video', 'cad', 'document'
  title TEXT,
  file_name TEXT,
  file_url TEXT NOT NULL,
  file_size TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ARTICLE CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.article_categories (
  id TEXT PRIMARY KEY DEFAULT ('cat_' || replace(uuid_generate_v4()::text, '-', '')),
  name TEXT NOT NULL UNIQUE,
  slug TEXT,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed initial standard categories if empty
INSERT INTO public.article_categories (name, slug, description, display_order)
VALUES 
  ('Mechanical Engineering', 'mechanical-engineering', 'Precision mechanism design, tolerances, and kinematic systems', 1),
  ('3D CAD & Modeling', '3d-cad-modeling', 'Parametric surface modeling, assembly design, and GD&T', 2),
  ('FEA & Simulation', 'fea-simulation', 'Structural analysis, modal resonance, and thermal simulations', 3),
  ('Manufacturing & CNC', 'manufacturing-cnc', 'DFM, 5-axis CNC machining, tooling, and fabrication', 4),
  ('Robotics & Automation', 'robotics-automation', 'Actuators, motor sizing, and autonomous systems', 5),
  ('Engineering Thoughts', 'engineering-thoughts', 'Philosophy, career insights, and engineering reflections', 6)
ON CONFLICT (name) DO NOTHING;

-- 5. ARTICLES TABLE
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY DEFAULT ('art_' || replace(uuid_generate_v4()::text, '-', '')),
  title TEXT NOT NULL,
  slug TEXT,
  category TEXT DEFAULT 'Mechanical Engineering',
  author_name TEXT DEFAULT 'Festus, Olorunsogo Johnson',
  author_role TEXT DEFAULT 'Chief Admin',
  is_chief_admin BOOLEAN DEFAULT true,
  cover_image TEXT,
  excerpt TEXT,
  content TEXT NOT NULL,
  reading_time TEXT DEFAULT '5 min read',
  tags JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'published', -- 'published', 'pending', 'draft', 'archived'
  submitted_by TEXT DEFAULT 'owner', -- 'owner', 'visitor'
  visitor_email TEXT,
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. ARTICLE COMMENTS TABLE
CREATE TABLE IF NOT EXISTS public.article_comments (
  id TEXT PRIMARY KEY DEFAULT ('comm_' || replace(uuid_generate_v4()::text, '-', '')),
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  author_avatar TEXT,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'approved', -- 'approved', 'pending', 'rejected'
  parent_comment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. ARTICLE LIKES TABLE
CREATE TABLE IF NOT EXISTS public.article_likes (
  id TEXT PRIMARY KEY DEFAULT ('like_' || replace(uuid_generate_v4()::text, '-', '')),
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, visitor_id)
);

-- 8. ARTICLE VIEWS TABLE
CREATE TABLE IF NOT EXISTS public.article_views (
  id TEXT PRIMARY KEY DEFAULT ('view_' || replace(uuid_generate_v4()::text, '-', '')),
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT,
  ip_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. EXPERIENCE & CAREER TABLE
CREATE TABLE IF NOT EXISTS public.experience (
  id TEXT PRIMARY KEY DEFAULT ('exp_' || replace(uuid_generate_v4()::text, '-', '')),
  role TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  period TEXT NOT NULL,
  current BOOLEAN DEFAULT false,
  description TEXT,
  responsibilities JSONB DEFAULT '[]'::jsonb,
  technologies JSONB DEFAULT '[]'::jsonb,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. RESEARCH & PUBLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.publications (
  id TEXT PRIMARY KEY DEFAULT ('pub_' || replace(uuid_generate_v4()::text, '-', '')),
  title TEXT NOT NULL,
  authors TEXT,
  journal_or_conference TEXT,
  publication_date TEXT,
  doi_or_url TEXT,
  description TEXT,
  pdf_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. ACHIEVEMENTS & AWARDS TABLE
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY DEFAULT ('ach_' || replace(uuid_generate_v4()::text, '-', '')),
  title TEXT NOT NULL,
  issuer TEXT,
  date TEXT,
  credential_id TEXT,
  category TEXT DEFAULT 'Award', -- 'Award', 'Certification', 'Patent', 'Honor'
  description TEXT,
  verification_url TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. ENABLE ROW LEVEL SECURITY (RLS)
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

-- 13. POLICIES: PUBLIC READ ACCESS
DROP POLICY IF EXISTS "Public can view published projects" ON public.projects;
CREATE POLICY "Public can view published projects" ON public.projects FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can view project media" ON public.project_media;
CREATE POLICY "Public can view project media" ON public.project_media FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can view article categories" ON public.article_categories;
CREATE POLICY "Public can view article categories" ON public.article_categories FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can view published articles" ON public.articles;
CREATE POLICY "Public can view published articles" ON public.articles FOR SELECT TO public USING (status = 'published' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public can view approved comments" ON public.article_comments;
CREATE POLICY "Public can view approved comments" ON public.article_comments FOR SELECT TO public USING (status = 'approved' OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Public can view article likes" ON public.article_likes;
CREATE POLICY "Public can view article likes" ON public.article_likes FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can view experience" ON public.experience;
CREATE POLICY "Public can view experience" ON public.experience FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can view publications" ON public.publications;
CREATE POLICY "Public can view publications" ON public.publications FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public can view achievements" ON public.achievements;
CREATE POLICY "Public can view achievements" ON public.achievements FOR SELECT TO public USING (true);

-- 14. POLICIES: VISITOR ACTIONS (Insert comments, likes, article submissions)
DROP POLICY IF EXISTS "Visitors can submit comments" ON public.article_comments;
CREATE POLICY "Visitors can submit comments" ON public.article_comments FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Visitors can like articles" ON public.article_likes;
CREATE POLICY "Visitors can like articles" ON public.article_likes FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Visitors can submit articles for review" ON public.articles;
CREATE POLICY "Visitors can submit articles for review" ON public.articles FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Record article views" ON public.article_views;
CREATE POLICY "Record article views" ON public.article_views FOR INSERT TO public WITH CHECK (true);

-- 15. POLICIES: AUTHENTICATED OWNER FULL CRUD
DROP POLICY IF EXISTS "Owner full access on projects" ON public.projects;
CREATE POLICY "Owner full access on projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owner full access on project media" ON public.project_media;
CREATE POLICY "Owner full access on project media" ON public.project_media FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owner full access on article categories" ON public.article_categories;
CREATE POLICY "Owner full access on article categories" ON public.article_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owner full access on articles" ON public.articles;
CREATE POLICY "Owner full access on articles" ON public.articles FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owner full access on article comments" ON public.article_comments;
CREATE POLICY "Owner full access on article comments" ON public.article_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owner full access on experience" ON public.experience;
CREATE POLICY "Owner full access on experience" ON public.experience FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owner full access on publications" ON public.publications;
CREATE POLICY "Owner full access on publications" ON public.publications FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Owner full access on achievements" ON public.achievements;
CREATE POLICY "Owner full access on achievements" ON public.achievements FOR ALL TO authenticated USING (true) WITH CHECK (true);
