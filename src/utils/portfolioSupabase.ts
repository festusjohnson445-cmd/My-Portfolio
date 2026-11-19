import { useEffect, useState } from 'react';
import {
  supabase,
  getResolvedSupabaseConfig,
  getValidatedSession,
  isRealOwnerUser,
} from './supabase';
import { probeLocalFileDuration, setCachedMediaDuration } from './mediaMetadata';

// ============================================================================
// TYPES: PROJECTS, ARTICLES, COMMENTS, PROFILE EXTENSIONS, SITE SETTINGS
// ============================================================================

export interface ProjectSpecification {
  label: string;
  value: string;
}

export interface MediaAssetItem {
  title: string;
  url: string;
  note?: string;
  fileName?: string;
  fileSize?: string;
  fileType?: string;
  avifUrl?: string;
  webpUrl?: string;
  jpegUrl?: string;
  mobileUrl?: string;
  posterUrl?: string;
  vttThumbnailsUrl?: string;
  av1Urls?: { '720p'?: string; '1080p'?: string };
  h264Urls?: { '720p'?: string; '1080p'?: string };
  subtitleUrl?: string;
  mediaAssetId?: string;
  width?: number;
  height?: number;
  resolution?: string;
  originalBytes?: number;
  optimizedBytes?: number;
  compressionPct?: number;
  format?: string;
}

export interface MediaAssetRecord {
  id: string;
  bucket: string;
  storagePath: string;
  mediaType: 'image' | 'video' | 'document';
  fileName: string;
  format: string;
  resolution?: string;
  width?: number;
  height?: number;
  durationSec?: number;
  originalBytes: number;
  optimizedBytes: number;
  compressionPct: number;
  status: 'processing' | 'completed' | 'failed';
  primaryUrl: string;
  avifUrl?: string;
  webpUrl?: string;
  jpegUrl?: string;
  mobileUrl?: string;
  av1Urls?: { '720p'?: string; '1080p'?: string };
  h264Urls?: { '720p'?: string; '1080p'?: string };
  posterUrl?: string;
  vttThumbnailsUrl?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface UploadBucketResult {
  publicUrl: string;
  storagePath: string;
  fileName: string;
  fileSize: string;
  durationSec?: number;
  avifUrl?: string;
  webpUrl?: string;
  jpegUrl?: string;
  mobileUrl?: string;
  posterUrl?: string;
  vttThumbnailsUrl?: string;
  av1Urls?: { '720p'?: string; '1080p'?: string };
  h264Urls?: { '720p'?: string; '1080p'?: string };
  width?: number;
  height?: number;
  resolution?: string;
  originalBytes?: number;
  optimizedBytes?: number;
  compressionPct?: number;
  format?: string;
  mediaAssetId?: string;
}

export interface LinkItem {
  label: string;
  url: string;
}

export interface PortfolioProject {
  id: string;
  slug: string;
  ownerId?: string;
  title: string;
  category: string;
  description: string;
  overview: string;
  objectives: string;
  methodology: string;
  specifications: ProjectSpecification[];
  cadDrawings: MediaAssetItem[];
  isCadProject: boolean;
  cadModelType?: 'harmonic_actuator' | 'gimbal_bracket' | 'planetary_gearbox' | 'chassis_suspension' | '';
  thumbnailUrl: string;
  images: MediaAssetItem[];
  videos: MediaAssetItem[];
  toolsUsed: string[];
  results: string;
  demoLinks: LinkItem[];
  documents: MediaAssetItem[];
  isFeatured: boolean;
  status: 'draft' | 'published' | 'archived';
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleHeroMedia {
  type: 'image' | 'video' | 'diagram' | 'cad3d' | 'none';
  url?: string;
  caption?: string;
  cadModelType?: 'harmonic_actuator' | 'gimbal_bracket' | 'planetary_gearbox' | 'chassis_suspension';
  avifUrl?: string;
  webpUrl?: string;
  jpegUrl?: string;
  mobileUrl?: string;
  posterUrl?: string;
  vttThumbnailsUrl?: string;
  av1Urls?: { '720p'?: string; '1080p'?: string };
  h264Urls?: { '720p'?: string; '1080p'?: string };
  subtitleUrl?: string;
  mediaAssetId?: string;
}

export interface ArticleCodeBlock {
  title: string;
  language: string;
  code: string;
}

export interface ArticleChartData {
  title: string;
  unit?: string;
  items: { label: string; value: number }[];
}

export interface ArticleBomItem {
  partNo: string;
  name: string;
  material: string;
  qty: string;
  specification: string;
  notes?: string;
}

export interface PortfolioArticle {
  id: string;
  slug: string;
  ownerId?: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  difficultyLevel: string;
  readingTime: string;
  authorName: string;
  isAdminAuthor: boolean;
  thumbnailUrl: string;
  heroMedia: ArticleHeroMedia;
  tldr: string;
  toc: string[];
  images: MediaAssetItem[];
  videos: MediaAssetItem[];
  diagrams: MediaAssetItem[];
  codeBlocks: ArticleCodeBlock[];
  chartData: ArticleChartData[];
  bomItems: ArticleBomItem[];
  attachments: MediaAssetItem[];
  tags: string[];
  likesCount: number;
  status: 'draft' | 'pending' | 'published' | 'archived';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleComment {
  id: string;
  articleId: string;
  authorName: string;
  authorRole: string;
  contentMarkdown: string;
  status: 'pending' | 'approved' | 'rejected' | 'archived';
  createdAt: string;
}

export interface ProfileExperience {
  id: string;
  roleTitle: string;
  organization: string;
  location: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  summary: string;
  highlights: string[];
  sortOrder?: number;
}

export interface ProfilePublication {
  id: string;
  title: string;
  venueOrJournal: string;
  year: string;
  authors: string;
  doiOrUrl: string;
  abstract: string;
  category: string;
  attachmentUrl?: string;
  sortOrder?: number;
}

export interface ProfileAchievement {
  id: string;
  title: string;
  issuer: string;
  dateStr: string;
  category: string;
  description: string;
  certificateUrl?: string;
  verified: boolean;
  sortOrder?: number;
}

// ============================================================================
// WEBSITE SETTINGS, THEMES, APPEARANCE & PAGE SECTION MANAGERS
// ============================================================================

export interface StoredThemePreset {
  id: string;
  name: string;
  description?: string;
  pageBg: string;
  surfaceBg: string;
  cardBg: string;
  textColor: string;
  mutedTextColor: string;
  accentColor: string;
  borderColor: string;
  footerBg: string;
  navbarBg: string;
  isDark?: boolean;
  isCustom?: boolean;
}

export type HeroAnimationEffectId = 'precision-grid' | 'orbital-pulse' | 'blueprint-scan';

export interface CustomPageContentSection {
  id: string;
  targetPage: 'projects' | 'articles' | 'both';
  title: string;
  subtitle?: string;
  body: string;
  badgeText?: string;
  textAlign: 'left' | 'center' | 'right';
  visible: boolean;
}

export interface ProjectsArticlesManagerConfig {
  customSections: CustomPageContentSection[];
  innerLayout: {
    gridColumns: 2 | 3 | 4;
    cardSpacing: 'compact' | 'normal' | 'relaxed';
    cardTextAlign: 'left' | 'center' | 'justify';
  };
  videoCardControls: {
    aspectRatio: '16/9' | '4/3' | '1/1' | '21/9';
    objectFit: 'cover' | 'contain' | 'fill';
    zoomLevel: number; // 1.0 to 1.5
  };
}

export type BuiltInProfileSectionId =
  | 'bio'
  | 'experience'
  | 'publications'
  | 'achievements'
  | 'credentials'
  | 'followMe';

export interface BuiltInProfileSectionConfig {
  id: BuiltInProfileSectionId;
  label: string;
  visible: boolean;
}

export type CustomProfileTemplateType =
  | 'rich-essay'
  | 'two-col-cards'
  | 'timeline'
  | 'metrics-grid'
  | 'media-showcase';

export interface CustomProfileSectionItem {
  heading: string;
  subheading?: string;
  detail: string;
  mediaUrl?: string;
}

export interface CustomProfileSection {
  id: string;
  template: CustomProfileTemplateType;
  title: string;
  subtitle?: string;
  body?: string;
  mediaUrl?: string;
  items: CustomProfileSectionItem[];
  visible: boolean;
}

export interface ProfileSectionManagerConfig {
  builtInSections: BuiltInProfileSectionConfig[];
  customSections: CustomProfileSection[];
}

export type FooterLockPosition =
  | 'inline-end'
  | 'inline-start'
  | 'bottom-left'
  | 'bottom-right'
  | 'center-below';

export interface CustomFooterSection {
  id: string;
  heading: string;
  content: string;
}

export interface FooterConfig {
  copyrightText: string;
  textAlign: 'left' | 'center' | 'right';
  justifyContent: 'start' | 'center' | 'between' | 'around';
  fontSize: '10px' | '11px' | '12px' | '13px' | '14px';
  lockIconPosition: FooterLockPosition;
  customSections: CustomFooterSection[];
}

export interface CommentStyleConfig {
  fontFamily: string;
  fontSize: string;
}

export interface WebsiteAppearanceConfig {
  activeThemeId: string;
  storedThemes: StoredThemePreset[];
  heroAnimationEffect: HeroAnimationEffectId;
  heroAnimationEnabled: boolean;
  cardAnimationEnabled: boolean;
  heroBackgroundImageUrl: string;
  projectsArticlesConfig: ProjectsArticlesManagerConfig;
  profileSectionManager: ProfileSectionManagerConfig;
  footerConfig: FooterConfig;
  commentStyleConfig: CommentStyleConfig;
}

export interface WebsiteSettings {
  id: string;
  siteTitle: string;
  siteTagline: string;
  allowVisitorArticles: boolean;
  requireArticleApproval: boolean;
  requireCommentApproval: boolean;
  adminAuthorLabel: string;
  appearanceConfig: WebsiteAppearanceConfig;
  updatedAt?: string;
}

export const BUILT_IN_THEMES: StoredThemePreset[] = [
  {
    id: 'classic-slate',
    name: 'Fesline Classic Slate',
    description: 'Signature steel slate blue canvas with crisp cyan engineering accents',
    pageBg: '#dce1e8',
    surfaceBg: '#edf2f8',
    cardBg: '#ffffff',
    textColor: '#0f172a',
    mutedTextColor: '#475569',
    accentColor: '#164e63',
    borderColor: '#b8c6d4',
    footerBg: '#d2d8e1',
    navbarBg: 'rgba(214, 220, 228, 0.95)',
    isDark: false,
  },
  {
    id: 'midnight-titanium',
    name: 'Midnight Titanium Lab',
    description: 'Deep aerospace slate dark theme with bright cyan highlights',
    pageBg: '#0b111e',
    surfaceBg: '#162033',
    cardBg: '#1e293b',
    textColor: '#f1f5f9',
    mutedTextColor: '#94a3b8',
    accentColor: '#0891b2',
    borderColor: '#334155',
    footerBg: '#0f172a',
    navbarBg: 'rgba(15, 23, 42, 0.94)',
    isDark: true,
  },
  {
    id: 'warm-parchment',
    name: 'Warm Engineering Parchment',
    description: 'Classic academic archival parchment with bronze-amber accent',
    pageBg: '#efe9dd',
    surfaceBg: '#f7f3ea',
    cardBg: '#fffdf9',
    textColor: '#1c1917',
    mutedTextColor: '#57534e',
    accentColor: '#9a3412',
    borderColor: '#d6cbb8',
    footerBg: '#e5ddd0',
    navbarBg: 'rgba(239, 233, 221, 0.95)',
    isDark: false,
  },
  {
    id: 'clean-ivory',
    name: 'Technical Blueprint Ivory',
    description: 'High-contrast clean ivory canvas with cobalt blueprint accents',
    pageBg: '#f1f5f9',
    surfaceBg: '#f8fafc',
    cardBg: '#ffffff',
    textColor: '#0f172a',
    mutedTextColor: '#475569',
    accentColor: '#1d4ed8',
    borderColor: '#cbd5e1',
    footerBg: '#e2e8f0',
    navbarBg: 'rgba(241, 245, 249, 0.95)',
    isDark: false,
  },
  {
    id: 'forest-graphite',
    name: 'Forest Graphite Precision',
    description: 'Calm sage-graphite lab palette with deep emerald accents',
    pageBg: '#dfe7e2',
    surfaceBg: '#edf3ef',
    cardBg: '#ffffff',
    textColor: '#0f2419',
    mutedTextColor: '#3f5a4c',
    accentColor: '#065f46',
    borderColor: '#b2c5ba',
    footerBg: '#d2ddd6',
    navbarBg: 'rgba(223, 231, 226, 0.95)',
    isDark: false,
  },
];

export const DEFAULT_BUILT_IN_PROFILE_SECTIONS: BuiltInProfileSectionConfig[] = [
  { id: 'bio', label: 'Bio & About', visible: true },
  { id: 'experience', label: 'Experience & Career', visible: true },
  { id: 'publications', label: 'Research & Publications', visible: true },
  { id: 'achievements', label: 'Achievements, Awards & Skills', visible: true },
  { id: 'credentials', label: 'Verified Documents & Credentials', visible: true },
  { id: 'followMe', label: 'Follow Me', visible: true },
];

export const DEFAULT_APPEARANCE_CONFIG: WebsiteAppearanceConfig = {
  activeThemeId: 'classic-slate',
  storedThemes: BUILT_IN_THEMES,
  heroAnimationEffect: 'precision-grid',
  heroAnimationEnabled: true,
  cardAnimationEnabled: true,
  heroBackgroundImageUrl: '',
  projectsArticlesConfig: {
    customSections: [],
    innerLayout: {
      gridColumns: 3,
      cardSpacing: 'normal',
      cardTextAlign: 'justify',
    },
    videoCardControls: {
      aspectRatio: '16/9',
      objectFit: 'cover',
      zoomLevel: 1,
    },
  },
  profileSectionManager: {
    builtInSections: DEFAULT_BUILT_IN_PROFILE_SECTIONS,
    customSections: [],
  },
  footerConfig: {
    copyrightText: '© 2026 Festus, Olorunsogo Johnson · Fesline Mechanical Engineering',
    textAlign: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    lockIconPosition: 'inline-end',
    customSections: [],
  },
  commentStyleConfig: {
    fontFamily: '"Times New Roman", Times, serif',
    fontSize: '12px',
  },
};

export type BucketMediaKind = 'image' | 'video' | 'audio' | 'document';

export interface BucketFileItem {
  bucket: string;
  name: string;
  path: string;
  publicUrl: string;
  size?: number;
  mimeType?: string;
  mediaKind: BucketMediaKind;
  createdAt?: string;
  updatedAt?: string;
  avifUrl?: string;
  webpUrl?: string;
  jpegUrl?: string;
  mobileUrl?: string;
  responsiveUrl?: string;
  originalUrl?: string;
  posterUrl?: string;
  vttThumbnailsUrl?: string;
  av1Urls?: { '720p'?: string; '1080p'?: string };
  h264Urls?: { '720p'?: string; '1080p'?: string };
  fallbackVideoUrl?: string;
  hdVideoUrl?: string;
  format?: string;
  optimizedResolution?: string;
  originalBytes?: number;
  optimizedBytes?: number;
  compressionPct?: number;
}

export function inferBucketMediaKind(name: string, mimeType?: string): BucketMediaKind {
  const mime = (mimeType || '').toLowerCase();
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (
    mime.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg', 'bmp', 'tif', 'tiff'].includes(ext)
  ) {
    return 'image';
  }
  if (
    mime.startsWith('video/') ||
    ['mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi'].includes(ext)
  ) {
    return 'video';
  }
  if (
    mime.startsWith('audio/') ||
    ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)
  ) {
    return 'audio';
  }
  return 'document';
}

export function slugifyText(input: string): string {
  const base = (input || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'item'}-${Date.now().toString(36)}`;
}

export function estimateReadingTime(text: string): string {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(1, Math.ceil(words / 200));
  return `${mins} min read`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// STORAGE UPLOAD HELPERS ("projects" & "articles" buckets + MEDIA PIPELINE)
// ============================================================================

export type UploadProgressCallback = (progress: number, stage: string) => void;

function isOptimizableRasterImage(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.type === 'image/svg+xml' || ext === 'svg') return false;
  return (
    file.type.startsWith('image/') ||
    ['jpg', 'jpeg', 'png', 'webp', 'avif', 'bmp', 'tiff', 'tif'].includes(ext)
  );
}

function isOptimizableVideo(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  return (
    file.type.startsWith('video/') ||
    ['mp4', 'mov', 'webm', 'm4v', 'mkv'].includes(ext)
  );
}

async function getPipelineAuthHeaders(): Promise<Record<string, string>> {
  const cfg = getResolvedSupabaseConfig();
  const headers: Record<string, string> = {
    'x-supabase-url': cfg.url,
    'x-supabase-anon-key': cfg.anonKey,
  };
  try {
    let { data } = await supabase.auth.getSession();
    if (data?.session?.expires_at && data.session.expires_at * 1000 < Date.now() + 300_000) {
      const refreshed = await supabase.auth.refreshSession().catch(() => null);
      if (refreshed?.data?.session) data = refreshed.data;
    }
    if (data?.session?.access_token) {
      headers['Authorization'] = `Bearer ${data.session.access_token}`;
    }
  } catch {}
  return headers;
}

function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = 30_000, signal: callerSignal, ...rest } = init;
  const timeoutController = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    timeoutController.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, timeoutMs);

  const onCallerAbort = () => {
    timeoutController.abort(callerSignal?.reason || new DOMException('Upload cancelled', 'AbortError'));
  };
  if (callerSignal) {
    if (callerSignal.aborted) {
      clearTimeout(timer);
      return Promise.reject(new DOMException('Upload cancelled', 'AbortError'));
    }
    callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }

  return fetch(url, { ...rest, signal: timeoutController.signal }).catch((err) => {
    if (timedOut && !callerSignal?.aborted) {
      throw new Error('Network request timed out.');
    }
    throw err;
  }).finally(() => {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  });
}

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binStr = atob(base64);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

async function optimizeImageInBrowserCanvas(
  file: File
): Promise<{ blob: Blob; mimeType: string; fileName: string }> {
  let bitmap: ImageBitmap | HTMLImageElement;
  let width = 0;
  let height = 0;
  let needsCloseBitmap = false;

  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      bitmap = bmp;
      width = bmp.width;
      height = bmp.height;
      needsCloseBitmap = true;
    } catch {
      const img = await loadHtmlImageFromFile(file);
      bitmap = img;
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
    }
  } else {
    const img = await loadHtmlImageFromFile(file);
    bitmap = img;
    width = img.naturalWidth || img.width;
    height = img.naturalHeight || img.height;
  }

  try {
    if (!width || !height) {
      return { blob: file, mimeType: file.type || 'image/jpeg', fileName: file.name };
    }
    const maxW = 1600;
    const scale = width > maxW ? maxW / width : 1;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { blob: file, mimeType: file.type || 'image/jpeg', fileName: file.name };
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    // Strip EXIF inherently via canvas redraw; prefer AVIF -> WebP -> JPEG at compact crisp q=0.78
    const tryExport = (mime: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), mime, 0.78));

    const stem = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const avifBlob = await tryExport('image/avif');
    if (avifBlob && avifBlob.type === 'image/avif' && avifBlob.size > 0) {
      return { blob: avifBlob, mimeType: 'image/avif', fileName: `${stem}.avif` };
    }
    const webpBlob = await tryExport('image/webp');
    if (webpBlob && webpBlob.type === 'image/webp' && webpBlob.size > 0) {
      return { blob: webpBlob, mimeType: 'image/webp', fileName: `${stem}.webp` };
    }
    const jpegBlob = await tryExport('image/jpeg');
    if (jpegBlob && jpegBlob.size > 0) {
      return { blob: jpegBlob, mimeType: 'image/jpeg', fileName: `${stem}.jpg` };
    }
    return { blob: file, mimeType: file.type || 'image/jpeg', fileName: file.name };
  } finally {
    if (needsCloseBitmap && typeof (bitmap as ImageBitmap).close === 'function') {
      try {
        (bitmap as ImageBitmap).close();
      } catch {}
    }
  }
}

function loadHtmlImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(objUrl);
      reject(e);
    };
    img.src = objUrl;
  });
}

async function uploadBlobDirectToBucket(params: {
  bucket: 'projects' | 'articles' | 'materials' | 'avatars';
  blob: Blob;
  fileName: string;
  contentType: string;
  folderPrefix?: string;
  explicitStoragePath?: string;
}): Promise<{ publicUrl: string; storagePath: string; fileName: string; fileSize: string }> {
  const cleanName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePrefix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let ownerPrefix = params.folderPrefix || '';
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user && isRealOwnerUser(data.session.user)) {
      ownerPrefix = ownerPrefix || data.session.user.id;
    }
  } catch {}

  const pathParts = [ownerPrefix || 'submissions', `${uniquePrefix}_${cleanName}`].filter(Boolean);
  const storagePath = params.explicitStoragePath || pathParts.join('/');

  const { error: uploadError } = await supabase.storage
    .from(params.bucket)
    .upload(storagePath, params.blob, {
      contentType: params.contentType || 'application/octet-stream',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload to "${params.bucket}" failed: ${uploadError.message}`);
  }

