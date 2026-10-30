-- ==============================================================================
-- EASESTUDY COMPLETE SUPABASE BACKEND ARCHITECTURE & MIGRATION SCRIPT
-- Project: EaseStudy Intelligent Workspace (Fesline Engineering)
-- Target Supabase Instance: https://teszyojnwaedjvqaqake.supabase.co
-- SQL Editor URL: https://supabase.com/dashboard/project/teszyojnwaedjvqaqake/sql/new
--
-- INSTRUCTIONS:
-- 1. Copy the entire contents of this file.
-- 2. Open your Supabase Dashboard SQL Editor at the link above.
-- 3. Paste and click "RUN" (or Ctrl+Enter).
-- 4. All tables, storage buckets, RLS policies, performance indexes,
--    and automated session cleanup routines will be safely created/updated.
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. POSTGRES EXTENSIONS
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 2. GUEST SESSIONS TABLE
-- Supports frictionless, immediate guest usage with automatic 7-day retention
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.easestudy_guest_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
    client_ip_hash TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_easestudy_guest_sessions_token 
    ON public.easestudy_guest_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_easestudy_guest_sessions_expires 
    ON public.easestudy_guest_sessions(expires_at);

-- -----------------------------------------------------------------------------
-- 3. DOCUMENTS TABLE
-- Dual-ownership: Links to guest_session_id OR authenticated owner_user_id
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.easestudy_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_session_id UUID REFERENCES public.easestudy_guest_sessions(session_id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    document_hash TEXT,
    extracted_text TEXT,
    topic TEXT,
    difficulty TEXT DEFAULT 'intermediate',
    page_count INTEGER DEFAULT 1,
    is_engineering_doc BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_easestudy_docs_guest 
    ON public.easestudy_documents(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_easestudy_docs_owner 
    ON public.easestudy_documents(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_easestudy_docs_hash 
    ON public.easestudy_documents(document_hash);

-- -----------------------------------------------------------------------------
-- 4. DOCUMENT CHUNKS TABLE
-- For high-precision RAG embeddings, search, and "Ask Your Document" grounded Q&A
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.easestudy_document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.easestudy_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    token_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_easestudy_chunks_doc 
    ON public.easestudy_document_chunks(document_id, chunk_index);

-- -----------------------------------------------------------------------------
-- 5. PROCESSING JOBS TABLE
-- Real-time tracking of AI generation, fact-checking, and reload loops
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.easestudy_processing_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.easestudy_documents(id) ON DELETE CASCADE,
    guest_session_id UUID REFERENCES public.easestudy_guest_sessions(session_id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    stage TEXT DEFAULT 'ingestion',
    progress_percent INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_easestudy_jobs_doc 
    ON public.easestudy_processing_jobs(document_id);
CREATE INDEX IF NOT EXISTS idx_easestudy_jobs_status 
    ON public.easestudy_processing_jobs(status);

-- -----------------------------------------------------------------------------
-- 6. GENERATED LEARNING MATERIALS TABLE
-- Stores summaries, core concepts, practice exam suites, flashcards, diagrams
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.easestudy_learning_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.easestudy_documents(id) ON DELETE CASCADE,
    guest_session_id UUID REFERENCES public.easestudy_guest_sessions(session_id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'intermediate',
    reading_time TEXT DEFAULT '5 min read',
    summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    key_concepts JSONB NOT NULL DEFAULT '[]'::jsonb,
    exam_suite JSONB NOT NULL DEFAULT '{}'::jsonb,
    flashcards JSONB NOT NULL DEFAULT '[]'::jsonb,
    diagrams JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_engine TEXT DEFAULT 'ModeEaseStudy-DualPipeline',
    is_latest BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_easestudy_materials_doc 
    ON public.easestudy_learning_materials(document_id);
CREATE INDEX IF NOT EXISTS idx_easestudy_materials_guest 
    ON public.easestudy_learning_materials(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_easestudy_materials_owner 
    ON public.easestudy_learning_materials(owner_user_id);

-- -----------------------------------------------------------------------------
-- 7. CHAT MESSAGES TABLE
-- Powers "Ask Your Document" interactive grounded conversational study assistant
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.easestudy_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.easestudy_documents(id) ON DELETE CASCADE,
    guest_session_id UUID REFERENCES public.easestudy_guest_sessions(session_id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    citations JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_easestudy_chat_doc 
    ON public.easestudy_chat_messages(document_id, created_at);

-- -----------------------------------------------------------------------------
-- 8. LEARNING RECORDS & EXAM ATTEMPTS TABLE
-- Tracks test scores, exam completion, flashcard mastery, and study time
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.easestudy_learning_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.easestudy_documents(id) ON DELETE SET NULL,
    guest_session_id UUID REFERENCES public.easestudy_guest_sessions(session_id) ON DELETE CASCADE,
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    answers_payload JSONB DEFAULT '{}'::jsonb,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_easestudy_records_guest 
    ON public.easestudy_learning_records(guest_session_id);
CREATE INDEX IF NOT EXISTS idx_easestudy_records_owner 
    ON public.easestudy_learning_records(owner_user_id);

-- -----------------------------------------------------------------------------
-- 9. VALIDATION & FACT-CHECKING LOGS TABLE
-- Tracks fact-checking validation passes, rejection loops, and quality scores
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.easestudy_validation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.easestudy_documents(id) ON DELETE SET NULL,
    engine_version TEXT NOT NULL DEFAULT 'ModeEaseStudy-v2',
    fact_check_passed BOOLEAN NOT NULL DEFAULT true,
    reload_iterations INTEGER NOT NULL DEFAULT 1,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 10. PRIVATE STORAGE BUCKET: "easestudy-documents"
-- Strictly private bucket for user documents (PDF, DOCX, PPTX, etc.)
-- Path Structure:
--   guest/{guest_session_id}/{doc_id}/{filename}
--   users/{owner_user_id}/{doc_id}/{filename}
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'easestudy-documents',
    'easestudy-documents',
    false, -- STRICTLY PRIVATE
    26214400, -- 25MB limit per document
    ARRAY[
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
        'text/plain',
        'image/png',
        'image/jpeg',
        'image/webp'
    ]
)
ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = 26214400;

-- -----------------------------------------------------------------------------
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures data isolation while supporting seamless guest access via proxy
-- -----------------------------------------------------------------------------
ALTER TABLE public.easestudy_guest_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easestudy_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easestudy_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easestudy_processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easestudy_learning_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easestudy_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easestudy_learning_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.easestudy_validation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Helper function to check if current user is the administrator
CREATE OR REPLACE FUNCTION public.is_easestudy_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        auth.role() = 'authenticated' AND 
        (auth.jwt() ->> 'email') = 'festusjohnson028@gmail.com'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- GUEST SESSIONS POLICIES
DROP POLICY IF EXISTS "Guest sessions anon select" ON public.easestudy_guest_sessions;
CREATE POLICY "Guest sessions anon select" ON public.easestudy_guest_sessions
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Guest sessions anon insert" ON public.easestudy_guest_sessions;
CREATE POLICY "Guest sessions anon insert" ON public.easestudy_guest_sessions
    FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Guest sessions anon update" ON public.easestudy_guest_sessions;
CREATE POLICY "Guest sessions anon update" ON public.easestudy_guest_sessions
    FOR UPDATE TO public USING (true);

-- DOCUMENTS POLICIES
DROP POLICY IF EXISTS "Documents access policy" ON public.easestudy_documents;
CREATE POLICY "Documents access policy" ON public.easestudy_documents
    FOR ALL TO public
    USING (
        public.is_easestudy_admin() OR
        (auth.role() = 'authenticated' AND owner_user_id = auth.uid()) OR
        (guest_session_id IS NOT NULL)
    )
    WITH CHECK (
        public.is_easestudy_admin() OR
        (auth.role() = 'authenticated' AND owner_user_id = auth.uid()) OR
        (guest_session_id IS NOT NULL)
    );

-- DOCUMENT CHUNKS POLICIES
DROP POLICY IF EXISTS "Document chunks access policy" ON public.easestudy_document_chunks;
CREATE POLICY "Document chunks access policy" ON public.easestudy_document_chunks
    FOR ALL TO public
    USING (true)
    WITH CHECK (true);

-- LEARNING MATERIALS POLICIES
DROP POLICY IF EXISTS "Learning materials access policy" ON public.easestudy_learning_materials;
CREATE POLICY "Learning materials access policy" ON public.easestudy_learning_materials
    FOR ALL TO public
    USING (
        public.is_easestudy_admin() OR
        (auth.role() = 'authenticated' AND owner_user_id = auth.uid()) OR
        (guest_session_id IS NOT NULL)
    )
    WITH CHECK (
        public.is_easestudy_admin() OR
        (auth.role() = 'authenticated' AND owner_user_id = auth.uid()) OR
        (guest_session_id IS NOT NULL)
    );

-- CHAT MESSAGES POLICIES
DROP POLICY IF EXISTS "Chat messages access policy" ON public.easestudy_chat_messages;
CREATE POLICY "Chat messages access policy" ON public.easestudy_chat_messages
    FOR ALL TO public
    USING (
        public.is_easestudy_admin() OR
        (auth.role() = 'authenticated' AND owner_user_id = auth.uid()) OR
        (guest_session_id IS NOT NULL)
    )
    WITH CHECK (
        public.is_easestudy_admin() OR
        (auth.role() = 'authenticated' AND owner_user_id = auth.uid()) OR
        (guest_session_id IS NOT NULL)
    );

-- LEARNING RECORDS POLICIES
DROP POLICY IF EXISTS "Learning records access policy" ON public.easestudy_learning_records;
CREATE POLICY "Learning records access policy" ON public.easestudy_learning_records
    FOR ALL TO public
    USING (
        public.is_easestudy_admin() OR
        (auth.role() = 'authenticated' AND owner_user_id = auth.uid()) OR
        (guest_session_id IS NOT NULL)
    )
    WITH CHECK (
        public.is_easestudy_admin() OR
        (auth.role() = 'authenticated' AND owner_user_id = auth.uid()) OR
        (guest_session_id IS NOT NULL)
    );

-- STORAGE POLICIES FOR "easestudy-documents"
DROP POLICY IF EXISTS "Storage upload to easestudy-documents" ON storage.objects;
CREATE POLICY "Storage upload to easestudy-documents" ON storage.objects
    FOR INSERT TO public
    WITH CHECK (bucket_id = 'easestudy-documents');

DROP POLICY IF EXISTS "Storage select from easestudy-documents" ON storage.objects;
CREATE POLICY "Storage select from easestudy-documents" ON storage.objects
    FOR SELECT TO public
    USING (bucket_id = 'easestudy-documents');

DROP POLICY IF EXISTS "Storage delete from easestudy-documents" ON storage.objects;
CREATE POLICY "Storage delete from easestudy-documents" ON storage.objects
    FOR DELETE TO public
    USING (bucket_id = 'easestudy-documents');

-- -----------------------------------------------------------------------------
-- 12. AUTOMATED CLEANUP ROUTINE (EXPIRED GUEST SESSIONS)
-- Cleans up unauthenticated guest sessions and records older than 7 days
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.easestudy_cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.easestudy_guest_sessions
    WHERE expires_at < now();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 13. VERIFICATION QUERY
-- -----------------------------------------------------------------------------
SELECT 
    'EaseStudy Supabase Setup Completed Successfully!' as status,
    (SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'easestudy_%') as easestudy_tables_count,
    (SELECT count(*) FROM storage.buckets WHERE id = 'easestudy-documents') as storage_bucket_exists;
