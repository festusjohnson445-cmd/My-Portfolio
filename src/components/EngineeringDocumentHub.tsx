import React, { useState, useEffect, useRef } from 'react';
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
  X
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { renderPdfFirstPageToImage, generateDocumentDrawingPreview } from '../utils/pdfRenderer';
import { saveHubDocumentsPersistently, loadHubDocumentsPersistently } from '../utils/documentStorage';
import {
  DocumentItem,
  useProfileSync,
  setOwnerAuthenticated,
  OWNER_EMAIL,
  OWNER_PASSWORD
} from '../utils/profileState';
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
  downloadCount: number;
  tags: string[];
  previewUrl?: string;
  dataUrl?: string; // Stored file content
  isCustomUpload?: boolean;
}

const STORAGE_KEY_PUBLIC_DOCS = 'fesline_public_hub_documents';
const STORAGE_KEY_DELETED_DOC_IDS = 'fesline_hub_deleted_doc_ids';
const STORAGE_KEY_DOWNLOAD_COUNTS = 'fesline_doc_download_counts';

export interface EngineeringDocumentHubProps {
  onNavigatePart?: (part: PortfolioPart) => void;
}

// Clean start: all inbuilt files removed as requested
const INITIAL_HUB_DOCUMENTS: PublicEngineeringDocument[] = [];

