import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Upload,
  Search,
  RefreshCw,
  Image as ImageIcon,
  Video as VideoIcon,
  FileText,
  Music,
  Eye,
  Check,
  Clock,
  Copy,
  Trash2,
  Loader2,
  Play,
  ExternalLink,
} from 'lucide-react';
import {
  listBucketMediaFiles,
  formatBytes,
  type BucketFileItem,
  type BucketMediaKind,
} from '../utils/portfolioSupabase';
import {
  cleanDisplayFileName,
  formatMediaDuration,
  formatMediaTimestamp,
  getCachedMediaDuration,
  probeMediaDuration,
  runWithConcurrency,
  setCachedMediaDuration,
} from '../utils/mediaMetadata';
import { CleanVideoPlayer } from './CleanVideoPlayer';
import { OptimizedImage } from './OptimizedImage';

export type MediaLibraryBucket = 'projects' | 'articles' | 'materials' | 'avatars';
export type MediaLibraryFilter = 'all' | 'image' | 'video' | 'document';

interface MediaPreviewDialogProps {
  item: BucketFileItem | null;
  durationSec?: number;
  onClose: () => void;
  onDurationResolved?: (url: string, durationSec: number) => void;
  onCopyUrl?: (item: BucketFileItem) => void;
  onDelete?: (item: BucketFileItem) => Promise<void> | void;
  onSelect?: (item: BucketFileItem) => void;
}

