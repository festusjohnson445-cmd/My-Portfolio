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
import {
  getContainerWidthClassForAspect,
  getImageFitClass,
  getMediaImgStyle,
} from '../utils/mediaCardStyle';

export const ProjectsView: React.FC = () => {
  const { isOwner } = useProfileSync();
  const websiteSettings = useWebsiteSettingsSync();
  const { projectsArticlesConfig, cardAnimationEnabled } = websiteSettings.appearanceConfig;
  const { customSections, innerLayout, videoCardControls } = projectsArticlesConfig;
  const imageCardControls = projectsArticlesConfig.imageCardControls || {
    aspectRatio: '4/3' as const,
    objectFit: 'contain' as const,
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
  const [loading, setLoading] = useState(() => !hasProjectsCacheHydrated() && getCachedProjects(isOwner).length === 0);
  const [selectedProject, setSelectedProject] = useState<PortfolioProject | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PortfolioProject | null>(null);
  const [editingInscription, setEditingInscription] = useState(false);
  const [inscriptionDraft, setInscriptionDraft] = useState('');
  const [savingInscription, setSavingInscription] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'title' | 'featured'>('featured');

  const loadProjects = async () => {
    if (!hasProjectsCacheHydrated() && projects.length === 0) {
      setLoading(true);
    }
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
      if ((isOwner || p.status === 'published') && p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [projects, isOwner]);

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
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
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
      if (selectedProject?.id === proj.id) setSelectedProject(null);
    } catch (err) {
      console.error(err);
    }
  };

  const openProjectDetail = (proj: PortfolioProject) => {
    setIsFormOpen(false);
    setEditingProject(null);
    setEditingInscription(false);
    setInscriptionDraft(proj.heroInscription || '');
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
            onClick={() => setSelectedProject(null)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          {isOwner && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditingProject(selectedProject);
                  setIsFormOpen(true);
                  setSelectedProject(null);
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
            </div>
          )}
        </div>

        {/* Project Detail Header */}
        <div className="w-full bg-white border border-[#b8c6d4] rounded-2xl p-3.5 sm:p-5 shadow-xs space-y-3">
          <div className="text-center space-y-1.5 border-b border-slate-200 pb-3">
            {selectedProject.isFeatured && (
              <div className="flex items-center justify-center">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] font-bold">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span>Featured</span>
                </span>
              </div>
            )}
            <h1 className="text-lg sm:text-2xl font-bold text-slate-950 text-center">
              {selectedProject.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 max-w-4xl mx-auto leading-relaxed">
              {selectedProject.description}
            </p>
            <div className="flex items-center justify-center gap-3 text-[11px] text-slate-500 pt-0.5">
              <span className="px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-900 font-semibold">
                {selectedProject.category}
              </span>
              <span className="inline-flex items-center gap-1 text-slate-600 font-semibold">
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

          {/* Overview, Objectives, Methodology, Results */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {selectedProject.overview && (
              <div className="w-full p-3.5 rounded-xl bg-[#edf2f8]/60 border border-[#cbd5e1] space-y-1">
                <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center border-b border-slate-200 pb-1">
                  Overview
                </h2>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                  {selectedProject.overview}
                </p>
              </div>
            )}

            {selectedProject.objectives && (
              <div className="w-full p-3.5 rounded-xl bg-[#edf2f8]/60 border border-[#cbd5e1] space-y-1">
                <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center border-b border-slate-200 pb-1">
                  Objectives
                </h2>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                  {selectedProject.objectives}
                </p>
              </div>
            )}

            {selectedProject.methodology && (
              <div className="w-full p-3.5 rounded-xl bg-[#edf2f8]/60 border border-[#cbd5e1] space-y-1">
                <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center border-b border-slate-200 pb-1">
                  Methodology
                </h2>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                  {selectedProject.methodology}
                </p>
              </div>
            )}

            {selectedProject.results && (
              <div className="w-full p-3.5 rounded-xl bg-[#edf2f8]/60 border border-[#cbd5e1] space-y-1">
                <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center border-b border-slate-200 pb-1">
                  Results &amp; Findings
                </h2>
                <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify">
                  {selectedProject.results}
                </p>
              </div>
            )}
          </div>

          {/* Specifications Table */}
          {selectedProject.specifications.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-950 text-center">
                Technical Specifications
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {selectedProject.specifications.map((spec, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-white border border-slate-200"
                  >
                    <span className="font-bold text-slate-700">{spec.label}</span>
                    <span className="text-slate-900">{spec.value}</span>
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
        <div className="space-y-2.5">
          <h2 className="text-xs sm:text-sm font-bold text-slate-900 text-center uppercase tracking-wider">
            Featured Projects
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {featuredProjects.slice(0, 2).map((proj) => {
              const featImg = proj.thumbnailUrl || proj.images?.[0]?.url || '';
              const featVid = !featImg
                ? proj.videos?.[0]?.h264Urls?.['720p'] || proj.videos?.[0]?.url || ''
                : '';
              return (
              <div
                key={`feat-${proj.id}`}
                onClick={() => openProjectDetail(proj)}
                className="rounded-xl bg-white border border-[#b8c6d4] hover:border-cyan-700 shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col sm:flex-row"
              >
                {featImg ? (
                  <div className="w-full sm:w-52 h-40 sm:h-auto sm:min-h-[168px] bg-slate-100 border-b sm:border-b-0 sm:border-r border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                    <img
                      src={featImg}
                      alt={proj.title}
                      loading="lazy"
                      decoding="async"
                      style={getMediaImgStyle(imageCardControls)}
                      className={`w-full h-full ${getImageFitClass(imageCardControls.objectFit)} block transition-transform duration-200`}
                    />
                  </div>
                ) : featVid ? (
                  <div className="relative w-full sm:w-52 aspect-video sm:aspect-auto sm:min-h-[168px] bg-slate-950 border-b sm:border-b-0 sm:border-r border-slate-200 shrink-0 overflow-hidden">
                    {proj.videos?.[0]?.posterUrl ? (
                      <img
                        src={proj.videos[0].posterUrl}
                        alt={proj.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover block"
                      />
                    ) : (
                      <video
                        src={featVid}
                        preload="none"
                        muted
                        playsInline
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20">
                      <span className="w-8 h-8 rounded-full bg-slate-950/75 border border-white/30 flex items-center justify-center text-white shadow-sm">
                        <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                      </span>
                    </div>
                  </div>
                ) : null}
                <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-900 font-bold">
                        {proj.category}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-amber-700 font-bold">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span>Featured</span>
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-950 text-center">{proj.title}</h3>
                    <p className="text-[11px] text-slate-600 line-clamp-2 text-justify leading-relaxed">
                      {proj.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <div className="flex items-center gap-2.5 text-slate-500">
                      <LiveRelativeTime date={proj.createdAt} className="text-[9px] text-slate-500" />
                      <span className="inline-flex items-center gap-1 text-slate-600 font-semibold" title="Views">
                        <Eye className="w-3 h-3 text-cyan-800" />
                        <span className="tabular-nums">{proj.viewsCount || 0}</span>
                      </span>
                    </div>
                    <span className="text-cyan-800 font-semibold">View →</span>
                  </div>
                </div>
              </div>
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
        <div className="p-8 text-center text-xs text-slate-500">Loading portfolio...</div>
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
            ? 'gap-2.5'
            : innerLayout.cardSpacing === 'relaxed'
            ? 'gap-6'
            : 'gap-4';
        const padClass =
          innerLayout.cardSpacing === 'compact'
            ? 'p-2.5'
            : innerLayout.cardSpacing === 'relaxed'
            ? 'p-5'
            : 'p-3.5';
        const descAlignClass =
          innerLayout.cardTextAlign === 'left'
            ? 'text-left'
            : innerLayout.cardTextAlign === 'center'
            ? 'text-center'
            : 'text-justify';

        return (
          <div className={`grid ${gridColsClass} ${gapClass}`}>
            {filteredProjects.map((proj) => {
              const cardImg = proj.thumbnailUrl || proj.images?.[0]?.url || '';
              const cardVid = !cardImg
                ? proj.videos?.[0]?.h264Urls?.['720p'] || proj.videos?.[0]?.url || ''
                : '';
              return (
              <article
                key={proj.id}
                onClick={() => openProjectDetail(proj)}
                className={`rounded-xl bg-white border border-[#b8c6d4] hover:border-cyan-700 shadow-xs hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col justify-between ${cardAnimClass}`}
              >
                <div>
                  {cardImg ? (
                    <div
                      className="w-full max-h-[240px] bg-slate-100 border-b border-slate-200 overflow-hidden flex items-center justify-center"
                      style={{
                        aspectRatio: (imageCardControls.aspectRatio || '4/3').replace(':', '/'),
                      }}
                    >
                      <img
                        src={cardImg}
                        alt={proj.title}
                        loading="lazy"
                        decoding="async"
                        style={getMediaImgStyle(imageCardControls)}
                        className={`w-full h-full ${getImageFitClass(imageCardControls.objectFit)} block transition-transform duration-200`}
                      />
                    </div>
                  ) : cardVid ? (
                    <div className="relative w-full aspect-video bg-slate-950 overflow-hidden border-b border-slate-200">
                      {proj.videos?.[0]?.posterUrl ? (
                        <img
                          src={proj.videos[0].posterUrl}
                          alt={proj.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover block"
                        />
                      ) : (
                        <video
                          src={cardVid}
                          preload="none"
                          muted
                          playsInline
                          className="w-full h-full object-contain pointer-events-none"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20">
                        <span className="w-9 h-9 rounded-full bg-slate-950/75 border border-white/30 flex items-center justify-center text-white shadow-sm">
                          <Play className="w-4 h-4 fill-white ml-0.5" />
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div className={`${padClass} space-y-2`}>
                    <div className="flex items-center justify-between gap-1.5 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-900 font-bold">
                        {proj.category}
                      </span>
                      {proj.status !== 'published' && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 uppercase font-bold">
                          {proj.status}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-950 text-center leading-snug">
                      {proj.title}
                    </h3>
                    <p className={`text-[11px] text-slate-600 line-clamp-3 leading-relaxed ${descAlignClass}`}>
                      {proj.description}
                    </p>
                  </div>
                </div>

                <div className="px-3.5 pb-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                  <div className="flex items-center gap-2.5">
                    <LiveRelativeTime date={proj.createdAt} className="text-[9px] text-slate-500" />
                    <span className="inline-flex items-center gap-1 text-slate-600 font-semibold" title="Views">
                      <Eye className="w-3 h-3 text-cyan-800" />
                      <span className="tabular-nums">{proj.viewsCount || 0}</span>
                    </span>
                  </div>
                  <span className="text-cyan-900 font-bold shrink-0">View →</span>
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
