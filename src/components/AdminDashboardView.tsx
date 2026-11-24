import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  MessageSquare,
  Briefcase,
  BookOpen,
  Award,
  Layers,
  Image as ImageIcon,
  Settings,
  LogOut,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  XCircle,
  Upload,
  Loader2,
  Copy,
  Check,
  ShieldCheck,
  Save,
  Menu,
  X,
  Archive,
  Palette,
  Sliders,
  Eye,
  EyeOff,
  Sparkles,
  LayoutTemplate,
  Type,
  FileJson,
  Clock,
  Search,
  Play,
  Music,
  Video as VideoIcon,
  RefreshCw,
  RotateCcw,
  Database,
  Home,
  ArrowUp,
  ArrowDown,
  Smartphone,
  QrCode,
  LifeBuoy,
  ShieldAlert,
  Lock,
} from 'lucide-react';
import {
  fetchProjectsFromSupabase,
  deleteProjectFromSupabase,
  fetchArticlesFromSupabase,
  updateArticleStatusInSupabase,
  deleteArticleFromSupabase,
  fetchAllCommentsForAdmin,
  moderateCommentInSupabase,
  deleteCommentFromSupabase,
  fetchExperiencesFromSupabase,
  upsertExperienceToSupabase,
  deleteExperienceFromSupabase,
  fetchPublicationsFromSupabase,
  upsertPublicationToSupabase,
  deletePublicationFromSupabase,
  fetchAchievementsFromSupabase,
  upsertAchievementToSupabase,
  deleteAchievementFromSupabase,
  fetchWebsiteSettingsFromSupabase,
  saveWebsiteSettingsToSupabase,
  listBucketMediaFiles,
  deleteBucketMediaFile,
  uploadFileToBucket,
  fetchMediaAssetsFromSupabase,
  deleteMediaAssetRecord,
  validateVideoSizeLimit,
  MAX_VIDEO_MB,
  isOptimizableVideo,
  isAbortError,
  applyWebsiteSettingsLocally,
  getCachedWebsiteSettings,
  getCachedProjects,
  getCachedArticles,
  getCachedCommentsForAdmin,
  getCachedExperiences,
  getCachedPublications,
  getCachedAchievements,
  getCachedBucketMediaFiles,
  prewarmMediaLibraryCaches,
  hasProjectsCacheHydrated,
  EVENT_PROJECTS_UPDATED,
  EVENT_ARTICLES_UPDATED,
  BUILT_IN_THEMES,
  DEFAULT_WEBSITE_SETTINGS,
  DEFAULT_HOMEPAGE_CONFIG,
  DEFAULT_HERO_LAYOUT_CONFIG,
  normalizeHeroElementOrder,
  type PortfolioProject,
  type PortfolioArticle,
  type ArticleComment,
  type ProfileExperience,
  type ProfilePublication,
  type ProfileAchievement,
  type WebsiteSettings,
  type WebsiteAppearanceConfig,
  type StoredThemePreset,
  type HeroAnimationEffectId,
  type CustomPageContentSection,
  type CustomProfileTemplateType,
  type CustomProfileSection,
  type CustomProfileSectionItem,
  type FooterLockPosition,
  type CustomFooterSection,
  type BucketFileItem,
  type MediaAssetRecord,
  type MediaAspectRatio,
  type HomepageConfig,
  type HeroLayoutConfig,
  type HeroElementKey,
  formatBytes,
} from '../utils/portfolioSupabase';
import {
  useProfileSync,
  setOwnerAuthenticated,
  getStoredDocuments,
  type DocumentItem,
} from '../utils/profileState';
import { deleteDocumentPersistently, recordDeletedDocId } from '../utils/documentStorage';
import {
  supabase,
  uploadMaterialToSupabaseBucket,
  uploadMaterialThumbnailToBucket,
  getAuthenticatedOwnerUid,
  getAuthenticatedBearerHeaders,
  SUPABASE_RLS_SCHEMA_SQL,
} from '../utils/supabase';
import {
  AUTHORIZED_ADMIN_EMAIL,
  verifyLiveAdminAal2,
  listAdminTotpFactors,
  startAdminTotpEnrollment,
  cancelPendingTotpEnrollment,
  verifyAdminTotpChallenge,
  unenrollAdminFactor,
  sendAdminPasswordRecovery,
  signOutAdminSession,
  type AdminTotpFactorInfo,
  type TotpEnrollmentPayload,
  type LiveAdminAal2Status,
} from '../utils/adminMfaAuth';
import { renderPdfFirstPageToImage } from '../utils/pdfRenderer';
import {
  resolveSkillStatus,
  formatSkillStatusLabel,
  SKILL_STATUS_OPTIONS,
  type SkillStatus,
} from '../data/skillsData';
import {
  DOCUMENT_CATEGORY_META,
  type DocumentWorkspaceCategory,
  type GeneratedDocumentRecord,
} from '../types/documentWorkspace';
import {
  fetchPublishedGeneratedDocuments,
  deleteGeneratedDocumentRecord,
} from '../utils/documentWorkspaceSupabase';
import {
  cleanDisplayFileName,
  formatMediaDuration,
  formatMediaTimestamp,
  getCachedMediaDuration,
  runWithConcurrency,
} from '../utils/mediaMetadata';
import { ProjectFormPanel } from './ProjectFormPanel';
import { ArticleFormPanel } from './ArticleFormPanel';
import { MediaPreviewDialog, type MediaLibraryFilter } from './MediaLibraryModal';
import { SkillSelector } from './SkillSelector';
import { SupabaseDatabaseManager } from './SupabaseDatabaseManager';
import { PortfolioPart } from './Navbar';

type AdminTab =
  | 'overview'
  | 'projects'
  | 'articles'
  | 'comments'
  | 'experience'
  | 'publications'
  | 'achievements'
  | 'credentials'
  | 'media'
  | 'settings';

