-- ============================================================================
-- EASESTUDY PRODUCTION SUPABASE SETUP & COMPREHENSIVE STORAGE CLEANUP
-- 1. Drops legacy buckets ("ModeEaseStudy", "easestudy-documents") & their policies
-- 2. Provisions new "EaseStudy" storage bucket with multi-device visitor support
-- 3. Configures visitor-isolated RLS policies across browsers & mobile devices
-- 4. Establishes core tables: easestudy_documents, easestudy_document_chunks,
--    easestudy_learning_materials, and easestudy_processing_jobs
-- ============================================================================

-- Step 1: Enable Necessary Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Step 2: Clean Up Legacy Storage Policies
DROP POLICY IF EXISTS "Public Read ModeEaseStudy Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload ModeEaseStudy Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Update ModeEaseStudy Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete ModeEaseStudy Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Read ModeEaseStudy" ON storage.objects;
DROP POLICY IF EXISTS "Allow Upload ModeEaseStudy" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update ModeEaseStudy" ON storage.objects;
DROP POLICY IF EXISTS "Allow Delete ModeEaseStudy" ON storage.objects;

DROP POLICY IF EXISTS "Public Read easestudy-documents Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload easestudy-documents Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Update easestudy-documents Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete easestudy-documents Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Read easestudy-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow Upload easestudy-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update easestudy-documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow Delete easestudy-documents" ON storage.objects;

-- Also remove any prior policies on EaseStudy to ensure clean rebuild
DROP POLICY IF EXISTS "Public Read EaseStudy Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Upload EaseStudy Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Update EaseStudy Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete EaseStudy Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Read EaseStudy" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Upload EaseStudy" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Update EaseStudy" ON storage.objects;
DROP POLICY IF EXISTS "Allow Public Delete EaseStudy" ON storage.objects;

-- Step 3: Create the New "EaseStudy" Storage Bucket
-- 100 MB file limit, public read access, supports all document types
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'EaseStudy',
  'EaseStudy',
  true,
  104857600, -- 100 MB limit
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'text/tab-separated-values',
    'text/plain',
    'application/json',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  name = 'EaseStudy',
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Step 4: Storage Security Policies for "EaseStudy" Bucket
-- A. Allow anyone to view/read objects in the "EaseStudy" bucket
CREATE POLICY "Public Read EaseStudy Bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'EaseStudy');

-- B. Allow any visitor (desktop or mobile) to upload into "EaseStudy"
-- Supports visitor-scoped paths: visitors/{visitorId}/{fileName}
CREATE POLICY "Public Upload EaseStudy Bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'EaseStudy');

-- C. Allow visitors to update objects in "EaseStudy"
CREATE POLICY "Public Update EaseStudy Bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'EaseStudy')
WITH CHECK (bucket_id = 'EaseStudy');

-- D. Allow visitors to delete objects in "EaseStudy"
CREATE POLICY "Public Delete EaseStudy Bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'EaseStudy');

-- ============================================================================
-- Step 5: Table Schemas with Exact "easestudy_" Prefixes
-- ============================================================================

-- 1. easestudy_documents (Uploaded file metadata, storage location, visitor identity)
CREATE TABLE IF NOT EXISTS public.easestudy_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT,
  file_hash VARCHAR(64),
  character_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  detected_sections JSONB DEFAULT '[]'::jsonb,
  visitor_id TEXT DEFAULT 'guest',
  device_type VARCHAR(32) DEFAULT 'desktop', -- 'mobile', 'tablet', 'desktop'
  ip_hash VARCHAR(64),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. easestudy_document_chunks (Extracted text segments for grounding)
CREATE TABLE IF NOT EXISTS public.easestudy_document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.easestudy_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  heading TEXT,
  content TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. easestudy_learning_materials (Generated summaries, notes, exams, flashcards, diagrams)
CREATE TABLE IF NOT EXISTS public.easestudy_learning_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.easestudy_documents(id) ON DELETE SET NULL,
  topic TEXT NOT NULL,
  difficulty VARCHAR(32) DEFAULT 'intermediate',
  reading_time VARCHAR(32) DEFAULT '7 min read',
  summary_json JSONB NOT NULL,
  concepts_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  exam_suite_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  flashcards_json JSONB DEFAULT '[]'::jsonb,
  diagram_url TEXT,
  visitor_id TEXT DEFAULT 'guest',
  source_model VARCHAR(64) DEFAULT 'gemini-2.5-flash',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. easestudy_processing_jobs (Job status tracking: uploading -> extracting -> analysing -> generating -> completed)
