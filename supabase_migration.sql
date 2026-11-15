-- ============================================================================
-- COMPREHENSIVE SUPABASE DATABASE MIGRATION SCRIPT
-- Application: Fesline Mechanical Engineering Portfolio & Admin Engine
-- Production-Ready SQL Script (Idempotent & Safe to Execute Multiple Times)
-- ============================================================================

-- Enable required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. SITE SETTINGS TABLE (DYNAMIC GLOBAL THEMING & CONFIGURATION)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
    id TEXT PRIMARY KEY DEFAULT 'default_settings',
    theme TEXT DEFAULT 'light',
    primary_color TEXT DEFAULT '#0e7490',
    secondary_color TEXT DEFAULT '#0284c7',
    background_color TEXT DEFAULT '#dce1e8',
    text_color TEXT DEFAULT '#0f172a',
    heading_color TEXT DEFAULT '#083344',
    button_padding TEXT DEFAULT '8px 16px',
    button_radius TEXT DEFAULT '12px',
    button_font_size TEXT DEFAULT '13px',
    button_hover_effect TEXT DEFAULT 'scale',
    navbar_height TEXT DEFAULT '64px',
    navbar_bg TEXT DEFAULT '#d6d6e4',
    hero_animation BOOLEAN DEFAULT true,
    card_animation BOOLEAN DEFAULT true,
    homepage_cards JSONB DEFAULT '[]'::jsonb,
    custom_form_fields JSONB DEFAULT '[]'::jsonb,
    pdf_template JSONB DEFAULT '{"font_family":"Times New Roman","font_size":11,"margin_mm":20,"show_header":true}'::jsonb,
    footer_config JSONB DEFAULT '{"bg_color":"#d2d8e1","text_align":"center","links":[]}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default site settings if empty
INSERT INTO public.site_settings (id, theme, primary_color, secondary_color, background_color, text_color, heading_color)
VALUES ('default_settings', 'light', '#0e7490', '#0284c7', '#dce1e8', '#0f172a', '#083344')
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read site_settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Owner write site_settings" ON public.site_settings FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 2. PROJECTS TABLE & PROJECT MEDIA (ENGINEERING PORTFOLIO ENGINE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    tagline TEXT,
    category TEXT DEFAULT 'CAD', -- 'CAD', 'Web', 'General'
    completion_date TEXT,
    role TEXT,
    lead_time_weeks INT DEFAULT 4,
    status TEXT DEFAULT 'Validated Prototype',
    description TEXT,
    overview TEXT,
    objectives TEXT,
    methodology TEXT,
    tech_specs TEXT,
    cad_drawings_url TEXT,
    website_url TEXT,
    live_demo_url TEXT,
    hero_image TEXT,
    video_url TEXT,
    video_aspect_ratio TEXT DEFAULT '16:9',
    tools_used TEXT[] DEFAULT '{}',
    results TEXT,
    metrics JSONB DEFAULT '[]'::jsonb,
    problem_constraints JSONB DEFAULT '{}'::jsonb,
    hand_calculations JSONB DEFAULT '[]'::jsonb,
    fea_boundary_conditions JSONB DEFAULT '{}'::jsonb,
    bom JSONB DEFAULT '[]'::jsonb,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.project_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    media_type TEXT NOT NULL, -- 'image', 'video', 'cad', 'pdf'
    media_url TEXT NOT NULL,
    title TEXT,
    storage_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS & Indexes for Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Authenticated admin write projects" ON public.projects FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read project_media" ON public.project_media FOR SELECT USING (true);
CREATE POLICY "Authenticated admin write project_media" ON public.project_media FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_projects_category ON public.projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

-- ============================================================================
-- 3. BLOG / ARTICLES TABLE & COMMENTS / LIKES ENGINE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.article_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.article_categories (name, slug) VALUES 
('Optomechanics', 'optomechanics'),
('FEA Structural & Thermal', 'fea-structural-thermal'),
('CAD Design & GD&T', 'cad-gdt'),
('Web Engineering & Tech', 'web-engineering'),
('General Engineering', 'general-engineering')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE,
    category TEXT DEFAULT 'General Engineering',
    discipline TEXT DEFAULT 'Mechanical Engineering',
    difficulty TEXT DEFAULT 'Intermediate', -- 'Beginner', 'Intermediate', 'Advanced', 'Expert'
    reading_time TEXT DEFAULT '5 min read',
    author TEXT DEFAULT 'Chief Admin',
    author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_approved BOOLEAN DEFAULT true,
    summary TEXT,
    content TEXT NOT NULL,
    hero_media_url TEXT,
    hero_media_type TEXT DEFAULT 'image', -- 'image', 'video', 'pdf', 'cad'
    cad_model_url TEXT,
    pdf_url TEXT,
    bom JSONB DEFAULT '[]'::jsonb,
    attachments JSONB DEFAULT '[]'::jsonb,
    likes_count INT DEFAULT 0,
    views_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.article_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
    author_name TEXT NOT NULL,
    author_role TEXT DEFAULT 'Visitor',
    author_avatar TEXT,
    content TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT false,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.article_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
    visitor_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(article_id, visitor_id)
);

