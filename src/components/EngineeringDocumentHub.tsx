import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Upload,
  Download,
  FileText,
  FileCheck,
  FolderDown,
  Search,
  Filter,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ExternalLink,
  Plus,
  RefreshCw,
  HardDrive,
  Loader2,
  Share2,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  KeyRound,
  User,
  Tag,
  BookOpen,
  X,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ListPlus,
  ArrowUpDown,
  Heart,
  GraduationCap,
} from 'lucide-react';
import { renderPdfFirstPageToImage, isMockDrawingPreview } from '../utils/pdfRenderer';
import {
  saveHubDocumentsPersistently,
  loadHubDocumentsPersistently,
  deleteHubDocumentPersistently,
  getDeletedDocIds,
  recordDeletedDocId,
  sortDocumentsDescending
} from '../utils/documentStorage';
import {
  uploadHubDocumentToStorage,
  saveHubDocumentToFirestore,
  fetchHubDocumentsFromFirestore,
  subscribeToHubDocuments,
  deleteHubDocumentFromFirestore,
  incrementHubDocumentDownload
} from '../utils/firebase';
import {
  useProfileSync,
  setOwnerAuthenticated,
  OWNER_EMAIL,
} from '../utils/profileState';
import {
  supabase,
  uploadMaterialToSupabaseBucket,
  uploadMaterialThumbnailToBucket,
  saveMaterialToSupabaseTable,
  fetchMaterialsFromSupabaseTable,
  fetchMaterialsFromSupabaseTableWithStatus,
  deleteMaterialFromSupabaseBucket,
  deleteMaterialFromSupabaseTable,
  subscribeToSupabaseMaterialsChanges,
  incrementMaterialViewsInSupabase,
  toggleMaterialLikeInSupabase,
  getAuthenticatedOwnerUid,
  ensureValidUuid,
  getAuthenticatedBearerHeaders,
  getSessionAalClaim,
} from '../utils/supabase';
import { PortfolioPart } from './Navbar';

function sanitizeDocumentDescription(desc?: string): string {
  if (!desc) return '';
  const trimmed = desc.trim();
  if (!trimmed) return '';
  if (
    /^Technical document ".*" uploaded to precision engineering repository\.?$/i.test(trimmed) ||
    /^Technical specification for .+$/i.test(trimmed)
  ) {
    return '';
  }
  return trimmed;
}

function sanitizeDocumentTitle(title?: string, fileName?: string): string {
  const clean = (title || '').trim();
  if (clean && clean.toLowerCase() !== 'untitled document') {
    return clean;
  }
  const rawFile = (fileName || '').trim();
  if (rawFile) {
    const withoutExt = rawFile.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (withoutExt && withoutExt.toLowerCase() !== 'untitled document') {
      return withoutExt;
    }
  }
  return '';
}

export type DocumentCategory = string;

export const STUDENT_LEVELS = ['100L', '200L', '300L', '400L', '500L', '600L'] as const;

export interface PublicEngineeringDocument {
  id: string;
  title: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  category: DocumentCategory;
  description: string;
  author: string;
  uploaderName: string;
  uploaderType: 'owner' | 'visitor';
  status: 'approved' | 'pending';
  uploadDate: string;
  uploadTimestamp?: number;
  downloadCount: number;
  viewsCount?: number;
  likesCount?: number;
  level?: string;
  department?: string;
  institution?: string;
  tags: string[];
  previewUrl?: string;
  dataUrl?: string; // Stored file content / base64
  downloadUrl?: string;
  hasServerFile?: boolean;
  isCustomUpload?: boolean;
}

export interface QueuedUploadItem {
  id: string;
  file: File;
  title: string;
  category: DocumentCategory;
  customCategoryMode?: boolean;
  description: string;
  tags: string;
  level: string;
  department: string;
  institution: string;
  previewUrl: string | null;
  fileSize: string;
  fileType: string;
}

const THUMB_CACHE_PREFIX = 'fesline_thumb_v2_';
const inMemoryThumbCache = new Map<string, string>();

function getCachedThumb(docId: string): string | null {
  if (inMemoryThumbCache.has(docId)) return inMemoryThumbCache.get(docId)!;
  if (typeof window !== 'undefined') {
    try {
      const c = localStorage.getItem(`${THUMB_CACHE_PREFIX}${docId}`);
      if (c && !isMockDrawingPreview(c)) {
        inMemoryThumbCache.set(docId, c);
        return c;
      }
    } catch {}
  }
  return null;
}

function parseApproxFileSizeBytes(fileSize?: string): number {
  if (!fileSize) return 0;
  const m = String(fileSize).trim().match(/([\d.]+)\s*(kb|mb|gb|bytes?|b)/i);
  if (!m) return 0;
  const num = parseFloat(m[1]);
  if (!Number.isFinite(num)) return 0;
  const unit = m[2].toLowerCase();
  if (unit.startsWith('gb')) return num * 1024 * 1024 * 1024;
  if (unit.startsWith('mb')) return num * 1024 * 1024;
  if (unit.startsWith('kb')) return num * 1024;
  return num;
}

export const EngineeringHubPdfCardThumbnail: React.FC<{
  doc: PublicEngineeringDocument;
}> = ({ doc }) => {
  const initialImg =
    doc.previewUrl && !isMockDrawingPreview(doc.previewUrl) && !doc.previewUrl.endsWith('.pdf')
      ? doc.previewUrl
      : null;

  const cachedThumb = getCachedThumb(doc.id) || initialImg;
  const [renderedImg, setRenderedImg] = useState<string | null>(cachedThumb);
  const [isNearViewport, setIsNearViewport] = useState(Boolean(cachedThumb));
  const thumbRef = useRef<HTMLDivElement | null>(null);

  const pdfSource =
    doc.dataUrl ||
    doc.downloadUrl ||
    (doc as any).fileUrl ||
    (doc.previewUrl && doc.previewUrl.includes('http') ? doc.previewUrl : null);

  const isRemoteLargePdf =
    Boolean(pdfSource && /^https?:\/\//i.test(String(pdfSource))) &&
    parseApproxFileSizeBytes(doc.fileSize) > 2_500_000;

  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (cachedThumb || isNearViewport) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsNearViewport(true);
      return;
    }
    const el = thumbRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '120px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cachedThumb, isNearViewport]);

  useEffect(() => {
    let isMounted = true;

    if (cachedThumb) {
      setRenderedImg(cachedThumb);
      setIsRendering(false);
      return;
    }

    if (doc.previewUrl && !isMockDrawingPreview(doc.previewUrl) && !doc.previewUrl.endsWith('.pdf') && !doc.previewUrl.startsWith('data:application/pdf')) {
      setRenderedImg(doc.previewUrl);
      setIsRendering(false);
      try {
        localStorage.setItem(`${THUMB_CACHE_PREFIX}${doc.id}`, doc.previewUrl);
        inMemoryThumbCache.set(doc.id, doc.previewUrl);
      } catch {}
      return;
    }

    if (!isNearViewport || !pdfSource || isRemoteLargePdf) {
      setIsRendering(false);
      return;
    }

    setIsRendering(true);
    renderPdfFirstPageToImage(pdfSource, 600)
      .then((img) => {
        if (isMounted) {
          if (img) {
            setRenderedImg(img);
            try {
              localStorage.setItem(`${THUMB_CACHE_PREFIX}${doc.id}`, img);
              inMemoryThumbCache.set(doc.id, img);
            } catch {}
          }
          setIsRendering(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsRendering(false);
      });

    return () => {
      isMounted = false;
    };
  }, [doc.id, doc.previewUrl, pdfSource, cachedThumb, isNearViewport, isRemoteLargePdf]);

  if (renderedImg) {
    return (
      <img
        src={renderedImg}
        alt={doc.title}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover object-top bg-white block group-hover:scale-[1.02] transition-transform duration-300"
      />
    );
  }

  return (
    <div
      ref={thumbRef}
      className="w-full h-full flex flex-col items-center justify-center p-3 relative bg-[#f1f5f9] select-none overflow-hidden"
      style={{
        backgroundImage: `radial-gradient(#94a3b8 1px, transparent 1px)`,
        backgroundSize: '16px 16px'
      }}
    >
      {/* Category Icon */}
      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-300 shadow-xs flex items-center justify-center text-cyan-800 mb-1">
        {doc.category === 'Christians Book' || doc.category === 'Inspirational Book' || doc.category === 'Students Materials' ? (
          <BookOpen className="w-6 h-6 text-cyan-700" />
        ) : doc.category === 'Technical Drawing' || doc.category === 'Production Blueprint' ? (
          <FileCode className="w-6 h-6 text-blue-700" />
        ) : doc.category === 'BOM & Specification' || doc.category === 'Calculation & Dataset' ? (
          <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
        ) : (
          <FileText className="w-6 h-6 text-slate-700" />
        )}
      </div>

      <span className="text-[10px] font-mono font-bold text-slate-800 uppercase tracking-wider">{doc.fileType || 'PDF'}</span>
      <span className="text-[9px] font-mono text-slate-500 max-w-[160px] truncate text-center mt-0.5">{doc.fileName}</span>

      {/* Gentle loading badge if rendering in background */}
      {isRendering && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-white/90 border border-cyan-300 shadow-2xs flex items-center gap-1 text-[9px] font-mono font-semibold text-cyan-800">
          <Loader2 className="w-2.5 h-2.5 text-cyan-600 animate-spin" />
          <span>Page 1</span>
        </div>
      )}
    </div>
  );
};

const EngineeringHubModalPreview: React.FC<{ doc: PublicEngineeringDocument }> = ({ doc }) => {
  const initialImg =
    (doc.previewUrl && !isMockDrawingPreview(doc.previewUrl) && !doc.previewUrl.endsWith('.pdf')
      ? doc.previewUrl
      : null) || getCachedThumb(doc.id);

  const pdfSource =
    doc.dataUrl ||
    doc.downloadUrl ||
    (doc as any).fileUrl ||
    (doc.previewUrl && doc.previewUrl.includes('http') ? doc.previewUrl : null);

  const isPdfDoc =
    doc.fileType?.toUpperCase() === 'PDF' ||
    Boolean(doc.fileName && /\.pdf$/i.test(doc.fileName)) ||
    Boolean(pdfSource && /\.pdf(\?|$)/i.test(String(pdfSource)));

  const [imgSrc, setImgSrc] = useState<string | null>(initialImg);
  const [isRendering, setIsRendering] = useState<boolean>(
    () => !initialImg && isPdfDoc && Boolean(pdfSource)
  );

  useEffect(() => {
    let mounted = true;
    const cached =
      (doc.previewUrl && !isMockDrawingPreview(doc.previewUrl) && !doc.previewUrl.endsWith('.pdf')
        ? doc.previewUrl
        : null) || getCachedThumb(doc.id);

    if (cached) {
      setImgSrc(cached);
      setIsRendering(false);
      return;
    }

    if (isPdfDoc && pdfSource) {
      setIsRendering(true);
      renderPdfFirstPageToImage(pdfSource, 1000)
        .then((img) => {
          if (!mounted) return;
          if (img) {
            setImgSrc(img);
            inMemoryThumbCache.set(doc.id, img);
            try {
              localStorage.setItem(`${THUMB_CACHE_PREFIX}${doc.id}`, img);
            } catch {}
          }
          setIsRendering(false);
        })
        .catch(() => {
          if (mounted) setIsRendering(false);
        });
    } else {
      setImgSrc(null);
      setIsRendering(false);
    }

    return () => {
      mounted = false;
    };
  }, [doc.id, doc.previewUrl, pdfSource, isPdfDoc]);

  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt={doc.title}
        decoding="async"
        className="max-h-[60vh] max-w-full object-contain rounded-lg bg-white"
      />
    );
  }

  if (isRendering) {
    return (
      <div className="text-center p-8 space-y-2">
        <Loader2 className="w-8 h-8 text-cyan-600 animate-spin mx-auto" />
        <p className="text-xs font-mono text-slate-600">Loading document preview...</p>
      </div>
    );
  }

  return (
    <div className="text-center p-8 space-y-2">
      <FileText className="w-16 h-16 text-cyan-600 mx-auto opacity-70" />
      <p className="text-sm font-mono text-slate-600">{doc.fileName}</p>
    </div>
  );
};

