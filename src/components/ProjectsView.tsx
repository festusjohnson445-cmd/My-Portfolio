import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Download,
  ExternalLink,
  ArrowLeft,
  FileText,
  Layers,
  Image as ImageIcon,
  Video,
  Wrench,
  Edit3,
  Trash2,
  Check,
  X,
  Eye,
  Share2,
  Heart,
  ChevronLeft,
  ChevronRight,
  Maximize2,
} from 'lucide-react';
import {
  fetchProjectsFromSupabase,
  deleteProjectFromSupabase,
  updateProjectHeroInscription,
  toggleProjectLikeInSupabase,
  incrementProjectViewsInSupabase,
  subscribeToProjectsRealtime,
  useWebsiteSettingsSync,
  getCachedProjects,
  EVENT_PROJECTS_UPDATED,
  type PortfolioProject,
  type MediaAssetItem,
  type ProjectScope,
} from '../utils/portfolioSupabase';
import { useProfileSync } from '../utils/profileState';
import { ProjectFormPanel } from './ProjectFormPanel';
import { CleanVideoPlayer } from './CleanVideoPlayer';
import { LiveRelativeTime } from './LiveRelativeTime';
import { CardTopMedia } from './CardTopMedia';
import { DocumentReaderModal, type ReadableHubDocument } from './DocumentReaderModal';
import { generateCrispDocumentThumbnail } from '../utils/documentParser';
import {
  getContainerWidthClassForAspect,
  getImageFitClass,
  getMediaImgStyle,
} from '../utils/mediaCardStyle';
import {
  isRichHtmlContent,
  markdownToBasicHtml,
  sanitizeArticleHtml,
} from '../utils/htmlSanitizer';
import {
  buildProjectSeoMetadata,
  getPageSeoMetadata,
} from '../seo/metadata';
import { applyClientSeoMetadata } from '../seo/clientMeta';

interface ProjectsViewProps {
  isActive?: boolean;
  initialSlugOrId?: string;
  onActiveSlugChange?: (slug: string | undefined) => void;
}

const LIKED_PROJECTS_KEY = 'fesline_liked_projects_v1';
const PROJECT_SCOPE_FILTERS: ('All' | ProjectScope)[] = [
  'All',
  'Personal',
  'Industrial',
  'Academic',
  'Global',
];

