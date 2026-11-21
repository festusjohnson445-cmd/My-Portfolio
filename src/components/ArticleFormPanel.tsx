import React, { useRef, useState } from 'react';
import {
  Upload,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  Code,
  BarChart3,
  Table as TableIcon,
  FileText,
  Image as ImageIcon,
  Video,
  Compass,
  RotateCcw,
  Play,
} from 'lucide-react';
import {
  uploadFileToBucket,
  submitOrSaveArticleToSupabase,
  estimateReadingTime,
  formatBytes,
  isAbortError,
  type PortfolioArticle,
  type ArticleHeroMedia,
  type ArticleCodeBlock,
  type ArticleChartData,
  type ArticleBomItem,
  type MediaAssetItem,
  type BucketFileItem,
} from '../utils/portfolioSupabase';
import { cleanDisplayFileName, runWithConcurrency } from '../utils/mediaMetadata';
import {
  extractHtmlHeadings,
  isRichHtmlContent,
  sanitizeArticleHtml,
  stripHtmlToPlainText,
} from '../utils/htmlSanitizer';
import { MediaLibraryModal, type MediaLibraryFilter } from './MediaLibraryModal';
import { CleanVideoPlayer } from './CleanVideoPlayer';
import { RichTextEditor } from './RichTextEditor';

interface ArticleFormPanelProps {
  initialArticle?: PortfolioArticle | null;
  isOwner: boolean;
  activeCategories?: string[];
  onSaved: (saved: PortfolioArticle, wasPendingVisitor: boolean) => void;
  onCancel: () => void;
}

const isSupabaseStorageUrl = (url?: string): boolean =>
  /supabase\.co\/storage\/v1\/object\//i.test(url || '');

