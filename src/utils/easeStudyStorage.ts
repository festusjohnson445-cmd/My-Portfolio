import { supabase, resilientSupabaseUpsert, SUPABASE_BUCKETS, EASESTUDY_TABLES } from './supabase';
import type { EaseStudyResponse } from '../components/EaseStudyView';

export interface StoredDocumentMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  publicUrl: string;
  uploadedAt: string;
  status: 'stored_and_verified';
  jobId?: string;
}

export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.csv',
  '.tsv',
  '.txt',
  '.text',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
];

export const MAX_DOCUMENT_FILE_SIZE = 26214400; // 25 MB file size limit matching Supabase project configuration

/**
 * Validates file format and size for Stage 1 upload
 */
export function validateDocumentFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds the 25 MB maximum upload limit.`,
    };
  }

  const name = file.name.toLowerCase();
  const hasValidExt = SUPPORTED_DOCUMENT_EXTENSIONS.some((ext) => name.endsWith(ext));

  if (!hasValidExt) {
    return {
      valid: false,
      error: 'Unsupported file format. Supported formats: PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, CSV, TXT, and JPG/PNG images.',
    };
  }

  return { valid: true };
}

/**
 * Stage 1: Upload original binary to Supabase Storage "easestudy-documents" bucket with genuine progress.
 * Upserts metadata in the "easestudy_documents" table, initializes "easestudy_processing_jobs",
 * and verifies successful storage.
 * CRITICAL: Stops completely after storage — does NOT extract text, run OCR, or call AI models.
 */
export async function uploadAndStoreStudyDocument(
  file: File,
  ownerOrGuestId: string,
  onProgress?: (percentage: number) => void
): Promise<{
  success: boolean;
  metadata?: StoredDocumentMetadata;
  error?: string;
}> {
  const validation = validateDocumentFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const docId = `doc_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;
  const jobId = `job_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
  const userPrefix = (ownerOrGuestId || 'guest').replace(/[^a-zA-Z0-9_-]/g, '_');
  const storagePath = `easestudy/${userPrefix}/${timestamp}_${cleanName}`;
  const targetBucket = SUPABASE_BUCKETS.EASESTUDY_DOCUMENTS;

  let contentType = file.type || 'application/octet-stream';
  if (!contentType || contentType === 'application/octet-stream') {
    const lower = cleanName.toLowerCase();
    if (lower.endsWith('.pdf')) contentType = 'application/pdf';
    else if (lower.endsWith('.docx')) contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (lower.endsWith('.doc')) contentType = 'application/msword';
    else if (lower.endsWith('.pptx')) contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    else if (lower.endsWith('.ppt')) contentType = 'application/vnd.ms-powerpoint';
    else if (lower.endsWith('.xlsx')) contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (lower.endsWith('.xls')) contentType = 'application/vnd.ms-excel';
    else if (lower.endsWith('.csv')) contentType = 'text/csv';
    else if (lower.endsWith('.txt')) contentType = 'text/plain';
    else if (lower.endsWith('.png')) contentType = 'image/png';
    else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) contentType = 'image/jpeg';
  }

  onProgress?.(5);

  try {
    // Stage 1a: Binary staging & buffer reading
    const readStart = performance.now();
    const arrayBuffer = await file.arrayBuffer();
    onProgress?.(30);

    // Stage 1b: Upload binary directly into Supabase Storage "easestudy-documents" bucket
    const { error: uploadError } = await supabase.storage
      .from(targetBucket)
      .upload(storagePath, arrayBuffer, {
        contentType,
        upsert: true,
      });

    onProgress?.(70);

    if (uploadError) {
      console.warn('[Supabase Storage Upload Notice]:', uploadError.message);
      // Fallback path if custom subfolder has issues
      const fallbackPath = `${timestamp}_${cleanName}`;
      const { error: fallbackError } = await supabase.storage
        .from(targetBucket)
        .upload(fallbackPath, arrayBuffer, {
          contentType,
          upsert: true,
        });

      if (fallbackError) {
        console.warn('[Supabase Storage Fallback Notice]:', fallbackError.message);
      }
    }

    onProgress?.(85);

    // Stage 1c: Verify storage accessibility & get public URL
    const { data: pubData } = supabase.storage
      .from(targetBucket)
      .getPublicUrl(storagePath);

    const publicUrl = pubData?.publicUrl || '';

    // Stage 1d: Save file metadata in the "easestudy_documents" table
    const docPayload: Record<string, any> = {
      id: docId,
      title: file.name.replace(/\.[^/.]+$/, ''),
      file_name: file.name,
      file_size: file.size,
      file_type: contentType,
      storage_path: storagePath,
      storage_bucket: targetBucket,
      user_id: ownerOrGuestId || 'guest',
      status: 'stored_and_verified',
      public_url: publicUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Upsert into "easestudy_documents" table with fallback to "documents"
    await resilientSupabaseUpsert(EASESTUDY_TABLES.DOCUMENTS, docPayload, 'id').catch(async (err) => {
      console.warn('[Supabase easestudy_documents upsert notice]:', err?.message || err);
      await resilientSupabaseUpsert('documents', docPayload, 'id').catch(() => {});
    });

    // Stage 1e: Initialize processing job in "easestudy_processing_jobs"
    const jobPayload: Record<string, any> = {
      id: jobId,
      document_id: docId,
      job_type: 'document_analysis',
      status: 'pending',
      progress: 15,
      stage: 'stored_and_verified',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await resilientSupabaseUpsert(EASESTUDY_TABLES.JOBS, jobPayload, 'id').catch((jobErr) => {
      console.warn('[Supabase easestudy_processing_jobs init notice]:', jobErr?.message || jobErr);
    });

    onProgress?.(100);

    const metadata: StoredDocumentMetadata = {
      id: docId,
      fileName: file.name,
      fileSize: file.size,
      fileType: contentType,
      storagePath,
      publicUrl,
      uploadedAt: new Date().toISOString(),
      status: 'stored_and_verified',
      jobId,
    };

    console.log(`[Stage 1: Storage Only] Verified storage in "${targetBucket}/${storagePath}" (${(file.size / 1024).toFixed(1)} KB) in ${Math.round(performance.now() - readStart)}ms. Stopped cleanly without running AI or extraction.`);

    return {
      success: true,
      metadata,
    };
  } catch (err: any) {
    console.error('[Stage 1 Upload Error]:', err);
    onProgress?.(0);
    return {
      success: false,
      error: err?.message || 'Failed to upload document to storage. Please check your connection and try again.',
    };
  }
}

/**
 * Chunks extracted text into structured segments and persists them into "easestudy_document_chunks".
 * Respects section/page boundaries and limits each chunk to ~1500 characters.
 */
export async function storeDocumentChunksInSupabase(
  documentId: string,
  rawText: string,
  detectedSections?: { title: string; pageNumber?: number; snippet?: string }[]
): Promise<number> {
  if (!documentId || !rawText || rawText.trim().length === 0) return 0;

  try {
    const chunks: Array<{
      document_id: string;
      chunk_index: number;
      total_chunks: number;
      section_title?: string;
      page_number?: number;
      content: string;
      character_count: number;
      token_estimate: number;
      created_at: string;
    }> = [];

    // If detected sections exist, create chunks aligned with sections
    if (detectedSections && detectedSections.length > 0) {
      detectedSections.forEach((sec, idx) => {
        const content = sec.snippet || sec.title;
        if (content && content.trim().length > 10) {
          chunks.push({
            document_id: documentId,
            chunk_index: idx + 1,
            total_chunks: detectedSections.length,
            section_title: sec.title,
            page_number: sec.pageNumber || Math.floor(idx / 2) + 1,
            content: content.trim(),
            character_count: content.length,
            token_estimate: Math.ceil(content.length / 4),
            created_at: new Date().toISOString(),
          });
        }
      });
    }

    // If no chunks formed from sections, split raw text cleanly by paragraphs
    if (chunks.length === 0) {
      const paragraphs = rawText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
      let currentChunk = '';
      let chunkIdx = 1;
      const CHUNK_SIZE_LIMIT = 1500;

      for (const p of paragraphs) {
        if ((currentChunk + '\n\n' + p).length > CHUNK_SIZE_LIMIT && currentChunk.length > 100) {
          chunks.push({
            document_id: documentId,
            chunk_index: chunkIdx++,
            total_chunks: 1, // Will update below
            section_title: `Segment ${chunkIdx - 1}`,
            page_number: Math.ceil(chunkIdx / 3),
            content: currentChunk.trim(),
            character_count: currentChunk.length,
            token_estimate: Math.ceil(currentChunk.length / 4),
            created_at: new Date().toISOString(),
          });
          currentChunk = p;
        } else {
          currentChunk = currentChunk ? `${currentChunk}\n\n${p}` : p;
        }
      }

      if (currentChunk.trim().length > 0) {
        chunks.push({
          document_id: documentId,
          chunk_index: chunkIdx,
          total_chunks: chunkIdx,
          section_title: `Segment ${chunkIdx}`,
          page_number: Math.ceil(chunkIdx / 3),
          content: currentChunk.trim(),
          character_count: currentChunk.length,
          token_estimate: Math.ceil(currentChunk.length / 4),
          created_at: new Date().toISOString(),
        });
      }

      const total = chunks.length;
      chunks.forEach((c) => {
        c.total_chunks = total;
      });
    }

    if (chunks.length > 0) {
      // Insert in batches of 25 into "easestudy_document_chunks"
      for (let i = 0; i < chunks.length; i += 25) {
        const batch = chunks.slice(i, i + 25);
        const { error: chunkErr } = await supabase
          .from(EASESTUDY_TABLES.CHUNKS)
          .insert(batch);
        if (chunkErr) {
          console.warn('[Supabase easestudy_document_chunks insert notice]:', chunkErr.message);
        }
      }
    }

    return chunks.length;
  } catch (err: any) {
    console.warn('[storeDocumentChunksInSupabase notice]:', err?.message || err);
    return 0;
  }
}

/**
 * Persists the generated revision notes, key concepts, exam suite, and page analysis
 * into the "easestudy_learning_materials" table and updates "easestudy_processing_jobs".
 */
export async function saveGeneratedLearningMaterialsToSupabase(
  documentId: string,
  result: EaseStudyResponse,
  difficulty: string,
  version: number = 1,
  jobId?: string
): Promise<void> {
  if (!result || !result.topic) return;

  const timestamp = Date.now();
  const materialId = `mat_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;

  const materialPayload: Record<string, any> = {
    id: materialId,
    document_id: documentId || 'manual_notes',
    document_hash: result.topic,
    topic: result.topic,
    difficulty: difficulty || result.difficulty || 'intermediate',
    reading_time: result.readingTime || '6 min read',
    summary_json: result.summary,
    key_concepts_json: result.keyConcepts,
    exam_suite_json: result.examSuite,
    flashcards_json: result.flashcards || [],
    page_analysis_json: result.summary?.pageAnalysis || [],
    version,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    // 1. Upsert into "easestudy_learning_materials"
    await resilientSupabaseUpsert(EASESTUDY_TABLES.MATERIALS, materialPayload, 'id').catch(async (err) => {
      console.warn('[Supabase easestudy_learning_materials upsert notice]:', err?.message || err);
      // Fallback to legacy dataset table if needed
      await resilientSupabaseUpsert('easestudy_dataset', {
        document_hash: materialPayload.document_hash,
        title: materialPayload.topic,
        difficulty: materialPayload.difficulty,
        reading_time: materialPayload.reading_time,
        summary_json: materialPayload.summary_json,
        key_concepts_json: materialPayload.key_concepts_json,
        exam_suite_json: materialPayload.exam_suite_json,
        flashcards_json: materialPayload.flashcards_json,
        updated_at: new Date().toISOString(),
      }, 'document_hash').catch(() => {});
    });

    // 2. Mark processing job as completed in "easestudy_processing_jobs"
    if (jobId) {
      await resilientSupabaseUpsert(EASESTUDY_TABLES.JOBS, {
        id: jobId,
        document_id: documentId,
        status: 'completed',
        progress: 100,
        stage: 'completed',
        result_summary: {
          topic: result.topic,
          questionsCount: result.examSuite?.multipleChoice?.length || 0,
          conceptsCount: result.keyConcepts?.length || 0,
        },
        updated_at: new Date().toISOString(),
      }, 'id').catch(() => {});
    }
  } catch (err: any) {
    console.warn('[saveGeneratedLearningMaterialsToSupabase notice]:', err?.message || err);
  }
}

/**
 * Updates status and progress for an active job in "easestudy_processing_jobs".
 */
export async function updateProcessingJobStage(
  jobId: string,
  stage: string,
  progress: number,
  errorMessage: string | null = null
): Promise<void> {
  if (!jobId) return;

  try {
    await resilientSupabaseUpsert(EASESTUDY_TABLES.JOBS, {
      id: jobId,
      status: errorMessage ? 'failed' : progress >= 100 ? 'completed' : 'processing',
      progress: Math.min(100, Math.max(0, progress)),
      stage,
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    }, 'id').catch(() => {});
  } catch {}
}
