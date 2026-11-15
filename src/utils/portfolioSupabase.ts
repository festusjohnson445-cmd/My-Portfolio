import { useEffect, useState } from 'react';
import {
  supabase,
  getResolvedSupabaseConfig,
  getValidatedSession,
  isRealOwnerUser,
} from './supabase';

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
  fileName?: string;
  fileSize?: string;
  fileType?: string;
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

export interface BucketFileItem {
  bucket: string;
  name: string;
  path: string;
  publicUrl: string;
  size?: number;
  updatedAt?: string;
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
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      headers['Authorization'] = `Bearer ${data.session.access_token}`;
    }
  } catch {}
  return headers;
}

export async function uploadFileToBucket(
  bucket: 'projects' | 'articles' | 'materials' | 'avatars',
  file: File,
  folderPrefix = '',
  onProgress?: UploadProgressCallback
): Promise<{ publicUrl: string; storagePath: string; fileName: string; fileSize: string }> {
  // Route Projects & Articles raster images through Sharp AVIF pipeline
  if ((bucket === 'projects' || bucket === 'articles') && isOptimizableRasterImage(file)) {
    onProgress?.(25, 'Optimizing image (auto-rotate, strip EXIF, max 1920px, AVIF q=75)...');
    const authHeaders = await getPipelineAuthHeaders();
    const formData = new FormData();
    formData.append('bucket', bucket);
    formData.append('folderPrefix', folderPrefix || 'images');
    formData.append('file', file);

    const resp = await fetch('/api/media/optimize-image', {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });
    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json?.success || !json?.publicUrl) {
      throw new Error(json?.message || `Image optimization failed (${resp.status}).`);
    }
    onProgress?.(100, `Saved optimized AVIF (${json.fileSize})`);
    return {
      publicUrl: json.publicUrl,
      storagePath: json.storagePath,
      fileName: json.fileName,
      fileSize: json.fileSize,
    };
  }

  // Route Projects & Articles videos through Background FFmpeg 2-Pass AV1 + Opus pipeline
  if ((bucket === 'projects' || bucket === 'articles') && isOptimizableVideo(file)) {
    onProgress?.(5, 'Uploading source video for background AV1 optimization...');
    const authHeaders = await getPipelineAuthHeaders();
    const formData = new FormData();
    formData.append('bucket', bucket);
    formData.append('folderPrefix', folderPrefix || 'videos');
    formData.append('maxHeight', '1080');
    formData.append('file', file);

    const startResp = await fetch('/api/media/optimize-video', {
      method: 'POST',
      headers: authHeaders,
      body: formData,
    });
    const startJson = await startResp.json().catch(() => null);
    if (!startResp.ok || !startJson?.success || !startJson?.jobId) {
      throw new Error(startJson?.message || `Failed to queue video optimization (${startResp.status}).`);
    }

    const jobId: string = startJson.jobId;
    onProgress?.(startJson.progress || 10, startJson.stage || 'Queued for background AV1 transcode...');

    // Poll background job until completed or failed (no HTTP timeout)
    const maxWaitMs = 45 * 60 * 1000;
    const startedAt = Date.now();
    while (Date.now() - startedAt < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 1500));
      const statusResp = await fetch(`/api/media/jobs/${encodeURIComponent(jobId)}`);
      const statusJson = await statusResp.json().catch(() => null);
      if (!statusResp.ok || !statusJson?.job) {
        throw new Error(statusJson?.message || 'Lost connection to video optimization job.');
      }
      const job = statusJson.job;
      onProgress?.(job.progress || 50, job.stage || 'Processing AV1 video...');

      if (job.status === 'completed' && job.publicUrl) {
        return {
          publicUrl: job.publicUrl,
          storagePath: job.storagePath,
          fileName: job.fileName || file.name,
          fileSize: job.fileSize || formatBytes(file.size),
        };
      }
      if (job.status === 'failed') {
        throw new Error(job.error || 'Background video optimization failed.');
      }
    }
    throw new Error('Video optimization job exceeded maximum wait duration.');
  }

  // Direct Supabase Storage upload for non-raster/non-video assets (PDF, CAD, SVG, materials, avatars)
  onProgress?.(35, `Uploading ${file.name}...`);
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePrefix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  let ownerPrefix = folderPrefix;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user && isRealOwnerUser(data.session.user)) {
      ownerPrefix = ownerPrefix || data.session.user.id;
    }
  } catch {}

  const pathParts = [ownerPrefix || 'submissions', `${uniquePrefix}_${cleanName}`].filter(Boolean);
  const storagePath = pathParts.join('/');

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload to "${bucket}" failed: ${uploadError.message}`);
  }

  const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  if (!pub?.publicUrl) {
    throw new Error(`Could not resolve public URL in bucket "${bucket}"`);
  }

  onProgress?.(100, 'Uploaded');
  return {
    publicUrl: pub.publicUrl,
    storagePath,
    fileName: file.name,
    fileSize: formatBytes(file.size),
  };
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
      return [];
    }
    return data.map(mapDbRowToProject);
  } catch {
    return [];
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
  return mapDbRowToProject(data);
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
      return [];
    }
    return data.map(mapDbRowToArticle);
  } catch {
    return [];
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
    return mapDbRowToArticle(data);
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
}

export async function deleteArticleFromSupabase(articleId: string): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const { error } = await supabase.from('articles').delete().eq('id', articleId);
  if (error) throw new Error(error.message);
}

export async function incrementArticleLikesInSupabase(articleId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('increment_article_likes', {
      target_article_id: articleId,
    });
    if (!error && typeof data === 'number') {
      return data;
    }
  } catch {}
  return 0;
}

// ============================================================================
// COMMENTS CRUD & MODERATION
// ============================================================================

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
    if (error || !Array.isArray(data)) return [];
    return data.map(mapDbRowToComment);
  } catch {
    return [];
  }
}

export async function fetchAllCommentsForAdmin(): Promise<ArticleComment[]> {
  try {
    const { data, error } = await supabase
      .from('article_comments')
      .select('*')
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map(mapDbRowToComment);
  } catch {
    return [];
  }
}

export async function submitArticleComment(params: {
  articleId: string;
  authorName: string;
  authorRole?: string;
  contentMarkdown: string;
  isOwnerPosting: boolean;
}): Promise<ArticleComment> {
  const now = new Date().toISOString();
  const id = `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const status: ArticleComment['status'] = params.isOwnerPosting ? 'approved' : 'pending';
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
  return mapDbRowToComment(payload);
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
}

