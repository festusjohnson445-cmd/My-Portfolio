import React, { useState, useEffect } from 'react';
import {
  X,
  LayoutList,
  ChevronRight
} from 'lucide-react';
import { FeslineLogo } from './FeslineLogo';
import { useProfileSync } from '../utils/profileState';

export type PortfolioPart = 'home' | 'profile' | 'overview' | 'projects' | 'easestudy' | 'messaging';

interface NavbarProps {
  activePart: PortfolioPart;
  onSelectPart: (part: PortfolioPart) => void;
  viewMode: 'tabbed' | 'continuous';
  onToggleViewMode: () => void;
  onResumeClick?: () => void;
  onRecruiterScanClick?: () => void;
  resumeDownloadCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activePart,
  onSelectPart,
  viewMode,
  onToggleViewMode,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { avatar: profileAvatar, bio } = useProfileSync();
  const userName = bio.fullName || 'Festus Johnson';

  // Lock body scroll when left drawer is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const navParts: { id: PortfolioPart; label: string; number: string; sub: string }[] = [
    { id: 'home', label: 'Home', number: '01', sub: 'Welcome & Interactive Overview' },
    { id: 'profile', label: 'My Profile', number: '02', sub: 'Bio, Custom Files & Credentials' },
    { id: 'overview', label: 'Engineering Hub', number: '03', sub: 'Technical Documents & Device Uploads' },
    { id: 'projects', label: 'Case Studies', number: '04', sub: 'Precision CAD & DFM Analyses' },
    { id: 'easestudy', label: 'EaseStudy', number: '05', sub: 'Document & Image AI Study Suite & Exam Generator' },
    { id: 'messaging', label: 'Messaging', number: '06', sub: 'Direct Chat & Job/Service Discussions' },
  ];

  const handleNavClick = (part: PortfolioPart) => {
    onSelectPart(part);
    setMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#d6dce4]/95 backdrop-blur-md border-b border-[#abb8c7] shadow-xs transition-all font-serif">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
          
          {/* ======================================================== */}
          {/* LEFT HAND SIDE: MENU BAR & FESLINE BRAND                 */}
          {/* ======================================================== */}
          <div className="flex items-center gap-2.5 sm:gap-3.5">
            {/* 1. Menu Bar Button (Located on Left Hand Side) */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl bg-[#e4eaf1] hover:bg-white text-slate-800 hover:text-slate-950 border border-[#b4c2d1] hover:border-slate-400 shadow-xs transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-cyan-700/50"
              aria-label="Toggle Menu Bar"
              title="Open Navigation Menu"
            >
              <div className="relative w-4.5 h-4.5 flex flex-col justify-center items-center gap-1">
                <span className={`block h-0.5 w-4 bg-slate-800 group-hover:bg-cyan-900 transition-all ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                <span className={`block h-0.5 w-4 bg-slate-800 group-hover:bg-cyan-900 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 w-4 bg-slate-800 group-hover:bg-cyan-900 transition-all ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
              </div>
              <span className="text-xs sm:text-sm font-sans font-bold tracking-wide uppercase text-slate-700 group-hover:text-cyan-950">
                Menu
              </span>
            </button>

            {/* 2. Fesline Logo Sitting Fit Next by the Side of Menu Bar */}
            <button
              onClick={() => handleNavClick('home')}
              className="text-left group cursor-pointer focus:outline-none transition-all pl-1 py-1 flex items-center shrink-0"
              title="Fesline — Return to Home"
            >
              <FeslineLogo className="h-7 sm:h-8.5 w-auto" showSubtitle={true} />
            </button>
          </div>

          {/* ======================================================== */}
          {/* RIGHT HAND SIDE: PROFILE PICTURE ICON                    */}
          {/* ======================================================== */}
          <div className="flex items-center">
            <button
              onClick={() => handleNavClick('profile')}
              className={`relative flex items-center justify-center p-0.5 rounded-full transition-all cursor-pointer group focus:outline-none ${
                activePart === 'profile'
                  ? 'ring-2 ring-cyan-800 ring-offset-2 ring-offset-[#d6dce4]'
                  : 'hover:ring-2 hover:ring-slate-400 hover:ring-offset-1 ring-offset-[#d6dce4]'
              }`}
              title={`View ${userName}'s Profile & Bio`}
              aria-label="Go to My Profile"
            >
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 border-white shadow-sm bg-slate-200 shrink-0">
                <img
                  src={profileAvatar}
                  alt={userName}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>

              {/* Online / Active status indicator dot */}
              <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
            </button>
          </div>

        </div>
      </header>

      {/* ======================================================== */}
      {/* LEFT-SIDE SLIDE-OUT MENU BAR DRAWER                      */}
      {/* ======================================================== */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex font-serif animate-fade-in">
          {/* Dimmed Backdrop */}
          <div
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs transition-opacity cursor-pointer"
            aria-hidden="true"
          />

          {/* Drawer Container (Slides from Left Hand Side) */}
          <div className="relative w-full max-w-sm sm:max-w-md bg-[#edf2f8] h-full shadow-2xl border-r border-[#b4c2d1] flex flex-col justify-between overflow-y-auto z-10 animate-in slide-in-from-left duration-300">
            
            {/* Drawer Top Header */}
            <div>
              <div className="p-5 sm:p-6 border-b border-[#cbd5e1] bg-[#dbe1e9] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-sm bg-slate-200 shrink-0">
                    <img
                      src={profileAvatar}
                      alt={userName}
                      className="w-full h-full object-cover object-center"
                    />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-950 font-serif leading-tight">
                      {userName}
                    </h3>
                    <span className="text-xs font-sans text-cyan-900 font-semibold block">
                      Lead Mechanical Design Engineer
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-950 border border-[#b8c6d4] transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items List */}
              <div className="p-5 sm:p-6 space-y-2">
                <div className="text-[11px] font-sans font-bold uppercase tracking-widest text-slate-500 mb-3 px-1">
                  PORTFOLIO NAVIGATION
                </div>

                {navParts.map((part) => {
                  const isActive = activePart === part.id;
                  return (
                    <button
                      key={part.id}
                      onClick={() => handleNavClick(part.id)}
                      className={`w-full text-left p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-950 border-slate-950 text-white font-bold shadow-md'
                          : 'bg-white hover:bg-white/80 border-[#cbd5e1] text-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span
                          className={`text-xs font-sans font-bold px-2 py-0.5 rounded-md ${
                            isActive ? 'bg-cyan-900 text-cyan-200' : 'bg-[#edf2f8] text-cyan-900'
                          }`}
                        >
                          {part.number}
                        </span>
                        <div>
                          <span className="block text-sm sm:text-base font-bold">
                            {part.label}
                          </span>
                          <span
                            className={`block text-xs font-sans mt-0.5 ${
                              isActive ? 'text-slate-300' : 'text-slate-600'
                            }`}
                          >
                            {part.sub}
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-4 h-4 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Drawer Footer / Presentation Mode Toggle */}
            <div className="p-5 sm:p-6 border-t border-[#cbd5e1] bg-[#dbe1e9] font-sans">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-600 block">Layout Presentation</span>
                  <span className="text-xs font-bold text-slate-900">
                    Mode: {viewMode === 'tabbed' ? 'Focused Tab' : 'Full Dossier'}
                  </span>
                </div>
                <button
                  onClick={() => {
                    onToggleViewMode();
                    setMenuOpen(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-cyan-900 border border-[#b8c6d4] hover:bg-slate-50 shadow-xs cursor-pointer"
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>Switch Mode</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
