import React, { useState, useEffect, useRef } from 'react';
import { Eye, FileCode, Layers, Upload, Download, Lock, Check, Loader2 } from 'lucide-react';
import { DocumentItem } from '../utils/profileState';
import { renderPdfFirstPageToImage, generateDocumentDrawingPreview } from '../utils/pdfRenderer';

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
  const [renderedPdfImage, setRenderedPdfImage] = useState<string | null>(doc.previewImageDataUrl || null);
  const [isRenderingPdf, setIsRenderingPdf] = useState(false);
  const [renderError, setRenderError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPdf =
    Boolean(doc.fileType?.toLowerCase().includes('pdf')) ||
    Boolean(doc.attachmentDataUrl?.startsWith('data:application/pdf')) ||
    Boolean(doc.attachmentName && /\.pdf$/i.test(doc.attachmentName));

  const isImage =
    Boolean(doc.previewImageDataUrl && !isPdf) ||
    Boolean(doc.fileType?.toLowerCase().includes('image')) ||
    Boolean(doc.attachmentDataUrl?.startsWith('data:image/')) ||
    Boolean(doc.attachmentName && /\.(png|jpe?g|webp|svg|gif|bmp|heic|heif)$/i.test(doc.attachmentName));

  // If PDF has attachmentDataUrl but no previewImageDataUrl yet, render page 1 on the fly
  useEffect(() => {
    if (doc.previewImageDataUrl) {
      setRenderedPdfImage(doc.previewImageDataUrl);
      return;
    }

    if (isPdf && doc.attachmentDataUrl) {
      let isMounted = true;
      setIsRenderingPdf(true);
      setRenderError(false);

      const safetyTimer = setTimeout(() => {
        if (isMounted) {
          setIsRenderingPdf(false);
          setRenderedPdfImage(generateDocumentDrawingPreview(doc.attachmentName || doc.title));
        }
      }, 3600);

      renderPdfFirstPageToImage(doc.attachmentDataUrl, 900, doc.attachmentName || doc.title)
        .then((imgDataUrl) => {
          clearTimeout(safetyTimer);
          if (isMounted) {
            setRenderedPdfImage(imgDataUrl);
            setIsRenderingPdf(false);
            if (onUpdatePreviewUrl) {
              onUpdatePreviewUrl(doc.id, imgDataUrl);
            }
          }
        })
        .catch((err) => {
          clearTimeout(safetyTimer);
          console.warn('PDF on-the-fly rendering warning:', err);
          if (isMounted) {
            setIsRenderingPdf(false);
            setRenderError(true);
            setRenderedPdfImage(generateDocumentDrawingPreview(doc.attachmentName || doc.title));
          }
        });

      return () => {
        isMounted = false;
        clearTimeout(safetyTimer);
      };
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

  // 1. RENDER PDF CONTENT ON DARK COLORED TOP
  if (isPdf && (renderedPdfImage || doc.attachmentDataUrl)) {
    return (
      <div
        onClick={() => onOpenPreview(doc)}
        className="w-full h-56 sm:h-64 bg-slate-950 border-b border-slate-700/80 relative overflow-hidden flex items-center justify-center cursor-pointer group/pdf select-none"
        title="Click to view full PDF document"
      >
        {/* Subtle grid pattern background for dark engineering feel */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        {isRenderingPdf && !renderedPdfImage ? (
          <div className="flex flex-col items-center justify-center text-slate-300 gap-2 p-4 z-10">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <span className="text-xs font-mono font-medium">Loading PDF document content...</span>
          </div>
        ) : renderedPdfImage ? (
          /* Rendered First Page of PDF */
          <div className="relative w-full h-full p-3 sm:p-4 flex items-center justify-center z-10">
            <div className="relative max-h-full max-w-full rounded-sm shadow-2xl overflow-hidden border border-slate-700/60 bg-white transition-transform duration-300 group-hover/pdf:scale-[1.02]">
              <img
                src={renderedPdfImage}
                alt={doc.title}
                className="max-h-50 sm:max-h-56 w-auto object-contain block"
              />
            </div>
          </div>
        ) : (
          /* Fallback if PDF data is present but rendering failed */
          <div className="flex flex-col items-center justify-center text-center p-4 z-10">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-400/40 flex items-center justify-center text-rose-400 mb-2">
              <FileCode className="w-6 h-6" />
            </div>
            <p className="font-bold text-xs text-white max-w-[240px] truncate">{doc.attachmentName || doc.title}</p>
            <span className="text-[11px] text-slate-400 font-mono mt-0.5">PDF Document Content Attached</span>
          </div>
        )}

        {/* Top Floating Badge */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 pointer-events-none">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-600/90 text-white shadow-xs tracking-wider flex items-center gap-1">
            <FileCode className="w-3 h-3" />
            PDF
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-900/80 border border-slate-700 text-slate-300 backdrop-blur-xs">
            {doc.category}
          </span>
        </div>

        {/* Bottom Expand Overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent p-2.5 flex items-center justify-between text-white z-20 pointer-events-none">
          <span className="text-[11px] font-sans font-medium text-slate-300 truncate max-w-[180px] sm:max-w-[240px]">
            {doc.attachmentName || doc.title}
          </span>
          <span className="text-[11px] font-sans font-semibold text-cyan-300 flex items-center gap-1 group-hover/pdf:text-cyan-200 transition-colors shrink-0">
            <Eye className="w-3.5 h-3.5" />
            <span>Click to Expand</span>
          </span>
        </div>
      </div>
    );
  }

  // 2. RENDER IMAGE CONTENT ON DARK COLORED TOP
  if (isImage && (doc.attachmentDataUrl || doc.previewImageDataUrl)) {
    const imgSrc = doc.previewImageDataUrl || doc.attachmentDataUrl;
    return (
      <div
        onClick={() => onOpenPreview(doc)}
        className="w-full h-56 sm:h-64 bg-slate-950 border-b border-slate-700/80 relative overflow-hidden flex items-center justify-center cursor-pointer group/img select-none"
        title="Click to zoom / view full document image"
      >
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

        <div className="relative w-full h-full p-2.5 sm:p-3 flex items-center justify-center z-10">
          <img
            src={imgSrc}
            alt={doc.title}
            className="max-h-52 sm:max-h-60 max-w-full object-contain rounded shadow-lg transition-transform duration-300 group-hover/img:scale-[1.02]"
          />
        </div>

        {/* Top Floating Badge */}
        <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 pointer-events-none">
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-700/90 text-white shadow-xs tracking-wider">
            IMAGE / SCAN
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-900/80 border border-slate-700 text-slate-300 backdrop-blur-xs">
            {doc.category}
          </span>
        </div>

        {/* Bottom Expand Overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/60 to-transparent p-2.5 flex items-center justify-between text-white z-20 pointer-events-none">
          <span className="text-[11px] font-sans font-medium text-slate-300 truncate max-w-[180px] sm:max-w-[240px]">
            {doc.attachmentName || doc.title}
          </span>
          <span className="text-[11px] font-sans font-semibold text-cyan-300 flex items-center gap-1 group-hover/img:text-cyan-200 transition-colors shrink-0">
            <Eye className="w-3.5 h-3.5" />
            <span>Click to View Full</span>
          </span>
        </div>
      </div>
    );
  }

  // 3. RENDER CAD / STEP / OTHER FILE ATTACHMENT
  if (doc.attachmentName) {
    return (
      <div className="w-full h-52 sm:h-56 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-5 border-b border-slate-700/80 flex flex-col justify-between text-white relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <FileCode className="w-6 h-6 text-cyan-300" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-300 font-bold block">
                {doc.category} Attachment
              </span>
              <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[200px] sm:max-w-[260px]">
                {doc.attachmentName}
              </p>
            </div>
          </div>
          {doc.attachmentSize && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
              {doc.attachmentSize}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/10 font-sans">
          <span className="text-[11px] text-slate-300 font-mono">CAD / Data File</span>
          {isOwnerAuthenticated ? (
            <button
              type="button"
              onClick={() => onDownloadAttachment(doc)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download File</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-sans font-medium">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verified Technical Record</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  // 4. FALLBACK / NO FILE YET: DARK COLORED TOP BANNER WITH DIRECT UPLOAD OPTION
  return (
    <div className="w-full h-50 sm:h-56 bg-gradient-to-br from-[#0a0f1d] via-[#0f172a] to-[#1e293b] p-5 border-b border-slate-700/80 flex flex-col justify-between text-white relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,.pdf,.step,.stp,.iges,.zip"
        className="hidden"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <span className="text-[10px] font-mono tracking-wider text-cyan-400 uppercase font-bold block">
              {doc.category}
            </span>
            <h4 className="text-sm sm:text-base font-bold text-white font-serif">{doc.title}</h4>
          </div>
        </div>

        {/* Attach File Button right on the dark top */}
        {onDirectAttachFile && (
          <button
            type="button"
            onClick={handleUploadClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-700/80 hover:bg-cyan-600 text-white text-[11px] font-semibold border border-cyan-500/40 shadow-xs transition-colors cursor-pointer shrink-0"
            title="Upload PDF or Image file for this document"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono pt-3 border-t border-slate-800">
        <span>{doc.issuer}</span>
        <span>{doc.date}</span>
      </div>
    </div>
  );
};
