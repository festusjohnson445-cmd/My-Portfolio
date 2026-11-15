-- ============================================================================
-- FESLINE MECHANICAL ENGINEERING: SUPABASE UPGRADE & EXPANSION SQL
-- Execute this script in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Storage Buckets (avatars and materials)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 10485760, NULL)
ON CONFLICT (id) DO UPDATE SET public = true;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('materials', 'materials', true, 104857600, NULL)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Bucket Storage RLS: Public read & Authenticated write
DROP POLICY IF EXISTS "Public Read Avatars Bucket" ON storage.objects;
CREATE POLICY "Public Read Avatars Bucket" ON storage.objects FOR SELECT TO public USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Public Read Materials Bucket" ON storage.objects;
CREATE POLICY "Public Read Materials Bucket" ON storage.objects FOR SELECT TO public USING (bucket_id = 'materials');

DROP POLICY IF EXISTS "Public Upload Materials" ON storage.objects;
CREATE POLICY "Public Upload Materials" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'materials');

DROP POLICY IF EXISTS "Authenticated Upload Avatars" ON storage.objects;
CREATE POLICY "Authenticated Upload Avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

-- 3. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tagline TEXT,
  category TEXT NOT NULL DEFAULT 'CAD & 3D Modeling',
  description TEXT NOT NULL,
  overview TEXT,
  objectives TEXT,
  methodology TEXT,
  technical_specs JSONB DEFAULT '{}'::jsonb,
  results TEXT,
  tools_used TEXT[] DEFAULT ARRAY[]::TEXT[],
  featured BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Completed',
  cad_drawing_url TEXT,
  hero_image TEXT,
  video_url TEXT,
  github_url TEXT,
  demo_url TEXT,
  document_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Projects" ON public.projects;
CREATE POLICY "Public Read Projects" ON public.projects FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner Manage Projects" ON public.projects;
CREATE POLICY "Owner Manage Projects" ON public.projects FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Project Media Table
CREATE TABLE IF NOT EXISTS public.project_media (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image',
  caption TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Project Media" ON public.project_media;
CREATE POLICY "Public Read Project Media" ON public.project_media FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner Manage Project Media" ON public.project_media;
CREATE POLICY "Owner Manage Project Media" ON public.project_media FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. Services Table
CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  deliverables TEXT[] DEFAULT ARRAY[]::TEXT[],
  tools TEXT[] DEFAULT ARRAY[]::TEXT[],
  icon TEXT,
  active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Services" ON public.services;
CREATE POLICY "Public Read Services" ON public.services FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner Manage Services" ON public.services;
CREATE POLICY "Owner Manage Services" ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Service Requests Table (Client Inquiries & Quotes)
CREATE TABLE IF NOT EXISTS public.service_requests (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  service_category TEXT NOT NULL,
  description TEXT NOT NULL,
  budget TEXT,
  attachment_url TEXT,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Insert Service Requests" ON public.service_requests;
CREATE POLICY "Public Insert Service Requests" ON public.service_requests FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Owner Manage Service Requests" ON public.service_requests;
CREATE POLICY "Owner Manage Service Requests" ON public.service_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Blog / Articles Table
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Engineering',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  cover_image TEXT,
  video_url TEXT,
  reading_time TEXT DEFAULT '5 min read',
  status TEXT DEFAULT 'published',
  published_at TIMESTAMPTZ DEFAULT now(),
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Articles" ON public.articles;
CREATE POLICY "Public Read Articles" ON public.articles FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner Manage Articles" ON public.articles;
CREATE POLICY "Owner Manage Articles" ON public.articles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Article Comments Table
CREATE TABLE IF NOT EXISTS public.article_comments (
  id TEXT PRIMARY KEY,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'approved',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.article_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Comments" ON public.article_comments;
CREATE POLICY "Public Read Comments" ON public.article_comments FOR SELECT TO public USING (status = 'approved');
DROP POLICY IF EXISTS "Public Insert Comments" ON public.article_comments;
CREATE POLICY "Public Insert Comments" ON public.article_comments FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "Owner Manage Comments" ON public.article_comments;
CREATE POLICY "Owner Manage Comments" ON public.article_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9. Article Likes Table
CREATE TABLE IF NOT EXISTS public.article_likes (
  id TEXT PRIMARY KEY,
  article_id TEXT REFERENCES public.articles(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id, visitor_id)
);

ALTER TABLE public.article_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Manage Likes" ON public.article_likes;
CREATE POLICY "Public Manage Likes" ON public.article_likes FOR ALL TO public USING (true) WITH CHECK (true);

-- 10. Experience & Career Table
CREATE TABLE IF NOT EXISTS public.experience (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  is_current BOOLEAN DEFAULT false,
  responsibilities TEXT[] DEFAULT ARRAY[]::TEXT[],
  tools_used TEXT[] DEFAULT ARRAY[]::TEXT[],
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.experience ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Experience" ON public.experience;
CREATE POLICY "Public Read Experience" ON public.experience FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner Manage Experience" ON public.experience;
CREATE POLICY "Owner Manage Experience" ON public.experience FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 11. Publications Table
CREATE TABLE IF NOT EXISTS public.publications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  publisher TEXT,
  publication_date TEXT NOT NULL,
  abstract TEXT NOT NULL,
  document_url TEXT,
  link_url TEXT,
  category TEXT DEFAULT 'Technical Whitepaper',
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Publications" ON public.publications;
CREATE POLICY "Public Read Publications" ON public.publications FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner Manage Publications" ON public.publications;
CREATE POLICY "Owner Manage Publications" ON public.publications FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 12. Achievements & Awards Table
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  issuer TEXT NOT NULL,
  issue_date TEXT NOT NULL,
  credential_id TEXT,
  category TEXT DEFAULT 'Certification',
  description TEXT NOT NULL,
  certificate_url TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Achievements" ON public.achievements;
CREATE POLICY "Public Read Achievements" ON public.achievements FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "Owner Manage Achievements" ON public.achievements;
CREATE POLICY "Owner Manage Achievements" ON public.achievements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 13. Ensure profiles table supports role column
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='role') THEN
    ALTER TABLE public.profiles ADD COLUMN role TEXT DEFAULT 'user';
  END IF;
END $$;

-- Set owner as explicit admin
UPDATE public.profiles SET role = 'admin' WHERE full_name ILIKE '%Festus%' OR id IN (SELECT id FROM auth.users WHERE email = 'festusjohnson028@gmail.com');

-- 14. Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.services;
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.article_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.experience;
ALTER PUBLICATION supabase_realtime ADD TABLE public.publications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.achievements;