export interface EngineeringDocumentHubProps {
  onNavigatePart?: (part: PortfolioPart) => void;
}

export const CATEGORIES_LIST: DocumentCategory[] = [];

/**
 * Format file size nicely
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes > 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }
  return (bytes / 1024).toFixed(0) + ' KB';
}

const HUB_CACHE_KEY = 'fesline_hub_docs_cache_v2';

// In-memory hub documents cache to prevent high internet data consumption on page navigation
let globalHubDocsMemoryCache: PublicEngineeringDocument[] | null = null;
let lastHubDocsFetchTimestamp = 0;
const HUB_CACHE_WINDOW_MS = 3 * 60 * 1000; // 3 minutes cache window

function getInitialCachedDocuments(): PublicEngineeringDocument[] {
  if (globalHubDocsMemoryCache && globalHubDocsMemoryCache.length > 0) {
    return globalHubDocsMemoryCache;
  }
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HUB_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const deleted = getDeletedDocIds();
        const initial = sortDocumentsDescending(parsed.filter((d: any) => d && d.id && !deleted.has(d.id)));
        globalHubDocsMemoryCache = initial;
        return initial;
      }
    }
  } catch {}
  return [];
}

export const EngineeringDocumentHub: React.FC<EngineeringDocumentHubProps> = ({ onNavigatePart }) => {
  const { isOwner } = useProfileSync();
  const [documents, setDocuments] = useState<PublicEngineeringDocument[]>(() => getInitialCachedDocuments());
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(() => getInitialCachedDocuments().length === 0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'downloads' | 'title' | 'size'>('newest');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewModalDoc, setPreviewModalDoc] = useState<PublicEngineeringDocument | null>(null);
  const [docToDelete, setDocToDelete] = useState<PublicEngineeringDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const [uploadFormMode, setUploadFormMode] = useState<'general' | 'student'>('general');
  const [likedMaterialIds, setLikedMaterialIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('fesline_liked_materials_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed);
      }
    } catch {}
    return new Set();
  });

  // Upload Queue State (Supports single or multi-file uploads seamlessly without auto-fill)
  const [queuedFiles, setQueuedFiles] = useState<QueuedUploadItem[]>([]);
  const [uploaderName, setUploaderName] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; percent: number; currentFileName: string }>({
    current: 0,
    total: 0,
    percent: 0,
    currentFileName: ''
  });
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const isSyncingRef = useRef(false);
  const hasAuthoritativeSupabaseRef = useRef(false);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  // Load documents with Supabase "materials" as single authoritative source of truth
  // so cards deleted on one browser/device never resurrect from stale Firestore/SQL/local caches.
  const loadDocuments = useCallback(async (force = false) => {
    if (isSyncingRef.current) return;
    if (!force && globalHubDocsMemoryCache && Date.now() - lastHubDocsFetchTimestamp < HUB_CACHE_WINDOW_MS) {
      const deleted = getDeletedDocIds();
      setDocuments(globalHubDocsMemoryCache.filter((d) => d && d.id && !deleted.has(d.id)));
      setIsLoadingDocs(false);
      return;
    }
    isSyncingRef.current = true;

    try {
      const deletedIds = getDeletedDocIds();
      const cached = await loadHubDocumentsPersistently<PublicEngineeringDocument>();
      const cleanCached = sortDocumentsDescending(
        cached.filter((d) => d && d.id && !deletedIds.has(d.id))
      );

      // Build cache lookup map for preserving inline preview/dataUrl if still live in Supabase
      const cacheLookup = new Map<string, PublicEngineeringDocument>();
      cleanCached.forEach((d) => cacheLookup.set(d.id, d));

      // Show cached immediately if memory cache was empty
      if (cleanCached.length > 0 && !hasAuthoritativeSupabaseRef.current) {
        setDocuments(cleanCached);
      }

      // 1. Fetch authoritative live records from Supabase "materials" table
      const supaResult = await fetchMaterialsFromSupabaseTableWithStatus(force);

      if (supaResult.ok) {
        hasAuthoritativeSupabaseRef.current = true;
        const supaDocsMap = new Map<string, PublicEngineeringDocument>();
        const activeSupaIds = new Set<string>();

        supaResult.data.forEach((m: any) => {
          if (m && m.id && !deletedIds.has(m.id)) {
            activeSupaIds.add(m.id);
            const existing = cacheLookup.get(m.id);
            const resolvedDownloadUrl =
              m.download_url ||
              m.file_url ||
              (existing?.downloadUrl && String(existing.downloadUrl).startsWith('http')
                ? existing.downloadUrl
                : `/api/documents/files/${m.id}`);
            const validPreview =
              m.preview_url && !isMockDrawingPreview(m.preview_url)
                ? m.preview_url
                : existing?.previewUrl && !isMockDrawingPreview(existing.previewUrl)
                ? existing.previewUrl
                : undefined;

            supaDocsMap.set(m.id, {
              id: m.id,
              title: sanitizeDocumentTitle(m.title || existing?.title, m.file_name || existing?.fileName),
              fileName: m.file_name || existing?.fileName || 'document.pdf',
              fileSize: m.file_size || existing?.fileSize || 'Standard',
              fileType: m.file_type || existing?.fileType || 'PDF',
              category: m.category || existing?.category || '',
              description: sanitizeDocumentDescription(m.description || existing?.description || ''),
              author: m.author || existing?.author || '',
              uploaderName: m.author || existing?.uploaderName || '',
              uploaderType: m.category === 'Students Materials' && !m.owner_id ? 'visitor' : 'owner',
              status: 'approved',
              uploadDate: (m.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0],
              downloadCount: m.download_count ?? existing?.downloadCount ?? 0,
              viewsCount: m.views_count ?? existing?.viewsCount ?? 0,
              likesCount: m.likes_count ?? existing?.likesCount ?? 0,
              level: m.level || existing?.level || '',
              department: m.department || existing?.department || '',
              institution: m.institution || existing?.institution || '',
              tags: Array.isArray(m.tags) ? m.tags : [],
              previewUrl: validPreview,
              downloadUrl: resolvedDownloadUrl,
              dataUrl: existing?.dataUrl,
              hasServerFile: true,
              isCustomUpload: true,
              ...(m.storage_path ? { storagePath: m.storage_path } : {}),
            });
          }
        });

        // Clean up stale orphaned cards in Firestore in background when owner is signed in
        if (isOwner) {
          fetchHubDocumentsFromFirestore()
            .then((firestoreDocs) => {
              if (!Array.isArray(firestoreDocs)) return;
              firestoreDocs.forEach((fDoc) => {
                if (fDoc && fDoc.id && (!activeSupaIds.has(fDoc.id) || deletedIds.has(fDoc.id))) {
                  deleteHubDocumentFromFirestore(fDoc.id, (fDoc as any)?.storagePath).catch(() => {});
                }
              });
            })
            .catch(() => {});
        }

        const finalSorted = sortDocumentsDescending(Array.from(supaDocsMap.values()));
        globalHubDocsMemoryCache = finalSorted;
        lastHubDocsFetchTimestamp = Date.now();
        setDocuments(finalSorted);
        saveHubDocumentsPersistently(finalSorted).catch(() => {});
        try {
          localStorage.setItem(HUB_CACHE_KEY, JSON.stringify(finalSorted));
        } catch {}
        return;
      }

      // 2. Offline / Supabase-error fallback ONLY (strictly filtered by deletedIds)
      const docsMap = new Map<string, PublicEngineeringDocument>(cacheLookup);
      try {
        const firestoreDocs = await fetchHubDocumentsFromFirestore();
        if (Array.isArray(firestoreDocs)) {
          firestoreDocs.forEach((fDoc) => {
            if (fDoc && fDoc.id && !deletedIds.has(fDoc.id)) {
              const existing = docsMap.get(fDoc.id);
              const validPreview = (fDoc.previewUrl && !isMockDrawingPreview(fDoc.previewUrl))
                ? fDoc.previewUrl
                : (existing?.previewUrl && !isMockDrawingPreview(existing?.previewUrl))
                ? existing.previewUrl
                : undefined;
              docsMap.set(fDoc.id, {
                ...fDoc,
                dataUrl: existing?.dataUrl || fDoc.dataUrl,
                previewUrl: validPreview,
              });
            }
          });
        }
      } catch (fErr) {
        console.warn('Firestore documents fetch note:', fErr);
      }

      try {
        const authHeaders = isOwner ? await getAuthenticatedBearerHeaders() : {};
        const res = await fetch(isOwner ? '/api/documents?all=true' : '/api/documents', {
          headers: authHeaders,
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.success && Array.isArray(json.documents)) {
            if (Array.isArray(json.deletedIds)) {
              json.deletedIds.forEach((dId: string) => recordDeletedDocId(dId));
            }
            const currentDeleted = getDeletedDocIds();

            json.documents.forEach((sDoc: any) => {
              if (sDoc && sDoc.id && !currentDeleted.has(sDoc.id)) {
                const existing = docsMap.get(sDoc.id);
                const validPreview = (sDoc.previewUrl && !isMockDrawingPreview(sDoc.previewUrl))
                  ? sDoc.previewUrl
                  : (existing?.previewUrl && !isMockDrawingPreview(existing?.previewUrl))
                  ? existing.previewUrl
                  : undefined;
                docsMap.set(sDoc.id, {
                  ...sDoc,
                  dataUrl: sDoc.dataUrl || existing?.dataUrl,
                  previewUrl: validPreview,
                });
              }
            });
          }
        }
      } catch (sErr) {
        console.warn('Server documents sync note:', sErr);
      }

      const activeDeleted = getDeletedDocIds();
      const combined = Array.from(docsMap.values()).filter((d) => d && d.id && !activeDeleted.has(d.id));
      const sorted = sortDocumentsDescending(combined);
      globalHubDocsMemoryCache = sorted;
      lastHubDocsFetchTimestamp = Date.now();
      setDocuments(sorted);
      saveHubDocumentsPersistently(sorted).catch(() => {});
      try {
        localStorage.setItem(HUB_CACHE_KEY, JSON.stringify(sorted));
      } catch {}
    } catch (e) {
      console.warn('Storage sync note:', e);
    } finally {
      isSyncingRef.current = false;
      setIsLoadingDocs(false);
    }
  }, [isOwner]);

  useEffect(() => {
    loadDocuments();

    // Attach Firestore real-time listener (never resurrects docs removed from authoritative Supabase table)
    const unsubscribeFirestore = subscribeToHubDocuments(
      (firestoreDocs) => {
        if (Array.isArray(firestoreDocs)) {
          const currentDeleted = getDeletedDocIds();
          setDocuments((prev) => {
            if (hasAuthoritativeSupabaseRef.current) {
              // Only update metadata (like downloadCount) for documents that are currently live
              const fMap = new Map<string, PublicEngineeringDocument>();
              firestoreDocs.forEach((fDoc) => {
                if (fDoc && fDoc.id && !currentDeleted.has(fDoc.id)) {
                  fMap.set(fDoc.id, fDoc);
                }
              });
              const updated = prev
                .filter((d) => d && d.id && !currentDeleted.has(d.id))
                .map((existing) => {
                  const fDoc = fMap.get(existing.id);
                  if (!fDoc) return existing;
                  return {
                    ...existing,
                    downloadCount: Math.max(existing.downloadCount || 0, fDoc.downloadCount || 0),
                  };
                });
              globalHubDocsMemoryCache = updated;
              try {
                localStorage.setItem(HUB_CACHE_KEY, JSON.stringify(updated));
              } catch {}
              return updated;
            }

            const map = new Map<string, PublicEngineeringDocument>();
            firestoreDocs.forEach((fDoc) => {
              if (fDoc && fDoc.id && !currentDeleted.has(fDoc.id)) {
                const existing = prev.find((p) => p.id === fDoc.id);
                const validPreview = (fDoc.previewUrl && !isMockDrawingPreview(fDoc.previewUrl))
                  ? fDoc.previewUrl
                  : (existing?.previewUrl && !isMockDrawingPreview(existing?.previewUrl))
                  ? existing.previewUrl
                  : undefined;
                map.set(fDoc.id, {
                  ...fDoc,
                  dataUrl: existing?.dataUrl || fDoc.dataUrl,
                  previewUrl: validPreview,
                });
              }
            });
            const merged = sortDocumentsDescending(Array.from(map.values()).filter((d) => !currentDeleted.has(d.id)));
            globalHubDocsMemoryCache = merged;
            lastHubDocsFetchTimestamp = Date.now();
            saveHubDocumentsPersistently(merged).catch(() => {});
            try {
              localStorage.setItem(HUB_CACHE_KEY, JSON.stringify(merged));
            } catch {}
            return merged;
          });
        }
      },
      (err) => console.warn('Firestore documents subscription note:', err)
    );

    const handleUpdate = () => {
      loadDocuments(true);
    };

    window.addEventListener('fesline_hub_docs_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    const unsubscribeSupabase = subscribeToSupabaseMaterialsChanges(() => {
      loadDocuments(true);
    });

    return () => {
      unsubscribeFirestore();
      unsubscribeSupabase();
      window.removeEventListener('fesline_hub_docs_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [loadDocuments]);

  useEffect(() => {
    if (!previewModalDoc) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewModalDoc(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [previewModalDoc]);

  const saveDocumentsToStorage = (updatedDocs: PublicEngineeringDocument[]) => {
    const deleted = getDeletedDocIds();
    const sorted = sortDocumentsDescending(
      updatedDocs.filter((d) => d && d.id && !deleted.has(d.id))
    );
    globalHubDocsMemoryCache = sorted;
    lastHubDocsFetchTimestamp = Date.now();
    setDocuments(sorted);
    try {
      localStorage.setItem(HUB_CACHE_KEY, JSON.stringify(sorted));
    } catch {}
    saveHubDocumentsPersistently(sorted).catch(() => {});
    window.dispatchEvent(new CustomEvent('fesline_hub_docs_updated'));
  };

  /**
   * Process picked files WITHOUT auto-filling title, category, tags, description, level, department, or institution
   */
  const handleFilesPicked = async (fileList: FileList | File[]) => {
    setUploadError(null);
    setUploadSuccessMsg(null);
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    const newQueueItems: QueuedUploadItem[] = [];

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';

      let preview: string | null = null;

      if (file.type.startsWith('image/')) {
        preview = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string) || null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
      } else if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        try {
          const buffer = await file.arrayBuffer();
          preview = await renderPdfFirstPageToImage(buffer, 540);
        } catch {
          preview = null;
        }
      } else {
        preview = null;
      }

      newQueueItems.push({
        id: `queue-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        file,
        title: '',
        category: uploadFormMode === 'student' ? 'Students Materials' : '',
        customCategoryMode: false,
        description: '',
        tags: '',
        level: '',
        department: '',
        institution: '',
        previewUrl: preview,
        fileSize: formatBytes(file.size),
        fileType: ext,
      });
    }

    setQueuedFiles((prev) => [...prev, ...newQueueItems]);
  };

  const handleOpenUploadModal = (preferredMode?: 'general' | 'student') => {
    const mode: 'general' | 'student' = isOwner
      ? preferredMode || 'general'
      : 'student';
    setUploadFormMode(mode);
    setUploadError(null);
    setUploadSuccessMsg(null);
    setQueuedFiles([]);
    setUploaderName(isOwner ? 'Chief Admin' : '');
    setIsUploadModalOpen(true);
  };

  const handleSwitchUploadFormMode = (nextMode: 'general' | 'student') => {
    if (!isOwner && nextMode === 'general') return;
    setUploadFormMode(nextMode);
    setUploadError(null);
    if (isOwner && !uploaderName.trim()) {
      setUploaderName('Chief Admin');
    }
    setQueuedFiles((prev) =>
      prev.map((item) => ({
        ...item,
        category: nextMode === 'student' ? 'Students Materials' : item.category === 'Students Materials' ? '' : item.category,
      }))
    );
  };

  const handleRemoveQueueItem = (id: string) => {
    setQueuedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateQueueItem = (id: string, updates: Partial<QueuedUploadItem>) => {
    setQueuedFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const openPreviewModal = (doc: PublicEngineeringDocument) => {
    const optimisticViews = (doc.viewsCount || 0) + 1;
    const updatedDoc = { ...doc, viewsCount: optimisticViews };
    setPreviewModalDoc(updatedDoc);
    setDocuments((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, viewsCount: optimisticViews } : d))
    );
    void incrementMaterialViewsInSupabase(doc.id).then((serverViews) => {
      if (typeof serverViews === 'number') {
        setDocuments((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, viewsCount: serverViews } : d))
        );
        setPreviewModalDoc((cur) => (cur?.id === doc.id ? { ...cur, viewsCount: serverViews } : cur));
      }
    });
  };

  const handleLikeDocument = async (doc: PublicEngineeringDocument, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const currentlyLiked = likedMaterialIds.has(doc.id);
    const delta: 1 | -1 = currentlyLiked ? -1 : 1;
    const optimistic = Math.max(0, (doc.likesCount || 0) + delta);

    setLikedMaterialIds((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(doc.id);
      else next.add(doc.id);
      try {
        localStorage.setItem('fesline_liked_materials_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    setDocuments((prev) =>
      prev.map((d) => (d.id === doc.id ? { ...d, likesCount: optimistic } : d))
    );
    if (previewModalDoc?.id === doc.id) {
      setPreviewModalDoc((cur) => (cur ? { ...cur, likesCount: optimistic } : cur));
    }

    const serverLikes = await toggleMaterialLikeInSupabase(doc.id, delta, optimistic);
    if (typeof serverLikes === 'number') {
      setDocuments((prev) =>
        prev.map((d) => (d.id === doc.id ? { ...d, likesCount: serverLikes } : d))
      );
      if (previewModalDoc?.id === doc.id) {
        setPreviewModalDoc((cur) => (cur ? { ...cur, likesCount: serverLikes } : cur));
      }
    }
  };

  /**
   * Publish all queued documents (General Form: Admin only; Student Materials Form: Admin & Visitors)
   */
  const handlePublishAllQueued = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (queuedFiles.length === 0) {
      setUploadError('Please select at least one document file to upload.');
      return;
    }

    if (!isOwner && !uploaderName.trim()) {
      setUploadError('Please enter your name in the "From" field.');
      return;
    }

    const effectiveMode: 'general' | 'student' = isOwner ? uploadFormMode : 'student';

    for (let idx = 0; idx < queuedFiles.length; idx++) {
      const item = queuedFiles[idx];
      if (!item.title.trim()) {
        setUploadError(`Please enter a Title for document #${idx + 1}.`);
        return;
      }
      if (effectiveMode === 'general') {
        if (!item.category.trim()) {
          setUploadError(`Please select or type a Category for document #${idx + 1}.`);
          return;
        }
      } else {
        if (!item.level.trim() || !item.department.trim() || !item.institution.trim()) {
          setUploadError(
            `Please complete Level, Department, and Institution (Abbreviation) for Student Material #${idx + 1}.`
          );
          return;
        }
      }
    }

    setIsPublishing(true);
    setUploadError(null);
    setUploadSuccessMsg(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const activeSession = sessionData?.session;

    const isAal2Session = Boolean(activeSession?.user && getSessionAalClaim(activeSession) === 'aal2');
    if (effectiveMode === 'general' && (!isOwner || !isAal2Session)) {
      setIsPublishing(false);
      setUploadError('Active AAL2 MFA owner session is required for the General Upload Form.');
      showToast('MFA verification (AAL2) required for General Upload Form.', 'error');
      return;
    }

    const allowPublicStudentUpload = effectiveMode === 'student' && !isAal2Session;
    const ownerUid = activeSession?.user?.id;
    const effectiveUploader = isOwner ? (uploaderName.trim() || 'Chief Admin') : uploaderName.trim();

    const total = queuedFiles.length;
    setUploadProgress({ current: 0, total, percent: 15, currentFileName: 'Uploading...' });

    try {
      const newDocs: PublicEngineeringDocument[] = await Promise.all(
        queuedFiles.map(async (item, i) => {
          setUploadProgress({
            current: i + 1,
            total,
            percent: Math.round(((i + 1) / (total * 2)) * 100),
            currentFileName: 'Uploading...',
          });

          const supaRes = await uploadMaterialToSupabaseBucket(
            item.file,
            item.file.name,
            ownerUid,
            allowPublicStudentUpload
          );
          if (!supaRes || !supaRes.publicUrl) {
            throw new Error(`Supabase Storage: Failed to generate public URL for "${item.file.name}"`);
          }

          const publicUrl = supaRes.publicUrl;
          const storagePath = supaRes.storagePath;

          const tagList = item.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

          const docId =
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : ensureValidUuid(`doc-${Date.now()}-${i}-${item.file.name}`);
          const timestamp = Date.now() + i;

          let finalPreviewUrl: string | undefined = undefined;
          if (item.file.type.startsWith('image/')) {
            finalPreviewUrl = publicUrl;
          } else if (item.previewUrl && item.previewUrl.startsWith('data:image/')) {
            const uploadedThumbUrl = await uploadMaterialThumbnailToBucket(
              item.previewUrl,
              docId,
              ownerUid,
              allowPublicStudentUpload
            );
            finalPreviewUrl = uploadedThumbUrl || item.previewUrl;
          } else if (item.previewUrl && !isMockDrawingPreview(item.previewUrl)) {
            finalPreviewUrl = item.previewUrl;
          }

          const finalCategory =
            effectiveMode === 'student' ? 'Students Materials' : item.category.trim();
          const normalizedInstitution =
            effectiveMode === 'student' ? item.institution.trim().toUpperCase() : '';

          const docObj: PublicEngineeringDocument = {
            id: docId,
            title: item.title.trim(),
            fileName: item.file.name,
            fileSize: item.fileSize,
            fileType: item.fileType,
            category: finalCategory,
            description: sanitizeDocumentDescription(item.description),
            author: effectiveUploader,
            uploaderName: effectiveUploader,
            uploaderType: isOwner ? 'owner' : 'visitor',
            status: 'approved',
            uploadDate: new Date().toISOString().split('T')[0],
            uploadTimestamp: timestamp,
            downloadCount: 0,
            viewsCount: 0,
            likesCount: 0,
            level: effectiveMode === 'student' ? item.level.trim() : '',
            department: effectiveMode === 'student' ? item.department.trim() : '',
            institution: normalizedInstitution,
            tags: tagList,
            previewUrl: finalPreviewUrl,
            downloadUrl: publicUrl,
            hasServerFile: true,
            isCustomUpload: true,
          };

          (docObj as any).storagePath = storagePath;
          (docObj as any).fileUrl = publicUrl;
          return docObj;
        })
      );

      setUploadProgress({ current: 1, total, percent: 65, currentFileName: 'Saving to Supabase...' });
      await Promise.all(
        newDocs.map((docItem) =>
          saveMaterialToSupabaseTable(docItem, ownerUid, allowPublicStudentUpload)
        )
      );

      setUploadProgress({ current: 1, total, percent: 85, currentFileName: 'Publishing...' });

      const updatedAll = sortDocumentsDescending([
        ...newDocs,
        ...documents.filter((d) => !newDocs.some((p) => p.id === d.id)),
      ]);

      setDocuments(updatedAll);
      saveDocumentsToStorage(updatedAll);

      const isLocalHost =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      if (isLocalHost) {
        try {
          const authHeaders = isOwner ? await getAuthenticatedBearerHeaders() : {};
          await fetch('/api/documents/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders },
            body: JSON.stringify({ documents: newDocs }),
          });
        } catch {}
      }

      if (activeSession?.user) {
        await Promise.allSettled(
          newDocs.map(async (doc) => {
            try {
              await saveHubDocumentToFirestore(doc);
            } catch {}
          })
        );
      }

      setUploadProgress({ current: total, total, percent: 100, currentFileName: 'Upload complete!' });
      setIsPublishing(false);
      const count = newDocs.length;
      const msg =
        count === 1
          ? `"${newDocs[0]?.title}" uploaded and published!`
          : `All ${count} documents uploaded and published!`;

      showToast(msg, 'success');
      setQueuedFiles([]);
      setIsUploadModalOpen(false);
      setUploadSuccessMsg(null);
      setUploadProgress({ current: 0, total: 0, percent: 0, currentFileName: '' });
      window.dispatchEvent(new CustomEvent('fesline_hub_docs_updated'));
    } catch (err: any) {
      console.error('[Supabase Hub Upload/Database Error]:', err);
      setIsPublishing(false);
      setUploadError(`Upload failed: ${err?.message || 'Storage error'}`);
      showToast(`Upload failed: ${err?.message || 'Storage error'}`, 'error');
    }
  };

  /**
   * 1-Click Fast Direct Download
   */
  const handleDownloadDocument = (doc: PublicEngineeringDocument) => {
    // 1. Increment download count in Firestore & storage
    incrementHubDocumentDownload(doc.id).catch(() => {});
    const updated = documents.map((d) => {
      if (d.id === doc.id) {
        return { ...d, downloadCount: (d.downloadCount || 0) + 1 };
      }
      return d;
    });
    saveDocumentsToStorage(updated);
    try {
      fetch(`/api/documents/${doc.id}/download`, { method: 'POST' }).catch(() => {});
    } catch {}

    // 2. Trigger browser download directly from uploaded file dataUrl or server stream
    if (doc.dataUrl) {
      const link = document.createElement('a');
      link.href = doc.dataUrl;
      link.download = doc.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Downloading "${doc.fileName}"...`, 'info');
      return;
    }

    if (doc.downloadUrl || doc.hasServerFile) {
      const serverUrl = doc.downloadUrl || `/api/documents/files/${doc.id}`;
      const link = document.createElement('a');
      link.href = serverUrl;
      link.download = doc.fileName;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Downloading "${doc.fileName}"...`, 'info');
      return;
    }

    showToast(`File content for "${doc.fileName}" is not available.`, 'error');
  };

  const handleDeleteDocument = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isOwner) {
      showToast('Only the repository owner has permission to delete documents.', 'error');
      return;
    }
    setIsDeleting(true);
    const targetDoc = documents.find((d) => d.id === id);
    const title = targetDoc?.title || 'Document';
    const uuidAlias = ensureValidUuid(id);

    // 0. Record in persistent deleted set so real-time listeners and refetches never re-add it
    recordDeletedDocId(id);
    if (uuidAlias && uuidAlias !== id) {
      recordDeletedDocId(uuidAlias);
    }

    inMemoryThumbCache.delete(id);
    try {
      localStorage.removeItem(`${THUMB_CACHE_PREFIX}${id}`);
    } catch {}

    // 1. Immediately update state and HUB_CACHE_KEY in localStorage
    const updated = documents.filter((d) => d.id !== id && d.id !== uuidAlias);
    setDocuments(updated);
    saveDocumentsToStorage(updated);

    // 2. Immediately close preview if open
    if (previewModalDoc?.id === id) {
      setPreviewModalDoc(null);
    }

    // 3. Await deletion across Supabase, Firestore, IndexedDB, and CloudSQL backend
    try {
      const storagePath = (targetDoc as any)?.storagePath;
      const authHeaders = await getAuthenticatedBearerHeaders();
      const deleteTasks: Promise<any>[] = [
        deleteMaterialFromSupabaseTable(id),
        deleteHubDocumentFromFirestore(id, storagePath),
        deleteHubDocumentPersistently(id),
        fetch(`/api/documents/${id}`, { method: 'DELETE', headers: authHeaders }),
      ];
      if (storagePath) {
        deleteTasks.push(deleteMaterialFromSupabaseBucket(storagePath));
      }
      const ownerUid = getAuthenticatedOwnerUid();
      if (ownerUid) {
        deleteTasks.push(deleteMaterialFromSupabaseBucket(`${ownerUid}/thumbs/${id}.jpg`));
        deleteTasks.push(deleteMaterialFromSupabaseBucket(`${ownerUid}/thumbs/${id}.webp`));
        deleteTasks.push(deleteMaterialFromSupabaseBucket(`${ownerUid}/thumbs/${id}.png`));
      }
      await Promise.allSettled(deleteTasks);
    } finally {
      setIsDeleting(false);
    }

    // 4. Notify user
    showToast(`"${title}" permanently deleted.`, 'info');
  };

  const confirmDeleteDocument = async () => {
    if (!docToDelete || !isOwner) return;
    await handleDeleteDocument(docToDelete.id);
    setDocToDelete(null);
  };

  const approvedDocs = useMemo(() => documents, [documents]);

  // Active categories only (derived strictly from live uploaded documents)
  const categories = useMemo(() => {
    const set = new Set<string>();
    approvedDocs.forEach((d) => {
      if (d.category?.trim()) set.add(d.category.trim());
    });
    return ['All', ...Array.from(set)];
  }, [approvedDocs]);

  // Active categories for General Form 1 (excludes Students Materials since Form 2 handles that)
  const activeGeneralCategories = useMemo(() => {
    const set = new Set<string>();
    approvedDocs.forEach((d) => {
      const cat = d.category?.trim();
      if (cat && cat !== 'Students Materials') set.add(cat);
    });
    return Array.from(set);
  }, [approvedDocs]);

  const filteredDocs = useMemo(() => {
    let result = approvedDocs.filter((doc) => {
      const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.institution && doc.institution.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.department && doc.department.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.uploaderName && doc.uploaderName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        doc.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });

    // Sorting
    if (sortBy === 'newest') {
      result = sortDocumentsDescending(result);
    } else if (sortBy === 'downloads') {
      result.sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0));
    } else if (sortBy === 'title') {
      result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    } else if (sortBy === 'size') {
      const parseSize = (s: string) => {
        const num = parseFloat(s) || 0;
        if (s.toLowerCase().includes('mb')) return num * 1024 * 1024;
        if (s.toLowerCase().includes('kb')) return num * 1024;
        return num;
      };
      result.sort((a, b) => parseSize(b.fileSize) - parseSize(a.fileSize));
    }

    return result;
  }, [approvedDocs, selectedCategory, searchQuery, sortBy]);

  const totalDownloads = useMemo(
    () => approvedDocs.reduce((sum, d) => sum + (d.downloadCount || 0), 0),
    [approvedDocs]
  );

  const supportedFormatsText = useMemo(() => {
    const exts = new Set<string>();
    approvedDocs.forEach((d) => {
      const ext = d.fileName.split('.').pop()?.toUpperCase();
      if (ext && ext.length <= 6) {
        exts.add(ext);
      }
    });
    if (exts.size === 0) return 'PDF, STEP, DWG, SLDPRT, ZIP, DOCX';
    return Array.from(exts).join(', ');
  }, [approvedDocs]);

  const getCategoryIcon = (category: DocumentCategory) => {
    switch (category) {
      case 'Students Materials':
        return <BookOpen className="w-4 h-4 text-cyan-700" />;
      case 'Christians Book':
      case 'Inspirational Book':
        return <BookOpen className="w-4 h-4 text-amber-600" />;
      case '3D CAD Model':
        return <Layers className="w-4 h-4 text-cyan-600" />;
      case 'Production Blueprint':
      case 'Technical Drawing':
        return <FileCode className="w-4 h-4 text-blue-600" />;
      case 'BOM & Specification':
      case 'Calculation & Dataset':
        return <FileSpreadsheet className="w-4 h-4 text-emerald-600" />;
      default:
        return <FileText className="w-4 h-4 text-slate-600" />;
    }
  };

  return (
    <div className="w-full space-y-4 font-serif text-slate-900">
      {/* Compact Centered Title Box (Matches Projects Page) */}
      <div className="max-w-xs mx-auto px-4 py-2 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs text-center">
        <h1 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight text-center font-serif">
          Engineering Hub
        </h1>
      </div>

      {/* 1. COMPACT OWNER PORTAL STRIP (VISIBLE ONLY TO OWNER WHEN LOGGED IN) */}
      {isOwner && (
        <div className="bg-white rounded-2xl border border-[#b8c6d4] p-3.5 sm:p-4 shadow-2xs text-slate-800 relative overflow-hidden text-center animate-fade-in">
          <div className="relative z-10 flex flex-col items-center justify-center text-center gap-3 max-w-4xl mx-auto">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-300 text-cyan-800 text-[9px] sm:text-[10px] font-mono font-bold tracking-wider uppercase">
                <FolderDown className="w-3 h-3 text-cyan-700" />
                <span>ACCESSORIES &amp; ARCHIVE</span>
              </div>
              <button
                onClick={() => handleOpenUploadModal('general')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-[10px] font-bold transition-all cursor-pointer shadow-2xs font-sans"
              >
                <Plus className="w-3 h-3" />
                <span>Upload</span>
              </button>
              <button
                onClick={() => handleOpenUploadModal('student')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-bold transition-all cursor-pointer shadow-2xs font-sans"
              >
                <GraduationCap className="w-3 h-3" />
                <span>Materials</span>
              </button>
              <span className="text-[9px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 font-semibold">
                <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                <span>Owner Mode</span>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="block text-[7.5px] font-mono text-slate-500 uppercase tracking-wider">TOTAL DOCUMENTS</span>
                <strong className="text-xs font-bold text-slate-900 font-mono">{approvedDocs.length}</strong>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="block text-[7.5px] font-mono text-slate-500 uppercase tracking-wider">TOTAL DOWNLOADS</span>
                <strong className="text-xs font-bold text-cyan-700 font-mono">{totalDownloads.toLocaleString()}</strong>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="block text-[7.5px] font-mono text-slate-500 uppercase tracking-wider">SUPPORTED FORMATS</span>
                <strong className="text-[8.5px] font-bold text-slate-800 block truncate font-mono max-w-full" title={supportedFormatsText}>
                  {supportedFormatsText}
                </strong>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="block text-[7.5px] font-mono text-slate-500 uppercase tracking-wider">ACCESS LEVEL</span>
                <strong className="text-[8.5px] font-bold text-emerald-700 flex items-center justify-center gap-1 font-mono">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Public 1-Click</span>
                </strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. TOOLBAR: SEARCH, CATEGORY & SORT CONTROLS (Styled like Projects Page) */}
      <div className="p-2.5 sm:p-3 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs space-y-2 text-xs font-serif">
        {/* Row 1: Search Box */}
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents, blueprints, study materials..."
            className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-700 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Row 2: Single-Row Flex Filter, Category & Upload/Post Action */}
        <div className="flex flex-nowrap items-center justify-between gap-1.5 sm:gap-2 min-w-0 w-full">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <select
              id="hub-category-filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              aria-label="Category filter"
              className="flex-1 sm:flex-initial min-w-0 max-w-[155px] sm:max-w-[200px] px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-cyan-700 cursor-pointer truncate"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All' : cat}
                </option>
              ))}
            </select>

            <select
              id="hub-sort-filter"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Filter documents"
              className="flex-1 sm:flex-initial min-w-0 max-w-[105px] sm:max-w-[135px] px-2 py-1 rounded-lg bg-white border border-slate-300 text-slate-800 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-cyan-700 cursor-pointer truncate"
            >
              <option value="newest">Newest</option>
              <option value="downloads">Most Downloaded</option>
              <option value="title">A-Z</option>
              <option value="size">Largest</option>
            </select>

            <span className="text-[10px] text-cyan-900 font-semibold whitespace-nowrap shrink-0">
              ({filteredDocs.length})
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleOpenUploadModal(isOwner ? 'general' : 'student')}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-[11px] font-semibold transition-colors cursor-pointer shrink-0 whitespace-nowrap shadow-2xs"
          >
            <Plus className="w-3 h-3 shrink-0" />
            <span>{isOwner ? 'Upload' : 'Post'}</span>
          </button>
        </div>

        {/* Category Quick Pills Bar (Organized Catalog Strip) */}
        {categories.length > 1 && (
          <div className="pt-1.5 border-t border-[#b8c6d4]/70 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              const count =
                cat === 'All'
                  ? approvedDocs.length
                  : approvedDocs.filter((d) => d.category === cat).length;
              return (
                <button
                  key={`tab-${cat}`}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-0.5 rounded-md border text-[10.5px] font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-cyan-900 border-cyan-900 text-white shadow-2xs'
                      : 'bg-white border-slate-300 text-slate-700 hover:border-cyan-700 hover:text-cyan-900'
                  }`}
                >
                  {cat === 'All' ? 'All' : cat} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. DOCUMENTS DIRECTORY GRID (3, 4, or 5 Cards per Row on Desktop) */}
      <div>
        {isLoadingDocs && documents.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={`doc-skel-${s}`} className="bg-white rounded-xl border border-[#b8c6d4] p-3 space-y-2.5 animate-pulse">
                <div className="w-full aspect-[4/4.2] bg-slate-100 rounded-lg" />
                <div className="h-3.5 bg-slate-200 rounded w-3/4 mx-auto" />
                <div className="h-3 bg-slate-100 rounded w-1/2 mx-auto" />
                <div className="h-7 bg-slate-100 rounded-lg w-full" />
              </div>
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="p-8 sm:p-10 text-center rounded-xl bg-white/90 border border-dashed border-[#b8c6d4] text-slate-700 space-y-3 shadow-2xs">
            <div className="w-12 h-12 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] flex items-center justify-center text-cyan-800 mx-auto">
              <FolderDown className="w-6 h-6 text-cyan-800" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 font-serif">
                {searchQuery ? `No documents found matching "${searchQuery}"` : 'No Documents In This Category Yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                {searchQuery
                  ? 'Try adjusting your search terms or selecting "All" categories.'
                  : 'Upload technical drawings, books, 3D CAD models, or study materials.'}
              </p>
            </div>
            {isOwner ? (
              <button
                onClick={() => handleOpenUploadModal('general')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
              </button>
            ) : (
              <button
                onClick={() => handleOpenUploadModal('student')}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Post</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredDocs.map((doc) => {
              const displayTitle = sanitizeDocumentTitle(doc.title, doc.fileName);
              const cleanDesc = sanitizeDocumentDescription(doc.description);
              const isLiked = likedMaterialIds.has(doc.id);
              const fromLabel = (doc.uploaderName || doc.author || '').trim();
              return (
                <article
                  key={doc.id}
                  onClick={() => openPreviewModal(doc)}
                  className="group bg-white rounded-xl border border-[#b8c6d4] hover:border-cyan-700 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative cursor-pointer"
                >
                  <div>
                    {/* Card Top: Full-Bleed First Page Preview Thumbnail */}
                    {(() => {
                      const isPdfFile =
                        doc.fileType?.toUpperCase() === 'PDF' ||
                        Boolean(doc.fileName && /\.pdf$/i.test(doc.fileName));
                      const canPreview =
                        Boolean(doc.previewUrl && !isMockDrawingPreview(doc.previewUrl)) || isPdfFile;
                      return (
                        <div className="relative w-full aspect-[4/4.2] bg-white overflow-hidden border-b border-slate-200 p-0">
                          <EngineeringHubPdfCardThumbnail doc={doc} />

                          {/* Format & Size Badge */}
                          <div className="absolute top-2 left-2 flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-white/95 backdrop-blur-xs border border-cyan-300 text-cyan-900 text-[9px] font-mono font-bold shadow-2xs">
                              {doc.fileType}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white/95 backdrop-blur-xs border border-slate-300 text-slate-700 text-[9px] font-mono font-semibold shadow-2xs">
                              {doc.fileSize}
                            </span>
                          </div>

                          {/* Preview Button */}
                          {canPreview && (
                            <div className="absolute top-2 right-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openPreviewModal(doc);
                                }}
                                className="p-1 rounded-md bg-white/95 hover:bg-cyan-50 text-slate-600 hover:text-cyan-800 border border-slate-300 transition-colors shadow-2xs cursor-pointer"
                                title="Preview Document"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Card Middle: Content & Metadata (Matches Projects Card Structure) */}
                    <div className="p-2.5 sm:p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-1.5 text-[9.5px]">
                        <span className="px-1.5 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-950 font-bold flex items-center gap-1 min-w-0 truncate">
                          {getCategoryIcon(doc.category)}
                          <span className="truncate">{doc.category || 'Document'}</span>
                        </span>
                        <span className="text-[9px] text-slate-500 font-sans shrink-0">
                          {doc.uploadDate}
                        </span>
                      </div>

                      {displayTitle && (
                        <h3 className="text-xs sm:text-[13px] font-bold text-slate-950 group-hover:text-cyan-800 transition-colors line-clamp-2 leading-snug text-center">
                          {displayTitle}
                        </h3>
                      )}

                      {(doc.level || doc.department || doc.institution) && (
                        <div className="flex flex-wrap items-center justify-center gap-1 text-[9px] font-mono">
                          {doc.level && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-900 font-bold">
                              {doc.level}
                            </span>
                          )}
                          {doc.institution && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white font-bold uppercase">
                              {doc.institution}
                            </span>
                          )}
                          {doc.department && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700 truncate max-w-full">
                              {doc.department}
                            </span>
                          )}
                        </div>
                      )}

                      {cleanDesc && (
                        <p className="text-[10.5px] text-slate-600 line-clamp-2 leading-relaxed text-center w-full">
                          {cleanDesc}
                        </p>
                      )}

                      {doc.tags.length > 0 && (
                        <div className="flex flex-wrap items-center justify-center gap-1 pt-0.5">
                          {doc.tags.slice(0, 2).map((tag, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-[9px] font-sans text-slate-600 truncate max-w-[90px]"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {fromLabel && (
                        <div className="text-[9.5px] text-slate-600 font-sans text-left w-full truncate" title={`From: ${fromLabel}`}>
                          From: <span className="text-slate-900 font-semibold">{fromLabel}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer: Stats + Download Action */}
                  <div
                    className="px-2.5 pb-2.5 pt-2 bg-slate-50/80 border-t border-slate-100 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-1 text-[9.5px] text-slate-500 font-sans">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-flex items-center gap-0.5 text-slate-700 font-semibold tabular-nums"
                          title="Real-time views"
                        >
                          <Eye className="w-3 h-3 text-cyan-800" />
                          <span>{doc.viewsCount || 0}</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => void handleLikeDocument(doc, e)}
                          aria-label={isLiked ? 'Unlike document' : 'Like document'}
                          className={`inline-flex items-center gap-0.5 font-semibold transition-colors cursor-pointer tabular-nums ${
                            isLiked ? 'text-rose-700' : 'text-slate-600 hover:text-rose-600'
                          }`}
                        >
                          <Heart className={`w-3 h-3 ${isLiked ? 'fill-rose-600 text-rose-600' : ''}`} />
                          <span>{doc.likesCount || 0}</span>
                        </button>
                      </div>
                      <span className="text-cyan-800 font-bold flex items-center gap-0.5 shrink-0 tabular-nums">
                        <FolderDown className="w-3 h-3 text-cyan-700" />
                        <span>{doc.downloadCount}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={doc.downloadUrl || doc.dataUrl || `/api/documents/files/${doc.id}`}
                        download={doc.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          incrementHubDocumentDownload(doc.id).catch(() => {});
                          try {
                            fetch(`/api/documents/${doc.id}/download`, { method: 'POST' }).catch(() => {});
                          } catch {}
                        }}
                        className="flex-1 h-7 px-2 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white font-semibold text-[10.5px] flex items-center justify-center gap-1 shadow-2xs transition-all cursor-pointer text-center no-underline"
                      >
                        <Download className="w-3 h-3 text-white shrink-0" />
                        <span className="truncate">Download {doc.fileName.split('.').pop()?.toUpperCase() || 'File'}</span>
                      </a>

                      {isOwner && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDocToDelete(doc);
                          }}
                          className="h-7 w-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-300 flex items-center justify-center transition-all cursor-pointer shadow-2xs shrink-0"
                          title="Delete document (Owner only)"
                          aria-label="Delete document"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. MODAL: DUAL UPLOAD FORMS (Admin: General + Student Materials; Visitors: Student Materials Only) */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto overflow-x-hidden">
          <div className="relative w-full max-w-2xl bg-white border border-slate-300 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl text-slate-800 space-y-4 animate-fadeIn my-auto max-h-[92vh] flex flex-col overflow-hidden box-border">
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 min-w-0 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
                  {(!isOwner || uploadFormMode === 'student') ? (
                    <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
                  ) : (
                    <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {(!isOwner || uploadFormMode === 'student')
                      ? 'Post Student Material'
                      : 'Upload Documents & Files'}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    {(!isOwner || uploadFormMode === 'student')
                      ? 'Student Materials Form — Category: Students Materials'
                      : 'General Repository Form (Admin Only)'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isPublishing) {
                    setIsUploadModalOpen(false);
                    setQueuedFiles([]);
                  }
                }}
                disabled={isPublishing}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Admin-only switcher between Form 1 (General) and Form 2 (Student Materials) */}
            {isOwner && (
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => handleSwitchUploadFormMode('general')}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer truncate ${
                    uploadFormMode === 'general'
                      ? 'bg-cyan-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Form 1: General Upload
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchUploadFormMode('student')}
                  className={`py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer truncate ${
                    uploadFormMode === 'student'
                      ? 'bg-cyan-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Form 2: Student Materials
                </button>
              </div>
            )}

            {uploadSuccessMsg ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
                <h4 className="text-base sm:text-lg font-bold text-slate-900">Uploads Published Successfully!</h4>
                <p className="text-xs max-w-md mx-auto text-emerald-900 leading-relaxed break-words">
                  {uploadSuccessMsg}
                </p>
              </div>
            ) : (
              <form onSubmit={handlePublishAllQueued} className="space-y-3.5 flex-1 min-h-0 min-w-0 w-full overflow-y-auto overflow-x-hidden box-border">
                {/* From (Uploader's Name) Bar — automatically set to Chief Admin when admin is logged in */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 w-full min-w-0 box-border">
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider">
                    From (Uploader Name) *
                  </label>
                  <input
                    type="text"
                    required
                    readOnly={isOwner}
                    value={isOwner ? 'Chief Admin' : uploaderName}
                    onChange={(e) => {
                      if (!isOwner) setUploaderName(e.target.value);
                    }}
                    placeholder={isOwner ? 'Chief Admin' : 'Enter your name'}
                    className={`w-full min-w-0 box-border p-2 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-600 font-sans ${
                      isOwner ? 'bg-cyan-50/70 font-semibold text-cyan-950 cursor-default' : 'bg-white'
                    }`}
                  />
                </div>

                {/* Dropzone */}
                <div className="w-full min-w-0 box-border">
                  <input
                    ref={modalFileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.step,.stp,.iges,.igs,.sldprt,.sldasm,.dwg,.dxf,.zip,.rar,.7z,.png,.jpg,.jpeg,.webp,.svg,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.csv,.json"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFilesPicked(e.target.files);
                      }
                    }}
                    className="hidden"
                  />
                  <input
                    ref={addMoreInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.step,.stp,.iges,.igs,.sldprt,.sldasm,.dwg,.dxf,.zip,.rar,.7z,.png,.jpg,.jpeg,.webp,.svg,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.txt,.csv,.json"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFilesPicked(e.target.files);
                      }
                    }}
                    className="hidden"
                  />

                  {queuedFiles.length === 0 ? (
                    <div
                      onClick={() => modalFileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleFilesPicked(e.dataTransfer.files);
                        }
                      }}
                      className="w-full box-border border-2 border-dashed border-slate-300 hover:border-cyan-600 bg-slate-50/70 hover:bg-cyan-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 group"
                    >
                      <div className="w-11 h-11 rounded-2xl bg-cyan-100/70 border border-cyan-300 flex items-center justify-center text-cyan-800 group-hover:scale-105 transition-transform shadow-xs">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-800 block">
                        Click to browse or drag &amp; drop files here
                      </span>
                      <span className="text-[11px] text-slate-500 block max-w-full break-words">
                        {(!isOwner || uploadFormMode === 'student')
                          ? 'Upload Student Material PDFs, Lecture Notes, Past Questions, or Guides'
                          : 'PDF Books, Technical Drawings, STEP CAD, Word, Excel, ZIP'}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2.5 w-full min-w-0">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-[11px] font-bold text-slate-800 font-mono uppercase tracking-wider flex items-center gap-1.5 truncate">
                          <ListPlus className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                          <span>Queued Files ({queuedFiles.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => addMoreInputRef.current?.click()}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add More</span>
                        </button>
                      </div>

                      {/* Itemized File Cards */}
                      <div className="space-y-2.5 max-h-72 overflow-y-auto overflow-x-hidden w-full min-w-0">
                        {queuedFiles.map((item, idx) => {
                          const isStudentForm = !isOwner || uploadFormMode === 'student';
                          return (
                            <div
                              key={item.id}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-xs space-y-2 w-full min-w-0 box-border overflow-hidden"
                            >
                              <div className="flex items-start justify-between gap-2 min-w-0">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                    {item.previewUrl ? (
                                      <img src={item.previewUrl} alt="Preview" loading="lazy" decoding="async" className="w-full h-full object-contain" />
                                    ) : (
                                      getCategoryIcon(item.category)
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-900 shrink-0">
                                        #{idx + 1}
                                      </span>
                                      <input
                                        type="text"
                                        required
                                        value={item.title}
                                        onChange={(e) => handleUpdateQueueItem(item.id, { title: e.target.value })}
                                        className="font-bold text-xs text-slate-900 bg-white px-2 py-1 rounded border border-slate-300 focus:border-cyan-600 focus:outline-none w-full min-w-0"
                                        placeholder="Enter document title *"
                                      />
                                    </div>
                                    <div className="text-[10.5px] text-slate-500 font-mono flex flex-wrap items-center gap-1.5 mt-1 min-w-0">
                                      <span className="truncate max-w-[180px] sm:max-w-[260px]" title={item.file.name}>{item.file.name}</span>
                                      <span>·</span>
                                      <span className="shrink-0">{item.fileSize}</span>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveQueueItem(item.id)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                                  title="Remove file"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>

                              {isStudentForm ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-slate-200/60 w-full min-w-0">
                                  <div className="min-w-0">
                                    <label className="block text-[9.5px] font-mono text-slate-500 uppercase mb-0.5">Category</label>
                                    <div className="w-full px-2 py-1.5 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-900 text-[10px] font-semibold">
                                      Students Materials
                                    </div>
                                  </div>

                                  <div className="min-w-0">
                                    <label className="block text-[9.5px] font-mono text-slate-500 uppercase mb-0.5">Level *</label>
                                    <select
                                      required
                                      value={item.level}
                                      onChange={(e) => handleUpdateQueueItem(item.id, { level: e.target.value })}
                                      className="w-full min-w-0 box-border text-xs p-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-sans cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    >
                                      <option value="">Select Level</option>
                                      {STUDENT_LEVELS.map((lvl) => (
                                        <option key={lvl} value={lvl}>
                                          {lvl}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="min-w-0">
                                    <label className="block text-[9.5px] font-mono text-slate-500 uppercase mb-0.5">Department *</label>
                                    <input
                                      type="text"
                                      required
                                      value={item.department}
                                      onChange={(e) => handleUpdateQueueItem(item.id, { department: e.target.value })}
                                      placeholder="e.g. Mechanical Engineering"
                                      className="w-full min-w-0 box-border text-xs p-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-sans focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                  </div>

                                  <div className="min-w-0">
                                    <label className="block text-[9.5px] font-mono text-slate-500 uppercase mb-0.5">Institution (Abbreviation) *</label>
                                    <input
                                      type="text"
                                      required
                                      value={item.institution}
                                      onChange={(e) =>
                                        handleUpdateQueueItem(item.id, {
                                          institution: e.target.value.toUpperCase().replace(/[^A-Z0-9.\-/ ]/g, ''),
                                        })
                                      }
                                      placeholder="e.g. FUTA / UNILAG"
                                      className="w-full min-w-0 box-border text-xs p-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                  </div>

                                  <div className="sm:col-span-2 min-w-0">
                                    <label className="block text-[9.5px] font-mono text-slate-500 uppercase mb-0.5">Tags</label>
                                    <input
                                      type="text"
                                      value={item.tags}
                                      onChange={(e) => handleUpdateQueueItem(item.id, { tags: e.target.value })}
                                      placeholder="Type comma-separated tags (optional)"
                                      className="w-full min-w-0 box-border text-xs p-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-sans focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                  </div>

                                  <div className="sm:col-span-2 min-w-0">
                                    <label className="block text-[9.5px] font-mono text-slate-500 uppercase mb-0.5">Description</label>
                                    <textarea
                                      rows={2}
                                      value={item.description}
                                      onChange={(e) => handleUpdateQueueItem(item.id, { description: e.target.value })}
                                      placeholder="Enter student material description"
                                      className="w-full min-w-0 box-border text-xs p-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-sans focus:outline-none focus:ring-1 focus:ring-cyan-600 resize-y"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5 border-t border-slate-200/60 w-full min-w-0">
                                  <div className="min-w-0">
                                    <label className="block text-[9.5px] font-mono text-slate-500 uppercase mb-0.5">Category *</label>
                                    {!item.customCategoryMode && activeGeneralCategories.length > 0 ? (
                                      <select
                                        required
                                        value={activeGeneralCategories.includes(item.category) ? item.category : ''}
                                        onChange={(e) => {
                                          if (e.target.value === '__custom__') {
                                            handleUpdateQueueItem(item.id, { customCategoryMode: true, category: '' });
                                          } else {
                                            handleUpdateQueueItem(item.id, { category: e.target.value });
                                          }
                                        }}
                                        className="w-full min-w-0 box-border text-[10px] p-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-sans cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                      >
                                        <option value="">Select active category</option>
                                        {activeGeneralCategories.map((cat) => (
                                          <option key={cat} value={cat}>
                                            {cat}
                                          </option>
                                        ))}
                                        <option value="__custom__">+ Type a category</option>
                                      </select>
                                    ) : (
                                      <div className="flex items-center gap-1 min-w-0">
                                        <input
                                          type="text"
                                          required
                                          value={item.category}
                                          onChange={(e) => handleUpdateQueueItem(item.id, { category: e.target.value })}
                                          placeholder="Type category"
                                          className="flex-1 min-w-0 box-border text-[10px] p-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-sans focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                        />
                                        {activeGeneralCategories.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleUpdateQueueItem(item.id, {
                                                customCategoryMode: false,
                                                category: activeGeneralCategories.includes(item.category) ? item.category : '',
                                              })
                                            }
                                            className="px-1.5 py-1 rounded border border-slate-300 bg-white text-[9.5px] font-semibold cursor-pointer shrink-0"
                                          >
                                            Active
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <label className="block text-[9.5px] font-mono text-slate-500 uppercase mb-0.5">Tags</label>
                                    <input
                                      type="text"
                                      value={item.tags}
                                      onChange={(e) => handleUpdateQueueItem(item.id, { tags: e.target.value })}
                                      placeholder="Type comma-separated tags"
                                      className="w-full min-w-0 box-border text-xs p-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-sans focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                    />
                                  </div>
                                  <div className="sm:col-span-2 min-w-0">
                                    <label className="block text-[9.5px] font-mono text-slate-500 uppercase mb-0.5">Description</label>
                                    <textarea
                                      rows={2}
                                      value={item.description}
                                      onChange={(e) => handleUpdateQueueItem(item.id, { description: e.target.value })}
                                      placeholder="Enter document description (optional)"
                                      className="w-full min-w-0 box-border text-xs p-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-sans focus:outline-none focus:ring-1 focus:ring-cyan-600 resize-y"
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {uploadError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-start gap-2 w-full min-w-0 box-border">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span className="break-words min-w-0 flex-1">{uploadError}</span>
                  </div>
                )}

                {/* Progress Bar */}
                {isPublishing && (
                  <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center gap-2 text-xs text-cyan-950 font-semibold w-full min-w-0 box-border">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-800 shrink-0" />
                    <span>Uploading..... {Math.round(uploadProgress.percent)}%</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 w-full min-w-0">
                  <button
                    type="button"
                    disabled={isPublishing}
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setQueuedFiles([]);
                    }}
                    className="px-3 py-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPublishing || queuedFiles.length === 0}
                    className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isPublishing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Uploading.....</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        <span>
                          Publish {queuedFiles.length > 0 ? `${queuedFiles.length} ` : ''}Doc
                          {queuedFiles.length === 1 ? '' : 's'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 6. MODAL: LIGHTBOX PREVIEW */}
      {previewModalDoc && (
        <div
          onClick={() => setPreviewModalDoc(null)}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl bg-white border border-slate-300 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-800 space-y-4 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-cyan-700 block font-semibold">{previewModalDoc.category}</span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate max-w-[600px]">
                  {sanitizeDocumentTitle(previewModalDoc.title, previewModalDoc.fileName) || previewModalDoc.fileName}
                </h3>
                {(previewModalDoc.uploaderName || previewModalDoc.author || previewModalDoc.level || previewModalDoc.institution) && (
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5 truncate">
                    {(previewModalDoc.uploaderName || previewModalDoc.author) && (
                      <span>From: <strong className="text-slate-800">{previewModalDoc.uploaderName || previewModalDoc.author}</strong></span>
                    )}
                    {previewModalDoc.level && <span> · {previewModalDoc.level}</span>}
                    {previewModalDoc.department && <span> · {previewModalDoc.department}</span>}
                    {previewModalDoc.institution && <span> · {previewModalDoc.institution}</span>}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalDoc(null)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 transition-colors cursor-pointer shrink-0 shadow-2xs"
                aria-label="Close Preview"
                title="Close Preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50 rounded-2xl border border-slate-200 p-2 flex items-center justify-center min-h-[360px]">
              <EngineeringHubModalPreview doc={previewModalDoc} />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-mono">
                <span>File Size: <strong className="text-slate-900">{previewModalDoc.fileSize}</strong></span>
                <span>·</span>
                <span>Views: <strong className="text-slate-900">{previewModalDoc.viewsCount || 0}</strong></span>
                <span>·</span>
                <button
                  type="button"
                  onClick={(e) => void handleLikeDocument(previewModalDoc, e)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-semibold cursor-pointer ${
                    likedMaterialIds.has(previewModalDoc.id)
                      ? 'bg-rose-50 border-rose-300 text-rose-700'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <Heart className={`w-3 h-3 ${likedMaterialIds.has(previewModalDoc.id) ? 'fill-rose-600 text-rose-600' : ''}`} />
                  <span>{previewModalDoc.likesCount || 0}</span>
                </button>
                <span>·</span>
                <span>Downloads: <strong className="text-cyan-700">{previewModalDoc.downloadCount}</strong></span>
              </div>
              {isOwner && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const docToDel = previewModalDoc;
                      setPreviewModalDoc(null);
                      setDocToDelete(docToDel);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-300 font-semibold text-xs cursor-pointer shadow-2xs transition-all"
                    title="Delete this document (Owner only)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: PERMANENT DELETE CONFIRMATION */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-md bg-white border border-slate-300 rounded-3xl p-6 shadow-2xl text-slate-800 space-y-4 animate-fadeIn my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Delete Document
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    Permanent Removal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDocToDelete(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-cyan-700 font-bold uppercase">{docToDelete.category}</span>
                <span className="text-slate-500">{docToDelete.fileSize}</span>
              </div>
              <p className="text-sm font-bold text-slate-900 line-clamp-2">
                {docToDelete.title}
              </p>
              <p className="text-[11px] text-slate-500 font-mono truncate">
                File: {docToDelete.fileName}
              </p>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to permanently delete this document from the Engineering Hub? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-200">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDocToDelete(null)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteDocument}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                    <span>Yes, Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-950/95 text-slate-100 px-3.5 py-2.5 rounded-xl shadow-xl border border-cyan-500/30 flex items-center gap-2.5 animate-fadeIn max-w-xs sm:max-w-md text-xs font-sans font-medium">
          {toastMsg.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMsg.type === 'info' && <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />}
          {toastMsg.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span className="truncate flex-1">{toastMsg.text}</span>
          <button
            onClick={() => setToastMsg(null)}
            className="text-slate-400 hover:text-white p-0.5 ml-1 shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
