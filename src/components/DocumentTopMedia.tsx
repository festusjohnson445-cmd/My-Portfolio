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

  // 1. RENDER PDF CONTENT ON LIGHT-COLORED TOP (Full edge-to-edge fit, uniform card height, zero extra text)
  if (isPdf && (renderedPdfImage || doc.attachmentDataUrl)) {
    return (
      <div
        onClick={() => onOpenPreview(doc)}
        className="w-full h-52 sm:h-56 bg-[#f8fafc] border-b border-slate-200 p-2 relative overflow-hidden flex items-center justify-center cursor-pointer group/pdf select-none"
        title="Preview document"
      >
        {renderedPdfImage ? (
          <img
            src={renderedPdfImage}
            alt={doc.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain block rounded-md transition-transform duration-300 group-hover/pdf:scale-[1.01]"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-4 z-10 animate-fade-in">
            <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-cyan-800 mb-2 shadow-2xs">
              <FileCode className="w-6 h-6" />
            </div>
            {isRenderingPdf && (
              <span className="inline-flex items-center gap-1 text-[10px] text-cyan-800 font-mono bg-white px-2.5 py-0.5 rounded-full border border-cyan-200 shadow-2xs">
                <Loader2 className="w-2.5 h-2.5 text-cyan-700 animate-spin" />
                <span>Page 1</span>
              </span>
            )}
          </div>
        )}
      </div>
    );
  }

  // 2. RENDER IMAGE CONTENT ON LIGHT-COLORED TOP (Full fit inside uniform height frame)
  if (isImage && (doc.attachmentDataUrl || doc.previewImageDataUrl)) {
    const rawSrc = doc.previewImageDataUrl || doc.attachmentDataUrl;
    const imgSrc = rawSrc && !isMockDrawingPreview(rawSrc) ? rawSrc : null;
    if (imgSrc) {
      return (
        <div
          onClick={() => onOpenPreview(doc)}
          className="w-full h-52 sm:h-56 bg-[#f8fafc] border-b border-slate-200 p-2 relative overflow-hidden flex items-center justify-center cursor-pointer group/img select-none"
          title="Preview image"
        >
          <img
            src={imgSrc}
            alt={doc.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-contain block rounded-md transition-transform duration-300 group-hover/img:scale-[1.01]"
          />
        </div>
      );
    }
  }

  // 3. RENDER CAD / STEP / OTHER FILE ATTACHMENT ON LIGHT ARCHIVAL TOP
  if (doc.attachmentName) {
    return (
      <div
        onClick={() => onOpenPreview(doc)}
        className="w-full h-52 sm:h-56 bg-gradient-to-br from-[#f8fafc] via-[#eef4fa] to-[#e2ecf5] p-4 sm:p-5 border-b border-slate-200 flex flex-col justify-between text-slate-900 relative cursor-pointer"
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
    <div className="w-full h-52 sm:h-56 bg-gradient-to-br from-[#f8fafc] via-[#eff4fa] to-[#e4ecf5] p-4 sm:p-5 border-b border-slate-200 flex flex-col justify-between text-slate-900 relative">
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