export const ArticleFormPanel: React.FC<ArticleFormPanelProps> = ({
  initialArticle,
  isOwner,
  activeCategories = [],
  onSaved,
  onCancel,
}) => {
  // Strictly empty defaults on create — never auto-populate text fields
  const [title, setTitle] = useState(initialArticle?.title || '');
  const [authorName, setAuthorName] = useState(initialArticle?.authorName || '');
  const [category, setCategory] = useState(initialArticle?.category || '');
  const [difficultyLevel, setDifficultyLevel] = useState(initialArticle?.difficultyLevel || '');
  const [readingTime, setReadingTime] = useState(initialArticle?.readingTime || '');
  const [summary, setSummary] = useState(initialArticle?.summary || '');
  const [tldr, setTldr] = useState(initialArticle?.tldr || '');
  const [content, setContent] = useState(initialArticle?.content || '');
  const [tagsText, setTagsText] = useState(initialArticle?.tags?.join(', ') || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(initialArticle?.thumbnailUrl || '');

  const [heroMedia, setHeroMedia] = useState<ArticleHeroMedia>(
    initialArticle?.heroMedia || { type: 'none', url: '', caption: '', cadModelType: undefined }
  );
  const [heroInscription, setHeroInscription] = useState(
    initialArticle?.heroInscription ||
      initialArticle?.heroMedia?.inscription ||
      initialArticle?.heroMedia?.caption ||
      ''
  );

  const [images, setImages] = useState<MediaAssetItem[]>(initialArticle?.images || []);
  const [videos, setVideos] = useState<MediaAssetItem[]>(initialArticle?.videos || []);
  const [diagrams, setDiagrams] = useState<MediaAssetItem[]>(initialArticle?.diagrams || []);
  const [attachments, setAttachments] = useState<MediaAssetItem[]>(initialArticle?.attachments || []);
  const [codeBlocks, setCodeBlocks] = useState<ArticleCodeBlock[]>(initialArticle?.codeBlocks || []);
  const [chartData, setChartData] = useState<ArticleChartData[]>(initialArticle?.chartData || []);
  const [bomItems, setBomItems] = useState<ArticleBomItem[]>(initialArticle?.bomItems || []);

  const [status, setStatus] = useState<PortfolioArticle['status']>(
    initialArticle?.status || (isOwner ? 'published' : 'pending')
  );

  // Quick URL inputs (empty by default)
  const [newImgTitle, setNewImgTitle] = useState('');
  const [newImgUrl, setNewImgUrl] = useState('');
  const [newVidTitle, setNewVidTitle] = useState('');
  const [newVidUrl, setNewVidUrl] = useState('');
  const [newDiagTitle, setNewDiagTitle] = useState('');
  const [newDiagUrl, setNewDiagUrl] = useState('');
  const [newAttTitle, setNewAttTitle] = useState('');
  const [newAttUrl, setNewAttUrl] = useState('');

  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string>('');
  const [customCategoryMode, setCustomCategoryMode] = useState(false);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const lastFailedUploadRef = useRef<{
    files: File[];
    target: 'thumbnail' | 'hero' | 'image' | 'video' | 'diagram' | 'attachment';
    jobId?: string;
  } | null>(null);
  const [canRetryUpload, setCanRetryUpload] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<
    'thumbnail' | 'hero' | 'image' | 'video' | 'diagram' | 'attachment' | null
  >(null);
  const [previewHeroVideo, setPreviewHeroVideo] = useState(false);
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

  const runUploadFiles = async (
    fileArr: File[],
    target: 'thumbnail' | 'hero' | 'image' | 'video' | 'diagram' | 'attachment',
    retryJobId?: string
  ) => {
    if (!fileArr || fileArr.length === 0) return;
    uploadAbortRef.current?.abort();
    const controller = new AbortController();
    uploadAbortRef.current = controller;
    lastFailedUploadRef.current = { files: fileArr, target, jobId: retryJobId };
    setCanRetryUpload(false);

    setUploadingField(target);
    setUploadProgress(5);
    setUploadStage('Preparing media pipeline...');
    setErrorMsg(null);
    try {
      const concurrency = target === 'video' ? 1 : 3;
      const results = await runWithConcurrency(fileArr, concurrency, async (file, idx) => {
        const res = await uploadFileToBucket(
          'articles',
          file,
          target,
          (pct, stage) => {
            setUploadProgress(pct);
            setUploadStage(stage);
          },
          controller.signal,
          idx === 0 ? retryJobId : undefined
        );
        return {
          asset: {
            title: '',
            note: '',
            url: res.publicUrl,
            fileName: res.fileName,
            fileSize: res.fileSize,
            fileType: file.type,
            avifUrl: res.avifUrl,
            webpUrl: res.webpUrl,
            jpegUrl: res.jpegUrl,
            mobileUrl: res.mobileUrl,
            posterUrl: res.posterUrl,
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
          } as MediaAssetItem,
          isVideo:
            file.type.startsWith('video/') ||
            /\.(mp4|mov|webm|m4v|mkv|3gp|avi|mpeg|mpg|mts|m2ts|ts|wmv|flv|ogv)$/i.test(file.name),
        };
      });

      if (controller.signal.aborted) return;

      lastFailedUploadRef.current = null;
      setCanRetryUpload(false);

      if (target === 'thumbnail') {
        const first = results[0];
        if (first?.asset.url) setThumbnailUrl(first.asset.url);
      } else if (target === 'hero') {
        const first = results[0];
        if (first?.asset.url) {
          setHeroMedia((prev) => ({
            ...prev,
            type: first.isVideo ? 'video' : prev.type === 'none' ? 'image' : prev.type,
            url: first.asset.url,
            avifUrl: first.asset.avifUrl,
            webpUrl: first.asset.webpUrl,
            jpegUrl: first.asset.jpegUrl,
            mobileUrl: first.asset.mobileUrl,
            posterUrl: first.asset.posterUrl,
            vttThumbnailsUrl: first.asset.vttThumbnailsUrl,
            av1Urls: first.asset.av1Urls,
            h264Urls: first.asset.h264Urls,
            mediaAssetId: first.asset.mediaAssetId,
          }));
        }
      } else if (target === 'image') {
        setImages((prev) => [...prev, ...results.map((r) => r.asset)]);
      } else if (target === 'video') {
        setVideos((prev) => [...prev, ...results.map((r) => r.asset)]);
      } else if (target === 'diagram') {
        setDiagrams((prev) => [...prev, ...results.map((r) => r.asset)]);
      } else if (target === 'attachment') {
        setAttachments((prev) => [...prev, ...results.map((r) => r.asset)]);
      }
    } catch (err: any) {
      if (!isAbortError(err) && !controller.signal.aborted) {
        if (err?.jobId && lastFailedUploadRef.current) {
          lastFailedUploadRef.current.jobId = err.jobId;
        }
        setErrorMsg(err?.message || 'Upload to "articles" bucket failed.');
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

  const handleBucketUpload = async (
    files: FileList | null,
    target: 'thumbnail' | 'hero' | 'image' | 'video' | 'diagram' | 'attachment'
  ) => {
    if (!files || files.length === 0) return;
    await runUploadFiles(Array.from(files), target);
  };

  const handleRetryFailedUpload = async () => {
    const failed = lastFailedUploadRef.current;
    if (!failed) return;
    await runUploadFiles(failed.files, failed.target, failed.jobId);
  };

  const handleMediaLibrarySelect = (
    items: BucketFileItem[],
    target: 'thumbnail' | 'hero' | 'image' | 'video' | 'diagram' | 'attachment'
  ) => {
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
    } else if (target === 'hero') {
      const first = items[0];
      setHeroMedia((prev) => ({
        ...prev,
        type:
          first.mediaKind === 'video'
            ? 'video'
            : prev.type === 'none'
            ? 'image'
            : prev.type,
        url: first.publicUrl,
        avifUrl: first.avifUrl,
        webpUrl: first.webpUrl,
        jpegUrl: first.jpegUrl,
        mobileUrl: first.mobileUrl,
        posterUrl: first.posterUrl,
        vttThumbnailsUrl: first.vttThumbnailsUrl,
        av1Urls: first.av1Urls,
        h264Urls: first.h264Urls,
      }));
    } else if (target === 'image') {
      setImages((prev) => [...prev, ...mapped]);
    } else if (target === 'video') {
      setVideos((prev) => [...prev, ...mapped]);
    } else if (target === 'diagram') {
      setDiagrams((prev) => [...prev, ...mapped]);
    } else if (target === 'attachment') {
      setAttachments((prev) => [...prev, ...mapped]);
    }
  };

  const extractHeadingsForToc = (rawContent: string): string[] => {
    if (isRichHtmlContent(rawContent)) {
      return extractHtmlHeadings(rawContent).map((h) => h.label);
    }
    return rawContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^#{1,3}\s+/.test(line))
      .map((line) => line.replace(/^#{1,3}\s+/, '').trim());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const plainContent = stripHtmlToPlainText(content);
    if (!title.trim() || !summary.trim() || !plainContent || !category.trim() || !authorName.trim()) {
      setErrorMsg('Title, Author, Category, Summary, and Article Contents are required.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    try {
      const cleanedContent = isRichHtmlContent(content)
        ? sanitizeArticleHtml(content.trim())
        : content.trim();
      const toc = extractHeadingsForToc(cleanedContent);
      const effectiveThumbnail =
        thumbnailUrl.trim() ||
        images[0]?.url ||
        diagrams[0]?.url ||
        (heroMedia.type === 'image' || heroMedia.type === 'diagram' ? heroMedia.url || '' : '');

      const saved = await submitOrSaveArticleToSupabase(
        {
          id: initialArticle?.id,
          slug: initialArticle?.slug,
          title: title.trim(),
          summary: summary.trim(),
          content: cleanedContent,
          category: category.trim(),
          difficultyLevel: difficultyLevel.trim() || 'Intermediate',
          readingTime: readingTime.trim() || estimateReadingTime(plainContent),
          authorName: authorName.trim(),
          isAdminAuthor: isOwner,
          thumbnailUrl: effectiveThumbnail,
          heroMedia: {
            ...heroMedia,
            caption: heroInscription.trim(),
            inscription: heroInscription.trim(),
          },
          heroInscription: heroInscription.trim(),
          tldr: tldr.trim(),
          toc,
          images,
          videos,
          diagrams,
          codeBlocks: codeBlocks.filter((c) => c.code.trim()),
          chartData: chartData.filter((ch) => ch.items.length > 0),
          bomItems: bomItems.filter((b) => b.name.trim() || b.partNo.trim()),
          attachments,
          tags: tagsText
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          status: isOwner ? status : 'pending',
          publishedAt: initialArticle?.publishedAt,
        },
        isOwner
      );

      onSaved(saved, !isOwner);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to submit article.');
    } finally {
      setSaving(false);
    }
  };

  const articleCategories = Array.from(
    new Set([
      ...activeCategories.map((c) => c.trim()).filter(Boolean),
      ...(initialArticle?.category?.trim() ? [initialArticle.category.trim()] : []),
    ])
  ).filter(Boolean);

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-full overflow-hidden box-border bg-white border border-[#b8c6d4] rounded-xl p-4 sm:p-5 shadow-xs space-y-4 font-serif text-slate-900"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2 min-w-0">
        <h3 className="text-sm font-bold text-slate-950 text-center flex-1 truncate">
          {initialArticle
            ? 'Edit Engineering Article'
            : isOwner
            ? 'Post New Article (Chief Admin)'
            : 'Post Engineering Article'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer shrink-0"
          aria-label="Close article form"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {uploadingField && (
        <div className="w-full p-2.5 rounded-lg bg-cyan-50 border border-cyan-200 space-y-1.5 text-xs text-cyan-950 font-semibold">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span className="truncate">
                {`Uploading..... ${Math.round(uploadProgress)}%`}
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

      {/* Row 1: Title, Author */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs min-w-0">
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Article Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter article title"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Author Name *</label>
          <input
            type="text"
            required
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Enter author name"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>
      </div>

      {/* Row 2: Discipline/Category, Difficulty, Reading Time, Tags */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs min-w-0">
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Category / Discipline *</label>
          {!customCategoryMode && articleCategories.length > 0 ? (
            <select
              required
              value={articleCategories.includes(category) ? category : ''}
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
              {articleCategories.map((cat) => (
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
              {articleCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomCategoryMode(false);
                    if (!articleCategories.includes(category)) {
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
          <label className="block font-bold text-slate-700 mb-1">Difficulty Level</label>
          <select
            value={difficultyLevel}
            onChange={(e) => setDifficultyLevel(e.target.value)}
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 cursor-pointer"
          >
            <option value="">Select difficulty</option>
            <option value="Introductory">Introductory</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
            <option value="Research / Deep Dive">Research / Deep Dive</option>
          </select>
        </div>

        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Reading Time</label>
          <input
            type="text"
            value={readingTime}
            onChange={(e) => setReadingTime(e.target.value)}
            placeholder="e.g. 6 min read (auto if blank)"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50"
          />
        </div>

        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="e.g. FEA, GD&T, SolidWorks"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50"
          />
        </div>
      </div>

      {/* Card Image Upload + URL */}
      <div className="w-full max-w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
        <label className="block font-bold text-slate-700">Card Image</label>
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
              <span>Upload Image</span>
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
                ? 'Image uploaded (paste external URL to replace)'
                : 'Or paste image URL (https://...)'
            }
            className="flex-1 min-w-0 w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
          />
        </div>
        {thumbnailUrl && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <img
              src={thumbnailUrl}
              alt="Article card image preview"
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
      </div>

      {/* Hero Media */}
      <div className="w-full max-w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
        <label className="block font-bold text-slate-700">Hero Media</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
          <select
            value={heroMedia.type}
            onChange={(e) =>
              setHeroMedia((prev) => ({ ...prev, type: e.target.value as ArticleHeroMedia['type'] }))
            }
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white cursor-pointer"
          >
            <option value="none">No Separate Hero</option>
            <option value="image">Image Hero</option>
            <option value="diagram">Technical Diagram Hero</option>
            <option value="video">Video Hero</option>
            <option value="cad3d">Interactive 3D CAD Embed</option>
          </select>

          {heroMedia.type === 'cad3d' ? (
            <select
              value={heroMedia.cadModelType || 'harmonic_actuator'}
              onChange={(e) =>
                setHeroMedia((prev) => ({
                  ...prev,
                  cadModelType: e.target.value as ArticleHeroMedia['cadModelType'],
                }))
              }
              className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white cursor-pointer sm:col-span-2"
            >
              <option value="harmonic_actuator">Harmonic Drive Actuator Assembly</option>
              <option value="gimbal_bracket">Optical Gimbal Yoke Assembly</option>
              <option value="planetary_gearbox">Planetary Gearbox</option>
              <option value="chassis_suspension">Chassis Suspension</option>
            </select>
          ) : heroMedia.type !== 'none' ? (
            <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2 min-w-0">
              {isOwner ? (
                <button
                  type="button"
                  onClick={() => setMediaPickerTarget('hero')}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-xs cursor-pointer shrink-0"
                >
                  {uploadingField === 'hero' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
                  <span>Upload / Library</span>
                </button>
              ) : (
                <label className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-800 text-white text-xs cursor-pointer shrink-0">
                  {uploadingField === 'hero' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Upload className="w-3 h-3" />
                  )}
                  <span>Upload</span>
                  <input
                    type="file"
                    accept={heroMedia.type === 'video' ? 'video/*' : 'image/*,.svg'}
                    onChange={(e) => handleBucketUpload(e.target.files, 'hero')}
                    className="hidden"
                  />
                </label>
              )}
              <input
                type="url"
                value={isSupabaseStorageUrl(heroMedia.url) ? '' : heroMedia.url || ''}
                onChange={(e) => setHeroMedia((prev) => ({ ...prev, url: e.target.value }))}
                placeholder={
                  isSupabaseStorageUrl(heroMedia.url)
                    ? 'Hero media uploaded'
                    : 'Hero media URL'
                }
                className="flex-1 min-w-0 w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
              />
              {heroMedia.url && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {heroMedia.type === 'video' && (
                    <button
                      type="button"
                      onClick={() => setPreviewHeroVideo((p) => !p)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-[11px] font-semibold cursor-pointer shrink-0"
                    >
                      <Play className="w-3 h-3" />
                      <span>{previewHeroVideo ? 'Hide' : 'Preview'}</span>
                    </button>
                  )}
                  {isSupabaseStorageUrl(heroMedia.url) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewHeroVideo(false);
                        setHeroMedia((prev) => ({ ...prev, url: '' }));
                      }}
                      className="px-2.5 py-1 rounded bg-rose-100 text-rose-800 text-[11px] font-semibold cursor-pointer shrink-0"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
        {heroMedia.type === 'video' && heroMedia.url && previewHeroVideo && (
          <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-950">
            <CleanVideoPlayer
              src={heroMedia.url}
              poster={heroMedia.posterUrl}
              av1Urls={heroMedia.av1Urls}
              h264Urls={heroMedia.h264Urls}
              vttThumbnailsUrl={heroMedia.vttThumbnailsUrl}
              title={title || 'Hero Video Preview'}
            />
          </div>
        )}
        <div className="space-y-1 pt-1">
          <label className="block font-bold text-slate-700">
            Hero Inscription (Displayed top-right on hero image card)
          </label>
          <input
            type="text"
            value={heroInscription}
            onChange={(e) => {
              const val = e.target.value;
              setHeroInscription(val);
              setHeroMedia((prev) => ({ ...prev, caption: val, inscription: val }));
            }}
            placeholder="Write an editable inscription shown at top-right of the hero image..."
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
          />
        </div>
      </div>

      {/* Summary & Key Takeaway */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs min-w-0">
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Short Summary *</label>
          <textarea
            rows={2}
            required
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Brief card summary"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50"
          />
        </div>
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Key Takeaway</label>
          <textarea
            rows={2}
            value={tldr}
            onChange={(e) => setTldr(e.target.value)}
            placeholder="Concise key takeaway for readers"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50"
          />
        </div>
      </div>

      {/* Article Contents (Rich Formatting Editor) */}
      <div className="text-xs min-w-0 space-y-1">
        <label className="block font-bold text-slate-700">
          Article Contents * <span className="font-normal text-slate-500">(Bold, Italic, Color, Alignment, Justify, Spacing &amp; Margins)</span>
        </label>
        <RichTextEditor
          value={content}
          onChange={setContent}
          placeholder="Add your Article here... Use the toolbar for bold, italic, text color, alignment, justification, spacing, and margins"
        />
      </div>

      {/* Media & Attachments Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs min-w-0">
        {/* Vector Schematics & Technical Illustrations */}
        <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="font-bold text-slate-700 flex items-center gap-1 min-w-0">
              <Compass className="w-3.5 h-3.5 text-cyan-800 shrink-0" />
              <span className="truncate">Illustrations ({diagrams.length})</span>
            </span>
            {isOwner ? (
              <button
                type="button"
                onClick={() => setMediaPickerTarget('diagram')}
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
                  accept="image/*,.svg"
                  onChange={(e) => handleBucketUpload(e.target.files, 'diagram')}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-1.5 min-w-0">
            <input
              type="text"
              placeholder="Title"
              value={newDiagTitle}
              onChange={(e) => setNewDiagTitle(e.target.value)}
              className="w-full sm:w-24 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <input
              type="url"
              placeholder="Diagram URL"
              value={newDiagUrl}
              onChange={(e) => setNewDiagUrl(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (!newDiagUrl.trim()) return;
                setDiagrams((prev) => [...prev, { title: newDiagTitle.trim() || 'Schematic', url: newDiagUrl.trim() }]);
                setNewDiagUrl('');
                setNewDiagTitle('');
              }}
              className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
            >
              Add
            </button>
          </div>
          {diagrams.map((d, i) => (
            <div key={i} className="bg-white p-2 rounded border border-slate-200 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="truncate flex-1 min-w-0 font-semibold text-slate-800">
                  {d.title || `Uploaded Schematic ${i + 1}`}
                </span>
                <button
                  type="button"
                  onClick={() => setDiagrams((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-rose-600 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <input
                type="text"
                value={d.note ?? ''}
                onChange={(e) =>
                  setDiagrams((prev) =>
                    prev.map((item, idx) => (idx === i ? { ...item, note: e.target.value } : item))
                  )
                }
                placeholder="Add note / text for this schematic (optional)"
                className="w-full min-w-0 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
          ))}
        </div>

        {/* Supporting Images */}
        <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="font-bold text-slate-700 flex items-center gap-1 min-w-0">
              <ImageIcon className="w-3.5 h-3.5 text-cyan-800 shrink-0" />
              <span className="truncate">Images ({images.length})</span>
            </span>
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
              value={newImgTitle}
              onChange={(e) => setNewImgTitle(e.target.value)}
              className="w-full sm:w-24 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <input
              type="url"
              placeholder="Image URL"
              value={newImgUrl}
              onChange={(e) => setNewImgUrl(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (!newImgUrl.trim()) return;
                setImages((prev) => [...prev, { title: newImgTitle.trim() || 'Figure', note: '', url: newImgUrl.trim() }]);
                setNewImgUrl('');
                setNewImgTitle('');
              }}
              className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
            >
              Add
            </button>
          </div>
          {images.map((im, i) => (
            <div key={i} className="bg-white p-2 rounded border border-slate-200 space-y-1.5 min-w-0">
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="truncate flex-1 min-w-0 font-semibold text-slate-800">
                  {im.title || `Uploaded Image ${i + 1}`}
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
                value={im.note ?? ''}
                onChange={(e) =>
                  setImages((prev) =>
                    prev.map((item, idx) => (idx === i ? { ...item, note: e.target.value } : item))
                  )
                }
                placeholder="Add note / text for this image (optional)"
                className="w-full min-w-0 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
          ))}
        </div>

        {/* Embedded Videos */}
        <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="font-bold text-slate-700 flex items-center gap-1 min-w-0">
              <Video className="w-3.5 h-3.5 text-cyan-800 shrink-0" />
              <span className="truncate">Videos ({videos.length})</span>
            </span>
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
              value={newVidTitle}
              onChange={(e) => setNewVidTitle(e.target.value)}
              className="w-full sm:w-24 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <input
              type="url"
              placeholder="Video URL"
              value={newVidUrl}
              onChange={(e) => setNewVidUrl(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (!newVidUrl.trim()) return;
                setVideos((prev) => [...prev, { title: newVidTitle.trim() || 'Video', note: '', url: newVidUrl.trim() }]);
                setNewVidUrl('');
                setNewVidTitle('');
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
                    title={v.title || 'Article Video Preview'}
                  />
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
                placeholder="Add note / text for this video (optional)"
                className="w-full min-w-0 px-2 py-1 rounded border border-slate-200 bg-slate-50 text-[11px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
          ))}
        </div>

        {/* Technical File Attachments */}
        <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="font-bold text-slate-700 flex items-center gap-1 min-w-0">
              <FileText className="w-3.5 h-3.5 text-cyan-800 shrink-0" />
              <span className="truncate">Technical Files ({attachments.length})</span>
            </span>
            {isOwner ? (
              <button
                type="button"
                onClick={() => setMediaPickerTarget('attachment')}
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
                  onChange={(e) => handleBucketUpload(e.target.files, 'attachment')}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-1.5 min-w-0">
            <input
              type="text"
              placeholder="File label"
              value={newAttTitle}
              onChange={(e) => setNewAttTitle(e.target.value)}
              className="w-full sm:w-24 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <input
              type="url"
              placeholder="File URL"
              value={newAttUrl}
              onChange={(e) => setNewAttUrl(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (!newAttUrl.trim()) return;
                setAttachments((prev) => [...prev, { title: newAttTitle.trim() || 'Attachment', url: newAttUrl.trim() }]);
                setNewAttUrl('');
                setNewAttTitle('');
              }}
              className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
            >
              Add
            </button>
          </div>
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center justify-between gap-2 bg-white px-2 py-1 rounded border border-slate-200 min-w-0">
              <span className="truncate flex-1 min-w-0">
                {att.title || (att.fileName && !/^\d+(\.[^/.]+)?$/.test(att.fileName) ? att.fileName : `Uploaded File ${i + 1}`)}
              </span>
              <button
                type="button"
                onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-rose-600 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Code Blocks */}
      <div className="w-full max-w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <Code className="w-3.5 h-3.5 text-cyan-800" />
            <span>Code Blocks ({codeBlocks.length})</span>
          </span>
          <button
            type="button"
            onClick={() => setCodeBlocks((prev) => [...prev, { title: '', language: '', code: '' }])}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Code</span>
          </button>
        </div>
        {codeBlocks.map((cb, idx) => (
          <div key={idx} className="p-2.5 rounded bg-white border border-slate-200 space-y-2 min-w-0">
            <div className="flex flex-wrap sm:flex-nowrap gap-2 min-w-0">
              <input
                type="text"
                placeholder="Snippet title"
                value={cb.title}
                onChange={(e) =>
                  setCodeBlocks((prev) => prev.map((c, i) => (i === idx ? { ...c, title: e.target.value } : c)))
                }
                className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300"
              />
              <input
                type="text"
                placeholder="Language (e.g. python, cpp)"
                value={cb.language}
                onChange={(e) =>
                  setCodeBlocks((prev) => prev.map((c, i) => (i === idx ? { ...c, language: e.target.value } : c)))
                }
                className="w-full sm:w-36 min-w-0 px-2 py-1 rounded border border-slate-300"
              />
              <button
                type="button"
                onClick={() => setCodeBlocks((prev) => prev.filter((_, i) => i !== idx))}
                className="text-rose-600 p-1 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <textarea
              rows={3}
              placeholder="Paste code here"
              value={cb.code}
              onChange={(e) =>
                setCodeBlocks((prev) => prev.map((c, i) => (i === idx ? { ...c, code: e.target.value } : c)))
              }
              className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 font-mono text-[11px] bg-slate-50"
            />
          </div>
        ))}
      </div>

      {/* Data Charts & Visualizations */}
      <div className="w-full max-w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <BarChart3 className="w-3.5 h-3.5 text-cyan-800" />
            <span>Data Charts ({chartData.length})</span>
          </span>
          <button
            type="button"
            onClick={() => setChartData((prev) => [...prev, { title: '', unit: '', items: [{ label: '', value: 0 }] }])}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Chart</span>
          </button>
        </div>
        {chartData.map((ch, cIdx) => (
          <div key={cIdx} className="p-2.5 rounded bg-white border border-slate-200 space-y-2 min-w-0">
            <div className="flex flex-wrap sm:flex-nowrap gap-2 min-w-0">
              <input
                type="text"
                placeholder="Chart title"
                value={ch.title}
                onChange={(e) =>
                  setChartData((prev) => prev.map((x, i) => (i === cIdx ? { ...x, title: e.target.value } : x)))
                }
                className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300"
              />
              <input
                type="text"
                placeholder="Unit (e.g. MPa, Hz)"
                value={ch.unit || ''}
                onChange={(e) =>
                  setChartData((prev) => prev.map((x, i) => (i === cIdx ? { ...x, unit: e.target.value } : x)))
                }
                className="w-full sm:w-28 min-w-0 px-2 py-1 rounded border border-slate-300"
              />
              <button
                type="button"
                onClick={() => setChartData((prev) => prev.filter((_, i) => i !== cIdx))}
                className="text-rose-600 p-1 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              {ch.items.map((pt, pIdx) => (
                <div key={pIdx} className="flex flex-wrap sm:flex-nowrap gap-2 items-center min-w-0">
                  <input
                    type="text"
                    placeholder="Data label"
                    value={pt.label}
                    onChange={(e) =>
                      setChartData((prev) =>
                        prev.map((x, i) =>
                          i === cIdx
                            ? {
                                ...x,
                                items: x.items.map((it, j) => (j === pIdx ? { ...it, label: e.target.value } : it)),
                              }
                            : x
                        )
                      )
                    }
                    className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300"
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Value"
                    value={pt.value}
                    onChange={(e) =>
                      setChartData((prev) =>
                        prev.map((x, i) =>
                          i === cIdx
                            ? {
                                ...x,
                                items: x.items.map((it, j) =>
                                  j === pIdx ? { ...it, value: Number(e.target.value) || 0 } : it
                                ),
                              }
                            : x
                        )
                      )
                    }
                    className="w-24 min-w-0 px-2 py-1 rounded border border-slate-300"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setChartData((prev) =>
                        prev.map((x, i) =>
                          i === cIdx ? { ...x, items: x.items.filter((_, j) => j !== pIdx) } : x
                        )
                      )
                    }
                    className="text-rose-600 p-1 cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setChartData((prev) =>
                    prev.map((x, i) =>
                      i === cIdx ? { ...x, items: [...x.items, { label: '', value: 0 }] } : x
                    )
                  )
                }
                className="text-[11px] text-cyan-800 hover:underline font-semibold cursor-pointer"
              >
                + Add Data Point
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Optional Bill of Materials (BOM) Table */}
      <div className="w-full max-w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <TableIcon className="w-3.5 h-3.5 text-cyan-800" />
            <span>Optional Bill of Materials (BOM) ({bomItems.length})</span>
          </span>
          <button
            type="button"
            onClick={() =>
              setBomItems((prev) => [
                ...prev,
                { partNo: '', name: '', material: '', qty: '', specification: '', notes: '' },
              ])
            }
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add BOM Row</span>
          </button>
        </div>
        {bomItems.map((row, idx) => (
          <div key={idx} className="grid grid-cols-2 sm:grid-cols-6 gap-1.5 items-center bg-white p-2 rounded border border-slate-200 min-w-0">
            <input
              type="text"
              placeholder="Part #"
              value={row.partNo}
              onChange={(e) =>
                setBomItems((prev) => prev.map((b, i) => (i === idx ? { ...b, partNo: e.target.value } : b)))
              }
              className="min-w-0 w-full px-2 py-1 rounded border border-slate-300"
            />
            <input
              type="text"
              placeholder="Component"
              value={row.name}
              onChange={(e) =>
                setBomItems((prev) => prev.map((b, i) => (i === idx ? { ...b, name: e.target.value } : b)))
              }
              className="min-w-0 w-full px-2 py-1 rounded border border-slate-300"
            />
            <input
              type="text"
              placeholder="Material"
              value={row.material}
              onChange={(e) =>
                setBomItems((prev) => prev.map((b, i) => (i === idx ? { ...b, material: e.target.value } : b)))
              }
              className="min-w-0 w-full px-2 py-1 rounded border border-slate-300"
            />
            <input
              type="text"
              placeholder="Qty"
              value={row.qty}
              onChange={(e) =>
                setBomItems((prev) => prev.map((b, i) => (i === idx ? { ...b, qty: e.target.value } : b)))
              }
              className="min-w-0 w-full px-2 py-1 rounded border border-slate-300"
            />
            <input
              type="text"
              placeholder="Specification"
              value={row.specification}
              onChange={(e) =>
                setBomItems((prev) =>
                  prev.map((b, i) => (i === idx ? { ...b, specification: e.target.value } : b))
                )
              }
              className="min-w-0 w-full px-2 py-1 rounded border border-slate-300"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setBomItems((prev) => prev.filter((_, i) => i !== idx))}
                className="text-rose-600 p-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Owner Status + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
        {isOwner ? (
          <div className="flex items-center gap-2 min-w-0">
            <label className="font-bold text-slate-700 shrink-0">Status:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PortfolioArticle['status'])}
              className="px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-50 cursor-pointer"
            >
              <option value="published">Published (Chief Admin)</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2 ml-auto">
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
            <span>
              {initialArticle ? 'Update Article' : isOwner ? 'Publish Article' : 'Submit Article'}
            </span>
          </button>
        </div>
      </div>

      {isOwner && mediaPickerTarget && (
        <MediaLibraryModal
          isOpen={true}
          title={
            mediaPickerTarget === 'thumbnail'
              ? 'Card Image'
              : mediaPickerTarget === 'hero'
              ? 'Hero Media'
              : mediaPickerTarget === 'diagram'
              ? 'Illustrations'
              : mediaPickerTarget === 'image'
              ? 'Images'
              : mediaPickerTarget === 'video'
              ? 'Videos'
              : 'Technical Files'
          }
          defaultBucket="articles"
          defaultFilter={
            (mediaPickerTarget === 'thumbnail' || mediaPickerTarget === 'image' || mediaPickerTarget === 'diagram'
              ? 'image'
              : mediaPickerTarget === 'video'
              ? 'video'
              : mediaPickerTarget === 'hero'
              ? heroMedia.type === 'video'
                ? 'video'
                : 'image'
              : 'document') as MediaLibraryFilter
          }
          allowMultiple={mediaPickerTarget !== 'thumbnail' && mediaPickerTarget !== 'hero'}
          accept={
            mediaPickerTarget === 'thumbnail' || mediaPickerTarget === 'image'
              ? 'image/*'
              : mediaPickerTarget === 'diagram'
              ? 'image/*,.svg'
              : mediaPickerTarget === 'video'
              ? 'video/*'
              : mediaPickerTarget === 'hero'
              ? heroMedia.type === 'video'
                ? 'video/*'
                : 'image/*,.svg'
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
