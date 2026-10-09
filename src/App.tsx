import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowUp } from 'lucide-react';
import { PROJECTS } from './data/projectsData';
import { Project, ProjectCategory } from './types/portfolio';
import { Navbar, PortfolioPart } from './components/Navbar';
import { LandingHomeView } from './components/LandingHomeView';
import { ProfileView } from './components/ProfileView';
import { HomeView } from './components/HomeView';
import { ResumeDownloadModal } from './components/ResumeDownloadModal';
import { RecruiterScanMode } from './components/RecruiterScanMode';
import { ProjectDetailModal } from './components/ProjectDetailModal';
import { WhitepaperModal } from './components/WhitepaperModal';
import { MessagingSection } from './components/MessagingSection';
import { EaseStudyView } from './components/EaseStudyView';
import { generateAndDownloadResume } from './utils/generateResumePdf';
import { getStoredBio, getStoredDocuments, syncGlobalProfileWithServer, setOwnerAuthenticated } from './utils/profileState';
import { supabase, onSupabaseAuthStateChange } from './utils/supabase';

export default function App() {
  const [activePart, setActivePart] = useState<PortfolioPart>('home');
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory>('All');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [whitepaperProject, setWhitepaperProject] = useState<Project | null>(null);
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [isRecruiterScanOpen, setIsRecruiterScanOpen] = useState(false);
  const [resumeDownloadCount, setResumeDownloadCount] = useState(148);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Top-level onAuthStateChange session listener to sync owner state with Supabase across refreshes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn('[Supabase Initial Session Check]:', error.message);
      }
      if (session?.user) {
        setOwnerAuthenticated(true, session.user.id);
      } else {
        setOwnerAuthenticated(false);
      }
    }).catch(() => {
      setOwnerAuthenticated(false);
    });

    const { data: { subscription } } = onSupabaseAuthStateChange((event, session) => {
      if (session?.user) {
        setOwnerAuthenticated(true, session.user.id);
      } else {
        setOwnerAuthenticated(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleOneClickResumeDownload = () => {
    setResumeDownloadCount((c) => c + 1);
    try {
      const bio = getStoredBio();
      const docs = getStoredDocuments();

      generateAndDownloadResume({
        fullName: bio.fullName || 'Festus, Olorunsogo Johnson',
        header: bio.header || 'Lead Mechanical Design Engineer · Precision Mechanisms, Flight Gimbals & FEA Topology',
        email: bio.email || 'festusjohnson028@gmail.com',
        country: bio.country || 'United States',
        discipline: bio.discipline || 'Mechanical & Optomechanical Design Engineering',
        badges: bio.badges || 'Verified Engineer · CSWP · ASME GDTP Senior · FE EIT',
        degree: bio.degree || 'B.S. in Mechanical Engineering (BSME)',
        academicHonors: bio.academicHonors || 'ABET Accredited · Honors (GPA 3.84 / 4.00)',
        leadership: bio.leadership || 'Lead Mechanical Hardware Engineer · Airborne Gimbal Mechanism Lead',
        skills: bio.skills || 'SolidWorks (CSWP/CSWE), PTC Creo, Autodesk Inventor, Siemens NX, Fusion 360, AutoCAD Mechanical, Design Calculation, CNC Machine, Laser Engraver/Cutter, 3D Animation, 3D Maxs, React.js & Full-Stack Web Development, Web Developer, C/C++, IT, AI & Machine Learning, Cybersecurity, Graphic Design, Microsoft Office',
        description: bio.description || 'Lead Mechanical Design Engineer with 6+ years of specialized experience in high-precision hardware mechanisms, complex flight-rated assemblies, and mission-critical robotic systems.',
        documents: docs.length > 0 ? docs.map((d: any) => ({
          title: d.title,
          issuer: d.issuer,
          id: d.credentialId || d.id,
          date: d.date,
          description: d.description,
          competencies: d.competencies || [],
        })) : undefined,
      });
    } catch (e) {
      console.error('Error generating PDF resume', e);
      window.print();
    }
  };

  // Synchronize initial URL hash and pull global profile from server for visitors
  useEffect(() => {
    syncGlobalProfileWithServer().catch(() => {});
    const hash = window.location.hash.replace('#', '');
    if (hash === 'profile') {
      setActivePart('profile');
    } else if (hash === 'overview' || hash === 'hub' || hash === 'projects' || hash === 'case-studies') {
      setActivePart('overview');
    } else if (hash === 'easestudy' || hash === 'modelme' || hash === 'modeling' || hash === 'model') {
      setActivePart('easestudy');
    } else if (hash === 'metrology' || hash === 'cad-comparison' || hash === 'gdt-drawings' || hash === 'messaging' || hash === 'toolbox' || hash === 'chat' || hash === 'credentials' || hash === 'contact') {
      setActivePart('messaging');
    } else {
      setActivePart('home');
    }
  }, []);

  const handleSelectPart = (part: PortfolioPart) => {
    setActivePart(part);
    window.history.replaceState(null, '', `#${part}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredProjects = selectedCategory === 'All'
    ? PROJECTS
    : PROJECTS.filter((p) => p.category === selectedCategory);

  const handleResumeDownload = () => {
    setResumeDownloadCount((c) => c + 1);
  };

  const handleSelectProjectById = (id: string) => {
    const proj = PROJECTS.find((p) => p.id === id);
    if (proj) setActiveProject(proj);
  };

  return (
    <div className="min-h-screen w-full max-w-full bg-[#dce1e8] text-slate-900 flex flex-col justify-between font-serif selection:bg-slate-300 selection:text-slate-950 overflow-x-hidden">
      {/* 1. Sticky Navigation Bar */}
      <Navbar
        activePart={activePart}
        onSelectPart={handleSelectPart}
        onResumeClick={handleOneClickResumeDownload}
        onRecruiterScanClick={() => setIsRecruiterScanOpen(true)}
        resumeDownloadCount={resumeDownloadCount}
      />

      <main className="flex-1 w-full flex flex-col">
        {/* ======================================================== */}
        {/* 01. LANDING HOME VIEW (HERO & WELCOMING MESSAGE & CTA)  */}
        {/* ======================================================== */}
        {activePart === 'home' && (
          <section id="home" className="relative flex-1 w-full flex flex-col">
            <LandingHomeView
              onNavigatePart={handleSelectPart}
              onResumeClick={handleOneClickResumeDownload}
              onRecruiterScanClick={() => setIsRecruiterScanOpen(true)}
            />
          </section>
        )}

        {/* ======================================================== */}
        {/* 02. MY PROFILE VIEW (BIO, RESUME, CERTIFICATIONS, FORM)  */}
        {/* ======================================================== */}
        {activePart === 'profile' && (
          <section id="profile" className="relative flex-1 w-full flex flex-col border-b border-[#b0bece]">
            <ProfileView
              onResumeClick={handleOneClickResumeDownload}
              onNavigatePart={handleSelectPart}
              resumeDownloadCount={resumeDownloadCount}
            />

            {/* Bottom Navigator */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 mt-auto">
              <div className="p-4 sm:p-4.5 rounded-2xl bg-[#e6ecf4] border border-[#b8c6d4] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] sm:text-[13px] text-slate-700">
                  <span className="text-cyan-900 font-bold font-sans">NEXT:</span> Access public engineering documents and technical blueprints in the Engineering Hub.
                </div>
                <button
                  onClick={() => handleSelectPart('overview')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-[11px] sm:text-[13px] font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Proceed to Engineering Hub</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* 03. ENGINEERING HUB (DOCUMENT REPOSITORY & DEVICE UPLOAD)*/}
        {/* ======================================================== */}
        {activePart === 'overview' && (
          <section id="overview" className="relative flex-1 w-full flex flex-col border-b border-[#b0bece]">
            <HomeView
              onNavigatePart={handleSelectPart}
              onResumeClick={() => setIsResumeOpen(true)}
              onRecruiterScanClick={() => setIsRecruiterScanOpen(true)}
            />

            {/* Bottom Sequential Navigator */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 mt-auto">
              <div className="p-4 sm:p-4.5 rounded-2xl bg-[#e6ecf4] border border-[#b8c6d4] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] sm:text-[13px] text-slate-700">
                  <span className="text-cyan-900 font-bold font-sans">OVERVIEW COMPLETE:</span> Ready to analyze technical documents, extract key concepts, and generate practice exams with EaseStudy AI?
                </div>
                <button
                  onClick={() => handleSelectPart('easestudy')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-[11px] sm:text-[13px] font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Proceed to EaseStudy AI Suite (Part 04)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* 04. EASESTUDY (AI DOCUMENT / IMAGE EXAM & STUDY STUDIO)  */}
        {/* ======================================================== */}
        {activePart === 'easestudy' && (
          <section id="easestudy" className="relative flex-1 w-full flex flex-col border-b border-[#b0bece] py-8 sm:py-10 bg-[#dce1e8] justify-between">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
              <EaseStudyView onNavigatePart={handleSelectPart} />

              {/* Bottom Navigator (Center Justified, Text size reduced by 15%) */}
              <div className="pt-8 mt-auto flex justify-center">
                <div className="p-4 sm:p-4.5 rounded-2xl bg-[#e6ecf4] border border-[#b8c6d4] shadow-sm flex flex-col sm:flex-row items-center justify-center text-center gap-3.5 sm:gap-6 max-w-4xl mx-auto w-full">
                  <div className="text-[10.6px] sm:text-[11.9px] text-slate-700 text-center">
                    <span className="text-cyan-900 font-bold font-sans">EASESTUDY COMPLETE:</span> Have questions or want to discuss technical proposals or engineering services?
                  </div>
                  <button
                    onClick={() => handleSelectPart('messaging')}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-[10.2px] sm:text-[11.5px] font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <span>Proceed to Messaging (Part 05)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* 05. FULL PAGE MESSAGING SECTION ONLY                     */}
        {/* ======================================================== */}
        {activePart === 'messaging' && (
          <section id="messaging" className="h-[calc(100vh-4rem)] sm:h-[calc(100vh-4.5rem)] w-full bg-[#dce1e8] flex flex-col overflow-hidden">
            <MessagingSection onBack={() => handleSelectPart('home')} />
          </section>
        )}
      </main>

      {/* Footer (Hidden on messaging page) */}
      {activePart !== 'messaging' && (
        <footer className="shrink-0 w-full py-4 border-t border-[#b8c6d4] bg-[#d2d8e1] text-xs text-slate-700 font-sans text-center mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-center">
            <p className="text-xs text-slate-700">
              © 2026 Festus, Olorunsogo Johnson · Fesline Mechanical Engineering
            </p>
          </div>
        </footer>
      )}

      {/* Modals & Drawers */}
      <ProjectDetailModal
        project={activeProject}
        isOpen={activeProject !== null}
        onClose={() => setActiveProject(null)}
        onOpenWhitepaper={(p) => setWhitepaperProject(p)}
      />

      <WhitepaperModal
        project={whitepaperProject}
        isOpen={whitepaperProject !== null}
        onClose={() => setWhitepaperProject(null)}
      />

      <ResumeDownloadModal
        isOpen={isResumeOpen}
        onClose={() => setIsResumeOpen(false)}
        onDownloaded={handleResumeDownload}
      />

      <RecruiterScanMode
        isOpen={isRecruiterScanOpen}
        onClose={() => setIsRecruiterScanOpen(false)}
        onResumeClick={handleOneClickResumeDownload}
      />

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
