import { supabase, isSupabaseConfigured, hasActiveOwnerSession } from './supabase';
import {
  DocumentFormPayload,
  DocumentWorkspaceCategory,
  GeneratedDocumentRecord,
  createEmptyFormPayload,
  extractDocumentAuthor,
  extractDocumentSummary,
  extractDocumentTitle,
  normalizeDocumentPayload,
} from '../types/documentWorkspace';
import {
  dataUrlToBlob,
  exportDocumentToDocxBlob,
  exportDocumentToPdfBlob,
  renderDocumentFirstPageDataUrl,
} from './documentExport';

const LOCAL_PUBLISHED_KEY = 'fesline_generated_documents_published_v1';
const LOCAL_DRAFTS_KEY = 'fesline_generated_documents_drafts_v1';
const STORAGE_BUCKET = 'materials';

const safeReadLocal = (key: string): GeneratedDocumentRecord[] => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map((rec: any) =>
          rec && rec.formData ? { ...rec, formData: normalizeDocumentPayload(rec.formData) } : rec
        )
      : [];
  } catch {
    return [];
  }
};

const safeWriteLocal = (key: string, items: GeneratedDocumentRecord[]) => {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Ignore storage quota errors
  }
};

const mapRowToRecord = (row: any): GeneratedDocumentRecord => ({
  id: String(row.id),
  category: (row.category || 'international_cv') as DocumentWorkspaceCategory,
  title: String(row.title && String(row.title).trim().toLowerCase() !== 'untitled document' ? row.title : ''),
  authorName: String(row.author_name || ''),
  summary: String(row.summary || ''),
  formData: normalizeDocumentPayload(row.form_data as DocumentFormPayload),
  previewImageUrl: String(row.preview_image_url || ''),
  pdfUrl: String(row.pdf_url || ''),
  docxUrl: String(row.docx_url || ''),
  storagePaths: Array.isArray(row.storage_paths) ? row.storage_paths : [],
  status: (row.status || 'published') as 'draft' | 'published' | 'archived',
  viewsCount: Number(row.views_count || 0),
  downloadsCount: Number(row.downloads_count || 0),
  createdAt: String(row.created_at || new Date().toISOString()),
  updatedAt: String(row.updated_at || new Date().toISOString()),
});

const uploadGeneratedAsset = async (
  path: string,
  blob: Blob,
  contentType: string,
  allowUpsert = false
): Promise<{ publicUrl: string; storagePath: string } | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
      contentType,
      upsert: allowUpsert,
    });
    if (error) {
      console.warn('[DocWorkspace Storage Upload Warning]:', error.message);
      return null;
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return { publicUrl: data.publicUrl, storagePath: path };
  } catch (err) {
    console.warn('[DocWorkspace Storage Upload Exception]:', err);
    return null;
  }
};

const PUBLISHED_DOCS_TTL_MS = 2 * 60 * 1000;
let memoryPublishedDocsCache: GeneratedDocumentRecord[] | null = null;
let publishedDocsFetchedAt = 0;
let inFlightPublishedDocsPromise: Promise<GeneratedDocumentRecord[]> | null = null;

export const hasPublishedGeneratedDocumentsHydrated = (): boolean => {
  if (publishedDocsFetchedAt > 0 || memoryPublishedDocsCache !== null) return true;
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_PUBLISHED_KEY) !== null;
  } catch {
    return false;
  }
};

export const getCachedPublishedGeneratedDocuments = (): GeneratedDocumentRecord[] => {
  if (memoryPublishedDocsCache) return memoryPublishedDocsCache;
  const local = safeReadLocal(LOCAL_PUBLISHED_KEY);
  if (local.length > 0) {
    memoryPublishedDocsCache = local;
  }
  return local;
};

export const invalidatePublishedGeneratedDocumentsCache = () => {
  publishedDocsFetchedAt = 0;
  memoryPublishedDocsCache = null;
};

export const fetchPublishedGeneratedDocuments = async (
  forceRefresh = false
): Promise<GeneratedDocumentRecord[]> => {
  const localPublished = safeReadLocal(LOCAL_PUBLISHED_KEY);
  if (!isSupabaseConfigured()) {
    memoryPublishedDocsCache = localPublished;
    publishedDocsFetchedAt = Date.now();
    return localPublished;
  }

  if (
    !forceRefresh &&
    memoryPublishedDocsCache &&
    Date.now() - publishedDocsFetchedAt < PUBLISHED_DOCS_TTL_MS
  ) {
    return memoryPublishedDocsCache;
  }

  if (!forceRefresh && inFlightPublishedDocsPromise) {
    return inFlightPublishedDocsPromise;
  }

  const runFetch = (async () => {
    try {
      const { data, error } = await supabase
        .from('generated_documents')
        .select('*')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[DocWorkspace fetchPublished]:', error.message);
        return localPublished;
      }

      const mapped = (data || []).map(mapRowToRecord);
      memoryPublishedDocsCache = mapped;
      publishedDocsFetchedAt = Date.now();
      safeWriteLocal(LOCAL_PUBLISHED_KEY, mapped);
      return mapped;
    } catch {
      return localPublished;
    } finally {
      inFlightPublishedDocsPromise = null;
    }
  })();

  if (!forceRefresh) {
    inFlightPublishedDocsPromise = runFetch;
  }
  return runFetch;
};

