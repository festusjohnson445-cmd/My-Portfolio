-- ==============================================================================
-- FESTUS JOHNSON / FESLINE MECHANICAL ENGINEERING
-- COMPLETE SUPABASE DATABASE SCHEMA & MIGRATION SCRIPT
-- RUN THIS IN YOUR SUPABASE SQL EDITOR TO SETUP ALL TABLES, STORAGE, AND RLS POLICIES
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. PROJECTS TABLE (Engineering Portfolio Showcase)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Mechanical Design',
  description TEXT NOT NULL,
  overview TEXT,
  objectives JSONB DEFAULT '[]'::jsonb,
  methodology JSONB DEFAULT '[]'::jsonb,
  technical_specs JSONB DEFAULT '{}'::jsonb,
  cad_drawings JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  videos JSONB DEFAULT '[]'::jsonb,
  tools_used JSONB DEFAULT '[]'::jsonb,
  results JSONB DEFAULT '[]'::jsonb,
  links JSONB DEFAULT '[]'::jsonb,
  thumbnail_url TEXT,
  document_url TEXT,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. PROJECT MEDIA TABLE (Gallery, Drawings & Video Assets)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_media (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'cad', 'document')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. ARTICLES TABLE (Engineering Articles & Blog)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  thumbnail_url TEXT,
  author_name TEXT NOT NULL DEFAULT 'Festus Johnson',
  author_role TEXT NOT NULL DEFAULT 'Chief Admin',
  is_published BOOLEAN DEFAULT true,
  is_owner_post BOOLEAN DEFAULT false,
  featured BOOLEAN DEFAULT false,
  reading_time_minutes INT DEFAULT 4,
  views_count INT DEFAULT 0,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. ARTICLE CATEGORIES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.article_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. ARTICLE COMMENTS TABLE (Moderation Support)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.article_comments (
  id TEXT PRIMARY KEY,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. ARTICLE LIKES & VIEWS TABLES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.article_likes (
  id TEXT PRIMARY KEY,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, visitor_identifier)
);

CREATE TABLE IF NOT EXISTS public.article_views (
  id TEXT PRIMARY KEY,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_identifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. EXPERIENCE TABLE (Career & Mechanical Roles)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.experience (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  key_achievements JSONB DEFAULT '[]'::jsonb,
  skills JSONB DEFAULT '[]'::jsonb,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. PUBLICATIONS TABLE (Research Whitepapers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.publications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  publisher TEXT NOT NULL,
  date TEXT,
  doi_or_url TEXT,
  description TEXT,
  key_findings JSONB DEFAULT '[]'::jsonb,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 10. ACHIEVEMENTS TABLE (Distinctions & Honors)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  issuer TEXT NOT NULL,
  date TEXT,
  description TEXT,
  badge_icon TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 11. SITE SETTINGS TABLE (Real-Time Universal Customizer)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY,
  settings_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings row if missing
INSERT INTO public.site_settings (id, settings_json)
VALUES ('default', '{
  "activeThemeId": "slate",
  "primaryColor": "#155e75",
  "secondaryColor": "#334155",
  "accentColor": "#0891b2",
  "bgColor": "#dce1e8",
  "surfaceColor": "#ffffff",
  "borderColor": "#b8c6d4",
  "headingColor": "#020617",
  "textColor": "#1e293b",
  "heroButtonSize": "normal",
  "enableAmbientGlow": true,
  "enableMeshDrift": true,
  "enableCardHoverLift": true,
  "enableSmoothEntrance": true,
  "navSize": "standard",
  "navBgColor": "#243346",
  "navBlur": true,
  "navIconSize": "medium",
  "buttonSize": "small",
  "buttonPrimaryColor": "#155e75",
  "buttonSecondaryColor": "#e2e8f0",
  "buttonAlignment": "left",
  "buttonBorderRadius": "subtle",
  "buttonTextTransform": "none"
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Enable Realtime for site_settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
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
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Public READ for portfolio content
CREATE POLICY "Public Read Projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Public Read Project Media" ON public.project_media FOR SELECT USING (true);
CREATE POLICY "Public Read Articles" ON public.articles FOR SELECT USING (is_published = true OR auth.role() = 'authenticated');
CREATE POLICY "Public Read Article Categories" ON public.article_categories FOR SELECT USING (true);
CREATE POLICY "Public Read Approved Comments" ON public.article_comments FOR SELECT USING (status = 'approved' OR auth.role() = 'authenticated');
CREATE POLICY "Public Read Article Likes" ON public.article_likes FOR SELECT USING (true);
CREATE POLICY "Public Read Experience" ON public.experience FOR SELECT USING (true);
CREATE POLICY "Public Read Publications" ON public.publications FOR SELECT USING (true);
CREATE POLICY "Public Read Achievements" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "Public Read Site Settings" ON public.site_settings FOR SELECT USING (true);

-- Visitors can insert comments, likes, views, and visitor article drafts
CREATE POLICY "Visitors Post Comments" ON public.article_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Visitors Like Articles" ON public.article_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "Visitors Delete Own Like" ON public.article_likes FOR DELETE USING (true);
CREATE POLICY "Visitors Record Views" ON public.article_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Visitors Post Articles" ON public.articles FOR INSERT WITH CHECK (true);

-- Authenticated Owner CRUD Permissions
CREATE POLICY "Owner All Projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Project Media" ON public.project_media FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Articles" ON public.articles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Categories" ON public.article_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Comments" ON public.article_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Experience" ON public.experience FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Publications" ON public.publications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Achievements" ON public.achievements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Owner All Site Settings" ON public.site_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 13. STORAGE BUCKETS SETUP
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('portfolio_media', 'portfolio_media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS
CREATE POLICY "Public Read Materials" ON storage.objects FOR SELECT USING (bucket_id IN ('materials', 'portfolio_media', 'avatars'));
CREATE POLICY "Auth Upload Materials" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('materials', 'portfolio_media', 'avatars'));
CREATE POLICY "Auth Update Materials" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('materials', 'portfolio_media', 'avatars'));
CREATE POLICY "Auth Delete Materials" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('materials', 'portfolio_media', 'avatars'));

-- ==============================================================================
-- SETUP COMPLETE
-- ==============================================================================
