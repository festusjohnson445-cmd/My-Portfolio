import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, ArrowUp, Lock } from 'lucide-react';
import { Navbar, PortfolioPart } from './components/Navbar';
import { LandingHomeView } from './components/LandingHomeView';
import { ProfileView } from './components/ProfileView';
import { HomeView } from './components/HomeView';
import { ProjectsView } from './components/ProjectsView';
import { ArticlesView } from './components/ArticlesView';
import { DocumentWorkspaceView } from './components/DocumentWorkspaceView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { ResumeDownloadModal } from './components/ResumeDownloadModal';
import { MessagingSection } from './components/MessagingSection';
import { prewarmEngineeringHubDocuments } from './components/EngineeringDocumentHub';
import {
  getStoredBio,
  getStoredDocuments,
  syncGlobalProfileWithServer,
  setOwnerAuthenticated,
  useProfileSync,
} from './utils/profileState';
import {
  supabase,
  onSupabaseAuthStateChange,
} from './utils/supabase';
import {
  verifyLiveAdminAal2,
  isAuthorizedAdminEmail,
  isEmailConfirmedUser,
  signOutAdminSession,
} from './utils/adminMfaAuth';
import {
  useWebsiteSettingsSync,
  BUILT_IN_THEMES,
  fetchProjectsFromSupabase,
  fetchArticlesFromSupabase,
  fetchExperiencesFromSupabase,
  fetchPublicationsFromSupabase,
  fetchAchievementsFromSupabase,
} from './utils/portfolioSupabase';
import { fetchPublishedGeneratedDocuments } from './utils/documentWorkspaceSupabase';
import { useUserColorMode, resolveEffectiveTheme } from './utils/userThemeMode';
import {
  getCanonicalPathForPart,
  getPageSeoMetadata,
  resolveRouteFromParts,
} from './seo/metadata';
import { applyClientSeoMetadata } from './seo/clientMeta';

