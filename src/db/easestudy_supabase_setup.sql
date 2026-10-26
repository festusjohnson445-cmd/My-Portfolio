-- ============================================================================
-- EASESTUDY INTELLIGENT MODEL & DATASET HUB — SUPABASE POSTGRESQL SETUP
-- Bucket: "ModeEaseStudy"
-- Dataset Table: "easestudy_dataset"
-- Learning Records: "easestudy_learning_records"
-- ============================================================================

-- 1. Enable Required Extensions (UUID & pgvector for continuous similarity lookup)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- 2. Create the "ModeEaseStudy" Storage Bucket in Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ModeEaseStudy',
  'ModeEaseStudy',
  true,
  52428800, -- 50 MB limit
  ARRAY[
    'application/json',
    'application/pdf',
    'text/plain',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. Storage Security Policies for "ModeEaseStudy" Bucket
-- A. Allow public read access to generated study datasets
DROP POLICY IF EXISTS "Public Read ModeEaseStudy" ON storage.objects;
CREATE POLICY "Public Read ModeEaseStudy"
ON storage.objects FOR SELECT
USING (bucket_id = 'ModeEaseStudy');

-- B. Allow insert/upload to ModeEaseStudy dataset
DROP POLICY IF EXISTS "Allow Upload ModeEaseStudy" ON storage.objects;
CREATE POLICY "Allow Upload ModeEaseStudy"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ModeEaseStudy');

-- C. Allow update to ModeEaseStudy dataset
DROP POLICY IF EXISTS "Allow Update ModeEaseStudy" ON storage.objects;
CREATE POLICY "Allow Update ModeEaseStudy"
ON storage.objects FOR UPDATE
USING (bucket_id = 'ModeEaseStudy')
WITH CHECK (bucket_id = 'ModeEaseStudy');

-- 4. Main Dataset Table: "easestudy_dataset"
-- Persists structured summaries, exam questions, concept breakdowns, and model learning state.
CREATE TABLE IF NOT EXISTS public.easestudy_dataset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_hash VARCHAR(64) UNIQUE NOT NULL,
  title TEXT NOT NULL,
  difficulty VARCHAR(32) NOT NULL DEFAULT 'intermediate',
  reading_time VARCHAR(32) DEFAULT '7 min read',
  summary_json JSONB NOT NULL,
  key_concepts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  exam_suite_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  flashcards_json JSONB DEFAULT '[]'::jsonb,
  storage_path TEXT,
  learning_iterations INTEGER NOT NULL DEFAULT 1,
  last_accessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Individual Session Log Table: "easestudy_learning_records"
CREATE TABLE IF NOT EXISTS public.easestudy_learning_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID REFERENCES public.easestudy_dataset(id) ON DELETE CASCADE,
  document_hash VARCHAR(64) NOT NULL,
  source_model VARCHAR(64) NOT NULL, -- 'advanced_learned_model' or 'base_ai_pipeline'
  question_count INTEGER NOT NULL DEFAULT 20,
  score_achieved INTEGER,
  total_questions INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Performance Indexes & Vector Search Support
CREATE INDEX IF NOT EXISTS idx_easestudy_document_hash ON public.easestudy_dataset(document_hash);
CREATE INDEX IF NOT EXISTS idx_easestudy_title ON public.easestudy_dataset(title);
CREATE INDEX IF NOT EXISTS idx_easestudy_created_at ON public.easestudy_dataset(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_easestudy_records_hash ON public.easestudy_learning_records(document_hash);

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.easestudy_dataset ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easestudy_learning_records ENABLE ROW LEVEL SECURITY;

-- 8. Policies for Dataset Tables
DROP POLICY IF EXISTS "Public Read EaseStudy Dataset" ON public.easestudy_dataset;
CREATE POLICY "Public Read EaseStudy Dataset"
ON public.easestudy_dataset FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public Insert EaseStudy Dataset" ON public.easestudy_dataset;
CREATE POLICY "Public Insert EaseStudy Dataset"
ON public.easestudy_dataset FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Public Update EaseStudy Dataset" ON public.easestudy_dataset;
CREATE POLICY "Public Update EaseStudy Dataset"
ON public.easestudy_dataset FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Public All EaseStudy Records" ON public.easestudy_learning_records;
CREATE POLICY "Public All EaseStudy Records"
ON public.easestudy_learning_records FOR ALL
USING (true)
WITH CHECK (true);