export const fetchLocalDraftDocuments = (): GeneratedDocumentRecord[] => {
  return safeReadLocal(LOCAL_DRAFTS_KEY);
};

export const hasDraftModifications = (payload: DocumentFormPayload): boolean => {
  try {
    const empty = createEmptyFormPayload(payload.category);
    return JSON.stringify(payload.data) !== JSON.stringify(empty.data);
  } catch {
    return true;
  }
};

export const saveDraftLocally = (
  payload: DocumentFormPayload,
  existingId?: string,
  options?: { skipPreview?: boolean }
): GeneratedDocumentRecord => {
  const now = new Date().toISOString();
  const id = existingId || `draft_${payload.category}`;
  const drafts = safeReadLocal(LOCAL_DRAFTS_KEY);
  const existing = drafts.find((d) => d.id === id);
  const previewDataUrl = options?.skipPreview
    ? existing?.previewImageUrl || ''
    : renderDocumentFirstPageDataUrl(payload);

  const record: GeneratedDocumentRecord = {
    id,
    category: payload.category,
    title: extractDocumentTitle(payload),
    authorName: extractDocumentAuthor(payload),
    summary: extractDocumentSummary(payload),
    formData: payload,
    previewImageUrl: previewDataUrl,
    pdfUrl: '',
    docxUrl: '',
    storagePaths: [],
    status: 'draft',
    viewsCount: 0,
    downloadsCount: 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const idx = drafts.findIndex((d) => d.id === id);
  const updated = idx >= 0 ? drafts.map((d) => (d.id === id ? record : d)) : [record, ...drafts];
  safeWriteLocal(LOCAL_DRAFTS_KEY, updated);
  return record;
};

export const removeLocalDraft = (id: string) => {
  const drafts = safeReadLocal(LOCAL_DRAFTS_KEY).filter((d) => d.id !== id);
  safeWriteLocal(LOCAL_DRAFTS_KEY, drafts);
};

export const removeLocalDraftsByCategory = (category: DocumentWorkspaceCategory) => {
  const drafts = safeReadLocal(LOCAL_DRAFTS_KEY).filter(
    (d) => d.category !== category && d.id !== `draft_${category}`
  );
  safeWriteLocal(LOCAL_DRAFTS_KEY, drafts);
};

export const publishGeneratedDocument = async (
  payload: DocumentFormPayload,
  existingId?: string
): Promise<{ record: GeneratedDocumentRecord; syncedToSupabase: boolean; warning?: string }> => {
  const now = new Date().toISOString();
  const isOwnerSession = await hasActiveOwnerSession().catch(() => false);
  const id = existingId && isOwnerSession
    ? existingId
    : (!existingId ? `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` : existingId);

  const previewDataUrl = renderDocumentFirstPageDataUrl(payload);
  const pdfBlob = exportDocumentToPdfBlob(payload);
  const docxBlob = await exportDocumentToDocxBlob(payload);

  const storagePaths: string[] = [];
  let previewImageUrl = previewDataUrl;
  let pdfUrl = '';
  let docxUrl = '';

  const assetSuffix = isOwnerSession ? id : `${id}_${Date.now().toString(36)}`;

  if (isSupabaseConfigured()) {
    const thumbBlob = previewDataUrl ? dataUrlToBlob(previewDataUrl) : null;
    const [thumbUpload, pdfUpload, docxUpload] = await Promise.all([
      thumbBlob
        ? uploadGeneratedAsset(`generated-docs/${assetSuffix}/page1.jpg`, thumbBlob, 'image/jpeg', isOwnerSession)
        : Promise.resolve(null),
      uploadGeneratedAsset(`generated-docs/${assetSuffix}/document.pdf`, pdfBlob, 'application/pdf', isOwnerSession),
      uploadGeneratedAsset(
        `generated-docs/${assetSuffix}/document.docx`,
        docxBlob,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        isOwnerSession
      ),
    ]);

    if (thumbUpload) {
      previewImageUrl = thumbUpload.publicUrl;
      storagePaths.push(thumbUpload.storagePath);
    }
    if (pdfUpload) {
      pdfUrl = pdfUpload.publicUrl;
      storagePaths.push(pdfUpload.storagePath);
    }
    if (docxUpload) {
      docxUrl = docxUpload.publicUrl;
      storagePaths.push(docxUpload.storagePath);
    }
  }

  const record: GeneratedDocumentRecord = {
    id,
    category: payload.category,
    title: extractDocumentTitle(payload),
    authorName: extractDocumentAuthor(payload),
    summary: extractDocumentSummary(payload),
    formData: payload,
    previewImageUrl,
    pdfUrl,
    docxUrl,
    storagePaths,
    status: 'published',
    viewsCount: 0,
    downloadsCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  let syncedToSupabase = false;
  let warning: string | undefined;

  if (isSupabaseConfigured()) {
    try {
      const dbRow = {
        id: record.id,
        category: record.category,
        title: record.title,
        author_name: record.authorName,
        summary: record.summary,
        form_data: record.formData,
        preview_image_url: record.previewImageUrl,
        pdf_url: record.pdfUrl,
        docx_url: record.docxUrl,
        storage_paths: record.storagePaths,
        status: 'published',
        updated_at: now,
      };

      let data: any = null;
      let error: any = null;

      if (isOwnerSession) {
        const res = await supabase
          .from('generated_documents')
          .upsert(dbRow, { onConflict: 'id' })
          .select('*')
          .single();
        data = res.data;
        error = res.error;
      } else {
        const res = await supabase
          .from('generated_documents')
          .insert(dbRow)
          .select('*')
          .single();
        data = res.data;
        error = res.error;
        if (error && (error.code === '23505' || String(error.message || '').toLowerCase().includes('duplicate'))) {
          const freshId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const retry = await supabase
            .from('generated_documents')
            .insert({ ...dbRow, id: freshId })
            .select('*')
            .single();
          data = retry.data;
          error = retry.error;
          if (!error && data) {
            record.id = freshId;
          }
        }
      }

      if (error) {
        warning = error.message;
        console.warn('[DocWorkspace Publish DB Warning]:', error.message);
      } else if (data) {
        syncedToSupabase = true;
        const saved = mapRowToRecord(data);
        const current = safeReadLocal(LOCAL_PUBLISHED_KEY).filter((d) => d.id !== saved.id);
        const nextList = [saved, ...current];
        memoryPublishedDocsCache = nextList;
        publishedDocsFetchedAt = Date.now();
        safeWriteLocal(LOCAL_PUBLISHED_KEY, nextList);
        removeLocalDraft(id);
        return { record: saved, syncedToSupabase: true };
      }
    } catch (err: any) {
      warning = err?.message || 'Supabase sync error';
    }
  }

  const current = safeReadLocal(LOCAL_PUBLISHED_KEY).filter((d) => d.id !== record.id);
  const nextList = [record, ...current];
  memoryPublishedDocsCache = nextList;
  publishedDocsFetchedAt = Date.now();
  safeWriteLocal(LOCAL_PUBLISHED_KEY, nextList);
  removeLocalDraft(id);
  return { record, syncedToSupabase, warning };
};

export const deleteGeneratedDocumentRecord = async (
  record: Pick<GeneratedDocumentRecord, 'id' | 'storagePaths'>
): Promise<{ ok: boolean; error?: string }> => {
  // Always clean up local caches first
  removeLocalDraft(record.id);
  const nextPublished = safeReadLocal(LOCAL_PUBLISHED_KEY).filter((d) => d.id !== record.id);
  memoryPublishedDocsCache = nextPublished;
  publishedDocsFetchedAt = Date.now();
  safeWriteLocal(LOCAL_PUBLISHED_KEY, nextPublished);

  if (!isSupabaseConfigured()) return { ok: true };

  try {
    if (record.storagePaths && record.storagePaths.length > 0) {
      await supabase.storage.from(STORAGE_BUCKET).remove(record.storagePaths).catch(() => {});
    }
    const { error } = await supabase.from('generated_documents').delete().eq('id', record.id);
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Delete failed' };
  }
};

export const incrementGeneratedDocumentViews = async (id: string): Promise<number | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.rpc('increment_generated_document_views', {
      target_doc_id: id,
    });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  } catch {
    return null;
  }
};

export const incrementGeneratedDocumentDownloads = async (id: string): Promise<number | null> => {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data, error } = await supabase.rpc('increment_generated_document_downloads', {
      target_doc_id: id,
    });
    if (error) return null;
    return typeof data === 'number' ? data : null;
  } catch {
    return null;
  }
};

export const subscribeToGeneratedDocumentsRealtime = (onChange: () => void) => {
  if (!isSupabaseConfigured()) return () => {};
  const channel = supabase
    .channel(`generated-docs-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'generated_documents' },
      () => {
        invalidatePublishedGeneratedDocumentsCache();
        onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