export async function deleteCommentFromSupabase(commentId: string): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const { error } = await supabase.from('article_comments').delete().eq('id', commentId);
  if (error) throw new Error(error.message);
}

// ============================================================================
// PROFILE EXTENDED SECTIONS (EXPERIENCE, PUBLICATIONS, ACHIEVEMENTS, SETTINGS)
// ============================================================================

export async function fetchExperiencesFromSupabase(): Promise<ProfileExperience[]> {
  try {
    const { data, error } = await supabase
      .from('profile_experiences')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map((r: any) => ({
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
  } catch {
    return [];
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
  return { ...item, id };
}

export async function deleteExperienceFromSupabase(id: string): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const { error } = await supabase.from('profile_experiences').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchPublicationsFromSupabase(): Promise<ProfilePublication[]> {
  try {
    const { data, error } = await supabase
      .from('profile_publications')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map((r: any) => ({
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
  } catch {
    return [];
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
  return { ...item, id };
}

export async function deletePublicationFromSupabase(id: string): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const { error } = await supabase.from('profile_publications').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchAchievementsFromSupabase(): Promise<ProfileAchievement[]> {
  try {
    const { data, error } = await supabase
      .from('profile_achievements')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });
    if (error || !Array.isArray(data)) return [];
    return data.map((r: any) => ({
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
  } catch {
    return [];
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
  return { ...item, id };
}

export async function deleteAchievementFromSupabase(id: string): Promise<void> {
  const { user } = await getValidatedSession();
  if (!isRealOwnerUser(user)) throw new Error('Owner authentication required.');
  const { error } = await supabase.from('profile_achievements').delete().eq('id', id);
  if (error) throw new Error(error.message);
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
    window.dispatchEvent(new CustomEvent(EVENT_WEBSITE_SETTINGS_UPDATED, { detail: normalized }));
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
    const { data: rootItems, error } = await supabase.storage.from(bucket).list('', { limit: 100 });
    if (error || !Array.isArray(rootItems)) return [];

    for (const item of rootItems) {
      if (!item.name) continue;
      if (!item.id) {
        const { data: subItems } = await supabase.storage.from(bucket).list(item.name, { limit: 100 });
        if (Array.isArray(subItems)) {
          for (const sub of subItems) {
            if (!sub.name || !sub.id) continue;
            const fullPath = `${item.name}/${sub.name}`;
            const { data: pub } = supabase.storage.from(bucket).getPublicUrl(fullPath);
            results.push({
              bucket,
              name: sub.name,
              path: fullPath,
              publicUrl: pub?.publicUrl || '',
              size: (sub.metadata as any)?.size,
              updatedAt: sub.updated_at || sub.created_at || undefined,
            });
          }
        }
      } else {
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(item.name);
        results.push({
          bucket,
          name: item.name,
          path: item.name,
          publicUrl: pub?.publicUrl || '',
          size: (item.metadata as any)?.size,
          updatedAt: item.updated_at || item.created_at || undefined,
        });
      }
    }
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