  const { data: pub } = supabase.storage.from(params.bucket).getPublicUrl(storagePath);
  if (!pub?.publicUrl) {
    throw new Error(`Could not resolve public URL in bucket "${params.bucket}"`);
  }

  return {
    publicUrl: pub.publicUrl,
    storagePath,
    fileName: params.fileName,
    fileSize: formatBytes(params.blob.size),
  };
}

export function isAbortError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as any;
  return (
    anyErr?.name === 'AbortError' ||
    anyErr?.code === 20 ||
    /abort|cancell?ed/i.test(String(anyErr?.message || ''))
  );
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Upload cancelled', 'AbortError');
  }
}

async function cancelServerVideoJob(jobId: string): Promise<void> {
  try {
    await fetch(`/api/media/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
  } catch {}
}

const STORAGE_KEY_MEDIA_ASSETS_CACHE = 'fesline_media_assets_v1';
let memoryMediaAssetsCache: MediaAssetRecord[] | null = null;

function hydrateLocalMediaAssets(): MediaAssetRecord[] {
  if (memoryMediaAssetsCache) return memoryMediaAssetsCache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEDIA_ASSETS_CACHE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        memoryMediaAssetsCache = parsed;
        return parsed;
      }
    }
  } catch {}
  return [];
}

function persistLocalMediaAssets(list: MediaAssetRecord[]) {
  memoryMediaAssetsCache = list.slice(0, 200);
  try {
    localStorage.setItem(STORAGE_KEY_MEDIA_ASSETS_CACHE, JSON.stringify(memoryMediaAssetsCache));
  } catch {}
}

export async function saveMediaAssetRecord(record: MediaAssetRecord): Promise<void> {
  const existing = hydrateLocalMediaAssets();
  const next = [record, ...existing.filter((r) => r.id !== record.id)];
  persistLocalMediaAssets(next);

  try {
    await supabase.from('media_assets').upsert(
      {
        id: record.id,
        bucket: record.bucket,
        storage_path: record.storagePath,
        media_type: record.mediaType,
        file_name: record.fileName,
        format: record.format,
        resolution: record.resolution || '',
        width: record.width || null,
        height: record.height || null,
        duration_sec: record.durationSec || null,
        original_bytes: record.originalBytes || 0,
        optimized_bytes: record.optimizedBytes || 0,
        compression_pct: record.compressionPct || 0,
        status: record.status,
        primary_url: record.primaryUrl,
        fallback_urls: {
          avifUrl: record.avifUrl,
          webpUrl: record.webpUrl,
          jpegUrl: record.jpegUrl,
          mobileUrl: record.mobileUrl,
          av1Urls: record.av1Urls,
          h264Urls: record.h264Urls,
        },
        poster_url: record.posterUrl || null,
        vtt_thumbnails_url: record.vttThumbnailsUrl || null,
        error_message: record.errorMessage || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );
  } catch {}
}

export async function fetchMediaAssetsFromSupabase(bucket?: string): Promise<MediaAssetRecord[]> {
  const local = hydrateLocalMediaAssets();
  const filteredLocal = bucket ? local.filter((r) => r.bucket === bucket) : local;
  try {
    let query = supabase
      .from('media_assets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);
    if (bucket) {
      query = query.eq('bucket', bucket);
    }
    const { data, error } = await query;
    if (error || !Array.isArray(data)) return filteredLocal;
    const mapped: MediaAssetRecord[] = data.map((row: any) => {
      const fb = row.fallback_urls && typeof row.fallback_urls === 'object' ? row.fallback_urls : {};
      return {
        id: row.id,
        bucket: row.bucket || 'projects',
        storagePath: row.storage_path || '',
        mediaType: (row.media_type as MediaAssetRecord['mediaType']) || 'image',
        fileName: row.file_name || 'asset',
        format: row.format || 'avif',
        resolution: row.resolution || '',
        width: typeof row.width === 'number' ? row.width : undefined,
        height: typeof row.height === 'number' ? row.height : undefined,
        durationSec: typeof row.duration_sec === 'number' ? row.duration_sec : undefined,
        originalBytes: Number(row.original_bytes) || 0,
        optimizedBytes: Number(row.optimized_bytes) || 0,
        compressionPct: Number(row.compression_pct) || 0,
        status: (row.status as MediaAssetRecord['status']) || 'completed',
        primaryUrl: row.primary_url || '',
        avifUrl: fb.avifUrl,
        webpUrl: fb.webpUrl,
        jpegUrl: fb.jpegUrl,
        mobileUrl: fb.mobileUrl,
        av1Urls: fb.av1Urls,
        h264Urls: fb.h264Urls,
        posterUrl: row.poster_url || undefined,
        vttThumbnailsUrl: row.vtt_thumbnails_url || undefined,
        errorMessage: row.error_message || undefined,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at,
      };
    });
    persistLocalMediaAssets(mapped);
    return mapped;
  } catch {
    return local;
  }
}

export async function deleteMediaAssetRecord(id: string): Promise<void> {
  const local = hydrateLocalMediaAssets().filter((r) => r.id !== id);
  persistLocalMediaAssets(local);
  try {
    await supabase.from('media_assets').delete().eq('id', id);
  } catch {}
}

export async function fetchServerMediaJobs(): Promise<any[]> {
  try {
    const resp = await fetch('/api/media/jobs');
    if (!resp.ok) return [];
    const json = await resp.json().catch(() => null);
    return Array.isArray(json?.jobs) ? json.jobs : [];
  } catch {
    return [];
  }
}

export async function retryServerVideoJob(jobId: string): Promise<{ success: boolean; message?: string }> {
  try {
    const headers = await getPipelineAuthHeaders();
    const resp = await fetch(`/api/media/jobs/${encodeURIComponent(jobId)}/retry`, {
      method: 'POST',
      headers,
    });
    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json?.success) {
      return { success: false, message: json?.message || 'Retry failed.' };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Retry request failed.' };
  }
}

export async function uploadFileToBucket(
  bucket: 'projects' | 'articles' | 'materials' | 'avatars',
  file: File,
  folderPrefix = '',
  onProgress?: UploadProgressCallback,
  signal?: AbortSignal,
  retryJobId?: string
): Promise<UploadBucketResult> {
  throwIfAborted(signal);

  // Route Projects & Articles raster images through Sharp multi-format AVIF/WebP/JPEG pipeline
  if ((bucket === 'projects' || bucket === 'articles') && isOptimizableRasterImage(file)) {
    onProgress?.(25, 'Optimizing image...');
    try {
      const authHeaders = await getPipelineAuthHeaders();
      throwIfAborted(signal);
      const formData = new FormData();
      formData.append('bucket', bucket);
      formData.append('folderPrefix', folderPrefix || 'images');
      formData.append('file', file);

      const resp = await fetchWithTimeout('/api/media/optimize-image', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
        signal,
        timeoutMs: 45_000,
      });
      throwIfAborted(signal);
      const json = await resp.json().catch(() => null);

      if (resp.ok && json?.success) {
        const assetId = `ma_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        if (json.publicUrl) {
          await saveMediaAssetRecord({
            id: assetId,
            bucket,
            storagePath: json.storagePath,
            mediaType: 'image',
            fileName: json.fileName,
            format: json.format || 'avif',
            resolution: json.resolution,
            width: json.width,
            height: json.height,
            originalBytes: json.originalBytes || file.size,
            optimizedBytes: json.optimizedBytes || 0,
            compressionPct: json.compressionPct || 0,
            status: 'completed',
            primaryUrl: json.publicUrl,
            avifUrl: json.avifUrl || json.publicUrl,
            webpUrl: json.webpUrl,
            jpegUrl: json.jpegUrl,
            mobileUrl: json.mobileUrl,
            createdAt: new Date().toISOString(),
          });
          onProgress?.(100, `Saved optimized AVIF (${json.fileSize})`);
          return {
            publicUrl: json.publicUrl,
            avifUrl: json.avifUrl || json.publicUrl,
            webpUrl: json.webpUrl,
            jpegUrl: json.jpegUrl,
            mobileUrl: json.mobileUrl,
            storagePath: json.storagePath,
            fileName: json.fileName,
            fileSize: json.fileSize,
            width: json.width,
            height: json.height,
            resolution: json.resolution,
            originalBytes: json.originalBytes || file.size,
            optimizedBytes: json.optimizedBytes,
            compressionPct: json.compressionPct,
            format: json.format || 'avif',
            mediaAssetId: assetId,
          };
        }

        if (json.directUploadRequired) {
          onProgress?.(72, `Uploading optimized variants (${json.fileSize}) to "${bucket}"...`);
          const variantUrls: Record<string, string> = {};
          let primaryUploaded: { publicUrl: string; storagePath: string; fileName: string; fileSize: string } | null = null;

          const variants: Array<{
            key: string;
            storagePath: string;
            fileName: string;
            mimeType: string;
            base64: string;
          }> = Array.isArray(json.variants) && json.variants.length > 0
            ? json.variants
            : json.optimizedBase64
            ? [
                {
                  key: 'avif',
                  storagePath: json.storagePath,
                  fileName: json.fileName || `${file.name}.avif`,
                  mimeType: json.mimeType || 'image/avif',
                  base64: json.optimizedBase64,
                },
              ]
            : [];

          for (const v of variants) {
            throwIfAborted(signal);
            const blob = base64ToBlob(v.base64, v.mimeType);
            const uploaded = await uploadBlobDirectToBucket({
              bucket,
              blob,
              fileName: v.fileName,
              contentType: v.mimeType,
              folderPrefix: folderPrefix || 'images',
              explicitStoragePath: v.storagePath,
            });
            variantUrls[v.key] = uploaded.publicUrl;
            if (v.key === 'avif' || !primaryUploaded) {
              primaryUploaded = uploaded;
            }
          }

          if (primaryUploaded) {
            await saveMediaAssetRecord({
              id: assetId,
              bucket,
              storagePath: primaryUploaded.storagePath,
              mediaType: 'image',
              fileName: primaryUploaded.fileName,
              format: json.format || 'avif',
              resolution: json.resolution,
              width: json.width,
              height: json.height,
              originalBytes: json.originalBytes || file.size,
              optimizedBytes: json.optimizedBytes || 0,
              compressionPct: json.compressionPct || 0,
              status: 'completed',
              primaryUrl: primaryUploaded.publicUrl,
              avifUrl: variantUrls.avif || primaryUploaded.publicUrl,
              webpUrl: variantUrls.webp,
              jpegUrl: variantUrls.jpeg,
              mobileUrl: variantUrls.mobile || variantUrls.avif,
              createdAt: new Date().toISOString(),
            });
            onProgress?.(100, `Saved optimized AVIF (${primaryUploaded.fileSize})`);
            return {
              ...primaryUploaded,
              avifUrl: variantUrls.avif || primaryUploaded.publicUrl,
              webpUrl: variantUrls.webp,
              jpegUrl: variantUrls.jpeg,
              mobileUrl: variantUrls.mobile || variantUrls.avif,
              width: json.width,
              height: json.height,
              resolution: json.resolution,
              originalBytes: json.originalBytes || file.size,
              optimizedBytes: json.optimizedBytes,
              compressionPct: json.compressionPct,
              format: json.format || 'avif',
              mediaAssetId: assetId,
            };
          }
        }
      }
    } catch (serverImgErr) {
      if (isAbortError(serverImgErr) || signal?.aborted) {
        throw new DOMException('Upload cancelled', 'AbortError');
      }
      console.warn('[Image Pipeline] Server optimization failed, using EXIF-stripped canvas AVIF/WebP optimizer:', serverImgErr);
    }

    throwIfAborted(signal);
    // Client EXIF-stripped 1600px optimized fallback (never uploads raw unoptimized file)
    onProgress?.(55, 'Optimizing image...');
    const optimized = await optimizeImageInBrowserCanvas(file);
    throwIfAborted(signal);
    onProgress?.(82, `Uploading optimized image to "${bucket}"...`);
    const directRes = await uploadBlobDirectToBucket({
      bucket,
      blob: optimized.blob,
      fileName: optimized.fileName,
      contentType: optimized.mimeType,
      folderPrefix: folderPrefix || 'images',
    });
    const assetId = `ma_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const pct = file.size > 0 ? Math.round(((file.size - optimized.blob.size) / file.size) * 1000) / 10 : 0;
    await saveMediaAssetRecord({
      id: assetId,
      bucket,
      storagePath: directRes.storagePath,
      mediaType: 'image',
      fileName: directRes.fileName,
      format: optimized.mimeType.split('/')[1] || 'webp',
      originalBytes: file.size,
      optimizedBytes: optimized.blob.size,
      compressionPct: pct,
      status: 'completed',
      primaryUrl: directRes.publicUrl,
      createdAt: new Date().toISOString(),
    });
    onProgress?.(100, `Saved optimized image (${directRes.fileSize})`);
    return {
      ...directRes,
      originalBytes: file.size,
      optimizedBytes: optimized.blob.size,
      compressionPct: pct,
      format: optimized.mimeType.split('/')[1] || 'webp',
      mediaAssetId: assetId,
    };
  }

  // Route Projects & Articles videos through idempotent 1.5MB chunked upload + fast background FFmpeg pipeline
  if ((bucket === 'projects' || bucket === 'articles') && isOptimizableVideo(file)) {
    onProgress?.(5, 'Preparing video upload...');
    const localDurationPromise = probeLocalFileDuration(file);
    const authHeaders = await getPipelineAuthHeaders();
    throwIfAborted(signal);

    let jobId = '';
    let initialProgress = 42;
    let initialStage = 'Optimizing video...';
    let abortListener: (() => void) | null = null;

    const attachAbortListener = (id: string) => {
      if (abortListener) return;
      abortListener = () => {
        void cancelServerVideoJob(id);
      };
      signal?.addEventListener('abort', abortListener, { once: true });
    };

    const pollVideoJobUntilDone = async (
      activeJobId: string,
      startProgress: number,
      startStage: string
    ): Promise<UploadBucketResult> => {
      attachAbortListener(activeJobId);
      onProgress?.(startProgress, startStage);

      const maxWaitMs = 30 * 60 * 1000;
      const stallTimeoutMs = 4 * 60 * 1000;
      const startedAt = Date.now();
      let lastServerUpdate = Date.now();
      let lastObservedServerTs = 0;
      let consecutivePollErrors = 0;

      while (Date.now() - startedAt < maxWaitMs) {
        throwIfAborted(signal);
        await new Promise((r) => setTimeout(r, 900));
        throwIfAborted(signal);

        let statusResp: Response;
        try {
          statusResp = await fetchWithTimeout(`/api/media/jobs/${encodeURIComponent(activeJobId)}`, {
            signal,
            timeoutMs: 15_000,
          });
        } catch (pollErr: any) {
          if (isAbortError(pollErr) || signal?.aborted) throw pollErr;
          consecutivePollErrors++;
          if (consecutivePollErrors >= 8) {
            const err: any = new Error('Lost connection while checking video optimization progress.');
            err.jobId = activeJobId;
            throw err;
          }
          continue;
        }

        const statusJson = await statusResp.json().catch(() => null);
        if (!statusResp.ok || !statusJson?.job) {
          consecutivePollErrors++;
          if (statusResp.status === 404 || consecutivePollErrors >= 8) {
            const err: any = new Error(statusJson?.message || 'Lost connection to video optimization job.');
            if (statusResp.status !== 404) err.jobId = activeJobId;
            throw err;
          }
          continue;
        }
        consecutivePollErrors = 0;

        const job = statusJson.job;
        if (typeof job.updatedAt === 'number' && job.updatedAt > lastObservedServerTs) {
          lastObservedServerTs = job.updatedAt;
          lastServerUpdate = Date.now();
        }
        if (Date.now() - lastServerUpdate > stallTimeoutMs) {
          const err: any = new Error('Video optimization stalled on server. Click Retry to resume.');
          err.jobId = activeJobId;
          throw err;
        }

        onProgress?.(job.progress || 50, job.stage || 'Optimizing video...');

        if (job.status === 'cancelled') {
          throw new DOMException('Upload cancelled', 'AbortError');
        }

        if (job.status === 'completed' && job.publicUrl) {
          const localDur = await localDurationPromise;
          const resolvedDuration = typeof job.durationSec === 'number' && job.durationSec > 0 ? job.durationSec : localDur;
          if (resolvedDuration) setCachedMediaDuration(job.publicUrl, resolvedDuration);
          await saveMediaAssetRecord({
            id: job.jobId,
            bucket,
            storagePath: job.storagePath || '',
            mediaType: 'video',
            fileName: job.fileName || file.name,
            format: job.format || 'h264',
            resolution: job.resolution,
            width: job.width,
            height: job.height,
            durationSec: resolvedDuration,
            originalBytes: job.originalBytes || file.size,
            optimizedBytes: job.bytes || 0,
            compressionPct: job.compressionPct || 0,
            status: 'completed',
            primaryUrl: job.publicUrl,
            av1Urls: job.av1Urls,
            h264Urls: job.h264Urls,
            createdAt: new Date().toISOString(),
          });
          return {
            publicUrl: job.publicUrl,
            storagePath: job.storagePath,
            fileName: job.fileName || file.name,
            fileSize: job.fileSize || formatBytes(job.bytes || file.size),
            durationSec: resolvedDuration,
            av1Urls: job.av1Urls,
            h264Urls: job.h264Urls,
            width: job.width,
            height: job.height,
            resolution: job.resolution,
            originalBytes: job.originalBytes || file.size,
            optimizedBytes: job.bytes,
            compressionPct: job.compressionPct,
            format: job.format,
            mediaAssetId: job.jobId,
          };
        }

        if (job.status === 'ready_for_client_upload') {
          onProgress?.(94, `Saving optimized video (${job.fileSize || ''})...`);
          const artifactsList: Array<{
            key: string;
            downloadUrl: string;
            storagePath: string;
            fileName: string;
            contentType: string;
            bytes: number;
          }> = Array.isArray(job.handoffArtifacts) && job.handoffArtifacts.length > 0
            ? job.handoffArtifacts
            : [
                {
                  key: 'video',
                  downloadUrl: job.directUploadUrl,
                  storagePath: job.storagePath,
                  fileName: job.fileName || `${file.name.replace(/\.[^/.]+$/, '')}.mp4`,
                  contentType: 'video/mp4',
                  bytes: job.bytes || 0,
                },
              ];

          const uploadedByKey: Record<string, { publicUrl: string; storagePath: string; fileName: string; fileSize: string }> = {};
          for (const art of artifactsList) {
            throwIfAborted(signal);
            const blobResp = await fetchWithTimeout(art.downloadUrl, { signal, timeoutMs: 90_000 });
            if (!blobResp.ok) {
              const err: any = new Error(`Failed to retrieve optimized video (${art.key}) from server.`);
              err.jobId = activeJobId;
              throw err;
            }
            const artBlob = await blobResp.blob();
            throwIfAborted(signal);
            uploadedByKey[art.key] = await uploadBlobDirectToBucket({
              bucket,
              blob: artBlob,
              fileName: art.fileName,
              contentType: art.contentType,
              folderPrefix: folderPrefix || 'videos',
              explicitStoragePath: art.storagePath,
            });
          }

          const primary =
            uploadedByKey.video ||
            uploadedByKey.h264_720p ||
            uploadedByKey.h264_1080p ||
            uploadedByKey.av1_720p ||
            uploadedByKey.av1_1080p ||
            Object.values(uploadedByKey)[0];

          const h264Urls = { '720p': primary.publicUrl };

          await fetchWithTimeout(`/api/media/jobs/${encodeURIComponent(activeJobId)}/complete-handoff`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              publicUrl: primary.publicUrl,
              h264Urls,
            }),
            timeoutMs: 15_000,
          }).catch(() => {});

          const localDur = await localDurationPromise;
          const resolvedDuration = typeof job.durationSec === 'number' && job.durationSec > 0 ? job.durationSec : localDur;
          if (resolvedDuration) setCachedMediaDuration(primary.publicUrl, resolvedDuration);

          await saveMediaAssetRecord({
            id: activeJobId,
            bucket,
            storagePath: primary.storagePath,
            mediaType: 'video',
            fileName: primary.fileName,
            format: job.format || 'h264',
            resolution: job.resolution,
            width: job.width,
            height: job.height,
            durationSec: resolvedDuration,
            originalBytes: job.originalBytes || file.size,
            optimizedBytes: job.bytes || 0,
            compressionPct: job.compressionPct || 0,
            status: 'completed',
            primaryUrl: primary.publicUrl,
            h264Urls,
            createdAt: new Date().toISOString(),
          });

          onProgress?.(100, `Saved optimized video (${primary.fileSize})`);
          return {
            ...primary,
            durationSec: resolvedDuration,
            h264Urls,
            width: job.width,
            height: job.height,
            resolution: job.resolution,
            originalBytes: job.originalBytes || file.size,
            optimizedBytes: job.bytes,
            compressionPct: job.compressionPct,
            format: job.format,
            mediaAssetId: activeJobId,
          };
        }

        if (job.status === 'failed') {
          await saveMediaAssetRecord({
            id: activeJobId,
            bucket,
            storagePath: '',
            mediaType: 'video',
            fileName: file.name,
            format: 'h264',
            originalBytes: file.size,
            optimizedBytes: 0,
            compressionPct: 0,
            status: 'failed',
            primaryUrl: '',
            errorMessage: job.error || 'Background video optimization failed.',
            createdAt: new Date().toISOString(),
          });
          const err: any = new Error(job.error || 'Background video optimization failed.');
          err.jobId = activeJobId;
          throw err;
        }
      }
      const timeoutErr: any = new Error('Video optimization timed out.');
      timeoutErr.jobId = activeJobId;
      throw timeoutErr;
    };

    try {
      // If a previous server jobId exists, try resuming/retrying it first without re-uploading raw video bytes
      if (retryJobId) {
        onProgress?.(42, 'Resuming optimization on server...');
        try {
          const checkResp = await fetchWithTimeout(`/api/media/jobs/${encodeURIComponent(retryJobId)}`, {
            signal,
            timeoutMs: 12_000,
          });
          const checkJson = await checkResp.json().catch(() => null);
          const existingJob = checkJson?.job;
          if (existingJob) {
            if (
              existingJob.status === 'queued' ||
              existingJob.status === 'processing' ||
              existingJob.status === 'uploading' ||
              existingJob.status === 'ready_for_client_upload' ||
              existingJob.status === 'completed'
            ) {
              return await pollVideoJobUntilDone(
                retryJobId,
                existingJob.progress || 50,
                existingJob.stage || 'Resuming optimization...'
              );
            }
            if (existingJob.status === 'failed') {
              const retryResp = await fetchWithTimeout(
                `/api/media/jobs/${encodeURIComponent(retryJobId)}/retry`,
                {
                  method: 'POST',
                  headers: await getPipelineAuthHeaders(),
                  signal,
                  timeoutMs: 15_000,
                }
              );
              const retryJson = await retryResp.json().catch(() => null);
              if (retryResp.ok && retryJson?.success) {
                return await pollVideoJobUntilDone(retryJobId, 42, 'Retrying video optimization...');
              }
            }
          }
        } catch (retryCheckErr: any) {
          if (isAbortError(retryCheckErr) || signal?.aborted) throw retryCheckErr;
        }
      }

      // Retry /init up to 3 times; use 1.5MB chunks so uploads never hit proxy limits or stall
      const CHUNK_SIZE = 1.5 * 1024 * 1024;
      let initResp: Response | null = null;
      let initErrMsg = '';
      for (let initAttempt = 0; initAttempt < 3; initAttempt++) {
        throwIfAborted(signal);
        try {
          initResp = await fetchWithTimeout('/api/media/optimize-video/init', {
            method: 'POST',
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bucket,
              folderPrefix: folderPrefix || 'videos',
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type || 'video/mp4',
            }),
            signal,
            timeoutMs: 15_000,
          });
          if (initResp.ok) break;
          initErrMsg = `HTTP ${initResp.status}`;
        } catch (err: any) {
          if (isAbortError(err) || signal?.aborted) throw err;
          initErrMsg = err?.message || 'Connection error';
        }
        if (initAttempt < 2) {
          await new Promise((r) => setTimeout(r, 350 * (initAttempt + 1)));
        }
      }

      throwIfAborted(signal);

      if (initResp && initResp.ok) {
        const initJson = await initResp.json().catch(() => null);
        if (!initJson?.success || !initJson?.jobId) {
          throw new Error(initJson?.message || 'Unable to initialize video upload session.');
        }
        jobId = initJson.jobId;
        attachAbortListener(jobId);

        const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
        for (let i = 0; i < totalChunks; i++) {
          throwIfAborted(signal);
          const start = i * CHUNK_SIZE;
          const end = Math.min(file.size, start + CHUNK_SIZE);
          const slice = file.slice(start, end);
          const chunkPct = 8 + Math.round(((i + 1) / totalChunks) * 32);
          onProgress?.(chunkPct, `Uploading video (${Math.round(((i + 1) / totalChunks) * 100)}%)...`);

          let chunkOk = false;
          let lastChunkErr = '';
          for (let attempt = 0; attempt < 3 && !chunkOk; attempt++) {
            throwIfAborted(signal);
            try {
              const chunkResp = await fetchWithTimeout(
                `/api/media/optimize-video/chunk/${encodeURIComponent(jobId)}?offset=${start}&index=${i}`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/octet-stream',
                  },
                  body: slice,
                  signal,
                  timeoutMs: 45_000,
                }
              );
              const cJson = await chunkResp.json().catch(() => null);
              if (chunkResp.ok && cJson?.success) {
                chunkOk = true;
              } else {
                lastChunkErr = cJson?.message || `Chunk upload failed (HTTP ${chunkResp.status}).`;
                if (chunkResp.status === 404) break;
              }
            } catch (e: any) {
              if (isAbortError(e) || signal?.aborted) throw e;
              lastChunkErr = e?.message || 'Network interrupted during chunk upload.';
            }
            if (!chunkOk && attempt < 2) {
              await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
            }
          }
          if (!chunkOk) {
            void cancelServerVideoJob(jobId);
            throw new Error(lastChunkErr || 'Video upload failed.');
          }
        }

        throwIfAborted(signal);
        onProgress?.(41, 'Starting optimization...');
        const refreshedAuthHeaders = await getPipelineAuthHeaders();
        const finishResp = await fetchWithTimeout(
          `/api/media/optimize-video/finish/${encodeURIComponent(jobId)}`,
          {
            method: 'POST',
            headers: refreshedAuthHeaders,
            signal,
            timeoutMs: 25_000,
          }
        );
        const finishJson = await finishResp.json().catch(() => null);
        if (!finishResp.ok || !finishJson?.success || !finishJson?.jobId) {
          void cancelServerVideoJob(jobId);
          throw new Error(finishJson?.message || `Unable to start video optimization (HTTP ${finishResp.status}).`);
        }
        initialProgress = finishJson.progress || 42;
        initialStage = finishJson.stage || 'Optimizing video...';
      } else if (file.size <= 3.5 * 1024 * 1024) {
        // Only small videos (<= 3.5MB) fall back to single-request upload; large files never exceed Cloud Run 32MB body limit
        onProgress?.(15, 'Uploading compact video...');
        const formData = new FormData();
        formData.append('bucket', bucket);
        formData.append('folderPrefix', folderPrefix || 'videos');
        formData.append('file', file);

        const startResp = await fetchWithTimeout('/api/media/optimize-video', {
          method: 'POST',
          headers: authHeaders,
          body: formData,
          signal,
          timeoutMs: 45_000,
        });
        throwIfAborted(signal);
        const startJson = await startResp.json().catch(() => null);
        if (!startResp.ok || !startJson?.success || !startJson?.jobId) {
          const statusHint = startResp.status ? ` (HTTP ${startResp.status})` : '';
          throw new Error(startJson?.message || `Unable to start server video optimization job${statusHint}.`);
        }
        jobId = startJson.jobId;
        initialProgress = startJson.progress || 42;
        initialStage = startJson.stage || 'Optimizing video...';
      } else {
        throw new Error(`Unable to initialize chunked video upload (${initErrMsg || 'server unavailable'}). Please retry.`);
      }

      return await pollVideoJobUntilDone(jobId, initialProgress, initialStage);
    } finally {
      if (abortListener) {
        signal?.removeEventListener('abort', abortListener);
      }
    }
  }

  throwIfAborted(signal);
  // Direct Supabase Storage upload for non-raster/non-video assets (PDF, CAD, SVG, materials, avatars)
  onProgress?.(35, `Uploading ${file.name}...`);
  const uploadedAsset = await uploadBlobDirectToBucket({
    bucket,
    blob: file,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    folderPrefix,
  });
  const localDur = file.type.startsWith('video/') || file.type.startsWith('audio/') ? await probeLocalFileDuration(file) : undefined;
  if (localDur) setCachedMediaDuration(uploadedAsset.publicUrl, localDur);
  onProgress?.(100, 'Uploaded');
  return { ...uploadedAsset, durationSec: localDur };
}

// ============================================================================
// PROJECTS CRUD (SUPABASE "projects" TABLE)
// ============================================================================

function mapDbRowToProject(row: any): PortfolioProject {
  return {
    id: row.id,
    slug: row.slug || row.id,
    ownerId: row.owner_id,
    title: row.title || '',
    category: row.category || 'Mechanical Design',
    description: row.description || '',
    overview: row.overview || '',
    objectives: row.objectives || '',
    methodology: row.methodology || '',
    specifications: Array.isArray(row.specifications) ? row.specifications : [],
    cadDrawings: Array.isArray(row.cad_drawings) ? row.cad_drawings : [],
    isCadProject: Boolean(row.is_cad_project),
    cadModelType: row.cad_model_type || '',
    thumbnailUrl: row.thumbnail_url || '',
    images: Array.isArray(row.images) ? row.images : [],
    videos: Array.isArray(row.videos) ? row.videos : [],
    toolsUsed: Array.isArray(row.tools_used) ? row.tools_used : [],
    results: row.results || '',
    demoLinks: Array.isArray(row.demo_links) ? row.demo_links : [],
    documents: Array.isArray(row.documents) ? row.documents : [],
    isFeatured: Boolean(row.is_featured),
    status: (row.status as PortfolioProject['status']) || 'published',
    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

const STORAGE_KEY_PROJECTS_CACHE = 'fesline_projects_cache_v1';
let memoryProjectsCache: PortfolioProject[] | null = null;
let hasFetchedProjectsOnce = false;

export const EVENT_PROJECTS_UPDATED = 'fesline_projects_updated';

export function getCachedProjects(includeAllForOwner = false): PortfolioProject[] {
  let list: PortfolioProject[] = memoryProjectsCache || [];
  if (!memoryProjectsCache) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROJECTS_CACHE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryProjectsCache = parsed;
          list = parsed;
        }
      }
    } catch {}
  }
  return includeAllForOwner ? list : list.filter((p) => p.status === 'published');
}

export function hasProjectsCacheHydrated(): boolean {
  return hasFetchedProjectsOnce || (memoryProjectsCache !== null && memoryProjectsCache.length > 0);
}

function setCachedProjects(list: PortfolioProject[]) {
  memoryProjectsCache = list;
  hasFetchedProjectsOnce = true;
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS_CACHE, JSON.stringify(list));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_PROJECTS_UPDATED, { detail: list }));
  }
}

export async function fetchProjectsFromSupabase(includeAllForOwner = false): Promise<PortfolioProject[]> {
  try {
    let query = supabase
      .from('projects')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (!includeAllForOwner) {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) {
      return getCachedProjects(includeAllForOwner);
    }
    const mapped = data.map(mapDbRowToProject);
    setCachedProjects(mapped);
    return mapped;
  } catch {
    return getCachedProjects(includeAllForOwner);
  }
}

export async function upsertProjectToSupabase(
  project: Omit<PortfolioProject, 'id' | 'slug' | 'createdAt' | 'updatedAt'> & { id?: string; slug?: string }
): Promise<PortfolioProject> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) {
    throw new Error('Owner authentication required to publish or modify projects.');
  }

  const now = new Date().toISOString();
  const id = project.id || `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const slug = project.slug || slugifyText(project.title);

  const dbPayload = {
    id,
    slug,
    owner_id: user.id,
    title: project.title.trim(),
    category: project.category.trim() || 'Mechanical Design',
    description: project.description.trim(),
    overview: project.overview.trim(),
    objectives: project.objectives.trim(),
    methodology: project.methodology.trim(),
    specifications: project.specifications || [],
    cad_drawings: project.cadDrawings || [],
    is_cad_project: Boolean(project.isCadProject),
    cad_model_type: project.cadModelType || '',
    thumbnail_url: project.thumbnailUrl.trim(),
    images: project.images || [],
    videos: project.videos || [],
    tools_used: project.toolsUsed || [],
    results: project.results.trim(),
    demo_links: project.demoLinks || [],
    documents: project.documents || [],
    is_featured: Boolean(project.isFeatured),
    status: project.status || 'published',
    sort_order: project.sortOrder || 0,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('projects')
    .upsert(dbPayload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message || 'Failed to save project to Supabase.');
  }
  const saved = mapDbRowToProject(data);
  const current = getCachedProjects(true);
  const updated = current.some((p) => p.id === saved.id)
    ? current.map((p) => (p.id === saved.id ? saved : p))
    : [saved, ...current];
  setCachedProjects(updated);
  return saved;
}