export default function App() {
  const initialRoute = React.useMemo(() => {
    if (typeof window === 'undefined') {
      return { part: 'home' as PortfolioPart, canonicalPath: '/' };
    }
    return resolveRouteFromParts(
      window.location.pathname,
      window.location.hash,
      window.location.search
    );
  }, []);

  const [activePart, setActivePart] = useState<PortfolioPart>(initialRoute.part);
  const [activeProfileSection, setActiveProfileSection] = useState<string | undefined>(
    initialRoute.sectionId
  );
  const [selectedProjectSlug, setSelectedProjectSlug] = useState<string | undefined>(
    initialRoute.projectSlugOrId
  );
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string | undefined>(
    initialRoute.articleSlugOrId
  );
  const [visitedParts, setVisitedParts] = useState<Set<PortfolioPart>>(
    () => new Set([initialRoute.part])
  );
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [resumeDownloadCount, setResumeDownloadCount] = useState(148);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [userColorMode] = useUserColorMode();
  const { isOwner, ownerUid } = useProfileSync();

  const websiteSettings = useWebsiteSettingsSync();
  const appearance = websiteSettings.appearanceConfig;
  const baseTheme =
    appearance.storedThemes.find((t) => t.id === appearance.activeThemeId) || BUILT_IN_THEMES[0];
  const activeTheme = resolveEffectiveTheme(baseTheme, userColorMode);
  const footerCfg = appearance.footerConfig;

  const initialAuthHandledRef = useRef(false);

  // Top-level onAuthStateChange listener — strictly enforces authorized email,
  // confirmed email, and mandatory Supabase TOTP AAL2 assurance before unlocking admin state.
  useEffect(() => {
    let mounted = true;

    const syncSessionAuth = async (event: string, session: any) => {
      if (!mounted) return;

      if (event === 'INITIAL_SESSION') {
        if (initialAuthHandledRef.current) return;
        initialAuthHandledRef.current = true;
      }

      if (event === 'PASSWORD_RECOVERY') {
        setOwnerAuthenticated(false);
        setActivePart((cur) => (cur === 'admin' ? 'profile' : cur));
        window.dispatchEvent(new CustomEvent('open-owner-recovery-modal'));
        return;
      }

      const user = session?.user;
      if (!user) {
        setOwnerAuthenticated(false);
        return;
      }

      if ((user as any).is_anonymous) {
        setOwnerAuthenticated(false);
        return;
      }

      if (!isAuthorizedAdminEmail(user.email) || !isEmailConfirmedUser(user)) {
        if (mounted) {
          setOwnerAuthenticated(false);
          setActivePart((cur) => (cur === 'admin' ? 'home' : cur));
        }
        return;
      }

      const live = await verifyLiveAdminAal2();
      if (!mounted) return;
      if (live.ok && live.user) {
        setOwnerAuthenticated(true, live.user.id);
      } else {
        setOwnerAuthenticated(false);
      }
    };

    const {
      data: { subscription },
    } = onSupabaseAuthStateChange((event, session) => {
      void syncSessionAuth(event, session);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (error) {
          console.warn('[Supabase Initial Session Check]:', error.message);
        }
        void syncSessionAuth('INITIAL_SESSION', session);
      })
      .catch(() => {
        if (mounted) setOwnerAuthenticated(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Periodic AAL2 & token expiry monitor while an administrator session is active
  useEffect(() => {
    if (!isOwner || !ownerUid) return;

    const checkSessionValidity = async () => {
      const live = await verifyLiveAdminAal2();
      if (!live.ok) {
        setOwnerAuthenticated(false);
        setActivePart((cur) => (cur === 'admin' ? 'home' : cur));
      }
    };

    const timer = window.setInterval(() => {
      void checkSessionValidity();
    }, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkSessionValidity();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isOwner, ownerUid]);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock outer scrolling when Messaging is active
  useEffect(() => {
    if (activePart === 'messaging') {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    }
  }, [activePart]);

  const handleOneClickResumeDownload = async () => {
    setResumeDownloadCount((c) => c + 1);
    try {
      const { generateAndDownloadResume } = await import('./utils/generateResumePdf');
      const bio = getStoredBio();
      const docs = getStoredDocuments();

      generateAndDownloadResume({
        fullName: bio.fullName || 'Festus, Olorunsogo Johnson',
        header:
          bio.header ||
          'Lead Mechanical Design Engineer · Precision Mechanisms, Flight Gimbals & FEA Topology',
        email: bio.email || 'festusjohnson028@gmail.com',
        country: bio.country || 'United States',
        discipline: bio.discipline || 'Mechanical & Optomechanical Design Engineering',
        badges: bio.badges || 'Verified Engineer · CSWP · ASME GDTP Senior · FE EIT',
        degree: bio.degree || 'B.S. in Mechanical Engineering (BSME)',
        academicHonors: bio.academicHonors || 'ABET Accredited · Honors (GPA 3.84 / 4.00)',
        leadership: bio.leadership || 'Lead Mechanical Hardware Engineer · Airborne Gimbal Mechanism Lead',
        skills:
          bio.skills ||
          'SolidWorks (CSWP/CSWE), PTC Creo, Autodesk Inventor, Siemens NX, Fusion 360, AutoCAD Mechanical, Design Calculation, CNC Machine, Laser Engraver/Cutter, 3D Animation, 3D Maxs, React.js & Full-Stack Web Development, Web Developer, C/C++, IT, AI & Machine Learning, Cybersecurity, Graphic Design, Microsoft Office',
        certifiedSkills: bio.certifiedSkills || [],
        skillStatuses: bio.skillStatuses || {},
        experiences: bio.experiences || [],
        publications: bio.publications || [],
        achievements: bio.achievements || [],
        description:
          bio.description ||
          'Lead Mechanical Design Engineer with 6+ years of specialized experience in high-precision hardware mechanisms, complex flight-rated assemblies, and mission-critical robotic systems.',
        documents:
          docs.length > 0
            ? docs.map((d) => ({
                title: d.title,
                issuer: d.issuer,
                id: d.credentialId || d.id,
                date: d.date,
                description: d.description,
                competencies: d.competencies || [],
                credentialGroup: d.credentialGroup,
                parentSpecializationId: d.parentSpecializationId,
              }))
            : undefined,
      });
    } catch (e) {
      console.error('Error generating PDF resume', e);
      window.print();
    }
  };

  // Sync initial URL, prewarm page caches on boot, browser history popstate/hashchange, and subsection scrolling
  useEffect(() => {
    syncGlobalProfileWithServer().catch(() => {});
    Promise.allSettled([
      fetchProjectsFromSupabase(isOwner),
      fetchArticlesFromSupabase(isOwner),
      fetchExperiencesFromSupabase(),
      fetchPublicationsFromSupabase(),
      fetchAchievementsFromSupabase(),
      fetchPublishedGeneratedDocuments(),
      prewarmEngineeringHubDocuments(),
    ]).catch(() => {});

    const syncFromWindowLocation = (scrollSub = true) => {
      const parsed = resolveRouteFromParts(
        window.location.pathname,
        window.location.hash,
        window.location.search
      );
      setActivePart(parsed.part);
      setActiveProfileSection(parsed.sectionId);
      setSelectedProjectSlug(parsed.projectSlugOrId);
      setSelectedArticleSlug(parsed.articleSlugOrId);
      setVisitedParts((prev) => {
        if (prev.has(parsed.part)) return prev;
        const next = new Set(prev);
        next.add(parsed.part);
        return next;
      });
      if (scrollSub && parsed.sectionId) {
        setTimeout(() => {
          document.getElementById(parsed.sectionId!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 120);
      }
    };

    if (initialRoute.sectionId) {
      setTimeout(() => {
        document.getElementById(initialRoute.sectionId!)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    }

    const onPopOrHash = () => syncFromWindowLocation(true);
    window.addEventListener('popstate', onPopOrHash);
    window.addEventListener('hashchange', onPopOrHash);
    return () => {
      window.removeEventListener('popstate', onPopOrHash);
      window.removeEventListener('hashchange', onPopOrHash);
    };
  }, [initialRoute.sectionId]);

  // Keep page-level SEO / Open Graph metadata synced when not inside an individual project/article detail view
  useEffect(() => {
    if (activePart === 'projects' && selectedProjectSlug) return;
    if (activePart === 'articles' && selectedArticleSlug) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const canonicalPath = getCanonicalPathForPart(activePart, activeProfileSection);
    const meta = getPageSeoMetadata(
      {
        part: activePart,
        sectionId: activeProfileSection as any,
        canonicalPath,
      },
      origin
    );
    applyClientSeoMetadata(meta);
  }, [activePart, activeProfileSection, selectedProjectSlug, selectedArticleSlug]);

  const handleSelectPart = (part: PortfolioPart, sectionId?: string) => {
    setVisitedParts((prev) => {
      if (prev.has(part)) return prev;
      const next = new Set(prev);
      next.add(part);
      return next;
    });
    setActivePart(part);
    setActiveProfileSection(sectionId);
    if (part !== 'projects') {
      setSelectedProjectSlug(undefined);
    } else if (!sectionId) {
      setSelectedProjectSlug(undefined);
    }
    if (part !== 'articles') {
      setSelectedArticleSlug(undefined);
    } else if (!sectionId) {
      setSelectedArticleSlug(undefined);
    }

    const targetPath = getCanonicalPathForPart(part, sectionId);
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname !== targetPath || window.location.hash || window.location.search)
    ) {
      window.history.pushState(null, '', targetPath);
    }

    if (sectionId) {
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 60);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleResumeDownload = () => {
    setResumeDownloadCount((c) => c + 1);
  };

  return (
    <div
      style={{
        backgroundColor: activeTheme.pageBg,
        color: activeTheme.textColor,
      }}
      className={`w-full max-w-full flex flex-col justify-between font-serif selection:bg-slate-300 selection:text-slate-950 transition-colors duration-200 ${
        activePart === 'messaging'
          ? 'h-screen h-[100dvh] max-h-[100dvh] overflow-hidden'
          : 'min-h-screen overflow-x-clip'
      }`}
    >
      {/* 1. Sticky Navigation Bar */}
      <Navbar
        activePart={activePart}
        onSelectPart={handleSelectPart}
        onResumeClick={handleOneClickResumeDownload}
        resumeDownloadCount={resumeDownloadCount}
      />

      <main
        className={`flex-1 w-full flex flex-col ${
          activePart === 'messaging' ? 'min-h-0 overflow-hidden' : ''
        }`}
      >
        {/* HOME */}
        <section
          id="home"
          className={`relative flex-1 w-full flex-col ${
            activePart === 'home' ? 'flex' : 'hidden'
          }`}
        >
          <LandingHomeView
            onNavigatePart={handleSelectPart}
            onResumeClick={handleOneClickResumeDownload}
          />
        </section>

        {/* PROFILE */}
        <section
          id="profile"
          className={`relative flex-1 w-full flex-col border-b border-[#b0bece] ${
            activePart === 'profile' ? 'flex' : 'hidden'
          }`}
        >
          {visitedParts.has('profile') && (
            <>
              <ProfileView
                onResumeClick={handleOneClickResumeDownload}
                onNavigatePart={handleSelectPart}
                resumeDownloadCount={resumeDownloadCount}
              />

              {/* Bottom Navigator */}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 mt-auto">
                <div className="p-4 sm:p-4.5 rounded-2xl bg-[#e6ecf4] border border-[#b8c6d4] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-[11px] sm:text-[13px] text-slate-700">
                    <span className="text-cyan-900 font-bold">NEXT:</span> Access public engineering documents and technical blueprints in the Engineering Hub.
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectPart('overview')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-[11px] sm:text-[13px] font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap"
                  >
                    <span>Proceed to Engineering Hub</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* MESSAGING */}
        <section
          id="messaging"
          className={`flex-1 min-h-0 h-full w-full bg-[#dce1e8] flex-col overflow-hidden ${
            activePart === 'messaging' ? 'flex' : 'hidden'
          }`}
        >
          {visitedParts.has('messaging') && (
            <MessagingSection
              onBack={() => handleSelectPart('home')}
              isActive={activePart === 'messaging'}
            />
          )}
        </section>

        {/* ENGINEERING HUB */}
        <section
          id="overview"
          className={`relative flex-1 w-full flex-col border-b border-[#b0bece] ${
            activePart === 'overview' ? 'flex' : 'hidden'
          }`}
        >
          {visitedParts.has('overview') && (
            <>
              <HomeView onNavigatePart={handleSelectPart} />

              {/* Bottom Sequential Navigator */}
              <div className="w-full max-w-[1440px] mx-auto px-2 sm:px-4 lg:px-5 pb-10 mt-auto">
                <div className="p-4 sm:p-4.5 rounded-2xl bg-[#e6ecf4] border border-[#b8c6d4] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-[11px] sm:text-[13px] text-slate-700">
                    <span className="text-cyan-900 font-bold">NEXT:</span> Explore published mechanical projects, CAD studies, and engineering reports.
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectPart('projects')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-[11px] sm:text-[13px] font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap"
                  >
                    <span>Explore Projects</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* PROJECTS (ENGINEERING PORTFOLIO) */}
        <section
          id="projects"
          className={`relative flex-1 w-full flex-col border-b border-[#b0bece] ${
            activePart === 'projects' ? 'flex' : 'hidden'
          }`}
        >
          {visitedParts.has('projects') && (
            <ProjectsView
              isActive={activePart === 'projects'}
              initialSlugOrId={selectedProjectSlug}
              onActiveSlugChange={(slug) => setSelectedProjectSlug(slug)}
            />
          )}
        </section>

        {/* BLOG / ARTICLES (ENGINEERING ARTICLES) */}
        <section
          id="articles"
          className={`relative flex-1 w-full flex-col border-b border-[#b0bece] ${
            activePart === 'articles' ? 'flex' : 'hidden'
          }`}
        >
          {visitedParts.has('articles') && (
            <ArticlesView
              isActive={activePart === 'articles'}
              initialSlugOrId={selectedArticleSlug}
              onActiveSlugChange={(slug) => setSelectedArticleSlug(slug)}
            />
          )}
        </section>

        {/* DOCUMENT-GENERATION WORKSPACE */}
        <section
          id="documents"
          className={`relative flex-1 w-full flex-col border-b border-[#b0bece] ${
            activePart === 'documents' ? 'flex' : 'hidden'
          }`}
        >
          {visitedParts.has('documents') && (
            <DocumentWorkspaceView />
          )}
        </section>

        {/* ADMIN DASHBOARD (OWNER SINGLE-PAGE CONTROL CENTER — AAL2 ENFORCED) */}
        <section
          id="admin"
          className={`relative flex-1 w-full flex-col border-b border-[#b0bece] ${
            activePart === 'admin' ? 'flex' : 'hidden'
          }`}
        >
          {visitedParts.has('admin') && isOwner && (
            <AdminDashboardView onNavigatePart={handleSelectPart} />
          )}
          {visitedParts.has('admin') && !isOwner && (
            <div className="flex-1 w-full max-w-xl mx-auto px-4 py-16 text-center font-serif">
              <div className="p-6 rounded-2xl bg-white border border-[#b8c6d4] shadow-xs space-y-3">
                <Lock className="w-6 h-6 text-cyan-900 mx-auto" />
                <h1 className="text-base font-bold text-slate-950">Administrator MFA Required</h1>
                <p className="text-xs text-slate-600">
                  Confirmed administrator credentials and 6-digit TOTP verification (AAL2) are required to access the Admin Dashboard.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleSelectPart('home')}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Return Home
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectPart('profile');
                      window.setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('open-owner-auth-modal'));
                      }, 80);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Sign In with 2FA
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer (Hidden on messaging page; double-click Lock retained exclusively on Profile footer with configurable position) */}
      {activePart !== 'messaging' && (() => {
        const justifyClass =
          footerCfg.justifyContent === 'start'
            ? 'justify-start'
            : footerCfg.justifyContent === 'between'
            ? 'justify-between'
            : footerCfg.justifyContent === 'around'
            ? 'justify-around'
            : 'justify-center';
        const alignClass =
          footerCfg.textAlign === 'left'
            ? 'text-left'
            : footerCfg.textAlign === 'right'
            ? 'text-right'
            : 'text-center';

        const lockButton =
          activePart === 'profile' ? (
            <button
              type="button"
              onDoubleClick={() => {
                window.dispatchEvent(new CustomEvent('open-owner-auth-modal'));
              }}
              className="p-1 rounded text-slate-500 hover:text-slate-800 transition-colors cursor-pointer select-none inline-flex items-center"
              title="Double-click for Owner Portal"
              aria-label="Owner Access"
            >
              <Lock className="w-3.5 h-3.5" />
            </button>
          ) : null;

        return (
          <footer
            style={{
              backgroundColor: activeTheme.footerBg,
              borderColor: activeTheme.borderColor,
              color: activeTheme.textColor,
              fontSize: footerCfg.fontSize || '11px',
            }}
            className={`shrink-0 w-full py-4 border-t font-serif mt-auto relative transition-colors duration-200 ${alignClass}`}
          >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-2.5">
              {footerCfg.customSections && footerCfg.customSections.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-2.5 border-b border-black/10">
                  {footerCfg.customSections.map((fs) => (
                    <div key={fs.id} className={`space-y-0.5 ${alignClass}`}>
                      {fs.heading && (
                        <h4 className="font-bold text-slate-900 text-xs">{fs.heading}</h4>
                      )}
                      {fs.content && (
                        <p className="text-[11px] opacity-85 whitespace-pre-line">{fs.content}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className={`flex flex-wrap items-center gap-2 ${justifyClass}`}>
                <p
                  style={{ fontSize: footerCfg.fontSize || '11px' }}
                  className="inline-flex items-center gap-1.5 flex-wrap"
                >
                  {footerCfg.lockIconPosition === 'inline-start' && lockButton}
                  <span className="italic opacity-85">
                    {footerCfg.copyrightText ||
                      '© 2026 Festus, Olorunsogo Johnson · Fesline Mechanical Engineering'}
                  </span>
                  {footerCfg.lockIconPosition === 'inline-end' && lockButton}
                </p>

                {footerCfg.lockIconPosition === 'bottom-left' && (
                  <div className="w-full flex justify-start pt-0.5">{lockButton}</div>
                )}
                {footerCfg.lockIconPosition === 'bottom-right' && (
                  <div className="w-full flex justify-end pt-0.5">{lockButton}</div>
                )}
                {footerCfg.lockIconPosition === 'center-below' && (
                  <div className="w-full flex justify-center pt-0.5">{lockButton}</div>
                )}
              </div>
            </div>
          </footer>
        );
      })()}

      {isResumeOpen && (
        <ResumeDownloadModal
          isOpen={isResumeOpen}
          onClose={() => setIsResumeOpen(false)}
          onDownloaded={handleResumeDownload}
        />
      )}

      {/* Floating Scroll to Top Quick Action */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 p-2.5 rounded-full bg-slate-900/90 hover:bg-slate-950 text-white shadow-xl border border-slate-700 hover:border-cyan-400 transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          aria-label="Scroll to top of page"
          title="Scroll to Top"
        >
          <ArrowUp className="w-3 h-3 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}
