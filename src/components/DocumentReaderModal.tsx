import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import type { User } from '@supabase/supabase-js';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  BookOpen,
  Rows3,
  Bookmark,
  Highlighter,
  MessageSquarePlus,
  StickyNote,
  Trash2,
  User as UserIcon,
  UserCheck,
  Loader2,
  Check,
  LogOut,
  Send,
} from 'lucide-react';
import {
  parseDocumentForReader,
  ParsedDocumentPage,
  ParsedDocumentResult,
  ReaderBlock,
} from '../utils/documentParser';
import {
  supabase,
  fetchUserDocumentReadingState,
  saveUserDocumentReadingState,
  ReaderHighlightColor,
  ReaderBookmark,
  ReaderHighlight,
  ReaderAnnotation,
  ReaderHighlightRect,
} from '../utils/supabase';

if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  } catch {}
}

export interface ReadableHubDocument {
  id: string;
  title: string;
  fileName: string;
  fileType: string;
  downloadUrl?: string;
  dataUrl?: string;
  previewUrl?: string;
}

interface DocumentReaderModalProps {
  doc: ReadableHubDocument;
  onClose: () => void;
}

const HIGHLIGHT_COLORS: Record<
  ReaderHighlightColor,
  { bg: string; swatch: string; ring: string; label: string }
> = {
  amber: {
    bg: 'rgba(251, 191, 36, 0.36)',
    swatch: 'bg-amber-400',
    ring: 'ring-amber-500',
    label: 'Amber',
  },
  cyan: {
    bg: 'rgba(34, 211, 238, 0.34)',
    swatch: 'bg-cyan-400',
    ring: 'ring-cyan-500',
    label: 'Cyan',
  },
  emerald: {
    bg: 'rgba(52, 211, 153, 0.34)',
    swatch: 'bg-emerald-400',
    ring: 'ring-emerald-500',
    label: 'Emerald',
  },
  rose: {
    bg: 'rgba(251, 113, 133, 0.32)',
    swatch: 'bg-rose-400',
    ring: 'ring-rose-500',
    label: 'Rose',
  },
};

function uidShort(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Render plain text inside structured pages with React-safe highlight spans (zero raw HTML).
 */
function renderHighlightedText(
  text: string,
  pageHighlights: ReaderHighlight[]
): React.ReactNode {
  if (!text || pageHighlights.length === 0) return text;
  const needles = pageHighlights
    .filter((h) => h.text && h.text.trim().length >= 2)
    .sort((a, b) => b.text.length - a.text.length);
  if (needles.length === 0) return text;

  const lowerText = text.toLowerCase();
  const segments: Array<{ str: string; color?: ReaderHighlightColor }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    let bestIdx = -1;
    let bestLen = 0;
    let bestColor: ReaderHighlightColor = 'amber';

    for (const h of needles) {
      const idx = lowerText.indexOf(h.text.trim().toLowerCase(), cursor);
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx || (idx === bestIdx && h.text.length > bestLen))) {
        bestIdx = idx;
        bestLen = h.text.trim().length;
        bestColor = h.color || 'amber';
      }
    }

    if (bestIdx === -1) {
      segments.push({ str: text.slice(cursor) });
      break;
    }

    if (bestIdx > cursor) {
      segments.push({ str: text.slice(cursor, bestIdx) });
    }
    segments.push({
      str: text.slice(bestIdx, bestIdx + bestLen),
      color: bestColor,
    });
    cursor = bestIdx + bestLen;
  }

  return segments.map((seg, i) =>
    seg.color ? (
      <mark
        key={i}
        style={{ backgroundColor: HIGHLIGHT_COLORS[seg.color]?.bg || HIGHLIGHT_COLORS.amber.bg }}
        className="text-inherit rounded-[2px] px-[1px]"
      >
        {seg.str}
      </mark>
    ) : (
      <React.Fragment key={i}>{seg.str}</React.Fragment>
    )
  );
}

/**
 * Single PDF Page Canvas + Selectable TextLayer + Overlay Highlights & Annotation Pins
 */