export async function deleteProjectFromSupabase(projectId: string): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) {
    throw new Error('Owner authentication required to delete projects.');
  }
  const { error } = await supabase.from('projects').delete().eq('id', projectId);
  if (error) {
    throw new Error(error.message || 'Failed to delete project.');
  }
  const current = getCachedProjects(true);
  setCachedProjects(current.filter((p) => p.id !== projectId));
}

// ============================================================================
// ARTICLES & COMMENTS CRUD (SUPABASE "articles" & "article_comments")
// ============================================================================

function mapDbRowToArticle(row: any): PortfolioArticle {
  return {
    id: row.id,
    slug: row.slug || row.id,
    ownerId: row.owner_id,
    title: row.title || '',
    summary: row.summary || '',
    content: row.content || '',
    category: row.category || 'Engineering',
    difficultyLevel: row.difficulty_level || 'Intermediate',
    readingTime: row.reading_time || estimateReadingTime(row.content || ''),
    authorName: row.author_name || 'Contributor',
    isAdminAuthor: Boolean(row.is_admin_author),
    thumbnailUrl: row.thumbnail_url || '',
    heroMedia: row.hero_media && typeof row.hero_media === 'object' ? row.hero_media : { type: 'none' },
    tldr: row.tldr || '',
    toc: Array.isArray(row.toc) ? row.toc : [],
    images: Array.isArray(row.images) ? row.images : [],
    videos: Array.isArray(row.videos) ? row.videos : [],
    diagrams: Array.isArray(row.diagrams) ? row.diagrams : [],
    codeBlocks: Array.isArray(row.code_blocks) ? row.code_blocks : [],
    chartData: Array.isArray(row.chart_data) ? row.chart_data : [],
    bomItems: Array.isArray(row.bom_items) ? row.bom_items : [],
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    likesCount: typeof row.likes_count === 'number' ? row.likes_count : 0,
    status: (row.status as PortfolioArticle['status']) || 'pending',
    publishedAt: row.published_at || row.created_at,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

const STORAGE_KEY_ARTICLES_CACHE = 'fesline_articles_cache_v1';
let memoryArticlesCache: PortfolioArticle[] | null = null;
let hasFetchedArticlesOnce = false;

export const EVENT_ARTICLES_UPDATED = 'fesline_articles_updated';

export function getCachedArticles(includeAllForOwner = false): PortfolioArticle[] {
  let list: PortfolioArticle[] = memoryArticlesCache || [];
  if (!memoryArticlesCache) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ARTICLES_CACHE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryArticlesCache = parsed;
          list = parsed;
        }
      }
    } catch {}
  }
  return includeAllForOwner ? list : list.filter((a) => a.status === 'published');
}

