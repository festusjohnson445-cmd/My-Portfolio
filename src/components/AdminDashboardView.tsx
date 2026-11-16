import React, { useState, useEffect, useMemo } from 'react';
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
  applyWebsiteSettingsLocally,
  getCachedWebsiteSettings,
  getCachedProjects,
  getCachedArticles,
  getCachedCommentsForAdmin,
  getCachedExperiences,
  getCachedPublications,
  getCachedAchievements,
  hasProjectsCacheHydrated,
  EVENT_PROJECTS_UPDATED,
  EVENT_ARTICLES_UPDATED,
  BUILT_IN_THEMES,
  DEFAULT_WEBSITE_SETTINGS,
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
} from '../utils/portfolioSupabase';
import {
  useProfileSync,
  setOwnerAuthenticated,
  type DocumentItem,
} from '../utils/profileState';
import {
  resolveSkillStatus,
  formatSkillStatusLabel,
  SKILL_STATUS_OPTIONS,
  type SkillStatus,
} from '../data/skillsData';
import { supabaseSignOutOwner } from '../utils/supabase';
import { ProjectFormPanel } from './ProjectFormPanel';
import { ArticleFormPanel } from './ArticleFormPanel';
import { SkillSelector } from './SkillSelector';
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
    'appearance' | 'projects_articles' | 'profile_sections' | 'footer' | 'moderation'
  >('appearance');
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
  const [credVerifiedLink, setCredVerifiedLink] = useState('');
  const [credUploading, setCredUploading] = useState(false);

  // Media Library
  const [mediaBucket, setMediaBucket] = useState<'projects' | 'articles' | 'materials' | 'avatars'>('projects');
  const [mediaFiles, setMediaFiles] = useState<BucketFileItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [copiedMediaUrl, setCopiedMediaUrl] = useState<string | null>(null);

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
    try {
      const [projs, arts, cmts, exps, pubs, achs, settings] = await Promise.all([
        fetchProjectsFromSupabase(true),
        fetchArticlesFromSupabase(true),
        fetchAllCommentsForAdmin(),
        fetchExperiencesFromSupabase(),
        fetchPublicationsFromSupabase(),
        fetchAchievementsFromSupabase(),
        fetchWebsiteSettingsFromSupabase(),
      ]);
      setProjects(projs);
      setArticles(arts);
      setComments(cmts);
      setExperiences(exps.length > 0 ? exps : (bio.experiences as ProfileExperience[]) || []);
      setPublications(pubs.length > 0 ? pubs : (bio.publications as ProfilePublication[]) || []);
      setAchievements(achs.length > 0 ? achs : (bio.achievements as ProfileAchievement[]) || []);
      setSiteSettings(settings);
    } finally {
      setLoading(false);
    }
  };

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
    setMediaLoading(true);
    try {
      const files = await listBucketMediaFiles(bucket);
      setMediaFiles(files);
    } finally {
      setMediaLoading(false);
    }
  };

  useEffect(() => {
    if (isOwner && activeTab === 'media') {
      loadMedia(mediaBucket);
    }
  }, [isOwner, activeTab, mediaBucket]);

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
    await supabaseSignOutOwner();
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
    setSiteSettings((prev) => {
      const next: WebsiteSettings = {
        ...prev,
        appearanceConfig: updater(prev.appearanceConfig),
      };
      applyWebsiteSettingsLocally(next);
      return next;
    });
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
    if (!credTitle.trim()) return;
    const isUpdate = Boolean(credEditingId);
    const id = credEditingId || `doc-${Date.now()}`;
    const item: DocumentItem = {
      id,
      title: credTitle.trim(),
      issuer: credIssuer.trim() || 'Issuing Authority',
      credentialId: `CRED-${Math.floor(1000 + Math.random() * 9000)}`,
      date: credDate.trim() || String(new Date().getFullYear()),
      category: credCategory,
      credentialGroup: credGroup,
      parentSpecializationId: credGroup === 'Courses' && credParentId ? credParentId : undefined,
      description: credDescription.trim() || credTitle.trim(),
      competencies: [],
      attachmentDataUrl: credAttachmentUrl.trim() || undefined,
      attachmentName: credAttachmentName || undefined,
      previewImageDataUrl: /\.(png|jpe?g|webp|gif|svg)$/i.test(credAttachmentUrl)
        ? credAttachmentUrl.trim()
        : undefined,
      verifiedLink: credVerifiedLink.trim() || undefined,
    };

    const nextDocs = isUpdate
      ? documents.map((d) => (d.id === id ? { ...d, ...item } : d))
      : [item, ...documents];
    await saveDocuments(nextDocs);
    setCredOpen(false);
    setCredEditingId(null);
    showNotice('Credential saved.');
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
                          <span>Upload PDF</span>
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
                          placeholder="Or paste Attachment URL"
                          value={pubForm.attachmentUrl || ''}
                          onChange={(e) => setPubForm({ ...pubForm, attachmentUrl: e.target.value })}
                          className="w-full min-w-0 flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setPubOpen(false)} className="px-3 py-1 rounded bg-slate-200 text-xs cursor-pointer">
                          Cancel
                        </button>
                        <button type="submit" className="px-3 py-1 rounded bg-cyan-900 text-white text-xs font-semibold cursor-pointer">
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
                          <span>Upload Certificate</span>
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
                          placeholder="Or paste Certificate URL"
                          value={achForm.certificateUrl || ''}
                          onChange={(e) => setAchForm({ ...achForm, certificateUrl: e.target.value })}
                          className="w-full min-w-0 flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
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
                        <button type="submit" className="px-3 py-1 rounded bg-cyan-900 text-white text-xs font-semibold cursor-pointer">
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
                        setCredVerifiedLink('');
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
                          <span>Upload File</span>
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              setCredUploading(true);
                              try {
                                const res = await uploadFileToBucket('materials', f, 'credentials');
                                setCredAttachmentUrl(res.publicUrl);
                                setCredAttachmentName(res.fileName);
                              } finally {
                                setCredUploading(false);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        <input
                          type="url"
                          placeholder="Or paste File URL"
                          value={credAttachmentUrl}
                          onChange={(e) => setCredAttachmentUrl(e.target.value)}
                          className="w-full min-w-0 flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
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
                        <button type="submit" className="px-3 py-1 rounded bg-cyan-900 text-white text-xs font-semibold cursor-pointer">
                          Save Credential
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
                            await saveDocuments(documents.filter((d) => d.id !== doc.id));
                            showNotice('Credential removed.');
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
                    <div className="flex items-center gap-2">
                      <select
                        value={mediaBucket}
                        onChange={(e) => setMediaBucket(e.target.value as any)}
                        className="px-2 py-1 rounded border border-slate-300 bg-white text-xs cursor-pointer"
                      >
                        <option value="projects">projects</option>
                        <option value="articles">articles</option>
                        <option value="materials">materials</option>
                        <option value="avatars">avatars</option>
                      </select>
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-xs font-semibold cursor-pointer">
                        {mediaUploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        <span>Upload</span>
                        <input
                          type="file"
                          multiple
                          onChange={async (e) => {
                            const files = e.target.files;
                            if (!files) return;
                            setMediaUploading(true);
                            try {
                              for (const f of Array.from(files)) {
                                await uploadFileToBucket(mediaBucket, f);
                              }
                              await loadMedia(mediaBucket);
                              showNotice(`Uploaded to "${mediaBucket}".`);
                            } finally {
                              setMediaUploading(false);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {mediaLoading ? (
                    <p className="text-xs text-slate-500 text-center py-6">Loading bucket files...</p>
                  ) : mediaFiles.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-6">No files found in "{mediaBucket}".</p>
                  ) : (
                    <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-xs">
                      {mediaFiles.map((f) => (
                        <div key={f.path} className="p-2.5 flex items-center justify-between gap-2 bg-white">
                          <span className="truncate font-semibold text-slate-800 flex-1">{f.path}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(f.publicUrl);
                                setCopiedMediaUrl(f.path);
                                setTimeout(() => setCopiedMediaUrl(null), 1500);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 border border-slate-300 text-[10px] cursor-pointer"
                            >
                              {copiedMediaUrl === f.path ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                              <span>Copy URL</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteBucketMediaFile(mediaBucket, f.path);
                                setMediaFiles((prev) => prev.filter((x) => x.path !== f.path));
                                showNotice('File deleted.');
                              }}
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
              )}

              {/* TAB: WEBSITE SETTINGS (5 REAL-TIME CONTROL MODULES) */}
              {activeTab === 'settings' && (
                <div className="w-full max-w-full overflow-hidden space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                    <h2 className="text-sm font-bold text-slate-950 text-center flex-1">
                      Website Settings &amp; Real-Time Appearance Control Center
                    </h2>
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-900 text-white text-xs font-semibold cursor-pointer shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingSettings ? 'Saving...' : 'Save All Settings'}</span>
                    </button>
                  </div>

                  {/* Sub-tab Switcher */}
                  <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
                    {[
                      { id: 'appearance', label: '(a) Theme & Global Appearance', icon: <Palette className="w-3 h-3" /> },
                      { id: 'projects_articles', label: '(b) Projects & Articles Manager', icon: <Sliders className="w-3 h-3" /> },
                      { id: 'profile_sections', label: '(c) Profile Section Manager', icon: <LayoutTemplate className="w-3 h-3" /> },
                      { id: 'footer', label: '(d) Footer & Lock Position', icon: <Sparkles className="w-3 h-3" /> },
                      { id: 'moderation', label: '(e) Comment & General Rules', icon: <Type className="w-3 h-3" /> },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setSettingsSubTab(st.id as any)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold cursor-pointer ${
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
                            <span>Upload Hero Image</span>
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
                            placeholder="Or paste Hero Background Image URL..."
                            value={siteSettings.appearanceConfig.heroBackgroundImageUrl}
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
                                      aspectRatio: e.target.value as '16/9' | '4/3' | '1/1' | '21/9',
                                    },
                                  },
                                }))
                              }
                              className="w-full min-w-0 px-2 py-1.5 rounded border border-slate-300 bg-white"
                            >
                              <option value="16/9">16:9 Widescreen</option>
                              <option value="4/3">4:3 Standard</option>
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
                                <span>Upload Section Image</span>
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
                                placeholder="Or paste Showcase Image URL..."
                                value={profSectionDraft.mediaUrl}
                                onChange={(e) =>
                                  setProfSectionDraft({ ...profSectionDraft, mediaUrl: e.target.value })
                                }
                                className="w-full min-w-0 flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-slate-50"
                              />
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
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
