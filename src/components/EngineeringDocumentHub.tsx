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
  ArrowUpDown
} from 'lucide-react';
import { jsPDF } from 'jspdf';
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
  OWNER_PASSWORD
} from '../utils/profileState';
import {
  uploadMaterialToSupabaseBucket,
  saveMaterialToSupabaseTable,
  fetchMaterialsFromSupabaseTable,
  deleteMaterialFromSupabaseBucket,
  deleteMaterialFromSupabaseTable,
  getAuthenticatedOwnerUid,
} from '../utils/supabase';
import { broadcastMemoryEvent, subscribeToDynamicMemory } from '../utils/dynamicMemory';
import { PortfolioPart } from './Navbar';

export type DocumentCategory =
  | 'Christians Book'
  | 'Inspirational Book'
  | 'Technical Drawing'
  | '3D CAD Model'
  | 'Production Blueprint'
  | 'Whitepaper & Report'
  | 'BOM & Specification'
  | 'Calculation & Dataset';

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
  description: string;
  tags: string;
  previewUrl: string | null;
  fileSize: string;
  fileType: string;
}

export interface EngineeringDocumentHubProps {
  onNavigatePart?: (part: PortfolioPart) => void;
}

export const CATEGORIES_LIST: DocumentCategory[] = [
  'Christians Book',
  'Inspirational Book',
  'Technical Drawing',
  '3D CAD Model',
  'Production Blueprint',
  'Whitepaper & Report',
  'BOM & Specification',
  'Calculation & Dataset'
];

/**
 * Smart Category Auto-Detection based on filename and extension
 */
export function autoDetectCategory(fileName: string): DocumentCategory {
  const lowerName = fileName.toLowerCase();
  const ext = lowerName.split('.').pop() || '';

  if (
    lowerName.includes('christian') ||
    lowerName.includes('bible') ||
    lowerName.includes('gospel') ||
    lowerName.includes('devotion') ||
    lowerName.includes('prayer') ||
    lowerName.includes('faith') ||
    lowerName.includes('jesus') ||
    lowerName.includes('christ') ||
    lowerName.includes('pastor') ||
    lowerName.includes('sermon') ||
    lowerName.includes('grace') ||
    lowerName.includes('church')
  ) {
    return 'Christians Book';
  }

  if (
    lowerName.includes('carnegie') ||
    lowerName.includes('influence') ||
    lowerName.includes('inspirational') ||
    lowerName.includes('inspire') ||
    lowerName.includes('motivation') ||
    lowerName.includes('habit') ||
    lowerName.includes('mindset') ||
    lowerName.includes('success') ||
    lowerName.includes('leadership') ||
    lowerName.includes('growth') ||
    lowerName.includes('psychology') ||
    lowerName.includes('atomic') ||
    lowerName.includes('think and grow') ||
    lowerName.includes('ife')
  ) {
    return 'Inspirational Book';
  }

  if (['step', 'stp', 'iges', 'igs', 'sldprt', 'sldasm', 'stl', 'obj', 'fbx', 'ipt', 'iam', 'x_t', 'sat', '3dm'].includes(ext)) {
    return '3D CAD Model';
  }

  if (['dwg', 'dxf'].includes(ext)) {
    return 'Production Blueprint';
  }

  if (['xlsx', 'xls', 'csv', 'tsv', 'mat', 'h5', 'dat'].includes(ext) || lowerName.includes('calc') || lowerName.includes('dataset') || lowerName.includes('fea')) {
    return 'Calculation & Dataset';
  }

  if (lowerName.includes('bom') || lowerName.includes('bill of materials') || lowerName.includes('spec') || lowerName.includes('partlist')) {
    return 'BOM & Specification';
  }

  if (['docx', 'doc', 'pptx', 'ppt', 'txt', 'md'].includes(ext) || lowerName.includes('paper') || lowerName.includes('report') || lowerName.includes('whitepaper') || lowerName.includes('thesis')) {
    return 'Whitepaper & Report';
  }

  if (ext === 'pdf') {
    if (lowerName.includes('drawing') || lowerName.includes('cad') || lowerName.includes('gdt') || lowerName.includes('tolerance') || lowerName.includes('blueprint') || lowerName.includes('schematic') || lowerName.includes('laser') || lowerName.includes('cnc')) {
      return 'Technical Drawing';
    }
    if (lowerName.includes('book') || lowerName.includes('guide') || lowerName.includes('story')) {
      return 'Inspirational Book';
    }
    return 'Technical Drawing';
  }

  return 'Technical Drawing';
}

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

