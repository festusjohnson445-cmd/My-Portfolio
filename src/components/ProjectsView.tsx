import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Download,
  ExternalLink,
  ArrowLeft,
  Star,
  FileText,
  Layers,
  Image as ImageIcon,
  Video,
  Wrench,
  Edit3,
  Trash2,
  Play,
  Check,
  X,
  Eye,
  Share2,
} from 'lucide-react';
import {
  fetchProjectsFromSupabase,
  deleteProjectFromSupabase,
  updateProjectHeroInscription,
  incrementProjectViewsInSupabase,
  subscribeToProjectsRealtime,
  useWebsiteSettingsSync,
  getCachedProjects,
  hasProjectsCacheHydrated,
  EVENT_PROJECTS_UPDATED,
  type PortfolioProject,
} from '../utils/portfolioSupabase';
import { useProfileSync } from '../utils/profileState';
import { Interactive3DViewer } from './Interactive3DViewer';
import { ProjectFormPanel } from './ProjectFormPanel';
import { CleanVideoPlayer } from './CleanVideoPlayer';
import { LiveRelativeTime } from './LiveRelativeTime';
import { CardTopMedia } from './CardTopMedia';
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

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PortfolioProject | null>(null);
  const [editingInscription, setEditingInscription] = useState(false);
  const [inscriptionDraft, setInscriptionDraft] = useState('');
  const [savingInscription, setSavingInscription] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'featured'>('featured');

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
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
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
  }, [projects, isOwner, selectedCategory, searchQuery, sortBy]);

  const featuredProjects = useMemo(
    () => filteredProjects.filter((p) => p.isFeatured),
    [filteredProjects]
  );

  const handleDelete = async (proj: PortfolioProject) => {
    try {
      await deleteProjectFromSupabase(proj.id);
      setProjects((prev) => prev.filter((p) => p.id !== proj.id));
      if (selectedProject?.id === proj.id) closeProjectDetail();
    } catch (err) {
      console.error(err);
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

  // =========================================================================
  // PROJECT DETAIL VIEW
  // =========================================================================
  if (selectedProject) {
    return (
      <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-4 pb-12 space-y-3 font-serif text-slate-900">
        {/* Back + Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#edf2f8] border border-[#b8c6d4] rounded-xl px-3 py-2 shadow-2xs">
          <button
            type="button"
            onClick={closeProjectDetail}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <div className="flex flex-wrap items-center gap-1.5">
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
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
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
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  <Edit3 className="w-3 h-3 text-cyan-800" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(selectedProject)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Project Detail Header */}
        <div className="w-full bg-white border border-[#b8c6d4] rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3.5">
          <div className="text-center space-y-2 border-b border-slate-200 pb-3.5">
            {selectedProject.isFeatured && (
              <div className="flex items-center justify-center">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] font-bold">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span>Featured Project</span>
                </span>
              </div>
            )}
            <h1 className="text-lg sm:text-2xl font-bold text-slate-950 text-center leading-snug">
              {selectedProject.title}
            </h1>
            {selectedProject.description && (
              <p className="text-xs sm:text-sm text-slate-600 max-w-4xl mx-auto leading-relaxed">
                {selectedProject.description}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2.5 text-[11px] text-slate-600 pt-1">
              <span className="px-2.5 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-950 font-bold">
                {selectedProject.category}
              </span>
              <span className="text-slate-300">·</span>
              <LiveRelativeTime date={selectedProject.createdAt} className="text-[11px] text-slate-500 font-medium" />
              <span className="text-slate-300">·</span>
              <span className="inline-flex items-center gap-1 text-slate-700 font-semibold" title="Real-time views">
                <Eye className="w-3.5 h-3.5 text-cyan-800" />
                <span className="tabular-nums">{selectedProject.viewsCount || 0}</span>
                <span>views</span>
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
                className="fesline-rich-project max-w-full overflow-x-hidden space-y-2 text-xs sm:text-sm text-slate-800 leading-relaxed font-serif break-words [&_h1]:text-lg [&_h1]:font-bold [&_h1]:text-slate-950 [&_h1]:pt-2 [&_h1]:pb-1 [&_h1]:border-b [&_h1]:border-slate-200 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-slate-950 [&_h2]:pt-2 [&_h2]:pb-1 [&_h2]:border-b [&_h2]:border-slate-200 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:text-slate-950 [&_h3]:pt-1.5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-1 [&_blockquote]:border-l-3 [&_blockquote]:border-cyan-700 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-slate-700 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:bg-slate-50 [&_pre]:border [&_pre]:border-slate-200 [&_pre]:overflow-x-auto [&_pre]:font-mono [&_pre]:text-[11px] [&_a]:text-cyan-800 [&_a]:underline [&_hr]:my-3 [&_hr]:border-slate-200"
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
              <div className="flex flex-wrap justify-center gap-1.5">
                {selectedProject.toolsUsed.map((tool, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-0.5 rounded-md bg-white border border-slate-300 text-xs text-slate-800 font-semibold"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* CAD Drawings & Optional Interactive 3D CAD */}
          {(selectedProject.isCadProject || selectedProject.cadDrawings.length > 0) && (
            <div className="p-4 rounded-xl bg-[#edf2f8]/60 border border-[#b8c6d4] space-y-3">
              <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-800" />
                <span>CAD Drawings &amp; Engineering Models</span>
              </h2>

              {selectedProject.cadModelType && (
                <Interactive3DViewer modelType={selectedProject.cadModelType} />
              )}

              {selectedProject.cadDrawings.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedProject.cadDrawings.map((cad, idx) => {
                    const isImg = /\.(png|jpe?g|webp|gif|svg)$/i.test(cad.url || cad.fileName || '');
                    return (
                      <div key={idx} className="p-3 rounded-lg bg-white border border-slate-200 space-y-2 text-xs">
                        {isImg && (
                          <img
                            src={cad.url}
                            alt={cad.title}
                            className="w-full h-44 object-contain rounded border border-slate-100 bg-slate-50"
                          />
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-900 truncate">
                            {(cad.title && !/^\d+$/.test(cad.title.trim()) ? cad.title : '') ||
                              (cad.fileName && !/^\d+(\.[^/.]+)?$/.test(cad.fileName.trim()) ? cad.fileName : 'CAD File')}
                          </span>
                          <a
                            href={cad.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            download
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] font-semibold shrink-0"
                          >
                            <Download className="w-3 h-3" />
                            <span>CAD File</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Images Media Gallery (Full uploaded image + separate note div below each image) */}
          {selectedProject.images.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-cyan-800" />
                <span>Media Gallery</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
                {selectedProject.images.map((img, i) => {
                  const avifSrcSet = img.mobileUrl && img.avifUrl && img.mobileUrl !== img.avifUrl
                    ? `${img.mobileUrl} 768w, ${img.avifUrl} 1600w`
                    : img.avifUrl;
                  return (
                    <div key={i} className="w-full flex flex-col gap-2">
                      <div
                        className={`${getContainerWidthClassForAspect(imageCardControls.aspectRatio, 'gallery')} max-h-[280px] rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center`}
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

          {/* Videos Gallery (Vidstack video player + separate note div below each video) */}
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
      </div>
    );
  }

  // =========================================================================
  // MAIN PROJECTS PAGE
  // =========================================================================
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16 space-y-5 font-serif text-slate-900">
      {/* Small, well-designed div container for heading ONLY (no subtext) */}
      <div className="max-w-xs mx-auto px-4 py-2 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs text-center">
        <h1 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight text-center">
          Engineering Portfolio
        </h1>
      </div>

      {/* Toolbar: Search on single row, Filter/Sort/New Project fitted on next row */}
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
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 sm:flex-initial min-w-0 max-w-[160px] px-2 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-medium cursor-pointer truncate"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'All' ? 'All' : cat}
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

          {/* Small "New Project" button visible ONLY to authenticated owner */}
          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setEditingProject(null);
                setIsFormOpen(!isFormOpen);
              }}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-[11px] font-semibold cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>New Project</span>
            </button>
          )}
        </div>
      </div>

      {/* Owner New/Edit Project Structured Form */}
      {isOwner && isFormOpen && (
        <ProjectFormPanel
          initialProject={editingProject}
          isOwner={isOwner}
          activeCategories={activeUploadCategories}
          onSaved={(saved) => {
            setProjects((prev) => {
              const exists = prev.some((p) => p.id === saved.id);
              return exists ? prev.map((p) => (p.id === saved.id ? saved : p)) : [saved, ...prev];
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

      {/* Featured Projects Strip (Only rendered when featured projects exist in Supabase) */}
      {featuredProjects.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 text-center uppercase tracking-wider">
            Featured Projects
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {featuredProjects.slice(0, 2).map((proj) => {
              const featImg =
                proj.thumbnailUrl ||
                proj.images?.[0]?.jpegUrl ||
                proj.images?.[0]?.webpUrl ||
                proj.images?.[0]?.url ||
                proj.cadDrawings?.[0]?.url ||
                '';
              const featVid = !featImg
                ? proj.videos?.[0]?.h264Urls?.['720p'] || proj.videos?.[0]?.url || ''
                : '';
              return (
                <article
                  key={`feat-${proj.id}`}
                  onClick={() => openProjectDetail(proj)}
                  className={`group rounded-xl bg-white border border-[#b8c6d4] hover:border-cyan-700 shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col sm:flex-row ${cardAnimClass}`}
                >
                  <CardTopMedia
                    title={proj.title}
                    category={proj.category}
                    imageUrl={featImg}
                    videoUrl={featVid}
                    posterUrl={proj.videos?.[0]?.posterUrl}
                    variant="project"
                    layout="featured"
                    isCad={proj.isCadProject}
                    imageControls={imageCardControls}
                  />
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3 min-w-0">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-cyan-900 truncate">{proj.category}</span>
                        <span className="inline-flex items-center gap-1 text-amber-700 font-semibold shrink-0">
                          <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                          <span>Featured</span>
                        </span>
                      </div>
                      <h3 className="text-sm sm:text-[15px] font-bold text-slate-950 group-hover:text-cyan-900 transition-colors leading-snug line-clamp-2 text-left">
                        {proj.title}
                      </h3>
                      {proj.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 sm:line-clamp-3 text-left leading-relaxed">
                          {proj.description}
                        </p>
                      )}
                      {proj.toolsUsed.length > 0 && (
                        <p className="text-[11px] font-mono text-slate-500 truncate pt-0.5 text-left">
                          {proj.toolsUsed.slice(0, 3).join(' · ')}
                          {proj.toolsUsed.length > 3 ? ` · +${proj.toolsUsed.length - 3}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-[11px]">
                      <div className="flex items-center gap-2 text-slate-500">
                        <LiveRelativeTime date={proj.createdAt} className="text-[11px] text-slate-500" />
                        <span aria-hidden="true" className="text-slate-300">·</span>
                        <span className="inline-flex items-center gap-1 text-slate-600 font-semibold tabular-nums" title="Real-time views">
                          <Eye className="w-3.5 h-3.5 text-cyan-800" />
                          <span>{proj.viewsCount || 0}</span>
                        </span>
                      </div>
                      <span className="text-cyan-900 font-bold group-hover:translate-x-0.5 transition-transform">
                        View →
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
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

      {/* Projects Grid — Completely empty when no rows exist in Supabase */}
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
          innerLayout.cardTextAlign === 'center' ? 'text-center' : 'text-left';

        return (
          <div className={`grid ${gridColsClass} ${gapClass}`}>
            {filteredProjects.map((proj) => {
              const cardImg =
                proj.thumbnailUrl ||
                proj.images?.[0]?.jpegUrl ||
                proj.images?.[0]?.webpUrl ||
                proj.images?.[0]?.url ||
                proj.cadDrawings?.[0]?.url ||
                '';
              const cardVid = !cardImg
                ? proj.videos?.[0]?.h264Urls?.['720p'] || proj.videos?.[0]?.url || ''
                : '';
              return (
                <article
                  key={proj.id}
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
                      isCad={proj.isCadProject}
                      imageControls={imageCardControls}
                    />
                    <div className={`${padClass} flex-1 flex flex-col gap-2`}>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-cyan-900 truncate">
                          {proj.category}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0 text-[10.5px]">
                          {proj.isFeatured && (
                            <span className="inline-flex items-center gap-0.5 text-amber-700 font-semibold">
                              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                              <span>Featured</span>
                            </span>
                          )}
                          {proj.status !== 'published' && (
                            <span className="text-amber-800 uppercase font-bold tracking-wide">
                              {proj.status}
                            </span>
                          )}
                        </div>
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
                    <span className="text-cyan-900 font-bold shrink-0 group-hover:translate-x-0.5 transition-transform">
                      Explore →
                    </span>
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
