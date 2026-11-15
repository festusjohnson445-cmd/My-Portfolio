// Export comprehensive migration SQL script for real-time in-app copying and inspection in Admin Dashboard
export const SUPABASE_COMPREHENSIVE_MIGRATION_SQL = `-- ==============================================================================
-- FESLINE PORTFOLIO & CMS: COMPREHENSIVE SUPABASE DATABASE MIGRATION SCRIPT
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. SITE SETTINGS TABLE (DYNAMIC THEME, CSS VARIABLES, & LAYOUT CONFIG)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'global_settings',
  theme_mode TEXT NOT NULL DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark', 'auto')),
  primary_color TEXT NOT NULL DEFAULT '#164e63',
  secondary_color TEXT NOT NULL DEFAULT '#0891b2',
  bg_primary TEXT NOT NULL DEFAULT '#dce1e8',
  text_primary TEXT NOT NULL DEFAULT '#0f172a',
  button_border_radius TEXT NOT NULL DEFAULT '0.75rem',
  button_padding_y TEXT NOT NULL DEFAULT '0.5rem',
  button_padding_x TEXT NOT NULL DEFAULT '1rem',
  button_font_size TEXT NOT NULL DEFAULT '0.8125rem',
  button_hover_effect TEXT NOT NULL DEFAULT 'scale-subtle',
  button_alignment TEXT NOT NULL DEFAULT 'center',
  navbar_bg TEXT NOT NULL DEFAULT 'rgba(214, 220, 228, 0.95)',
  navbar_height TEXT NOT NULL DEFAULT '4rem',
  hero_animation_enabled BOOLEAN NOT NULL DEFAULT true,
  card_animation_enabled BOOLEAN NOT NULL DEFAULT true,
  homepage_cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_form_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  resume_pdf_settings JSONB NOT NULL DEFAULT '{
    "font_family": "Times New Roman",
    "margin_mm": 15,
    "header_font_size": 18,
    "body_font_size": 10,
    "section_order": ["summary", "experience", "education", "credentials", "skills", "projects"]
  }'::jsonb,
  projects_articles_config JSONB NOT NULL DEFAULT '{
    "video_aspect_ratio": "16:9",
    "video_fit_mode": "cover",
    "video_zoom_level": 100,
    "cad_viewer_auto_rotate": true
  }'::jsonb,
  profile_sections_config JSONB NOT NULL DEFAULT '[
    {"id": "bio", "title": "Bio & About", "visible": true, "order": 1},
    {"id": "experience", "title": "Experience & Career", "visible": true, "order": 2},
    {"id": "research", "title": "Research & Publications", "visible": true, "order": 3},
    {"id": "achievements", "title": "Achievements & Awards", "visible": true, "order": 4}
  ]'::jsonb,
  footer_config JSONB NOT NULL DEFAULT '{
    "copyright_text": "© 2026 Festus, Olorunsogo Johnson · Fesline Mechanical Engineering",
    "bg_color": "#d2d8e1",
    "text_size": "xs",
    "alignment": "center",
    "custom_links": []
  }'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view site settings" ON public.site_settings;
CREATE POLICY "Public can view site settings" ON public.site_settings FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Authenticated owner can update site settings" ON public.site_settings;
CREATE POLICY "Authenticated owner can update site settings" ON public.site_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.site_settings (id, theme_mode, primary_color, secondary_color, bg_primary, text_primary)
VALUES ('global_settings', 'light', '#164e63', '#0891b2', '#dce1e8', '#0f172a')
ON CONFLICT (id) DO NOTHING;

-- 2. PROJECTS & PROJECT MEDIA
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'CAD' CHECK (category IN ('CAD', 'Web', 'General')),
  template_type TEXT NOT NULL DEFAULT 'cad' CHECK (template_type IN ('cad', 'web', 'general')),
  completion_date TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'Lead Mechanical Design Engineer',
  lead_time_weeks INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'Validated Prototype',
  overview TEXT NOT NULL DEFAULT '',
  objectives TEXT NOT NULL DEFAULT '',
  methodology TEXT NOT NULL DEFAULT '',
  technical_specifications TEXT NOT NULL DEFAULT '',
  cad_drawings_url TEXT DEFAULT NULL,
  website_url TEXT DEFAULT NULL,
  live_demo_url TEXT DEFAULT NULL,
  tools_used TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  results TEXT NOT NULL DEFAULT '',
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  media_gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  hero_image TEXT NOT NULL DEFAULT '',
  video_url TEXT DEFAULT NULL,
  video_settings JSONB NOT NULL DEFAULT '{"aspect_ratio": "16:9", "fit_mode": "cover", "zoom_level": 100}'::jsonb,
  owner_id UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.project_media (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video', 'cad', 'pdf')),
  title TEXT NOT NULL DEFAULT '',
  sanitized_filename TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view projects" ON public.projects;
CREATE POLICY "Public can view projects" ON public.projects FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner manage projects" ON public.projects;
CREATE POLICY "Owner manage projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public can view media" ON public.project_media;
CREATE POLICY "Public can view media" ON public.project_media FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner manage media" ON public.project_media;
CREATE POLICY "Owner manage media" ON public.project_media FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. BLOG & ENGINEERING ARTICLES
CREATE TABLE IF NOT EXISTS public.article_categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.article_categories (name, description)
VALUES 
  ('Mechanical & CAD Design', 'Finite element analysis, 3D modeling, GD&T'),
  ('Manufacturing & CNC', 'Machining, digital fabrication, DFM/DFA'),
  ('Software & Web Systems', 'Full stack web development, CAD visualizers'),
  ('Robotics & Mechatronics', 'Kinematics, actuators, motion control'),
  ('General Engineering', 'Engineering research, physics first principles')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  discipline_tag TEXT NOT NULL DEFAULT 'Mechanical Design',
  category TEXT NOT NULL DEFAULT 'Mechanical & CAD Design',
  difficulty TEXT NOT NULL DEFAULT 'Intermediate' CHECK (difficulty IN ('Introductory', 'Intermediate', 'Advanced')),
  reading_time_min INTEGER NOT NULL DEFAULT 5,
  thumbnail_url TEXT NOT NULL DEFAULT '',
  hero_media_type TEXT NOT NULL DEFAULT 'image' CHECK (hero_media_type IN ('image', 'pdf', 'diagram', 'video', 'cad_embed')),
  hero_media_url TEXT DEFAULT NULL,
  tldr_summary TEXT NOT NULL DEFAULT '',
  bom_table JSONB NOT NULL DEFAULT '[]'::jsonb,
  downloadable_files JSONB NOT NULL DEFAULT '[]'::jsonb,
  author_name TEXT NOT NULL DEFAULT 'Festus Johnson',
  author_tag TEXT NOT NULL DEFAULT 'Chief Admin',
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  likes_count INTEGER NOT NULL DEFAULT 0,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.article_comments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL DEFAULT 'Visitor Engineer',
  comment_text TEXT NOT NULL,
  is_approved BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.article_likes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_article_visitor_like UNIQUE (article_id, visitor_id)
);

CREATE TABLE IF NOT EXISTS public.article_views (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  article_id TEXT NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.article_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view categories" ON public.article_categories;
CREATE POLICY "Public view categories" ON public.article_categories FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Public view approved articles" ON public.articles;
CREATE POLICY "Public view approved articles" ON public.articles FOR SELECT TO public USING (is_approved = true AND is_archived = false);
DROP POLICY IF EXISTS "Owner view all articles" ON public.articles;
CREATE POLICY "Owner view all articles" ON public.articles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Insert articles" ON public.articles;
CREATE POLICY "Insert articles" ON public.articles FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Owner manage articles" ON public.articles;
CREATE POLICY "Owner manage articles" ON public.articles FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public view comments" ON public.article_comments;
CREATE POLICY "Public view comments" ON public.article_comments FOR SELECT TO public USING (is_approved = true AND is_archived = false);
DROP POLICY IF EXISTS "Insert comments" ON public.article_comments;
CREATE POLICY "Insert comments" ON public.article_comments FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Owner manage comments" ON public.article_comments;
CREATE POLICY "Owner manage comments" ON public.article_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public likes" ON public.article_likes;
CREATE POLICY "Public likes" ON public.article_likes FOR ALL TO public USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public views" ON public.article_views;
CREATE POLICY "Public views" ON public.article_views FOR INSERT TO public WITH CHECK (true);

-- 4. EXPERIENCE, PUBLICATIONS & ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.experience (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  period TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  key_achievements TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.publications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  journal_or_venue TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '',
  link_url TEXT DEFAULT NULL,
  doi TEXT DEFAULT NULL,
  abstract TEXT NOT NULL DEFAULT '',
  co_authors TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Award',
  year TEXT NOT NULL DEFAULT '',
  issuer TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  skills_associated TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public exp" ON public.experience;
CREATE POLICY "Public exp" ON public.experience FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner exp" ON public.experience;
CREATE POLICY "Owner exp" ON public.experience FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public pub" ON public.publications;
CREATE POLICY "Public pub" ON public.publications FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner pub" ON public.publications;
CREATE POLICY "Owner pub" ON public.publications FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public ach" ON public.achievements;
CREATE POLICY "Public ach" ON public.achievements FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner ach" ON public.achievements;
CREATE POLICY "Owner ach" ON public.achievements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. HIERARCHICAL CREDENTIALS (SPECIALIZATION -> COURSES)
CREATE TABLE IF NOT EXISTS public.hierarchical_credentials (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'course' CHECK (type IN ('specialization', 'course')),
  parent_id TEXT REFERENCES public.hierarchical_credentials(id) ON DELETE CASCADE,
  issuer TEXT NOT NULL DEFAULT '',
  issue_date TEXT NOT NULL DEFAULT '',
  credential_id TEXT NOT NULL DEFAULT '',
  document_url TEXT DEFAULT NULL,
  sanitized_filename TEXT NOT NULL DEFAULT '',
  competencies TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.hierarchical_credentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public creds" ON public.hierarchical_credentials;
CREATE POLICY "Public creds" ON public.hierarchical_credentials FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner creds" ON public.hierarchical_credentials;
CREATE POLICY "Owner creds" ON public.hierarchical_credentials FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 10485760, NULL),
  ('materials', 'materials', true, 52428800, NULL),
  ('Materials', 'Materials', true, 52428800, NULL)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public upload materials" ON storage.objects;
CREATE POLICY "Public upload materials" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id IN ('materials', 'Materials'));
DROP POLICY IF EXISTS "Public read materials" ON storage.objects;
CREATE POLICY "Public read materials" ON storage.objects FOR SELECT TO public USING (bucket_id IN ('materials', 'Materials'));
DROP POLICY IF EXISTS "Public upload avatars" ON storage.objects;
CREATE POLICY "Public upload avatars" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'avatars');
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');
`;