function isImageMedia(item?: Partial<MediaAssetItem>): boolean {
  if (!item) return false;
  if (item.fileType && /^image\//i.test(item.fileType)) return true;
  return /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(item.url || item.fileName || '');
}

function isPdfMedia(item?: Partial<MediaAssetItem>): boolean {
  if (!item) return false;
  if (item.fileType && /pdf/i.test(item.fileType)) return true;
  return /\.pdf(\?|#|$)/i.test(item.url || item.fileName || '');
}

function getFileExtensionBadge(item: Partial<MediaAssetItem>): string {
  const src = item.fileName || item.url || '';
  const match = src.split('?')[0].match(/\.([a-z0-9]+)$/i);
  return match ? match[1].toUpperCase() : 'CAD';
}

function resolveProjectCardImage(proj: PortfolioProject): string {
  if (proj.thumbnailUrl && proj.thumbnailUrl.trim()) return proj.thumbnailUrl.trim();
  const sImg = proj.showcaseImages?.[0];
  if (sImg) {
    const u = sImg.jpegUrl || sImg.webpUrl || sImg.url;
    if (u) return u;
  }
  const gImg = proj.images?.[0];
  if (gImg) {
    const u = gImg.jpegUrl || gImg.webpUrl || gImg.url;
    if (u) return u;
  }
  const sPdf = proj.showcasePdfs?.[0];
  if (sPdf && (sPdf.posterUrl || sPdf.jpegUrl)) {
    return sPdf.posterUrl || sPdf.jpegUrl || '';
  }
  const cad = proj.cadDrawings?.[0];
  if (cad) {
    if (cad.posterUrl || cad.jpegUrl) return cad.posterUrl || cad.jpegUrl || '';
    if (isImageMedia(cad)) return cad.url || '';
  }
  return '';
}

interface SharpAssetCardProps {
  item: MediaAssetItem;
  index: number;
  variant: 'cad' | 'pdf';
  onOpenReader: (doc: ReadableHubDocument) => void;
  onOpenLightbox: (src: string, title: string, downloadUrl: string) => void;
}

const SharpAssetCard: React.FC<SharpAssetCardProps> = ({
  item,
  index,
  variant,
  onOpenReader,
  onOpenLightbox,
}) => {
  const isImg = isImageMedia(item);
  const isPdf = isPdfMedia(item);
  const preRendered = item.posterUrl || item.jpegUrl || item.webpUrl || (isImg ? item.url : '');
  const [previewSrc, setPreviewSrc] = useState<string>(preRendered);
  const [rendering, setRendering] = useState<boolean>(false);

  const cleanTitle =
    (item.title && !/^\d+$/.test(item.title.trim()) ? item.title.trim() : '') ||
    (item.fileName && !/^\d+(\.[^/.]+)?$/.test(item.fileName.trim()) ? item.fileName.trim() : '') ||
    (variant === 'cad' ? `CAD Sheet ${index + 1}` : `Document Sheet ${index + 1}`);

  useEffect(() => {
    setPreviewSrc(preRendered);
  }, [preRendered]);

  useEffect(() => {
    let active = true;
    if (!previewSrc && isPdf && item.url) {
      setRendering(true);
      generateCrispDocumentThumbnail(
        item.url,
        item.fileName || `${cleanTitle}.pdf`,
        'application/pdf',
        1200
      )
        .then((thumb) => {
          if (active && thumb) setPreviewSrc(thumb);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setRendering(false);
        });
    }
    return () => {
      active = false;
    };
  }, [previewSrc, isPdf, item.url, item.fileName, cleanTitle]);

  const extBadge = getFileExtensionBadge(item);

  const handleInspect = () => {
    if (isPdf) {
      onOpenReader({
        id: `${variant}_${index}_${cleanTitle}`,
        title: cleanTitle,
        fileName: item.fileName || `${cleanTitle}.pdf`,
        fileType: 'pdf',
        downloadUrl: item.url,
        previewUrl: previewSrc || undefined,
      });
    } else if (previewSrc) {
      onOpenLightbox(previewSrc, cleanTitle, item.url);
    }
  };

  return (
    <div className="rounded-xl bg-white border border-[#b8c6d4] overflow-hidden shadow-2xs flex flex-col justify-between">
      <div
        onClick={previewSrc || isPdf ? handleInspect : undefined}
        className={`relative w-full ${
          variant === 'pdf' ? 'aspect-[4/5]' : 'aspect-[4/3]'
        } bg-slate-50 border-b border-slate-200 flex items-center justify-center overflow-hidden ${
          previewSrc || isPdf ? 'cursor-pointer group' : ''
        }`}
      >
        {previewSrc ? (
          <>
            <img
              src={previewSrc}
              alt={cleanTitle}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain bg-white p-1.5 transition-transform duration-200 group-hover:scale-[1.02]"
            />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-950/80 text-white text-[10.5px] font-semibold">
              <Maximize2 className="w-3 h-3" />
              <span>{isPdf ? 'Read' : 'Inspect'}</span>
            </span>
          </>
        ) : rendering ? (
          <div className="flex flex-col items-center gap-1.5 text-slate-500 text-[11px]">
            <div className="w-6 h-6 rounded-full border-2 border-cyan-800 border-t-transparent animate-spin" />
            <span>Rendering clear sheet...</span>
          </div>
        ) : (
          /* Sharp CAD Blueprint Drafting Card for native binary CAD formats (STEP/DWG/DXF/SLDPRT) */
          <div className="w-full h-full bg-[#edf3fa] flex flex-col items-center justify-center p-4 text-center relative">
            <div
              className="absolute inset-0 opacity-45 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(14,116,144,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(14,116,144,0.12) 1px, transparent 1px)',
                backgroundSize: '18px 18px',
              }}
            />
            <svg viewBox="0 0 120 72" className="w-24 h-14 relative z-10 text-cyan-900/80 mb-2" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="14" y="12" width="92" height="48" rx="2" strokeDasharray="3 2" />
              <circle cx="44" cy="36" r="14" />
              <circle cx="44" cy="36" r="5" />
              <line x1="22" y1="36" x2="66" y2="36" strokeDasharray="2 2" />
              <line x1="44" y1="16" x2="44" y2="56" strokeDasharray="2 2" />
              <polygon points="78,24 98,24 98,48 74,48" />
            </svg>
            <span className="relative z-10 text-[11px] font-mono font-bold text-cyan-950 tracking-wide">
              {extBadge} Engineering Sheet
            </span>
            {item.fileSize && (
              <span className="relative z-10 text-[10px] font-mono text-slate-500 mt-0.5">
                {item.fileSize}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-2.5 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-950 truncate" title={cleanTitle}>
              {cleanTitle}
            </p>
            <p className="text-[10.5px] font-mono text-slate-500 truncate">
              {extBadge}
              {item.fileSize ? ` · ${item.fileSize}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {(previewSrc || isPdf) && (
              <button
                type="button"
                onClick={handleInspect}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10.5px] font-semibold cursor-pointer"
              >
                <Eye className="w-3 h-3" />
                <span>{isPdf ? 'Read' : 'View'}</span>
              </button>
            )}
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[10.5px] font-semibold"
            >
              <Download className="w-3 h-3" />
              <span>Download</span>
            </a>
          </div>
        </div>
        {item.note && item.note.trim() && (
          <p className="text-[11px] text-slate-600 text-justify leading-relaxed border-t border-slate-100 pt-1.5">
            {item.note.trim()}
          </p>
        )}
      </div>
    </div>
  );
};

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  isActive = true,
  initialSlugOrId,
  onActiveSlugChange,
}) => {
  const { isOwner } = useProfileSync();
  const websiteSettings = useWebsiteSettingsSync();
  const { projectsArticlesConfig, cardAnimationEnabled } = websiteSettings.appearanceConfig;
  const { customSections, innerLayout, videoCardControls } = projectsArticlesConfig;
  const imageCardControls = projectsArticlesConfig.imageCardControls || {
    aspectRatio: '4/3' as const,
    objectFit: 'cover' as const,
    zoomLevel: 1,
  };
  const cardAnimClass = cardAnimationEnabled ? 'card-anim-enabled' : '';
  const visibleCustomSections = useMemo(
    () =>
      (customSections || []).filter(
        (s) => s.visible !== false && (s.targetPage === 'projects' || s.targetPage === 'both')
      ),
    [customSections]
  );

  const [projects, setProjects] = useState<PortfolioProject[]>(() => getCachedProjects(isOwner));
  const [loading, setLoading] = useState(false);
  const [selectedProject, setSelectedProject] = useState<PortfolioProject | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);

  const [likedProjectIds, setLikedProjectIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(LIKED_PROJECTS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch {}
    return new Set();
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PortfolioProject | null>(null);
  const [editingInscription, setEditingInscription] = useState(false);
  const [inscriptionDraft, setInscriptionDraft] = useState('');
  const [savingInscription, setSavingInscription] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedScope, setSelectedScope] = useState<'All' | ProjectScope>('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'featured'>('featured');

  const [readerDoc, setReaderDoc] = useState<ReadableHubDocument | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; title: string; downloadUrl?: string } | null>(
    null
  );
  const showcaseTrackRef = useRef<HTMLDivElement | null>(null);

  const loadProjects = async () => {
    try {
      const data = await fetchProjectsFromSupabase(isOwner);
      setProjects(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
    const onUpdated = () => {
      const updatedList = getCachedProjects(isOwner);
      setProjects(updatedList);
      setSelectedProject((prev) =>
        prev ? updatedList.find((p) => p.id === prev.id) || prev : null
      );
      setLoading(false);
    };
    window.addEventListener(EVENT_PROJECTS_UPDATED, onUpdated);
    const unsubRealtime = subscribeToProjectsRealtime(isOwner, (fresh) => {
      setProjects(fresh);
      setSelectedProject((prev) =>
        prev ? fresh.find((p) => p.id === prev.id) || prev : null
      );
    });
    return () => {
      window.removeEventListener(EVENT_PROJECTS_UPDATED, onUpdated);
      unsubRealtime();
    };
  }, [isOwner]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if ((isOwner || p.status === 'published') && p.category?.trim()) set.add(p.category.trim());
    });
    return ['All', ...Array.from(set)];
  }, [projects, isOwner]);

  useEffect(() => {
    if (selectedCategory !== 'All' && !categories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [categories, selectedCategory]);

  const activeUploadCategories = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.status === 'published' && p.category?.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (!isOwner && p.status !== 'published') return false;
      if (selectedCategory !== 'All' && (p.category || '').trim() !== selectedCategory) return false;
      if (selectedScope !== 'All' && (p.projectScope || 'Personal') !== selectedScope) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.projectScope || '').toLowerCase().includes(q) ||
        p.toolsUsed.some((t) => t.toLowerCase().includes(q))
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === 'featured') {
        if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [projects, isOwner, selectedCategory, selectedScope, searchQuery, sortBy]);

  const handleDelete = async (proj: PortfolioProject) => {
    try {
      await deleteProjectFromSupabase(proj.id);
      setProjects((prev) => prev.filter((p) => p.id !== proj.id));
      if (selectedProject?.id === proj.id) closeProjectDetail();
    } catch (err) {
      console.error(err);
    }
  };

  const handleProjectLike = async (proj: PortfolioProject) => {
    const currentlyLiked = likedProjectIds.has(proj.id);
    const delta: 1 | -1 = currentlyLiked ? -1 : 1;
    const optimistic = Math.max(0, (proj.likesCount || 0) + delta);

    setLikedProjectIds((prev) => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(proj.id);
      else next.add(proj.id);
      try {
        localStorage.setItem(LIKED_PROJECTS_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });

    setProjects((prev) =>
      prev.map((p) => (p.id === proj.id ? { ...p, likesCount: optimistic } : p))
    );
    if (selectedProject?.id === proj.id) {
      setSelectedProject((prev) => (prev ? { ...prev, likesCount: optimistic } : prev));
    }

    const authoritative = await toggleProjectLikeInSupabase(proj.id, delta, optimistic);
    if (typeof authoritative === 'number') {
      setProjects((prev) =>
        prev.map((p) => (p.id === proj.id ? { ...p, likesCount: authoritative } : p))
      );
      if (selectedProject?.id === proj.id) {
        setSelectedProject((prev) => (prev ? { ...prev, likesCount: authoritative } : prev));
      }
    }
  };

  // Sync deep-linked project slug/id from URL when active
  useEffect(() => {
    if (!initialSlugOrId) {
      setSelectedProject(null);
      return;
    }
    const target = initialSlugOrId.trim().toLowerCase();
    const match = projects.find(
      (p) =>
        (isOwner || p.status === 'published') &&
        ((p.slug && p.slug.toLowerCase() === target) || p.id.toLowerCase() === target)
    );
    if (match) {
      setSelectedProject((prev) => (prev?.id === match.id ? prev : match));
    }
  }, [initialSlugOrId, projects, isOwner]);

  // Sync dynamic client-side Open Graph / SEO tags for selected project
  useEffect(() => {
    if (!isActive) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    if (selectedProject) {
      applyClientSeoMetadata(buildProjectSeoMetadata(selectedProject, origin));
    } else {
      applyClientSeoMetadata(
        getPageSeoMetadata({ part: 'projects', canonicalPath: '/projects' }, origin)
      );
    }
  }, [isActive, selectedProject]);

  const openProjectDetail = (proj: PortfolioProject) => {
    setIsFormOpen(false);
    setEditingProject(null);
    setEditingInscription(false);
    setCopiedShare(false);
    setInscriptionDraft(proj.heroInscription || '');
    const slugOrId = proj.slug || proj.id;
    onActiveSlugChange?.(slugOrId);
    if (typeof window !== 'undefined') {
      const targetUrl = `/projects/${encodeURIComponent(slugOrId)}`;
      if (window.location.pathname !== targetUrl) {
        window.history.pushState(null, '', targetUrl);
      }
    }
    const optimisticViews = (proj.viewsCount || 0) + 1;
    setSelectedProject({ ...proj, viewsCount: optimisticViews });
    setProjects((prev) =>
      prev.map((p) => (p.id === proj.id ? { ...p, viewsCount: optimisticViews } : p))
    );
    void incrementProjectViewsInSupabase(proj.id).then((serverViews) => {
      if (typeof serverViews === 'number') {
        setSelectedProject((cur) => (cur?.id === proj.id ? { ...cur, viewsCount: serverViews } : cur));
      }
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const closeProjectDetail = () => {
    setSelectedProject(null);
    onActiveSlugChange?.(undefined);
    if (typeof window !== 'undefined' && window.location.pathname !== '/projects') {
      window.history.pushState(null, '', '/projects');
    }
  };

  const handleSaveHeroInscription = async () => {
    if (!selectedProject) return;
    setSavingInscription(true);
    try {
      const updated = await updateProjectHeroInscription(selectedProject, inscriptionDraft);
      setSelectedProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingInscription(false);
    } catch (err) {
      console.error('Unable to save project hero inscription:', err);
    } finally {
      setSavingInscription(false);
    }
  };

  const scrollShowcaseGallery = (dir: 'left' | 'right') => {
    const el = showcaseTrackRef.current;
    if (!el) return;
    const step = Math.max(260, Math.round(el.clientWidth * 0.78));
    el.scrollBy({ left: dir === 'left' ? -step : step, behavior: 'smooth' });
  };

  // =========================================================================
  // PROJECT DETAIL VIEW
  // =========================================================================
  if (selectedProject) {
    const showcaseGalleryItems =
      (selectedProject.showcaseImages && selectedProject.showcaseImages.length > 0)
        ? selectedProject.showcaseImages
        : selectedProject.formFormat === 'showcase'
        ? selectedProject.images
        : [];
    const regularImages =
      selectedProject.formFormat === 'showcase' &&
      !(selectedProject.showcaseImages && selectedProject.showcaseImages.length > 0)
        ? []
        : selectedProject.images;
    const isLiked = likedProjectIds.has(selectedProject.id);

    return (
      <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-4 pb-12 space-y-3 font-serif text-slate-900">
        {/* Back + Actions Bar */}
        <div className="flex items-center justify-between gap-2 bg-[#edf2f8] border border-[#b8c6d4] rounded-xl px-3 py-2 shadow-2xs flex-nowrap overflow-x-auto">
          <button
            type="button"
            onClick={closeProjectDetail}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold tabular-nums shrink-0 whitespace-nowrap"
              title="Real-time views"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-800" />
              <span>{selectedProject.viewsCount || 0}</span>
            </span>
            <button
              type="button"
              onClick={() => handleProjectLike(selectedProject)}
              aria-label={isLiked ? 'Unlike project' : 'Like project'}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap ${
                isLiked
                  ? 'bg-rose-50 border-rose-300 text-rose-700'
                  : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-rose-600 text-rose-600' : ''}`} />
              <span className="tabular-nums">{selectedProject.likesCount || 0}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof window === 'undefined') return;
                const shareUrl = `${window.location.origin}/projects/${encodeURIComponent(
                  selectedProject.slug || selectedProject.id
                )}`;
                navigator.clipboard?.writeText(shareUrl).catch(() => {});
                setCopiedShare(true);
                setTimeout(() => setCopiedShare(false), 2000);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
            >
              {copiedShare ? <Check className="w-3 h-3 text-emerald-700" /> : <Share2 className="w-3 h-3" />}
              <span>{copiedShare ? 'Copied' : 'Share'}</span>
            </button>

            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProject(selectedProject);
                    setIsFormOpen(true);
                    closeProjectDetail();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Edit3 className="w-3 h-3 text-cyan-800" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selectedProject)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Project Detail Header (No "Featured Project" badge; justified summary; unboxed Scope metadata) */}
        <div className="w-full bg-white border border-[#b8c6d4] rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3.5">
          <div className="space-y-2 border-b border-slate-200 pb-3.5">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-950 text-center leading-snug">
              {selectedProject.title}
            </h1>
            {selectedProject.description && (
              <p className="text-xs sm:text-sm text-slate-700 max-w-4xl mx-auto leading-relaxed text-justify">
                {selectedProject.description}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-600 pt-1">
              <span className="font-bold text-cyan-950">{selectedProject.category}</span>
              {selectedProject.projectScope && (
                <>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-semibold text-slate-800">{selectedProject.projectScope}</span>
                </>
              )}
              <span aria-hidden="true" className="text-slate-300">·</span>
              <LiveRelativeTime date={selectedProject.createdAt} className="text-[11px] text-slate-500 font-medium" />
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 text-slate-700 font-semibold tabular-nums">
                <Eye className="w-3.5 h-3.5 text-cyan-800" />
                <span>{selectedProject.viewsCount || 0} views</span>
              </span>
            </div>
          </div>

          {selectedProject.thumbnailUrl && (
            <figure className="w-full">
              <div
                className={`relative ${getContainerWidthClassForAspect(imageCardControls.aspectRatio, 'hero')} max-h-[420px] rounded-xl overflow-hidden border border-[#cbd5e1] shadow-xs bg-slate-100 flex items-center justify-center`}
                style={{
                  aspectRatio: (imageCardControls.aspectRatio || '4/3').replace(':', '/'),
                }}
              >
                <img
                  src={selectedProject.thumbnailUrl}
                  alt={selectedProject.title}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  style={getMediaImgStyle(imageCardControls)}
                  className={`w-full h-full ${getImageFitClass(imageCardControls.objectFit)} block transition-transform duration-200`}
                />

                {(selectedProject.heroInscription || isOwner) && (
                  <div
                    className="absolute top-2.5 right-2.5 z-20 max-w-[85%] sm:max-w-[58%]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {editingInscription && isOwner ? (
                      <div className="flex flex-col gap-1.5 bg-slate-950/90 backdrop-blur-xs border border-white/25 rounded-lg p-2 shadow-lg">
                        <input
                          type="text"
                          value={inscriptionDraft}
                          onChange={(e) => setInscriptionDraft(e.target.value)}
                          placeholder="Top-right hero inscription..."
                          className="w-full min-w-[180px] sm:min-w-[230px] px-2 py-1 rounded border border-slate-500 bg-slate-900 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-400"
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={savingInscription}
                            onClick={handleSaveHeroInscription}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-700 hover:bg-cyan-600 text-white text-[10.5px] font-semibold cursor-pointer disabled:opacity-60"
                          >
                            <Check className="w-3 h-3" />
                            <span>{savingInscription ? 'Saving...' : 'Save'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingInscription(false);
                              setInscriptionDraft(selectedProject.heroInscription || '');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-100 text-[10.5px] font-semibold cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/75 backdrop-blur-xs border border-white/25 text-white shadow-md">
                        {selectedProject.heroInscription && (
                          <p className="text-[11px] sm:text-xs font-medium italic leading-snug text-right break-words">
                            {selectedProject.heroInscription}
                          </p>
                        )}
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => {
                              setInscriptionDraft(selectedProject.heroInscription || '');
                              setEditingInscription(true);
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15 hover:bg-white/25 border border-white/25 text-white text-[10px] font-semibold cursor-pointer shrink-0"
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                            <span>{selectedProject.heroInscription ? 'Edit' : 'Add Inscription'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </figure>
          )}

          {selectedProject.mainContent && selectedProject.mainContent.trim() && (
            <div className="w-full p-4 sm:p-5 rounded-xl bg-white border border-[#cbd5e1] shadow-2xs space-y-2">
              <div
                className="fesline-rich-project max-w-full overflow-x-hidden space-y-2 text-xs sm:text-sm text-slate-800 leading-relaxed font-serif break-words [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-950 [&_h1]:pt-2 [&_h1]:pb-1 [&_h1]:border-b [&_h1]:border-slate-200 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-950 [&_h2]:pt-2 [&_h2]:pb-1 [&_h2]:border-b [&_h2]:border-slate-200 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-slate-950 [&_h3]:pt-1.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_blockquote]:border-y [&_blockquote]:border-slate-200 [&_blockquote]:py-2 [&_blockquote]:italic [&_blockquote]:text-slate-700 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:bg-slate-50 [&_pre]:border [&_pre]:border-slate-200 [&_pre]:overflow-x-auto [&_pre]:font-mono [&_pre]:text-[11px] [&_a]:text-cyan-800 [&_a]:underline [&_hr]:my-3 [&_hr]:border-slate-200"
                dangerouslySetInnerHTML={{
                  __html: sanitizeArticleHtml(
                    isRichHtmlContent(selectedProject.mainContent)
                      ? selectedProject.mainContent
                      : markdownToBasicHtml(selectedProject.mainContent)
                  ),
                }}
              />
            </div>
          )}

          {/* Overview, Objectives, Methodology, Results */}
          {(selectedProject.overview ||
            selectedProject.objectives ||
            selectedProject.methodology ||
            selectedProject.results) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {selectedProject.overview && (
                <div className="w-full p-4 rounded-xl bg-[#edf2f8]/65 border border-[#b8c6d4] shadow-2xs space-y-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-950 text-center border-b border-[#cbd5e1] pb-1.5">
                    Overview
                  </h2>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                    {selectedProject.overview}
                  </p>
                </div>
              )}

              {selectedProject.objectives && (
                <div className="w-full p-4 rounded-xl bg-[#edf2f8]/65 border border-[#b8c6d4] shadow-2xs space-y-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-950 text-center border-b border-[#cbd5e1] pb-1.5">
                    Objectives
                  </h2>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                    {selectedProject.objectives}
                  </p>
                </div>
              )}

              {selectedProject.methodology && (
                <div className="w-full p-4 rounded-xl bg-[#edf2f8]/65 border border-[#b8c6d4] shadow-2xs space-y-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-950 text-center border-b border-[#cbd5e1] pb-1.5">
                    Methodology
                  </h2>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                    {selectedProject.methodology}
                  </p>
                </div>
              )}

              {selectedProject.results && (
                <div className="w-full p-4 rounded-xl bg-[#edf2f8]/65 border border-[#b8c6d4] shadow-2xs space-y-1.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-cyan-950 text-center border-b border-[#cbd5e1] pb-1.5">
                    Results &amp; Findings
                  </h2>
                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                    {selectedProject.results}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Showcase PDFs — Multiple Clear Card Renderings */}
          {selectedProject.showcasePdfs && selectedProject.showcasePdfs.length > 0 && (
            <div className="p-4 rounded-xl bg-[#edf2f8]/60 border border-[#b8c6d4] space-y-3">
              <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-cyan-800" />
                <span>Showcase Project Documents ({selectedProject.showcasePdfs.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {selectedProject.showcasePdfs.map((pdf, idx) => (
                  <SharpAssetCard
                    key={idx}
                    item={pdf}
                    index={idx}
                    variant="pdf"
                    onOpenReader={(d) => setReaderDoc(d)}
                    onOpenLightbox={(src, title, downloadUrl) =>
                      setLightbox({ src, title, downloadUrl })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Showcase Images — Side-Scrolling View Gallery */}
          {showcaseGalleryItems.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 border border-[#cbd5e1] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-slate-950 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-800" />
                  <span>Showcase Gallery ({showcaseGalleryItems.length})</span>
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => scrollShowcaseGallery('left')}
                    aria-label="Scroll showcase gallery left"
                    className="w-7 h-7 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollShowcaseGallery('right')}
                    aria-label="Scroll showcase gallery right"
                    className="w-7 h-7 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div
                ref={showcaseTrackRef}
                data-testid="showcase-side-scroll-gallery"
                className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
              >
                {showcaseGalleryItems.map((img, i) => {
                  const fullSrc = img.jpegUrl || img.webpUrl || img.url;
                  return (
                    <div
                      key={i}
                      className="min-w-[240px] sm:min-w-[290px] md:min-w-[320px] max-w-[340px] shrink-0 snap-start rounded-xl bg-white border border-[#b8c6d4] overflow-hidden shadow-2xs flex flex-col"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setLightbox({
                            src: fullSrc,
                            title: img.title || `Showcase Image ${i + 1}`,
                            downloadUrl: img.url,
                          })
                        }
                        className="relative w-full aspect-[4/3] bg-slate-100 overflow-hidden cursor-pointer group"
                      >
                        <img
                          src={fullSrc}
                          alt={img.title || `Showcase Image ${i + 1}`}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover object-center transition-transform duration-200 group-hover:scale-[1.03]"
                        />
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950/75 text-white text-[10px] font-semibold">
                          <Maximize2 className="w-3 h-3" />
                          <span>Zoom</span>
                        </span>
                      </button>
                      {(img.title || (img.note && img.note.trim())) && (
                        <div className="p-2.5 space-y-1 text-xs">
                          {img.title && (
                            <p className="font-bold text-slate-900 truncate">{img.title}</p>
                          )}
                          {img.note && img.note.trim() && (
                            <p className="text-[11px] text-slate-600 text-justify leading-relaxed">
                              {img.note.trim()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Specifications Table */}
          {selectedProject.specifications.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 border border-[#cbd5e1] space-y-2.5">
              <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center uppercase tracking-wider">
                Technical Specifications
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {selectedProject.specifications.map((spec, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-2xs"
                  >
                    <span className="font-bold text-slate-700 shrink-0">{spec.label}</span>
                    <span className="text-slate-950 font-medium text-right break-words">{spec.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tools Used */}
          {selectedProject.toolsUsed.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-center">
              <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-cyan-800" />
                <span>Tools Used</span>
              </h2>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-slate-800 font-semibold">
                {selectedProject.toolsUsed.map((tool, i) => (
                  <React.Fragment key={i}>
                    <span>{tool}</span>
                    {i < selectedProject.toolsUsed.length - 1 && (
                      <span aria-hidden="true" className="text-slate-300">·</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* CAD Drawings — Sharp Rendering Cards Only (3D CAD Preset Completely Removed) */}
          {selectedProject.cadDrawings.length > 0 && (
            <div className="p-4 rounded-xl bg-[#edf2f8]/60 border border-[#b8c6d4] space-y-3">
              <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-800" />
                <span>CAD Drawings ({selectedProject.cadDrawings.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedProject.cadDrawings.map((cad, idx) => (
                  <SharpAssetCard
                    key={idx}
                    item={cad}
                    index={idx}
                    variant="cad"
                    onOpenReader={(d) => setReaderDoc(d)}
                    onOpenLightbox={(src, title, downloadUrl) =>
                      setLightbox({ src, title, downloadUrl })
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular Project Images Media Gallery */}
          {regularImages.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-cyan-800" />
                <span>Media Gallery</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
                {regularImages.map((img, i) => {
                  const avifSrcSet =
                    img.mobileUrl && img.avifUrl && img.mobileUrl !== img.avifUrl
                      ? `${img.mobileUrl} 768w, ${img.avifUrl} 1600w`
                      : img.avifUrl;
                  return (
                    <div key={i} className="w-full flex flex-col gap-2">
                      <div
                        onClick={() =>
                          setLightbox({
                            src: img.jpegUrl || img.url,
                            title: img.title || `Project Image ${i + 1}`,
                            downloadUrl: img.url,
                          })
                        }
                        className={`${getContainerWidthClassForAspect(imageCardControls.aspectRatio, 'gallery')} max-h-[280px] rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center cursor-pointer`}
                        style={{
                          aspectRatio: (imageCardControls.aspectRatio || '4/3').replace(':', '/'),
                        }}
                      >
                        <picture className="w-full h-full flex items-center justify-center overflow-hidden">
                          {avifSrcSet && (
                            <source
                              srcSet={avifSrcSet}
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              type="image/avif"
                            />
                          )}
                          {img.webpUrl && <source srcSet={img.webpUrl} type="image/webp" />}
                          <img
                            src={img.jpegUrl || img.url}
                            alt={img.note || img.title || `Project Image ${i + 1}`}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            style={getMediaImgStyle(imageCardControls)}
                            className={`w-full h-full ${getImageFitClass(imageCardControls.objectFit)} block transition-transform duration-200`}
                          />
                        </picture>
                      </div>
                      {img.note && img.note.trim() && (
                        <div className="w-full rounded-lg border border-[#cbd5e1] bg-[#edf2f8]/75 px-3 py-2 text-[11px] text-slate-700 text-justify leading-relaxed shadow-2xs">
                          {img.note.trim()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Videos Gallery */}
          {selectedProject.videos.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-cyan-800" />
                <span>Project Videos</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
                {selectedProject.videos.map((vid, i) => (
                  <div key={i} className="w-full flex flex-col gap-2">
                    <div className="w-full rounded-lg border border-slate-200 bg-slate-950 overflow-hidden">
                      <CleanVideoPlayer
                        src={vid.url}
                        poster={vid.posterUrl}
                        av1Urls={vid.av1Urls}
                        h264Urls={vid.h264Urls}
                        vttThumbnailsUrl={vid.vttThumbnailsUrl}
                        subtitleUrl={vid.subtitleUrl}
                        mediaId={vid.mediaAssetId || vid.url}
                        title={vid.title || selectedProject.title}
                        aspectRatio={videoCardControls.aspectRatio || '16/9'}
                        objectFit={videoCardControls.objectFit || 'contain'}
                        zoomLevel={videoCardControls.zoomLevel || 1}
                      />
                    </div>
                    {vid.note && vid.note.trim() && (
                      <div className="w-full rounded-lg border border-[#cbd5e1] bg-[#edf2f8]/75 px-3 py-2 text-[11px] text-slate-700 text-justify leading-relaxed shadow-2xs">
                        {vid.note.trim()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Downloadable Technical Documents & Demonstration Links */}
          {(selectedProject.documents.length > 0 || selectedProject.demoLinks.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              {selectedProject.documents.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <h2 className="text-xs font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-800" />
                    <span>Technical Documents</span>
                  </h2>
                  <div className="space-y-1.5">
                    {selectedProject.documents.map((docItem, i) => (
                      <a
                        key={i}
                        href={docItem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-cyan-700 text-xs text-slate-800"
                      >
                        <span className="truncate font-semibold">{docItem.title || docItem.fileName}</span>
                        <Download className="w-3.5 h-3.5 text-cyan-800 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedProject.demoLinks.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <h2 className="text-xs font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-cyan-800" />
                    <span>Demonstration Links</span>
                  </h2>
                  <div className="space-y-1.5">
                    {selectedProject.demoLinks.map((lnk, i) => (
                      <a
                        key={i}
                        href={lnk.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-cyan-700 text-xs text-cyan-900 font-semibold"
                      >
                        <span className="truncate">{lnk.label || lnk.url}</span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Interactive Reader Modal for Showcase PDFs / PDF CAD Sheets */}
        {readerDoc && (
          <DocumentReaderModal doc={readerDoc} onClose={() => setReaderDoc(null)} />
        )}

        {/* High-Resolution Image / Drawing Lightbox Modal */}
        {lightbox && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
            onClick={() => setLightbox(null)}
          >
            <div
              className="relative max-w-5xl w-full max-h-[92vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#edf2f8] border-b border-slate-200 text-xs">
                <span className="font-bold text-slate-900 truncate">{lightbox.title}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {lightbox.downloadUrl && (
                    <a
                      href={lightbox.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] font-semibold"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setLightbox(null)}
                    aria-label="Close lightbox"
                    className="w-7 h-7 rounded-md bg-white border border-slate-300 hover:bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-slate-100 p-3 flex items-center justify-center">
                <img
                  src={lightbox.src}
                  alt={lightbox.title}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[78vh] object-contain rounded shadow-sm bg-white"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MAIN PROJECTS PAGE
  // =========================================================================
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16 space-y-5 font-serif text-slate-900">
      {/* Page Heading */}
      <div className="max-w-xs mx-auto px-4 py-2 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs text-center">
        <h1 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight text-center">
          Engineering Portfolio
        </h1>
      </div>

      {/* Toolbar: Search + Category + Scope + Sort + "+New" button */}
      <div className="p-3 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs space-y-2 text-xs">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 flex-1 min-w-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 sm:flex-initial min-w-0 max-w-[150px] px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-medium cursor-pointer truncate"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All Categories' : cat}
                </option>
              ))}
            </select>

            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value as 'All' | ProjectScope)}
              className="flex-1 sm:flex-initial min-w-0 max-w-[130px] px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-medium cursor-pointer truncate"
            >
              {PROJECT_SCOPE_FILTERS.map((sc) => (
                <option key={sc} value={sc}>
                  {sc === 'All' ? 'All Scopes' : sc}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 sm:flex-initial min-w-0 max-w-[130px] px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-medium cursor-pointer"
            >
              <option value="featured">Featured First</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title A–Z</option>
            </select>
          </div>

          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setEditingProject(null);
                setIsFormOpen(!isFormOpen);
              }}
              className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-[11px] font-semibold cursor-pointer shrink-0 whitespace-nowrap"
            >
              <span>+New</span>
            </button>
          )}
        </div>
      </div>

      {/* Owner New/Edit Project Form */}
      {isOwner && isFormOpen && (
        <ProjectFormPanel
          initialProject={editingProject}
          isOwner={isOwner}
          activeCategories={activeUploadCategories}
          onSaved={(saved) => {
            setProjects((prev) => {
              const filtered = prev.filter((p) => p.id !== saved.id);
              return [saved, ...filtered];
            });
            setIsFormOpen(false);
            setEditingProject(null);
          }}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingProject(null);
          }}
        />
      )}

      {/* Custom Content Sections configured via Admin Dashboard */}
      {visibleCustomSections.length > 0 && (
        <div className="space-y-3">
          {visibleCustomSections.map((sec) => (
            <div
              key={sec.id}
              className={`p-4 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs space-y-1.5 ${
                sec.textAlign === 'left'
                  ? 'text-left'
                  : sec.textAlign === 'right'
                  ? 'text-right'
                  : 'text-center'
              }`}
            >
              {sec.badgeText && (
                <span className="inline-block px-2 py-0.5 rounded bg-cyan-100 border border-cyan-300 text-cyan-900 text-[10px] font-bold">
                  {sec.badgeText}
                </span>
              )}
              <h2 className="text-sm font-bold text-slate-950">{sec.title}</h2>
              {sec.subtitle && <p className="text-[11px] text-cyan-900 font-semibold">{sec.subtitle}</p>}
              {sec.body && (
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{sec.body}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Unified Projects Grid (One Card Per Published Project — Zero Duplicates) */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={`proj-skel-${n}`} className="rounded-xl bg-white border border-[#b8c6d4] overflow-hidden animate-pulse">
              <div className="w-full aspect-[16/10] bg-slate-200" />
              <div className="p-4 space-y-2.5">
                <div className="h-3 bg-slate-200 rounded w-1/3" />
                <div className="h-4 bg-slate-200 rounded w-5/6" />
                <div className="h-3 bg-slate-100 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="p-8 rounded-xl bg-white/80 border border-dashed border-[#b8c6d4] text-center space-y-2">
          <p className="text-xs text-slate-600">No projects published yet.</p>
        </div>
      ) : (() => {
        const gridColsClass =
          innerLayout.gridColumns === 2
            ? 'grid-cols-1 sm:grid-cols-2'
            : innerLayout.gridColumns === 4
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
        const gapClass =
          innerLayout.cardSpacing === 'compact'
            ? 'gap-3'
            : innerLayout.cardSpacing === 'relaxed'
            ? 'gap-6'
            : 'gap-4 sm:gap-5';
        const padClass =
          innerLayout.cardSpacing === 'compact'
            ? 'p-3.5'
            : innerLayout.cardSpacing === 'relaxed'
            ? 'p-5'
            : 'p-4';
        const textAlignClass =
          innerLayout.cardTextAlign === 'justify'
            ? 'text-justify'
            : innerLayout.cardTextAlign === 'center'
            ? 'text-center'
            : 'text-left';

        return (
          <div className={`grid ${gridColsClass} ${gapClass}`}>
            {filteredProjects.map((proj) => {
              const cardImg = resolveProjectCardImage(proj);
              const cardVid = !cardImg
                ? proj.videos?.[0]?.h264Urls?.['720p'] || proj.videos?.[0]?.url || ''
                : '';
              const isLiked = likedProjectIds.has(proj.id);

              return (
                <article
                  key={proj.id}
                  data-project-id={proj.id}
                  onClick={() => openProjectDetail(proj)}
                  className={`group rounded-xl bg-white border border-[#b8c6d4] hover:border-cyan-700 shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between ${cardAnimClass}`}
                >
                  <div className="flex flex-col flex-1">
                    <CardTopMedia
                      title={proj.title}
                      category={proj.category}
                      imageUrl={cardImg}
                      videoUrl={cardVid}
                      posterUrl={proj.videos?.[0]?.posterUrl}
                      variant="project"
                      layout="grid"
                      imageControls={imageCardControls}
                    />
                    <div className={`${padClass} flex-1 flex flex-col gap-2`}>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0 truncate">
                          <span className="font-semibold text-cyan-900 truncate">
                            {proj.category}
                          </span>
                          {proj.projectScope && (
                            <>
                              <span aria-hidden="true" className="text-slate-300 shrink-0">·</span>
                              <span className="text-slate-600 font-medium shrink-0">
                                {proj.projectScope}
                              </span>
                            </>
                          )}
                        </div>
                        {proj.status !== 'published' && (
                          <span className="text-[10.5px] text-amber-800 uppercase font-bold tracking-wide shrink-0">
                            {proj.status}
                          </span>
                        )}
                      </div>
                      <h3
                        className={`text-sm sm:text-[15px] font-bold text-slate-950 group-hover:text-cyan-900 transition-colors leading-snug line-clamp-2 ${textAlignClass}`}
                      >
                        {proj.title}
                      </h3>
                      {proj.description && (
                        <p className={`text-xs text-slate-600 line-clamp-2 sm:line-clamp-3 leading-relaxed ${textAlignClass}`}>
                          {proj.description}
                        </p>
                      )}
                      {proj.toolsUsed.length > 0 && (
                        <p
                          className={`text-[11px] font-mono text-slate-500 truncate mt-auto pt-1 ${textAlignClass}`}
                          title={proj.toolsUsed.join(', ')}
                        >
                          {proj.toolsUsed.slice(0, 3).join(' · ')}
                          {proj.toolsUsed.length > 3 ? ` · +${proj.toolsUsed.length - 3}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-4 py-2.5 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div className="flex items-center gap-2 min-w-0">
                      <LiveRelativeTime date={proj.createdAt} className="text-[11px] text-slate-500 truncate" />
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="inline-flex items-center gap-1 text-slate-600 font-semibold tabular-nums shrink-0" title="Real-time views">
                        <Eye className="w-3.5 h-3.5 text-cyan-800" />
                        <span>{proj.viewsCount || 0}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleProjectLike(proj);
                        }}
                        aria-label={isLiked ? 'Unlike project' : 'Like project'}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer ${
                          isLiked
                            ? 'bg-rose-50 border-rose-300 text-rose-700'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-rose-50/50 hover:border-rose-200'
                        }`}
                      >
                        <Heart className={`w-3 h-3 ${isLiked ? 'fill-rose-600 text-rose-600' : ''}`} />
                        <span className="tabular-nums">{proj.likesCount || 0}</span>
                      </button>
                      <span className="text-cyan-900 font-bold group-hover:translate-x-0.5 transition-transform">
                        Explore →
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
};