const PdfPageRenderer: React.FC<{
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  zoom: number;
  containerWidth: number;
  highlights: ReaderHighlight[];
  annotations: ReaderAnnotation[];
  annotateMode: boolean;
  onPinAnnotationClick: (page: number, xPct: number, yPct: number) => void;
  onSelectAnnotationPin: (ann: ReaderAnnotation) => void;
}> = ({
  pdfDoc,
  pageNumber,
  zoom,
  containerWidth,
  highlights,
  annotations,
  annotateMode,
  onPinAnnotationClick,
  onSelectAnnotationPin,
}) => {
  const pageBoxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: Math.max(280, Math.min(840, containerWidth - 24)),
    height: Math.round(Math.max(280, Math.min(840, containerWidth - 24)) * 1.414),
  });
  const [isVisible, setIsVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const el = pageBoxRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setIsVisible(true);
        }
      },
      { rootMargin: '420px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    let textLayerInstance: any = null;

    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const maxReadableWidth = Math.max(280, Math.min(980, containerWidth - 28));
        const fitScale = maxReadableWidth / baseViewport.width;
        const effectiveScale = fitScale * zoom;
        const viewport = page.getViewport({ scale: effectiveScale });
        const cssW = Math.round(viewport.width);
        const cssH = Math.round(viewport.height);
        setDimensions({ width: cssW, height: cssH });

        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2.5);
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, cssW, cssH);

        renderTask = page.render({
          canvasContext: ctx,
          viewport,
          canvas,
        });
        await renderTask.promise;
        ctx.restore();
        if (cancelled) return;

        // Render selectable TextLayer aligned identically to canvas
        const tlContainer = textLayerRef.current;
        if (tlContainer) {
          tlContainer.innerHTML = '';
          tlContainer.style.setProperty('--total-scale-factor', String(effectiveScale));
          const textContent = await page.getTextContent();
          if (cancelled) return;
          textLayerInstance = new pdfjsLib.TextLayer({
            textContentSource: textContent,
            container: tlContainer,
            viewport,
          });
          await textLayerInstance.render();
        }

        if (!cancelled) setRendered(true);
      } catch {
        // Ignore cancelled renders on rapid zoom/scroll
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {}
      try {
        textLayerInstance?.cancel();
      } catch {}
    };
  }, [pdfDoc, pageNumber, zoom, containerWidth, isVisible]);

  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.page === pageNumber),
    [highlights, pageNumber]
  );
  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.page === pageNumber),
    [annotations, pageNumber]
  );

  const handleSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!annotateMode || !pageBoxRef.current) return;
    const sel = window.getSelection()?.toString().trim();
    if (sel) return;
    const rect = pageBoxRef.current.getBoundingClientRect();
    const xPct = Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(4, Math.min(96, ((e.clientY - rect.top) / rect.height) * 100));
    onPinAnnotationClick(pageNumber, xPct, yPct);
  };

  return (
    <div
      ref={pageBoxRef}
      data-reader-page={pageNumber}
      onClick={handleSurfaceClick}
      style={{ width: `${dimensions.width}px`, height: `${dimensions.height}px` }}
      className={`relative mx-auto bg-white shadow-md border border-stone-200 select-text overflow-hidden shrink-0 ${
        annotateMode ? 'cursor-crosshair' : ''
      }`}
    >
      <canvas ref={canvasRef} className="block w-full h-full pointer-events-none" />

      {/* Highlight Rectangles Overlay */}
      <div className="pointer-events-none absolute inset-0 z-[1]">
        {pageHighlights.map((hl) =>
          (hl.rects || []).map((r, idx) => (
            <div
              key={`${hl.id}-${idx}`}
              style={{
                left: `${r.x}%`,
                top: `${r.y}%`,
                width: `${r.w}%`,
                height: `${r.h}%`,
                backgroundColor: HIGHLIGHT_COLORS[hl.color]?.bg || HIGHLIGHT_COLORS.amber.bg,
              }}
              className="absolute rounded-[2px] mix-blend-multiply"
            />
          ))
        )}
      </div>

      {/* Selectable PDF TextLayer */}
      <div ref={textLayerRef} className="pdf-text-layer" />

      {/* Annotation Pins */}
      {pageAnnotations.map((ann) =>
        typeof ann.xPct === 'number' && typeof ann.yPct === 'number' ? (
          <button
            key={ann.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectAnnotationPin(ann);
            }}
            style={{ left: `${ann.xPct}%`, top: `${ann.yPct}%` }}
            title={ann.comment}
            aria-label={`Annotation on page ${pageNumber}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-[4] w-6 h-6 rounded-full bg-cyan-900 text-white shadow-md border-2 border-white flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
          >
            <StickyNote className="w-3 h-3" />
          </button>
        ) : null
      )}

      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-stone-50/70 pointer-events-none">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-800" />
        </div>
      )}
    </div>
  );
};

/**
 * Render structured document page (DOCX / PPTX / XLSX / ODT / EPUB / RTF / TXT / Image)
 */
const StructuredPageRenderer: React.FC<{
  page: ParsedDocumentPage;
  zoom: number;
  containerWidth: number;
  highlights: ReaderHighlight[];
  annotations: ReaderAnnotation[];
  annotateMode: boolean;
  onPinAnnotationClick: (page: number, xPct: number, yPct: number) => void;
  onSelectAnnotationPin: (ann: ReaderAnnotation) => void;
}> = ({
  page,
  zoom,
  containerWidth,
  highlights,
  annotations,
  annotateMode,
  onPinAnnotationClick,
  onSelectAnnotationPin,
}) => {
  const pageBoxRef = useRef<HTMLDivElement | null>(null);
  const pageHighlights = useMemo(
    () => highlights.filter((h) => h.page === page.pageNumber),
    [highlights, page.pageNumber]
  );
  const pageAnnotations = useMemo(
    () => annotations.filter((a) => a.page === page.pageNumber),
    [annotations, page.pageNumber]
  );

  const isSlide = page.kind === 'slide';
  const isSheet = page.kind === 'sheet';
  const isImage = page.kind === 'image';

  const baseMaxW = isSlide || isSheet ? 920 : 760;
  const pageWidth = Math.max(
    280,
    Math.min(Math.round(baseMaxW * zoom), containerWidth - 24)
  );

  const handleSurfaceClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!annotateMode || !pageBoxRef.current) return;
    const sel = window.getSelection()?.toString().trim();
    if (sel) return;
    const rect = pageBoxRef.current.getBoundingClientRect();
    const xPct = Math.max(4, Math.min(96, ((e.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(4, Math.min(96, ((e.clientY - rect.top) / rect.height) * 100));
    onPinAnnotationClick(page.pageNumber, xPct, yPct);
  };

  const renderBlock = (block: ReaderBlock, idx: number) => {
    switch (block.type) {
      case 'heading': {
        const cls =
          block.level === 1
            ? 'text-xl sm:text-2xl font-bold text-stone-900 mt-2 mb-3 tracking-tight'
            : block.level === 2
            ? 'text-lg sm:text-xl font-bold text-stone-900 mt-4 mb-2'
            : 'text-base sm:text-lg font-semibold text-stone-800 mt-3 mb-1.5';
        return (
          <div key={idx} className={cls} style={{ fontSize: `${Math.max(15, Math.round((block.level === 1 ? 24 : block.level === 2 ? 20 : 17) * zoom))}px` }}>
            {renderHighlightedText(block.text, pageHighlights)}
          </div>
        );
      }
      case 'paragraph':
        return (
          <p
            key={idx}
            style={{ fontSize: `${Math.max(13, Math.round(15.5 * zoom))}px` }}
            className="text-stone-800 leading-[1.75] mb-3.5 whitespace-pre-wrap"
          >
            {renderHighlightedText(block.text, pageHighlights)}
          </p>
        );
      case 'quote':
        return (
          <blockquote
            key={idx}
            style={{ fontSize: `${Math.max(13, Math.round(15 * zoom))}px` }}
            className="my-4 py-2 px-4 border-y border-stone-200 italic text-stone-700 bg-stone-50/70"
          >
            {renderHighlightedText(block.text, pageHighlights)}
          </blockquote>
        );
      case 'code':
        return (
          <pre
            key={idx}
            style={{ fontSize: `${Math.max(11, Math.round(12.5 * zoom))}px` }}
            className="my-3 p-3.5 rounded-lg bg-stone-100 border border-stone-200 font-mono text-stone-800 overflow-x-auto leading-relaxed"
          >
            {block.text}
          </pre>
        );
      case 'list': {
        const Tag = block.ordered ? 'ol' : 'ul';
        return (
          <Tag
            key={idx}
            style={{ fontSize: `${Math.max(13, Math.round(15 * zoom))}px` }}
            className={`mb-4 pl-5 space-y-1.5 text-stone-800 leading-[1.7] ${
              block.ordered ? 'list-decimal' : 'list-disc'
            }`}
          >
            {block.items.map((item, ii) => (
              <li key={ii}>{renderHighlightedText(item, pageHighlights)}</li>
            ))}
          </Tag>
        );
      }
      case 'table':
        return (
          <div key={idx} className="my-4 overflow-x-auto border border-stone-200 rounded-lg">
            <table className="w-full text-left border-collapse text-xs sm:text-sm font-mono tabular-nums">
              {block.headers.length > 0 && (
                <thead className="bg-stone-100 border-b border-stone-200">
                  <tr>
                    {block.headers.map((h, hi) => (
                      <th key={hi} className="px-3 py-2 font-semibold text-stone-900 border-r border-stone-200 last:border-r-0">
                        {renderHighlightedText(h, pageHighlights)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {block.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-stone-100 last:border-b-0 odd:bg-white even:bg-stone-50/50">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-1.5 text-stone-700 border-r border-stone-100 last:border-r-0">
                        {renderHighlightedText(cell, pageHighlights)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      case 'image':
        return (
          <div key={idx} className="my-4 flex justify-center">
            <img
              src={block.src}
              alt={block.alt || 'Document Figure'}
              className="max-w-full max-h-[68vh] object-contain rounded border border-stone-200"
            />
          </div>
        );
      case 'note':
        return (
          <div key={idx} className="my-3 p-3 rounded-lg bg-stone-50 border border-stone-200 text-xs text-stone-600">
            <strong className="text-stone-800 mr-1.5">{block.label}:</strong>
            {block.text}
          </div>
        );
    }
  };

  return (
    <div
      ref={pageBoxRef}
      data-reader-page={page.pageNumber}
      onClick={handleSurfaceClick}
      style={{ width: `${pageWidth}px` }}
      className={`relative mx-auto bg-white shadow-md border border-stone-200 select-text shrink-0 ${
        isSlide ? 'min-h-[360px] sm:min-h-[480px] p-6 sm:p-10 flex flex-col justify-between' : isImage ? 'p-3 sm:p-5' : 'min-h-[540px] sm:min-h-[760px] px-6 py-8 sm:px-12 sm:py-12'
      } ${annotateMode ? 'cursor-crosshair' : ''}`}
    >
      <div className="max-w-none">
        {isSheet && page.title && (
          <div className="text-xs font-mono font-semibold text-cyan-900 uppercase tracking-wider mb-3 pb-2 border-b border-stone-200">
            {page.title}
          </div>
        )}
        {page.blocks.map(renderBlock)}
      </div>

      {isSlide && page.speakerNotes && (
        <div className="mt-6 pt-3 border-t border-stone-200 text-xs text-stone-500 leading-relaxed">
          <span className="font-semibold text-stone-700 mr-1">Slide Notes:</span>
          {page.speakerNotes}
        </div>
      )}

      {/* Annotation Pins */}
      {pageAnnotations.map((ann) =>
        typeof ann.xPct === 'number' && typeof ann.yPct === 'number' ? (
          <button
            key={ann.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectAnnotationPin(ann);
            }}
            style={{ left: `${ann.xPct}%`, top: `${ann.yPct}%` }}
            title={ann.comment}
            aria-label={`Annotation on page ${page.pageNumber}`}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-[4] w-6 h-6 rounded-full bg-cyan-900 text-white shadow-md border-2 border-white flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
          >
            <StickyNote className="w-3 h-3" />
          </button>
        ) : null
      )}
    </div>
  );
};

export const DocumentReaderModal: React.FC<DocumentReaderModalProps> = ({ doc, onClose }) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? Math.min(window.innerWidth - 16, 1080) : 800
  );

  // Parsed Document State
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [parsedDoc, setParsedDoc] = useState<ParsedDocumentResult | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  // Reading Position & Preferences State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [viewMode, setViewMode] = useState<'paginated' | 'continuous'>('paginated');
  const [zoom, setZoom] = useState(1);
  const pendingRestoreScrollRef = useRef<{ page: number; scrollRatio: number; viewMode: 'paginated' | 'continuous' } | null>(null);
  const [restoreTick, setRestoreTick] = useState(0);

  // Private User Annotations / Bookmarks / Highlights / Personal Notes
  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>([]);
  const [highlights, setHighlights] = useState<ReaderHighlight[]>([]);
  const [annotations, setAnnotations] = useState<ReaderAnnotation[]>([]);
  const [personalNotes, setPersonalNotes] = useState('');

  // Interactive Tool States
  const [highlightMode, setHighlightMode] = useState(false);
  const [activeHighlightColor, setActiveHighlightColor] = useState<ReaderHighlightColor>('amber');
  const [annotateMode, setAnnotateMode] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'bookmarks' | 'highlights' | 'notes'>('bookmarks');

  // Floating Text Selection Popover & Pending Annotation Draft
  const [selectionAction, setSelectionAction] = useState<{
    text: string;
    page: number;
    rects: ReaderHighlightRect[];
    x: number;
    y: number;
  } | null>(null);
  const [pendingAnnotation, setPendingAnnotation] = useState<{
    page: number;
    xPct?: number;
    yPct?: number;
    quote?: string;
    comment: string;
  } | null>(null);

  // Reader Authentication State (Supabase User ID)
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [showAuthPopover, setShowAuthPopover] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [syncIndicator, setSyncIndicator] = useState<'idle' | 'saving' | 'saved'>('idle');

  const saveTimerRef = useRef<number | null>(null);
  const latestStateRef = useRef({
    currentPage,
    totalPages,
    zoom,
    viewMode,
    bookmarks,
    highlights,
    annotations,
    personalNotes,
  });

  latestStateRef.current = {
    currentPage,
    totalPages,
    zoom,
    viewMode,
    bookmarks,
    highlights,
    annotations,
    personalNotes,
  };

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Measure reading viewport width cleanly
  useEffect(() => {
    const updateWidth = () => {
      if (viewportRef.current) {
        setContainerWidth(Math.max(300, viewportRef.current.clientWidth));
      } else if (typeof window !== 'undefined') {
        setContainerWidth(Math.max(300, window.innerWidth - 24));
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [isDrawerOpen]);

  // Lock page body scroll while reader is open & support Escape close
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pendingAnnotation) setPendingAnnotation(null);
        else if (showAuthPopover) setShowAuthPopover(false);
        else if (isDrawerOpen) setIsDrawerOpen(false);
        else onClose();
      } else if (
        viewMode === 'paginated' &&
        !isDrawerOpen &&
        !pendingAnnotation &&
        !showAuthPopover &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          setCurrentPage((p) => Math.min(totalPages, p + 1));
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          setCurrentPage((p) => Math.max(1, p - 1));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, viewMode, totalPages, isDrawerOpen, pendingAnnotation, showAuthPopover]);

  // Load authenticated user's private reading state from Supabase
  const loadPrivateReadingState = useCallback(async () => {
    const { user, state } = await fetchUserDocumentReadingState(doc.id);
    setAuthUser(user);
    setAuthLoaded(true);
    if (state) {
      setViewMode(state.viewMode);
      setZoom(state.zoom);
      setBookmarks(state.bookmarks);
      setHighlights(state.highlights);
      setAnnotations(state.annotations);
      setPersonalNotes(state.personalNotes);
      setCurrentPage(state.lastPage);
      pendingRestoreScrollRef.current = {
        page: state.lastPage,
        scrollRatio: state.scrollRatio,
        viewMode: state.viewMode,
      };
      setRestoreTick((t) => t + 1);
    }
  }, [doc.id]);

  useEffect(() => {
    void loadPrivateReadingState();
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, sess) => {
      if (sess?.user && !(sess.user as any).is_anonymous) {
        void loadPrivateReadingState();
      } else {
        setAuthUser(null);
        setAuthLoaded(true);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [loadPrivateReadingState]);

  // Persist reading state helper (only when authenticated against Supabase user_id)
  const flushReadingStateSave = useCallback(async () => {
    if (!authUser || (authUser as any).is_anonymous) return;
    const snap = latestStateRef.current;
    const vp = viewportRef.current;
    const maxScroll = vp ? Math.max(1, vp.scrollHeight - vp.clientHeight) : 1;
    const scrollY = vp ? vp.scrollTop : 0;
    const scrollRatio = vp && vp.scrollHeight > vp.clientHeight ? scrollY / maxScroll : 0;

    setSyncIndicator('saving');
    try {
      await saveUserDocumentReadingState(doc.id, {
        lastPage: snap.currentPage,
        totalPages: snap.totalPages,
        scrollRatio,
        scrollY,
        zoom: snap.zoom,
        viewMode: snap.viewMode,
        bookmarks: snap.bookmarks,
        highlights: snap.highlights,
        annotations: snap.annotations,
        personalNotes: snap.personalNotes,
      });
      setSyncIndicator('saved');
      window.setTimeout(() => setSyncIndicator('idle'), 1500);
    } catch {
      setSyncIndicator('idle');
    }
  }, [authUser, doc.id]);

  const scheduleReadingStateSave = useCallback(() => {
    if (!authUser || (authUser as any).is_anonymous) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void flushReadingStateSave();
    }, 450);
  }, [authUser, flushReadingStateSave]);

  // Save on unmount / close
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      void flushReadingStateSave();
    };
  }, [flushReadingStateSave]);

  // Load & parse document content (PDF or DOCX/PPTX/XLSX/ODT/EPUB/RTF/TXT/DOC/PPT/Image)
  useEffect(() => {
    let active = true;
    let activePdf: PDFDocumentProxy | null = null;
    setLoadingDoc(true);
    setLoadError(null);
    setPdfDoc(null);
    setParsedDoc(null);

    const source = doc.dataUrl || doc.downloadUrl || `/api/documents/files/${doc.id}`;

    parseDocumentForReader(source, doc.fileName, doc.fileType)
      .then(async (res) => {
        if (!active) return;
        if (res.format === 'pdf' && res.pdfBytes) {
          const loadingTask = pdfjsLib.getDocument({ data: res.pdfBytes });
          const pdf = await loadingTask.promise;
          if (!active) {
            await loadingTask.destroy().catch(() => {});
            return;
          }
          activePdf = pdf;
          setPdfDoc(pdf);
          setParsedDoc(res);
          setTotalPages(pdf.numPages);
          setCurrentPage((p) => Math.min(pdf.numPages, Math.max(1, p)));
          setLoadingDoc(false);
        } else {
          setParsedDoc(res);
          const count = Math.max(1, res.pages.length);
          setTotalPages(count);
          setCurrentPage((p) => Math.min(count, Math.max(1, p)));
          setLoadingDoc(false);
        }
      })
      .catch((err: any) => {
        if (!active) return;
        setLoadError(err?.message || 'Unable to render this document.');
        setLoadingDoc(false);
      });

    return () => {
      active = false;
      if (activePdf) {
        void Promise.resolve((activePdf as unknown as { destroy?: () => Promise<void> }).destroy?.() ?? activePdf.cleanup()).catch(() => {});
      }
    };
  }, [doc.id, doc.dataUrl, doc.downloadUrl, doc.fileName, doc.fileType]);

  // Restore exact last-read page and scroll position once content mounts
  useEffect(() => {
    if (loadingDoc || !pendingRestoreScrollRef.current) return;
    const pending = pendingRestoreScrollRef.current;
    pendingRestoreScrollRef.current = null;

    const timer = window.setTimeout(() => {
      const vp = viewportRef.current;
      if (!vp) return;
      if (pending.viewMode === 'continuous') {
        const targetEl = vp.querySelector(`[data-reader-page="${pending.page}"]`) as HTMLElement | null;
        if (targetEl && pending.scrollRatio <= 0.02) {
          targetEl.scrollIntoView({ block: 'start' });
        } else if (pending.scrollRatio > 0) {
          const maxS = Math.max(0, vp.scrollHeight - vp.clientHeight);
          vp.scrollTop = Math.round(maxS * pending.scrollRatio);
        }
      } else if (pending.scrollRatio > 0) {
        const maxS = Math.max(0, vp.scrollHeight - vp.clientHeight);
        vp.scrollTop = Math.round(maxS * pending.scrollRatio);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [loadingDoc, parsedDoc, pdfDoc, restoreTick]);

  // Auto-save whenever reading state mutates
  useEffect(() => {
    if (!authLoaded || loadingDoc) return;
    scheduleReadingStateSave();
  }, [
    currentPage,
    zoom,
    viewMode,
    bookmarks,
    highlights,
    annotations,
    personalNotes,
    authLoaded,
    loadingDoc,
    scheduleReadingStateSave,
  ]);

  // Scroll listener for continuous page tracking + exact scroll position auto-save
  const handleViewportScroll = () => {
    const vp = viewportRef.current;
    if (!vp) return;

    if (viewMode === 'continuous') {
      const vpRect = vp.getBoundingClientRect();
      const centerY = vpRect.top + vpRect.height * 0.35;
      const pageNodes = Array.from(vp.querySelectorAll('[data-reader-page]')) as HTMLElement[];
      let bestPage = currentPage;
      let bestDist = Infinity;
      for (const node of pageNodes) {
        const r = node.getBoundingClientRect();
        const dist = Math.abs(r.top - centerY);
        if (r.top <= centerY + 80 && r.bottom >= vpRect.top && dist < bestDist) {
          bestDist = dist;
          bestPage = Number(node.dataset.readerPage || 1);
        }
      }
      if (bestPage !== currentPage) {
        setCurrentPage(bestPage);
      }
    }
    scheduleReadingStateSave();
  };

  const jumpToPage = (targetPage: number) => {
    const clamped = Math.max(1, Math.min(totalPages, targetPage));
    setCurrentPage(clamped);
    const vp = viewportRef.current;
    if (!vp) return;
    if (viewMode === 'continuous') {
      const targetEl = vp.querySelector(`[data-reader-page="${clamped}"]`) as HTMLElement | null;
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      vp.scrollTop = 0;
    }
  };

  const requireAuthForPrivateAction = (): boolean => {
    if (authUser && !(authUser as any).is_anonymous) return true;
    setAuthMessage('Sign in to save private bookmarks, highlights, notes, and reading progress.');
    setShowAuthPopover(true);
    return false;
  };

  const isCurrentPageBookmarked = useMemo(
    () => bookmarks.some((b) => b.page === currentPage),
    [bookmarks, currentPage]
  );

  const handleToggleBookmark = () => {
    if (!requireAuthForPrivateAction()) return;
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.page === currentPage);
      if (exists) return prev.filter((b) => b.page !== currentPage);
      return [
        ...prev,
        {
          id: uidShort('bm'),
          page: currentPage,
          label: `Page ${currentPage}`,
          createdAt: new Date().toISOString(),
        },
      ].sort((a, b) => a.page - b.page);
    });
  };

  // Capture text selection for Highlighting & Annotating
  const handleViewportMouseUpOrTouchEnd = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setSelectionAction(null);
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 2) {
      setSelectionAction(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const anchorNode = range.commonAncestorContainer;
    const anchorEl =
      anchorNode.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as Element)
        : anchorNode.parentElement;
    const pageEl = anchorEl?.closest('[data-reader-page]') as HTMLElement | null;
    if (!pageEl) {
      setSelectionAction(null);
      return;
    }

    const pageNum = Number(pageEl.dataset.readerPage || currentPage);
    const pageRect = pageEl.getBoundingClientRect();
    const clientRects = Array.from(range.getClientRects()).filter((r) => r.width > 1 && r.height > 1);
    const rects: ReaderHighlightRect[] = clientRects.map((r) => ({
      x: Math.max(0, Math.min(100, ((r.left - pageRect.left) / pageRect.width) * 100)),
      y: Math.max(0, Math.min(100, ((r.top - pageRect.top) / pageRect.height) * 100)),
      w: Math.max(0.5, Math.min(100, (r.width / pageRect.width) * 100)),
      h: Math.max(0.5, Math.min(100, (r.height / pageRect.height) * 100)),
    }));

    // If Highlight tool is active, immediately apply highlight!
    if (highlightMode) {
      if (requireAuthForPrivateAction()) {
        const nextHl: ReaderHighlight = {
          id: uidShort('hl'),
          page: pageNum,
          text: text.slice(0, 500),
          color: activeHighlightColor,
          rects,
          createdAt: new Date().toISOString(),
        };
        setHighlights((prev) => [nextHl, ...prev]);
      }
      sel.removeAllRanges();
      setSelectionAction(null);
      return;
    }

    const firstRect = clientRects[0] || range.getBoundingClientRect();
    setSelectionAction({
      text: text.slice(0, 500),
      page: pageNum,
      rects,
      x: Math.max(70, Math.min((typeof window !== 'undefined' ? window.innerWidth : 800) - 90, firstRect.left + firstRect.width / 2)),
      y: Math.max(64, firstRect.top - 10),
    });
  };

  const applySelectionHighlight = (color: ReaderHighlightColor) => {
    if (!selectionAction) return;
    if (!requireAuthForPrivateAction()) return;
    const nextHl: ReaderHighlight = {
      id: uidShort('hl'),
      page: selectionAction.page,
      text: selectionAction.text,
      color,
      rects: selectionAction.rects,
      createdAt: new Date().toISOString(),
    };
    setHighlights((prev) => [nextHl, ...prev]);
    window.getSelection()?.removeAllRanges();
    setSelectionAction(null);
  };

  const startAnnotationFromSelection = () => {
    if (!selectionAction) return;
    if (!requireAuthForPrivateAction()) return;
    const first = selectionAction.rects[0];
    setPendingAnnotation({
      page: selectionAction.page,
      xPct: first ? Math.min(94, first.x + first.w / 2) : 50,
      yPct: first ? Math.max(4, first.y) : 30,
      quote: selectionAction.text,
      comment: '',
    });
    window.getSelection()?.removeAllRanges();
    setSelectionAction(null);
  };

  const handleSavePendingAnnotation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAnnotation || !pendingAnnotation.comment.trim()) return;
    if (!requireAuthForPrivateAction()) return;
    const nextAnn: ReaderAnnotation = {
      id: uidShort('ann'),
      page: pendingAnnotation.page,
      xPct: pendingAnnotation.xPct,
      yPct: pendingAnnotation.yPct,
      quote: pendingAnnotation.quote,
      comment: pendingAnnotation.comment.trim(),
      color: activeHighlightColor,
      createdAt: new Date().toISOString(),
    };
    setAnnotations((prev) => [nextAnn, ...prev]);
    setPendingAnnotation(null);
    setAnnotateMode(false);
    setDrawerTab('highlights');
    setIsDrawerOpen(true);
  };

  const handleReaderAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMessage(null);
    const email = authEmail.trim();
    const password = authPassword;
    if (!email || password.length < 6) {
      setAuthMessage('Enter a valid email and a password of at least 6 characters.');
      return;
    }
    setAuthSubmitting(true);
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setAuthMessage(error.message);
        } else if (data?.user && !data.session) {
          setAuthMessage('Account created. Check your email to confirm, then sign in.');
          setAuthMode('signin');
        } else if (data?.user) {
          setAuthUser(data.user);
          setShowAuthPopover(false);
          setAuthPassword('');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setAuthMessage(error.message);
        } else if (data?.user) {
          setAuthUser(data.user);
          setShowAuthPopover(false);
          setAuthPassword('');
        }
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleReaderSignOut = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setAuthUser(null);
    setBookmarks([]);
    setHighlights([]);
    setAnnotations([]);
    setPersonalNotes('');
    setShowAuthPopover(false);
  };

  const pdfPageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, i) => i + 1),
    [totalPages]
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={doc.title || doc.fileName}
      className="fixed inset-0 z-[70] flex flex-col bg-[#ebe7df] text-stone-900 select-none"
    >
      {/* COMPACT ICON-BASED READER BAR (NO DOWNLOAD BUTTON, ZERO CLUTTER) */}
      <header className="h-12 px-2 sm:px-4 bg-[#f7f4ee] border-b border-stone-300 flex items-center justify-between gap-2 sm:gap-3 shrink-0 z-20">
        {/* Left: Close + Compact Title (explicit right clearance so page nav never touches X) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 sm:flex-1 mr-2 sm:mr-4 shrink-0">
          <button
            type="button"
            onClick={() => {
              void flushReadingStateSave();
              onClose();
            }}
            aria-label="Close reader"
            title="Close"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-stone-700 hover:bg-stone-200/80 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="hidden sm:block text-xs sm:text-sm font-serif font-semibold text-stone-900 truncate max-w-[240px]">
            {doc.title || doc.fileName}
          </h2>
        </div>

        {/* Center: Compact Page Navigation (< page no >) & View Mode */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="inline-flex items-center gap-0 bg-white/95 border border-stone-300/90 rounded-md px-0.5 py-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => jumpToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Previous page"
              title="Previous Page"
              className="w-4.5 h-5 sm:w-5 sm:h-5 rounded flex items-center justify-center text-stone-700 hover:bg-stone-200/80 disabled:opacity-35 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3 h-3" />
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const parsed = parseInt(pageInput, 10);
                if (!Number.isNaN(parsed)) jumpToPage(parsed);
              }}
              className="flex items-center gap-0.5 text-[10px] font-mono tabular-nums text-stone-700 px-0.5"
            >
              <input
                type="text"
                inputMode="numeric"
                aria-label="Current page"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => {
                  const parsed = parseInt(pageInput, 10);
                  if (!Number.isNaN(parsed)) jumpToPage(parsed);
                  else setPageInput(String(currentPage));
                }}
                className="w-5 sm:w-6 h-4.5 text-center rounded bg-transparent text-stone-900 text-[10px] font-mono font-semibold focus:outline-none focus:bg-stone-100"
              />
              <span className="text-stone-500 text-[10px] leading-none">/{totalPages}</span>
            </form>

            <button
              type="button"
              onClick={() => jumpToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              title="Next Page"
              className="w-4.5 h-5 sm:w-5 sm:h-5 rounded flex items-center justify-center text-stone-700 hover:bg-stone-200/80 disabled:opacity-35 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="hidden sm:block w-px h-4 bg-stone-300 mx-0.5" />

          {/* Paginated vs Continuous Toggle */}
          <button
            type="button"
            onClick={() => setViewMode((m) => (m === 'paginated' ? 'continuous' : 'paginated'))}
            aria-label={viewMode === 'paginated' ? 'Switch to continuous scroll' : 'Switch to page by page'}
            title={viewMode === 'paginated' ? 'Continuous Reading' : 'Page-by-Page'}
            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              viewMode === 'continuous'
                ? 'bg-cyan-900 text-white'
                : 'text-stone-700 hover:bg-stone-200/80'
            }`}
          >
            {viewMode === 'continuous' ? <Rows3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>
        </div>

        {/* Right: Zoom, Bookmark, Highlight, Annotate, Notes Drawer & Account */}
        <div className="flex items-center gap-0 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
            disabled={zoom <= 0.6}
            aria-label="Zoom out"
            title="Zoom Out"
            className="w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-stone-700 hover:bg-stone-200/80 disabled:opacity-35 transition-colors cursor-pointer"
          >
            <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            type="button"
            onClick={() => setZoom(1)}
            title="Reset Zoom"
            className="hidden md:inline-flex px-1.5 h-7 items-center rounded text-[11px] font-mono tabular-nums text-stone-700 hover:bg-stone-200/80 cursor-pointer"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.2, Number((z + 0.15).toFixed(2))))}
            disabled={zoom >= 2.2}
            aria-label="Zoom in"
            title="Zoom In"
            className="w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center text-stone-700 hover:bg-stone-200/80 disabled:opacity-35 transition-colors cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <div className="w-px h-4 bg-stone-300 mx-0.5 sm:mx-1" />

          <button
            type="button"
            onClick={handleToggleBookmark}
            aria-label={isCurrentPageBookmarked ? 'Remove bookmark' : 'Bookmark page'}
            title={isCurrentPageBookmarked ? 'Bookmarked' : 'Bookmark Page'}
            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              isCurrentPageBookmarked
                ? 'bg-amber-100 text-amber-800'
                : 'text-stone-700 hover:bg-stone-200/80'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isCurrentPageBookmarked ? 'fill-amber-600 text-amber-700' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              setHighlightMode((v) => !v);
              setAnnotateMode(false);
            }}
            aria-label="Toggle highlight tool"
            title="Highlight Text"
            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              highlightMode
                ? 'bg-amber-400 text-stone-950'
                : 'text-stone-700 hover:bg-stone-200/80'
            }`}
          >
            <Highlighter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (!requireAuthForPrivateAction()) return;
              setAnnotateMode((v) => !v);
              setHighlightMode(false);
            }}
            aria-label="Add annotation"
            title="Annotate Page"
            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              annotateMode
                ? 'bg-cyan-900 text-white'
                : 'text-stone-700 hover:bg-stone-200/80'
            }`}
          >
            <MessageSquarePlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              setIsDrawerOpen((o) => !o);
              setShowAuthPopover(false);
            }}
            aria-label="Notes and bookmarks"
            title="Bookmarks, Highlights & Notes"
            className={`relative w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              isDrawerOpen
                ? 'bg-cyan-900 text-white'
                : 'text-stone-700 hover:bg-stone-200/80'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {(bookmarks.length > 0 || highlights.length > 0 || annotations.length > 0) && (
              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-600" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setAuthMessage(null);
              setShowAuthPopover((v) => !v);
              setIsDrawerOpen(false);
            }}
            aria-label={authUser ? 'Reader account synced' : 'Sign in to sync reading progress'}
            title={authUser ? `Signed in: ${authUser.email}` : 'Sign in to save privately'}
            className={`w-6 h-6 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
              authUser
                ? 'text-emerald-800 hover:bg-emerald-100'
                : 'text-stone-700 hover:bg-stone-200/80'
            }`}
          >
            {syncIndicator === 'saving' ? (
              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-cyan-800" />
            ) : syncIndicator === 'saved' ? (
              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-700" />
            ) : authUser ? (
              <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            ) : (
              <UserIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )}
          </button>
        </div>
      </header>

      {/* Highlight Color Strip (only when highlight mode is active) */}
      {highlightMode && (
        <div className="px-3 py-1.5 bg-[#f7f4ee] border-b border-stone-300 flex items-center justify-center gap-2 text-[11px] text-stone-700 shrink-0">
          <span>Select text to highlight:</span>
          {(Object.keys(HIGHLIGHT_COLORS) as ReaderHighlightColor[]).map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => setActiveHighlightColor(col)}
              aria-label={`Highlight color ${HIGHLIGHT_COLORS[col].label}`}
              className={`w-5 h-5 rounded-full ${HIGHLIGHT_COLORS[col].swatch} cursor-pointer transition-transform ${
                activeHighlightColor === col ? `ring-2 ring-offset-1 ${HIGHLIGHT_COLORS[col].ring} scale-110` : 'opacity-75 hover:opacity-100'
              }`}
            />
          ))}
        </div>
      )}

      {/* Main Content Area + Slide-Over Notes Drawer */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden">
        <div
          ref={viewportRef}
          onScroll={handleViewportScroll}
          onMouseUp={handleViewportMouseUpOrTouchEnd}
          onTouchEnd={() => window.setTimeout(handleViewportMouseUpOrTouchEnd, 80)}
          className="flex-1 overflow-auto p-3 sm:p-6 space-y-5"
        >
          {loadingDoc ? (
            <div className="h-full min-h-[300px] flex items-center justify-center">
              <Loader2 className="w-7 h-7 animate-spin text-cyan-900" />
            </div>
          ) : loadError ? (
            <div className="max-w-md mx-auto mt-16 p-6 rounded-xl bg-white border border-stone-300 text-center space-y-3 shadow-sm">
              <p className="text-sm text-stone-800">{loadError}</p>
            </div>
          ) : pdfDoc ? (
            viewMode === 'paginated' ? (
              <PdfPageRenderer
                pdfDoc={pdfDoc}
                pageNumber={currentPage}
                zoom={zoom}
                containerWidth={containerWidth}
                highlights={highlights}
                annotations={annotations}
                annotateMode={annotateMode}
                onPinAnnotationClick={(page, xPct, yPct) =>
                  setPendingAnnotation({ page, xPct, yPct, comment: '' })
                }
                onSelectAnnotationPin={() => {
                  setDrawerTab('highlights');
                  setIsDrawerOpen(true);
                }}
              />
            ) : (
              <div className="space-y-5 pb-10">
                {pdfPageNumbers.map((num) => (
                  <PdfPageRenderer
                    key={num}
                    pdfDoc={pdfDoc}
                    pageNumber={num}
                    zoom={zoom}
                    containerWidth={containerWidth}
                    highlights={highlights}
                    annotations={annotations}
                    annotateMode={annotateMode}
                    onPinAnnotationClick={(page, xPct, yPct) =>
                      setPendingAnnotation({ page, xPct, yPct, comment: '' })
                    }
                    onSelectAnnotationPin={() => {
                      setDrawerTab('highlights');
                      setIsDrawerOpen(true);
                    }}
                  />
                ))}
              </div>
            )
          ) : parsedDoc ? (
            viewMode === 'paginated' ? (
              <StructuredPageRenderer
                page={parsedDoc.pages[Math.max(0, currentPage - 1)] || parsedDoc.pages[0]}
                zoom={zoom}
                containerWidth={containerWidth}
                highlights={highlights}
                annotations={annotations}
                annotateMode={annotateMode}
                onPinAnnotationClick={(page, xPct, yPct) =>
                  setPendingAnnotation({ page, xPct, yPct, comment: '' })
                }
                onSelectAnnotationPin={() => {
                  setDrawerTab('highlights');
                  setIsDrawerOpen(true);
                }}
              />
            ) : (
              <div className="space-y-5 pb-10">
                {parsedDoc.pages.map((pg) => (
                  <StructuredPageRenderer
                    key={pg.pageNumber}
                    page={pg}
                    zoom={zoom}
                    containerWidth={containerWidth}
                    highlights={highlights}
                    annotations={annotations}
                    annotateMode={annotateMode}
                    onPinAnnotationClick={(page, xPct, yPct) =>
                      setPendingAnnotation({ page, xPct, yPct, comment: '' })
                    }
                    onSelectAnnotationPin={() => {
                      setDrawerTab('highlights');
                      setIsDrawerOpen(true);
                    }}
                  />
                ))}
              </div>
            )
          ) : null}
        </div>

        {/* Floating Selection Action Toolbar */}
        {selectionAction && !highlightMode && (
          <div
            style={{
              left: `${selectionAction.x}px`,
              top: `${selectionAction.y}px`,
            }}
            className="fixed -translate-x-1/2 -translate-y-full z-[75] px-2 py-1.5 rounded-lg bg-stone-900 text-white shadow-xl flex items-center gap-1.5"
          >
            {(Object.keys(HIGHLIGHT_COLORS) as ReaderHighlightColor[]).map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => applySelectionHighlight(col)}
                aria-label={`Highlight ${col}`}
                className={`w-4 h-4 rounded-full ${HIGHLIGHT_COLORS[col].swatch} hover:scale-110 transition-transform cursor-pointer`}
              />
            ))}
            <div className="w-px h-4 bg-stone-700 mx-0.5" />
            <button
              type="button"
              onClick={startAnnotationFromSelection}
              aria-label="Annotate selection"
              title="Annotate"
              className="p-1 rounded hover:bg-stone-800 text-stone-100 cursor-pointer"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Private Bookmarks, Highlights, Annotations & Notes Drawer */}
        {isDrawerOpen && (
          <aside className="absolute inset-x-0 bottom-0 h-[56vh] sm:static sm:h-auto sm:w-80 md:w-96 bg-[#f7f4ee] border-t sm:border-t-0 sm:border-l border-stone-300 flex flex-col z-30 shadow-xl">
            <div className="px-3 py-2 border-b border-stone-300 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-stone-200/70 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setDrawerTab('bookmarks')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                    drawerTab === 'bookmarks' ? 'bg-white text-stone-900 font-semibold shadow-2xs' : 'text-stone-600'
                  }`}
                >
                  Bookmarks ({bookmarks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('highlights')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                    drawerTab === 'highlights' ? 'bg-white text-stone-900 font-semibold shadow-2xs' : 'text-stone-600'
                  }`}
                >
                  Marks ({highlights.length + annotations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerTab('notes')}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                    drawerTab === 'notes' ? 'bg-white text-stone-900 font-semibold shadow-2xs' : 'text-stone-600'
                  }`}
                >
                  Notes
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close panel"
                className="p-1.5 rounded-md text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!authUser && (
              <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2 text-[11px] text-amber-950">
                <span>Sign in to save privately to your account.</span>
                <button
                  type="button"
                  onClick={() => setShowAuthPopover(true)}
                  className="px-2 py-0.5 rounded bg-cyan-900 text-white font-semibold cursor-pointer shrink-0"
                >
                  Sign In
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 select-text">
              {drawerTab === 'bookmarks' && (
                <>
                  {bookmarks.length === 0 ? (
                    <p className="text-xs text-stone-500 text-center py-8">
                      No bookmarks yet. Tap the bookmark icon to save a page.
                    </p>
                  ) : (
                    bookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        className="p-2.5 rounded-lg bg-white border border-stone-200 flex items-center justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => jumpToPage(bm.page)}
                          className="text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <div className="text-xs font-semibold text-cyan-900">Page {bm.page}</div>
                          {bm.excerpt && (
                            <p className="text-[11px] text-stone-600 truncate">{bm.excerpt}</p>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setBookmarks((prev) => prev.filter((x) => x.id !== bm.id))
                          }
                          aria-label="Delete bookmark"
                          className="p-1 rounded text-stone-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}

              {drawerTab === 'highlights' && (
                <>
                  {highlights.length === 0 && annotations.length === 0 ? (
                    <p className="text-xs text-stone-500 text-center py-8">
                      Select text to highlight passages or click the annotate icon to pin notes on a page.
                    </p>
                  ) : (
                    <>
                      {annotations.map((ann) => (
                        <div
                          key={ann.id}
                          className="p-2.5 rounded-lg bg-white border border-stone-200 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => jumpToPage(ann.page)}
                              className="text-[11px] font-mono font-semibold text-cyan-900 hover:underline cursor-pointer"
                            >
                              Annotation · Page {ann.page}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setAnnotations((prev) => prev.filter((x) => x.id !== ann.id))
                              }
                              aria-label="Delete annotation"
                              className="p-1 rounded text-stone-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {ann.quote && (
                            <p className="text-[11px] italic text-stone-500 line-clamp-2">
                              “{ann.quote}”
                            </p>
                          )}
                          <p className="text-xs text-stone-800 whitespace-pre-wrap">{ann.comment}</p>
                        </div>
                      ))}

                      {highlights.map((hl) => (
                        <div
                          key={hl.id}
                          className="p-2.5 rounded-lg bg-white border border-stone-200 space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => jumpToPage(hl.page)}
                              className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-stone-800 hover:text-cyan-900 cursor-pointer"
                            >
                              <span className={`w-2.5 h-2.5 rounded-full ${HIGHLIGHT_COLORS[hl.color]?.swatch || 'bg-amber-400'}`} />
                              <span>Highlight · Page {hl.page}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setHighlights((prev) => prev.filter((x) => x.id !== hl.id))
                              }
                              aria-label="Delete highlight"
                              className="p-1 rounded text-stone-400 hover:text-rose-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-stone-700 leading-relaxed line-clamp-4">
                            “{hl.text}”
                          </p>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}

              {drawerTab === 'notes' && (
                <div className="h-full flex flex-col gap-2">
                  <textarea
                    value={personalNotes}
                    onChange={(e) => {
                      if (!authUser) {
                        requireAuthForPrivateAction();
                        return;
                      }
                      setPersonalNotes(e.target.value);
                    }}
                    placeholder={
                      authUser
                        ? 'Write your private personal notes for this document...'
                        : 'Sign in to write private personal notes...'
                    }
                    className="w-full flex-1 min-h-[220px] p-3 rounded-lg bg-white border border-stone-300 text-xs sm:text-sm text-stone-900 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-cyan-800"
                  />
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Annotation Composer Popover */}
      {pendingAnnotation && (
        <div className="fixed inset-0 z-[80] bg-black/30 flex items-center justify-center p-4">
          <form
            onSubmit={handleSavePendingAnnotation}
            className="w-full max-w-sm bg-white rounded-xl border border-stone-300 p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-900">
                Add Annotation · Page {pendingAnnotation.page}
              </span>
              <button
                type="button"
                onClick={() => setPendingAnnotation(null)}
                className="p-1 rounded text-stone-400 hover:text-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {pendingAnnotation.quote && (
              <p className="text-[11px] italic text-stone-600 bg-stone-50 p-2 rounded border border-stone-200 line-clamp-3">
                “{pendingAnnotation.quote}”
              </p>
            )}
            <textarea
              rows={3}
              required
              autoFocus
              value={pendingAnnotation.comment}
              onChange={(e) =>
                setPendingAnnotation((prev) => (prev ? { ...prev, comment: e.target.value } : null))
              }
              placeholder="Write your annotation note..."
              className="w-full p-2.5 rounded-lg border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-cyan-800"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingAnnotation(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Save</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reader Account Sign-In / Sign-Up Popover */}
      {showAuthPopover && (
        <div
          onClick={() => setShowAuthPopover(false)}
          className="fixed inset-0 z-[80] bg-black/35 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-xl border border-stone-300 p-4 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-2">
              <span className="text-sm font-semibold text-stone-900">
                {authUser ? 'Reader Account' : authMode === 'signin' ? 'Reader Sign In' : 'Create Reader Account'}
              </span>
              <button
                type="button"
                onClick={() => setShowAuthPopover(false)}
                className="p-1 rounded text-stone-400 hover:text-stone-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {authUser ? (
              <div className="space-y-3">
                <p className="text-xs text-stone-700">
                  Signed in privately as <strong className="text-stone-900">{authUser.email}</strong>. Your bookmarks, highlights, notes, and last-read position sync automatically.
                </p>
                <button
                  type="button"
                  onClick={handleReaderSignOut}
                  className="w-full py-2 rounded-lg border border-stone-300 text-xs font-semibold text-stone-700 hover:bg-stone-100 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleReaderAuthSubmit} className="space-y-2.5">
                {authMessage && (
                  <p className="text-[11px] p-2 rounded bg-stone-100 border border-stone-200 text-stone-700">
                    {authMessage}
                  </p>
                )}
                <input
                  type="email"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full p-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-cyan-800"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Password (min. 6 characters)"
                  className="w-full p-2 rounded-lg border border-stone-300 text-xs text-stone-900 focus:outline-none focus:ring-1 focus:ring-cyan-800"
                />
                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full py-2 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {authSubmitting ? 'Please wait...' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMessage(null);
                    setAuthMode((m) => (m === 'signin' ? 'signup' : 'signin'));
                  }}
                  className="w-full text-[11px] text-cyan-900 hover:underline text-center cursor-pointer"
                >
                  {authMode === 'signin' ? 'Need a reader account? Create one' : 'Already have an account? Sign in'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
