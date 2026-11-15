-- ============================================================================
-- FESTUS JOHNSON / FESLINE MECHANICAL ENGINEERING
-- SUPABASE RELATIONAL UPGRADE SCHEMA & RLS POLICIES
-- ============================================================================
-- Execute this entire script in the Supabase SQL Editor:
-- https://supabase.com/dashboard/project/_/sql

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: PROJECTS & PROJECT MEDIA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tagline TEXT,
  category TEXT NOT NULL DEFAULT 'CAD',
  completion_date TEXT,
  role TEXT DEFAULT 'Lead Mechanical Design Engineer',
  lead_time_weeks INTEGER DEFAULT 8,
  status TEXT DEFAULT 'Production Deployed',
  model_type TEXT DEFAULT 'harmonic_actuator',
  hero_image TEXT,
  cad_model_image TEXT,
  physical_build_image TEXT,
  fea_plot_image TEXT,
  website_url TEXT,
  github_url TEXT,
  metrics JSONB DEFAULT '[]'::jsonb,
  problem_constraints JSONB DEFAULT '{}'::jsonb,
  hand_calculations JSONB DEFAULT '[]'::jsonb,
  fea_boundary_conditions JSONB DEFAULT '{}'::jsonb,
  individual_contributions JSONB DEFAULT '[]'::jsonb,
  verified_credentials JSONB DEFAULT '[]'::jsonb,
  bom JSONB DEFAULT '[]'::jsonb,
  calculation_whitepaper JSONB DEFAULT '{}'::jsonb,
  supervisor_endorsements JSONB DEFAULT '[]'::jsonb,
  gdt_spec JSONB DEFAULT '{}'::jsonb,
  ip_compliance_disclaimer TEXT,
  is_featured BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL, -- 'image' | 'cad_drawing' | 'fea_plot' | 'video'
  title TEXT,
  url TEXT NOT NULL,
  caption TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: SERVICES & SERVICE REQUESTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tagline TEXT,
  category TEXT NOT NULL,
  icon_name TEXT DEFAULT 'Wrench',
  description TEXT NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  deliverables JSONB DEFAULT '[]'::jsonb,
  tools_and_software JSONB DEFAULT '[]'::jsonb,
  turnaround_time TEXT,
  pricing_model TEXT,
  is_featured BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_company TEXT,
  service_category TEXT NOT NULL,
  project_title TEXT NOT NULL,
  project_description TEXT NOT NULL,
  timeline_requirement TEXT,
  budget_range TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  status TEXT DEFAULT 'pending', -- 'pending' | 'in_review' | 'accepted' | 'declined' | 'archived'
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: ARTICLES, CATEGORIES, COMMENTS, LIKES, VIEWS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  cover_image TEXT,
  category TEXT NOT NULL DEFAULT 'Engineering',
  tags JSONB DEFAULT '[]'::jsonb,
  author_name TEXT DEFAULT 'Festus Johnson',
  author_role TEXT DEFAULT 'Lead Mechanical Design Engineer',
  author_avatar TEXT,
  reading_time_minutes INTEGER DEFAULT 5,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.article_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.article_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  author_role TEXT DEFAULT 'Engineering Colleague',
  author_avatar TEXT,
  content TEXT NOT NULL,
  is_approved BOOLEAN DEFAULT true, -- Auto-approve or admin moderation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.article_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, visitor_id)
);

CREATE TABLE IF NOT EXISTS public.article_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: CAREER EXPERIENCE, PUBLICATIONS, ACHIEVEMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.experience (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  employment_type TEXT DEFAULT 'Full-time',
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_current BOOLEAN DEFAULT false,
  summary TEXT NOT NULL,
  key_achievements JSONB DEFAULT '[]'::jsonb,
  technologies_used JSONB DEFAULT '[]'::jsonb,
  project_ids JSONB DEFAULT '[]'::jsonb,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.publications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  authors JSONB DEFAULT '["Festus Johnson"]'::jsonb,
  publication_venue TEXT NOT NULL,
  publication_type TEXT NOT NULL DEFAULT 'Whitepaper',
  date TEXT NOT NULL,
  abstract TEXT NOT NULL,
  doi TEXT,
  download_url TEXT,
  file_name TEXT,
  pages INTEGER,
  citations_count INTEGER DEFAULT 0,
  tags JSONB DEFAULT '[]'::jsonb,
  is_featured BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  issuer TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Certification',
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  credential_id TEXT,
  verification_url TEXT,
  image_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR HIGH-SPEED QUERYING & FILTERING
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_status ON public.service_requests(status);
CREATE INDEX IF NOT EXISTS idx_service_requests_created ON public.service_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_published ON public.articles(is_published, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_comments_article_id ON public.article_comments(article_id);
CREATE INDEX IF NOT EXISTS idx_experience_order ON public.experience(order_index ASC);
CREATE INDEX IF NOT EXISTS idx_publications_date ON public.publications(date DESC);
CREATE INDEX IF NOT EXISTS idx_achievements_order ON public.achievements(order_index ASC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Access for Dossier Visitors
CREATE POLICY "Public read projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Public read project_media" ON public.project_media FOR SELECT USING (true);
CREATE POLICY "Public read services" ON public.services FOR SELECT USING (true);
CREATE POLICY "Public read published articles" ON public.articles FOR SELECT USING (is_published = true OR auth.role() = 'authenticated');
CREATE POLICY "Public read article_categories" ON public.article_categories FOR SELECT USING (true);
CREATE POLICY "Public read approved comments" ON public.article_comments FOR SELECT USING (is_approved = true OR auth.role() = 'authenticated');
CREATE POLICY "Public read likes" ON public.article_likes FOR SELECT USING (true);
CREATE POLICY "Public read views" ON public.article_views FOR SELECT USING (true);
CREATE POLICY "Public read experience" ON public.experience FOR SELECT USING (true);
CREATE POLICY "Public read publications" ON public.publications FOR SELECT USING (true);
CREATE POLICY "Public read achievements" ON public.achievements FOR SELECT USING (true);

-- 2. Public / Visitor Write Access for Interactive Submissions
-- Anyone can submit a service request inquiry
CREATE POLICY "Public insert service_requests" ON public.service_requests FOR INSERT WITH CHECK (true);
-- Anyone can submit an article comment
CREATE POLICY "Public insert article_comments" ON public.article_comments FOR INSERT WITH CHECK (true);
-- Anyone can like or view an article
CREATE POLICY "Public insert article_likes" ON public.article_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public insert article_views" ON public.article_views FOR INSERT WITH CHECK (true);

-- 3. Authenticated Admin Full CRUD Access
-- (Authorized email: festusjohnson028@gmail.com or authenticated session)
CREATE POLICY "Admin write projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin write project_media" ON public.project_media FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin write services" ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin manage service_requests" ON public.service_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin write articles" ON public.articles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin write article_categories" ON public.article_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin manage comments" ON public.article_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin write experience" ON public.experience FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin write publications" ON public.publications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin write achievements" ON public.achievements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Output confirmation
SELECT 'Festus Johnson Portfolio Supabase Schema successfully applied.' as status;
