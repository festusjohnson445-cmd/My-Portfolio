import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronRight,
  Zap,
  ShieldCheck,
  Lock,
  Unlock,
  User,
} from 'lucide-react';
import { FeslineLogo } from './FeslineLogo';
import { useProfileSync } from '../utils/profileState';

export type PortfolioPart = 'home' | 'profile' | 'overview' | 'easestudy' | 'messaging';

interface NavbarProps {
  activePart: PortfolioPart;
  onSelectPart: (part: PortfolioPart) => void;
  onResumeClick?: () => void;
  onRecruiterScanClick?: () => void;
  resumeDownloadCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activePart,
  onSelectPart,
  onResumeClick,
  onRecruiterScanClick,
  resumeDownloadCount = 148,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { avatar: profileAvatar, bio, isOwner } = useProfileSync();
  const userName = bio.fullName || 'Festus, Olorunsogo Johnson';

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
    { id: 'easestudy', label: 'EaseStudy', number: '04', sub: 'Document & Image AI Study Suite & Exam Generator' },
    { id: 'messaging', label: 'Messaging', number: '05', sub: 'Direct Chat & Job/Service Discussions' },
  ];

  const handleNavClick = (part: PortfolioPart) => {
    onSelectPart(part);
    setMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#d6dce4]/95 backdrop-blur-md border-b border-[#abb8c7] shadow-xs transition-all font-serif">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between gap-3">
          
          {/* ======================================================== */}
          {/* LEFT HAND SIDE: MENU BUTTON & FESLINE BRAND              */}
          {/* ======================================================== */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* 1. Menu Bar Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-[#e4eaf1] hover:bg-white text-slate-800 hover:text-slate-950 border border-[#b4c2d1] hover:border-slate-400 shadow-xs transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-cyan-700/50"
              aria-label="Toggle Menu Bar"
              title="Open Navigation Menu"
            >
              <div className="relative w-4 h-4 sm:w-4.5 sm:h-4.5 flex flex-col justify-center items-center gap-1">
                <span className={`block h-0.5 w-3.5 sm:w-4 bg-slate-800 group-hover:bg-cyan-900 transition-all ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                <span className={`block h-0.5 w-3.5 sm:w-4 bg-slate-800 group-hover:bg-cyan-900 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 w-3.5 sm:w-4 bg-slate-800 group-hover:bg-cyan-900 transition-all ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
              </div>
              <span className="text-[11px] sm:text-xs font-sans font-bold tracking-wide uppercase text-slate-700 group-hover:text-cyan-950">
                Menu
              </span>
            </button>

            {/* 2. Fesline Logo */}
            <button
              onClick={() => handleNavClick('home')}
              className="text-left group cursor-pointer focus:outline-none transition-all pl-1 py-1 flex items-center shrink-0"
              title="Fesline — Return to Home"
            >
              <FeslineLogo className="h-7 sm:h-8.5 w-auto" showSubtitle={true} />
            </button>
          </div>

          {/* ======================================================== */}
          {/* CENTER: DESKTOP QUICK NAVIGATION LINKS                   */}
          {/* ======================================================== */}
          <nav className="hidden lg:flex items-center gap-1 bg-[#e0e7ee]/90 px-1.5 py-1 rounded-2xl border border-[#b4c2d1] shadow-inner font-sans">
            {navParts.map((part) => {
              const isActive = activePart === part.id;
              return (
                <button
                  key={part.id}
                  onClick={() => handleNavClick(part.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-white/70'
                  }`}
                  title={`Navigate to ${part.label}`}
                >
                  <span
                    className={`text-[10px] px-1 py-0.5 rounded font-mono leading-none ${
                      isActive ? 'bg-cyan-800 text-cyan-200' : 'bg-slate-300/80 text-slate-700'
                    }`}
                  >
                    {part.number}
                  </span>
                  <span>{part.label}</span>
                </button>
              );
            })}
          </nav>

          {/* ======================================================== */}
          {/* RIGHT HAND SIDE: RECRUITER SCAN, RESUME PDF & AVATAR     */}
          {/* ======================================================== */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Mode Indicator: Owner vs Visitor */}
            {isOwner ? (
              <button
                type="button"
                onClick={() => handleNavClick('profile')}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-[11px] font-sans font-bold shadow-2xs transition-colors cursor-pointer"
                title="Owner Mode Active (Festus Johnson). Click to manage profile."
              >
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <Unlock className="w-3 h-3 text-emerald-700" />
                <span>Owner</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleNavClick('profile')}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-200/90 hover:bg-white text-slate-700 hover:text-slate-950 border border-slate-300 text-[11px] font-sans font-medium transition-colors cursor-pointer shadow-2xs"
                title="Viewing Public Portfolio Dossier. Click to view profile."
              >
                <ShieldCheck className="w-3 h-3 text-cyan-800" />
                <span>Visitor Mode</span>
              </button>
            )}

            {/* Recruiter Scan Button */}
            {onRecruiterScanClick && (
              <button
                onClick={onRecruiterScanClick}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-900/10 hover:bg-cyan-900/20 text-cyan-950 border border-cyan-800/30 text-xs font-sans font-bold shadow-2xs transition-colors cursor-pointer"
                title="Recruiter Quick Scan Mode"
              >
                <Zap className="w-3.5 h-3.5 text-cyan-800" />
                <span>Recruiter Scan</span>
              </button>
            )}

            {/* Profile Avatar Button */}
            <button
              onClick={() => handleNavClick('profile')}
              className={`relative flex items-center justify-center p-0.5 rounded-full transition-all cursor-pointer group focus:outline-none ${
                activePart === 'profile'
                  ? 'ring-2 ring-cyan-800 ring-offset-2 ring-offset-[#d6dce4]'
                  : 'hover:ring-2 hover:ring-slate-400 hover:ring-offset-1 ring-offset-[#d6dce4]'
              }`}
              title={`View ${userName}'s Profile`}
              aria-label="Go to My Profile"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-white shadow-sm bg-slate-200 shrink-0 flex items-center justify-center">
                {profileAvatar ? (
                  <img
                    src={profileAvatar}
                    alt={userName}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <User className="w-5 h-5 text-slate-500" />
                )}
              </div>

              {/* Active status indicator dot */}
              <span className={`absolute bottom-0 right-0 block h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full ring-2 ring-white ${
                isOwner ? 'bg-emerald-500' : 'bg-cyan-600'
              }`} />
            </button>
          </div>

        </div>
      </header>

      {/* ======================================================== */}
      {/* SLIDE-OUT NAVIGATION DRAWER (ACCESSIBLE FROM MENU BAR)   */}
      {/* ======================================================== */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content Panel */}
          <div className="relative w-full max-w-sm sm:max-w-md bg-[#eaf0f6] text-slate-900 h-full shadow-2xl flex flex-col justify-between z-10 border-r border-[#b0bece] overflow-y-auto animate-in slide-in-from-left duration-200 font-serif">
            
            <div>
              {/* Drawer Header */}
              <div className="p-5 sm:p-6 border-b border-[#cbd5e1] flex items-center justify-between bg-[#dbe3ed]">
                <div className="flex items-center gap-2.5">
                  <FeslineLogo className="h-7 w-auto" showSubtitle={false} />
                  <div>
                    <h2 className="text-base font-bold text-slate-900 leading-none">Menu Navigation</h2>
                    <span className="text-[11px] font-sans text-slate-500">Festus Johnson · Portfolio</span>
                  </div>
                </div>

                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 transition-colors cursor-pointer"
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
          </div>
        </div>
      )}
    </>
  );
};