export const MediaPreviewDialog: React.FC<MediaPreviewDialogProps> = ({
  item,
  durationSec,
  onClose,
  onDurationResolved,
  onCopyUrl,
  onDelete,
  onSelect,
}) => {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [liveDuration, setLiveDuration] = useState<number | undefined>(durationSec);

  useEffect(() => {
    if (!item) return;
    setLiveDuration(durationSec ?? getCachedMediaDuration(item.publicUrl));
    setCopied(false);
  }, [item, durationSec]);

  if (!item) return null;

  const isPdf = /\.pdf($|\?)/i.test(item.name) || /pdf/i.test(item.mimeType || '');
  const savedTime = formatMediaTimestamp(item.createdAt || item.updatedAt);
  const formattedDur = formatMediaDuration(liveDuration);
  const sizeText = item.size ? formatBytes(item.size) : '';
  const origSizeText =
    item.originalBytes && item.originalBytes > 0 ? formatBytes(item.originalBytes) : '';
  const optSizeText =
    item.optimizedBytes && item.optimizedBytes > 0 ? formatBytes(item.optimizedBytes) : '';

  return (
    <div
      className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${cleanDisplayFileName(item.name)}`}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white border border-slate-300 rounded-xl shadow-2xl overflow-hidden font-serif text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-slate-50 min-w-0">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-slate-950 truncate">
              {cleanDisplayFileName(item.name)}
            </h4>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600 tabular-nums mt-0.5">
              <span className="capitalize">{item.mediaKind}</span>
              <span aria-hidden="true">·</span>
              <span>{item.bucket}</span>
              {item.format && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-cyan-800">{item.format}</span>
                </>
              )}
              {item.optimizedResolution && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{item.optimizedResolution}</span>
                </>
              )}
              {formattedDur && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Duration {formattedDur}</span>
                </>
              )}
              {origSizeText && optSizeText ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {origSizeText} → {optSizeText}
                    {typeof item.compressionPct === 'number' && item.compressionPct > 0
                      ? ` (-${item.compressionPct}%)`
                      : ''}
                  </span>
                </>
              ) : sizeText ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{sizeText}</span>
                </>
              ) : null}
              {savedTime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Saved {savedTime}</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-200 cursor-pointer shrink-0"
            aria-label="Close preview"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 p-3 sm:p-5 flex items-center justify-center min-h-[240px]">
          {item.mediaKind === 'image' ? (
            <OptimizedImage
              src={item.publicUrl}
              webpUrl={item.webpUrl}
              jpegUrl={item.jpegUrl}
              originalUrl={item.originalUrl}
              responsiveUrl={item.responsiveUrl}
              alt={cleanDisplayFileName(item.name)}
              className="max-w-full max-h-[62vh] w-auto h-auto object-contain rounded-lg bg-white border border-slate-200 shadow-xs"
            />
          ) : item.mediaKind === 'video' ? (
            <div className="w-full max-w-2xl rounded-lg overflow-hidden shadow-sm">
              <CleanVideoPlayer
                src={item.publicUrl}
                title={cleanDisplayFileName(item.name)}
                mediaId={item.path}
                poster={item.posterUrl}
                av1Urls={item.av1Urls}
                h264Urls={
                  item.h264Urls ||
                  (item.fallbackVideoUrl
                    ? { '1080p': item.hdVideoUrl || item.fallbackVideoUrl, '720p': item.fallbackVideoUrl }
                    : undefined)
                }
                vttThumbnailsUrl={item.vttThumbnailsUrl}
                autoPlay
                aspectRatio="16/9"
                objectFit="contain"
                onDurationResolved={(dur) => {
                  setCachedMediaDuration(item.publicUrl, dur);
                  setLiveDuration(dur);
                  onDurationResolved?.(item.publicUrl, dur);
                }}
              />
            </div>
          ) : item.mediaKind === 'audio' ? (
            <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-5 flex flex-col items-center gap-3">
              <Music className="w-10 h-10 text-cyan-800" />
              <audio
                src={item.publicUrl}
                controls
                onLoadedMetadata={(e) => {
                  const dur = e.currentTarget.duration;
                  if (dur && Number.isFinite(dur) && dur > 0) {
                    setCachedMediaDuration(item.publicUrl, dur);
                    setLiveDuration(dur);
                    onDurationResolved?.(item.publicUrl, dur);
                  }
                }}
                className="w-full"
              />
            </div>
          ) : isPdf ? (
            <iframe
              src={item.publicUrl}
              title={cleanDisplayFileName(item.name)}
              className="w-full h-[60vh] rounded-lg border border-slate-300 bg-white"
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-3 max-w-md">
              <FileText className="w-10 h-10 text-cyan-800 mx-auto" />
              <p className="text-xs text-slate-700 break-words">
                {cleanDisplayFileName(item.name)}
              </p>
              <a
                href={item.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open File</span>
              </a>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-200 bg-white text-xs">
          <span className="text-[11px] text-slate-500 truncate max-w-full sm:max-w-sm">
            {item.path}
          </span>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => {
                if (onCopyUrl) {
                  onCopyUrl(item);
                } else {
                  navigator.clipboard?.writeText(item.publicUrl).catch(() => {});
                }
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy URL'}</span>
            </button>

            {onDelete && (
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDelete(item);
                    onClose();
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold cursor-pointer disabled:opacity-60"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete</span>
              </button>
            )}

            {onSelect && (
              <button
                type="button"
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white font-semibold cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Use This File</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface MediaLibraryModalProps {
  isOpen: boolean;
  title: string;
  defaultBucket: MediaLibraryBucket;
  defaultFilter?: MediaLibraryFilter;
  allowMultiple?: boolean;
  accept?: string;
  onUploadFiles: (files: FileList) => void;
  onSelectExisting: (items: BucketFileItem[]) => void;
  onClose: () => void;
}

export const MediaLibraryModal: React.FC<MediaLibraryModalProps> = ({
  isOpen,
  title,
  defaultBucket,
  defaultFilter = 'all',
  allowMultiple = false,
  accept,
  onUploadFiles,
  onSelectExisting,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [bucket, setBucket] = useState<MediaLibraryBucket>(defaultBucket);
  const [filterKind, setFilterKind] = useState<MediaLibraryFilter>(defaultFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [files, setFiles] = useState<BucketFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMap, setSelectedMap] = useState<Record<string, BucketFileItem>>({});
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [previewItem, setPreviewItem] = useState<BucketFileItem | null>(null);

  const loadBucketFiles = async (targetBucket: MediaLibraryBucket) => {
    setLoading(true);
    try {
      const items = await listBucketMediaFiles(targetBucket);
      setFiles(items);

      const initialDurs: Record<string, number> = {};
      const toProbe: BucketFileItem[] = [];
      for (const it of items) {
        const cached = getCachedMediaDuration(it.publicUrl);
        if (cached !== undefined) {
          initialDurs[it.publicUrl] = cached;
        } else if (it.mediaKind === 'video' || it.mediaKind === 'audio') {
          toProbe.push(it);
        }
      }
      if (Object.keys(initialDurs).length > 0) {
        setDurations((prev) => ({ ...prev, ...initialDurs }));
      }

      if (toProbe.length > 0) {
        void runWithConcurrency(toProbe.slice(0, 24), 3, async (vid) => {
          const sec = await probeMediaDuration(vid.publicUrl, vid.mediaKind === 'audio' ? 'audio' : 'video');
          if (sec && sec > 0) {
            setDurations((prev) => ({ ...prev, [vid.publicUrl]: sec }));
          }
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setBucket(defaultBucket);
    setFilterKind(defaultFilter);
    setSearchQuery('');
    setSelectedMap({});
    setPreviewItem(null);
    void loadBucketFiles(defaultBucket);
  }, [isOpen, defaultBucket, defaultFilter]);

  const handleBucketChange = (nextBucket: MediaLibraryBucket) => {
    setBucket(nextBucket);
    void loadBucketFiles(nextBucket);
  };

  const filteredFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return files.filter((item) => {
      if (filterKind !== 'all') {
        if (filterKind === 'document') {
          if (item.mediaKind !== 'document' && item.mediaKind !== 'audio') return false;
        } else if (item.mediaKind !== filterKind) {
          return false;
        }
      }
      if (q) {
        const displayName = cleanDisplayFileName(item.name).toLowerCase();
        if (!displayName.includes(q) && !item.path.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [files, filterKind, searchQuery]);

  if (!isOpen) return null;

  const selectedList = Object.values(selectedMap);

  const toggleMultiItem = (item: BucketFileItem) => {
    const key = `${item.bucket}/${item.path}`;
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = item;
      return next;
    });
  };

  const renderThumb = (item: BucketFileItem) => {
    const dur = durations[item.publicUrl] ?? getCachedMediaDuration(item.publicUrl);
    const formattedDur = formatMediaDuration(dur);

    if (item.mediaKind === 'image') {
      return (
        <div className="relative w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden bg-slate-200 border border-slate-200 shrink-0">
          <img
            src={item.publicUrl}
            alt={cleanDisplayFileName(item.name)}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      );
    }
    if (item.mediaKind === 'video') {
      return (
        <div className="relative w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
          {item.posterUrl ? (
            <img
              src={item.posterUrl}
              alt={cleanDisplayFileName(item.name)}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-85"
            />
          ) : null}
          <Play className="w-4 h-4 text-white fill-white/80 absolute" />
          {formattedDur && (
            <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/80 text-white text-[9px] font-mono tabular-nums">
              {formattedDur}
            </span>
          )}
        </div>
      );
    }
    if (item.mediaKind === 'audio') {
      return (
        <div className="w-16 h-12 sm:w-20 sm:h-14 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center shrink-0">
          <Music className="w-5 h-5 text-cyan-800" />
        </div>
      );
    }
    return (
      <div className="w-16 h-12 sm:w-20 sm:h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
        <FileText className="w-5 h-5 text-slate-700" />
      </div>
    );
  };

  const renderKindIcon = (kind: BucketMediaKind) => {
    if (kind === 'image') return <ImageIcon className="w-3 h-3 shrink-0 text-cyan-800" />;
    if (kind === 'video') return <VideoIcon className="w-3 h-3 shrink-0 text-cyan-800" />;
    if (kind === 'audio') return <Music className="w-3 h-3 shrink-0 text-cyan-800" />;
    return <FileText className="w-3 h-3 shrink-0 text-slate-600" />;
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Upload or Select Media — ${title}`}
      >
        <div
          className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-white border border-[#b8c6d4] rounded-xl shadow-2xl overflow-hidden font-serif text-slate-900"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-950 truncate">{title}</h3>
              <p className="text-[11px] text-slate-600">
                Upload a new file from your device or select an existing file from your Media Library
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-950 hover:bg-slate-200 cursor-pointer shrink-0"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Upload From Device Action Bar */}
          <div className="px-4 py-3 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              multiple={allowMultiple}
              onChange={(e) => {
                const chosen = e.target.files;
                if (chosen && chosen.length > 0) {
                  onUploadFiles(chosen);
                  onClose();
                }
                e.currentTarget.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-xs font-semibold cursor-pointer shadow-xs whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{allowMultiple ? 'Upload New Files from Device' : 'Upload New File from Device'}</span>
            </button>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(['projects', 'articles', 'materials', 'avatars'] as MediaLibraryBucket[]).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => handleBucketChange(b)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                    bucket === b
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Filter & Search Toolbar */}
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'image', label: 'Images' },
                  { id: 'video', label: 'Videos' },
                  { id: 'document', label: 'Files' },
                ] as { id: MediaLibraryFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterKind(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                    filterKind === tab.id
                      ? 'bg-cyan-800 text-white'
                      : 'text-slate-600 hover:text-slate-950'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-1 min-w-[180px] max-w-xs">
              <div className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Media Library..."
                  className="w-full pl-8 pr-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-700"
                />
              </div>
              <button
                type="button"
                onClick={() => loadBucketFiles(bucket)}
                disabled={loading}
                className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer shrink-0"
                title="Refresh stored files"
                aria-label="Refresh stored files"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Stored Files List */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-slate-50/40">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-800" />
                <span>Loading stored files from "{bucket}"...</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 space-y-1">
                <p className="font-semibold text-slate-700">No matching stored files in "{bucket}"</p>
                <p>Switch buckets, adjust the filter, or click "Upload New File from Device" above.</p>
              </div>
            ) : (
              filteredFiles.map((item) => {
                const key = `${item.bucket}/${item.path}`;
                const isSelected = Boolean(selectedMap[key]);
                const dur = durations[item.publicUrl] ?? getCachedMediaDuration(item.publicUrl);
                const formattedDur = formatMediaDuration(dur);
                const savedAt = formatMediaTimestamp(item.createdAt || item.updatedAt);
                const sizeText = item.size ? formatBytes(item.size) : '';

                return (
                  <div
                    key={key}
                    className={`p-2.5 rounded-xl border bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                      isSelected
                        ? 'border-cyan-700 ring-1 ring-cyan-700/30 bg-cyan-50/30'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="cursor-pointer shrink-0 focus:outline-none group relative"
                        title="Click to preview"
                      >
                        {renderThumb(item)}
                      </button>

                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="text-left text-xs font-bold text-slate-950 hover:text-cyan-800 truncate block max-w-full cursor-pointer"
                        >
                          {cleanDisplayFileName(item.name)}
                        </button>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 tabular-nums mt-0.5">
                          <span className="inline-flex items-center gap-1 capitalize text-slate-700 font-medium">
                            {renderKindIcon(item.mediaKind)}
                            <span>{item.mediaKind}</span>
                          </span>
                          {formattedDur && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-0.5 text-slate-700 font-medium">
                                <Clock className="w-3 h-3" />
                                <span>{formattedDur}</span>
                              </span>
                            </>
                          )}
                          {sizeText && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{sizeText}</span>
                            </>
                          )}
                          {item.format && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-cyan-800 font-semibold">{item.format}</span>
                            </>
                          )}
                          {typeof item.compressionPct === 'number' && item.compressionPct > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-emerald-700 font-semibold">-{item.compressionPct}%</span>
                            </>
                          )}
                          {savedAt && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{savedAt}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewItem(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Preview</span>
                      </button>

                      {allowMultiple ? (
                        <button
                          type="button"
                          onClick={() => toggleMultiItem(item)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-800 text-white'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>{isSelected ? 'Selected' : 'Select'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectExisting([item]);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          <Check className="w-3 h-3" />
                          <span>Select</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Multi-select Footer */}
          {allowMultiple && (
            <div className="px-4 py-2.5 border-t border-slate-200 bg-white flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-600 tabular-nums">
                {selectedList.length === 0
                  ? 'Select one or more stored files'
                  : `${selectedList.length} file${selectedList.length > 1 ? 's' : ''} selected`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={selectedList.length === 0}
                  onClick={() => {
                    if (selectedList.length === 0) return;
                    onSelectExisting(selectedList);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white font-semibold cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Use Selected ({selectedList.length})</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <MediaPreviewDialog
        item={previewItem}
        durationSec={previewItem ? durations[previewItem.publicUrl] : undefined}
        onClose={() => setPreviewItem(null)}
        onDurationResolved={(url, sec) => {
          setDurations((prev) => ({ ...prev, [url]: sec }));
        }}
        onSelect={(chosen) => {
          onSelectExisting([chosen]);
          onClose();
        }}
      />
    </>
  );
};