CREATE TABLE IF NOT EXISTS public.easestudy_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.easestudy_documents(id) ON DELETE CASCADE,
  job_status VARCHAR(32) NOT NULL DEFAULT 'pending', -- 'uploading', 'retrieving', 'extracting', 'analysing', 'generating', 'completed', 'failed'
  stage_message TEXT DEFAULT 'Processing document...',
  progress_percent INTEGER DEFAULT 0,
  error_message TEXT,
  visitor_id TEXT DEFAULT 'guest',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Step 6: Enable Row Level Security (RLS) on all EaseStudy Tables
-- ============================================================================
ALTER TABLE public.easestudy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easestudy_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easestudy_learning_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easestudy_processing_jobs ENABLE ROW LEVEL SECURITY;

-- Drop prior table policies to avoid duplicates
DROP POLICY IF EXISTS "Public Read easestudy_documents" ON public.easestudy_documents;
DROP POLICY IF EXISTS "Public Insert easestudy_documents" ON public.easestudy_documents;
DROP POLICY IF EXISTS "Public Update easestudy_documents" ON public.easestudy_documents;
DROP POLICY IF EXISTS "Public Delete easestudy_documents" ON public.easestudy_documents;

DROP POLICY IF EXISTS "Public Read easestudy_document_chunks" ON public.easestudy_document_chunks;
DROP POLICY IF EXISTS "Public Insert easestudy_document_chunks" ON public.easestudy_document_chunks;

DROP POLICY IF EXISTS "Public Read easestudy_learning_materials" ON public.easestudy_learning_materials;
DROP POLICY IF EXISTS "Public Insert easestudy_learning_materials" ON public.easestudy_learning_materials;
DROP POLICY IF EXISTS "Public Update easestudy_learning_materials" ON public.easestudy_learning_materials;

DROP POLICY IF EXISTS "Public Read easestudy_processing_jobs" ON public.easestudy_processing_jobs;
DROP POLICY IF EXISTS "Public Insert easestudy_processing_jobs" ON public.easestudy_processing_jobs;
DROP POLICY IF EXISTS "Public Update easestudy_processing_jobs" ON public.easestudy_processing_jobs;

-- Public read/insert/update policies allowing all visitors across mobile & web
CREATE POLICY "Public Read easestudy_documents" ON public.easestudy_documents FOR SELECT USING (true);
CREATE POLICY "Public Insert easestudy_documents" ON public.easestudy_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update easestudy_documents" ON public.easestudy_documents FOR UPDATE USING (true);
CREATE POLICY "Public Delete easestudy_documents" ON public.easestudy_documents FOR DELETE USING (true);

CREATE POLICY "Public Read easestudy_document_chunks" ON public.easestudy_document_chunks FOR SELECT USING (true);
CREATE POLICY "Public Insert easestudy_document_chunks" ON public.easestudy_document_chunks FOR INSERT WITH CHECK (true);

CREATE POLICY "Public Read easestudy_learning_materials" ON public.easestudy_learning_materials FOR SELECT USING (true);
CREATE POLICY "Public Insert easestudy_learning_materials" ON public.easestudy_learning_materials FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update easestudy_learning_materials" ON public.easestudy_learning_materials FOR UPDATE USING (true);

CREATE POLICY "Public Read easestudy_processing_jobs" ON public.easestudy_processing_jobs FOR SELECT USING (true);
CREATE POLICY "Public Insert easestudy_processing_jobs" ON public.easestudy_processing_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Public Update easestudy_processing_jobs" ON public.easestudy_processing_jobs FOR UPDATE USING (true);

-- ============================================================================
-- Step 7: Performance Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_easestudy_documents_visitor ON public.easestudy_documents(visitor_id);
CREATE INDEX IF NOT EXISTS idx_easestudy_documents_hash ON public.easestudy_documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_easestudy_chunks_doc ON public.easestudy_document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_easestudy_materials_doc ON public.easestudy_learning_materials(document_id);
CREATE INDEX IF NOT EXISTS idx_easestudy_materials_visitor ON public.easestudy_learning_materials(visitor_id);
CREATE INDEX IF NOT EXISTS idx_easestudy_jobs_doc ON public.easestudy_processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_easestudy_jobs_visitor ON public.easestudy_processing_jobs(visitor_id);

-- Step 8: Realtime Publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'easestudy_processing_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.easestudy_processing_jobs;
  END IF;
END $$;
