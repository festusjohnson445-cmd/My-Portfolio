import React, { useRef, useState } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  Link as LinkIcon,
  RotateCcw,
  Play,
  FileText,
  Image as ImageIcon,
  Layers,
} from 'lucide-react';
import {
  uploadFileToBucket,
  upsertProjectToSupabase,
  formatBytes,
  isAbortError,
  validateVideoSizeLimit,
  MAX_VIDEO_MB,
  isOptimizableVideo,
  type PortfolioProject,
  type ProjectSpecification,
  type ProjectScope,
  type ProjectFormFormat,
  type MediaAssetItem,
  type LinkItem,
  type BucketFileItem,
} from '../utils/portfolioSupabase';
import { cleanDisplayFileName, runWithConcurrency } from '../utils/mediaMetadata';
import { generateCrispDocumentThumbnail } from '../utils/documentParser';
import { MediaLibraryModal, type MediaLibraryFilter } from './MediaLibraryModal';
import { CleanVideoPlayer } from './CleanVideoPlayer';
import { RichTextEditor } from './RichTextEditor';
import { isRichHtmlContent, sanitizeArticleHtml } from '../utils/htmlSanitizer';

interface ProjectFormPanelProps {
  initialProject?: PortfolioProject | null;
  isOwner?: boolean;
  activeCategories?: string[];
  onSaved: (saved: PortfolioProject) => void;
  onCancel: () => void;
}

type UploadTarget =
  | 'thumbnail'
  | 'image'
  | 'video'
  | 'cad'
  | 'document'
  | 'showcase_pdf'
  | 'showcase_image';

const PROJECT_SCOPES: ProjectScope[] = ['Personal', 'Industrial', 'Academic', 'Global'];

const isSupabaseStorageUrl = (url?: string): boolean =>
  /supabase\.co\/storage\/v1\/object\//i.test(url || '');

const isPdfFile = (file: File): boolean =>
  file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

async function dataUrlToImageFile(dataUrl: string, baseName: string): Promise<File | null> {
  try {
    const resp = await fetch(dataUrl);
    const blob = await resp.blob();
    const stem = baseName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'preview';
    const ext = blob.type.includes('png') ? 'png' : 'jpg';
    return new File([blob], `${stem}_preview.${ext}`, { type: blob.type || 'image/jpeg' });
  } catch {
    return null;
  }
}

