import React, { useState, useEffect } from 'react';
import {
  Download,
  Zap,
  ShieldCheck,
  ChevronRight,
  Filter,
  CheckCircle2,
  Layers,
  Ruler,
  Calculator,
  Award,
  FileText,
  Mail,
  ArrowRight,
  ArrowLeft,
  Wrench,
  Compass,
  LayoutList,
  User,
  FolderOpen
} from 'lucide-react';
import { PROJECTS } from './data/projectsData';
import { Project, ProjectCategory } from './types/portfolio';
import { Navbar, PortfolioPart } from './components/Navbar';
import { LandingHomeView } from './components/LandingHomeView';
import { ProfileView } from './components/ProfileView';
import { HomeView } from './components/HomeView';
import { ResumeDownloadModal } from './components/ResumeDownloadModal';
import { RecruiterScanMode } from './components/RecruiterScanMode';
import { ProjectCard } from './components/ProjectCard';
import { ProjectDetailModal } from './components/ProjectDetailModal';
import { WhitepaperModal } from './components/WhitepaperModal';
import { ToolboxSection } from './components/ToolboxSection';
import { MessagingSection } from './components/MessagingSection';
import { EaseStudyView } from './components/EaseStudyView';
import { CredentialsSection } from './components/CredentialsSection';
import { ContactSection } from './components/ContactSection';
import { MathematicalInventionGenerator } from './components/MathematicalInventionGenerator';
import { generateAndDownloadResume } from './utils/generateResumePdf';
import { getStoredBio, getStoredDocuments } from './utils/profileState';