export function hasArticlesCacheHydrated(): boolean {
  return hasFetchedArticlesOnce || (memoryArticlesCache !== null && memoryArticlesCache.length > 0);
}

function setCachedArticles(list: PortfolioArticle[]) {
  memoryArticlesCache = list;
  hasFetchedArticlesOnce = true;
  try {
    localStorage.setItem(STORAGE_KEY_ARTICLES_CACHE, JSON.stringify(list));
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_ARTICLES_UPDATED, { detail: list }));
  }
}

export async function fetchArticlesFromSupabase(includeAllForOwner = false): Promise<PortfolioArticle[]> {
  try {
    let query = supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!includeAllForOwner) {
      query = query.eq('status', 'published');
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) {
      return getCachedArticles(includeAllForOwner);
    }
    const mapped = data.map(mapDbRowToArticle);
    setCachedArticles(mapped);
    return mapped;
  } catch {
    return getCachedArticles(includeAllForOwner);
  }
}

export async function submitOrSaveArticleToSupabase(
  article: Omit<PortfolioArticle, 'id' | 'slug' | 'likesCount' | 'createdAt' | 'updatedAt'> & {
    id?: string;
    slug?: string;
    likesCount?: number;
  },
  isOwnerSubmitting: boolean
): Promise<PortfolioArticle> {
  let ownerId: string | null = null;
  if (isOwnerSubmitting) {
    const { user } = await getValidatedSession();
    if (!isRealOwnerUser(user)) {
      throw new Error('Valid owner authentication required.');
    }
    ownerId = user.id;
  }

  const now = new Date().toISOString();
  const id = article.id || `art_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const slug = article.slug || slugifyText(article.title);
  const status: PortfolioArticle['status'] = isOwnerSubmitting
    ? article.status || 'published'
    : 'pending';

  const dbPayload: Record<string, any> = {
    id,
    slug,
    owner_id: ownerId,
    title: article.title.trim(),
    summary: article.summary.trim(),
    content: article.content.trim(),
    category: article.category.trim(),
    difficulty_level: article.difficultyLevel || 'Intermediate',
    reading_time: article.readingTime.trim() || estimateReadingTime(article.content),
    author_name: article.authorName.trim(),
    is_admin_author: isOwnerSubmitting,
    thumbnail_url: article.thumbnailUrl.trim(),
    hero_media: article.heroMedia || { type: 'none' },
    tldr: article.tldr.trim(),
    toc: article.toc || [],
    images: article.images || [],
    videos: article.videos || [],
    diagrams: article.diagrams || [],
    code_blocks: article.codeBlocks || [],
    chart_data: article.chartData || [],
    bom_items: article.bomItems || [],
    attachments: article.attachments || [],
    tags: article.tags || [],
    status,
    published_at: status === 'published' ? (article.publishedAt || now) : null,
    updated_at: now,
  };

  if (isOwnerSubmitting) {
    const { data, error } = await supabase
      .from('articles')
      .upsert(dbPayload, { onConflict: 'id' })
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message || 'Failed to save article.');
    }
    const saved = mapDbRowToArticle(data);
    const current = getCachedArticles(true);
    const updated = current.some((a) => a.id === saved.id)
      ? current.map((a) => (a.id === saved.id ? saved : a))
      : [saved, ...current];
    setCachedArticles(updated);
    return saved;
  } else {
    const { error } = await supabase.from('articles').insert(dbPayload);
    if (error) {
      throw new Error(error.message || 'Failed to submit article for review.');
    }
    return mapDbRowToArticle({ ...dbPayload, likes_count: 0, created_at: now });
  }
}

export async function updateArticleStatusInSupabase(
  articleId: string,
  status: PortfolioArticle['status']
): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('articles')
    .update({
      status,
      published_at: status === 'published' ? now : undefined,
      updated_at: now,
    })
    .eq('id', articleId);
  if (error) throw new Error(error.message);
  const current = getCachedArticles(true);
  setCachedArticles(
    current.map((a) =>
      a.id === articleId ? { ...a, status, publishedAt: status === 'published' ? now : a.publishedAt } : a
    )
  );
}

export async function deleteArticleFromSupabase(articleId: string): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const { error } = await supabase.from('articles').delete().eq('id', articleId);
  if (error) throw new Error(error.message);
  const current = getCachedArticles(true);
  setCachedArticles(current.filter((a) => a.id !== articleId));
}

export async function incrementArticleLikesInSupabase(articleId: string): Promise<number> {
  const count = await toggleArticleLikeInSupabase(articleId, 1);
  return typeof count === 'number' ? count : 0;
}

export async function toggleArticleLikeInSupabase(
  articleId: string,
  delta: 1 | -1,
  fallbackNextCount?: number
): Promise<number | null> {
  try {
    if (delta > 0) {
      const { data, error } = await supabase.rpc('increment_article_likes', {
        target_article_id: articleId,
      });
      if (!error && typeof data === 'number') {
        const current = getCachedArticles(true);
        setCachedArticles(
          current.map((a) => (a.id === articleId ? { ...a, likesCount: data } : a))
        );
        return data;
      }
    } else {
      const { data: decData, error: decError } = await supabase.rpc('decrement_article_likes', {
        target_article_id: articleId,
      });
      if (!decError && typeof decData === 'number') {
        const safeCount = Math.max(0, decData);
        const current = getCachedArticles(true);
        setCachedArticles(
          current.map((a) => (a.id === articleId ? { ...a, likesCount: safeCount } : a))
        );
        return safeCount;
      }
    }

    if (typeof fallbackNextCount === 'number') {
      const safeTarget = Math.max(0, fallbackNextCount);
      const { data: updData, error: updError } = await supabase
        .from('articles')
        .update({ likes_count: safeTarget })
        .eq('id', articleId)
        .select('likes_count')
        .maybeSingle();
      if (!updError && updData && typeof updData.likes_count === 'number') {
        const current = getCachedArticles(true);
        setCachedArticles(
          current.map((a) => (a.id === articleId ? { ...a, likesCount: updData.likes_count } : a))
        );
        return updData.likes_count;
      }
    }
  } catch {}
  return null;
}

// ============================================================================
// COMMENTS CRUD & MODERATION
// ============================================================================

const STORAGE_KEY_COMMENTS_BY_ARTICLE = 'fesline_article_comments_v1';
let memoryCommentsCache: ArticleComment[] | null = null;
const memoryCommentsByArticle = new Map<string, ArticleComment[]>();
let commentsStorageHydrated = false;

function hydrateCommentsByArticleStorage() {
  if (commentsStorageHydrated) return;
  commentsStorageHydrated = true;
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COMMENTS_BY_ARTICLE);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [aid, arr] of Object.entries(parsed)) {
        if (Array.isArray(arr)) {
          memoryCommentsByArticle.set(aid, arr as ArticleComment[]);
        }
      }
    }
  } catch {}
}

function persistCommentsByArticleStorage() {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, ArticleComment[]> = {};
    let count = 0;
    for (const [k, v] of memoryCommentsByArticle.entries()) {
      obj[k] = v.slice(0, 60);
      if (++count > 40) break;
    }
    localStorage.setItem(STORAGE_KEY_COMMENTS_BY_ARTICLE, JSON.stringify(obj));
  } catch {}
}

export function getCachedCommentsForAdmin(): ArticleComment[] {
  return memoryCommentsCache || [];
}

export function getCachedCommentsForArticle(articleId: string, includeAll = false): ArticleComment[] {
  hydrateCommentsByArticleStorage();
  const cached = memoryCommentsByArticle.get(articleId) || [];
  if (includeAll) return cached;
  return cached.filter((c) => c.status === 'approved');
}

function mapDbRowToComment(row: any): ArticleComment {
  return {
    id: row.id,
    articleId: row.article_id,
    authorName: row.author_name || 'Reader',
    authorRole: row.author_role || 'Visitor',
    contentMarkdown: row.content_markdown || '',
    status: (row.status as ArticleComment['status']) || 'pending',
    createdAt: row.created_at || new Date().toISOString(),
  };
}

export async function fetchCommentsForArticle(articleId: string, includeAll = false): Promise<ArticleComment[]> {
  hydrateCommentsByArticleStorage();
  try {
    let query = supabase
      .from('article_comments')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: false });
    if (!includeAll) {
      query = query.eq('status', 'approved');
    }
    const { data, error } = await query;
    if (error || !Array.isArray(data)) {
      return getCachedCommentsForArticle(articleId, includeAll);
    }
    const mapped = data.map(mapDbRowToComment);
    memoryCommentsByArticle.set(articleId, mapped);
    persistCommentsByArticleStorage();
    return mapped;
  } catch {
    return getCachedCommentsForArticle(articleId, includeAll);
  }
}

export async function fetchAllCommentsForAdmin(): Promise<ArticleComment[]> {
  hydrateCommentsByArticleStorage();
  try {
    const { data, error } = await supabase
      .from('article_comments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return memoryCommentsCache || [];
    const mapped = data.map(mapDbRowToComment);
    memoryCommentsCache = mapped;
    const grouped = new Map<string, ArticleComment[]>();
    for (const c of mapped) {
      const list = grouped.get(c.articleId) || [];
      list.push(c);
      grouped.set(c.articleId, list);
    }
    for (const [aid, list] of grouped.entries()) {
      memoryCommentsByArticle.set(aid, list);
    }
    persistCommentsByArticleStorage();
    return mapped;
  } catch {
    return memoryCommentsCache || [];
  }
}

export async function submitArticleComment(params: {
  articleId: string;
  authorName: string;
  authorRole?: string;
  contentMarkdown: string;
  isOwnerPosting: boolean;
}): Promise<ArticleComment> {
  hydrateCommentsByArticleStorage();
  const now = new Date().toISOString();
  const id = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  // Publish comments immediately without requiring admin approval
  const status: ArticleComment['status'] = 'approved';
  const payload = {
    id,
    article_id: params.articleId,
    author_name: params.authorName.trim(),
    author_role: params.isOwnerPosting ? 'Chief Admin' : (params.authorRole?.trim() || 'Visitor'),
    content_markdown: params.contentMarkdown.trim(),
    status,
    created_at: now,
  };
  const { error } = await supabase.from('article_comments').insert(payload);
  if (error) {
    throw new Error(error.message || 'Failed to submit comment.');
  }
  const mapped = mapDbRowToComment(payload);
  if (memoryCommentsCache) {
    memoryCommentsCache = [mapped, ...memoryCommentsCache];
  }
  const existing = memoryCommentsByArticle.get(params.articleId) || [];
  memoryCommentsByArticle.set(params.articleId, [mapped, ...existing.filter((c) => c.id !== mapped.id)]);
  persistCommentsByArticleStorage();
  return mapped;
}

export async function moderateCommentInSupabase(
  commentId: string,
  status: 'approved' | 'rejected' | 'pending' | 'archived'
): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const { error } = await supabase
    .from('article_comments')
    .update({ status })
    .eq('id', commentId);
  if (error) throw new Error(error.message);
  if (memoryCommentsCache) {
    memoryCommentsCache = memoryCommentsCache.map((c) => (c.id === commentId ? { ...c, status } : c));
  }
  for (const [aid, list] of memoryCommentsByArticle.entries()) {
    if (list.some((c) => c.id === commentId)) {
      memoryCommentsByArticle.set(
        aid,
        list.map((c) => (c.id === commentId ? { ...c, status } : c))
      );
    }
  }
  persistCommentsByArticleStorage();
}

export async function deleteCommentFromSupabase(commentId: string): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const { error } = await supabase.from('article_comments').delete().eq('id', commentId);
  if (error) throw new Error(error.message);
  if (memoryCommentsCache) {
    memoryCommentsCache = memoryCommentsCache.filter((c) => c.id !== commentId);
  }
  for (const [aid, list] of memoryCommentsByArticle.entries()) {
    if (list.some((c) => c.id === commentId)) {
      memoryCommentsByArticle.set(
        aid,
        list.filter((c) => c.id !== commentId)
      );
    }
  }
  persistCommentsByArticleStorage();
}

// ============================================================================
// PROFILE EXTENDED SECTIONS (EXPERIENCE, PUBLICATIONS, ACHIEVEMENTS, SETTINGS)
// ============================================================================

let memoryExperiencesCache: ProfileExperience[] | null = null;
let memoryPublicationsCache: ProfilePublication[] | null = null;
let memoryAchievementsCache: ProfileAchievement[] | null = null;

export function getCachedExperiences(): ProfileExperience[] {
  return memoryExperiencesCache || [];
}
export function getCachedPublications(): ProfilePublication[] {
  return memoryPublicationsCache || [];
}
export function getCachedAchievements(): ProfileAchievement[] {
  return memoryAchievementsCache || [];
}

export async function fetchExperiencesFromSupabase(): Promise<ProfileExperience[]> {
  try {
    const { data, error } = await supabase
      .from('profile_experiences')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return memoryExperiencesCache || [];
    const mapped = data.map((r: any) => ({
      id: r.id,
      roleTitle: r.role_title || '',
      organization: r.organization || '',
      location: r.location || '',
      startDate: r.start_date || '',
      endDate: r.end_date || '',
      isCurrent: Boolean(r.is_current),
      summary: r.summary || '',
      highlights: Array.isArray(r.highlights) ? r.highlights : [],
      sortOrder: r.sort_order || 0,
    }));
    memoryExperiencesCache = mapped;
    return mapped;
  } catch {
    return memoryExperiencesCache || [];
  }
}

export async function upsertExperienceToSupabase(item: ProfileExperience): Promise<ProfileExperience> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const id = item.id || `exp_${Date.now()}`;
  const payload = {
    id,
    owner_id: user.id,
    role_title: item.roleTitle.trim(),
    organization: item.organization.trim(),
    location: item.location.trim(),
    start_date: item.startDate.trim(),
    end_date: item.endDate.trim(),
    is_current: Boolean(item.isCurrent),
    summary: item.summary.trim(),
    highlights: item.highlights || [],
    sort_order: item.sortOrder || 0,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('profile_experiences').upsert(payload, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  const saved = { ...item, id };
  if (memoryExperiencesCache) {
    memoryExperiencesCache = memoryExperiencesCache.some((x) => x.id === id)
      ? memoryExperiencesCache.map((x) => (x.id === id ? saved : x))
      : [saved, ...memoryExperiencesCache];
  }
  return saved;
}

export async function deleteExperienceFromSupabase(id: string): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const { error } = await supabase.from('profile_experiences').delete().eq('id', id);
  if (error) throw new Error(error.message);
  if (memoryExperiencesCache) {
    memoryExperiencesCache = memoryExperiencesCache.filter((x) => x.id !== id);
  }
}

export async function fetchPublicationsFromSupabase(): Promise<ProfilePublication[]> {
  try {
    const { data, error } = await supabase
      .from('profile_publications')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return memoryPublicationsCache || [];
    const mapped = data.map((r: any) => ({
      id: r.id,
      title: r.title || '',
      venueOrJournal: r.venue_or_journal || '',
      year: r.year || '',
      authors: r.authors || '',
      doiOrUrl: r.doi_or_url || '',
      abstract: r.abstract || '',
      category: r.category || 'Journal Article',
      attachmentUrl: r.attachment_url || '',
      sortOrder: r.sort_order || 0,
    }));
    memoryPublicationsCache = mapped;
    return mapped;
  } catch {
    return memoryPublicationsCache || [];
  }
}

export async function upsertPublicationToSupabase(item: ProfilePublication): Promise<ProfilePublication> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const id = item.id || `pub_${Date.now()}`;
  const payload = {
    id,
    owner_id: user.id,
    title: item.title.trim(),
    venue_or_journal: item.venueOrJournal.trim(),
    year: item.year.trim(),
    authors: item.authors.trim(),
    doi_or_url: item.doiOrUrl.trim(),
    abstract: item.abstract.trim(),
    category: item.category.trim() || 'Journal Article',
    attachment_url: (item.attachmentUrl || '').trim(),
    sort_order: item.sortOrder || 0,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('profile_publications').upsert(payload, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  const saved = { ...item, id };
  if (memoryPublicationsCache) {
    memoryPublicationsCache = memoryPublicationsCache.some((x) => x.id === id)
      ? memoryPublicationsCache.map((x) => (x.id === id ? saved : x))
      : [saved, ...memoryPublicationsCache];
  }
  return saved;
}

export async function deletePublicationFromSupabase(id: string): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const { error } = await supabase.from('profile_publications').delete().eq('id', id);
  if (error) throw new Error(error.message);
  if (memoryPublicationsCache) {
    memoryPublicationsCache = memoryPublicationsCache.filter((x) => x.id !== id);
  }
}

export async function fetchAchievementsFromSupabase(): Promise<ProfileAchievement[]> {
  try {
    const { data, error } = await supabase
      .from('profile_achievements')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return memoryAchievementsCache || [];
    const mapped = data.map((r: any) => ({
      id: r.id,
      title: r.title || '',
      issuer: r.issuer || '',
      dateStr: r.date_str || '',
      category: r.category || 'Award',
      description: r.description || '',
      certificateUrl: r.certificate_url || '',
      verified: Boolean(r.verified),
      sortOrder: r.sort_order || 0,
    }));
    memoryAchievementsCache = mapped;
    return mapped;
  } catch {
    return memoryAchievementsCache || [];
  }
}

export async function upsertAchievementToSupabase(item: ProfileAchievement): Promise<ProfileAchievement> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const id = item.id || `ach_${Date.now()}`;
  const payload = {
    id,
    owner_id: user.id,
    title: item.title.trim(),
    issuer: item.issuer.trim(),
    date_str: item.dateStr.trim(),
    category: item.category.trim() || 'Award',
    description: item.description.trim(),
    certificate_url: (item.certificateUrl || '').trim(),
    verified: Boolean(item.verified),
    sort_order: item.sortOrder || 0,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('profile_achievements').upsert(payload, { onConflict: 'id' });
  if (error) throw new Error(error.message);
  const saved = { ...item, id };
  if (memoryAchievementsCache) {
    memoryAchievementsCache = memoryAchievementsCache.some((x) => x.id === id)
      ? memoryAchievementsCache.map((x) => (x.id === id ? saved : x))
      : [saved, ...memoryAchievementsCache];
  }
  return saved;
}

export async function deleteAchievementFromSupabase(id: string): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const { error } = await supabase.from('profile_achievements').delete().eq('id', id);
  if (error) throw new Error(error.message);
  if (memoryAchievementsCache) {
    memoryAchievementsCache = memoryAchievementsCache.filter((x) => x.id !== id);
  }
}

export async function prewarmPortfolioCaches(isOwner = false): Promise<void> {
  await Promise.allSettled([
    fetchProjectsFromSupabase(isOwner),
    fetchArticlesFromSupabase(isOwner),
    fetchWebsiteSettingsFromSupabase(),
    fetchExperiencesFromSupabase(),
    fetchPublicationsFromSupabase(),
    fetchAchievementsFromSupabase(),
    ...(isOwner ? [fetchAllCommentsForAdmin()] : []),
  ]);
}

// ============================================================================
// WEBSITE SETTINGS & REAL-TIME APPEARANCE SYNC
// ============================================================================

const STORAGE_KEY_WEBSITE_SETTINGS = 'fesline_website_settings_cache';
const EVENT_WEBSITE_SETTINGS_UPDATED = 'fesline_website_settings_updated';

export const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = {
  id: 'default',
  siteTitle: 'Fesline Engineering Portfolio',
  siteTagline: 'Mechanical Engineer | CAD Designer | Web Developer',
  allowVisitorArticles: true,
  requireArticleApproval: true,
  requireCommentApproval: true,
  adminAuthorLabel: 'Chief Admin',
  appearanceConfig: DEFAULT_APPEARANCE_CONFIG,
};

function mergeAppearanceConfig(raw?: Partial<WebsiteAppearanceConfig> | null): WebsiteAppearanceConfig {
  const src = raw && typeof raw === 'object' ? raw : {};
  const rawStored = Array.isArray(src.storedThemes) ? src.storedThemes : [];
  const mergedThemes = [
    ...BUILT_IN_THEMES.map((bt) => {
      const override = rawStored.find((t) => t.id === bt.id);
      return override ? { ...bt, ...override } : bt;
    }),
    ...rawStored.filter((t) => t && t.id && !BUILT_IN_THEMES.some((bt) => bt.id === t.id)),
  ];

  return {
    activeThemeId: src.activeThemeId || DEFAULT_APPEARANCE_CONFIG.activeThemeId,
    storedThemes: mergedThemes,
    heroAnimationEffect: src.heroAnimationEffect || DEFAULT_APPEARANCE_CONFIG.heroAnimationEffect,
    heroAnimationEnabled: src.heroAnimationEnabled ?? DEFAULT_APPEARANCE_CONFIG.heroAnimationEnabled,
    cardAnimationEnabled: src.cardAnimationEnabled ?? DEFAULT_APPEARANCE_CONFIG.cardAnimationEnabled,
    heroBackgroundImageUrl: src.heroBackgroundImageUrl || '',
    projectsArticlesConfig: {
      customSections: Array.isArray(src.projectsArticlesConfig?.customSections)
        ? src.projectsArticlesConfig.customSections
        : [],
      innerLayout: {
        ...DEFAULT_APPEARANCE_CONFIG.projectsArticlesConfig.innerLayout,
        ...(src.projectsArticlesConfig?.innerLayout || {}),
      },
      videoCardControls: {
        ...DEFAULT_APPEARANCE_CONFIG.projectsArticlesConfig.videoCardControls,
        ...(src.projectsArticlesConfig?.videoCardControls || {}),
      },
    },
    profileSectionManager: {
      builtInSections:
        Array.isArray(src.profileSectionManager?.builtInSections) &&
        src.profileSectionManager.builtInSections.length > 0
          ? DEFAULT_BUILT_IN_PROFILE_SECTIONS.map((def) => {
              const saved = src.profileSectionManager?.builtInSections?.find((b) => b.id === def.id);
              return saved ? { ...def, ...saved } : def;
            })
          : DEFAULT_BUILT_IN_PROFILE_SECTIONS,
      customSections: Array.isArray(src.profileSectionManager?.customSections)
        ? src.profileSectionManager.customSections
        : [],
    },
    footerConfig: {
      ...DEFAULT_APPEARANCE_CONFIG.footerConfig,
      ...(src.footerConfig || {}),
      customSections: Array.isArray(src.footerConfig?.customSections)
        ? src.footerConfig.customSections
        : [],
    },
    commentStyleConfig: {
      ...DEFAULT_APPEARANCE_CONFIG.commentStyleConfig,
      ...(src.commentStyleConfig || {}),
    },
  };
}

let memoryWebsiteSettings: WebsiteSettings | null = null;

export function getCachedWebsiteSettings(): WebsiteSettings {
  if (memoryWebsiteSettings) return memoryWebsiteSettings;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WEBSITE_SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      const hydrated: WebsiteSettings = {
        ...DEFAULT_WEBSITE_SETTINGS,
        ...parsed,
        appearanceConfig: mergeAppearanceConfig(parsed?.appearanceConfig),
      };
      memoryWebsiteSettings = hydrated;
      return hydrated;
    }
  } catch {}
  return DEFAULT_WEBSITE_SETTINGS;
}

export function applyWebsiteSettingsLocally(settings: WebsiteSettings): void {
  const normalized: WebsiteSettings = {
    ...DEFAULT_WEBSITE_SETTINGS,
    ...settings,
    appearanceConfig: mergeAppearanceConfig(settings.appearanceConfig),
  };
  memoryWebsiteSettings = normalized;
  try {
    localStorage.setItem(STORAGE_KEY_WEBSITE_SETTINGS, JSON.stringify(normalized));
  } catch {}

  if (typeof document !== 'undefined') {
    const activeTheme =
      normalized.appearanceConfig.storedThemes.find(
        (t) => t.id === normalized.appearanceConfig.activeThemeId
      ) || BUILT_IN_THEMES[0];
    const root = document.documentElement;
    root.style.setProperty('--bg-primary', activeTheme.pageBg);
    root.style.setProperty('--surface-bg', activeTheme.surfaceBg);
    root.style.setProperty('--card-bg', activeTheme.cardBg);
    root.style.setProperty('--text-primary', activeTheme.textColor);
    root.style.setProperty('--text-muted', activeTheme.mutedTextColor);
    root.style.setProperty('--primary-color', activeTheme.accentColor);
    root.style.setProperty('--border-subtle', activeTheme.borderColor);
    root.style.setProperty('--footer-bg', activeTheme.footerBg);
    root.style.setProperty('--navbar-bg', activeTheme.navbarBg);
    if (activeTheme.isDark) root.classList.add('dark');
    else root.classList.remove('dark');
  }

  if (typeof window !== 'undefined') {
    queueMicrotask(() => {
      window.dispatchEvent(new CustomEvent(EVENT_WEBSITE_SETTINGS_UPDATED, { detail: normalized }));
    });
  }
}

export async function fetchWebsiteSettingsFromSupabase(): Promise<WebsiteSettings> {
  try {
    const { data, error } = await supabase
      .from('website_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
    if (error || !data) return getCachedWebsiteSettings();
    const resolved: WebsiteSettings = {
      id: data.id || 'default',
      siteTitle: data.site_title || DEFAULT_WEBSITE_SETTINGS.siteTitle,
      siteTagline: data.site_tagline || DEFAULT_WEBSITE_SETTINGS.siteTagline,
      allowVisitorArticles: data.allow_visitor_articles !== false,
      requireArticleApproval: data.require_article_approval !== false,
      requireCommentApproval: data.require_comment_approval !== false,
      adminAuthorLabel: data.admin_author_label || 'Chief Admin',
      appearanceConfig: mergeAppearanceConfig(data.appearance_config),
      updatedAt: data.updated_at,
    };
    applyWebsiteSettingsLocally(resolved);
    return resolved;
  } catch {
    return getCachedWebsiteSettings();
  }
}

export async function saveWebsiteSettingsToSupabase(settings: WebsiteSettings): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');

  // Immediately broadcast locally for 0ms real-time UI feedback across open components
  applyWebsiteSettingsLocally(settings);

  const payloadWithAppearance: Record<string, any> = {
    id: 'default',
    owner_id: user.id,
    site_title: settings.siteTitle,
    site_tagline: settings.siteTagline,
    allow_visitor_articles: settings.allowVisitorArticles,
    require_article_approval: settings.requireArticleApproval,
    require_comment_approval: settings.requireCommentApproval,
    admin_author_label: settings.adminAuthorLabel || 'Chief Admin',
    appearance_config: settings.appearanceConfig,
    updated_at: new Date().toISOString(),
  };

  let { error } = await supabase.from('website_settings').upsert(payloadWithAppearance, { onConflict: 'id' });
  // Graceful fallback if appearance_config column hasn't been added yet by SQL migration
  if (error && /appearance_config/i.test(error.message || '')) {
    const { appearance_config: _dropped, ...fallbackPayload } = payloadWithAppearance;
    const retry = await supabase.from('website_settings').upsert(fallbackPayload, { onConflict: 'id' });
    error = retry.error;
  }
  if (error) throw new Error(error.message);
}

export function useWebsiteSettingsSync(): WebsiteSettings {
  const [settings, setSettings] = useState<WebsiteSettings>(() => getCachedWebsiteSettings());

  useEffect(() => {
    fetchWebsiteSettingsFromSupabase().then(setSettings).catch(() => {});

    const onLocalUpdate = (ev: Event) => {
      const detail = (ev as CustomEvent<WebsiteSettings>).detail;
      if (detail) setSettings(detail);
      else setSettings(getCachedWebsiteSettings());
    };
    window.addEventListener(EVENT_WEBSITE_SETTINGS_UPDATED, onLocalUpdate);

    let channel: any = null;
    try {
      channel = supabase
        .channel('public:website_settings_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'website_settings' },
          (payload) => {
            const row = payload?.new as any;
            if (row) {
              const updated: WebsiteSettings = {
                id: row.id || 'default',
                siteTitle: row.site_title || DEFAULT_WEBSITE_SETTINGS.siteTitle,
                siteTagline: row.site_tagline || DEFAULT_WEBSITE_SETTINGS.siteTagline,
                allowVisitorArticles: row.allow_visitor_articles !== false,
                requireArticleApproval: row.require_article_approval !== false,
                requireCommentApproval: row.require_comment_approval !== false,
                adminAuthorLabel: row.admin_author_label || 'Chief Admin',
                appearanceConfig: mergeAppearanceConfig(row.appearance_config),
                updatedAt: row.updated_at,
              };
              applyWebsiteSettingsLocally(updated);
              setSettings(updated);
            }
          }
        )
        .subscribe();
    } catch {}

    return () => {
      window.removeEventListener(EVENT_WEBSITE_SETTINGS_UPDATED, onLocalUpdate);
      if (channel) {
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, []);

  return settings;
}

// ============================================================================
// MEDIA LIBRARY LISTING & DELETION
// ============================================================================

export async function listBucketMediaFiles(
  bucket: 'projects' | 'articles' | 'materials' | 'avatars'
): Promise<BucketFileItem[]> {
  try {
    const results: BucketFileItem[] = [];
    const [{ data: rootItems, error }, assetRecords] = await Promise.all([
      supabase.storage
        .from(bucket)
        .list('', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } }),
      fetchMediaAssetsFromSupabase(bucket).catch(() => []),
    ]);
    if (error || !Array.isArray(rootItems)) return [];

    const metaByKey = new Map<string, MediaAssetRecord>();
    for (const rec of assetRecords) {
      if (rec.primaryUrl) metaByKey.set(rec.primaryUrl, rec);
      if (rec.storagePath) metaByKey.set(rec.storagePath, rec);
    }

    const attachOptimizationMeta = (item: BucketFileItem): BucketFileItem => {
      const rec = metaByKey.get(item.publicUrl) || metaByKey.get(item.path);
      if (!rec) return item;
      return {
        ...item,
        avifUrl: rec.avifUrl,
        webpUrl: rec.webpUrl,
        jpegUrl: rec.jpegUrl,
        mobileUrl: rec.mobileUrl,
        responsiveUrl: rec.mobileUrl,
        posterUrl: rec.posterUrl,
        vttThumbnailsUrl: rec.vttThumbnailsUrl,
        av1Urls: rec.av1Urls,
        h264Urls: rec.h264Urls,
        fallbackVideoUrl: rec.h264Urls?.['1080p'] || rec.h264Urls?.['720p'],
        hdVideoUrl: rec.av1Urls?.['1080p'] || rec.h264Urls?.['1080p'],
        format: rec.format,
        optimizedResolution: rec.resolution,
        originalBytes: rec.originalBytes,
        optimizedBytes: rec.optimizedBytes,
        compressionPct: rec.compressionPct,
      };
    };

    const isInternalSidecarFile = (fileName: string) =>
      /_(sprite\.jpg|poster\.webp|thumbnails\.vtt|768w\.avif)$/i.test(fileName);

    const folderNames: string[] = [];
    for (const item of rootItems) {
      if (!item.name || item.name === '.emptyFolderPlaceholder') continue;
      if (!item.id) {
        folderNames.push(item.name);
      } else {
        if (isInternalSidecarFile(item.name)) continue;
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(item.name);
        const mimeType = (item.metadata as any)?.mimetype;
        results.push(
          attachOptimizationMeta({
            bucket,
            name: item.name,
            path: item.name,
            publicUrl: pub?.publicUrl || '',
            size: (item.metadata as any)?.size,
            mimeType,
            mediaKind: inferBucketMediaKind(item.name, mimeType),
            createdAt: item.created_at || item.updated_at || undefined,
            updatedAt: item.updated_at || item.created_at || undefined,
          })
        );
      }
    }

    if (folderNames.length > 0) {
      const subResults = await Promise.all(
        folderNames.map(async (folder) => {
          const { data: subItems } = await supabase.storage
            .from(bucket)
            .list(folder, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
          return { folder, subItems: Array.isArray(subItems) ? subItems : [] };
        })
      );
      for (const { folder, subItems } of subResults) {
        for (const sub of subItems) {
          if (!sub.name || !sub.id || sub.name === '.emptyFolderPlaceholder') continue;
          if (isInternalSidecarFile(sub.name)) continue;
          const fullPath = `${folder}/${sub.name}`;
          const { data: pub } = supabase.storage.from(bucket).getPublicUrl(fullPath);
          const mimeType = (sub.metadata as any)?.mimetype;
          results.push(
            attachOptimizationMeta({
              bucket,
              name: sub.name,
              path: fullPath,
              publicUrl: pub?.publicUrl || '',
              size: (sub.metadata as any)?.size,
              mimeType,
              mediaKind: inferBucketMediaKind(sub.name, mimeType),
              createdAt: sub.created_at || sub.updated_at || undefined,
              updatedAt: sub.updated_at || sub.created_at || undefined,
            })
          );
        }
      }
    }

    results.sort((a, b) => {
      const ta = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const tb = new Date(b.createdAt || b.updatedAt || 0).getTime();
      return tb - ta;
    });
    return results;
  } catch {
    return [];
  }
}

export async function deleteBucketMediaFile(
  bucket: 'projects' | 'articles' | 'materials' | 'avatars',
  storagePath: string
): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  if (error) throw new Error(error.message);
}