export const ProjectFormPanel: React.FC<ProjectFormPanelProps> = ({
  initialProject,
  isOwner = true,
  activeCategories = [],
  onSaved,
  onCancel,
}) => {
  const [formFormat, setFormFormat] = useState<ProjectFormFormat>(
    initialProject?.formFormat === 'showcase' ? 'showcase' : 'general'
  );
  const [title, setTitle] = useState(initialProject?.title || '');
  const [category, setCategory] = useState(initialProject?.category || '');
  const [projectScope, setProjectScope] = useState<ProjectScope>(
    (initialProject?.projectScope as ProjectScope) || 'Personal'
  );
  const [description, setDescription] = useState(initialProject?.description || '');
  const [mainContent, setMainContent] = useState(initialProject?.mainContent || '');
  const [overview, setOverview] = useState(initialProject?.overview || '');
  const [objectives, setObjectives] = useState(initialProject?.objectives || '');
  const [methodology, setMethodology] = useState(initialProject?.methodology || '');
  const [results, setResults] = useState(initialProject?.results || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(initialProject?.thumbnailUrl || '');
  const [heroInscription, setHeroInscription] = useState(initialProject?.heroInscription || '');
  const [toolsText, setToolsText] = useState(initialProject?.toolsUsed?.join(', ') || '');
  const [isFeatured, setIsFeatured] = useState(Boolean(initialProject?.isFeatured));
  const [status, setStatus] = useState<PortfolioProject['status']>(
    initialProject?.status || 'published'
  );

  const [specifications, setSpecifications] = useState<ProjectSpecification[]>(
    initialProject?.specifications || []
  );
  const [images, setImages] = useState<MediaAssetItem[]>(initialProject?.images || []);
  const [videos, setVideos] = useState<MediaAssetItem[]>(initialProject?.videos || []);
  const [cadDrawings, setCadDrawings] = useState<MediaAssetItem[]>(
    initialProject?.cadDrawings || []
  );
  const [documents, setDocuments] = useState<MediaAssetItem[]>(initialProject?.documents || []);
  const [showcasePdfs, setShowcasePdfs] = useState<MediaAssetItem[]>(
    initialProject?.showcasePdfs || []
  );
  const [showcaseImages, setShowcaseImages] = useState<MediaAssetItem[]>(
    initialProject?.showcaseImages || []
  );
  const [demoLinks, setDemoLinks] = useState<LinkItem[]>(initialProject?.demoLinks || []);

  // Auxiliary quick-add URL inputs
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageTitle, setNewImageTitle] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newCadUrl, setNewCadUrl] = useState('');
  const [newCadTitle, setNewCadTitle] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newShowcasePdfUrl, setNewShowcasePdfUrl] = useState('');
  const [newShowcasePdfTitle, setNewShowcasePdfTitle] = useState('');
  const [newShowcaseImgUrl, setNewShowcaseImgUrl] = useState('');
  const [newShowcaseImgTitle, setNewShowcaseImgTitle] = useState('');

  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string>('');
  const projectCategories = Array.from(
    new Set(activeCategories.map((c) => c.trim()).filter(Boolean))
  );
  const [customCategoryMode, setCustomCategoryMode] = useState(
    () =>
      projectCategories.length === 0 ||
      Boolean(initialProject?.category && !projectCategories.includes(initialProject.category))
  );
  const uploadAbortRef = useRef<AbortController | null>(null);
  const lastFailedUploadRef = useRef<{
    files: File[];
    target: UploadTarget;
  } | null>(null);
  const [canRetryUpload, setCanRetryUpload] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<UploadTarget | null>(null);
  const [previewVideoIdx, setPreviewVideoIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCancelUpload = () => {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    setUploadingField(null);
    setUploadProgress(0);
    setUploadStage('');
  };

  const runUploadFiles = async (fileArr: File[], target: UploadTarget) => {
    if (!fileArr || fileArr.length === 0) return;

    // Immediate strict 60 MB ceiling enforcement before loading FFmpeg or uploading
    for (const file of fileArr) {
      if (target === 'video' || isOptimizableVideo(file)) {
        try {
          validateVideoSizeLimit(file);
        } catch (sizeErr: any) {
          lastFailedUploadRef.current = null;
          setCanRetryUpload(false);
          setErrorMsg(
            sizeErr?.message || `Video exceeds the ${MAX_VIDEO_MB} MB maximum file size limit.`
          );
          return;
        }
      }
    }

    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    lastFailedUploadRef.current = { files: fileArr, target };
    setCanRetryUpload(false);

    setUploadingField(target);
    setUploadProgress(5);
    setUploadStage('Preparing upload pipeline...');
    setErrorMsg(null);
    try {
      const concurrency = target === 'video' ? 1 : 3;
      const bucketSubdir =
        target === 'showcase_pdf'
          ? 'document'
          : target === 'showcase_image'
          ? 'image'
          : target;

      const uploadedAssets = await runWithConcurrency(fileArr, concurrency, async (file) => {
        const res = await uploadFileToBucket(
          'projects',
          file,
          bucketSubdir,
          (pct, stage) => {
            setUploadProgress(pct);
            setUploadStage(stage);
          },
          controller.signal
        );

        let posterUrl = res.posterUrl;
        let jpegUrl = res.jpegUrl;

        // Pre-render sharp Page-1 preview card image for uploaded PDFs (CAD Drawings & Showcase PDFs)
        if ((target === 'cad' || target === 'showcase_pdf') && isPdfFile(file)) {
          try {
            setUploadStage(`Rendering crisp Page-1 preview (${file.name})...`);
            const thumbDataUrl = await generateCrispDocumentThumbnail(
              file,
              file.name,
              file.type || 'application/pdf',
              1200
            );
            if (thumbDataUrl) {
              const previewFile = await dataUrlToImageFile(thumbDataUrl, file.name);
              if (previewFile) {
                const prevUpload = await uploadFileToBucket(
                  'projects',
                  previewFile,
                  'image',
                  undefined,
                  controller.signal
                );
                posterUrl = prevUpload.publicUrl;
                jpegUrl = prevUpload.jpegUrl || prevUpload.publicUrl;
              }
            }
          } catch {
            // Non-fatal: ProjectsView also dynamically renders Page 1 cleanly if needed
          }
        }

        const displayTitle = cleanDisplayFileName(file.name).replace(/\.[^/.]+$/, '');
        return {
          title: displayTitle,
          note: '',
          url: res.publicUrl,
          fileName: res.fileName,
          fileSize: res.fileSize,
          fileType: file.type,
          avifUrl: res.avifUrl,
          webpUrl: res.webpUrl,
          jpegUrl,
          mobileUrl: res.mobileUrl,
          posterUrl,
          vttThumbnailsUrl: res.vttThumbnailsUrl,
          av1Urls: res.av1Urls,
          h264Urls: res.h264Urls,
          width: res.width,
          height: res.height,
          resolution: res.resolution,
          originalBytes: res.originalBytes,
          optimizedBytes: res.optimizedBytes,
          compressionPct: res.compressionPct,
          format: res.format,
          mediaAssetId: res.mediaAssetId,
        } as MediaAssetItem;
      });

      if (controller.signal.aborted) return;

      lastFailedUploadRef.current = null;
      setCanRetryUpload(false);

      if (target === 'thumbnail') {
        const first = uploadedAssets[0];
        if (first?.url) setThumbnailUrl(first.url);
      } else if (target === 'image') {
        setImages((prev) => [...prev, ...uploadedAssets]);
      } else if (target === 'video') {
        setVideos((prev) => [...prev, ...uploadedAssets]);
      } else if (target === 'cad') {
        setCadDrawings((prev) => [...prev, ...uploadedAssets]);
      } else if (target === 'document') {
        setDocuments((prev) => [...prev, ...uploadedAssets]);
      } else if (target === 'showcase_pdf') {
        setShowcasePdfs((prev) => [...prev, ...uploadedAssets]);
      } else if (target === 'showcase_image') {
        setShowcaseImages((prev) => [...prev, ...uploadedAssets]);
      }
    } catch (err: any) {
      if (!isAbortError(err) && !controller.signal.aborted) {
        setErrorMsg(err?.message || 'File upload to projects bucket failed.');
        setCanRetryUpload(true);
      }
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null;
        setUploadingField(null);
        setUploadProgress(0);
        setUploadStage('');
      }
    }
  };

  const handleBucketUpload = async (files: FileList | null, target: UploadTarget) => {
    if (!files || files.length === 0) return;
    await runUploadFiles(Array.from(files), target);
  };

  const handleRetryFailedUpload = async () => {
    const failed = lastFailedUploadRef.current;
    if (!failed) return;
    await runUploadFiles(failed.files, failed.target);
  };

  const handleMediaLibrarySelect = (items: BucketFileItem[], target: UploadTarget) => {
    if (!items || items.length === 0) return;
    const mapped: MediaAssetItem[] = items.map((item) => ({
      title: cleanDisplayFileName(item.name).replace(/\.[^/.]+$/, ''),
      url: item.publicUrl,
      fileName: cleanDisplayFileName(item.name),
      fileSize: item.size ? formatBytes(item.size) : undefined,
      fileType: item.mimeType,
      avifUrl: item.avifUrl,
      webpUrl: item.webpUrl,
      jpegUrl: item.jpegUrl,
      mobileUrl: item.mobileUrl,
      posterUrl: item.posterUrl,
      vttThumbnailsUrl: item.vttThumbnailsUrl,
      av1Urls: item.av1Urls,
      h264Urls: item.h264Urls,
      format: item.format,
      originalBytes: item.originalBytes,
      optimizedBytes: item.optimizedBytes,
      compressionPct: item.compressionPct,
    }));

    if (target === 'thumbnail') {
      setThumbnailUrl(items[0].publicUrl);
    } else if (target === 'image') {
      setImages((prev) => [...prev, ...mapped]);
    } else if (target === 'video') {
      setVideos((prev) => [...prev, ...mapped]);
    } else if (target === 'cad') {
      setCadDrawings((prev) => [...prev, ...mapped]);
    } else if (target === 'document') {
      setDocuments((prev) => [...prev, ...mapped]);
    } else if (target === 'showcase_pdf') {
      setShowcasePdfs((prev) => [...prev, ...mapped]);
    } else if (target === 'showcase_image') {
      setShowcaseImages((prev) => [...prev, ...mapped]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !category.trim() || !description.trim()) {
      setErrorMsg('Project title, category, and short summary are required.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const cleanedMainContent = mainContent.trim()
        ? isRichHtmlContent(mainContent)
          ? sanitizeArticleHtml(mainContent.trim())
          : mainContent.trim()
        : '';

      const effectiveThumbnail =
        thumbnailUrl.trim() ||
        showcaseImages[0]?.jpegUrl ||
        showcaseImages[0]?.webpUrl ||
        showcaseImages[0]?.url ||
        images[0]?.jpegUrl ||
        images[0]?.webpUrl ||
        images[0]?.url ||
        showcasePdfs[0]?.posterUrl ||
        showcasePdfs[0]?.jpegUrl ||
        cadDrawings[0]?.posterUrl ||
        cadDrawings[0]?.jpegUrl ||
        (/\.(png|jpe?g|webp|gif|avif|svg)$/i.test(cadDrawings[0]?.url || '')
          ? cadDrawings[0]?.url || ''
          : '') ||
        '';

      const saved = await upsertProjectToSupabase({
        id: initialProject?.id,
        slug: initialProject?.slug,
        title: title.trim(),
        category: category.trim(),
        projectScope,
        formFormat,
        description: description.trim(),
        mainContent: cleanedMainContent,
        overview: formFormat === 'general' ? overview.trim() : overview.trim(),
        objectives: formFormat === 'general' ? objectives.trim() : '',
        methodology: formFormat === 'general' ? methodology.trim() : '',
        results: formFormat === 'general' ? results.trim() : '',
        thumbnailUrl: effectiveThumbnail,
        heroInscription: heroInscription.trim(),
        toolsUsed: toolsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        isFeatured,
        isCadProject: false,
        cadModelType: '',
        status,
        specifications: specifications.filter((s) => s.label.trim() || s.value.trim()),
        images,
        videos,
        cadDrawings,
        documents,
        showcasePdfs,
        showcaseImages,
        demoLinks: demoLinks.filter((l) => l.url.trim()),
        likesCount: initialProject?.likesCount ?? 0,
      });
      onSaved(saved);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-full overflow-hidden box-border bg-white border border-[#b8c6d4] rounded-xl p-4 sm:p-5 shadow-xs space-y-4 font-serif text-slate-900"
    >
      {/* Header + Form Format Switcher */}
      <div className="space-y-2.5 border-b border-slate-200 pb-3">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <h3 className="text-sm font-bold text-slate-950 text-center flex-1 truncate">
            {initialProject ? 'Edit Project' : 'New Engineering Project'}
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer shrink-0"
            aria-label="Close project form"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Switch between General Form and Showcase Personal Project Work Form */}
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#edf2f8] border border-[#b8c6d4] rounded-lg p-1.5 text-xs">
          <span className="font-bold text-slate-700 px-1.5">Form Format:</span>
          <div className="flex items-center gap-1 flex-1 sm:flex-initial">
            <button
              type="button"
              onClick={() => setFormFormat('general')}
              className={`flex-1 sm:flex-initial px-3 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                formFormat === 'general'
                  ? 'bg-cyan-900 text-white shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
              }`}
            >
              General Form
            </button>
            <button
              type="button"
              onClick={() => setFormFormat('showcase')}
              className={`flex-1 sm:flex-initial px-3 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                formFormat === 'showcase'
                  ? 'bg-cyan-900 text-white shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-300'
              }`}
            >
              Showcase Work Form
            </button>
          </div>
        </div>
      </div>

      {uploadingField && (
        <div className="w-full p-2.5 rounded-lg bg-cyan-50 border border-cyan-200 space-y-1.5 text-xs text-cyan-950 font-semibold">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span className="truncate">
                {uploadStage
                  ? `${uploadStage} · ${Math.round(uploadProgress)}%`
                  : `Uploading... ${Math.round(uploadProgress)}%`}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCancelUpload}
              className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-cyan-200/70 text-cyan-900 font-bold cursor-pointer shrink-0 leading-none"
              title="Cancel upload"
              aria-label="Cancel upload"
            >
              ×
            </button>
          </div>
          <div className="w-full h-1.5 rounded-full bg-cyan-200/70 overflow-hidden">
            <div
              className="h-full bg-cyan-700 transition-all duration-300"
              style={{ width: `${Math.max(4, Math.min(100, uploadProgress))}%` }}
            />
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs break-words flex items-center justify-between gap-2">
          <span className="flex-1 min-w-0">{errorMsg}</span>
          {canRetryUpload && lastFailedUploadRef.current && (
            <button
              type="button"
              onClick={handleRetryFailedUpload}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-semibold cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
        </div>
      )}

      {/* Title, Category, Project Scope */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs min-w-0">
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Project Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter project title"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Category *</label>
          {!customCategoryMode && projectCategories.length > 0 ? (
            <select
              required
              value={projectCategories.includes(category) ? category : ''}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setCustomCategoryMode(true);
                  setCategory('');
                } else {
                  setCategory(e.target.value);
                }
              }}
              className="w-full min-w-0 px-2 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-[11px] font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-700"
            >
              <option value="">Select active category</option>
              {projectCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="__custom__">+ Type a category</option>
            </select>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Type category"
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
              {projectCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomCategoryMode(false);
                    if (!projectCategories.includes(category)) {
                      setCategory('');
                    }
                  }}
                  className="px-2 py-1 rounded border border-slate-300 bg-white text-[10.5px] font-semibold cursor-pointer shrink-0"
                >
                  Active
                </button>
              )}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Project Scope *</label>
          <select
            value={projectScope}
            onChange={(e) => setProjectScope(e.target.value as ProjectScope)}
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-semibold cursor-pointer focus:outline-none focus:ring-1 focus:ring-cyan-700"
          >
            {PROJECT_SCOPES.map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Card Top Rendering / Cover Image (Both Formats) */}
      <div className="w-full max-w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
        <label className="block font-bold text-slate-700">
          Card Top Rendering / Cover Image (Upload or URL — auto-uses first upload in Showcase if empty)
        </label>
        <div className="flex flex-col sm:flex-row gap-2 min-w-0">
          {isOwner ? (
            <button
              type="button"
              onClick={() => setMediaPickerTarget('thumbnail')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-xs font-semibold cursor-pointer shrink-0"
            >
              {uploadingField === 'thumbnail' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Upload / Media Library</span>
            </button>
          ) : (
            <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-xs font-semibold cursor-pointer shrink-0">
              {uploadingField === 'thumbnail' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Upload to projects</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleBucketUpload(e.target.files, 'thumbnail')}
                className="hidden"
              />
            </label>
          )}
          <input
            type="url"
            value={isSupabaseStorageUrl(thumbnailUrl) ? '' : thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder={
              isSupabaseStorageUrl(thumbnailUrl)
                ? 'Thumbnail uploaded (paste external URL to replace)'
                : 'Or paste thumbnail URL (https://...)'
            }
            className="flex-1 min-w-0 w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>
        {thumbnailUrl && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <img
              src={thumbnailUrl}
              alt="Thumbnail preview"
              className="h-24 w-auto max-w-full rounded-md border border-slate-300 object-contain bg-white"
            />
            <button
              type="button"
              onClick={() => setThumbnailUrl('')}
              className="inline-flex items-center justify-center w-6 h-6 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-xs font-bold cursor-pointer"
              title="Remove image"
              aria-label="Remove image"
            >
              ×
            </button>
          </div>
        )}
        <div className="space-y-1 pt-1">
          <label className="block font-bold text-slate-700">
            Hero Inscription (Displayed top-right on hero image card)
          </label>
          <input
            type="text"
            value={heroInscription}
            onChange={(e) => setHeroInscription(e.target.value)}
            placeholder="Write an editable inscription shown at top-right of the hero image..."
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="text-xs min-w-0">
        <label className="block font-bold text-slate-700 mb-1">Summary Text *</label>
        <textarea
          rows={2}
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Concise summary displayed on the project card and top of project page"
          className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
        />
      </div>

      {/* FORM FORMAT 2: SHOWCASE PERSONAL PROJECT WORK */}
      {formFormat === 'showcase' ? (
        <div className="space-y-4">
          <div className="text-xs min-w-0 space-y-1">
            <label className="block font-bold text-slate-700">Showcase Notes &amp; Work Context (Optional)</label>
            <RichTextEditor
              value={mainContent}
              onChange={setMainContent}
              placeholder="Write project showcase context, design highlights, or commentary..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs min-w-0">
            {/* Multiple PDF Uploads (Clear Card Rendering) */}
            <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-[#edf2f8]/70 border border-[#b8c6d4] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                  <FileText className="w-3.5 h-3.5 text-cyan-800 shrink-0" />
                  <span>Showcase PDFs — Clear Cards ({showcasePdfs.length})</span>
                </span>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => setMediaPickerTarget('showcase_pdf')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] cursor-pointer shrink-0"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload Multiple PDFs</span>
                  </button>
                ) : (
                  <label className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 text-white text-[11px] cursor-pointer shrink-0">
                    <Upload className="w-3 h-3" />
                    <span>Upload PDFs</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,application/pdf"
                      onChange={(e) => handleBucketUpload(e.target.files, 'showcase_pdf')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-1.5 min-w-0">
                <input
                  type="text"
                  placeholder="PDF Title"
                  value={newShowcasePdfTitle}
                  onChange={(e) => setNewShowcasePdfTitle(e.target.value)}
                  className="w-full sm:w-28 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                />
                <input
                  type="url"
                  placeholder="PDF URL"
                  value={newShowcasePdfUrl}
                  onChange={(e) => setNewShowcasePdfUrl(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newShowcasePdfUrl.trim()) return;
                    setShowcasePdfs((prev) => [
                      ...prev,
                      {
                        title: newShowcasePdfTitle.trim() || `Showcase Sheet ${prev.length + 1}`,
                        url: newShowcasePdfUrl.trim(),
                        fileType: 'application/pdf',
                      },
                    ]);
                    setNewShowcasePdfUrl('');
                    setNewShowcasePdfTitle('');
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
                >
                  Add
                </button>
              </div>

              {showcasePdfs.map((pdf, i) => (
                <div key={i} className="bg-white p-2 rounded border border-slate-200 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {(pdf.posterUrl || pdf.jpegUrl) && (
                        <img
                          src={pdf.posterUrl || pdf.jpegUrl}
                          alt={pdf.title || 'PDF preview'}
                          className="w-9 h-11 object-cover rounded border border-slate-200 shrink-0"
                        />
                      )}
                      <span className="truncate font-semibold text-slate-800">
                        {pdf.title || pdf.fileName || `PDF Sheet ${i + 1}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowcasePdfs((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-rose-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={pdf.note ?? ''}
                    onChange={(e) =>
                      setShowcasePdfs((prev) =>
                        prev.map((item, idx) => (idx === i ? { ...item, note: e.target.value } : item))
                      )
                    }
                    placeholder="Add caption / note for this PDF card (optional)"
                    className="w-full min-w-0 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px]"
                  />
                </div>
              ))}
            </div>

            {/* Multiple Image Uploads (Side-Scrolling View Gallery) */}
            <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-[#edf2f8]/70 border border-[#b8c6d4] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-bold text-slate-800 flex items-center gap-1.5 truncate">
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-800 shrink-0" />
                  <span>Showcase Gallery Images ({showcaseImages.length})</span>
                </span>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => setMediaPickerTarget('showcase_image')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] cursor-pointer shrink-0"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload Multiple Images</span>
                  </button>
                ) : (
                  <label className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 text-white text-[11px] cursor-pointer shrink-0">
                    <Upload className="w-3 h-3" />
                    <span>Upload Images</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleBucketUpload(e.target.files, 'showcase_image')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-1.5 min-w-0">
                <input
                  type="text"
                  placeholder="Caption"
                  value={newShowcaseImgTitle}
                  onChange={(e) => setNewShowcaseImgTitle(e.target.value)}
                  className="w-full sm:w-28 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                />
                <input
                  type="url"
                  placeholder="Image URL"
                  value={newShowcaseImgUrl}
                  onChange={(e) => setNewShowcaseImgUrl(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newShowcaseImgUrl.trim()) return;
                    setShowcaseImages((prev) => [
                      ...prev,
                      {
                        title: newShowcaseImgTitle.trim() || `Showcase Image ${prev.length + 1}`,
                        url: newShowcaseImgUrl.trim(),
                      },
                    ]);
                    setNewShowcaseImgUrl('');
                    setNewShowcaseImgTitle('');
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
                >
                  Add
                </button>
              </div>

              {showcaseImages.map((img, i) => (
                <div key={i} className="bg-white p-2 rounded border border-slate-200 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <img
                        src={img.jpegUrl || img.url}
                        alt={img.title || 'Showcase preview'}
                        className="w-10 h-8 object-cover rounded border border-slate-200 shrink-0"
                      />
                      <span className="truncate font-semibold text-slate-800">
                        {img.title || `Showcase Image ${i + 1}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowcaseImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-rose-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={img.note ?? ''}
                    onChange={(e) =>
                      setShowcaseImages((prev) =>
                        prev.map((item, idx) => (idx === i ? { ...item, note: e.target.value } : item))
                      )
                    }
                    placeholder="Add note / caption for side-scrolling card (optional)"
                    className="w-full min-w-0 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px]"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* FORM FORMAT 1: GENERAL ENGINEERING PROJECT FORM */
        <div className="space-y-4">
          <div className="text-xs min-w-0 space-y-1">
            <label className="block font-bold text-slate-700">Main Contains</label>
            <RichTextEditor
              value={mainContent}
              onChange={setMainContent}
              placeholder="Write your main project contents here... Use the toolbar for font families, lists, alignment, custom margins, and spacing"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs min-w-0">
            <div className="min-w-0">
              <label className="block font-bold text-slate-700 mb-1">Overview</label>
              <textarea
                rows={3}
                value={overview}
                onChange={(e) => setOverview(e.target.value)}
                placeholder="Project background and architectural scope"
                className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
            <div className="min-w-0">
              <label className="block font-bold text-slate-700 mb-1">Objectives</label>
              <textarea
                rows={3}
                value={objectives}
                onChange={(e) => setObjectives(e.target.value)}
                placeholder="Engineering targets, requirements, and constraints"
                className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
            <div className="min-w-0">
              <label className="block font-bold text-slate-700 mb-1">Methodology</label>
              <textarea
                rows={3}
                value={methodology}
                onChange={(e) => setMethodology(e.target.value)}
                placeholder="Design steps, calculations, simulation, fabrication"
                className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
            <div className="min-w-0">
              <label className="block font-bold text-slate-700 mb-1">Results &amp; Outcomes</label>
              <textarea
                rows={3}
                value={results}
                onChange={(e) => setResults(e.target.value)}
                placeholder="Measured performance, validation metrics, deliverables"
                className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
          </div>

          {/* Specifications Dynamic Rows */}
          <div className="w-full max-w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-slate-700">Technical Specifications</span>
              <button
                type="button"
                onClick={() => setSpecifications((prev) => [...prev, { label: '', value: '' }])}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Spec</span>
              </button>
            </div>
            {specifications.map((spec, idx) => (
              <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-w-0">
                <input
                  type="text"
                  placeholder="Parameter (e.g. Material)"
                  value={spec.label}
                  onChange={(e) =>
                    setSpecifications((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, label: e.target.value } : s))
                    )
                  }
                  className="flex-1 min-w-0 w-full px-2 py-1 rounded border border-slate-300 bg-white"
                />
                <input
                  type="text"
                  placeholder="Value (e.g. 7075-T6 Aluminum)"
                  value={spec.value}
                  onChange={(e) =>
                    setSpecifications((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, value: e.target.value } : s))
                    )
                  }
                  className="flex-1 min-w-0 w-full px-2 py-1 rounded border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={() => setSpecifications((prev) => prev.filter((_, i) => i !== idx))}
                  className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Media & Document Upload Sections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs min-w-0">
            {/* Gallery Images */}
            <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-bold text-slate-700 truncate">Project Images ({images.length})</span>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => setMediaPickerTarget('image')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] cursor-pointer shrink-0"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload / Library</span>
                  </button>
                ) : (
                  <label className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 text-white text-[11px] cursor-pointer shrink-0">
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleBucketUpload(e.target.files, 'image')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div className="flex flex-wrap sm:flex-nowrap gap-1.5 min-w-0">
                <input
                  type="text"
                  placeholder="Caption"
                  value={newImageTitle}
                  onChange={(e) => setNewImageTitle(e.target.value)}
                  className="w-full sm:w-24 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                />
                <input
                  type="url"
                  placeholder="Image URL"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newImageUrl.trim()) return;
                    setImages((prev) => [
                      ...prev,
                      { title: newImageTitle.trim() || 'Project Image', url: newImageUrl.trim() },
                    ]);
                    setNewImageUrl('');
                    setNewImageTitle('');
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
                >
                  Add
                </button>
              </div>
              {images.map((img, i) => (
                <div key={i} className="bg-white p-2 rounded border border-slate-200 space-y-1.5 min-w-0">
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="truncate flex-1 min-w-0 font-semibold text-slate-800">
                      {img.title || `Uploaded Image ${i + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-rose-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={img.note ?? ''}
                    onChange={(e) =>
                      setImages((prev) =>
                        prev.map((item, idx) => (idx === i ? { ...item, note: e.target.value } : item))
                      )
                    }
                    placeholder="Add text / note for this image (optional)"
                    className="w-full min-w-0 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-700"
                  />
                </div>
              ))}
            </div>

            {/* CAD Drawings — Sharp Card Preview Rendering */}
            <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-bold text-slate-700 flex items-center gap-1 truncate">
                  <Layers className="w-3.5 h-3.5 text-cyan-800 shrink-0" />
                  <span>CAD Drawings ({cadDrawings.length})</span>
                </span>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => setMediaPickerTarget('cad')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] cursor-pointer shrink-0"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload / Library</span>
                  </button>
                ) : (
                  <label className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 text-white text-[11px] cursor-pointer shrink-0">
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.dwg,.dxf,.step,.stp,.iges,.igs,.sldprt,.sldasm,image/*"
                      onChange={(e) => handleBucketUpload(e.target.files, 'cad')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div className="flex flex-wrap sm:flex-nowrap gap-1.5 min-w-0">
                <input
                  type="text"
                  placeholder="Sheet Name"
                  value={newCadTitle}
                  onChange={(e) => setNewCadTitle(e.target.value)}
                  className="w-full sm:w-24 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                />
                <input
                  type="url"
                  placeholder="CAD / Drawing URL"
                  value={newCadUrl}
                  onChange={(e) => setNewCadUrl(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newCadUrl.trim()) return;
                    setCadDrawings((prev) => [
                      ...prev,
                      { title: newCadTitle.trim() || 'CAD Drawing', url: newCadUrl.trim() },
                    ]);
                    setNewCadUrl('');
                    setNewCadTitle('');
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
                >
                  Add
                </button>
              </div>
              {cadDrawings.map((c, i) => (
                <div key={i} className="flex items-center justify-between gap-2 bg-white px-2 py-1.5 rounded border border-slate-200 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {(c.posterUrl || c.jpegUrl) && (
                      <img
                        src={c.posterUrl || c.jpegUrl}
                        alt={c.title || 'CAD preview'}
                        className="w-8 h-8 object-cover rounded border border-slate-200 shrink-0"
                      />
                    )}
                    <span className="truncate flex-1 min-w-0 font-medium text-slate-800">
                      {c.title || (c.fileName && !/^\d+(\.[^/.]+)?$/.test(c.fileName) ? c.fileName : `Uploaded CAD Drawing ${i + 1}`)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCadDrawings((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-rose-600 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Downloadable Technical Documents */}
            <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <span className="font-bold text-slate-700 truncate">Technical Documents ({documents.length})</span>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => setMediaPickerTarget('document')}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] cursor-pointer shrink-0"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload / Library</span>
                  </button>
                ) : (
                  <label className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 text-white text-[11px] cursor-pointer shrink-0">
                    <Upload className="w-3 h-3" />
                    <span>Upload</span>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => handleBucketUpload(e.target.files, 'document')}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div className="flex flex-wrap sm:flex-nowrap gap-1.5 min-w-0">
                <input
                  type="text"
                  placeholder="Doc Title"
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="w-full sm:w-28 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                />
                <input
                  type="url"
                  placeholder="Document URL"
                  value={newDocUrl}
                  onChange={(e) => setNewDocUrl(e.target.value)}
                  className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newDocUrl.trim()) return;
                    setDocuments((prev) => [
                      ...prev,
                      { title: newDocTitle.trim() || 'Technical Document', url: newDocUrl.trim() },
                    ]);
                    setNewDocUrl('');
                    setNewDocTitle('');
                  }}
                  className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
                >
                  Add
                </button>
              </div>
              {documents.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-2 bg-white px-2 py-1 rounded border border-slate-200 min-w-0">
                  <span className="truncate flex-1 min-w-0">
                    {d.title || (d.fileName && !/^\d+(\.[^/.]+)?$/.test(d.fileName) ? d.fileName : `Uploaded Document ${i + 1}`)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDocuments((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-rose-600 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Project Videos — Shared Across Both Form Formats */}
      <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span className="font-bold text-slate-700 truncate">Project Videos ({videos.length})</span>
          {isOwner ? (
            <button
              type="button"
              onClick={() => setMediaPickerTarget('video')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] cursor-pointer shrink-0"
            >
              <Upload className="w-3 h-3" />
              <span>Upload / Library</span>
            </button>
          ) : (
            <label className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 text-white text-[11px] cursor-pointer shrink-0">
              <Upload className="w-3 h-3" />
              <span>Upload</span>
              <input
                type="file"
                multiple
                accept="video/*"
                onChange={(e) => handleBucketUpload(e.target.files, 'video')}
                className="hidden"
              />
            </label>
          )}
        </div>
        <div className="flex flex-wrap sm:flex-nowrap gap-1.5 min-w-0">
          <input
            type="text"
            placeholder="Title"
            value={newVideoTitle}
            onChange={(e) => setNewVideoTitle(e.target.value)}
            className="w-full sm:w-28 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
          />
          <input
            type="url"
            placeholder="Video URL"
            value={newVideoUrl}
            onChange={(e) => setNewVideoUrl(e.target.value)}
            className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
          />
          <button
            type="button"
            onClick={() => {
              if (!newVideoUrl.trim()) return;
              setVideos((prev) => [
                ...prev,
                { title: newVideoTitle.trim() || 'Demo Video', note: '', url: newVideoUrl.trim() },
              ]);
              setNewVideoUrl('');
              setNewVideoTitle('');
            }}
            className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
          >
            Add
          </button>
        </div>
        {videos.map((v, i) => (
          <div key={i} className="bg-white p-2 rounded border border-slate-200 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="truncate flex-1 min-w-0 font-semibold text-slate-800">
                {v.title || 'Uploaded Video'}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewVideoIdx((prev) => (prev === i ? null : i))}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-semibold cursor-pointer"
                >
                  <Play className="w-2.5 h-2.5" />
                  <span>{previewVideoIdx === i ? 'Hide' : 'Preview'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewVideoIdx((prev) => (prev === i ? null : prev));
                    setVideos((prev) => prev.filter((_, idx) => idx !== i));
                  }}
                  className="text-rose-600 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            {previewVideoIdx === i && v.url && (
              <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-950">
                <CleanVideoPlayer
                  src={v.url}
                  poster={v.posterUrl}
                  av1Urls={v.av1Urls}
                  h264Urls={v.h264Urls}
                  vttThumbnailsUrl={v.vttThumbnailsUrl}
                  title={v.title || 'Project Video Preview'}
                />
              </div>
            )}
            {(v.format || v.resolution || (v.originalBytes && v.optimizedBytes)) && (
              <div className="text-[10px] font-mono text-slate-500 flex flex-wrap items-center gap-x-2">
                {v.format && <span className="uppercase text-cyan-800 font-semibold">{v.format}</span>}
                {v.resolution && <span>{v.resolution}</span>}
                {v.originalBytes && v.optimizedBytes ? (
                  <span>
                    {formatBytes(v.originalBytes)} → {formatBytes(v.optimizedBytes)}
                    {typeof v.compressionPct === 'number' && v.compressionPct > 0
                      ? ` (-${v.compressionPct}%)`
                      : ''}
                  </span>
                ) : null}
              </div>
            )}
            <input
              type="text"
              value={v.note ?? ''}
              onChange={(e) =>
                setVideos((prev) =>
                  prev.map((item, idx) => (idx === i ? { ...item, note: e.target.value } : item))
                )
              }
              placeholder="Add text / note for this video (optional)"
              className="w-full min-w-0 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-700"
            />
          </div>
        ))}
      </div>

      {/* Tools Used, Publication Status & Featured Checkbox (CAD Project & 3D preset removed) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-center min-w-0">
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Tools Used (comma-separated)</label>
          <input
            type="text"
            value={toolsText}
            onChange={(e) => setToolsText(e.target.value)}
            placeholder="SolidWorks, Ansys FEA, 5-Axis CNC"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50"
          />
        </div>
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Publication Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PortfolioProject['status'])}
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 cursor-pointer"
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3 pt-2 sm:pt-4 min-w-0">
          <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
            />
            <span>Highlight in Featured Sort</span>
          </label>
        </div>
      </div>

      {/* Demonstration Links */}
      <div className="w-full max-w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <LinkIcon className="w-3.5 h-3.5 text-cyan-800" />
            <span>Demonstration Links</span>
          </span>
          <button
            type="button"
            onClick={() => setDemoLinks((prev) => [...prev, { label: '', url: '' }])}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Link</span>
          </button>
        </div>
        {demoLinks.map((lnk, idx) => (
          <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-w-0">
            <input
              type="text"
              placeholder="Label (e.g. Live Demo / GitHub)"
              value={lnk.label}
              onChange={(e) =>
                setDemoLinks((prev) =>
                  prev.map((l, i) => (i === idx ? { ...l, label: e.target.value } : l))
                )
              }
              className="w-full sm:w-40 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <input
              type="url"
              placeholder="https://..."
              value={lnk.url}
              onChange={(e) =>
                setDemoLinks((prev) =>
                  prev.map((l, i) => (i === idx ? { ...l, url: e.target.value } : l))
                )
              }
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              type="button"
              onClick={() => setDemoLinks((prev) => prev.filter((_, i) => i !== idx))}
              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || uploadingField !== null}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{initialProject ? 'Update Project' : 'Publish Project'}</span>
        </button>
      </div>

      {isOwner && mediaPickerTarget && (
        <MediaLibraryModal
          isOpen={true}
          title={
            mediaPickerTarget === 'thumbnail'
              ? 'Card Top Rendering Image'
              : mediaPickerTarget === 'image'
              ? 'Project Images'
              : mediaPickerTarget === 'video'
              ? 'Project Videos'
              : mediaPickerTarget === 'cad'
              ? 'CAD Drawings'
              : mediaPickerTarget === 'showcase_pdf'
              ? 'Showcase PDFs'
              : mediaPickerTarget === 'showcase_image'
              ? 'Showcase Gallery Images'
              : 'Technical Documents'
          }
          defaultBucket="projects"
          defaultFilter={
            (mediaPickerTarget === 'thumbnail' ||
            mediaPickerTarget === 'image' ||
            mediaPickerTarget === 'showcase_image'
              ? 'image'
              : mediaPickerTarget === 'video'
              ? 'video'
              : mediaPickerTarget === 'document' || mediaPickerTarget === 'showcase_pdf'
              ? 'document'
              : 'all') as MediaLibraryFilter
          }
          allowMultiple={mediaPickerTarget !== 'thumbnail'}
          accept={
            mediaPickerTarget === 'thumbnail' ||
            mediaPickerTarget === 'image' ||
            mediaPickerTarget === 'showcase_image'
              ? 'image/*'
              : mediaPickerTarget === 'video'
              ? 'video/*'
              : mediaPickerTarget === 'showcase_pdf'
              ? '.pdf,application/pdf'
              : mediaPickerTarget === 'cad'
              ? '.pdf,.dwg,.dxf,.step,.stp,.iges,.igs,.sldprt,.sldasm,image/*'
              : undefined
          }
          onUploadFiles={(chosenFiles) => {
            void handleBucketUpload(chosenFiles, mediaPickerTarget);
          }}
          onSelectExisting={(chosenItems) => {
            handleMediaLibrarySelect(chosenItems, mediaPickerTarget);
          }}
          onClose={() => setMediaPickerTarget(null)}
        />
      )}
    </form>
  );
};