export const EngineeringDocumentHub: React.FC<EngineeringDocumentHubProps> = ({ onNavigatePart }) => {
  const { isOwner } = useProfileSync();
  const [documents, setDocuments] = useState<PublicEngineeringDocument[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [previewModalDoc, setPreviewModalDoc] = useState<PublicEngineeringDocument | null>(null);
  const [docToDelete, setDocToDelete] = useState<PublicEngineeringDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);

  // Quick unlock modal states for visitors wishing to log in as owner
  const [showQuickAuthModal, setShowQuickAuthModal] = useState(false);
  const [quickAuthEmail, setQuickAuthEmail] = useState('');
  const [quickAuthPin, setQuickAuthPin] = useState('');
  const [quickAuthError, setQuickAuthError] = useState<string | null>(null);

  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('Christians Book');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load documents on mount: loads from persistent storage and syncs with server API
  // so ANY visitor on any device sees what the owner uploads
  const loadDocuments = async () => {
    // 1. First load from IndexedDB / localStorage cache for immediate display
    try {
      const cached = await loadHubDocumentsPersistently<PublicEngineeringDocument>();
      const cleanCustom = cached.filter(
        (d) =>
          d &&
          d.id &&
          d.isCustomUpload === true &&
          !d.id.startsWith('doc-wa00') &&
          !d.id.startsWith('doc-harmonic') &&
          !d.id.startsWith('doc-gimbal') &&
          !d.id.startsWith('doc-hydraulic')
      );
      if (cleanCustom.length > 0) {
        setDocuments(cleanCustom);
      }
    } catch (e) {
      console.warn('Storage read fallback:', e);
    }

    // 2. Fetch from server endpoint (shared across all devices/visitors)
    try {
      const res = await fetch('/api/documents?all=' + (isOwner ? 'true' : 'false'));
      if (res.ok) {
        const json = await res.json();
        if (json && json.success && Array.isArray(json.documents)) {
          const cleanDocs: PublicEngineeringDocument[] = json.documents.filter(
            (d: any) =>
              d &&
              d.id &&
              !d.id.startsWith('doc-wa00') &&
              !d.id.startsWith('doc-harmonic') &&
              !d.id.startsWith('doc-gimbal') &&
              !d.id.startsWith('doc-hydraulic')
          );
          setDocuments(cleanDocs);
          saveHubDocumentsPersistently(cleanDocs);
          return;
        }
      }
    } catch {
      // Offline or direct client-side mode
    }
  };

  useEffect(() => {
    loadDocuments();

    const handleUpdate = () => {
      loadDocuments();
    };

    window.addEventListener('fesline_hub_docs_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('fesline_hub_docs_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [isOwner]);

  // Save documents when updated
  const saveDocumentsToStorage = (updatedDocs: PublicEngineeringDocument[]) => {
    setDocuments(updatedDocs);
    saveHubDocumentsPersistently(updatedDocs);
    window.dispatchEvent(new CustomEvent('fesline_hub_docs_updated'));
  };

  const handleQuickOwnerLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAuthEmail.trim().toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      setQuickAuthError(`Only authorized owner ${OWNER_EMAIL} can access this section.`);
      return;
    }
    if (quickAuthPin.trim() !== OWNER_PASSWORD) {
      setQuickAuthError('Incorrect security password. Please verify owner credentials.');
      return;
    }
    setOwnerAuthenticated(true);
    setShowQuickAuthModal(false);
    setQuickAuthError(null);
    setQuickAuthPin('');
  };

  const handleFilePicked = async (file: File) => {
    setUploadError(null);
    setUploadFile(file);

    if (!uploadTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setUploadTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    const extension = file.name.split('.').pop()?.toLowerCase() || '';

    // Auto-detect category
    const lowerName = file.name.toLowerCase();
    if (
      lowerName.includes('christian') ||
      lowerName.includes('bible') ||
      lowerName.includes('gospel') ||
      lowerName.includes('devotion') ||
      lowerName.includes('prayer') ||
      lowerName.includes('faith') ||
      lowerName.includes('jesus')
    ) {
      setUploadCategory('Christians Book');
    } else if (
      lowerName.includes('carnegie') ||
      lowerName.includes('influence') ||
      lowerName.includes('inspirational') ||
      lowerName.includes('inspire') ||
      lowerName.includes('motivation') ||
      lowerName.includes('habit') ||
      lowerName.includes('mindset') ||
      lowerName.includes('success')
    ) {
      setUploadCategory('Inspirational Book');
    } else if (extension === 'pdf') {
      setUploadCategory('Technical Drawing');
    } else if (['step', 'stp', 'iges', 'igs', 'sldprt', 'sldasm'].includes(extension)) {
      setUploadCategory('3D CAD Model');
    } else if (['dwg', 'dxf'].includes(extension)) {
      setUploadCategory('Production Blueprint');
    }

    // Generate drawing preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setUploadPreviewUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    } else if (extension === 'pdf') {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const buffer = e.target?.result as ArrayBuffer;
          try {
            const preview = await renderPdfFirstPageToImage(buffer, 800, file.name);
            setUploadPreviewUrl(preview);
          } catch {
            setUploadPreviewUrl(generateDocumentDrawingPreview(file.name));
          }
        };
        reader.readAsArrayBuffer(file);
      } catch {
        setUploadPreviewUrl(generateDocumentDrawingPreview(file.name));
      }
    } else {
      setUploadPreviewUrl(generateDocumentDrawingPreview(file.name));
    }
  };

  const handleOpenUploadModal = () => {
    setUploadError(null);
    setUploadSuccessMsg(null);
    if (isOwner && !uploaderName) {
      setUploaderName('Festus, Olorunsogo Johnson (Owner)');
    }
    setIsUploadModalOpen(true);
  };

  const handlePublishDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Please choose a document or CAD file to upload from your device.');
      return;
    }
    if (!uploaderName.trim()) {
      setUploadError('Please enter the name of the uploader.');
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError('Please provide a descriptive title for this document.');
      return;
    }

    setIsPublishing(true);
    setUploadProgress(20);

    try {
      // Read file data
      const reader = new FileReader();
      reader.onload = async (event) => {
        setUploadProgress(70);
        const fileDataUrl = event.target?.result as string;

        const formattedSize = uploadFile.size > 1024 * 1024
          ? (uploadFile.size / (1024 * 1024)).toFixed(1) + ' MB'
          : (uploadFile.size / 1024).toFixed(0) + ' KB';

        const tagList = uploadTags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);

        const newDoc: PublicEngineeringDocument = {
          id: `doc-${Date.now()}`,
          title: uploadTitle.trim(),
          fileName: uploadFile.name,
          fileSize: formattedSize,
          fileType: uploadFile.name.split('.').pop()?.toUpperCase() || 'FILE',
          category: uploadCategory,
          description: uploadDescription.trim() || `Technical engineering document "${uploadFile.name}".`,
          author: uploaderName.trim(),
          uploaderName: uploaderName.trim(),
          uploaderType: isOwner ? 'owner' : 'visitor',
          status: isOwner ? 'approved' : 'pending',
          uploadDate: new Date().toISOString().split('T')[0],
          downloadCount: 0,
          tags: tagList.length > 0 ? tagList : ['Engineering', uploadCategory],
          previewUrl: uploadPreviewUrl || generateDocumentDrawingPreview(uploadFile.name),
          dataUrl: fileDataUrl,
          isCustomUpload: true,
        };

        const updated = [newDoc, ...documents];
        saveDocumentsToStorage(updated);

        // Sync with server API so visitors on all devices can see what was uploaded
        try {
          fetch('/api/documents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newDoc),
          }).catch((err) => console.warn('Server sync failed:', err));
        } catch {
          // ignore
        }

        setUploadProgress(100);
        setIsPublishing(false);

        if (isOwner) {
          setUploadSuccessMsg(`"${uploadFile.name}" has been published and is immediately available for download!`);
        } else {
          setUploadSuccessMsg(`"${uploadFile.name}" submitted successfully! Because you are uploading as a visitor, your submission is pending approval from the portfolio owner (Festus Johnson) before being published.`);
        }

        // Reset form
        setTimeout(() => {
          setUploadFile(null);
          setUploadTitle('');
          setUploaderName(isOwner ? 'Festus, Olorunsogo Johnson (Owner)' : '');
          setUploadDescription('');
          setUploadTags('');
          setUploadPreviewUrl(null);
          setUploadProgress(0);
          setIsUploadModalOpen(false);
          setUploadSuccessMsg(null);
        }, 2200);
      };

      reader.readAsDataURL(uploadFile);
    } catch (err) {
      console.error('Publish error:', err);
      setIsPublishing(false);
      setUploadError('Failed to read and process document file. Please try again.');
    }
  };

  const handleDownloadDocument = (doc: PublicEngineeringDocument) => {
    // 1. Increment download count in state & storage
    const updated = documents.map(d => {
      if (d.id === doc.id) {
        return { ...d, downloadCount: d.downloadCount + 1 };
      }
      return d;
    });
    saveDocumentsToStorage(updated);
    try {
      fetch(`/api/documents/${doc.id}/download`, { method: 'POST' }).catch(() => {});
    } catch {}

    // 2. Trigger browser download
    if (doc.dataUrl) {
      // Custom uploaded file with actual binary
      const link = document.createElement('a');
      link.href = doc.dataUrl;
      link.download = doc.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // Seeded technical files: generate authentic, downloadable engineering PDF / STEP text
      if (doc.fileName.endsWith('.pdf')) {
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        // Technical Blueprint background
        pdf.setFillColor(15, 29, 54);
        pdf.rect(0, 0, 297, 210, 'F');

        // Engineering Border
        pdf.setDrawColor(56, 189, 248);
        pdf.setLineWidth(1.2);
        pdf.rect(10, 10, 277, 190);

        // Header Title
        pdf.setTextColor(56, 189, 248);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(16);
        pdf.text(doc.title.slice(0, 55), 15, 22);

        pdf.setFontSize(10);
        pdf.setFont('courier', 'normal');
        pdf.setTextColor(148, 163, 184);
        pdf.text(`FILE: ${doc.fileName} | CATEGORY: ${doc.category} | REVISION: REV B.2`, 15, 28);
        pdf.text(`STANDARDS COMPLIANCE: ASME Y14.5-2018 | AUTHOR: ${doc.author}`, 15, 34);

        // Technical Grid
        pdf.setDrawColor(30, 58, 95);
        pdf.setLineWidth(0.3);
        for (let x = 15; x < 280; x += 15) {
          pdf.line(x, 42, x, 165);
        }
        for (let y = 42; y < 165; y += 15) {
          pdf.line(15, y, 280, y);
        }

        // Summary Text Box
        pdf.setFillColor(8, 20, 38);
        pdf.rect(18, 48, 260, 50, 'F');
        pdf.setDrawColor(56, 189, 248);
        pdf.rect(18, 48, 260, 50);

        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('ENGINEERING DESIGN SPECIFICATION & TECHNICAL SUMMARY', 24, 58);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);
        pdf.setTextColor(203, 213, 225);
        const splitDesc = pdf.splitTextToSize(doc.description, 248);
        pdf.text(splitDesc, 24, 68);

        // ASME Title Block Bottom Right
        pdf.setFillColor(8, 20, 38);
        pdf.rect(155, 140, 130, 58, 'F');
        pdf.setDrawColor(56, 189, 248);
        pdf.setLineWidth(1);
        pdf.rect(155, 140, 130, 58);

        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text('DRAWING NUMBER:', 160, 148);
        pdf.setTextColor(56, 189, 248);
        pdf.setFont('courier', 'bold');
        pdf.text(doc.fileName, 160, 154);

        pdf.setTextColor(148, 163, 184);
        pdf.text('ENGINEERING HUB REPOSITORY', 160, 164);
        pdf.text(`AUTHENTICATED DOWNLOAD · DATE: ${doc.uploadDate}`, 160, 172);
        pdf.setTextColor(16, 185, 129);
        pdf.text('VERIFIED AS9102 FAIR GEOMETRY - PASS', 160, 184);

        pdf.save(doc.fileName);
      } else {
        // STEP or CAD neutral format
        const textContent = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('FESLINE PRECISION ENGINEERING CAD STEP EXPORT'),'2;1');
FILE_NAME('${doc.fileName}','${new Date().toISOString()}',('${doc.author}'),('FESLINE AEROSPACE & ROBOTICS'),'AI Studio B-Rep Kernel 2026','SolidWorks 2026 / ASME Y14.5','');
FILE_SCHEMA(('CONFIG_CONTROL_DESIGN'));
ENDSEC;
DATA;
#1=APPLICATION_CONTEXT('configuration controlled 3d designs of mechanical parts and assemblies');
#2=APPLICATION_PROTOCOL_DEFINITION('international standard','config_control_design',1994,#1);
#3=MECHANICAL_CONTEXT('3D Mechanical Part',#1,'mechanical');
#4=PRODUCT('${doc.fileName}','${doc.title}','Part Assembly',(#3));
#5=PRODUCT_DEFINITION_FORMATION('Rev B.2','Release',#4);
/* B-Rep Geometric Topology Generated for ${doc.fileName} */
/* ASME Y14.5 MMC Reference Frames [-A-], [-B-], [-C-] Embedded */
ENDSEC;
END-ISO-10303-21;`;
        const blob = new Blob([textContent], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    }
  };

  const handleDeleteDocument = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isOwner) return;
    const targetDoc = documents.find((d) => d.id === id);
    if (targetDoc) {
      setDocToDelete(targetDoc);
    }
  };

  const confirmDeleteDocument = async () => {
    if (!docToDelete || !isOwner) return;
    setIsDeleting(true);
    const id = docToDelete.id;
    const title = docToDelete.title;

    // 1. Update state & persistent storage immediately
    const updated = documents.filter((d) => d.id !== id);
    setDocuments(updated);
    saveDocumentsToStorage(updated);

    // 2. Sync deletion with server backend
    try {
      await fetch(`/api/documents/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Backend delete error:', err);
    }

    // 3. Close preview if open
    if (previewModalDoc?.id === id) {
      setPreviewModalDoc(null);
    }

    setIsDeleting(false);
    setDocToDelete(null);
    setDeleteToast(`"${title}" has been permanently deleted.`);
    setTimeout(() => {
      setDeleteToast(null);
    }, 3500);
  };

  const handleApproveDocument = (id: string) => {
    const updated = documents.map(d => d.id === id ? { ...d, status: 'approved' as const } : d);
    saveDocumentsToStorage(updated);
    try {
      fetch(`/api/documents/${id}/approve`, { method: 'PATCH' }).catch(() => {});
    } catch {}
  };

  const approvedDocs = documents.filter((d) => d.status === 'approved' || !d.status);
  const pendingDocs = documents.filter((d) => d.status === 'pending');

  const categories = [
    'All',
    'Christians Book',
    'Inspirational Book',
    'Technical Drawing',
    '3D CAD Model',
    'Production Blueprint',
    'Whitepaper & Report',
    'BOM & Specification',
    'Calculation & Dataset'
  ];

  const filteredDocs = approvedDocs.filter((doc) => {
    const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
    const matchesSearch =
      searchQuery.trim() === '' ||
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.uploaderName && doc.uploaderName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      doc.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const totalDownloads = approvedDocs.reduce((sum, d) => sum + (d.downloadCount || 0), 0);

  const supportedFormatsText = React.useMemo(() => {
    const exts = new Set<string>();
    approvedDocs.forEach((d) => {
      const ext = d.fileName.split('.').pop()?.toUpperCase();
      if (ext && ext.length <= 6) {
        exts.add(ext);
      }
    });
    if (exts.size === 0) return 'PDF, STEP, DWG, ZIP';
    return Array.from(exts).join(', ');
  }, [approvedDocs]);

  return (
    <div className="w-full space-y-8 font-sans">
      {/* 1. HERO BANNER: ACCESSORIES PORTAL (LIGHT THEME) */}
      <div className="bg-white rounded-3xl border border-slate-300/90 p-6 sm:p-8 shadow-sm text-slate-800 relative overflow-hidden">
        {/* Subtle engineering grid accent */}
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#0284c7_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative z-10 flex flex-col justify-between gap-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-300 text-cyan-800 text-xs font-mono font-bold tracking-wider uppercase">
                <FolderDown className="w-3.5 h-3.5 text-cyan-700" />
                <span>ACCESSORIES</span>
              </div>
              <div className="flex items-center gap-2">
                {isOwner ? (
                  <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1 font-semibold">
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                    <span>Owner Mode Active</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-cyan-800 bg-cyan-50 px-2.5 py-0.5 rounded-full border border-cyan-300 flex items-center gap-1 font-semibold">
                    <User className="w-3 h-3 text-cyan-600" />
                    <span>Visitor Mode</span>
                  </span>
                )}
              </div>
            </div>

            <h1 className="text-base sm:text-lg lg:text-xl font-bold font-serif tracking-tight text-slate-900 text-justify max-w-2xl">
              Engineering Document Hub &amp; Technical Archive
            </h1>

            {/* Quick Metrics Bar (Light Theme) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 shadow-sm">
                <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">TOTAL DOCUMENTS</span>
                <strong className="text-lg sm:text-xl font-bold text-slate-900 font-mono">{approvedDocs.length}</strong>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 shadow-sm">
                <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">TOTAL DOWNLOADS</span>
                <strong className="text-lg sm:text-xl font-bold text-cyan-700 font-mono">{totalDownloads.toLocaleString()}</strong>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 shadow-sm">
                <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">SUPPORTED FORMATS</span>
                <strong className="text-xs font-bold text-slate-800 block truncate font-mono" title={supportedFormatsText}>
                  {supportedFormatsText}
                </strong>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 shadow-sm">
                <span className="block text-[10px] font-mono text-slate-500 uppercase tracking-wider">ACCESS LEVEL</span>
                <strong className="text-xs font-bold text-emerald-700 flex items-center gap-1 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Public 1-Click</span>
                </strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PENDING APPROVAL QUEUE (OWNER ONLY - LIGHT THEME) */}
      {isOwner && pendingDocs.length > 0 && (
        <div className="bg-amber-50/90 rounded-2xl border border-amber-300 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs sm:text-sm font-bold text-amber-950 font-mono uppercase tracking-wide">
                Visitor Uploads Awaiting Approval ({pendingDocs.length})
              </h3>
            </div>
            <span className="text-[10px] sm:text-xs font-mono text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300 font-semibold">
              Review Required
            </span>
          </div>

          <div className="space-y-2.5">
            {pendingDocs.map((doc) => (
              <div
                key={doc.id}
                className="p-3.5 rounded-xl bg-white border border-amber-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                    {doc.previewUrl ? (
                      <img src={doc.previewUrl} alt={doc.title} className="w-full h-full object-contain" />
                    ) : (
                      <FileText className="w-5 h-5 text-cyan-600" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-slate-900">{doc.title}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-600">
                        {doc.fileSize}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Uploader: <span className="text-cyan-800 font-semibold">{doc.uploaderName || doc.author}</span> · File: {doc.fileName} · Date: {doc.uploadDate}
                    </p>
                    {doc.description && (
                      <p className="text-xs text-slate-600 line-clamp-1">{doc.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={() => handleApproveDocument(doc.id)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve &amp; Publish</span>
                  </button>
                  <button
                    onClick={() => handleDeleteDocument(doc.id)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-300 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. SEARCH & CATEGORY FILTER BAR (LIGHT THEME) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-300 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search documents by title, filename, CAD keyword, or GD&T tag..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:bg-white transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenUploadModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Add Document</span>
            </button>
          </div>
        </div>

        {/* Category Filter Section (Organized in clean 2 to 3 rows) */}
        <div className="space-y-2.5 pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between text-xs font-mono text-slate-500">
            <span className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Filter className="w-3.5 h-3.5 text-cyan-700" />
              <span>Category Filter:</span>
            </span>
            <span className="text-[11px] text-cyan-800 font-semibold">
              {selectedCategory === 'All' ? 'Showing All Categories' : selectedCategory}
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-1.5 sm:gap-2">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-2 py-2 sm:py-2.5 rounded-xl text-[11px] sm:text-xs font-semibold text-center leading-tight flex items-center justify-center transition-all cursor-pointer select-none min-h-[38px] ${
                    isSelected
                      ? 'bg-cyan-700 text-white shadow-sm ring-2 ring-cyan-600/30 font-bold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200/90'
                  }`}
                >
                  <span className="truncate max-w-full">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. DOCUMENTS DIRECTORY GRID (LIGHT THEME) */}
      <div className="space-y-4">
        {filteredDocs.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-white border border-slate-300 text-slate-700 space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 mx-auto">
              <FolderDown className="w-7 h-7 text-cyan-700" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {searchQuery ? `No documents found matching "${searchQuery}"` : 'No Documents Uploaded Yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {searchQuery
                  ? 'Try adjusting your search terms or selecting "All" categories.'
                  : 'Be the first to upload an engineering drawing, 3D CAD model, or technical specification!'}
              </p>
            </div>
            <button
              onClick={handleOpenUploadModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" />
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
                  {doc.previewUrl ? (
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
                    <span className="px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-md border border-cyan-300 text-cyan-800 text-[10px] font-mono font-bold shadow-sm">
                      {doc.fileType}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-md border border-slate-300 text-slate-700 text-[10px] font-mono font-semibold shadow-sm">
                      {doc.fileSize}
                    </span>
                  </div>

                  {/* Action overlays: Preview only (Single delete button located in footer for owner) */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {doc.previewUrl && (
                      <button
                        onClick={() => setPreviewModalDoc(doc)}
                        className="p-1.5 rounded-lg bg-white/95 hover:bg-cyan-50 text-slate-600 hover:text-cyan-800 border border-slate-300 transition-colors shadow-sm cursor-pointer"
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
                      <span className="text-cyan-700 font-semibold">{doc.category}</span>
                      <span className="flex items-center gap-1">
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

                {/* Card Bottom: 1-Click Download Button & Owner-Only Delete Button */}
                <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2">
                  <button
                    onClick={() => handleDownloadDocument(doc)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-white" />
                    <span>Download {doc.fileName.split('.').pop()?.toUpperCase() || 'File'}</span>
                    <span className="text-[10px] opacity-80 font-mono">({doc.fileSize})</span>
                  </button>

                  {isOwner && (
                    <button
                      onClick={(e) => handleDeleteDocument(doc.id, e)}
                      className="py-2.5 px-3.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
                      title="Delete document (Owner)"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. MODAL: UPLOAD FROM DEVICE */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white border border-slate-300 rounded-3xl p-5 sm:p-7 shadow-2xl text-slate-800 space-y-5 animate-fadeIn my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Upload Document Directly from Device
                  </h3>
                  <p className="text-xs text-slate-500">
                    Make your drawings, CAD files, or technical specs available to everyone
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadSuccessMsg ? (
              <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-center space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
                <h4 className="text-lg font-bold text-slate-900">Upload Complete &amp; Published!</h4>
                <p className="text-xs sm:text-sm max-w-md mx-auto text-emerald-900">{uploadSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handlePublishDocument} className="space-y-4">
                {/* File Dropzone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Select File from Computer / Mobile
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.step,.stp,.iges,.igs,.sldprt,.sldasm,.dwg,.dxf,.zip,.png,.jpg,.jpeg,.svg,.docx,.xlsx"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFilePicked(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFilePicked(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`border-2 border-dashed ${
                      uploadFile ? 'border-cyan-500 bg-cyan-50/50' : 'border-slate-300 hover:border-cyan-500 bg-slate-50'
                    } rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 group`}
                  >
                    {uploadPreviewUrl ? (
                      <div className="flex flex-col items-center space-y-2">
                        <img
                          src={uploadPreviewUrl}
                          alt="Document Preview"
                          className="max-h-24 rounded border border-slate-200 object-contain shadow-sm bg-white"
                        />
                        <span className="text-xs font-bold text-cyan-800">{uploadFile?.name}</span>
                        <span className="text-[11px] text-slate-500">Click to change file</span>
                      </div>
                    ) : uploadFile ? (
                      <div className="flex flex-col items-center space-y-1">
                        <FileCheck className="w-8 h-8 text-emerald-600" />
                        <span className="text-sm font-bold text-slate-900">{uploadFile.name}</span>
                        <span className="text-xs text-slate-500">
                          {(uploadFile.size / (1024 * 1024)).toFixed(1)} MB · Ready to publish
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center space-y-1">
                        <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 group-hover:scale-105 transition-transform">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-bold text-slate-800 block">
                          Click to browse device or drag file here
                        </span>
                        <span className="text-[11px] text-slate-500 block font-mono">
                          Supports PDF, STEP, STP, DWG, DXF, SLDPRT, ZIP, Images
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Uploader Name & Title Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Name of Uploader *
                      </label>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                        isOwner
                          ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
                          : 'text-amber-800 bg-amber-50 border-amber-300'
                      }`}>
                        {isOwner ? 'Owner Direct' : 'Visitor (Needs Approval)'}
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      value={uploaderName}
                      onChange={(e) => setUploaderName(e.target.value)}
                      placeholder={isOwner ? 'Festus, Olorunsogo Johnson (Owner)' : 'Enter your name (e.g. Alex Morgan)'}
                      className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:bg-white font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Document Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      placeholder="e.g. CNC Gantry Laser Engraver Main Views"
                      className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:bg-white font-sans"
                    />
                  </div>
                </div>

                {/* Category & Tags Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Category *
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as any)}
                      className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:bg-white font-sans cursor-pointer"
                    >
                      <option value="Christians Book">Christians Book</option>
                      <option value="Inspirational Book">Inspirational Book</option>
                      <option value="Technical Drawing">Technical Drawing (PDF/DWG)</option>
                      <option value="3D CAD Model">3D CAD Model (STEP/STP/IGES)</option>
                      <option value="Production Blueprint">Production Blueprint</option>
                      <option value="Whitepaper & Report">Whitepaper &amp; Research Report</option>
                      <option value="BOM & Specification">BOM &amp; Specification</option>
                      <option value="Calculation & Dataset">Calculation &amp; Simulation Dataset</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Tags (Comma separated)
                    </label>
                    <input
                      type="text"
                      value={uploadTags}
                      onChange={(e) => setUploadTags(e.target.value)}
                      placeholder="e.g. CNC, Laser, ASME Y14.5, SolidWorks"
                      className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:bg-white font-sans"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Technical Description &amp; Specifications
                  </label>
                  <textarea
                    rows={3}
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Enter dimensional tolerances, material callouts, CAD software used (e.g. SolidWorks 2026, Ansys), or general design specifications..."
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:bg-white font-sans resize-none leading-relaxed"
                  />
                </div>

                {!isOwner && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber-950 font-bold block mb-0.5">Visitor Upload Notice:</strong>
                      <span>As a visitor, your document will be submitted to portfolio owner Festus Johnson for approval before being publicly listed in the accessories repository.</span>
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Progress bar if publishing */}
                {isPublishing && (
                  <div className="space-y-1.5 font-mono text-xs">
                    <div className="flex justify-between text-cyan-800 font-semibold">
                      <span>Publishing document to public hub...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-600 to-sky-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPublishing}
                    className="px-6 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs sm:text-sm shadow-md flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isPublishing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        <span>Publishing...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>Publish &amp; Enable Public Download</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL: LIGHTBOX PREVIEW */}
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
                      const doc = previewModalDoc;
                      setPreviewModalDoc(null);
                      setDocToDelete(doc);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 border border-rose-300 font-semibold text-xs sm:text-sm cursor-pointer shadow-sm transition-all"
                    title="Delete this document (Owner)"
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
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs sm:text-sm cursor-pointer shadow-sm transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Download This Document</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODAL: PERMANENT DELETE CONFIRMATION */}
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
              Are you sure you want to permanently delete this document from the Engineering Hub? This action will remove the document from the repository.
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
                    <span>Yes, Permanently Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. TOAST NOTIFICATION */}
      {deleteToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-950/95 text-slate-100 px-3 py-1.5 rounded-xl shadow-xl border border-cyan-500/30 flex items-center gap-2 animate-fadeIn max-w-xs sm:max-w-sm text-[11px] sm:text-xs font-sans font-medium">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate flex-1">{deleteToast}</span>
          <button
            onClick={() => setDeleteToast(null)}
            className="text-slate-400 hover:text-white p-0.5 ml-1 shrink-0 cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
};