export const EngineeringDocumentHub: React.FC<EngineeringDocumentHubProps> = ({ onNavigatePart }) => {
  const { isOwner } = useProfileSync();
  const [documents, setDocuments] = useState<PublicEngineeringDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'downloads' | 'title' | 'size'>('newest');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewModalDoc, setPreviewModalDoc] = useState<PublicEngineeringDocument | null>(null);
  const [docToDelete, setDocToDelete] = useState<PublicEngineeringDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Upload Queue State (Supports single or multi-file uploads seamlessly)
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

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  // Load documents from Firestore & cache first, then sync with server
  const loadDocuments = useCallback(async () => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
      // 1. Load from IndexedDB / LocalStorage cache with tombstone check
      const cached = await loadHubDocumentsPersistently<PublicEngineeringDocument>();
      const deletedIds = getDeletedDocIds();
      const cleanCached = sortDocumentsDescending(
        cached.filter((d) => d && d.id && !deletedIds.has(d.id))
      );

      const docsMap = new Map<string, PublicEngineeringDocument>();

      // Seed with local cached documents
      cleanCached.forEach((d) => {
        if (d && d.id && !deletedIds.has(d.id)) {
          docsMap.set(d.id, d);
        }
      });

      // Show cached immediately so UI is instantly responsive
      if (cleanCached.length > 0) {
        setDocuments(cleanCached);
      }

      // 2. Fetch latest from Firestore database
      try {
        const firestoreDocs = await fetchHubDocumentsFromFirestore();
        if (Array.isArray(firestoreDocs) && firestoreDocs.length > 0) {
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

      // 3. Sync with server fallback (PostgreSQL Cloud SQL)
      try {
        const res = await fetch('/api/documents?all=true');
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

      // 4. Sync with Supabase "materials" table (public read for unauthenticated visitors)
      try {
        const supaMaterials = await fetchMaterialsFromSupabaseTable();
        if (Array.isArray(supaMaterials) && supaMaterials.length > 0) {
          const currentDeleted = getDeletedDocIds();
          supaMaterials.forEach((m: any) => {
            if (m && m.id && !currentDeleted.has(m.id)) {
              const existing = docsMap.get(m.id);
              docsMap.set(m.id, {
                id: m.id,
                title: m.title || existing?.title || 'Engineering Document',
                fileName: m.file_name || existing?.fileName || 'document.pdf',
                fileSize: m.file_size || existing?.fileSize || 'Standard',
                fileType: m.file_type || existing?.fileType || 'PDF',
                category: m.category || existing?.category || 'Technical Drawing',
                description: m.description || existing?.description || '',
                author: m.author || existing?.author || 'Festus, Olorunsogo Johnson (Owner)',
                uploaderName: m.author || existing?.uploaderName || 'Festus, Olorunsogo Johnson (Owner)',
                uploaderType: 'owner',
                status: 'approved',
                uploadDate: (m.created_at || '').split('T')[0] || new Date().toISOString().split('T')[0],
                downloadCount: m.download_count || 0,
                tags: m.tags || ['Engineering'],
                previewUrl: m.preview_url || existing?.previewUrl,
                downloadUrl: m.download_url || `/api/documents/files/${m.id}`,
                dataUrl: existing?.dataUrl,
                hasServerFile: true,
                isCustomUpload: true,
              });
            }
          });
        }
      } catch (supaErr) {
        console.warn('Supabase materials sync note:', supaErr);
      }

      const activeDeleted = getDeletedDocIds();
      const combined = Array.from(docsMap.values()).filter((d) => d && d.id && !activeDeleted.has(d.id));
      const sorted = sortDocumentsDescending(combined);
      setDocuments(sorted);
      saveHubDocumentsPersistently(sorted).catch(() => {});
    } catch (e) {
      console.warn('Storage sync note:', e);
    } finally {
      isSyncingRef.current = false;
    }
  }, [isOwner]);

  useEffect(() => {
    loadDocuments();

    // Attach Firestore real-time listener for instant synchronization across all visitors
    const unsubscribeFirestore = subscribeToHubDocuments(
      (firestoreDocs) => {
        if (Array.isArray(firestoreDocs)) {
          const currentDeleted = getDeletedDocIds();
          setDocuments((prev) => {
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
            saveHubDocumentsPersistently(merged).catch(() => {});
            return merged;
          });
        }
      },
      (err) => console.warn('Firestore documents subscription note:', err)
    );

    // Continuous 5-second background sync for document additions & deletions
    const pollTimer = setInterval(() => {
      loadDocuments();
    }, 5000);

    const handleUpdate = () => {
      loadDocuments();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadDocuments();
      }
    };

    const unsubMem = subscribeToDynamicMemory((ev) => {
      if (ev.category === 'documents') {
        loadDocuments();
      }
    });

    window.addEventListener('fesline_hub_docs_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('focus', handleUpdate);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubMem();
      unsubscribeFirestore();
      clearInterval(pollTimer);
      window.removeEventListener('fesline_hub_docs_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('focus', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadDocuments]);

  const saveDocumentsToStorage = (updatedDocs: PublicEngineeringDocument[]) => {
    const sorted = sortDocumentsDescending(updatedDocs);
    setDocuments(sorted);
    saveHubDocumentsPersistently(sorted).catch(() => {});
    window.dispatchEvent(new CustomEvent('fesline_hub_docs_updated'));
    broadcastMemoryEvent('documents', 'hub_docs_updated', { count: sorted.length });
  };

  /**
   * Process picked files (supports single or multi-file uploads of any type)
   */
  const handleFilesPicked = async (fileList: FileList | File[]) => {
    setUploadError(null);
    setUploadSuccessMsg(null);
    const filesArray = Array.from(fileList);
    if (filesArray.length === 0) return;

    const newQueueItems: QueuedUploadItem[] = [];

    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      const cleanTitle = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .trim();
      const capitalizedTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
      const detectedCat = autoDetectCategory(file.name);
      const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';

      let preview: string | null = null;

      // Generate preview safely for real images and PDFs only
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
          preview = await renderPdfFirstPageToImage(buffer, 800);
        } catch {
          preview = null;
        }
      } else {
        preview = null;
      }

      newQueueItems.push({
        id: `queue-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        file,
        title: capitalizedTitle,
        category: detectedCat,
        description: `Technical document "${file.name}" uploaded to precision engineering repository.`,
        tags: `${ext}, Engineering, ${detectedCat}`,
        previewUrl: preview,
        fileSize: formatBytes(file.size),
        fileType: ext
      });
    }

    setQueuedFiles((prev) => [...prev, ...newQueueItems]);
  };

  const handleOpenUploadModal = () => {
    setUploadError(null);
    setUploadSuccessMsg(null);
    setQueuedFiles([]);
    if (isOwner) {
      setUploaderName('Festus, Olorunsogo Johnson (Owner)');
    } else if (!uploaderName) {
      setUploaderName('Visitor Contributor');
    }
    setIsUploadModalOpen(true);
  };

  const handleRemoveQueueItem = (id: string) => {
    setQueuedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdateQueueItem = (id: string, updates: Partial<QueuedUploadItem>) => {
    setQueuedFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  /**
   * Publish all queued documents (uploads binary to server, saves metadata, updates state lightning fast)
   */
  const handlePublishAllQueued = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (queuedFiles.length === 0) {
      setUploadError('Please select at least one document or CAD file to upload.');
      return;
    }

    const effectiveUploader = uploaderName.trim() || (isOwner ? 'Festus, Olorunsogo Johnson (Owner)' : 'Visitor Contributor');

    setIsPublishing(true);
    setUploadError(null);
    setUploadSuccessMsg(null);

    const total = queuedFiles.length;
    setUploadProgress({ current: 0, total, percent: 15, currentFileName: 'Processing document binaries...' });

    try {
      // 1. Process all queued files with safe base64 encoding
      const newDocs: PublicEngineeringDocument[] = await Promise.all(
        queuedFiles.map(async (item, i) => {
          let fileDataUrl = '';
          try {
            fileDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (ev) => resolve((ev.target?.result as string) || '');
              reader.onerror = () => reject(new Error('Failed to read file binary'));
              reader.readAsDataURL(item.file);
            });
          } catch {
            fileDataUrl = '';
          }

          const tagList = item.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

          const docId = `doc-${Date.now()}-${i}`;
          const timestamp = Date.now() + i;

          // If authenticated as owner, upload to Supabase "materials" storage bucket permanently under auth.uid()
          let supaDownloadUrl = '';
          let supaStoragePath = '';
          if (isOwner) {
            try {
              const ownerUid = getAuthenticatedOwnerUid();
              const supaRes = await uploadMaterialToSupabaseBucket(item.file, item.file.name, ownerUid);
              if (supaRes) {
                supaDownloadUrl = supaRes.downloadUrl;
                supaStoragePath = supaRes.storagePath;
              }
            } catch (supaErr) {
              console.warn('Supabase materials upload note:', supaErr);
            }
          }

          const docObj: PublicEngineeringDocument = {
            id: docId,
            title: item.title.trim() || item.file.name,
            fileName: item.file.name,
            fileSize: item.fileSize,
            fileType: item.fileType,
            category: item.category,
            description: item.description.trim() || `Technical specification for ${item.file.name}`,
            author: effectiveUploader,
            uploaderName: effectiveUploader,
            uploaderType: isOwner ? 'owner' : 'visitor',
            status: 'approved',
            uploadDate: new Date().toISOString().split('T')[0],
            uploadTimestamp: timestamp,
            downloadCount: 0,
            tags: tagList.length > 0 ? tagList : ['Engineering', item.category],
            previewUrl: (item.previewUrl && !isMockDrawingPreview(item.previewUrl)) ? item.previewUrl : undefined,
            dataUrl: fileDataUrl,
            downloadUrl: supaDownloadUrl || `/api/documents/files/${docId}`,
            hasServerFile: true,
            isCustomUpload: true,
          };

          if (supaStoragePath) {
            (docObj as any).storagePath = supaStoragePath;
          }

          return docObj;
        })
      );

      // Save official materials to Supabase "materials" table if authenticated as owner
      if (isOwner) {
        const ownerUid = getAuthenticatedOwnerUid();
        newDocs.forEach((docItem) => {
          saveMaterialToSupabaseTable(docItem, ownerUid).catch(() => {});
        });
      }

      setUploadProgress({ current: 1, total, percent: 50, currentFileName: 'Saving to persistent cloud database...' });

      // 2. Immediate optimistic state update
      const updatedAll = sortDocumentsDescending([
        ...newDocs,
        ...documents.filter((d) => !newDocs.some((p) => p.id === d.id)),
      ]);

      setDocuments(updatedAll);
      saveDocumentsToStorage(updatedAll);

      // 3. Save to backend database
      try {
        const res = await fetch('/api/documents/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documents: newDocs }),
        });
        if (!res.ok) {
          console.warn('Backend batch response status:', res.status);
        }
      } catch (backendErr) {
        console.warn('Backend batch sync note:', backendErr);
      }

      setUploadProgress({ current: 2, total, percent: 80, currentFileName: 'Broadcasting to visitor channels...' });

      // 4. Concurrently sync sanitized metadata to Firestore
      await Promise.allSettled(
        newDocs.map(async (doc) => {
          try {
            await saveHubDocumentToFirestore(doc);
          } catch (fErr) {
            console.warn('Firestore doc sync note:', fErr);
          }
        })
      );

      // 5. Instant feedback & close modal
      setUploadProgress({ current: total, total, percent: 100, currentFileName: 'Upload complete!' });
      setIsPublishing(false);
      const count = newDocs.length;
      const msg =
        count === 1
          ? `"${newDocs[0]?.title}" uploaded successfully and available to all visitors!`
          : `All ${count} documents uploaded successfully and available to all visitors!`;

      showToast(msg, 'success');
      setQueuedFiles([]);
      setIsUploadModalOpen(false);
      setUploadSuccessMsg(null);
      setUploadProgress({ current: 0, total: 0, percent: 0, currentFileName: '' });
      window.dispatchEvent(new CustomEvent('fesline_hub_docs_updated'));
      broadcastMemoryEvent('documents', 'hub_docs_updated', { count: updatedAll.length });
    } catch (err: any) {
      console.warn('Publish note:', err);
      setIsPublishing(false);
      setUploadError('Failed to publish document. Please check the file and try again.');
      showToast('Upload encountered an issue. Please try again.', 'error');
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

    // 2. Trigger browser download directly from server stream or cloud URL
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

    // Procedural Fallback
    if (doc.fileName.endsWith('.pdf')) {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      pdf.setFillColor(15, 29, 54);
      pdf.rect(0, 0, 297, 210, 'F');
      pdf.setDrawColor(56, 189, 248);
      pdf.setLineWidth(1.2);
      pdf.rect(10, 10, 277, 190);

      pdf.setTextColor(56, 189, 248);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(16);
      pdf.text(doc.title.slice(0, 55), 15, 22);

      pdf.setFontSize(10);
      pdf.setFont('courier', 'normal');
      pdf.setTextColor(148, 163, 184);
      pdf.text(`FILE: ${doc.fileName} | CATEGORY: ${doc.category} | REVISION: REV B.2`, 15, 28);
      pdf.text(`STANDARDS COMPLIANCE: ASME Y14.5-2018 | AUTHOR: ${doc.author}`, 15, 34);

      pdf.save(doc.fileName);
      showToast(`Downloading "${doc.fileName}"...`, 'info');
    } else {
      const textContent = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('FESLINE PRECISION ENGINEERING CAD STEP EXPORT'),'2;1');\nFILE_NAME('${doc.fileName}','${new Date().toISOString()}',('${doc.author}'),('FESLINE AEROSPACE & ROBOTICS'),'AI Studio B-Rep Kernel 2026','SolidWorks 2026 / ASME Y14.5','');\nFILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));\nENDSEC;\nDATA;\n#1=APPLICATION_CONTEXT('configuration controlled 3d designs of mechanical parts and assemblies');\n#2=APPLICATION_PROTOCOL_DEFINITION('international standard','config_control_design',1994,#1);\n#3=MECHANICAL_CONTEXT('3D Mechanical Part',#1,'mechanical');\n#4=PRODUCT('${doc.fileName}','${doc.title}','Part Assembly',(#3));\n#5=PRODUCT_DEFINITION_FORMATION('Rev B.2','Release',#4);\nENDSEC;\nEND-ISO-10303-21;`;
      const blob = new Blob([textContent], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast(`Downloading "${doc.fileName}"...`, 'info');
    }
  };

  const handleDeleteDocument = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isOwner) {
      showToast('Only the repository owner has permission to delete documents.', 'error');
      return;
    }
    const targetDoc = documents.find((d) => d.id === id);
    const title = targetDoc?.title || 'Document';

    // 1. Immediately update state
    const updated = documents.filter((d) => d.id !== id);
    setDocuments(updated);

    // 2. Delete from Firestore and Firebase Storage
    deleteHubDocumentFromFirestore(id, (targetDoc as any)?.storagePath).catch((err) => {
      console.warn('Firestore delete error:', err);
    });

    // 2b. Delete from Supabase materials table and storage bucket
    deleteMaterialFromSupabaseTable(id).catch(() => {});
    if ((targetDoc as any)?.storagePath) {
      deleteMaterialFromSupabaseBucket((targetDoc as any).storagePath).catch(() => {});
    }

    // 3. Immediately delete from persistent cache
    deleteHubDocumentPersistently(id).catch(() => {});
    saveDocumentsToStorage(updated);

    // 4. Immediately close preview if open
    if (previewModalDoc?.id === id) {
      setPreviewModalDoc(null);
    }

    // 5. Send delete to backend
    fetch(`/api/documents/${id}`, { method: 'DELETE' }).catch((err) => {
      console.warn('Backend delete note:', err);
    });

    // 6. Notify user immediately
    showToast(`"${title}" deleted immediately.`, 'info');
  };

  const confirmDeleteDocument = async () => {
    if (!docToDelete || !isOwner) return;
    await handleDeleteDocument(docToDelete.id);
    setDocToDelete(null);
  };

  const approvedDocs = useMemo(() => documents, [documents]);

  const categories = ['All', ...CATEGORIES_LIST];

  const filteredDocs = useMemo(() => {
    let result = approvedDocs.filter((doc) => {
      const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
    <div className="w-full space-y-7 font-sans">
      {/* 1. HERO BANNER: ACCESSORIES & ENGINEERING PORTAL */}
      <div className="bg-white rounded-3xl border border-slate-300 p-5 sm:p-6 shadow-sm text-slate-800 relative overflow-hidden text-center">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center justify-center text-center gap-4 max-w-4xl mx-auto">
          <div className="space-y-2.5 w-full flex flex-col items-center justify-center text-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-50 border border-cyan-300 text-cyan-800 text-[9px] sm:text-[10px] font-mono font-bold tracking-wider uppercase">
                <FolderDown className="w-3 h-3 text-cyan-700" />
                <span>ACCESSORIES &amp; ARCHIVE</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenUploadModal}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-3 h-3" />
                  <span>Upload Documents</span>
                </button>
                {isOwner ? (
                  <span className="text-[8.5px] sm:text-[9px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 font-semibold">
                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Owner Mode</span>
                  </span>
                ) : (
                  <span className="text-[8.5px] sm:text-[9px] font-mono text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-300 flex items-center gap-1 font-semibold">
                    <User className="w-2.5 h-2.5 text-cyan-600" />
                    <span>Public Hub</span>
                  </span>
                )}
              </div>
            </div>

            <h1 className="text-[13.5px] sm:text-[15.5px] md:text-[17.5px] font-bold font-serif tracking-tight text-slate-900 text-center max-w-2xl mx-auto">
              Engineering Document Hub &amp; Technical Archive
            </h1>
            <p className="text-[9px] sm:text-[10.5px] text-slate-600 max-w-2xl mx-auto leading-relaxed text-center">
              Centralized repository for mechanical engineering blueprints, ASME Y14.5 GD&amp;T drawings, 3D CAD models (STEP/SLDPRT), inspirational literature, and calculation datasets. Upload new documents or download existing archives with 1-click.
            </p>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1.5 w-full">
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center">
                <span className="block text-[6.5px] sm:text-[7.5px] font-mono text-slate-500 uppercase tracking-wider text-center">TOTAL DOCUMENTS</span>
                <strong className="text-xs sm:text-sm font-bold text-slate-900 font-mono text-center">{approvedDocs.length}</strong>
              </div>
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center">
                <span className="block text-[6.5px] sm:text-[7.5px] font-mono text-slate-500 uppercase tracking-wider text-center">TOTAL DOWNLOADS</span>
                <strong className="text-xs sm:text-sm font-bold text-cyan-700 font-mono text-center">{totalDownloads.toLocaleString()}</strong>
              </div>
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center">
                <span className="block text-[6.5px] sm:text-[7.5px] font-mono text-slate-500 uppercase tracking-wider text-center">SUPPORTED FORMATS</span>
                <strong className="text-[7.8px] sm:text-[8.5px] font-bold text-slate-800 block truncate font-mono text-center max-w-full" title={supportedFormatsText}>
                  {supportedFormatsText}
                </strong>
              </div>
              <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-xs flex flex-col items-center justify-center text-center">
                <span className="block text-[6.5px] sm:text-[7.5px] font-mono text-slate-500 uppercase tracking-wider text-center">ACCESS LEVEL</span>
                <strong className="text-[7.8px] sm:text-[8.5px] font-bold text-emerald-700 flex items-center justify-center gap-1 font-mono text-center">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>Public 1-Click</span>
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SEARCH, CATEGORY FILTER & SORT CONTROLS */}
      <div className="bg-white p-3.5 sm:p-4.5 rounded-2xl border border-slate-300 shadow-sm space-y-3.5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, filename, CAD keyword, book author, or GD&T tag..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-[11.5px] sm:text-[12.5px] focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:bg-white transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 text-[10.5px] sm:text-[11px] text-slate-600 font-mono">
              <ArrowUpDown className="w-3 h-3 text-slate-400" />
              <span>Sort:</span>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-800 text-[10.5px] sm:text-[11.5px] font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-600 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="downloads">Most Downloaded</option>
              <option value="title">Alphabetical (A-Z)</option>
              <option value="size">Largest Size</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="space-y-2 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between text-[10.5px] sm:text-[11.5px] font-mono text-slate-500">
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <Filter className="w-3 h-3 text-cyan-700" />
              <span>Category Filter:</span>
            </span>
            <span className="text-[10px] sm:text-[10.5px] text-cyan-800 font-semibold">
              {selectedCategory === 'All' ? 'Showing All Categories' : selectedCategory} ({filteredDocs.length})
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-[10.5px] md:text-[11px] font-semibold text-center leading-snug flex items-center justify-center transition-all cursor-pointer select-none min-h-[36px] sm:min-h-[38px] ${
                    isSelected
                      ? 'bg-cyan-700 text-white shadow-sm ring-2 ring-cyan-600/30 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/90'
                  }`}
                >
                  <span className="break-words text-center leading-snug">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. DOCUMENTS DIRECTORY GRID */}
      <div className="space-y-4">
        {filteredDocs.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-slate-300 text-slate-700 space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 mx-auto">
              <FolderDown className="w-7 h-7 text-cyan-700" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 font-serif">
                {searchQuery ? `No documents found matching "${searchQuery}"` : 'No Documents In This Category Yet'}
              </h3>
              <p className="text-[9px] sm:text-[9.5px] text-slate-500 max-w-md mx-auto leading-relaxed">
                {searchQuery
                  ? 'Try adjusting your search terms or selecting "All" categories.'
                  : 'Upload technical drawings, Christian & inspirational books, 3D CAD models, or engineering blueprints.'}
              </p>
            </div>
            <button
              onClick={handleOpenUploadModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-[9.5px] sm:text-[10.5px] shadow-sm transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Document Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDocs.map((doc) => (
              <div
                key={doc.id}
                className="group bg-white rounded-2xl border border-slate-200/90 hover:border-cyan-500 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden relative"
              >
                {/* Card Top: Preview Thumbnail & Format Badge */}
                <div className="relative w-full h-44 bg-slate-50 overflow-hidden border-b border-slate-200">
                  {doc.previewUrl && !isMockDrawingPreview(doc.previewUrl) ? (
                    <img
                      src={doc.previewUrl}
                      alt={doc.title}
                      className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                      {doc.category === 'Christians Book' || doc.category === 'Inspirational Book' ? (
                        <BookOpen className="w-12 h-12 text-cyan-600/80" />
                      ) : (
                        <FileText className="w-12 h-12 text-cyan-600/70" />
                      )}
                      <span className="text-xs font-mono mt-1 text-slate-500">{doc.fileType}</span>
                    </div>
                  )}

                  {/* Format & Size Badge */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-md border border-cyan-300 text-cyan-800 text-[10px] font-mono font-bold shadow-xs">
                      {doc.fileType}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-md border border-slate-300 text-slate-700 text-[10px] font-mono font-semibold shadow-xs">
                      {doc.fileSize}
                    </span>
                  </div>

                  {/* Preview Button */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {doc.previewUrl && !isMockDrawingPreview(doc.previewUrl) && (
                      <button
                        onClick={() => setPreviewModalDoc(doc)}
                        className="p-1.5 rounded-lg bg-white/95 hover:bg-cyan-50 text-slate-600 hover:text-cyan-800 border border-slate-300 transition-colors shadow-xs cursor-pointer"
                        title="View Full Resolution Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Middle: Content & Metadata */}
                <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span className="text-cyan-700 font-semibold flex items-center gap-1">
                        {getCategoryIcon(doc.category)}
                        <span className="truncate max-w-[140px]">{doc.category}</span>
                      </span>
                      <span className="flex items-center gap-1 shrink-0">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{doc.uploadDate}</span>
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-cyan-800 transition-colors line-clamp-2 leading-snug">
                      {doc.title}
                    </h3>

                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                      {doc.description}
                    </p>
                  </div>

                  {/* Tags & Author */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-wrap items-center gap-1">
                      {doc.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-600"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                      <span className="truncate max-w-[170px]" title={doc.uploaderName || doc.author}>
                        By: <span className="text-slate-800 font-semibold">{doc.uploaderName || doc.author}</span>
                      </span>
                      <span className="text-cyan-700 font-bold flex items-center gap-1">
                        <FolderDown className="w-3 h-3 text-cyan-600" />
                        <span>{doc.downloadCount} downloads</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: 1-Click Download Button & Delete */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadDocument(doc)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-white" />
                    <span>Download {doc.fileName.split('.').pop()?.toUpperCase() || 'File'}</span>
                    <span className="text-[10px] opacity-80 font-mono">({doc.fileSize})</span>
                  </button>

                  {isOwner && (
                    <button
                      onClick={(e) => handleDeleteDocument(doc.id, e)}
                      className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs shrink-0"
                      title="Delete document (Owner only)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. MODAL: DEDICATED UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-white border border-slate-300 rounded-3xl p-5 sm:p-7 shadow-2xl text-slate-800 space-y-5 animate-fadeIn my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Upload Documents &amp; Files
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload single or multiple files irrespective of size or content
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isPublishing) {
                    setIsUploadModalOpen(false);
                    setQueuedFiles([]);
                  }
                }}
                disabled={isPublishing}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadSuccessMsg ? (
              <div className="p-8 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-center space-y-3">
                <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto animate-bounce" />
                <h4 className="text-lg sm:text-xl font-bold text-slate-900">Uploads Published Successfully!</h4>
                <p className="text-xs sm:text-sm max-w-md mx-auto text-emerald-900 leading-relaxed">
                  {uploadSuccessMsg}
                </p>
              </div>
            ) : (
              <form onSubmit={handlePublishAllQueued} className="space-y-4 flex-1 overflow-y-auto pr-1">
                {/* Uploader Name Bar */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Uploader / Author Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={uploaderName}
                    onChange={(e) => setUploaderName(e.target.value)}
                    placeholder={isOwner ? 'Festus, Olorunsogo Johnson (Owner)' : 'Enter your name or organization'}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 font-sans"
                  />
                </div>

                {/* Dropzone */}
                <div>
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
                      className="border-2 border-dashed border-slate-300 hover:border-cyan-600 bg-slate-50/70 hover:bg-cyan-50/30 rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-cyan-100/70 border border-cyan-300 flex items-center justify-center text-cyan-800 group-hover:scale-110 transition-transform shadow-xs">
                        <Upload className="w-6 h-6" />
                      </div>
                      <span className="text-sm font-bold text-slate-800 block">
                        Click to browse or drag &amp; drop files here
                      </span>
                      <span className="text-xs text-slate-500 block">
                        Select single or multiple files (PDF Books, STEP CAD, Drawings, Word, Excel, ZIP)
                      </span>
                      <span className="text-[10px] text-cyan-800 font-mono bg-cyan-50 px-2 py-0.5 rounded-full border border-cyan-200">
                        Direct publishing · Supports any number of uploads
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 font-mono uppercase tracking-wider flex items-center gap-1.5">
                          <ListPlus className="w-4 h-4 text-cyan-700" />
                          <span>Queued Files ({queuedFiles.length})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => addMoreInputRef.current?.click()}
                          className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add More Files</span>
                        </button>
                      </div>

                      {/* Itemized File Cards */}
                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                        {queuedFiles.map((item, idx) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-xs space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                  {item.previewUrl ? (
                                    <img src={item.previewUrl} alt="Preview" className="w-full h-full object-contain" />
                                  ) : (
                                    getCategoryIcon(item.category)
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-900">
                                      #{idx + 1}
                                    </span>
                                    <input
                                      type="text"
                                      value={item.title}
                                      onChange={(e) => handleUpdateQueueItem(item.id, { title: e.target.value })}
                                      className="font-bold text-xs sm:text-sm text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-cyan-600 focus:outline-none w-full"
                                      placeholder="Document title"
                                    />
                                  </div>
                                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                                    <span>{item.file.name}</span>
                                    <span>·</span>
                                    <span>{item.fileSize}</span>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveQueueItem(item.id)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="Remove file"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            {/* Category Selector & Tags */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                              <div>
                                <label className="block text-[10px] font-mono text-slate-500 uppercase">Category</label>
                                <select
                                  value={item.category}
                                  onChange={(e) =>
                                    handleUpdateQueueItem(item.id, { category: e.target.value as DocumentCategory })
                                  }
                                  className="w-full text-xs p-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-sans cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                >
                                  {CATEGORIES_LIST.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[10px] font-mono text-slate-500 uppercase">Tags</label>
                                <input
                                  type="text"
                                  value={item.tags}
                                  onChange={(e) => handleUpdateQueueItem(item.id, { tags: e.target.value })}
                                  placeholder="Comma separated tags"
                                  className="w-full text-xs p-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 font-sans focus:outline-none focus:ring-1 focus:ring-cyan-600"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {uploadError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Progress Bar */}
                {isPublishing && (
                  <div className="space-y-1.5 font-mono text-xs p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="flex justify-between text-cyan-800 font-semibold">
                      <span>
                        Uploading file {uploadProgress.current} of {uploadProgress.total} ({uploadProgress.currentFileName})...
                      </span>
                      <span>{uploadProgress.percent}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-600 to-sky-500 transition-all duration-300"
                        style={{ width: `${uploadProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    disabled={isPublishing}
                    onClick={() => {
                      setIsUploadModalOpen(false);
                      setQueuedFiles([]);
                    }}
                    className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPublishing || queuedFiles.length === 0}
                    className="px-6 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs sm:text-sm shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isPublishing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Publishing {queuedFiles.length} Documents...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>
                          Publish {queuedFiles.length > 0 ? `${queuedFiles.length} ` : ''}Document
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl bg-white border border-slate-300 rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-800 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-mono text-cyan-700 block font-semibold">{previewModalDoc.category}</span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate max-w-[600px]">
                  {previewModalDoc.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewModalDoc(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-slate-50 rounded-2xl border border-slate-200 p-2 flex items-center justify-center min-h-[360px]">
              {previewModalDoc.previewUrl ? (
                <img
                  src={previewModalDoc.previewUrl}
                  alt={previewModalDoc.title}
                  className="max-h-[60vh] max-w-full object-contain rounded-lg"
                />
              ) : (
                <div className="text-center p-8 space-y-2">
                  <FileText className="w-16 h-16 text-cyan-600 mx-auto opacity-70" />
                  <p className="text-sm font-mono text-slate-600">{previewModalDoc.fileName}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-600 font-mono">
                <span>File Size: <strong className="text-slate-900">{previewModalDoc.fileSize}</strong></span>
                <span className="mx-2">·</span>
                <span>Downloads: <strong className="text-cyan-700">{previewModalDoc.downloadCount}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && (
                  <button
                    onClick={() => {
                      const docId = previewModalDoc.id;
                      setPreviewModalDoc(null);
                      handleDeleteDocument(docId);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-300 font-semibold text-xs sm:text-sm cursor-pointer shadow-xs transition-all"
                    title="Delete this document immediately (Owner only)"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    handleDownloadDocument(previewModalDoc);
                    setPreviewModalDoc(null);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs sm:text-sm cursor-pointer shadow-xs transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download This Document</span>
                </button>
              </div>
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

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={confirmDeleteDocument}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 text-white" />
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