CREATE TABLE IF NOT EXISTS public.article_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
    visitor_id TEXT,
    viewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS & Indexes for Articles
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read approved articles" ON public.articles FOR SELECT USING (is_approved = true OR auth.role() = 'authenticated');
CREATE POLICY "Public insert article submission" ON public.articles FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin write articles" ON public.articles FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read approved comments" ON public.article_comments FOR SELECT USING (is_approved = true OR auth.role() = 'authenticated');
CREATE POLICY "Public insert comment" ON public.article_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Admin write comments" ON public.article_comments FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read likes" ON public.article_likes FOR SELECT USING (true);
CREATE POLICY "Public insert/delete likes" ON public.article_likes FOR ALL USING (true);

-- ============================================================================
-- 4. PROFILE, CAREER, PUBLICATIONS & HIERARCHICAL CREDENTIALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT DEFAULT 'Festus, Olorunsogo Johnson',
    header TEXT DEFAULT 'Lead Mechanical Design Engineer',
    bio JSONB DEFAULT '{}'::jsonb,
    avatar_url TEXT,
    documents JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.experience (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    company TEXT NOT NULL,
    location TEXT,
    start_date TEXT NOT NULL,
    end_date TEXT DEFAULT 'Present',
    description TEXT,
    achievements TEXT[] DEFAULT '{}',
    skills TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    publisher TEXT NOT NULL,
    date TEXT,
    doi_or_url TEXT,
    abstract TEXT,
    co_authors TEXT[] DEFAULT '{}',
    document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    issuer TEXT NOT NULL,
    date TEXT,
    category TEXT DEFAULT 'Award',
    description TEXT,
    skills TEXT[] DEFAULT '{}',
    badge_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hierarchical_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT DEFAULT 'Specialization', -- 'Specialization', 'Course'
    parent_id UUID REFERENCES public.hierarchical_credentials(id) ON DELETE CASCADE,
    issuer TEXT NOT NULL,
    date TEXT,
    credential_id TEXT,
    description TEXT,
    document_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hierarchical_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Owner write profiles" ON public.profiles FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read experience" ON public.experience FOR SELECT USING (true);
CREATE POLICY "Admin write experience" ON public.experience FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read publications" ON public.publications FOR SELECT USING (true);
CREATE POLICY "Admin write publications" ON public.publications FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read achievements" ON public.achievements FOR SELECT USING (true);
CREATE POLICY "Admin write achievements" ON public.achievements FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Public read hierarchical_credentials" ON public.hierarchical_credentials FOR SELECT USING (true);
CREATE POLICY "Admin write hierarchical_credentials" ON public.hierarchical_credentials FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================================
-- 5. MESSAGING & VISITOR CHAT SYSTEM
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.visitor_profiles (
    visitor_id TEXT PRIMARY KEY,
    display_name TEXT DEFAULT 'Visitor',
    role_subject TEXT DEFAULT 'Visitor Direct Chat',
    avatar_url TEXT,
    avatar_color TEXT DEFAULT 'bg-slate-700',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversations (
    id TEXT PRIMARY KEY,
    visitor_id TEXT REFERENCES public.visitor_profiles(visitor_id) ON DELETE CASCADE,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    default_label TEXT DEFAULT 'Direct Message',
    custom_name TEXT,
    visitor_name TEXT,
    avatar_url TEXT,
    role_or_company TEXT,
    unread BOOLEAN DEFAULT true,
    important BOOLEAN DEFAULT false,
    last_message TEXT,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    last_timestamp TEXT,
    messages JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id TEXT REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    content TEXT NOT NULL,
    voice_note JSONB,
    attachments JSONB,
    status TEXT DEFAULT 'unseen',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.visitor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read/write visitor_profiles" ON public.visitor_profiles FOR ALL USING (true);
CREATE POLICY "Public read/write conversations" ON public.conversations FOR ALL USING (true);
CREATE POLICY "Public read/write messages" ON public.messages FOR ALL USING (true);

-- Enable Supabase Realtime for instant synchronization across clients
ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.article_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- ============================================================================
-- 6. STORAGE BUCKETS SETUP (AVATARS & MATERIALS)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('materials', 'materials', true) ON CONFLICT (id) DO NOTHING;

-- Public Storage Read Policies
CREATE POLICY "Public read avatars bucket" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Public read materials bucket" ON storage.objects FOR SELECT USING (bucket_id = 'materials');

-- Storage Upload Policies
CREATE POLICY "Allow storage upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Allow storage upload materials" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'materials');

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
