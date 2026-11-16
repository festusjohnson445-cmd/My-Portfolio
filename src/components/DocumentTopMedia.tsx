import React, { useState, useEffect, useRef } from 'react';
import { Eye, FileCode, Layers, Upload, Download, Check, Loader2, BookOpen, FileText } from 'lucide-react';
import { DocumentItem } from '../utils/profileState';
import { renderPdfFirstPageToImage, isMockDrawingPreview } from '../utils/pdfRenderer';

const PROFILE_THUMB_CACHE_PREFIX = 'fesline_profile_thumb_v2_';
const profileInMemoryThumbCache = new Map<string, string>();

function getProfileCachedThumb(docId: string): string | null {
  if (profileInMemoryThumbCache.has(docId)) return profileInMemoryThumbCache.get(docId)!;
  if (typeof window !== 'undefined') {
    try {
      const c = localStorage.getItem(`${PROFILE_THUMB_CACHE_PREFIX}${docId}`);
      if (c && !isMockDrawingPreview(c)) {
        profileInMemoryThumbCache.set(docId, c);
        return c;
      }
    } catch {}
  }
  return null;
}

function setProfileCachedThumb(docId: string, url: string): void {
  profileInMemoryThumbCache.set(docId, url);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${PROFILE_THUMB_CACHE_PREFIX}${docId}`, url);
    } catch {}
  }
}

interface DocumentTopMediaProps {
  doc: DocumentItem;
  isOwnerAuthenticated: boolean;
  onOpenPreview: (doc: DocumentItem) => void;
  onDownloadAttachment: (doc: DocumentItem) => void;
  onRequireAuth: () => void;
  onUpdatePreviewUrl?: (docId: string, previewUrl: string) => void;
  onDirectAttachFile?: (docId: string, file: File) => void;
}

export const DocumentTopMedia: React.FC<DocumentTopMediaProps> = ({
  doc,
  isOwnerAuthenticated,
  onOpenPreview,
  onDownloadAttachment,
  onRequireAuth,
  onUpdatePreviewUrl,
  onDirectAttachFile,
}) => {
  const initialPreview =
    (doc.previewImageDataUrl && !isMockDrawingPreview(doc.previewImageDataUrl) ? doc.previewImageDataUrl : null) ||
    getProfileCachedThumb(doc.id);
  const [renderedPdfImage, setRenderedPdfImage] = useState<string | null>(initialPreview);
  const [isRenderingPdf, setIsRenderingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPdf =
    Boolean(doc.fileType?.toLowerCase().includes('pdf')) ||
    Boolean(doc.attachmentDataUrl?.startsWith('data:application/pdf')) ||
    Boolean(doc.attachmentName && /\.pdf$/i.test(doc.attachmentName));

  const isImage =
    Boolean(doc.previewImageDataUrl && !isPdf && !isMockDrawingPreview(doc.previewImageDataUrl)) ||
    Boolean(doc.fileType?.toLowerCase().includes('image')) ||
    Boolean(doc.attachmentDataUrl?.startsWith('data:image/')) ||
    Boolean(doc.attachmentName && /\.(png|jpe?g|webp|svg|gif|bmp|heic|heif)$/i.test(doc.attachmentName));

  // If PDF has attachmentDataUrl but no previewImageDataUrl yet, render page 1 quickly and cache
  useEffect(() => {
    if (doc.previewImageDataUrl && !isMockDrawingPreview(doc.previewImageDataUrl)) {
      setRenderedPdfImage(doc.previewImageDataUrl);
      setProfileCachedThumb(doc.id, doc.previewImageDataUrl);
      return;
    }

    const cached = getProfileCachedThumb(doc.id);
    if (cached) {
      setRenderedPdfImage(cached);
      return;
    }

    if (isPdf && doc.attachmentDataUrl) {
      let isMounted = true;
      setIsRenderingPdf(true);

      renderPdfFirstPageToImage(doc.attachmentDataUrl, 600)
        .then((imgDataUrl) => {
          if (isMounted) {
            if (imgDataUrl) {
              setRenderedPdfImage(imgDataUrl);
              setProfileCachedThumb(doc.id, imgDataUrl);
              if (onUpdatePreviewUrl) {
                onUpdatePreviewUrl(doc.id, imgDataUrl);
              }
            } else {
              setRenderedPdfImage(null);
            }
            setIsRenderingPdf(false);
          }
        })
        .catch((err) => {
          console.warn('PDF rendering note:', err);
          if (isMounted) {
            setIsRenderingPdf(false);
            setRenderedPdfImage(null);
          }
        });

      return () => {
        isMounted = false;
      };
    } else {
      setRenderedPdfImage(null);
      setIsRenderingPdf(false);
    }
  }, [doc.id, doc.attachmentDataUrl, doc.previewImageDataUrl, isPdf, onUpdatePreviewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onDirectAttachFile) {
      onDirectAttachFile(doc.id, file);
    }
    e.target.value = '';
  };

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isOwnerAuthenticated) {
      onRequireAuth();
      return;
    }
    fileInputRef.current?.click();
  };

  // 1. RENDER PDF CONTENT ON LIGHT-COLORED ARCHIVAL TOP (Real first-page PDF render or clean instant PDF card)
  if (isPdf && (renderedPdfImage || doc.attachmentDataUrl)) {
    return (
      <div
        onClick={() => onOpenPreview(doc)}
        className="w-full h-56 sm:h-64 bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e4ecf5] border-b border-slate-200 relative overflow-hidden flex items-center justify-center cursor-pointer group/pdf select-none"
        title="Click to view full PDF document preview"
      >
        <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-60 pointer-events-none" />

        {renderedPdfImage ? (
          /* Rendered First Page of PDF */
          <div className="relative w-full h-full p-3 sm:p-4 flex items-center justify-center z-10 animate-fade-in">
            <div className="relative max-h-full max-w-full rounded-sm shadow-md overflow-hidden border border-slate-300/90 bg-white transition-transform duration-300 group-hover/pdf:scale-[1.02]">
              <img
                src={renderedPdfImage}
                alt={doc.title}
                loading="lazy"
                decoding="async"
                className="max-h-50 sm:max-h-56 w-auto object-contain block"
              />
            </div>
          </div>
        ) : (
          /* Clean Light Instant PDF Header without blocking blank spinner */
          <div className="flex flex-col items-center justify-center text-center p-4 z-10 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 mb-2.5 shadow-2xs">
              <FileCode className="w-7 h-7" />
            </div>
            <p className="font-bold text-xs sm:text-sm text-slate-900 max-w-[240px] truncate">{doc.attachmentName || doc.title}</p>
            <span className="text-[11px] text-slate-600 font-mono mt-0.5">PDF Document Attached · Click to Preview</span>
            {isRenderingPdf && (
              <span className="inline-flex items-center gap-1 text-[10px] text-cyan-800 font-mono mt-2 bg-white px-2.5 py-0.5 rounded-full border border-cyan-200 shadow-2xs">
                <Loader2 className="w-2.5 h-2.5 text-cyan-700 animate-spin" />
                <span>Loading preview...</span>
              </span>
            )}
          </div>
        )}

        {/* Top Floating Badge */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 pointer-events-none">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-600 text-white shadow-2xs tracking-wider flex items-center gap-1">
            <FileCode className="w-3 h-3" />
            PDF
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-white/95 border border-slate-300 text-slate-700 shadow-2xs">
            {doc.category}
          </span>
        </div>

        {/* Bottom Expand Overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/95 via-white/90 to-transparent px-3 py-2 border-t border-slate-200/70 flex items-center justify-between text-slate-800 z-20 pointer-events-none">
          <span className="text-[11px] font-sans font-medium text-slate-700 truncate max-w-[180px] sm:max-w-[240px]">
            {doc.attachmentName || doc.title}
          </span>
          <span className="text-[11px] font-sans font-semibold text-cyan-800 flex items-center gap-1 group-hover/pdf:text-cyan-950 transition-colors shrink-0">
            <Eye className="w-3.5 h-3.5" />
            <span>Click to View Full</span>
          </span>
        </div>
      </div>
    );
  }

  // 2. RENDER IMAGE CONTENT ON LIGHT-COLORED ARCHIVAL TOP
  if (isImage && (doc.attachmentDataUrl || doc.previewImageDataUrl)) {
    const rawSrc = doc.previewImageDataUrl || doc.attachmentDataUrl;
    const imgSrc = rawSrc && !isMockDrawingPreview(rawSrc) ? rawSrc : null;
    if (imgSrc) {
      return (
        <div
          onClick={() => onOpenPreview(doc)}
          className="w-full h-56 sm:h-64 bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e4ecf5] border-b border-slate-200 relative overflow-hidden flex items-center justify-center cursor-pointer group/img select-none"
          title="Click to zoom / view full document image"
        >
          <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-60 pointer-events-none" />

          <div className="relative w-full h-full p-2.5 sm:p-3 flex items-center justify-center z-10">
            <div className="relative max-h-full max-w-full rounded bg-white p-1 border border-slate-300/80 shadow-sm transition-transform duration-300 group-hover/img:scale-[1.02]">
              <img
                src={imgSrc}
                alt={doc.title}
                loading="lazy"
                decoding="async"
                className="max-h-48 sm:max-h-56 max-w-full object-contain rounded-xs block"
              />
            </div>
          </div>

          {/* Top Floating Badge */}
          <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 pointer-events-none">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-800 text-white shadow-2xs tracking-wider">
              IMAGE / SCAN
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-white/95 border border-slate-300 text-slate-700 shadow-2xs">
              {doc.category}
            </span>
          </div>

          {/* Bottom Expand Overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/95 via-white/90 to-transparent px-3 py-2 border-t border-slate-200/70 flex items-center justify-between text-slate-800 z-20 pointer-events-none">
            <span className="text-[11px] font-sans font-medium text-slate-700 truncate max-w-[180px] sm:max-w-[240px]">
              {doc.attachmentName || doc.title}
            </span>
            <span className="text-[11px] font-sans font-semibold text-cyan-800 flex items-center gap-1 group-hover/img:text-cyan-950 transition-colors shrink-0">
              <Eye className="w-3.5 h-3.5" />
              <span>Click to View Full</span>
            </span>
          </div>
        </div>
      );
    }
  }

  // 3. RENDER CAD / STEP / OTHER FILE ATTACHMENT ON LIGHT ARCHIVAL TOP
  if (doc.attachmentName) {
    return (
      <div
        onClick={() => onOpenPreview(doc)}
        className="w-full h-52 sm:h-56 bg-gradient-to-br from-[#f8fafc] via-[#eef4fa] to-[#e2ecf5] p-5 border-b border-slate-200 flex flex-col justify-between text-slate-900 relative cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-white border border-cyan-200 shadow-2xs flex items-center justify-center shrink-0">
              <FileCode className="w-6 h-6 text-cyan-800" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-800 font-bold block">
                {doc.category} Attachment
              </span>
              <p className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-[260px]">
                {doc.attachmentName}
              </p>
            </div>
          </div>
          {doc.attachmentSize && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-slate-300 text-slate-700 shrink-0 shadow-2xs">
              {doc.attachmentSize}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-200 font-sans">
          <span className="text-[11px] text-slate-600 font-mono">Document Record</span>
          {isOwnerAuthenticated ? (
            doc.attachmentDataUrl ? (
              <a
                href={doc.attachmentDataUrl}
                download={doc.attachmentName || doc.title}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Download attachment file (Owner Only)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadAttachment(doc);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-700 text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Download attachment file (Owner Only)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download File</span>
              </button>
            )
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-sans font-semibold">
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              <span>Verified Document</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  // 4. FALLBACK / NO FILE YET: LIGHT-COLORED TOP BANNER WITH OWNER-ONLY UPLOAD OPTION
  return (
    <div className="w-full h-50 sm:h-56 bg-gradient-to-br from-[#f8fafc] via-[#eff4fa] to-[#e4ecf5] p-5 border-b border-slate-200 flex flex-col justify-between text-slate-900 relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,.pdf,.step,.stp,.iges,.zip"
        className="hidden"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
            {(doc.category as string) === 'Christians Book' || (doc.category as string) === 'Inspirational Book' ? (
              <BookOpen className="w-5 h-5 text-amber-600" />
            ) : (
              <Layers className="w-5 h-5 text-cyan-800" />
            )}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-mono tracking-wider text-cyan-800 uppercase font-bold block">
              {doc.category}
            </span>
            <h4 className="text-sm sm:text-base font-bold text-slate-900 font-serif truncate">{doc.title}</h4>
          </div>
        </div>

        {/* Attach File Button right on top (Owner only) */}
        {onDirectAttachFile && isOwnerAuthenticated && (
          <button
            type="button"
            onClick={handleUploadClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-700 text-white text-[11px] font-semibold border border-cyan-700 shadow-2xs transition-colors cursor-pointer shrink-0"
            title="Upload PDF or Image file for this document"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-600 font-mono pt-3 border-t border-slate-200">
        <span className="truncate">{doc.issuer}</span>
        <span className="shrink-0">{doc.date}</span>
      </div>
    </div>
  );
};
