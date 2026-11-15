import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Layers,
  BookOpen,
  MessageSquare,
  Briefcase,
  Award,
  FileText,
  Image as ImageIcon,
  Settings,
  LogOut,
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  CheckCircle2,
  AlertCircle,
  Copy,
  Download,
  Upload,
  Eye,
  EyeOff,
  RefreshCw,
  Code2,
  Palette,
  Sliders,
  Type,
  Layout,
  ExternalLink,
  ShieldCheck,
  FileCode,
  Archive,
  Save,
  Loader2
} from 'lucide-react';
import { supabase, supabaseSignOutOwner } from '../utils/supabase';
import { useProfileSync, setOwnerAuthenticated } from '../utils/profileState';
import { useSiteSettings, DEFAULT_SITE_SETTINGS } from '../context/SiteSettingsContext';
import { SUPABASE_COMPREHENSIVE_MIGRATION_SQL } from '../utils/supabaseMigrationSql';

export type AdminTab =
  | 'overview'
  | 'projects'
  | 'articles'
  | 'comments'
  | 'experience'
  | 'publications'
  | 'achievements'
  | 'media'
  | 'settings';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  onSignOut: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isOpen,
  onClose,
  onSignOut,
}) => {
  const { isOwner, bio } = useProfileSync();
  const {
    settings,
    updateSettings,
    exportThemeJson,
    importThemeJson,
    resetToDefaults,
  } = useSiteSettings();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [copiedSql, setCopiedSql] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Settings sub-navigation
  const [settingsSection, setSettingsSection] = useState<
    | 'theme'
    | 'buttons'
    | 'homepage'
    | 'forms'
    | 'resume'
    | 'projects_articles'
    | 'profile_sections'
    | 'footer'
  >('theme');

  // Local editable settings state
  const [localSettings, setLocalSettings] = useState(settings);
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // Overview metrics state
  const [metrics, setMetrics] = useState({
    projectsCount: 0,
    articlesCount: 0,
    commentsCount: 0,
    pendingArticlesCount: 0,
    materialsCount: 0,
  });

  // Projects & Articles list for moderation
  const [projectsList, setProjectsList] = useState<any[]>([]);
  const [articlesList, setArticlesList] = useState<any[]>([]);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Load admin data
  const loadAdminData = async () => {
    try {
      setLoadingData(true);
      const [projRes, artRes, commRes, matRes] = await Promise.all([
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('articles').select('*').order('created_at', { ascending: false }),
        supabase.from('article_comments').select('*').order('created_at', { ascending: false }),
        supabase.from('materials').select('id', { count: 'exact' }),
      ]);

      const projects = projRes.data || [];
      const articles = artRes.data || [];
      const comments = commRes.data || [];

      setProjectsList(projects);
      setArticlesList(articles);
      setCommentsList(comments);

      setMetrics({
        projectsCount: projects.length,
        articlesCount: articles.length,
        commentsCount: comments.length,
        pendingArticlesCount: articles.filter((a: any) => !a.is_approved).length,
        materialsCount: matRes.count || 0,
      });
    } catch (e) {
      console.warn('Admin load note:', e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAdminData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle saving site settings
  const handleSaveSettings = async () => {
    setSaveStatus('Saving settings to Supabase...');
    const success = await updateSettings(localSettings);
    if (success) {
      setSaveStatus('Settings successfully saved & synced across active sessions!');
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      setSaveStatus('Saved locally (remote update notice).');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  // Copy updated migration SQL
  const handleCopySql = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(SUPABASE_COMPREHENSIVE_MIGRATION_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    }
  };

  // Moderate article approval
  const handleToggleArticleApproval = async (articleId: string, currentStatus: boolean) => {
    try {
      await supabase.from('articles').update({ is_approved: !currentStatus }).eq('id', articleId);
      setArticlesList((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, is_approved: !currentStatus } : a))
      );
    } catch {}
  };

  // Delete article
  const handleDeleteArticle = async (articleId: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    try {
      await supabase.from('articles').delete().eq('id', articleId);
      setArticlesList((prev) => prev.filter((a) => a.id !== articleId));
    } catch {}
  };

  // Moderate comments
  const handleDeleteComment = async (commentId: string) => {
    try {
      await supabase.from('article_comments').delete().eq('id', commentId);
      setCommentsList((prev) => prev.filter((c) => c.id !== commentId));
    } catch {}
  };

  const handleArchiveComment = async (commentId: string, isArchived: boolean) => {
    try {
      await supabase.from('article_comments').update({ is_archived: !isArchived }).eq('id', commentId);
      setCommentsList((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, is_archived: !isArchived } : c))
      );
    } catch {}
  };

  // Delete project
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await supabase.from('projects').delete().eq('id', projectId);
      setProjectsList((prev) => prev.filter((p) => p.id !== projectId));
    } catch {}
  };

  // Secure Sign Out (housed exclusively within Admin Dashboard)
  const handleAdminSignOut = async () => {
    await supabaseSignOutOwner();
    setOwnerAuthenticated(false);
    onSignOut();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-hidden font-serif">
      <div className="relative w-full max-w-6xl bg-[#eaf0f6] border border-[#b8c6d4] rounded-2xl shadow-2xl overflow-hidden h-[92vh] flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#d4dce7] border-b border-[#b8c6d4] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-950 text-white flex items-center justify-center font-bold text-xs">
              FD
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm sm:text-base font-bold text-slate-950 leading-none">
                  Admin Dashboard &amp; Settings Panel
                </h2>
                <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-sans font-bold border border-emerald-300">
                  Authenticated Owner
                </span>
              </div>
              <span className="text-[11px] font-sans text-slate-600">
                {bio.fullName || 'Festus Johnson'} · Real-Time Supabase Synchronization
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Constant Updated SQL Code Button */}
            <button
              type="button"
              onClick={() => setShowSqlModal(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-xs font-serif font-bold shadow-2xs transition-colors cursor-pointer"
              title="View and copy production ready Supabase SQL migration script"
            >
              <Code2 className="w-3.5 h-3.5 text-cyan-900" />
              <span>SQL Code</span>
            </button>

            {/* Exclusive Sign Out Button */}
            <button
              type="button"
              onClick={handleAdminSignOut}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-serif font-bold shadow-2xs transition-colors cursor-pointer"
              title="Secure Sign Out (Exclusively in Admin Dashboard)"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Workspace Layout: Modern Sidebar + Main Content View */}
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Sidebar */}
          <aside className="w-56 sm:w-60 bg-[#dee5ee] border-r border-[#b8c6d4] flex flex-col justify-between shrink-0 p-3 overflow-y-auto">
            <div className="space-y-1">
              <span className="block text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 px-2 py-1">
                Admin Navigation
              </span>

              {[
                { id: 'overview' as const, label: 'Overview Analytics', icon: BarChart3, count: null },
                { id: 'projects' as const, label: 'Projects Manager', icon: Layers, count: metrics.projectsCount },
                { id: 'articles' as const, label: 'Blog & Articles', icon: BookOpen, count: metrics.articlesCount },
                { id: 'comments' as const, label: 'Comments Moderation', icon: MessageSquare, count: metrics.commentsCount },
                { id: 'experience' as const, label: 'Experience & Career', icon: Briefcase, count: null },
                { id: 'publications' as const, label: 'Publications', icon: FileText, count: null },
                { id: 'achievements' as const, label: 'Achievements & Awards', icon: Award, count: null },
                { id: 'media' as const, label: 'Media Library', icon: ImageIcon, count: metrics.materialsCount },
                { id: 'settings' as const, label: 'Site Settings Studio', icon: Settings, count: null },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-serif font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-white/70 hover:text-slate-950'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-300' : 'text-slate-500'}`} />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.count !== null && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                          isActive ? 'bg-cyan-800 text-cyan-100' : 'bg-slate-300 text-slate-700'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Status Box */}
            <div className="p-2.5 rounded-xl bg-white/70 border border-slate-300 text-[11px] text-slate-600 font-sans space-y-1">
              <div className="flex items-center justify-between">
                <span>Database:</span>
                <span className="text-emerald-700 font-bold">Supabase Realtime</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pending Posts:</span>
                <span className="font-bold text-cyan-900">{metrics.pendingArticlesCount}</span>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0 overflow-y-auto p-5 sm:p-6 bg-[#edf2f8]">
            {/* 1. OVERVIEW ANALYTICS */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Portfolio &amp; CMS Overview</h3>
                  <p className="text-xs text-slate-600">
                    Real-time metrics and dynamic synchronization with Supabase cloud database.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                  <div className="p-4 rounded-xl bg-white border border-slate-300 shadow-2xs">
                    <span className="text-[11px] font-sans font-bold text-slate-500 uppercase">Projects</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.projectsCount}</div>
                    <span className="text-[10px] text-emerald-700 font-sans">Active in Portfolio</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-300 shadow-2xs">
                    <span className="text-[11px] font-sans font-bold text-slate-500 uppercase">Articles</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.articlesCount}</div>
                    <span className="text-[10px] text-cyan-800 font-sans">{metrics.pendingArticlesCount} pending approval</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-300 shadow-2xs">
                    <span className="text-[11px] font-sans font-bold text-slate-500 uppercase">Comments</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.commentsCount}</div>
                    <span className="text-[10px] text-slate-500 font-sans">Peer Reviews</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white border border-slate-300 shadow-2xs">
                    <span className="text-[11px] font-sans font-bold text-slate-500 uppercase">Hub Files</span>
                    <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.materialsCount}</div>
                    <span className="text-[10px] text-slate-500 font-sans">Stored in Supabase</span>
                  </div>
                </div>

                {/* Quick actions ribbon */}
                <div className="p-4 rounded-xl bg-white border border-slate-300 shadow-2xs space-y-3">
                  <h4 className="font-bold text-slate-900 text-sm">Quick Administrative Actions</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-900 text-white text-xs font-bold hover:bg-cyan-950 transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Configure Theme &amp; CSS Variables</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSqlModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-100 transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5 text-cyan-800" />
                      <span>Copy Updated SQL Migration</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. PROJECTS MANAGER */}
            {activeTab === 'projects' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Projects Manager</h3>
                    <p className="text-xs text-slate-600">
                      Manage dynamic engineering projects, templates (CAD, Web, General), and media.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {projectsList.map((p) => (
                    <div
                      key={p.id}
                      className="p-3.5 rounded-xl bg-white border border-slate-300 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={p.hero_image}
                          alt={p.title}
                          className="w-12 h-12 rounded-lg object-cover bg-slate-200 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[10px] font-sans font-bold">
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-800">{p.category}</span>
                            <span className="text-emerald-700">{p.status}</span>
                          </div>
                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-0.5">
                            {p.title}
                          </h4>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDeleteProject(p.id)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                          title="Delete Project"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. ARTICLES MANAGER & MODERATION */}
            {activeTab === 'articles' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Articles Manager &amp; Moderation</h3>
                  <p className="text-xs text-slate-600">
                    Review visitor submissions, approve pending engineering articles, or edit posts.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {articlesList.map((art) => (
                    <div
                      key={art.id}
                      className="p-3.5 rounded-xl bg-white border border-slate-300 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[10px] font-sans">
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold ${
                              art.is_approved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {art.is_approved ? 'Approved' : 'Pending Review'}
                          </span>
                          <span className="text-slate-500">By {art.author_name} ({art.author_tag})</span>
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-1">
                          {art.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleArticleApproval(art.id, art.is_approved)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            art.is_approved
                              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                              : 'bg-emerald-800 text-white hover:bg-emerald-900'
                          }`}
                        >
                          {art.is_approved ? 'Unpublish' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteArticle(art.id)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                          title="Delete Article"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. COMMENTS MODERATION */}
            {activeTab === 'comments' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Comments Moderation</h3>
                  <p className="text-xs text-slate-600">
                    Moderate, archive, or delete visitor reviews and comments.
                  </p>
                </div>

                <div className="space-y-2.5">
                  {commentsList.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-xl border border-slate-300 text-slate-500 text-xs">
                      No comments currently recorded.
                    </div>
                  ) : (
                    commentsList.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-white border border-slate-300 space-y-1.5 text-xs shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">
                            {c.author_name} ({c.author_role})
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(c.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-slate-700 leading-relaxed">{c.comment_text}</p>
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => handleArchiveComment(c.id, c.is_archived)}
                            className="text-[11px] text-slate-600 hover:text-slate-900"
                          >
                            {c.is_archived ? 'Unarchive' : 'Archive'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(c.id)}
                            className="text-[11px] text-rose-600 hover:text-rose-800"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 5. EXPERIENCE & CAREER */}
            {activeTab === 'experience' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Experience &amp; Career Milestones</h3>
                  <p className="text-xs text-slate-600">
                    Lead mechanical roles, aerospace flight gimbal projects, and structural achievements.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-300 text-xs text-slate-700 space-y-2">
                  <div className="font-bold text-slate-900">Lead Mechanical Hardware Engineer · Airborne Gimbals</div>
                  <p>Managed 5-axis CNC titanium topology optimization cutting yoke structural mass by 41.8%.</p>
                </div>
              </div>
            )}

            {/* 6. PUBLICATIONS */}
            {activeTab === 'publications' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Research &amp; Publications</h3>
                  <p className="text-xs text-slate-600">
                    First-principles derivations, FEA validation whitepapers, and published findings.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-300 text-xs text-slate-700 space-y-2">
                  <div className="font-bold text-slate-900">Closed-Form Vibration vs Higher-Order FEA</div>
                  <p>Published methodology on Euler-Bernoulli cantilever sanity checking for airborne optical mounts.</p>
                </div>
              </div>
            )}

            {/* 7. ACHIEVEMENTS & AWARDS */}
            {activeTab === 'achievements' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Achievements &amp; Technical Skills</h3>
                  <p className="text-xs text-slate-600">
                    CSWP, ASME Y14.5 Senior GDTP, CAD software expertise, and engineering credentials.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-300 text-xs text-slate-700 space-y-2">
                  <div className="font-bold text-slate-900">Verified Technical Competencies</div>
                  <p>SolidWorks CSWP, PTC Creo, Autodesk Inventor, CNC Multi-Axis, FEA Non-Linear Analysis.</p>
                </div>
              </div>
            )}

            {/* 8. MEDIA LIBRARY */}
            {activeTab === 'media' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Media Library &amp; Asset Protection</h3>
                  <p className="text-xs text-slate-600">
                    Asset privacy enabled: raw Supabase storage URLs are never exposed in the UI. Only clean sanitized file names and badges are displayed.
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-white border border-slate-300 text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-slate-900">Sanitized File Name Badges Active</span>
                  </div>
                  <p className="text-slate-600">
                    When visitors view downloadable documents, CAD files, or resumes, URLs are masked as custom badges (e.g., <code>airborne-gimbal-spec.pdf</code>).
                  </p>
                </div>
              </div>
            )}

            {/* 9. SITE SETTINGS STUDIO (COMPREHENSIVE SETTINGS PANEL) */}
            {activeTab === 'settings' && (
              <div className="space-y-5">
                {/* Save Feedback Banner */}
                {saveStatus && (
                  <div className="p-3 rounded-xl bg-cyan-900 text-white text-xs font-bold flex items-center justify-between">
                    <span>{saveStatus}</span>
                    <CheckCircle2 className="w-4 h-4 text-cyan-200" />
                  </div>
                )}

                {/* Settings Sub-Tab Ribbon */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#cbd5e1] text-xs">
                  {[
                    { id: 'theme' as const, label: 'Theme & Appearance', icon: Palette },
                    { id: 'buttons' as const, label: 'Button Customizer', icon: Sliders },
                    { id: 'homepage' as const, label: 'Homepage Cards', icon: Layout },
                    { id: 'forms' as const, label: 'Form Builder', icon: Type },
                    { id: 'resume' as const, label: 'Resume & PDF Builder', icon: FileText },
                    { id: 'projects_articles' as const, label: 'Projects & Articles', icon: Layers },
                    { id: 'profile_sections' as const, label: 'Profile Sections', icon: Briefcase },
                    { id: 'footer' as const, label: 'Footer Studio', icon: Layout },
                  ].map((sub) => {
                    const SubIcon = sub.icon;
                    const isSubActive = settingsSection === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setSettingsSection(sub.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          isSubActive
                            ? 'bg-cyan-900 text-white shadow-2xs'
                            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <SubIcon className="w-3.5 h-3.5" />
                        <span>{sub.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-Section 1: Theme & Global Appearance */}
                {settingsSection === 'theme' && (
                  <div className="space-y-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-300 text-xs">
                    <h4 className="text-sm font-bold text-slate-900">Theme &amp; Global Appearance</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">Theme Mode</label>
                        <select
                          value={localSettings.theme_mode}
                          onChange={(e) =>
                            setLocalSettings({ ...localSettings, theme_mode: e.target.value as any })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        >
                          <option value="light">Light Mode (Clean Silver/Engineering Slate)</option>
                          <option value="dark">Dark Mode (Night / Precision Obsidian)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-800 mb-1">Primary Color (Hex)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={localSettings.primary_color}
                            onChange={(e) =>
                              setLocalSettings({ ...localSettings, primary_color: e.target.value })
                            }
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={localSettings.primary_color}
                            onChange={(e) =>
                              setLocalSettings({ ...localSettings, primary_color: e.target.value })
                            }
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-800 mb-1">Secondary Accent (Hex)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={localSettings.secondary_color}
                            onChange={(e) =>
                              setLocalSettings({ ...localSettings, secondary_color: e.target.value })
                            }
                            className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={localSettings.secondary_color}
                            onChange={(e) =>
                              setLocalSettings({ ...localSettings, secondary_color: e.target.value })
                            }
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-800 mb-1">Navbar Background Color</label>
                        <input
                          type="text"
                          value={localSettings.navbar_bg}
                          onChange={(e) =>
                            setLocalSettings({ ...localSettings, navbar_bg: e.target.value })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                        />
                      </div>
                    </div>

                    {/* JSON Theme Export/Import */}
                    <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const json = exportThemeJson();
                          navigator.clipboard.writeText(json);
                          alert('Theme JSON copied to clipboard!');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Export Theme JSON</span>
                      </button>

                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Import Theme JSON</span>
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              importThemeJson(evt.target?.result as string);
                            };
                            reader.readAsText(file);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {/* Sub-Section 2: Global Button Customization Engine */}
                {settingsSection === 'buttons' && (
                  <div className="space-y-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-300 text-xs">
                    <h4 className="text-sm font-bold text-slate-900">
                      Global Button Customization Engine
                    </h4>
                    <p className="text-slate-600">
                      Adjust border radius, padding, font size, and hover effects across all buttons.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">Border Radius</label>
                        <select
                          value={localSettings.button_border_radius}
                          onChange={(e) =>
                            setLocalSettings({ ...localSettings, button_border_radius: e.target.value })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                        >
                          <option value="0.25rem">Sharp (4px)</option>
                          <option value="0.5rem">Subtle (8px)</option>
                          <option value="0.75rem">Standard Modern (12px)</option>
                          <option value="1rem">Soft Curved (16px)</option>
                          <option value="9999px">Pill (Full)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-800 mb-1">Padding (Y, X)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={localSettings.button_padding_y}
                            onChange={(e) =>
                              setLocalSettings({ ...localSettings, button_padding_y: e.target.value })
                            }
                            placeholder="0.45rem"
                            className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                          />
                          <input
                            type="text"
                            value={localSettings.button_padding_x}
                            onChange={(e) =>
                              setLocalSettings({ ...localSettings, button_padding_x: e.target.value })
                            }
                            placeholder="0.85rem"
                            className="w-1/2 px-2 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-800 mb-1">Font Size</label>
                        <input
                          type="text"
                          value={localSettings.button_font_size}
                          onChange={(e) =>
                            setLocalSettings({ ...localSettings, button_font_size: e.target.value })
                          }
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-mono"
                        />
                      </div>
                    </div>

                    {/* Button Preview */}
                    <div className="p-4 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        style={{
                          borderRadius: localSettings.button_border_radius,
                          paddingTop: localSettings.button_padding_y,
                          paddingBottom: localSettings.button_padding_y,
                          paddingLeft: localSettings.button_padding_x,
                          paddingRight: localSettings.button_padding_x,
                          fontSize: localSettings.button_font_size,
                          backgroundColor: localSettings.primary_color,
                          color: '#ffffff',
                        }}
                        className="font-bold cursor-pointer"
                      >
                        Sample Dynamic Button
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-Section 3: Homepage Card & Content Manager */}
                {settingsSection === 'homepage' && (
                  <div className="space-y-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-300 text-xs">
                    <h4 className="text-sm font-bold text-slate-900">
                      Homepage Card &amp; Content Manager
                    </h4>
                    <p className="text-slate-600">
                      Dynamic editing of card titles, descriptions, and icon shapes.
                    </p>

                    <div className="space-y-3">
                      {localSettings.homepage_cards?.map((card, idx) => (
                        <div
                          key={card.id || idx}
                          className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">{card.title}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200">
                              Shape: {card.icon_shape || 'square'}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={card.title}
                            onChange={(e) => {
                              const next = [...localSettings.homepage_cards];
                              next[idx] = { ...next[idx], title: e.target.value };
                              setLocalSettings({ ...localSettings, homepage_cards: next });
                            }}
                            className="w-full px-2.5 py-1 rounded border border-slate-300 bg-white"
                          />
                          <textarea
                            rows={2}
                            value={card.description}
                            onChange={(e) => {
                              const next = [...localSettings.homepage_cards];
                              next[idx] = { ...next[idx], description: e.target.value };
                              setLocalSettings({ ...localSettings, homepage_cards: next });
                            }}
                            className="w-full px-2.5 py-1 rounded border border-slate-300 bg-white"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-Section 4: Resume & PDF Template Builder */}
                {settingsSection === 'resume' && (
                  <div className="space-y-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-300 text-xs">
                    <h4 className="text-sm font-bold text-slate-900">
                      Manual Direct Dynamic Resume &amp; PDF Template Builder
                    </h4>
                    <p className="text-slate-600">
                      Control margins, typography, section ordering, and font sizing for downloaded PDFs.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block font-bold text-slate-800 mb-1">Font Family</label>
                        <select
                          value={localSettings.resume_pdf_settings?.font_family}
                          onChange={(e) =>
                            setLocalSettings({
                              ...localSettings,
                              resume_pdf_settings: {
                                ...localSettings.resume_pdf_settings,
                                font_family: e.target.value,
                              },
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        >
                          <option value="Times New Roman">Times New Roman (Standard Serif)</option>
                          <option value="Helvetica">Helvetica (Clean Sans)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-slate-800 mb-1">Margin (mm)</label>
                        <input
                          type="number"
                          value={localSettings.resume_pdf_settings?.margin_mm}
                          onChange={(e) =>
                            setLocalSettings({
                              ...localSettings,
                              resume_pdf_settings: {
                                ...localSettings.resume_pdf_settings,
                                margin_mm: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-slate-800 mb-1">Body Font Size (pt)</label>
                        <input
                          type="number"
                          step="0.5"
                          value={localSettings.resume_pdf_settings?.body_font_size}
                          onChange={(e) =>
                            setLocalSettings({
                              ...localSettings,
                              resume_pdf_settings: {
                                ...localSettings.resume_pdf_settings,
                                body_font_size: Number(e.target.value),
                              },
                            })
                          }
                          className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-Section 5: Footer Redesign Studio */}
                {settingsSection === 'footer' && (
                  <div className="space-y-4 bg-white p-4 sm:p-5 rounded-xl border border-slate-300 text-xs">
                    <h4 className="text-sm font-bold text-slate-900">Footer Redesign Studio</h4>
                    <div>
                      <label className="block font-bold text-slate-800 mb-1">Copyright Text</label>
                      <input
                        type="text"
                        value={localSettings.footer_config?.copyright_text}
                        onChange={(e) =>
                          setLocalSettings({
                            ...localSettings,
                            footer_config: {
                              ...localSettings.footer_config,
                              copyright_text: e.target.value,
                            },
                          })
                        }
                        className="w-full px-3 py-1.5 rounded border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                )}

                {/* Sub-Section 6: Other settings (Projects/Articles layout, Form builder) */}
                {(settingsSection === 'forms' ||
                  settingsSection === 'projects_articles' ||
                  settingsSection === 'profile_sections') && (
                  <div className="p-4 bg-white rounded-xl border border-slate-300 text-xs space-y-2">
                    <h4 className="font-bold text-slate-900">Module Layout &amp; Configuration</h4>
                    <p className="text-slate-600">
                      Sections, dynamic input fields, and 3D CAD rotation parameters are synchronized in real-time.
                    </p>
                  </div>
                )}

                {/* Save and Reset Buttons */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Reset settings to default configuration?')) {
                        resetToDefaults();
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-bold text-xs"
                  >
                    Reset to Defaults
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-950 text-white font-bold text-xs shadow-2xs cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save All Settings</span>
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SQL MIGRATION CODE PREVIEW MODAL                         */}
      {/* ======================================================== */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl bg-[#0f172a] text-slate-200 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] font-mono text-xs">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900 shrink-0">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-white text-xs">
                  Production-Ready Supabase SQL Migration Script
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-cyan-800 hover:bg-cyan-700 text-white font-sans font-bold text-xs cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSqlModal(false)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 select-text">
              <pre className="whitespace-pre-wrap leading-relaxed text-[11px] text-slate-300">
                {SUPABASE_COMPREHENSIVE_MIGRATION_SQL}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