interface AdminDashboardViewProps {
  onNavigatePart: (part: PortfolioPart) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onNavigatePart }) => {
  const { isOwner, bio, documents, saveBio, saveDocuments } = useProfileSync();
  const isSupabaseStorageUrl = (url?: string): boolean => /supabase\.co\/storage\/v1\/object\//i.test(url || '');
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Collections hydrated synchronously from caches to eliminate stale/default flash
  const [projects, setProjects] = useState<PortfolioProject[]>(() => getCachedProjects(true));
  const [articles, setArticles] = useState<PortfolioArticle[]>(() => getCachedArticles(true));
  const [comments, setComments] = useState<ArticleComment[]>(() => getCachedCommentsForAdmin());
  const [experiences, setExperiences] = useState<ProfileExperience[]>(() => {
    const c = getCachedExperiences();
    return c.length > 0 ? c : (bio.experiences as ProfileExperience[]) || [];
  });
  const [publications, setPublications] = useState<ProfilePublication[]>(() => {
    const c = getCachedPublications();
    return c.length > 0 ? c : (bio.publications as ProfilePublication[]) || [];
  });
  const [achievements, setAchievements] = useState<ProfileAchievement[]>(() => {
    const c = getCachedAchievements();
    return c.length > 0 ? c : (bio.achievements as ProfileAchievement[]) || [];
  });
  const [siteSettings, setSiteSettings] = useState<WebsiteSettings>(() => getCachedWebsiteSettings());
  const siteSettingsRef = useRef(siteSettings);
  useEffect(() => {
    siteSettingsRef.current = siteSettings;
  }, [siteSettings]);
  const [loading, setLoading] = useState(() => !hasProjectsCacheHydrated() && getCachedProjects(true).length === 0);

  // Forms open state
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<PortfolioProject | null>(null);

  const [articleFormOpen, setArticleFormOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<PortfolioArticle | null>(null);

  // Experience form state
  const [expOpen, setExpOpen] = useState(false);
  const [expForm, setExpForm] = useState<ProfileExperience>({
    id: '',
    roleTitle: '',
    organization: '',
    location: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    summary: '',
    highlights: [],
  });
  const [expHighlightsText, setExpHighlightsText] = useState('');

  // Publication form state
  const [pubOpen, setPubOpen] = useState(false);
  const [pubForm, setPubForm] = useState<ProfilePublication>({
    id: '',
    title: '',
    venueOrJournal: '',
    year: '',
    authors: '',
    doiOrUrl: '',
    abstract: '',
    category: 'Journal Article',
    attachmentUrl: '',
  });
  const [pubUploading, setPubUploading] = useState(false);

  // Achievement form state
  const [achOpen, setAchOpen] = useState(false);
  const [achForm, setAchForm] = useState<ProfileAchievement>({
    id: '',
    title: '',
    issuer: '',
    dateStr: '',
    category: 'Award',
    description: '',
    certificateUrl: '',
    verified: true,
  });
  const [achUploading, setAchUploading] = useState(false);

  // Skills & 4-status map local copy
  const [skillsDraft, setSkillsDraft] = useState(bio.skills || '');
  const [skillStatusesDraft, setSkillStatusesDraft] = useState<Record<string, SkillStatus>>(
    bio.skillStatuses || {}
  );
  const [certifiedSkillsDraft, setCertifiedSkillsDraft] = useState<string[]>(bio.certifiedSkills || []);
  const [savingSkills, setSavingSkills] = useState(false);

  // Comment Moderation filter
  const [commentFilter, setCommentFilter] = useState<'all' | 'pending' | 'approved' | 'archived' | 'rejected'>('all');

  // Website Settings Sub-Tabs & Builders
  const [settingsSubTab, setSettingsSubTab] = useState<
    | 'appearance'
    | 'homepage'
    | 'projects_articles'
    | 'profile_sections'
    | 'career_studio'
    | 'footer'
    | 'moderation'
    | 'security_mfa'
    | 'supabase_tables'
  >('appearance');
  const [showRlsSqlModal, setShowRlsSqlModal] = useState(false);
  const [copiedRlsSql, setCopiedRlsSql] = useState(false);

  // Security & MFA (AAL2 / TOTP Device & Recovery Management) State
  const [liveAal2Status, setLiveAal2Status] = useState<LiveAdminAal2Status | null>(null);
  const [mfaDevices, setMfaDevices] = useState<AdminTotpFactorInfo[]>([]);
  const [mfaDevicesLoading, setMfaDevicesLoading] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('Backup Authenticator');
  const [newDeviceEnrollment, setNewDeviceEnrollment] = useState<TotpEnrollmentPayload | null>(null);
  const [newDeviceCode, setNewDeviceCode] = useState('');
  const [newDeviceShowKey, setNewDeviceShowKey] = useState(false);
  const [mfaActionBusy, setMfaActionBusy] = useState(false);
  const [mfaActionMsg, setMfaActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [careerStudioDocs, setCareerStudioDocs] = useState<GeneratedDocumentRecord[]>([]);
  const [heroBgUploading, setHeroBgUploading] = useState(false);
  const [themeImportOpen, setThemeImportOpen] = useState(false);
  const [themeJsonInput, setThemeJsonInput] = useState('');
  const [customThemeDraft, setCustomThemeDraft] = useState({
    name: '',
    description: '',
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
  });

  // Projects & Articles Custom Section Builder
  const [paSectionDraft, setPaSectionDraft] = useState<{
    targetPage: 'projects' | 'articles' | 'both';
    title: string;
    subtitle: string;
    badgeText: string;
    body: string;
    textAlign: 'left' | 'center' | 'right';
  }>({
    targetPage: 'both',
    title: '',
    subtitle: '',
    badgeText: '',
    body: '',
    textAlign: 'center',
  });

  // Profile Page Custom Section Builder (5 Templates)
  const [profSectionDraft, setProfSectionDraft] = useState<{
    template: CustomProfileTemplateType;
    title: string;
    subtitle: string;
    body: string;
    mediaUrl: string;
    items: CustomProfileSectionItem[];
  }>({
    template: 'rich-essay',
    title: '',
    subtitle: '',
    body: '',
    mediaUrl: '',
    items: [],
  });
  const [profItemDraft, setProfItemDraft] = useState<CustomProfileSectionItem>({
    heading: '',
    subheading: '',
    detail: '',
    mediaUrl: '',
  });
  const [profMediaUploading, setProfMediaUploading] = useState(false);

  // Footer Custom Section Builder
  const [footerSecDraft, setFooterSecDraft] = useState({ heading: '', content: '' });

  // Credentials form state (Specialization / Courses / Document)
  const [credOpen, setCredOpen] = useState(false);
  const [credEditingId, setCredEditingId] = useState<string | null>(null);
  const [credTitle, setCredTitle] = useState('');
  const [credIssuer, setCredIssuer] = useState('');
  const [credDate, setCredDate] = useState('');
  const [credCategory, setCredCategory] = useState<DocumentItem['category']>('Certification');
  const [credGroup, setCredGroup] = useState<'Specialization' | 'Courses' | 'Document'>('Specialization');
  const [credParentId, setCredParentId] = useState('');
  const [credDescription, setCredDescription] = useState('');
  const [credAttachmentUrl, setCredAttachmentUrl] = useState('');
  const [credAttachmentName, setCredAttachmentName] = useState('');
  const [credAttachmentSize, setCredAttachmentSize] = useState('');
  const [credPreviewDataUrl, setCredPreviewDataUrl] = useState('');
  const [credVerifiedLink, setCredVerifiedLink] = useState('');
  const [credUploading, setCredUploading] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);

  // Media Library
  const [mediaBucket, setMediaBucket] = useState<'projects' | 'articles' | 'materials' | 'avatars'>('projects');
  const [mediaFiles, setMediaFiles] = useState<BucketFileItem[]>(() => getCachedBucketMediaFiles('projects'));
  const [mediaAssets, setMediaAssets] = useState<MediaAssetRecord[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaUploadProgress, setMediaUploadProgress] = useState(0);
  const [mediaUploadStage, setMediaUploadStage] = useState('');
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [mediaCanRetry, setMediaCanRetry] = useState(false);
  const mediaUploadAbortRef = useRef<AbortController | null>(null);
  const lastFailedMediaFilesRef = useRef<File[] | null>(null);
  const [copiedMediaUrl, setCopiedMediaUrl] = useState<string | null>(null);
  const [mediaFilter, setMediaFilter] = useState<MediaLibraryFilter>('all');
  const [mediaSearch, setMediaSearch] = useState('');
  const [mediaDurations, setMediaDurations] = useState<Record<string, number>>({});
  const [previewMediaItem, setPreviewMediaItem] = useState<BucketFileItem | null>(null);

  // Bio settings inside Settings tab
  const [bioForm, setBioForm] = useState(bio);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setSkillsDraft(bio.skills || '');
    setSkillStatusesDraft(bio.skillStatuses || {});
    setCertifiedSkillsDraft(bio.certifiedSkills || []);
    setBioForm(bio);
  }, [bio]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const loadAllAdminData = async () => {
    if (!hasProjectsCacheHydrated() && projects.length === 0) {
      setLoading(true);
    }
    void prewarmMediaLibraryCaches();
    try {
      const [projs, arts, cmts, exps, pubs, achs, settings, csDocs] = await Promise.all([
        fetchProjectsFromSupabase(true),
        fetchArticlesFromSupabase(true),
        fetchAllCommentsForAdmin(),
        fetchExperiencesFromSupabase(),
        fetchPublicationsFromSupabase(),
        fetchAchievementsFromSupabase(),
        fetchWebsiteSettingsFromSupabase(),
        fetchPublishedGeneratedDocuments(true),
      ]);
      setProjects(projs);
      setArticles(arts);
      setComments(cmts);
      setExperiences(exps.length > 0 ? exps : (bio.experiences as ProfileExperience[]) || []);
      setPublications(pubs.length > 0 ? pubs : (bio.publications as ProfilePublication[]) || []);
      setAchievements(achs.length > 0 ? achs : (bio.achievements as ProfileAchievement[]) || []);
      setSiteSettings(settings);
      setCareerStudioDocs(csDocs);
    } finally {
      setLoading(false);
    }
  };

  const refreshMfaSecurityPanel = async () => {
    setMfaDevicesLoading(true);
    try {
      const live = await verifyLiveAdminAal2();
      setLiveAal2Status(live);
      if (!live.ok) {
        setOwnerAuthenticated(false);
        return;
      }
      const factors = await listAdminTotpFactors();
      setMfaDevices(factors.verified);
    } catch {
    } finally {
      setMfaDevicesLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const enforceLiveAal2 = async () => {
      const live = await verifyLiveAdminAal2();
      if (!active) return;
      setLiveAal2Status(live);
      if (!live.ok) {
        setOwnerAuthenticated(false);
      }
    };
    void enforceLiveAal2();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void enforceLiveAal2();
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOwner && activeTab === 'settings' && settingsSubTab === 'security_mfa') {
      void refreshMfaSecurityPanel();
    }
  }, [isOwner, activeTab, settingsSubTab]);

  useEffect(() => {
    if (isOwner) {
      loadAllAdminData();
    }
    const onProjUpdate = () => setProjects(getCachedProjects(true));
    const onArtUpdate = () => setArticles(getCachedArticles(true));
    window.addEventListener(EVENT_PROJECTS_UPDATED, onProjUpdate);
    window.addEventListener(EVENT_ARTICLES_UPDATED, onArtUpdate);
    return () => {
      window.removeEventListener(EVENT_PROJECTS_UPDATED, onProjUpdate);
      window.removeEventListener(EVENT_ARTICLES_UPDATED, onArtUpdate);
    };
  }, [isOwner]);

  const loadMedia = async (bucket: 'projects' | 'articles' | 'materials' | 'avatars') => {
    const cached = getCachedBucketMediaFiles(bucket);
    if (cached.length > 0) {
      setMediaFiles(cached);
    } else {
      setMediaLoading(true);
    }
    try {
      const [files, assetRecords] = await Promise.all([
        listBucketMediaFiles(bucket),
        fetchMediaAssetsFromSupabase(bucket),
      ]);
      setMediaFiles(files);
      setMediaAssets(assetRecords);

      const initialDurs: Record<string, number> = {};
      const durByUrl = new Map<string, number>();
      for (const rec of assetRecords) {
        if (typeof rec.durationSec === 'number' && rec.durationSec > 0 && rec.primaryUrl) {
          durByUrl.set(rec.primaryUrl, rec.durationSec);
        }
      }
      for (const item of files) {
        const savedDur = durByUrl.get(item.publicUrl) ?? getCachedMediaDuration(item.publicUrl);
        if (savedDur !== undefined) {
          initialDurs[item.publicUrl] = savedDur;
        }
      }
      if (Object.keys(initialDurs).length > 0) {
        setMediaDurations((prev) => ({ ...prev, ...initialDurs }));
      }
    } finally {
      setMediaLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner && activeTab === 'media') {
      loadMedia(mediaBucket);
    }
  }, [isOwner, activeTab, mediaBucket]);

  const mediaAssetMetaByUrl = useMemo(() => {
    const map = new Map<string, MediaAssetRecord>();
    for (const rec of mediaAssets) {
      if (rec.primaryUrl) map.set(rec.primaryUrl, rec);
      if (rec.avifUrl) map.set(rec.avifUrl, rec);
      if (rec.webpUrl) map.set(rec.webpUrl, rec);
      if (rec.jpegUrl) map.set(rec.jpegUrl, rec);
      if (rec.mobileUrl) map.set(rec.mobileUrl, rec);
      if (rec.av1Urls?.['1080p']) map.set(rec.av1Urls['1080p'], rec);
      if (rec.av1Urls?.['720p']) map.set(rec.av1Urls['720p'], rec);
      if (rec.h264Urls?.['1080p']) map.set(rec.h264Urls['1080p'], rec);
      if (rec.h264Urls?.['720p']) map.set(rec.h264Urls['720p'], rec);
    }
    return map;
  }, [mediaAssets]);

  const filteredMediaFiles = useMemo(() => {
    const q = mediaSearch.trim().toLowerCase();
    return mediaFiles.filter((f) => {
      if (mediaFilter !== 'all') {
        if (mediaFilter === 'document') {
          if (f.mediaKind !== 'document' && f.mediaKind !== 'audio') return false;
        } else if (f.mediaKind !== mediaFilter) {
          return false;
        }
      }
      if (q) {
        const displayName = cleanDisplayFileName(f.name).toLowerCase();
        if (!displayName.includes(q) && !f.path.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [mediaFiles, mediaFilter, mediaSearch]);

  const specializationDocs = useMemo(
    () => documents.filter((d) => d.credentialGroup === 'Specialization'),
    [documents]
  );

  const pendingArticlesCount = useMemo(
    () => articles.filter((a) => a.status === 'pending').length,
    [articles]
  );

  const pendingCommentsCount = useMemo(
    () => comments.filter((c) => c.status === 'pending').length,
    [comments]
  );

  const handleSignOut = async () => {
    await signOutAdminSession('global');
    setOwnerAuthenticated(false);
    onNavigatePart('home');
  };

  // Strict access gate
  if (!isOwner) {
    return (
      <div className="flex-1 w-full max-w-xl mx-auto px-4 py-16 text-center font-serif">
        <div className="p-6 rounded-2xl bg-white border border-[#b8c6d4] shadow-xs space-y-3">
          <h1 className="text-base font-bold text-slate-950 text-center">Restricted Access</h1>
          <p className="text-xs text-slate-600 text-center">
            Chief Admin authentication is required to open the Admin Dashboard.
          </p>
          <button
            type="button"
            onClick={() => onNavigatePart('home')}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-900 text-white text-xs font-semibold cursor-pointer"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const sidebarItems: Array<{ id: AdminTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { id: 'projects', label: 'Projects', icon: <FolderKanban className="w-3.5 h-3.5" />, badge: projects.length },
    {
      id: 'articles',
      label: 'Blog / Articles',
      icon: <FileText className="w-3.5 h-3.5" />,
      badge: pendingArticlesCount > 0 ? pendingArticlesCount : undefined,
    },
    {
      id: 'comments',
      label: 'Comments',
      icon: <MessageSquare className="w-3.5 h-3.5" />,
      badge: pendingCommentsCount > 0 ? pendingCommentsCount : undefined,
    },
    { id: 'experience', label: 'Experience', icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: 'publications', label: 'Publications', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'achievements', label: 'Achievements & Skills', icon: <Award className="w-3.5 h-3.5" /> },
    { id: 'credentials', label: 'Credentials', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'media', label: 'Media Library', icon: <ImageIcon className="w-3.5 h-3.5" /> },
    { id: 'settings', label: 'Website Settings', icon: <Settings className="w-3.5 h-3.5" /> },
  ];

  // Handlers for Profile Sections
  const handleSaveExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saved = await upsertExperienceToSupabase({
        ...expForm,
        highlights: expHighlightsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      const updated = experiences.some((x) => x.id === saved.id)
        ? experiences.map((x) => (x.id === saved.id ? saved : x))
        : [saved, ...experiences];
      setExperiences(updated);
      await saveBio({ ...bio, experiences: updated }).catch(() => {});
      setExpOpen(false);
      showNotice('Experience saved.');
    } catch (err: any) {
      showNotice(err?.message || 'Error saving experience.');
    }
  };

  const handleSavePublication = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saved = await upsertPublicationToSupabase(pubForm);
      const updated = publications.some((x) => x.id === saved.id)
        ? publications.map((x) => (x.id === saved.id ? saved : x))
        : [saved, ...publications];
      setPublications(updated);
      await saveBio({ ...bio, publications: updated }).catch(() => {});
      setPubOpen(false);
      showNotice('Publication saved.');
    } catch (err: any) {
      showNotice(err?.message || 'Error saving publication.');
    }
  };

  const handleSaveAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saved = await upsertAchievementToSupabase(achForm);
      const updated = achievements.some((x) => x.id === saved.id)
        ? achievements.map((x) => (x.id === saved.id ? saved : x))
        : [saved, ...achievements];
      setAchievements(updated);
      await saveBio({ ...bio, achievements: updated }).catch(() => {});
      setAchOpen(false);
      showNotice('Achievement saved.');
    } catch (err: any) {
      showNotice(err?.message || 'Error saving achievement.');
    }
  };

  const updateAppearance = (
    updater: (prev: WebsiteAppearanceConfig) => WebsiteAppearanceConfig
  ) => {
    const prev = siteSettingsRef.current;
    const next: WebsiteSettings = {
      ...prev,
      appearanceConfig: updater(prev.appearanceConfig),
    };
    siteSettingsRef.current = next;
    setSiteSettings(next);
    applyWebsiteSettingsLocally(next);
  };

  const handleImportThemeObject = (rawObj: any) => {
    if (!rawObj || typeof rawObj !== 'object') {
      showNotice('Invalid theme JSON format.');
      return;
    }
    const id = String(rawObj.id || `custom_${Date.now()}`).toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    const newTheme: StoredThemePreset = {
      id,
      name: String(rawObj.name || 'Imported Custom Theme'),
      description: String(rawObj.description || 'Custom imported theme'),
      pageBg: String(rawObj.pageBg || '#dce1e8'),
      surfaceBg: String(rawObj.surfaceBg || '#edf2f8'),
      cardBg: String(rawObj.cardBg || '#ffffff'),
      textColor: String(rawObj.textColor || '#0f172a'),
      mutedTextColor: String(rawObj.mutedTextColor || '#475569'),
      accentColor: String(rawObj.accentColor || '#164e63'),
      borderColor: String(rawObj.borderColor || '#b8c6d4'),
      footerBg: String(rawObj.footerBg || '#d2d8e1'),
      navbarBg: String(rawObj.navbarBg || rawObj.surfaceBg || 'rgba(214, 220, 228, 0.95)'),
      isDark: Boolean(rawObj.isDark),
      isCustom: true,
    };
    updateAppearance((prev) => ({
      ...prev,
      activeThemeId: newTheme.id,
      storedThemes: [
        ...prev.storedThemes.filter((t) => t.id !== newTheme.id),
        newTheme,
      ],
    }));
    showNotice(`Theme "${newTheme.name}" imported and applied live.`);
  };

  const handleSaveSkillsAndCerts = async () => {
    setSavingSkills(true);
    try {
      const skillNames = skillsDraft
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const nextStatuses: Record<string, SkillStatus> = {};
      const nextCertified: string[] = [];
      skillNames.forEach((skill) => {
        const st = resolveSkillStatus(skill, skillStatusesDraft, certifiedSkillsDraft);
        nextStatuses[skill] = st;
        if (st === 'verified' || st === 'licensed' || st === 'completed') {
          nextCertified.push(skill);
        }
      });
      await saveBio({
        ...bio,
        skills: skillsDraft,
        skillStatuses: nextStatuses,
        certifiedSkills: nextCertified,
      });
      setSkillStatusesDraft(nextStatuses);
      setCertifiedSkillsDraft(nextCertified);
      showNotice('Skills & status badges updated.');
    } finally {
      setSavingSkills(false);
    }
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credTitle.trim() || credSaving || credUploading) return;
    setCredError(null);
    setCredSaving(true);

    try {
      const isUpdate = Boolean(credEditingId);
      const id = credEditingId || `doc-${Date.now()}`;
      const cleanAttachmentUrl = credAttachmentUrl.trim();
      const isPdfUrl =
        /\.pdf(\?|$)/i.test(cleanAttachmentUrl) ||
        /\.pdf$/i.test(credAttachmentName || '');
      const isImgUrl = /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(cleanAttachmentUrl);

      let resolvedPreviewUrl: string | undefined = isImgUrl ? cleanAttachmentUrl : undefined;

      if (isPdfUrl) {
        try {
          const rendered =
            credPreviewDataUrl ||
            (cleanAttachmentUrl ? await renderPdfFirstPageToImage(cleanAttachmentUrl, 900) : null);
          if (rendered) {
            const ownerUid = getAuthenticatedOwnerUid();
            const uploadedThumb = await uploadMaterialThumbnailToBucket(
              rendered,
              id,
              ownerUid || undefined
            );
            resolvedPreviewUrl = uploadedThumb || (rendered.length <= 180000 ? rendered : undefined);
            if (resolvedPreviewUrl) {
              try {
                localStorage.setItem(`fesline_profile_thumb_v2_${id}`, resolvedPreviewUrl);
              } catch {}
            }
          }
        } catch {}
      }

      const item: DocumentItem = {
        id,
        title: credTitle.trim(),
        issuer: credIssuer.trim() || 'Issuing Authority',
        credentialId: `CRED-${Math.floor(1000 + Math.random() * 9000)}`,
        date: credDate.trim() || String(new Date().getFullYear()),
        category: credCategory,
        credentialGroup: credGroup,
        parentSpecializationId: credGroup === 'Courses' && credParentId ? credParentId : undefined,
        fileType: isPdfUrl ? 'PDF / Document' : isImgUrl ? 'Image / Scan' : undefined,
        description: credDescription.trim() || credTitle.trim(),
        competencies: [],
        attachmentDataUrl: cleanAttachmentUrl || undefined,
        attachmentName: credAttachmentName || undefined,
        attachmentSize: credAttachmentSize || undefined,
        previewImageDataUrl: resolvedPreviewUrl,
        verifiedLink: credVerifiedLink.trim() || undefined,
      };

      const latestDocs = getStoredDocuments();
      const nextDocs = isUpdate
        ? latestDocs.map((d) => (d.id === id ? { ...d, ...item } : d))
        : [item, ...latestDocs.filter((d) => d.id !== id)];

      await saveDocuments(nextDocs);
      setCredOpen(false);
      setCredEditingId(null);
      setCredPreviewDataUrl('');
      setCredAttachmentSize('');
      showNotice('Credential saved and synced.');
    } catch (err: any) {
      const msg = err?.message || 'Failed to save credential.';
      setCredError(msg);
      showNotice(msg);
    } finally {
      setCredSaving(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-16 font-serif text-slate-900">
      {/* Main Header */}
      <div className="mb-4 flex items-center justify-between gap-3 bg-[#edf2f8] border border-[#b8c6d4] rounded-xl px-4 py-2.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="lg:hidden p-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 cursor-pointer"
          aria-label="Toggle dashboard menu"
        >
          {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

        <h1 className="text-sm sm:text-base font-bold text-slate-950 text-center flex-1">
          Admin Dashboard
        </h1>

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      {notice && (
        <div className="mb-4 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs text-center">
          {notice}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Sidebar */}
        <aside
          className={`w-full lg:w-56 shrink-0 bg-[#edf2f8] border border-[#b8c6d4] rounded-xl p-2.5 space-y-1 shadow-2xs ${
            mobileNavOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          {sidebarItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileNavOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-800 hover:bg-white'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                      active ? 'bg-cyan-700 text-white' : 'bg-white text-slate-700 border border-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Main Content Workspace */}
        <div className="flex-1 w-full min-w-0 bg-white border border-[#b8c6d4] rounded-xl p-4 sm:p-5 shadow-2xs space-y-4">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading dashboard data...</div>
          ) : (
            <>
              {/* TAB: OVERVIEW ANALYTICS */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-950 text-center border-b border-slate-200 pb-2">
                    Overview Analytics
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-center">
                    {[
                      { label: 'Projects', val: projects.length, tab: 'projects' as AdminTab },
                      { label: 'Published Articles', val: articles.filter((a) => a.status === 'published').length, tab: 'articles' as AdminTab },
                      { label: 'Pending Articles', val: pendingArticlesCount, tab: 'articles' as AdminTab },
                      { label: 'Pending Comments', val: pendingCommentsCount, tab: 'comments' as AdminTab },
                      { label: 'Experience Entries', val: experiences.length, tab: 'experience' as AdminTab },
                      { label: 'Publications', val: publications.length, tab: 'publications' as AdminTab },
                      { label: 'Achievements', val: achievements.length, tab: 'achievements' as AdminTab },
                      { label: 'Credentials', val: documents.length, tab: 'credentials' as AdminTab },
                    ].map((stat) => (
                      <button
                        key={stat.label}
                        type="button"
                        onClick={() => setActiveTab(stat.tab)}
                        className="p-3 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] hover:border-cyan-700 text-center space-y-1 cursor-pointer"
                      >
                        <span className="block text-lg font-bold text-slate-950 font-mono">{stat.val}</span>
                        <span className="block text-[11px] text-slate-700 font-semibold">{stat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: PROJECTS */}
              {activeTab === 'projects' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h2 className="text-sm font-bold text-slate-950 text-center flex-1">Manage Projects</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingProject(null);
                        setProjectFormOpen(!projectFormOpen);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Project</span>
                    </button>
                  </div>

                  {projectFormOpen && (
                    <ProjectFormPanel
                      initialProject={editingProject}
                      isOwner={true}
                      activeCategories={Array.from(
                        new Set(
                          projects
                            .filter((p) => p.status === 'published' && p.category?.trim())
                            .map((p) => p.category.trim())
                        )
                      )}
                      onSaved={(saved) => {
                        setProjects((prev) =>
                          prev.some((p) => p.id === saved.id)
                            ? prev.map((p) => (p.id === saved.id ? saved : p))
                            : [saved, ...prev]
                        );
                        setProjectFormOpen(false);
                        setEditingProject(null);
                        showNotice('Project saved.');
                      }}
                      onCancel={() => {
                        setProjectFormOpen(false);
                        setEditingProject(null);
                      }}
                    />
                  )}

                  {projects.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">No projects uploaded yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
                      {projects.map((p) => (
                        <div key={p.id} className="p-3 flex flex-wrap items-center justify-between gap-2 bg-white">
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-950 block truncate">{p.title}</span>
                            <span className="text-[10px] text-slate-500">
                              {p.category} · {p.status} {p.isFeatured ? '· Featured' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProject(p);
                                setProjectFormOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-slate-800 text-[11px] cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteProjectFromSupabase(p.id);
                                setProjects((prev) => prev.filter((x) => x.id !== p.id));
                                showNotice('Project deleted.');
                              }}
                              className="px-2 py-1 rounded bg-rose-600 text-white text-[11px] cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: ARTICLES & VISITOR MODERATION */}
              {activeTab === 'articles' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h2 className="text-sm font-bold text-slate-950 text-center flex-1">
                      Manage Blog / Articles
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingArticle(null);
                        setArticleFormOpen(!articleFormOpen);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Post</span>
                    </button>
                  </div>

                  {articleFormOpen && (
                    <ArticleFormPanel
                      initialArticle={editingArticle}
                      isOwner={true}
                      activeCategories={Array.from(
                        new Set(
                          articles
                            .filter((a) => a.status === 'published' && a.category?.trim())
                            .map((a) => a.category.trim())
                        )
                      )}
                      onSaved={(saved) => {
                        setArticles((prev) =>
                          prev.some((a) => a.id === saved.id)
                            ? prev.map((a) => (a.id === saved.id ? saved : a))
                            : [saved, ...prev]
                        );
                        setArticleFormOpen(false);
                        setEditingArticle(null);
                        showNotice('Article saved.');
                      }}
                      onCancel={() => {
                        setArticleFormOpen(false);
                        setEditingArticle(null);
                      }}
                    />
                  )}

                  {articles.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">No articles submitted yet.</p>
                  ) : (
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
                      {articles.map((a) => (
                        <div key={a.id} className="p-3 flex flex-wrap items-center justify-between gap-2 bg-white">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-950 truncate">{a.title}</span>
                              {a.isAdminAuthor && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[9px] font-bold">
                                  Chief Admin
                                </span>
                              )}
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9px] uppercase font-bold">
                                {a.status}
                              </span>
                            </div>
                            <span className="text-[10px] text-slate-500">
                              By {a.authorName} · {a.category}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {a.status !== 'published' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await updateArticleStatusInSupabase(a.id, 'published');
                                  setArticles((prev) =>
                                    prev.map((x) => (x.id === a.id ? { ...x, status: 'published' } : x))
                                  );
                                  showNotice('Article approved and published.');
                                }}
                                className="px-2 py-1 rounded bg-emerald-700 text-white text-[10px] font-semibold cursor-pointer"
                              >
                                Approve &amp; Publish
                              </button>
                            )}
                            {a.status !== 'archived' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await updateArticleStatusInSupabase(a.id, 'archived');
                                  setArticles((prev) =>
                                    prev.map((x) => (x.id === a.id ? { ...x, status: 'archived' } : x))
                                  );
                                  showNotice('Article archived.');
                                }}
                                className="px-2 py-1 rounded bg-amber-100 text-amber-900 text-[10px] font-semibold cursor-pointer"
                              >
                                Archive
                              </button>
                            )}
                            {a.status !== 'draft' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await updateArticleStatusInSupabase(a.id, 'draft');
                                  setArticles((prev) =>
                                    prev.map((x) => (x.id === a.id ? { ...x, status: 'draft' } : x))
                                  );
                                  showNotice('Article moved to draft.');
                                }}
                                className="px-2 py-1 rounded bg-slate-200 text-slate-800 text-[10px] font-semibold cursor-pointer"
                              >
                                Draft
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingArticle(a);
                                setArticleFormOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-100 border border-slate-300 text-slate-800 text-[10px] cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteArticleFromSupabase(a.id);
                                setArticles((prev) => prev.filter((x) => x.id !== a.id));
                                showNotice('Article deleted.');
                              }}
                              className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: COMMENTS MODERATION */}
              {activeTab === 'comments' && (
                <div className="space-y-3">
                  <h2 className="text-sm font-bold text-slate-950 text-center border-b border-slate-200 pb-2">
                    Comment Moderation &amp; Typography
                  </h2>

                  {/* Comment Font & Size Bar */}
                  <div className="w-full max-w-full overflow-hidden p-3 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 inline-flex items-center gap-1.5">
                        <Type className="w-3.5 h-3.5 text-cyan-900" />
                        <span>Live Comment Text Styling</span>
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await saveWebsiteSettingsToSupabase(siteSettings);
                            showNotice('Comment typography saved.');
                          } catch (err: any) {
                            showNotice(err?.message || 'Error saving typography.');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-900 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        <Save className="w-3 h-3" />
                        <span>Save Style</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="min-w-0">
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                          Comment Font Family
                        </label>
                        <select
                          value={siteSettings.appearanceConfig.commentStyleConfig.fontFamily}
                          onChange={(e) =>
                            updateAppearance((prev) => ({
                              ...prev,
                              commentStyleConfig: {
                                ...prev.commentStyleConfig,
                                fontFamily: e.target.value,
                              },
                            }))
                          }
                          className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white text-xs"
                        >
                          <option value='"Times New Roman", Times, serif'>Times New Roman</option>
                          <option value='Georgia, serif'>Georgia Serif</option>
                          <option value='Garamond, serif'>Garamond Classic</option>
                          <option value='Inter, system-ui, sans-serif'>Inter / Modern Sans</option>
                          <option value='"JetBrains Mono", monospace'>Technical Monospace</option>
                        </select>
                      </div>
                      <div className="min-w-0">
                        <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                          Comment Font Size
                        </label>
                        <select
                          value={siteSettings.appearanceConfig.commentStyleConfig.fontSize}
                          onChange={(e) =>
                            updateAppearance((prev) => ({
                              ...prev,
                              commentStyleConfig: {
                                ...prev.commentStyleConfig,
                                fontSize: e.target.value,
                              },
                            }))
                          }
                          className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white text-xs"
                        >
                          <option value="11px">11px (Compact)</option>
                          <option value="12px">12px (Standard)</option>
                          <option value="13px">13px (Medium)</option>
                          <option value="14px">14px (Readable)</option>
                          <option value="15px">15px (Large)</option>
                          <option value="16px">16px (Extra Large)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Status Filters */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
                    {(['all', 'pending', 'approved', 'archived', 'rejected'] as const).map((statusKey) => (
                      <button
                        key={statusKey}
                        type="button"
                        onClick={() => setCommentFilter(statusKey)}
                        className={`px-2.5 py-1 rounded-lg border font-semibold capitalize cursor-pointer ${
                          commentFilter === statusKey
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-white'
                        }`}
                      >
                        {statusKey} (
                        {statusKey === 'all'
                          ? comments.length
                          : comments.filter((c) => c.status === statusKey).length}
                        )
                      </button>
                    ))}
                  </div>

                  {comments.filter((c) => commentFilter === 'all' || c.status === commentFilter).length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">
                      No {commentFilter === 'all' ? '' : commentFilter} comments recorded.
                    </p>
                  ) : (
                    <div className="space-y-2 text-xs">
                      {comments
                        .filter((c) => commentFilter === 'all' || c.status === commentFilter)
                        .map((c) => (
                          <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-bold text-slate-900">
                                {c.authorName} · <span className="uppercase text-[10px] text-cyan-900">{c.status}</span>
                              </span>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {c.status !== 'approved' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await moderateCommentInSupabase(c.id, 'approved');
                                      setComments((prev) =>
                                        prev.map((x) => (x.id === c.id ? { ...x, status: 'approved' } : x))
                                      );
                                      showNotice('Comment approved.');
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px] cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Approve</span>
                                  </button>
                                )}
                                {c.status !== 'archived' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await moderateCommentInSupabase(c.id, 'archived');
                                      setComments((prev) =>
                                        prev.map((x) => (x.id === c.id ? { ...x, status: 'archived' } : x))
                                      );
                                      showNotice('Comment archived.');
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-700 text-white text-[10px] cursor-pointer"
                                  >
                                    <Archive className="w-3 h-3" />
                                    <span>Archive</span>
                                  </button>
                                )}
                                {c.status !== 'rejected' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await moderateCommentInSupabase(c.id, 'rejected');
                                      setComments((prev) =>
                                        prev.map((x) => (x.id === c.id ? { ...x, status: 'rejected' } : x))
                                      );
                                      showNotice('Comment rejected.');
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-600 text-white text-[10px] cursor-pointer"
                                  >
                                    <XCircle className="w-3 h-3" />
                                    <span>Reject</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteCommentFromSupabase(c.id);
                                    setComments((prev) => prev.filter((x) => x.id !== c.id));
                                    showNotice('Comment deleted.');
                                  }}
                                  className="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] cursor-pointer"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            <p
                              className="text-slate-700"
                              style={{
                                fontFamily:
                                  siteSettings.appearanceConfig.commentStyleConfig.fontFamily ||
                                  '"Times New Roman", Times, serif',
                                fontSize:
                                  siteSettings.appearanceConfig.commentStyleConfig.fontSize || '12px',
                              }}
                            >
                              {c.contentMarkdown}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: EXPERIENCE */}
              {activeTab === 'experience' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h2 className="text-sm font-bold text-slate-950 text-center flex-1">Experience &amp; Career</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setExpForm({
                          id: '',
                          roleTitle: '',
                          organization: '',
                          location: '',
                          startDate: '',
                          endDate: '',
                          isCurrent: false,
                          summary: '',
                          highlights: [],
                        });
                        setExpHighlightsText('');
                        setExpOpen(!expOpen);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Experience</span>
                    </button>
                  </div>

                  {expOpen && (
                    <form onSubmit={handleSaveExperience} className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Role / Title *"
                          value={expForm.roleTitle}
                          onChange={(e) => setExpForm({ ...expForm, roleTitle: e.target.value })}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        <input
                          type="text"
                          required
                          placeholder="Organization / Company *"
                          value={expForm.organization}
                          onChange={(e) => setExpForm({ ...expForm, organization: e.target.value })}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Location"
                          value={expForm.location}
                          onChange={(e) => setExpForm({ ...expForm, location: e.target.value })}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                          <input
                            type="text"
                            placeholder="Start (e.g. Jan 2022)"
                            value={expForm.startDate}
                            onChange={(e) => setExpForm({ ...expForm, startDate: e.target.value })}
                            className="w-full min-w-0 flex-1 px-2 py-1.5 rounded border border-slate-300 bg-white"
                          />
                          <input
                            type="text"
                            placeholder="End (or Present)"
                            value={expForm.endDate}
                            onChange={(e) => setExpForm({ ...expForm, endDate: e.target.value })}
                            className="w-full min-w-0 flex-1 px-2 py-1.5 rounded border border-slate-300 bg-white"
                          />
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Role Summary"
                        value={expForm.summary}
                        onChange={(e) => setExpForm({ ...expForm, summary: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                      />
                      <textarea
                        rows={2}
                        placeholder="Key Highlights (one per line)"
                        value={expHighlightsText}
                        onChange={(e) => setExpHighlightsText(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                      />
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setExpOpen(false)} className="px-3 py-1 rounded bg-slate-200 text-xs cursor-pointer">
                          Cancel
                        </button>
                        <button type="submit" className="px-3 py-1 rounded bg-cyan-900 text-white text-xs font-semibold cursor-pointer">
                          Save
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2 text-xs">
                    {experiences.map((ex) => (
                      <div key={ex.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-950">{ex.roleTitle} — {ex.organization}</div>
                          <div className="text-[11px] text-slate-500">
                            {ex.startDate} – {ex.isCurrent ? 'Present' : ex.endDate} {ex.location ? `· ${ex.location}` : ''}
                          </div>
                          {ex.summary && <p className="text-slate-700 mt-1">{ex.summary}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setExpForm(ex);
                              setExpHighlightsText((ex.highlights || []).join('\n'));
                              setExpOpen(true);
                            }}
                            className="p-1 text-slate-600 hover:text-slate-950 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteExperienceFromSupabase(ex.id).catch(() => {});
                              const updated = experiences.filter((x) => x.id !== ex.id);
                              setExperiences(updated);
                              await saveBio({ ...bio, experiences: updated }).catch(() => {});
                            }}
                            className="p-1 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: PUBLICATIONS */}
              {activeTab === 'publications' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h2 className="text-sm font-bold text-slate-950 text-center flex-1">Research &amp; Publications</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setPubForm({
                          id: '',
                          title: '',
                          venueOrJournal: '',
                          year: '',
                          authors: '',
                          doiOrUrl: '',
                          abstract: '',
                          category: 'Journal Article',
                          attachmentUrl: '',
                        });
                        setPubOpen(!pubOpen);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Publication</span>
                    </button>
                  </div>

                  {pubOpen && (
                    <form onSubmit={handleSavePublication} className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Publication Title *"
                          value={pubForm.title}
                          onChange={(e) => setPubForm({ ...pubForm, title: e.target.value })}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Journal / Venue"
                          value={pubForm.venueOrJournal}
                          onChange={(e) => setPubForm({ ...pubForm, venueOrJournal: e.target.value })}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Authors"
                          value={pubForm.authors}
                          onChange={(e) => setPubForm({ ...pubForm, authors: e.target.value })}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                          <input
                            type="text"
                            placeholder="Year"
                            value={pubForm.year}
                            onChange={(e) => setPubForm({ ...pubForm, year: e.target.value })}
                            className="w-full sm:w-24 min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                          />
                          <input
                            type="text"
                            placeholder="DOI or Link URL"
                            value={pubForm.doiOrUrl}
                            onChange={(e) => setPubForm({ ...pubForm, doiOrUrl: e.target.value })}
                            className="w-full min-w-0 flex-1 px-2 py-1.5 rounded border border-slate-300 bg-white"
                          />
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Abstract"
                        value={pubForm.abstract}
                        onChange={(e) => setPubForm({ ...pubForm, abstract: e.target.value })}
                        className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                      />
                      <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                        <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-cyan-800 text-white cursor-pointer shrink-0">
                          {pubUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          <span>{pubUploading ? 'uploading...' : 'Upload PDF'}</span>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              setPubUploading(true);
                              try {
                                const res = await uploadFileToBucket('materials', f, 'publications');
                                setPubForm((prev) => ({ ...prev, attachmentUrl: res.publicUrl }));
                              } finally {
                                setPubUploading(false);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        <input
                          type="url"
                          placeholder={isSupabaseStorageUrl(pubForm.attachmentUrl) ? 'File uploaded' : 'Or paste Attachment URL'}
                          value={isSupabaseStorageUrl(pubForm.attachmentUrl) ? '' : pubForm.attachmentUrl || ''}
                          onChange={(e) => setPubForm({ ...pubForm, attachmentUrl: e.target.value })}
                          className="w-full min-w-0 flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        {pubForm.attachmentUrl && (
                          <button
                            type="button"
                            onClick={() => setPubForm({ ...pubForm, attachmentUrl: '' })}
                            className="px-2.5 py-1.5 rounded bg-rose-100 text-rose-800 text-[11px] font-semibold cursor-pointer shrink-0"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setPubOpen(false)} className="px-3 py-1 rounded bg-slate-200 text-xs cursor-pointer">
                          Cancel
                        </button>
                        <button type="submit" disabled={pubUploading} className="px-3 py-1 rounded bg-cyan-900 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer">
                          Save
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2 text-xs">
                    {publications.map((pub) => (
                      <div key={pub.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-950">{pub.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {pub.venueOrJournal} {pub.year ? `(${pub.year})` : ''}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setPubForm(pub);
                              setPubOpen(true);
                            }}
                            className="p-1 text-slate-600 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deletePublicationFromSupabase(pub.id).catch(() => {});
                              const updated = publications.filter((x) => x.id !== pub.id);
                              setPublications(updated);
                              await saveBio({ ...bio, publications: updated }).catch(() => {});
                            }}
                            className="p-1 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: ACHIEVEMENTS & SKILLS */}
              {activeTab === 'achievements' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h2 className="text-sm font-bold text-slate-950 text-center flex-1">
                      Achievements, Awards &amp; Skills
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setAchForm({
                          id: '',
                          title: '',
                          issuer: '',
                          dateStr: '',
                          category: 'Award',
                          description: '',
                          certificateUrl: '',
                          verified: true,
                        });
                        setAchOpen(!achOpen);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Achievement</span>
                    </button>
                  </div>

                  {achOpen && (
                    <form onSubmit={handleSaveAchievement} className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Award / Achievement Title *"
                          value={achForm.title}
                          onChange={(e) => setAchForm({ ...achForm, title: e.target.value })}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Issuer"
                          value={achForm.issuer}
                          onChange={(e) => setAchForm({ ...achForm, issuer: e.target.value })}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Date / Year"
                          value={achForm.dateStr}
                          onChange={(e) => setAchForm({ ...achForm, dateStr: e.target.value })}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Description"
                        value={achForm.description}
                        onChange={(e) => setAchForm({ ...achForm, description: e.target.value })}
                        className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                      />
                      <div className="flex flex-col sm:flex-row gap-2 items-center min-w-0">
                        <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-cyan-800 text-white cursor-pointer shrink-0">
                          {achUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          <span>{achUploading ? 'uploading...' : 'Upload Certificate'}</span>
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              setAchUploading(true);
                              try {
                                const res = await uploadFileToBucket('materials', f, 'achievements');
                                setAchForm((prev) => ({ ...prev, certificateUrl: res.publicUrl }));
                              } finally {
                                setAchUploading(false);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        <input
                          type="url"
                          placeholder={isSupabaseStorageUrl(achForm.certificateUrl) ? 'Certificate uploaded' : 'Or paste Certificate URL'}
                          value={isSupabaseStorageUrl(achForm.certificateUrl) ? '' : achForm.certificateUrl || ''}
                          onChange={(e) => setAchForm({ ...achForm, certificateUrl: e.target.value })}
                          className="w-full min-w-0 flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        {achForm.certificateUrl && (
                          <button
                            type="button"
                            onClick={() => setAchForm({ ...achForm, certificateUrl: '' })}
                            className="px-2.5 py-1.5 rounded bg-rose-100 text-rose-800 text-[11px] font-semibold cursor-pointer shrink-0"
                          >
                            Clear
                          </button>
                        )}
                        <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={achForm.verified}
                            onChange={(e) => setAchForm({ ...achForm, verified: e.target.checked })}
                          />
                          <span>Verified Certificate</span>
                        </label>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setAchOpen(false)} className="px-3 py-1 rounded bg-slate-200 text-xs cursor-pointer">
                          Cancel
                        </button>
                        <button type="submit" disabled={achUploading} className="px-3 py-1 rounded bg-cyan-900 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer">
                          Save
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2 text-xs">
                    {achievements.map((ac) => (
                      <div key={ac.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-950">
                            {ac.title} · <span className="text-[10px] text-cyan-800">{ac.verified ? 'Verified' : 'In Progress'}</span>
                          </div>
                          <div className="text-[11px] text-slate-500">{ac.issuer} {ac.dateStr ? `· ${ac.dateStr}` : ''}</div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setAchForm(ac);
                              setAchOpen(true);
                            }}
                            className="p-1 text-slate-600 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteAchievementFromSupabase(ac.id).catch(() => {});
                              const updated = achievements.filter((x) => x.id !== ac.id);
                              setAchievements(updated);
                              await saveBio({ ...bio, achievements: updated }).catch(() => {});
                            }}
                            className="p-1 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Skills & 4-Status Manager */}
                  <div className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <h3 className="text-xs font-bold text-slate-950 text-center">
                      Manage 3 Skill Categories &amp; Statuses (In Progress, Verified, Licensed, Completed)
                    </h3>
                    <SkillSelector
                      value={skillsDraft}
                      onChange={setSkillsDraft}
                      skillStatuses={skillStatusesDraft}
                      onSkillStatusesChange={setSkillStatusesDraft}
                      certifiedSkills={certifiedSkillsDraft}
                      label="Portfolio Skills"
                    />
                    <div className="space-y-1.5">
                      <span className="block text-[11px] font-bold text-slate-700">
                        Individual Skill Status Assignment:
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {skillsDraft
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean)
                          .map((skill) => {
                            const status = resolveSkillStatus(
                              skill,
                              skillStatusesDraft,
                              certifiedSkillsDraft
                            );
                            return (
                              <div
                                key={skill}
                                className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border border-slate-300 bg-white min-w-0"
                              >
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 truncate min-w-0">
                                  <ShieldCheck className="w-3 h-3 text-cyan-800 shrink-0" />
                                  <span className="truncate">{skill}</span>
                                </span>
                                <select
                                  value={status}
                                  onChange={(e) =>
                                    setSkillStatusesDraft((prev) => ({
                                      ...prev,
                                      [skill]: e.target.value as SkillStatus,
                                    }))
                                  }
                                  className="px-1.5 py-0.5 rounded border border-slate-300 bg-slate-50 text-[10px] font-bold text-slate-800 shrink-0 cursor-pointer"
                                >
                                  {SKILL_STATUS_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {formatSkillStatusLabel(opt)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={savingSkills}
                        onClick={handleSaveSkillsAndCerts}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-900 text-white text-xs font-semibold cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingSkills ? 'Saving...' : 'Save Skills & Statuses'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: VERIFIED CREDENTIALS (SPECIALIZATION & COURSES) */}
              {activeTab === 'credentials' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <h2 className="text-sm font-bold text-slate-950 text-center flex-1">
                      Credentials (Specialization &amp; Courses)
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setCredEditingId(null);
                        setCredTitle('');
                        setCredIssuer('');
                        setCredDate('');
                        setCredGroup('Specialization');
                        setCredParentId('');
                        setCredDescription('');
                        setCredAttachmentUrl('');
                        setCredAttachmentName('');
                        setCredAttachmentSize('');
                        setCredPreviewDataUrl('');
                        setCredVerifiedLink('');
                        setCredError(null);
                        setCredOpen(!credOpen);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Upload Document</span>
                    </button>
                  </div>

                  {credOpen && (
                    <form onSubmit={handleSaveCredential} className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                      {credError && (
                        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-medium">
                          {credError}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="min-w-0">
                          <label className="block font-bold text-slate-700 mb-0.5">Group *</label>
                          <select
                            value={credGroup}
                            onChange={(e) => setCredGroup(e.target.value as any)}
                            className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                          >
                            <option value="Specialization">Specialization</option>
                            <option value="Courses">Courses</option>
                            <option value="Document">Technical Document</option>
                          </select>
                        </div>
                        {credGroup === 'Courses' && (
                          <div className="min-w-0">
                            <label className="block font-bold text-slate-700 mb-0.5">Parent Specialization</label>
                            <select
                              value={credParentId}
                              onChange={(e) => setCredParentId(e.target.value)}
                              className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                            >
                              <option value="">Standalone Course</option>
                              {specializationDocs.map((sp) => (
                                <option key={sp.id} value={sp.id}>
                                  {sp.title}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div className="min-w-0">
                          <label className="block font-bold text-slate-700 mb-0.5">Type</label>
                          <select
                            value={credCategory}
                            onChange={(e) => setCredCategory(e.target.value as any)}
                            className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                          >
                            <option value="Certification">Certification</option>
                            <option value="Accreditation">Accreditation</option>
                            <option value="Engineering License">Engineering License</option>
                            <option value="Technical Report">Technical Report</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Title *"
                          value={credTitle}
                          onChange={(e) => setCredTitle(e.target.value)}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Issuer / Platform"
                          value={credIssuer}
                          onChange={(e) => setCredIssuer(e.target.value)}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Date / Year"
                          value={credDate}
                          onChange={(e) => setCredDate(e.target.value)}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Description"
                        value={credDescription}
                        onChange={(e) => setCredDescription(e.target.value)}
                        className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                      />
                      <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                        <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-cyan-800 text-white cursor-pointer shrink-0">
                          {credUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          <span>{credUploading ? 'uploading...' : 'Upload File'}</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (!f) return;
                              setCredError(null);
                              setCredUploading(true);
                              try {
                                const ownerUid = getAuthenticatedOwnerUid();
                                const uploadRes = await uploadMaterialToSupabaseBucket(
                                  f,
                                  f.name,
                                  ownerUid || undefined
                                );
                                setCredAttachmentUrl(uploadRes.publicUrl);
                                setCredAttachmentName(f.name);
                                const sz =
                                  f.size < 1024
                                    ? `${f.size} B`
                                    : f.size < 1024 * 1024
                                    ? `${(f.size / 1024).toFixed(1)} KB`
                                    : `${(f.size / (1024 * 1024)).toFixed(1)} MB`;
                                setCredAttachmentSize(sz);
                                if (!credTitle.trim()) {
                                  setCredTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[_.-]/g, ' '));
                                }
                                if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
                                  try {
                                    const buf = await f.arrayBuffer();
                                    const previewImg = await renderPdfFirstPageToImage(buf, 900);
                                    if (previewImg) setCredPreviewDataUrl(previewImg);
                                  } catch {}
                                }
                              } catch (uploadErr: any) {
                                const msg = uploadErr?.message || 'File upload failed.';
                                setCredError(msg);
                                showNotice(msg);
                              } finally {
                                setCredUploading(false);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        <input
                          type="url"
                          placeholder={isSupabaseStorageUrl(credAttachmentUrl) ? 'File uploaded' : 'Or paste File URL'}
                          value={isSupabaseStorageUrl(credAttachmentUrl) ? '' : credAttachmentUrl}
                          onChange={(e) => {
                            setCredAttachmentUrl(e.target.value);
                            setCredPreviewDataUrl('');
                          }}
                          className="w-full min-w-0 flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                        {credAttachmentUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setCredAttachmentUrl('');
                              setCredAttachmentName('');
                              setCredAttachmentSize('');
                              setCredPreviewDataUrl('');
                            }}
                            className="px-2.5 py-1.5 rounded bg-rose-100 text-rose-800 text-[11px] font-semibold cursor-pointer shrink-0"
                          >
                            Clear
                          </button>
                        )}
                        <input
                          type="url"
                          placeholder="Verify URL (optional)"
                          value={credVerifiedLink}
                          onChange={(e) => setCredVerifiedLink(e.target.value)}
                          className="w-full min-w-0 flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setCredOpen(false)} className="px-3 py-1 rounded bg-slate-200 text-xs cursor-pointer">
                          Cancel
                        </button>
                        <button type="submit" disabled={credUploading || credSaving} className="inline-flex items-center gap-1 px-3 py-1 rounded bg-cyan-900 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer">
                          {credSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>{credSaving ? 'Saving...' : 'Save Credential'}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-2 text-xs">
                    {documents.map((doc) => (
                      <div key={doc.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-950 truncate">{doc.title}</div>
                          <div className="text-[10px] text-slate-500">
                            {doc.credentialGroup || 'Document'} · {doc.issuer} · {doc.date}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            recordDeletedDocId(doc.id);
                            try {
                              localStorage.removeItem(`fesline_profile_thumb_v2_${doc.id}`);
                            } catch {}
                            const latestDocs = getStoredDocuments().filter((d) => d.id !== doc.id);
                            const authHeaders = await getAuthenticatedBearerHeaders();
                            await Promise.allSettled([
                              deleteDocumentPersistently(doc.id),
                              saveDocuments(latestDocs, [doc.id]),
                              fetch(`/api/documents/${doc.id}`, { method: 'DELETE', headers: authHeaders }),
                              fetch(`/api/profile/documents/${doc.id}`, { method: 'DELETE', headers: authHeaders }),
                            ]);
                            showNotice('Credential permanently deleted.');
                          }}
                          className="p-1 text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: MEDIA LIBRARY */}
              {activeTab === 'media' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <h2 className="text-sm font-bold text-slate-950 text-center flex-1">Media Library</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={mediaBucket}
                        onChange={(e) => setMediaBucket(e.target.value as any)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs cursor-pointer"
                      >
                        <option value="projects">projects</option>
                        <option value="articles">articles</option>
                        <option value="materials">materials</option>
                        <option value="avatars">avatars</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => loadMedia(mediaBucket)}
                        disabled={mediaLoading}
                        className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                        title="Refresh Media Library"
                        aria-label="Refresh Media Library"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${mediaLoading ? 'animate-spin' : ''}`} />
                      </button>
                      <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-semibold cursor-pointer">
                        {mediaUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        <span>{mediaUploading ? 'Processing...' : 'Upload'}</span>
                        <input
                          type="file"
                          multiple
                          onChange={async (e) => {
                            const files = e.target.files ? Array.from(e.target.files) : [];
                            e.currentTarget.value = '';
                            if (files.length === 0) return;

                            for (const f of files) {
                              if (isOptimizableVideo(f)) {
                                try {
                                  validateVideoSizeLimit(f);
                                } catch (sizeErr: any) {
                                  setMediaUploadError(sizeErr?.message || `Video exceeds ${MAX_VIDEO_MB} MB maximum limit.`);
                                  setMediaCanRetry(false);
                                  lastFailedMediaFilesRef.current = null;
                                  return;
                                }
                              }
                            }

                            mediaUploadAbortRef.current?.abort();
                            const controller = new AbortController();
                            mediaUploadAbortRef.current = controller;
                            lastFailedMediaFilesRef.current = files;
                            setMediaCanRetry(false);
                            setMediaUploadError(null);
                            setMediaUploading(true);
                            setMediaUploadProgress(5);
                            setMediaUploadStage('Preparing browser media pipeline...');

                            try {
                              await runWithConcurrency(files, 1, async (f) => {
                                await uploadFileToBucket(
                                  mediaBucket,
                                  f,
                                  '',
                                  (pct, stage) => {
                                    setMediaUploadProgress(pct);
                                    setMediaUploadStage(stage);
                                  },
                                  controller.signal
                                );
                              });
                              if (controller.signal.aborted) return;
                              lastFailedMediaFilesRef.current = null;
                              setMediaCanRetry(false);
                              await loadMedia(mediaBucket);
                              showNotice(`Uploaded to "${mediaBucket}".`);
                            } catch (err: any) {
                              if (!isAbortError(err) && !controller.signal.aborted) {
                                setMediaUploadError(err?.message || 'Upload failed.');
                                setMediaCanRetry(true);
                              }
                            } finally {
                              if (mediaUploadAbortRef.current === controller) {
                                mediaUploadAbortRef.current = null;
                                setMediaUploading(false);
                                setMediaUploadProgress(0);
                                setMediaUploadStage('');
                              }
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {mediaUploading && (
                    <div className="p-2.5 rounded-lg bg-cyan-50 border border-cyan-200 space-y-1.5 text-xs text-cyan-950 font-semibold">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          <span className="truncate">
                            {`Uploading..... ${Math.round(mediaUploadProgress)}%`}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            mediaUploadAbortRef.current?.abort();
                            mediaUploadAbortRef.current = null;
                            setMediaUploading(false);
                            setMediaUploadProgress(0);
                            setMediaUploadStage('');
                          }}
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
                          style={{ width: `${Math.max(4, Math.min(100, mediaUploadProgress))}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {mediaUploadError && (
                    <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
                      <span className="flex-1 min-w-0 break-words">{mediaUploadError}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {mediaCanRetry && lastFailedMediaFilesRef.current && (
                          <button
                            type="button"
                            onClick={async () => {
                              const retryFiles = lastFailedMediaFilesRef.current;
                              if (!retryFiles || retryFiles.length === 0) return;
                              mediaUploadAbortRef.current?.abort();
                              const controller = new AbortController();
                              mediaUploadAbortRef.current = controller;
                              setMediaCanRetry(false);
                              setMediaUploadError(null);
                              setMediaUploading(true);
                              setMediaUploadProgress(5);
                              setMediaUploadStage('Retrying browser media pipeline...');
                              try {
                                await runWithConcurrency(retryFiles, 1, async (f) => {
                                  await uploadFileToBucket(
                                    mediaBucket,
                                    f,
                                    '',
                                    (pct, stage) => {
                                      setMediaUploadProgress(pct);
                                      setMediaUploadStage(stage);
                                    },
                                    controller.signal
                                  );
                                });
                                if (controller.signal.aborted) return;
                                lastFailedMediaFilesRef.current = null;
                                await loadMedia(mediaBucket);
                                showNotice(`Uploaded to "${mediaBucket}".`);
                              } catch (err: any) {
                                if (!isAbortError(err) && !controller.signal.aborted) {
                                  setMediaUploadError(err?.message || 'Retry upload failed.');
                                  setMediaCanRetry(true);
                                }
                              } finally {
                                if (mediaUploadAbortRef.current === controller) {
                                  mediaUploadAbortRef.current = null;
                                  setMediaUploading(false);
                                  setMediaUploadProgress(0);
                                  setMediaUploadStage('');
                                }
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Retry</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setMediaUploadError(null)}
                          className="px-1.5 py-0.5 rounded hover:bg-rose-200/70 text-rose-900 font-bold cursor-pointer"
                          aria-label="Dismiss error"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Filter & Search Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
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
                          onClick={() => setMediaFilter(tab.id)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${
                            mediaFilter === tab.id
                              ? 'bg-white text-slate-950 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative flex-1 min-w-[180px] max-w-xs">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={mediaSearch}
                        onChange={(e) => setMediaSearch(e.target.value)}
                        placeholder="Search saved files..."
                        className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-700"
                      />
                    </div>
                  </div>

                  {/* Failed Optimization Records (Dismissible) */}
                  {mediaAssets.some((a) => a.status === 'failed') && (
                    <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 space-y-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-rose-950">Failed Media Uploads</span>
                      </div>
                      <div className="space-y-1.5">
                        {mediaAssets
                          .filter((a) => a.status === 'failed')
                          .slice(0, 5)
                          .map((asset) => (
                            <div
                              key={asset.id}
                              className="p-2 rounded-lg bg-white border border-rose-200 flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-slate-900 truncate">{asset.fileName}</div>
                                {asset.errorMessage && (
                                  <p className="text-[10.5px] text-rose-700 mt-0.5 break-words">{asset.errorMessage}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteMediaAssetRecord(asset.id);
                                  setMediaAssets((prev) => prev.filter((item) => item.id !== asset.id));
                                }}
                                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold cursor-pointer shrink-0"
                              >
                                Dismiss
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {mediaLoading ? (
                    <p className="text-xs text-slate-500 text-center py-6">Loading bucket files...</p>
                  ) : filteredMediaFiles.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">
                      No matching files found in "{mediaBucket}".
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs bg-white">
                      {filteredMediaFiles.map((f) => {
                        const durationVal =
                          mediaDurations[f.publicUrl] ?? getCachedMediaDuration(f.publicUrl);
                        const durationText = formatMediaDuration(durationVal);
                        const savedTimestamp = formatMediaTimestamp(f.createdAt || f.updatedAt);
                        const fileSizeText = f.size ? formatBytes(f.size) : '';
                        const optMeta = mediaAssetMetaByUrl.get(f.publicUrl);

                        return (
                          <div
                            key={f.path}
                            className="p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white hover:bg-slate-50/80 transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() => setPreviewMediaItem(f)}
                              className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                              title="Click to preview stored file"
                            >
                              {f.mediaKind === 'image' ? (
                                <div className="w-14 h-11 rounded-lg overflow-hidden bg-slate-200 border border-slate-200 shrink-0">
                                  <img
                                    src={f.publicUrl}
                                    alt={cleanDisplayFileName(f.name)}
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : f.mediaKind === 'video' ? (
                                <div className="relative w-14 h-11 rounded-lg overflow-hidden bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0">
                                  <Play className="w-4 h-4 text-white fill-white/80" />
                                  {durationText && (
                                    <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/80 text-white text-[9px] font-mono tabular-nums">
                                      {durationText}
                                    </span>
                                  )}
                                </div>
                              ) : f.mediaKind === 'audio' ? (
                                <div className="w-14 h-11 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center shrink-0">
                                  <Music className="w-4 h-4 text-cyan-800" />
                                </div>
                              ) : (
                                <div className="w-14 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4 text-slate-700" />
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-slate-900 group-hover:text-cyan-800 block truncate">
                                  {cleanDisplayFileName(f.name)}
                                </span>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 tabular-nums mt-0.5">
                                  <span className="inline-flex items-center gap-1 capitalize text-slate-700 font-medium">
                                    {f.mediaKind === 'image' ? (
                                      <ImageIcon className="w-3 h-3 text-cyan-800" />
                                    ) : f.mediaKind === 'video' ? (
                                      <VideoIcon className="w-3 h-3 text-cyan-800" />
                                    ) : f.mediaKind === 'audio' ? (
                                      <Music className="w-3 h-3 text-cyan-800" />
                                    ) : (
                                      <FileText className="w-3 h-3 text-slate-600" />
                                    )}
                                    <span>{f.mediaKind}</span>
                                  </span>
                                  {(f.mediaKind === 'video' || f.mediaKind === 'audio') && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="inline-flex items-center gap-0.5 text-slate-700 font-medium">
                                        <Clock className="w-3 h-3" />
                                        <span>{durationText || '—:—'}</span>
                                      </span>
                                    </>
                                  )}
                                  {optMeta ? (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono uppercase text-cyan-900 font-semibold">
                                        {optMeta.format}
                                      </span>
                                      {optMeta.resolution && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span className="font-mono">{optMeta.resolution}</span>
                                        </>
                                      )}
                                      {optMeta.originalBytes > 0 && optMeta.optimizedBytes > 0 && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span>
                                            {formatBytes(optMeta.originalBytes)} → {formatBytes(optMeta.optimizedBytes)}
                                            {optMeta.compressionPct > 0 ? ` (-${optMeta.compressionPct}%)` : ''}
                                          </span>
                                        </>
                                      )}
                                      <span aria-hidden="true">·</span>
                                      <span
                                        className={`px-1 py-0.2 rounded text-[9.5px] font-bold uppercase ${
                                          optMeta.status === 'completed'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : optMeta.status === 'failed'
                                            ? 'bg-rose-50 text-rose-700'
                                            : 'bg-cyan-50 text-cyan-800'
                                        }`}
                                      >
                                        {optMeta.status}
                                      </span>
                                    </>
                                  ) : (
                                    fileSizeText && (
                                      <>
                                        <span aria-hidden="true">·</span>
                                        <span>{fileSizeText}</span>
                                      </>
                                    )
                                  )}
                                  {savedTimestamp && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>Saved {savedTimestamp}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center justify-end gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setPreviewMediaItem(f)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-900 text-[11px] font-semibold cursor-pointer"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Preview</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(f.publicUrl);
                                  setCopiedMediaUrl(f.path);
                                  setTimeout(() => setCopiedMediaUrl(null), 1500);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-[11px] cursor-pointer"
                              >
                                {copiedMediaUrl === f.path ? (
                                  <Check className="w-3 h-3 text-emerald-700" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                                <span>Copy URL</span>
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  await deleteBucketMediaFile(mediaBucket, f.path);
                                  if (optMeta?.id) {
                                    await deleteMediaAssetRecord(optMeta.id);
                                    setMediaAssets((prev) => prev.filter((x) => x.id !== optMeta.id));
                                  }
                                  setMediaFiles((prev) => prev.filter((x) => x.path !== f.path));
                                  showNotice('File deleted.');
                                }}
                                className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50 cursor-pointer"
                                title="Delete file"
                                aria-label="Delete file"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <MediaPreviewDialog
                    item={previewMediaItem}
                    durationSec={
                      previewMediaItem ? mediaDurations[previewMediaItem.publicUrl] : undefined
                    }
                    onClose={() => setPreviewMediaItem(null)}
                    onDurationResolved={(url, sec) => {
                      setMediaDurations((prev) => ({ ...prev, [url]: sec }));
                    }}
                    onCopyUrl={(item) => {
                      navigator.clipboard.writeText(item.publicUrl);
                      setCopiedMediaUrl(item.path);
                      setTimeout(() => setCopiedMediaUrl(null), 1500);
                    }}
                    onDelete={async (item) => {
                      await deleteBucketMediaFile(mediaBucket, item.path);
                      setMediaFiles((prev) => prev.filter((x) => x.path !== item.path));
                      showNotice('File deleted.');
                    }}
                  />
                </div>
              )}

              {/* TAB: WEBSITE SETTINGS (5 REAL-TIME CONTROL MODULES) */}
              {activeTab === 'settings' && (
                <div className="w-full max-w-full overflow-hidden space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <h2 className="text-sm font-bold text-slate-950 text-center flex-1">
                      Website Settings
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowRlsSqlModal(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#edf2f8] hover:bg-white text-slate-800 border border-[#b8c6d4] text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-800" />
                        <span>View RLS Policy SQL</span>
                      </button>
                      <button
                        type="button"
                        disabled={savingSettings}
                        onClick={async () => {
                          setSavingSettings(true);
                          try {
                            await saveWebsiteSettingsToSupabase(siteSettings);
                            await saveBio(bioForm);
                            showNotice('All website settings & appearance saved to Supabase.');
                          } catch (err: any) {
                            showNotice(err?.message || 'Error saving settings.');
                          } finally {
                            setSavingSettings(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-900 text-white text-xs font-semibold cursor-pointer shrink-0 whitespace-nowrap"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingSettings ? 'Saving...' : 'Save All Settings'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Sub-tab Switcher */}
                  <div className="flex flex-wrap items-center justify-start gap-1.5 text-[11px]">
                    {[
                      { id: 'appearance', label: 'Theme & Global Appearance', icon: <Palette className="w-3 h-3" /> },
                      { id: 'homepage', label: 'Homepage Editor', icon: <Home className="w-3 h-3" /> },
                      { id: 'projects_articles', label: 'Projects & Articles Manager', icon: <Sliders className="w-3 h-3" /> },
                      { id: 'profile_sections', label: 'Profile Section Manager', icon: <LayoutTemplate className="w-3 h-3" /> },
                      { id: 'career_studio', label: 'Career Studio Forms', icon: <FileText className="w-3 h-3" /> },
                      { id: 'footer', label: 'Footer & Lock Position', icon: <Sparkles className="w-3 h-3" /> },
                      { id: 'moderation', label: 'Comment & General Rules', icon: <Type className="w-3 h-3" /> },
                      { id: 'security_mfa', label: 'Security & MFA (2FA)', icon: <ShieldCheck className="w-3 h-3" /> },
                      { id: 'supabase_tables', label: 'Supabase Database Tables', icon: <Database className="w-3 h-3" /> },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSettingsSubTab(st.id as any)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer whitespace-nowrap ${
                          settingsSubTab === st.id
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-[#edf2f8] text-slate-800 border-[#b8c6d4] hover:bg-white'
                        }`}
                      >
                        {st.icon}
                        <span>{st.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* (a) THEME & GLOBAL APPEARANCE */}
                  {settingsSubTab === 'appearance' && (
                    <div className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <span className="font-bold text-slate-950">
                          Stored Selectable Themes ({siteSettings.appearanceConfig.storedThemes.length}) — Applies Live
                        </span>
                        {/* Two Theme Upload / Import Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[11px] font-semibold cursor-pointer">
                            <Upload className="w-3 h-3" />
                            <span>Upload Theme (.json)</span>
                            <input
                              type="file"
                              accept=".json,application/json"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const text = await file.text();
                                  handleImportThemeObject(JSON.parse(text));
                                } catch {
                                  showNotice('Invalid JSON theme file.');
                                } finally {
                                  e.target.value = '';
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setThemeImportOpen(!themeImportOpen)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            <FileJson className="w-3 h-3" />
                            <span>{themeImportOpen ? 'Close Importer' : 'Import / Create Theme'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Theme Grid (5 Built-in + Custom Themes) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {siteSettings.appearanceConfig.storedThemes.map((theme) => {
                          const isActive = siteSettings.appearanceConfig.activeThemeId === theme.id;
                          return (
                            <div
                              key={theme.id}
                              onClick={() =>
                                updateAppearance((prev) => ({
                                  ...prev,
                                  activeThemeId: theme.id,
                                }))
                              }
                              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer space-y-1.5 ${
                                isActive
                                  ? 'border-cyan-800 ring-2 ring-cyan-800/30 bg-white'
                                  : 'border-slate-300 bg-white/80 hover:border-slate-500'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-slate-950 truncate">{theme.name}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {isActive && (
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-900 text-white text-[9px] font-bold">
                                      Active
                                    </span>
                                  )}
                                  {theme.isCustom && !BUILT_IN_THEMES.some((b) => b.id === theme.id) && (
                                    <button
                                      type="button"
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        updateAppearance((prev) => ({
                                          ...prev,
                                          activeThemeId:
                                            prev.activeThemeId === theme.id
                                              ? 'classic-slate'
                                              : prev.activeThemeId,
                                          storedThemes: prev.storedThemes.filter((x) => x.id !== theme.id),
                                        }));
                                      }}
                                      className="p-0.5 text-rose-600 cursor-pointer"
                                      title="Remove custom theme"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {theme.description && (
                                <p className="text-[10px] text-slate-500 line-clamp-1">{theme.description}</p>
                              )}
                              <div className="flex items-center gap-1 pt-0.5">
                                {[theme.pageBg, theme.surfaceBg, theme.cardBg, theme.accentColor, theme.textColor, theme.footerBg].map(
                                  (swatch, i) => (
                                    <span
                                      key={i}
                                      className="w-4 h-4 rounded-full border border-slate-300"
                                      style={{ backgroundColor: swatch }}
                                      title={swatch}
                                    />
                                  )
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Inline Theme Importer / Custom Theme Builder */}
                      {themeImportOpen && (
                        <div className="w-full max-w-full overflow-hidden p-3 rounded-xl bg-white border border-slate-300 space-y-3">
                          <h4 className="font-bold text-slate-900">Import Theme JSON or Build Custom Theme</h4>
                          <div className="space-y-1.5">
                            <textarea
                              rows={3}
                              placeholder='Paste theme JSON here e.g. {"name":"Aero Blue","pageBg":"#e2e8f0","accentColor":"#0e7490","textColor":"#0f172a"}'
                              value={themeJsonInput}
                              onChange={(e) => setThemeJsonInput(e.target.value)}
                              className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50 font-mono text-[11px]"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                try {
                                  handleImportThemeObject(JSON.parse(themeJsonInput));
                                  setThemeJsonInput('');
                                } catch {
                                  showNotice('Invalid JSON syntax.');
                                }
                              }}
                              className="px-3 py-1 rounded bg-slate-900 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Import Theme from JSON
                            </button>
                          </div>
                          <div className="border-t border-slate-200 pt-2.5 space-y-2">
                            <span className="block font-bold text-slate-800">Or Create Custom Theme Visually:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="Custom Theme Name"
                                value={customThemeDraft.name}
                                onChange={(e) => setCustomThemeDraft({ ...customThemeDraft, name: e.target.value })}
                                className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300"
                              />
                              <input
                                type="text"
                                placeholder="Short Description"
                                value={customThemeDraft.description}
                                onChange={(e) =>
                                  setCustomThemeDraft({ ...customThemeDraft, description: e.target.value })
                                }
                                className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300"
                              />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {(
                                [
                                  ['pageBg', 'Page BG'],
                                  ['surfaceBg', 'Surface BG'],
                                  ['cardBg', 'Card BG'],
                                  ['textColor', 'Text Color'],
                                  ['accentColor', 'Accent'],
                                  ['borderColor', 'Border'],
                                  ['footerBg', 'Footer BG'],
                                ] as const
                              ).map(([key, label]) => (
                                <label key={key} className="flex items-center justify-between gap-1.5 p-1.5 rounded border border-slate-200 bg-slate-50 min-w-0">
                                  <span className="text-[10px] font-bold truncate">{label}</span>
                                  <input
                                    type="color"
                                    value={customThemeDraft[key]}
                                    onChange={(e) =>
                                      setCustomThemeDraft({ ...customThemeDraft, [key]: e.target.value })
                                    }
                                    className="w-6 h-6 rounded cursor-pointer border-0 shrink-0"
                                  />
                                </label>
                              ))}
                              <label className="flex items-center gap-1.5 p-1.5 rounded border border-slate-200 bg-slate-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={customThemeDraft.isDark}
                                  onChange={(e) =>
                                    setCustomThemeDraft({ ...customThemeDraft, isDark: e.target.checked })
                                  }
                                />
                                <span className="text-[10px] font-bold">Dark Theme</span>
                              </label>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                handleImportThemeObject({
                                  ...customThemeDraft,
                                  name: customThemeDraft.name || 'Custom Lab Theme',
                                  navbarBg: customThemeDraft.surfaceBg,
                                });
                              }}
                              className="px-3 py-1.5 rounded bg-cyan-900 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Save &amp; Apply Custom Theme
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 3 Stored Hero Animations + Toggles */}
                      <div className="border-t border-slate-200 pt-3 space-y-2.5">
                        <h4 className="font-bold text-slate-950">Homepage Hero Animations &amp; Card Motion</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {(
                            [
                              {
                                id: 'precision-grid',
                                title: '1. Precision CAD Grid',
                                desc: 'Subtle drafting blueprint grid drift behind hero',
                              },
                              {
                                id: 'orbital-pulse',
                                title: '2. Orbital Telemetry Pulse',
                                desc: 'Radial atmospheric field breathing animation',
                              },
                              {
                                id: 'blueprint-scan',
                                title: '3. Blueprint Laser Scan',
                                desc: 'Smooth horizontal metrology sweep line',
                              },
                            ] as Array<{ id: HeroAnimationEffectId; title: string; desc: string }>
                          ).map((anim) => {
                            const selected = siteSettings.appearanceConfig.heroAnimationEffect === anim.id;
                            return (
                              <button
                                key={anim.id}
                                type="button"
                                onClick={() =>
                                  updateAppearance((prev) => ({
                                    ...prev,
                                    heroAnimationEffect: anim.id,
                                  }))
                                }
                                className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                                  selected
                                    ? 'border-cyan-800 bg-cyan-50/70 ring-1 ring-cyan-800'
                                    : 'border-slate-300 bg-white hover:bg-slate-50'
                                }`}
                              >
                                <div className="font-bold text-slate-950 text-[11px]">{anim.title}</div>
                                <div className="text-[10px] text-slate-600">{anim.desc}</div>
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex flex-wrap gap-4 pt-1">
                          <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={siteSettings.appearanceConfig.heroAnimationEnabled}
                              onChange={(e) =>
                                updateAppearance((prev) => ({
                                  ...prev,
                                  heroAnimationEnabled: e.target.checked,
                                }))
                              }
                            />
                            <span>Enable Hero Section Animation</span>
                          </label>
                          <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={siteSettings.appearanceConfig.cardAnimationEnabled}
                              onChange={(e) =>
                                updateAppearance((prev) => ({
                                  ...prev,
                                  cardAnimationEnabled: e.target.checked,
                                }))
                              }
                            />
                            <span>Enable Card Hover Animations</span>
                          </label>
                        </div>
                      </div>

                      {/* Hero Background Image */}
                      <div className="border-t border-slate-200 pt-3 space-y-2">
                        <h4 className="font-bold text-slate-950">Homepage Hero Background Image</h4>
                        <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                          <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-cyan-800 text-white cursor-pointer shrink-0">
                            {heroBgUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                            <span>{heroBgUploading ? 'uploading...' : 'Upload Hero Image'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setHeroBgUploading(true);
                                try {
                                  const res = await uploadFileToBucket('projects', file, 'hero-bg');
                                  updateAppearance((prev) => ({
                                    ...prev,
                                    heroBackgroundImageUrl: res.publicUrl,
                                  }));
                                  showNotice('Hero background image uploaded.');
                                } catch (err: any) {
                                  showNotice(err?.message || 'Hero upload failed.');
                                } finally {
                                  setHeroBgUploading(false);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                          <input
                            type="url"
                            placeholder={
                              isSupabaseStorageUrl(siteSettings.appearanceConfig.heroBackgroundImageUrl)
                                ? 'Hero image uploaded'
                                : 'Or paste Hero Background Image URL...'
                            }
                            value={
                              isSupabaseStorageUrl(siteSettings.appearanceConfig.heroBackgroundImageUrl)
                                ? ''
                                : siteSettings.appearanceConfig.heroBackgroundImageUrl
                            }
                            onChange={(e) =>
                              updateAppearance((prev) => ({
                                ...prev,
                                heroBackgroundImageUrl: e.target.value,
                              }))
                            }
                            className="w-full min-w-0 flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                          />
                          {siteSettings.appearanceConfig.heroBackgroundImageUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                updateAppearance((prev) => ({
                                  ...prev,
                                  heroBackgroundImageUrl: '',
                                }))
                              }
                              className="px-2.5 py-1.5 rounded bg-rose-100 text-rose-800 text-[11px] font-semibold cursor-pointer shrink-0"
                            >
                              Clear Image
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* (a2) HOMEPAGE HERO & CARDS EDITOR */}
                  {settingsSubTab === 'homepage' && (() => {
                    const hc = siteSettings.appearanceConfig.homepageConfig || DEFAULT_HOMEPAGE_CONFIG;
                    const patchHomepage = (updater: (cur: HomepageConfig) => HomepageConfig) =>
                      updateAppearance((prev) => ({
                        ...prev,
                        homepageConfig: updater(prev.homepageConfig || DEFAULT_HOMEPAGE_CONFIG),
                      }));

                    const cardEntries: Array<{
                      key: keyof HomepageConfig['cards'];
                      label: string;
                      hasBadge?: boolean;
                    }> = [
                      { key: 'profile', label: 'Card 1: Profile & Credentials', hasBadge: true },
                      { key: 'overview', label: 'Card 2: Engineering Hub' },
                      { key: 'messaging', label: 'Card 3: Direct Messaging Channel', hasBadge: true },
                      { key: 'projects', label: 'Card 4: Engineering Portfolio (Projects)' },
                      { key: 'articles', label: 'Card 5: Engineering Articles' },
                      { key: 'documents', label: 'Card 6: Career Studio', hasBadge: true },
                    ];

                    return (
                      <div className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                          <div>
                            <h4 className="font-bold text-slate-950">Homepage Hero &amp; Cards Editor</h4>
                            <p className="text-[10.5px] text-slate-600">
                              Edit all homepage hero texts, CTA buttons, section headers, and card contents. Click Save All Settings to persist to Supabase.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              patchHomepage(() => DEFAULT_HOMEPAGE_CONFIG);
                              showNotice('Homepage texts reset to defaults (click Save All Settings to persist).');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-[11px] font-semibold cursor-pointer shrink-0"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset Defaults</span>
                          </button>
                        </div>

                        {/* Hero Section Fields */}
                        <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                          <h5 className="font-bold text-slate-900">1. Hero Section Contents</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="min-w-0">
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                Role Badge Title
                              </label>
                              <input
                                type="text"
                                value={hc.heroBadgeRole}
                                onChange={(e) => patchHomepage((c) => ({ ...c, heroBadgeRole: e.target.value }))}
                                className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                              />
                            </div>
                            <div className="min-w-0">
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                Certifications Text Override (blank = auto from Credentials)
                              </label>
                              <input
                                type="text"
                                value={hc.heroBadgeCertifications}
                                placeholder="Auto-synced from verified documents if blank"
                                onChange={(e) =>
                                  patchHomepage((c) => ({ ...c, heroBadgeCertifications: e.target.value }))
                                }
                                className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                              />
                            </div>
                            <div className="min-w-0">
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                Welcome Prefix
                              </label>
                              <input
                                type="text"
                                value={hc.heroWelcomePrefix}
                                onChange={(e) =>
                                  patchHomepage((c) => ({ ...c, heroWelcomePrefix: e.target.value }))
                                }
                                className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                              />
                            </div>
                            <div className="min-w-0">
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                Portfolio Heading Override (blank = auto from Profile Name)
                              </label>
                              <input
                                type="text"
                                value={hc.heroTitle}
                                placeholder="e.g. Festus, Olorunsogo's Portfolio"
                                onChange={(e) => patchHomepage((c) => ({ ...c, heroTitle: e.target.value }))}
                                className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                              Hero Description Override (blank = uses Profile Bio Summary)
                            </label>
                            <textarea
                              rows={2}
                              value={hc.heroDescription}
                              placeholder="Leave blank to use Profile Bio headline, or enter custom hero statement..."
                              onChange={(e) =>
                                patchHomepage((c) => ({ ...c, heroDescription: e.target.value }))
                              }
                              className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="min-w-0">
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                Primary CTA Button Label
                              </label>
                              <input
                                type="text"
                                value={hc.heroPrimaryCtaLabel}
                                onChange={(e) =>
                                  patchHomepage((c) => ({ ...c, heroPrimaryCtaLabel: e.target.value }))
                                }
                                className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                              />
                            </div>
                            <div className="min-w-0">
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                Secondary CTA Button Label
                              </label>
                              <input
                                type="text"
                                value={hc.heroSecondaryCtaLabel}
                                onChange={(e) =>
                                  patchHomepage((c) => ({ ...c, heroSecondaryCtaLabel: e.target.value }))
                                }
                                className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Hero Section Height, Position, Padding, Margins & Inner Length Controls */}
                        {(() => {
                          const hl: HeroLayoutConfig = {
                            ...DEFAULT_HERO_LAYOUT_CONFIG,
                            ...(hc.heroLayout || {}),
                            heroElementOrder: normalizeHeroElementOrder(hc.heroLayout?.heroElementOrder),
                          };
                          const patchHeroLayout = (updater: (cur: HeroLayoutConfig) => HeroLayoutConfig) =>
                            patchHomepage((c) => {
                              const curHl: HeroLayoutConfig = {
                                ...DEFAULT_HERO_LAYOUT_CONFIG,
                                ...(c.heroLayout || {}),
                                heroElementOrder: normalizeHeroElementOrder(c.heroLayout?.heroElementOrder),
                              };
                              return {
                                ...c,
                                heroLayout: updater(curHl),
                              };
                            });

                          const moveHeroElement = (idx: number, direction: -1 | 1) => {
                            const targetIdx = idx + direction;
                            if (targetIdx < 0 || targetIdx >= hl.heroElementOrder.length) return;
                            patchHeroLayout((cur) => {
                              const nextOrder = [...cur.heroElementOrder];
                              const [moved] = nextOrder.splice(idx, 1);
                              nextOrder.splice(targetIdx, 0, moved);
                              return { ...cur, heroElementOrder: nextOrder };
                            });
                          };

                          const elementMeta: Record<HeroElementKey, { label: string; hint: string }> = {
                            badge: { label: 'Role Badge & Credentials', hint: 'Availability pill + role & certs' },
                            title: { label: 'Welcome Prefix & Portfolio Heading', hint: 'Main H1 welcome title' },
                            description: { label: 'Hero Description Statement', hint: 'Intro summary paragraph' },
                            cta: { label: 'CTA Action Buttons', hint: 'Primary & secondary buttons row' },
                          };

                          const renderRangeField = (
                            label: string,
                            value: number,
                            min: number,
                            max: number,
                            step: number,
                            onChangeNum: (val: number) => void
                          ) => (
                            <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-[10px] font-bold text-slate-700">{label}</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    min={min}
                                    max={max}
                                    step={step}
                                    value={value}
                                    onChange={(e) => {
                                      const parsed = Number(e.target.value);
                                      if (!Number.isNaN(parsed)) {
                                        onChangeNum(Math.min(max, Math.max(min, parsed)));
                                      }
                                    }}
                                    className="w-14 px-1.5 py-0.5 text-right text-[10px] font-mono rounded border border-slate-300 bg-white text-slate-900"
                                  />
                                  <span className="text-[10px] text-slate-500 font-mono">px</span>
                                </div>
                              </div>
                              <input
                                type="range"
                                min={min}
                                max={max}
                                step={step}
                                value={value}
                                onChange={(e) => onChangeNum(Number(e.target.value))}
                                className="w-full accent-cyan-800 cursor-pointer h-1.5"
                              />
                            </div>
                          );

                          return (
                            <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                                <div>
                                  <h5 className="font-bold text-slate-900">
                                    2. Hero Height, Position, Padding, Margins &amp; Inner Length
                                  </h5>
                                  <p className="text-[10px] text-slate-600">
                                    Adjust Hero vertical height, re-order inner blocks, customize alignment, padding, margins, and element widths. Updates preview live; click Save All Settings to persist to Supabase.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    patchHeroLayout(() => DEFAULT_HERO_LAYOUT_CONFIG);
                                    showNotice('Hero layout settings reset to compact defaults (click Save All Settings to persist).');
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-[10px] font-semibold cursor-pointer shrink-0"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Reset Hero Layout</span>
                                </button>
                              </div>

                              {/* Section Height & Alignment */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                {renderRangeField('Hero Min Height', hl.heroMinHeight, 200, 640, 10, (val) =>
                                  patchHeroLayout((cur) => ({ ...cur, heroMinHeight: val }))
                                )}
                                {renderRangeField('Outer Top/Bottom Padding', hl.heroPaddingY, 12, 120, 2, (val) =>
                                  patchHeroLayout((cur) => ({ ...cur, heroPaddingY: val }))
                                )}
                                <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                                  <label className="block text-[10px] font-bold text-slate-700">
                                    Inner Horizontal Alignment
                                  </label>
                                  <div className="grid grid-cols-3 gap-1">
                                    {(['left', 'center', 'right'] as const).map((align) => (
                                      <button
                                        key={align}
                                        type="button"
                                        onClick={() => patchHeroLayout((cur) => ({ ...cur, heroTextAlign: align }))}
                                        className={`px-2 py-1 rounded text-[10px] font-bold capitalize border cursor-pointer transition-colors ${
                                          hl.heroTextAlign === align
                                            ? 'bg-cyan-900 text-white border-cyan-900'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                        }`}
                                      >
                                        {align}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div className="p-2 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
                                  <label className="block text-[10px] font-bold text-slate-700">
                                    Inner Vertical Position
                                  </label>
                                  <div className="grid grid-cols-3 gap-1">
                                    {(
                                      [
                                        { id: 'start', label: 'Top' },
                                        { id: 'center', label: 'Center' },
                                        { id: 'end', label: 'Bottom' },
                                      ] as const
                                    ).map((pos) => (
                                      <button
                                        key={pos.id}
                                        type="button"
                                        onClick={() => patchHeroLayout((cur) => ({ ...cur, heroVerticalAlign: pos.id }))}
                                        className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                                          hl.heroVerticalAlign === pos.id
                                            ? 'bg-cyan-900 text-white border-cyan-900'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                        }`}
                                      >
                                        {pos.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              {/* Inner Padding & Element Lengths (Max Widths) */}
                              <div className="space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  Inner Container Padding &amp; Content Lengths
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                  {renderRangeField('Inner Padding Left/Right', hl.heroInnerPaddingX, 0, 80, 2, (val) =>
                                    patchHeroLayout((cur) => ({ ...cur, heroInnerPaddingX: val }))
                                  )}
                                  {renderRangeField('Inner Padding Top/Bottom', hl.heroInnerPaddingY, 0, 64, 2, (val) =>
                                    patchHeroLayout((cur) => ({ ...cur, heroInnerPaddingY: val }))
                                  )}
                                  {renderRangeField('Container Max Length', hl.heroContentMaxWidth, 480, 1200, 16, (val) =>
                                    patchHeroLayout((cur) => ({ ...cur, heroContentMaxWidth: val }))
                                  )}
                                  {renderRangeField('Role Badge Max Length', hl.heroBadgeMaxWidth, 240, 960, 10, (val) =>
                                    patchHeroLayout((cur) => ({ ...cur, heroBadgeMaxWidth: val }))
                                  )}
                                  {renderRangeField('Description Max Length', hl.heroDescriptionMaxWidth, 320, 960, 16, (val) =>
                                    patchHeroLayout((cur) => ({ ...cur, heroDescriptionMaxWidth: val }))
                                  )}
                                  {renderRangeField('CTA Row Max Length', hl.heroCtaMaxWidth, 260, 720, 12, (val) =>
                                    patchHeroLayout((cur) => ({ ...cur, heroCtaMaxWidth: val }))
                                  )}
                                </div>
                              </div>

                              {/* Element Margins & Button Gap */}
                              <div className="space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  Inner Content Margins &amp; Spacing
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                                  {renderRangeField('Badge Bottom Margin', hl.heroBadgeMarginBottom, 0, 48, 2, (val) =>
                                    patchHeroLayout((cur) => ({ ...cur, heroBadgeMarginBottom: val }))
                                  )}
                                  {renderRangeField('Heading Bottom Margin', hl.heroTitleMarginBottom, 0, 48, 2, (val) =>
                                    patchHeroLayout((cur) => ({ ...cur, heroTitleMarginBottom: val }))
                                  )}
                                  {renderRangeField('Description Bottom Margin', hl.heroDescriptionMarginBottom, 0, 48, 2, (val) =>
                                    patchHeroLayout((cur) => ({ ...cur, heroDescriptionMarginBottom: val }))
                                  )}
                                  {renderRangeField('CTA Top Margin', hl.heroCtaMarginTop, 0, 48, 2, (val) =>
                                    patchHeroLayout((cur) => ({ ...cur, heroCtaMarginTop: val }))
                                  )}
                                  {renderRangeField('CTA Button Gap', hl.heroCtaGap, 4, 36, 2, (val) =>
                                    patchHeroLayout((cur) => ({ ...cur, heroCtaGap: val }))
                                  )}
                                </div>
                              </div>

                              {/* Re-arrange Inner Elements Order */}
                              <div className="space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  Re-arrange Inner Elements Position (Top to Bottom Order)
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {hl.heroElementOrder.map((key, idx) => (
                                    <div
                                      key={key}
                                      className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-50"
                                    >
                                      <div className="min-w-0">
                                        <div className="text-[11px] font-bold text-slate-900 truncate">
                                          {idx + 1}. {elementMeta[key].label}
                                        </div>
                                        <div className="text-[9.5px] text-slate-500 truncate">
                                          {elementMeta[key].hint}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          disabled={idx === 0}
                                          onClick={() => moveHeroElement(idx, -1)}
                                          title="Move Up"
                                          className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                                        >
                                          <ArrowUp className="w-3 h-3 text-slate-700" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={idx === hl.heroElementOrder.length - 1}
                                          onClick={() => moveHeroElement(idx, 1)}
                                          title="Move Down"
                                          className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                                        >
                                          <ArrowDown className="w-3 h-3 text-slate-700" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Explore More Header */}
                        <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                          <h5 className="font-bold text-slate-900">3. Explore Section Header</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                Section Badge
                              </label>
                              <input
                                type="text"
                                value={hc.exploreBadge}
                                onChange={(e) =>
                                  patchHomepage((c) => ({ ...c, exploreBadge: e.target.value }))
                                }
                                className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                Section Title
                              </label>
                              <input
                                type="text"
                                value={hc.exploreTitle}
                                onChange={(e) =>
                                  patchHomepage((c) => ({ ...c, exploreTitle: e.target.value }))
                                }
                                className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                              Section Subtitle
                            </label>
                            <textarea
                              rows={2}
                              value={hc.exploreSubtitle}
                              onChange={(e) =>
                                patchHomepage((c) => ({ ...c, exploreSubtitle: e.target.value }))
                              }
                              className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                            />
                          </div>
                        </div>

                        {/* 5 Portal Cards */}
                        <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-3">
                          <h5 className="font-bold text-slate-900">4. Homepage Portal Cards</h5>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                            {cardEntries.map(({ key, label, hasBadge }) => {
                              const fallbackCard =
                                DEFAULT_HOMEPAGE_CONFIG.cards[key] || {
                                  badge: '',
                                  title: '',
                                  description: '',
                                  ctaLabel: '',
                                };
                              const cardVal = hc.cards[key] || fallbackCard;
                              return (
                                <div
                                  key={key}
                                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 space-y-2"
                                >
                                  <div className="font-bold text-cyan-950 text-[11px]">{label}</div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                        Card Title
                                      </label>
                                      <input
                                        type="text"
                                        value={cardVal.title}
                                        onChange={(e) =>
                                          patchHomepage((c) => ({
                                            ...c,
                                            cards: {
                                              ...c.cards,
                                              [key]: { ...(c.cards[key] || fallbackCard), title: e.target.value },
                                            },
                                          }))
                                        }
                                        className="w-full min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                        Action Link Label
                                      </label>
                                      <input
                                        type="text"
                                        value={cardVal.ctaLabel}
                                        onChange={(e) =>
                                          patchHomepage((c) => ({
                                            ...c,
                                            cards: {
                                              ...c.cards,
                                              [key]: { ...(c.cards[key] || fallbackCard), ctaLabel: e.target.value },
                                            },
                                          }))
                                        }
                                        className="w-full min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                                      />
                                    </div>
                                  </div>
                                  {hasBadge && (
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                        Badge Label
                                      </label>
                                      <input
                                        type="text"
                                        value={cardVal.badge || ''}
                                        onChange={(e) =>
                                          patchHomepage((c) => ({
                                            ...c,
                                            cards: {
                                              ...c.cards,
                                              [key]: { ...(c.cards[key] || fallbackCard), badge: e.target.value },
                                            },
                                          }))
                                        }
                                        className="w-full min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                                      />
                                    </div>
                                  )}
                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                      Card Description
                                    </label>
                                    <textarea
                                      rows={2}
                                      value={cardVal.description}
                                      onChange={(e) =>
                                        patchHomepage((c) => ({
                                          ...c,
                                          cards: {
                                            ...c.cards,
                                            [key]: { ...(c.cards[key] || fallbackCard), description: e.target.value },
                                          },
                                        }))
                                      }
                                      className="w-full min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* (b) PROJECTS & ARTICLES MANAGER */}
                  {settingsSubTab === 'projects_articles' && (
                    <div className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                      {/* Inner Layout Controls */}
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-950">Inner Card Grid Layout Controls</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="min-w-0">
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                              Desktop Grid Columns
                            </label>
                            <select
                              value={siteSettings.appearanceConfig.projectsArticlesConfig.innerLayout.gridColumns}
                              onChange={(e) =>
                                updateAppearance((prev) => ({
                                  ...prev,
                                  projectsArticlesConfig: {
                                    ...prev.projectsArticlesConfig,
                                    innerLayout: {
                                      ...prev.projectsArticlesConfig.innerLayout,
                                      gridColumns: Number(e.target.value) as 2 | 3 | 4,
                                    },
                                  },
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                            >
                              <option value={2}>2 Columns</option>
                              <option value={3}>3 Columns</option>
                              <option value={4}>4 Columns</option>
                            </select>
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                              Card Spacing
                            </label>
                            <select
                              value={siteSettings.appearanceConfig.projectsArticlesConfig.innerLayout.cardSpacing}
                              onChange={(e) =>
                                updateAppearance((prev) => ({
                                  ...prev,
                                  projectsArticlesConfig: {
                                    ...prev.projectsArticlesConfig,
                                    innerLayout: {
                                      ...prev.projectsArticlesConfig.innerLayout,
                                      cardSpacing: e.target.value as 'compact' | 'normal' | 'relaxed',
                                    },
                                  },
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                            >
                              <option value="compact">Compact</option>
                              <option value="normal">Normal</option>
                              <option value="relaxed">Relaxed</option>
                            </select>
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                              Card Text Alignment
                            </label>
                            <select
                              value={siteSettings.appearanceConfig.projectsArticlesConfig.innerLayout.cardTextAlign}
                              onChange={(e) =>
                                updateAppearance((prev) => ({
                                  ...prev,
                                  projectsArticlesConfig: {
                                    ...prev.projectsArticlesConfig,
                                    innerLayout: {
                                      ...prev.projectsArticlesConfig.innerLayout,
                                      cardTextAlign: e.target.value as 'left' | 'center' | 'justify',
                                    },
                                  },
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                            >
                              <option value="justify">Justified</option>
                              <option value="left">Left Aligned</option>
                              <option value="center">Centered</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Video & Media Card Controls */}
                      <div className="border-t border-slate-200 pt-3 space-y-2">
                        <h4 className="font-bold text-slate-950">Video &amp; Card Media Controls</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                          <div className="min-w-0">
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                              Container Aspect Ratio
                            </label>
                            <select
                              value={siteSettings.appearanceConfig.projectsArticlesConfig.videoCardControls.aspectRatio}
                              onChange={(e) =>
                                updateAppearance((prev) => ({
                                  ...prev,
                                  projectsArticlesConfig: {
                                    ...prev.projectsArticlesConfig,
                                    videoCardControls: {
                                      ...prev.projectsArticlesConfig.videoCardControls,
                                      aspectRatio: e.target.value as MediaAspectRatio,
                                    },
                                  },
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                            >
                              <option value="16/9">16:9 Widescreen</option>
                              <option value="9/16">9:16 (Vertical / Portrait)</option>
                              <option value="4/5">4:5 (Portrait Feed)</option>
                              <option value="3/4">3:4 (Portrait Feed)</option>
                              <option value="4/3">4:3 (Classic TV)</option>
                              <option value="1/1">1:1 Square</option>
                              <option value="21/9">21:9 Cinema</option>
                            </select>
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                              Media Fit Mode
                            </label>
                            <select
                              value={siteSettings.appearanceConfig.projectsArticlesConfig.videoCardControls.objectFit}
                              onChange={(e) =>
                                updateAppearance((prev) => ({
                                  ...prev,
                                  projectsArticlesConfig: {
                                    ...prev.projectsArticlesConfig,
                                    videoCardControls: {
                                      ...prev.projectsArticlesConfig.videoCardControls,
                                      objectFit: e.target.value as 'cover' | 'contain' | 'fill',
                                    },
                                  },
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                            >
                              <option value="cover">Cover (Crop to Fill)</option>
                              <option value="contain">Contain (No Crop)</option>
                              <option value="fill">Stretch to Fill</option>
                            </select>
                          </div>
                          <div className="min-w-0">
                            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                              Zoom Level ({siteSettings.appearanceConfig.projectsArticlesConfig.videoCardControls.zoomLevel.toFixed(2)}x)
                            </label>
                            <input
                              type="range"
                              min={1}
                              max={1.5}
                              step={0.05}
                              value={siteSettings.appearanceConfig.projectsArticlesConfig.videoCardControls.zoomLevel}
                              onChange={(e) =>
                                updateAppearance((prev) => ({
                                  ...prev,
                                  projectsArticlesConfig: {
                                    ...prev.projectsArticlesConfig,
                                    videoCardControls: {
                                      ...prev.projectsArticlesConfig.videoCardControls,
                                      zoomLevel: Number(e.target.value),
                                    },
                                  },
                                }))
                              }
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Image & Card Media Controls */}
                      {(() => {
                        const imgCtrl = siteSettings.appearanceConfig.projectsArticlesConfig.imageCardControls || {
                          aspectRatio: '4/3' as MediaAspectRatio,
                          objectFit: 'contain' as const,
                          zoomLevel: 1,
                        };
                        return (
                          <div className="border-t border-slate-200 pt-3 space-y-2">
                            <h4 className="font-bold text-slate-950">Image &amp; Card Media Controls</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                              <div className="min-w-0">
                                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                  Container Aspect Ratio
                                </label>
                                <select
                                  value={imgCtrl.aspectRatio}
                                  onChange={(e) =>
                                    updateAppearance((prev) => ({
                                      ...prev,
                                      projectsArticlesConfig: {
                                        ...prev.projectsArticlesConfig,
                                        imageCardControls: {
                                          ...imgCtrl,
                                          aspectRatio: e.target.value as MediaAspectRatio,
                                        },
                                      },
                                    }))
                                  }
                                  className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                                >
                                  <option value="16/9">16:9 Widescreen</option>
                                  <option value="9/16">9:16 (Vertical / Portrait)</option>
                                  <option value="4/5">4:5 (Portrait Feed)</option>
                                  <option value="3/4">3:4 (Portrait Feed)</option>
                                  <option value="4/3">4:3 (Classic TV)</option>
                                  <option value="1/1">1:1 Square</option>
                                  <option value="21/9">21:9 Cinema</option>
                                </select>
                              </div>
                              <div className="min-w-0">
                                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                  Media Fit Mode
                                </label>
                                <select
                                  value={imgCtrl.objectFit}
                                  onChange={(e) =>
                                    updateAppearance((prev) => ({
                                      ...prev,
                                      projectsArticlesConfig: {
                                        ...prev.projectsArticlesConfig,
                                        imageCardControls: {
                                          ...imgCtrl,
                                          objectFit: e.target.value as 'cover' | 'contain' | 'fill',
                                        },
                                      },
                                    }))
                                  }
                                  className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                                >
                                  <option value="cover">Cover (Crop to Fill)</option>
                                  <option value="contain">Contain (No Crop)</option>
                                  <option value="fill">Stretch to Fill</option>
                                </select>
                              </div>
                              <div className="min-w-0">
                                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                  Zoom Level ({imgCtrl.zoomLevel.toFixed(2)}x)
                                </label>
                                <input
                                  type="range"
                                  min={1}
                                  max={1.5}
                                  step={0.05}
                                  value={imgCtrl.zoomLevel}
                                  onChange={(e) =>
                                    updateAppearance((prev) => ({
                                      ...prev,
                                      projectsArticlesConfig: {
                                        ...prev.projectsArticlesConfig,
                                        imageCardControls: {
                                          ...imgCtrl,
                                          zoomLevel: Number(e.target.value),
                                        },
                                      },
                                    }))
                                  }
                                  className="w-full"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Custom Content Sections for Projects & Articles */}
                      <div className="border-t border-slate-200 pt-3 space-y-2.5">
                        <h4 className="font-bold text-slate-950">Add Custom Content Section (Projects / Articles)</h4>
                        <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <select
                              value={paSectionDraft.targetPage}
                              onChange={(e) =>
                                setPaSectionDraft({ ...paSectionDraft, targetPage: e.target.value as any })
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-slate-50"
                            >
                              <option value="both">Both Projects &amp; Articles</option>
                              <option value="projects">Projects Page Only</option>
                              <option value="articles">Articles Page Only</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Section Title *"
                              value={paSectionDraft.title}
                              onChange={(e) => setPaSectionDraft({ ...paSectionDraft, title: e.target.value })}
                              className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                            />
                            <select
                              value={paSectionDraft.textAlign}
                              onChange={(e) =>
                                setPaSectionDraft({ ...paSectionDraft, textAlign: e.target.value as any })
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-slate-50"
                            >
                              <option value="center">Center Align</option>
                              <option value="left">Left Align</option>
                              <option value="right">Right Align</option>
                            </select>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              placeholder="Subtitle (optional)"
                              value={paSectionDraft.subtitle}
                              onChange={(e) => setPaSectionDraft({ ...paSectionDraft, subtitle: e.target.value })}
                              className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                            />
                            <input
                              type="text"
                              placeholder="Small Badge Label (optional)"
                              value={paSectionDraft.badgeText}
                              onChange={(e) => setPaSectionDraft({ ...paSectionDraft, badgeText: e.target.value })}
                              className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                            />
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Custom Section Content..."
                            value={paSectionDraft.body}
                            onChange={(e) => setPaSectionDraft({ ...paSectionDraft, body: e.target.value })}
                            className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                if (!paSectionDraft.title.trim()) return;
                                const sec: CustomPageContentSection = {
                                  id: `pa_sec_${Date.now()}`,
                                  targetPage: paSectionDraft.targetPage,
                                  title: paSectionDraft.title.trim(),
                                  subtitle: paSectionDraft.subtitle.trim() || undefined,
                                  badgeText: paSectionDraft.badgeText.trim() || undefined,
                                  body: paSectionDraft.body.trim(),
                                  textAlign: paSectionDraft.textAlign,
                                  visible: true,
                                };
                                updateAppearance((prev) => ({
                                  ...prev,
                                  projectsArticlesConfig: {
                                    ...prev.projectsArticlesConfig,
                                    customSections: [...prev.projectsArticlesConfig.customSections, sec],
                                  },
                                }));
                                setPaSectionDraft({
                                  targetPage: 'both',
                                  title: '',
                                  subtitle: '',
                                  badgeText: '',
                                  body: '',
                                  textAlign: 'center',
                                });
                                showNotice('Custom section added.');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1 rounded bg-cyan-900 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Section</span>
                            </button>
                          </div>
                        </div>

                        {siteSettings.appearanceConfig.projectsArticlesConfig.customSections.length > 0 && (
                          <div className="space-y-1.5">
                            {siteSettings.appearanceConfig.projectsArticlesConfig.customSections.map((sec) => (
                              <div
                                key={sec.id}
                                className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-slate-950 block truncate">{sec.title}</span>
                                  <span className="text-[10px] text-slate-500">
                                    Target: {sec.targetPage} · {sec.visible ? 'Visible' : 'Hidden'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateAppearance((prev) => ({
                                        ...prev,
                                        projectsArticlesConfig: {
                                          ...prev.projectsArticlesConfig,
                                          customSections: prev.projectsArticlesConfig.customSections.map((x) =>
                                            x.id === sec.id ? { ...x, visible: !x.visible } : x
                                          ),
                                        },
                                      }))
                                    }
                                    className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] cursor-pointer"
                                  >
                                    {sec.visible ? 'Hide' : 'Show'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateAppearance((prev) => ({
                                        ...prev,
                                        projectsArticlesConfig: {
                                          ...prev.projectsArticlesConfig,
                                          customSections: prev.projectsArticlesConfig.customSections.filter(
                                            (x) => x.id !== sec.id
                                          ),
                                        },
                                      }))
                                    }
                                    className="p-1 text-rose-600 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* (c) PROFILE PAGE SECTION MANAGER */}
                  {settingsSubTab === 'profile_sections' && (
                    <div className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-950">Built-In Profile Sections (Edit Title / Show / Hide)</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {siteSettings.appearanceConfig.profileSectionManager.builtInSections.map((sec) => (
                            <div
                              key={sec.id}
                              className="p-2 rounded-lg bg-white border border-slate-200 flex items-center gap-2 min-w-0"
                            >
                              <input
                                type="text"
                                value={sec.label}
                                onChange={(e) =>
                                  updateAppearance((prev) => ({
                                    ...prev,
                                    profileSectionManager: {
                                      ...prev.profileSectionManager,
                                      builtInSections: prev.profileSectionManager.builtInSections.map((b) =>
                                        b.id === sec.id ? { ...b, label: e.target.value } : b
                                      ),
                                    },
                                  }))
                                }
                                className="w-full min-w-0 flex-1 px-2 py-1 rounded border border-slate-300 bg-slate-50 text-[11px] font-semibold"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  updateAppearance((prev) => ({
                                    ...prev,
                                    profileSectionManager: {
                                      ...prev.profileSectionManager,
                                      builtInSections: prev.profileSectionManager.builtInSections.map((b) =>
                                        b.id === sec.id ? { ...b, visible: !b.visible } : b
                                      ),
                                    },
                                  }))
                                }
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold shrink-0 cursor-pointer ${
                                  sec.visible
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {sec.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                                <span>{sec.visible ? 'Visible' : 'Hidden'}</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Append Custom Section using 5 Selectable Templates */}
                      <div className="border-t border-slate-200 pt-3 space-y-2.5">
                        <h4 className="font-bold text-slate-950">
                          Append Custom Profile Section (5 Templates Available)
                        </h4>
                        <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="min-w-0">
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                Template Style (5 Options)
                              </label>
                              <select
                                value={profSectionDraft.template}
                                onChange={(e) =>
                                  setProfSectionDraft({
                                    ...profSectionDraft,
                                    template: e.target.value as CustomProfileTemplateType,
                                  })
                                }
                                className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-slate-50"
                              >
                                <option value="rich-essay">1. Rich Narrative / Essay Block</option>
                                <option value="two-col-cards">2. Two-Column Cards Grid</option>
                                <option value="timeline">3. Structured Chronological Timeline</option>
                                <option value="metrics-grid">4. Key Metrics / KPI Cards Grid</option>
                                <option value="media-showcase">5. Media &amp; Visual Showcase</option>
                              </select>
                            </div>
                            <div className="min-w-0">
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                Section Heading *
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Engineering Patents"
                                value={profSectionDraft.title}
                                onChange={(e) =>
                                  setProfSectionDraft({ ...profSectionDraft, title: e.target.value })
                                }
                                className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                              />
                            </div>
                            <div className="min-w-0">
                              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                                Subtitle (optional)
                              </label>
                              <input
                                type="text"
                                placeholder="Section subtitle"
                                value={profSectionDraft.subtitle}
                                onChange={(e) =>
                                  setProfSectionDraft({ ...profSectionDraft, subtitle: e.target.value })
                                }
                                className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                              />
                            </div>
                          </div>

                          <textarea
                            rows={2}
                            placeholder={
                              profSectionDraft.template === 'rich-essay'
                                ? 'Main section narrative / essay body...'
                                : 'Introductory summary (optional)...'
                            }
                            value={profSectionDraft.body}
                            onChange={(e) => setProfSectionDraft({ ...profSectionDraft, body: e.target.value })}
                            className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                          />

                          {profSectionDraft.template === 'media-showcase' && (
                            <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                              <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-cyan-800 text-white cursor-pointer shrink-0">
                                {profMediaUploading ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Upload className="w-3 h-3" />
                                )}
                                <span>{profMediaUploading ? 'uploading...' : 'Upload Section Image'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setProfMediaUploading(true);
                                    try {
                                      const res = await uploadFileToBucket('materials', file, 'profile-sections');
                                      setProfSectionDraft((p) => ({ ...p, mediaUrl: res.publicUrl }));
                                    } finally {
                                      setProfMediaUploading(false);
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                              <input
                                type="url"
                                placeholder={
                                  isSupabaseStorageUrl(profSectionDraft.mediaUrl)
                                    ? 'Showcase image uploaded'
                                    : 'Or paste Showcase Image URL...'
                                }
                                value={
                                  isSupabaseStorageUrl(profSectionDraft.mediaUrl) ? '' : profSectionDraft.mediaUrl
                                }
                                onChange={(e) =>
                                  setProfSectionDraft({ ...profSectionDraft, mediaUrl: e.target.value })
                                }
                                className="w-full min-w-0 flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                              />
                              {profSectionDraft.mediaUrl && (
                                <button
                                  type="button"
                                  onClick={() => setProfSectionDraft({ ...profSectionDraft, mediaUrl: '' })}
                                  className="px-2.5 py-1.5 rounded bg-rose-100 text-rose-800 text-[11px] font-semibold cursor-pointer shrink-0"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          )}

                          {profSectionDraft.template !== 'rich-essay' && (
                            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                              <span className="block text-[11px] font-bold text-slate-800">
                                Add Card / Timeline / Metric Items ({profSectionDraft.items.length} added)
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  placeholder="Item Heading / Metric Value"
                                  value={profItemDraft.heading}
                                  onChange={(e) => setProfItemDraft({ ...profItemDraft, heading: e.target.value })}
                                  className="w-full min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                                />
                                <input
                                  type="text"
                                  placeholder="Subheading / Date / Unit"
                                  value={profItemDraft.subheading || ''}
                                  onChange={(e) =>
                                    setProfItemDraft({ ...profItemDraft, subheading: e.target.value })
                                  }
                                  className="w-full min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
                                />
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2 min-w-0">
                                <input
                                  type="text"
                                  placeholder="Item Detail / Description"
                                  value={profItemDraft.detail}
                                  onChange={(e) => setProfItemDraft({ ...profItemDraft, detail: e.target.value })}
                                  className="w-full min-w-0 flex-1 px-2 py-1 rounded border border-slate-300 bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!profItemDraft.heading.trim()) return;
                                    setProfSectionDraft((p) => ({
                                      ...p,
                                      items: [...p.items, { ...profItemDraft }],
                                    }));
                                    setProfItemDraft({ heading: '', subheading: '', detail: '', mediaUrl: '' });
                                  }}
                                  className="px-2.5 py-1 rounded bg-slate-800 text-white text-[11px] font-semibold cursor-pointer shrink-0"
                                >
                                  + Add Item
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                if (!profSectionDraft.title.trim()) return;
                                const newSec: CustomProfileSection = {
                                  id: `prof_sec_${Date.now()}`,
                                  template: profSectionDraft.template,
                                  title: profSectionDraft.title.trim(),
                                  subtitle: profSectionDraft.subtitle.trim() || undefined,
                                  body: profSectionDraft.body.trim() || undefined,
                                  mediaUrl: profSectionDraft.mediaUrl.trim() || undefined,
                                  items: profSectionDraft.items,
                                  visible: true,
                                };
                                updateAppearance((prev) => ({
                                  ...prev,
                                  profileSectionManager: {
                                    ...prev.profileSectionManager,
                                    customSections: [...prev.profileSectionManager.customSections, newSec],
                                  },
                                }));
                                setProfSectionDraft({
                                  template: 'rich-essay',
                                  title: '',
                                  subtitle: '',
                                  body: '',
                                  mediaUrl: '',
                                  items: [],
                                });
                                showNotice('Custom profile section appended.');
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-cyan-900 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Append Profile Section</span>
                            </button>
                          </div>
                        </div>

                        {siteSettings.appearanceConfig.profileSectionManager.customSections.length > 0 && (
                          <div className="space-y-1.5">
                            {siteSettings.appearanceConfig.profileSectionManager.customSections.map((sec) => (
                              <div
                                key={sec.id}
                                className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2"
                              >
                                <div className="min-w-0 flex-1">
                                  <input
                                    type="text"
                                    value={sec.title}
                                    onChange={(e) =>
                                      updateAppearance((prev) => ({
                                        ...prev,
                                        profileSectionManager: {
                                          ...prev.profileSectionManager,
                                          customSections: prev.profileSectionManager.customSections.map((x) =>
                                            x.id === sec.id ? { ...x, title: e.target.value } : x
                                          ),
                                        },
                                      }))
                                    }
                                    className="w-full min-w-0 font-bold text-slate-950 bg-transparent border-b border-transparent focus:border-slate-300 outline-none"
                                  />
                                  <span className="text-[10px] text-slate-500">
                                    Template: {sec.template} · {sec.items?.length || 0} items
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateAppearance((prev) => ({
                                        ...prev,
                                        profileSectionManager: {
                                          ...prev.profileSectionManager,
                                          customSections: prev.profileSectionManager.customSections.map((x) =>
                                            x.id === sec.id ? { ...x, visible: !x.visible } : x
                                          ),
                                        },
                                      }))
                                    }
                                    className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[10px] cursor-pointer"
                                  >
                                    {sec.visible ? 'Hide' : 'Show'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateAppearance((prev) => ({
                                        ...prev,
                                        profileSectionManager: {
                                          ...prev.profileSectionManager,
                                          customSections: prev.profileSectionManager.customSections.filter(
                                            (x) => x.id !== sec.id
                                          ),
                                        },
                                      }))
                                    }
                                    className="p-1 text-rose-600 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* (d) FOOTER SECTION & PROFILE LOCK POSITION EDITOR */}
                  {settingsSubTab === 'footer' && (
                    <div className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                      <h4 className="font-bold text-slate-950">Footer Layout, Text Sizing &amp; Profile Lock Icon Location</h4>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-bold text-slate-700">Footer Copyright / Primary Text</label>
                        <input
                          type="text"
                          value={siteSettings.appearanceConfig.footerConfig.copyrightText}
                          onChange={(e) =>
                            updateAppearance((prev) => ({
                              ...prev,
                              footerConfig: {
                                ...prev.footerConfig,
                                copyrightText: e.target.value,
                              },
                            }))
                          }
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Text Alignment</label>
                          <select
                            value={siteSettings.appearanceConfig.footerConfig.textAlign}
                            onChange={(e) =>
                              updateAppearance((prev) => ({
                                ...prev,
                                footerConfig: {
                                  ...prev.footerConfig,
                                  textAlign: e.target.value as 'left' | 'center' | 'right',
                                },
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Flex Justification</label>
                          <select
                            value={siteSettings.appearanceConfig.footerConfig.justifyContent}
                            onChange={(e) =>
                              updateAppearance((prev) => ({
                                ...prev,
                                footerConfig: {
                                  ...prev.footerConfig,
                                  justifyContent: e.target.value as 'start' | 'center' | 'between' | 'around',
                                },
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                          >
                            <option value="center">Center</option>
                            <option value="start">Start</option>
                            <option value="between">Space Between</option>
                            <option value="around">Space Around</option>
                          </select>
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Footer Text Size</label>
                          <select
                            value={siteSettings.appearanceConfig.footerConfig.fontSize}
                            onChange={(e) =>
                              updateAppearance((prev) => ({
                                ...prev,
                                footerConfig: {
                                  ...prev.footerConfig,
                                  fontSize: e.target.value as '10px' | '11px' | '12px' | '13px' | '14px',
                                },
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                          >
                            <option value="10px">10px (Small)</option>
                            <option value="11px">11px (Default)</option>
                            <option value="12px">12px (Medium)</option>
                            <option value="13px">13px (Large)</option>
                            <option value="14px">14px (Extra Large)</option>
                          </select>
                        </div>
                        <div className="min-w-0">
                          <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                            Profile Lock Icon Location
                          </label>
                          <select
                            value={siteSettings.appearanceConfig.footerConfig.lockIconPosition}
                            onChange={(e) =>
                              updateAppearance((prev) => ({
                                ...prev,
                                footerConfig: {
                                  ...prev.footerConfig,
                                  lockIconPosition: e.target.value as FooterLockPosition,
                                },
                              }))
                            }
                            className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                          >
                            <option value="inline-end">Inline Right of Copyright</option>
                            <option value="inline-start">Inline Left of Copyright</option>
                            <option value="bottom-left">Bottom-Left Corner</option>
                            <option value="bottom-right">Bottom-Right Corner</option>
                            <option value="center-below">Centered Below Footer</option>
                          </select>
                        </div>
                      </div>

                      {/* Add Custom Footer Section */}
                      <div className="border-t border-slate-200 pt-3 space-y-2">
                        <h5 className="font-bold text-slate-900">Add Custom Footer Section</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Footer Section Heading (e.g. Office Hours)"
                            value={footerSecDraft.heading}
                            onChange={(e) => setFooterSecDraft({ ...footerSecDraft, heading: e.target.value })}
                            className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                          />
                          <div className="flex gap-2 min-w-0">
                            <input
                              type="text"
                              placeholder="Content / Details"
                              value={footerSecDraft.content}
                              onChange={(e) => setFooterSecDraft({ ...footerSecDraft, content: e.target.value })}
                              className="w-full min-w-0 flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!footerSecDraft.heading.trim()) return;
                                const item: CustomFooterSection = {
                                  id: `ft_${Date.now()}`,
                                  heading: footerSecDraft.heading.trim(),
                                  content: footerSecDraft.content.trim(),
                                };
                                updateAppearance((prev) => ({
                                  ...prev,
                                  footerConfig: {
                                    ...prev.footerConfig,
                                    customSections: [...prev.footerConfig.customSections, item],
                                  },
                                }));
                                setFooterSecDraft({ heading: '', content: '' });
                              }}
                              className="px-3 py-1.5 rounded bg-cyan-900 text-white text-[11px] font-semibold cursor-pointer shrink-0"
                            >
                              + Add
                            </button>
                          </div>
                        </div>

                        {siteSettings.appearanceConfig.footerConfig.customSections.length > 0 && (
                          <div className="space-y-1.5">
                            {siteSettings.appearanceConfig.footerConfig.customSections.map((sec) => (
                              <div
                                key={sec.id}
                                className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-900 block truncate">{sec.heading}</span>
                                  <span className="text-[11px] text-slate-600 block truncate">{sec.content}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateAppearance((prev) => ({
                                      ...prev,
                                      footerConfig: {
                                        ...prev.footerConfig,
                                        customSections: prev.footerConfig.customSections.filter(
                                          (x) => x.id !== sec.id
                                        ),
                                      },
                                    }))
                                  }
                                  className="p-1 text-rose-600 cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* (e) COMMENT TYPOGRAPHY & GENERAL MODERATION */}
                  {settingsSubTab === 'moderation' && (
                    <div className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="min-w-0">
                          <label className="block font-bold text-slate-700 mb-1">Site Title</label>
                          <input
                            type="text"
                            value={siteSettings.siteTitle}
                            onChange={(e) => setSiteSettings({ ...siteSettings, siteTitle: e.target.value })}
                            className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                          />
                        </div>
                        <div className="min-w-0">
                          <label className="block font-bold text-slate-700 mb-1">Admin Author Badge Label</label>
                          <input
                            type="text"
                            value={siteSettings.adminAuthorLabel}
                            onChange={(e) =>
                              setSiteSettings({ ...siteSettings, adminAuthorLabel: e.target.value })
                            }
                            className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                          />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <label className="block font-bold text-slate-700 mb-1">Portfolio Headline</label>
                        <input
                          type="text"
                          value={bioForm.header}
                          onChange={(e) => setBioForm({ ...bioForm, header: e.target.value })}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-200 pt-2.5">
                        <div className="min-w-0">
                          <label className="block font-bold text-slate-700 mb-1">Comment Text Font Family</label>
                          <select
                            value={siteSettings.appearanceConfig.commentStyleConfig.fontFamily}
                            onChange={(e) =>
                              updateAppearance((prev) => ({
                                ...prev,
                                commentStyleConfig: {
                                  ...prev.commentStyleConfig,
                                  fontFamily: e.target.value,
                                },
                              }))
                            }
                            className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                          >
                            <option value='"Times New Roman", Times, serif'>Times New Roman</option>
                            <option value='Georgia, serif'>Georgia Serif</option>
                            <option value='Garamond, serif'>Garamond Classic</option>
                            <option value='Inter, system-ui, sans-serif'>Inter / Modern Sans</option>
                            <option value='"JetBrains Mono", monospace'>Technical Monospace</option>
                          </select>
                        </div>
                        <div className="min-w-0">
                          <label className="block font-bold text-slate-700 mb-1">Comment Text Font Size</label>
                          <select
                            value={siteSettings.appearanceConfig.commentStyleConfig.fontSize}
                            onChange={(e) =>
                              updateAppearance((prev) => ({
                                ...prev,
                                commentStyleConfig: {
                                  ...prev.commentStyleConfig,
                                  fontSize: e.target.value,
                                },
                              }))
                            }
                            className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                          >
                            <option value="11px">11px</option>
                            <option value="12px">12px</option>
                            <option value="13px">13px</option>
                            <option value="14px">14px</option>
                            <option value="15px">15px</option>
                            <option value="16px">16px</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4 pt-1">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                          <input
                            type="checkbox"
                            checked={siteSettings.allowVisitorArticles}
                            onChange={(e) =>
                              setSiteSettings({ ...siteSettings, allowVisitorArticles: e.target.checked })
                            }
                          />
                          <span>Allow Visitor Article Submissions</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                          <input
                            type="checkbox"
                            checked={siteSettings.requireArticleApproval}
                            onChange={(e) =>
                              setSiteSettings({ ...siteSettings, requireArticleApproval: e.target.checked })
                            }
                          />
                          <span>Require Owner Approval for Visitor Articles</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
                          <input
                            type="checkbox"
                            checked={siteSettings.requireCommentApproval}
                            onChange={(e) =>
                              setSiteSettings({ ...siteSettings, requireCommentApproval: e.target.checked })
                            }
                          />
                          <span>Require Owner Moderation for Comments</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* (e2) CAREER STUDIO FORMS CONTROL MANAGER & MODERATION */}
                  {settingsSubTab === 'career_studio' && (
                    <div className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div>
                          <h4 className="font-bold text-slate-950">Career Studio Forms Control Manager</h4>
                          <p className="text-[11px] text-slate-600">
                            Configure visitor permissions, category form availability, guidance hints, and published records.
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-cyan-900/10 text-cyan-900 text-[10px] font-bold">
                          8 Independent Templates
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-lg bg-white border border-slate-200">
                        <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                          <input
                            type="checkbox"
                            checked={siteSettings.appearanceConfig.careerStudioConfig.enabled}
                            onChange={(e) =>
                              updateAppearance((prev) => ({
                                ...prev,
                                careerStudioConfig: {
                                  ...prev.careerStudioConfig,
                                  enabled: e.target.checked,
                                },
                              }))
                            }
                          />
                          <span>Enable Career Studio Workspace</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                          <input
                            type="checkbox"
                            checked={siteSettings.appearanceConfig.careerStudioConfig.allowVisitorAccess}
                            onChange={(e) =>
                              updateAppearance((prev) => ({
                                ...prev,
                                careerStudioConfig: {
                                  ...prev.careerStudioConfig,
                                  allowVisitorAccess: e.target.checked,
                                },
                              }))
                            }
                          />
                          <span>Allow Public Visitor Document Creation</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                          <input
                            type="checkbox"
                            checked={siteSettings.appearanceConfig.careerStudioConfig.allowVisitorPublish}
                            onChange={(e) =>
                              updateAppearance((prev) => ({
                                ...prev,
                                careerStudioConfig: {
                                  ...prev.careerStudioConfig,
                                  allowVisitorPublish: e.target.checked,
                                },
                              }))
                            }
                          />
                          <span>Allow Visitors to Publish to Gallery</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                          <input
                            type="checkbox"
                            checked={siteSettings.appearanceConfig.careerStudioConfig.showPublishedShowcase}
                            onChange={(e) =>
                              updateAppearance((prev) => ({
                                ...prev,
                                careerStudioConfig: {
                                  ...prev.careerStudioConfig,
                                  showPublishedShowcase: e.target.checked,
                                },
                              }))
                            }
                          />
                          <span>Show Published Career Gallery Tab</span>
                        </label>
                      </div>

                      <div className="space-y-2">
                        <h5 className="font-bold text-slate-900">Per-Category Form Controls</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {DOCUMENT_CATEGORY_META.map((cat) => {
                            const categoryKey: DocumentWorkspaceCategory = cat.id;
                            const ctrl = siteSettings.appearanceConfig.careerStudioConfig.forms[categoryKey] || {
                              enabled: true,
                              showGuidance: false,
                              allowPublish: true,
                              customHint: '',
                            };
                            return (
                              <div
                                key={cat.id}
                                className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-2"
                              >
                                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                                  <span className="font-bold text-slate-950 truncate">{cat.label}</span>
                                  <label className="inline-flex items-center gap-1 cursor-pointer text-[11px] font-semibold text-cyan-900 shrink-0">
                                    <input
                                      type="checkbox"
                                      checked={ctrl.enabled}
                                      onChange={(e) =>
                                        updateAppearance((prev) => ({
                                          ...prev,
                                          careerStudioConfig: {
                                            ...prev.careerStudioConfig,
                                            forms: {
                                              ...prev.careerStudioConfig.forms,
                                              [categoryKey]: { ...ctrl, enabled: e.target.checked },
                                            },
                                          },
                                        }))
                                      }
                                    />
                                    <span>Enabled</span>
                                  </label>
                                </div>
                                <div className="flex flex-wrap gap-3 text-[11px]">
                                  <label className="inline-flex items-center gap-1 cursor-pointer text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={ctrl.showGuidance}
                                      onChange={(e) =>
                                        updateAppearance((prev) => ({
                                          ...prev,
                                          careerStudioConfig: {
                                            ...prev.careerStudioConfig,
                                            forms: {
                                              ...prev.careerStudioConfig.forms,
                                              [categoryKey]: { ...ctrl, showGuidance: e.target.checked },
                                            },
                                          },
                                        }))
                                      }
                                    />
                                    <span>Show Admin Note</span>
                                  </label>
                                  <label className="inline-flex items-center gap-1 cursor-pointer text-slate-700">
                                    <input
                                      type="checkbox"
                                      checked={ctrl.allowPublish}
                                      onChange={(e) =>
                                        updateAppearance((prev) => ({
                                          ...prev,
                                          careerStudioConfig: {
                                            ...prev.careerStudioConfig,
                                            forms: {
                                              ...prev.careerStudioConfig.forms,
                                              [categoryKey]: { ...ctrl, allowPublish: e.target.checked },
                                            },
                                          },
                                        }))
                                      }
                                    />
                                    <span>Allow Publish</span>
                                  </label>
                                </div>
                                <input
                                  type="text"
                                  placeholder="Optional admin note for this template..."
                                  value={ctrl.customHint || ''}
                                  onChange={(e) =>
                                    updateAppearance((prev) => ({
                                      ...prev,
                                      careerStudioConfig: {
                                        ...prev.careerStudioConfig,
                                        forms: {
                                          ...prev.careerStudioConfig.forms,
                                          [categoryKey]: { ...ctrl, customHint: e.target.value },
                                        },
                                      },
                                    }))
                                  }
                                  className="w-full min-w-0 px-2 py-1 rounded border border-slate-300 bg-slate-50 text-[11px]"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Career Studio Document Moderation */}
                      <div className="border-t border-slate-200 pt-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="font-bold text-slate-900">
                            Published Career Studio Documents ({careerStudioDocs.length})
                          </h5>
                          <button
                            type="button"
                            onClick={async () => {
                              const docs = await fetchPublishedGeneratedDocuments(true);
                              setCareerStudioDocs(docs);
                              showNotice('Career Studio documents refreshed.');
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 text-[11px] font-semibold cursor-pointer"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Refresh</span>
                          </button>
                        </div>

                        {careerStudioDocs.length === 0 ? (
                          <p className="text-[11px] text-slate-500 italic py-2">
                            No published Career Studio documents found yet.
                          </p>
                        ) : (
                          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                            {careerStudioDocs.map((doc) => {
                              const catMeta = DOCUMENT_CATEGORY_META.find((m) => m.id === doc.category);
                              return (
                                <div
                                  key={doc.id}
                                  className="p-2 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-slate-950 truncate">{doc.title}</span>
                                      <span
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                          doc.status === 'published'
                                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                                        }`}
                                      >
                                        {doc.status}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-600 truncate">
                                      {catMeta?.label || doc.category} · By: {doc.authorName || 'Author'} · {doc.viewsCount} views · {doc.downloadsCount} downloads
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const res = await deleteGeneratedDocumentRecord({
                                        id: doc.id,
                                        storagePaths: doc.storagePaths,
                                      });
                                      if (!res.ok) {
                                        showNotice(res.error || 'Failed to delete document.');
                                        return;
                                      }
                                      setCareerStudioDocs((prev) => prev.filter((x) => x.id !== doc.id));
                                      showNotice('Career Studio document deleted.');
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-semibold cursor-pointer shrink-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* (e3) SECURITY, AAL2 SESSION, MFA DEVICE MANAGEMENT & RECOVERY */}
                  {settingsSubTab === 'security_mfa' && (
                    <div className="w-full max-w-full overflow-hidden p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                        <div>
                          <h4 className="font-bold text-slate-950 flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-700" />
                            <span>Administrator Security &amp; Mandatory TOTP MFA (AAL2)</span>
                          </h4>
                          <p className="text-[11px] text-slate-600">
                            Manage Duo Mobile / Authenticator devices, monitor live AAL2 session assurance, and configure recovery.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void refreshMfaSecurityPanel()}
                          disabled={mfaDevicesLoading}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[11px] font-semibold cursor-pointer"
                        >
                          <RefreshCw className={`w-3 h-3 ${mfaDevicesLoading ? 'animate-spin' : ''}`} />
                          <span>Refresh</span>
                        </button>
                      </div>

                      {mfaActionMsg && (
                        <div
                          className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                            mfaActionMsg.type === 'success'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-rose-50 border-rose-200 text-rose-800'
                          }`}
                        >
                          {mfaActionMsg.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                          ) : (
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                          )}
                          <span>{mfaActionMsg.text}</span>
                        </div>
                      )}

                      {/* Live Session Assurance Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                        <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500">Authorized Email</span>
                          <p className="font-bold text-slate-950 truncate">
                            {liveAal2Status?.user?.email || AUTHORIZED_ADMIN_EMAIL}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            Email Confirmed &amp; Exclusive
                          </span>
                        </div>

                        <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500">Assurance Level</span>
                          <p className="font-bold text-emerald-800 uppercase">
                            {liveAal2Status?.currentLevel === 'aal2' ? 'AAL2 Verified' : 'Checking...'}
                          </p>
                          <span className="text-[10.5px] text-slate-600 block">
                            Enforced by Postgres RLS &amp; Server API
                          </span>
                        </div>

                        <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500">Session Controls</span>
                          <p className="text-[11px] text-slate-700">
                            Token expires:{' '}
                            <span className="font-mono font-semibold">
                              {liveAal2Status?.expiresAt
                                ? new Date(liveAal2Status.expiresAt).toLocaleTimeString()
                                : 'Active'}
                            </span>
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleSignOut()}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[11px] font-semibold cursor-pointer"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Sign Out All Devices</span>
                          </button>
                        </div>
                      </div>

                      {/* Enrolled TOTP Devices */}
                      <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h5 className="font-bold text-slate-950 flex items-center gap-1.5">
                              <Smartphone className="w-3.5 h-3.5 text-cyan-800" />
                              <span>Registered Authenticator Devices ({mfaDevices.length})</span>
                            </h5>
                            <p className="text-[11px] text-slate-600">
                              Enroll a backup Duo Mobile or Google Authenticator device in case your primary phone is lost.
                            </p>
                          </div>
                        </div>

                        {mfaDevices.length === 0 ? (
                          <p className="text-[11px] text-slate-500 italic">Loading enrolled devices...</p>
                        ) : (
                          <div className="space-y-1.5">
                            {mfaDevices.map((dev) => (
                              <div
                                key={dev.id}
                                className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-950">{dev.friendlyName}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold uppercase">
                                      Verified TOTP
                                    </span>
                                  </div>
                                  <p className="text-[10.5px] text-slate-500 font-mono">
                                    Factor ID: {dev.id.slice(0, 12)}…
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  disabled={mfaActionBusy || mfaDevices.length <= 1}
                                  title={
                                    mfaDevices.length <= 1
                                      ? 'Enroll another device before removing your final authenticator.'
                                      : 'Remove authenticator device'
                                  }
                                  onClick={async () => {
                                    setMfaActionBusy(true);
                                    setMfaActionMsg(null);
                                    try {
                                      const res = await unenrollAdminFactor(dev.id);
                                      if (!res.ok) {
                                        setMfaActionMsg({
                                          type: 'error',
                                          text: res.message || 'Unable to remove device.',
                                        });
                                        return;
                                      }
                                      setMfaActionMsg({
                                        type: 'success',
                                        text: `Removed authenticator device "${dev.friendlyName}".`,
                                      });
                                      await refreshMfaSecurityPanel();
                                    } finally {
                                      setMfaActionBusy(false);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 disabled:opacity-45 text-rose-700 border border-rose-200 text-[11px] font-semibold cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  <span>Remove</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Enroll Backup Authenticator Device */}
                        {!newDeviceEnrollment ? (
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              value={newDeviceName}
                              onChange={(e) => setNewDeviceName(e.target.value)}
                              placeholder="Backup device label (e.g. Spare Duo)"
                              className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50 text-xs"
                            />
                            <button
                              type="button"
                              disabled={mfaActionBusy}
                              onClick={async () => {
                                setMfaActionBusy(true);
                                setMfaActionMsg(null);
                                try {
                                  const payload = await startAdminTotpEnrollment(
                                    newDeviceName.trim() || 'Backup Authenticator'
                                  );
                                  setNewDeviceEnrollment(payload);
                                  setNewDeviceCode('');
                                  setNewDeviceShowKey(false);
                                } catch (err: any) {
                                  setMfaActionMsg({
                                    type: 'error',
                                    text: err?.message || 'Unable to initialize QR enrollment.',
                                  });
                                } finally {
                                  setMfaActionBusy(false);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-semibold cursor-pointer"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>Enroll Additional Authenticator</span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-cyan-50/70 border border-cyan-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-950">
                                Scan QR Code for "{newDeviceEnrollment.friendlyName}"
                              </span>
                              <button
                                type="button"
                                onClick={async () => {
                                  const fid = newDeviceEnrollment.factorId;
                                  setNewDeviceEnrollment(null);
                                  setNewDeviceCode('');
                                  setNewDeviceShowKey(false);
                                  await cancelPendingTotpEnrollment(fid);
                                }}
                                className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center gap-4">
                              <img
                                src={newDeviceEnrollment.qrCode}
                                alt="Backup Authenticator QR Code"
                                className="w-36 h-36 bg-white p-1.5 rounded-lg border border-slate-300 object-contain shrink-0"
                              />
                              <div className="flex-1 w-full space-y-2">
                                <p className="text-[11px] text-slate-700">
                                  Scan with Duo Mobile or another TOTP authenticator app, then enter the 6-digit code to activate this backup device.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setNewDeviceShowKey((v) => !v)}
                                  className="text-[11px] font-semibold text-cyan-800 hover:underline cursor-pointer"
                                >
                                  {newDeviceShowKey ? 'Hide setup key' : 'Show manual setup key'}
                                </button>
                                {newDeviceShowKey && newDeviceEnrollment.secret && (
                                  <code className="block p-1.5 rounded bg-white border border-slate-300 text-[10.5px] font-mono break-all select-all">
                                    {newDeviceEnrollment.secret}
                                  </code>
                                )}
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={newDeviceCode}
                                    onChange={(e) =>
                                      setNewDeviceCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                                    }
                                    placeholder="6-digit code"
                                    className="w-36 px-3 py-1.5 rounded border border-slate-300 bg-white font-mono text-sm font-bold tracking-widest text-center"
                                  />
                                  <button
                                    type="button"
                                    disabled={mfaActionBusy || newDeviceCode.length !== 6}
                                    onClick={async () => {
                                      setMfaActionBusy(true);
                                      setMfaActionMsg(null);
                                      try {
                                        const res = await verifyAdminTotpChallenge(
                                          newDeviceEnrollment.factorId,
                                          newDeviceCode
                                        );
                                        if (!res.ok) {
                                          setMfaActionMsg({
                                            type: 'error',
                                            text: res.message || 'Verification failed.',
                                          });
                                          return;
                                        }
                                        setNewDeviceEnrollment(null);
                                        setNewDeviceCode('');
                                        setNewDeviceShowKey(false);
                                        setMfaActionMsg({
                                          type: 'success',
                                          text: 'Backup authenticator device verified and activated.',
                                        });
                                        await refreshMfaSecurityPanel();
                                      } finally {
                                        setMfaActionBusy(false);
                                      }
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                                  >
                                    Verify &amp; Save
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Account Recovery & Database RLS Enforcement */}
                      <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2.5">
                        <h5 className="font-bold text-slate-950 flex items-center gap-1.5">
                          <LifeBuoy className="w-3.5 h-3.5 text-cyan-800" />
                          <span>Account Recovery &amp; Server RLS Hardening</span>
                        </h5>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          If your password is compromised, dispatch a password reset link exclusively to{' '}
                          <strong>{liveAal2Status?.user?.email || AUTHORIZED_ADMIN_EMAIL}</strong>. If all Duo Mobile devices are lost, remove old MFA factors in Supabase Authentication → Users and re-enroll a new QR code on next sign-in.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={mfaActionBusy}
                            onClick={async () => {
                              setMfaActionBusy(true);
                              const targetEmail = liveAal2Status?.user?.email || AUTHORIZED_ADMIN_EMAIL;
                              const res = await sendAdminPasswordRecovery(targetEmail);
                              setMfaActionMsg({
                                type: res.ok ? 'success' : 'error',
                                text: res.message,
                              });
                              setMfaActionBusy(false);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-900 text-xs font-semibold cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Send Password Recovery Email</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRlsSqlModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-cyan-950 text-xs font-semibold cursor-pointer"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Open AAL2 RLS SQL Update</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* (f) DIRECT SUPABASE DATABASE TABLES INSPECTOR & CRUD */}
                  {settingsSubTab === 'supabase_tables' && (
                    <SupabaseDatabaseManager
                      onTableMutated={() => {
                        void loadAllAdminData();
                      }}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* RLS POLICY SQL MODAL (Moved from Login Form to Admin Settings) */}
      {showRlsSqlModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowRlsSqlModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-white border border-[#b8c6d4] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#edf2f8] border-b border-[#b8c6d4] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-cyan-800" />
                <h3 className="text-xs sm:text-sm font-bold text-slate-950">
                  Supabase Database & Storage RLS Policy SQL
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(SUPABASE_RLS_SCHEMA_SQL.trim());
                    setCopiedRlsSql(true);
                    setTimeout(() => setCopiedRlsSql(false), 1800);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-900 text-white text-[11px] font-semibold cursor-pointer"
                >
                  {copiedRlsSql ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedRlsSql ? 'Copied' : 'Copy SQL'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowRlsSqlModal(false)}
                  className="p-1 rounded-lg text-slate-600 hover:bg-slate-200 cursor-pointer"
                  aria-label="Close SQL modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto bg-slate-950 text-emerald-300 font-mono text-[11px] leading-relaxed">
              <pre className="whitespace-pre-wrap break-words">{SUPABASE_RLS_SCHEMA_SQL.trim()}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