export default function App() {
  const [activePart, setActivePart] = useState<PortfolioPart>('home');
  const [viewMode, setViewMode] = useState<'tabbed' | 'continuous'>('tabbed');
  const [selectedCategory, setSelectedCategory] = useState<ProjectCategory>('All');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [whitepaperProject, setWhitepaperProject] = useState<Project | null>(null);
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [isRecruiterScanOpen, setIsRecruiterScanOpen] = useState(false);
  const [resumeDownloadCount, setResumeDownloadCount] = useState(148);

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
        skills: bio.skills || 'SolidWorks (CSWP), PTC Creo, Ansys Workbench (Static / Modal / Thermal FEA), ASME Y14.5 GD&T, 5-Axis CNC Milling',
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

  // Synchronize initial URL hash
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'profile') {
      setActivePart('profile');
    } else if (hash === 'overview' || hash === 'hub') {
      setActivePart('overview');
    } else if (hash === 'projects' || hash === 'case-studies') {
      setActivePart('projects');
    } else if (hash === 'easestudy') {
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
    if (viewMode === 'continuous') {
      const el = document.getElementById(part);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
    <div className="min-h-screen bg-[#dce1e8] text-slate-900 flex flex-col font-serif selection:bg-slate-300 selection:text-slate-950">
      {/* 1. Sticky Navigation Bar */}
      <Navbar
        activePart={activePart}
        onSelectPart={handleSelectPart}
        viewMode={viewMode}
        onToggleViewMode={() => setViewMode(v => v === 'tabbed' ? 'continuous' : 'tabbed')}
        onResumeClick={handleOneClickResumeDownload}
        onRecruiterScanClick={() => setIsRecruiterScanOpen(true)}
        resumeDownloadCount={resumeDownloadCount}
      />

      <main className="flex-1">
        {/* ======================================================== */}
        {/* 01. LANDING HOME VIEW (HERO & WELCOMING MESSAGE & CTA)  */}
        {/* ======================================================== */}
        {(viewMode === 'continuous' || activePart === 'home') && (
          <section id="home" className="relative">
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
        {(viewMode === 'continuous' || activePart === 'profile') && (
          <section id="profile" className="relative border-b border-[#b0bece]">
            {viewMode === 'continuous' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#e8eef5] border border-[#b8c6d4] text-xs font-sans text-cyan-900 shadow-sm">
                  <span className="font-bold">PART 02</span>
                  <span className="text-slate-400">·</span>
                  <span>MY PROFILE &amp; VERIFIED CREDENTIALS</span>
                </div>
              </div>
            )}
            <ProfileView
              onResumeClick={handleOneClickResumeDownload}
              onNavigatePart={handleSelectPart}
              resumeDownloadCount={resumeDownloadCount}
            />

            {/* Bottom Navigator */}
            {viewMode === 'tabbed' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14">
                <div className="p-5 rounded-2xl bg-[#e6ecf4] border border-[#b8c6d4] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm sm:text-base text-slate-700">
                    <span className="text-cyan-900 font-bold font-sans">NEXT:</span> Access public engineering documents and technical blueprints in the Engineering Hub.
                  </div>
                  <button
                    onClick={() => handleSelectPart('overview')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-sm sm:text-base font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap"
                  >
                    <span>Proceed to Engineering Hub</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* 03. ENGINEERING HUB (DOCUMENT REPOSITORY & DEVICE UPLOAD)*/}
        {/* ======================================================== */}
        {(viewMode === 'continuous' || activePart === 'overview') && (
          <section id="overview" className="relative border-b border-[#b0bece]">
            {viewMode === 'continuous' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#e8eef5] border border-[#b8c6d4] text-xs font-sans text-cyan-900 shadow-sm">
                  <span className="font-bold">PART 03</span>
                  <span className="text-slate-400">·</span>
                  <span>ENGINEERING HUB &amp; DOCUMENT REPOSITORY</span>
                </div>
              </div>
            )}
            <HomeView
              onNavigatePart={handleSelectPart}
              onResumeClick={() => setIsResumeOpen(true)}
              onRecruiterScanClick={() => setIsRecruiterScanOpen(true)}
            />

            {/* Bottom Sequential Navigator */}
            {viewMode === 'tabbed' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
                <div className="p-5 rounded-2xl bg-[#e6ecf4] border border-[#b8c6d4] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm sm:text-base text-slate-700">
                    <span className="text-cyan-900 font-bold font-sans">OVERVIEW COMPLETE:</span> Ready to inspect deep technical calculations and FEA boundary conditions?
                  </div>
                  <button
                    onClick={() => handleSelectPart('projects')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-sm sm:text-base font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap"
                  >
                    <span>Proceed to Case Studies &amp; DFM</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* 04. CASE STUDIES & DFM POST-MORTEMS                      */}
        {/* ======================================================== */}
        {(viewMode === 'continuous' || activePart === 'projects') && (
          <section id="projects" className="min-h-[calc(100vh-8.5rem)] py-6 sm:py-8 border-b border-[#b0bece] bg-[#dce1e8] flex flex-col">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col space-y-6">
              {/* Filter Tabs in a row flexbox */}
              <div className="flex flex-row items-center gap-2 p-1.5 bg-[#e4eaf1] rounded-xl border border-[#b4c2d1] shadow-inner text-xs sm:text-sm self-start overflow-x-auto">
                {(['All', 'CAD'] as ProjectCategory[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap font-sans font-semibold transition-all cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-700 hover:text-slate-950 hover:bg-[#d8e0ea]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Projects Grid */}
              {filteredProjects.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onSelect={(p) => setActiveProject(p)}
                      onOpenWhitepaper={(p) => setWhitepaperProject(p)}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-8 sm:p-12 text-center bg-[#edf2f8] border border-[#b8c6d4] rounded-2xl shadow-sm my-2">
                  <FolderOpen className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 font-serif">No Case Studies Currently Listed</h3>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-md mx-auto">
                    New engineering case studies, 3D CAD post-mortems, and technical designs will appear here.
                  </p>
                </div>
              )}

              {/* Mathematical Model & Invention Generator Studio */}
              <MathematicalInventionGenerator />
            </div>

            {/* Bottom Navigator */}
            {viewMode === 'tabbed' && (
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-14 w-full">
                <div className="p-5 rounded-2xl bg-[#e6ecf4] border border-[#b8c6d4] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm sm:text-base text-slate-700">
                    <span className="text-cyan-900 font-bold font-sans">NEXT:</span> Analyze study documents, extract key concepts, and generate practice exams with EaseStudy AI.
                  </div>
                  <button
                    onClick={() => handleSelectPart('easestudy')}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-sm sm:text-base font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap"
                  >
                    <span>Proceed to EaseStudy</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* 05. EASESTUDY (AI DOCUMENT / IMAGE EXAM & STUDY STUDIO)  */}
        {/* ======================================================== */}
        {(viewMode === 'continuous' || activePart === 'easestudy') && (
          <section id="easestudy" className="relative border-b border-[#b0bece] py-8 sm:py-10 bg-[#dce1e8]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {viewMode === 'continuous' && (
                <div className="pb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#e8eef5] border border-[#b8c6d4] text-xs font-sans text-cyan-900 shadow-sm">
                    <span className="font-bold">PART 05</span>
                    <span className="text-slate-400">·</span>
                    <span>EASESTUDY AI STUDY &amp; EXAM SUITE</span>
                  </div>
                </div>
              )}
              <EaseStudyView onNavigatePart={handleSelectPart} />

              {/* Bottom Navigator */}
              {viewMode === 'tabbed' && (
                <div className="pt-10">
                  <div className="p-5 rounded-2xl bg-[#e6ecf4] border border-[#b8c6d4] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm sm:text-base text-slate-700">
                      <span className="text-cyan-900 font-bold font-sans">EASESTUDY COMPLETE:</span> Have questions or want to discuss technical proposals or engineering services?
                    </div>
                    <button
                      onClick={() => handleSelectPart('messaging')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-sm sm:text-base font-semibold shadow-md transition-all cursor-pointer whitespace-nowrap"
                    >
                      <span>Proceed to Messaging</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* 07. FULL PAGE MESSAGING SECTION ONLY                     */}
        {/* ======================================================== */}
        {(viewMode === 'continuous' || activePart === 'messaging') && (
          <section id="messaging" className="h-[calc(100vh-4rem)] sm:h-[calc(100vh-4.5rem)] bg-[#dce1e8] flex flex-col overflow-hidden">
            <MessagingSection />
          </section>
        )}
      </main>

      {/* Footer (Hidden on messaging page) */}
      {activePart !== 'messaging' && (
        <footer className="py-4 border-t border-[#b8c6d4] bg-[#d2d8e1] text-xs text-slate-700 font-sans text-center">
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
        onSelectProject={(id) => {
          handleSelectPart('projects');
          handleSelectProjectById(id);
        }}
        onResumeClick={() => {
          setIsRecruiterScanOpen(false);
          handleOneClickResumeDownload();
        }}
      />
    </div>
  );
}
