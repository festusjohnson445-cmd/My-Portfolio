import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronRight,
  ChevronDown,
  User,
} from 'lucide-react';
import { FeslineLogo } from './FeslineLogo';
import { useProfileSync } from '../utils/profileState';
import {
  withRecordVersion,
  subscribeToUnreadMessagingUpdates,
} from '../utils/supabase';

export type PortfolioPart =
  | 'home'
  | 'profile'
  | 'messaging'
  | 'overview'
  | 'projects'
  | 'articles'
  | 'admin';

export const PROFILE_SUBSECTIONS: { id: string; label: string }[] = [
  { id: 'profile-bio', label: 'Bio & About' },
  { id: 'profile-experience', label: 'Experience & Career' },
  { id: 'profile-publications', label: 'Research & Publications' },
  { id: 'profile-achievements', label: 'Achievements & Awards' },
];

interface NavbarProps {
  activePart: PortfolioPart;
  onSelectPart: (part: PortfolioPart, sectionId?: string) => void;
  onResumeClick?: () => void;
  resumeDownloadCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activePart,
  onSelectPart,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [drawerProfileOpen, setDrawerProfileOpen] = useState(false);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { avatar: profileAvatar, bio, isOwner, updatedAt } = useProfileSync();
  const userName = bio.fullName || 'Festus, Olorunsogo Johnson';

  // Live unread messaging badge count for both owner and visitors
  useEffect(() => {
    const unsub = subscribeToUnreadMessagingUpdates({
      isOwner,
      onCountChange: (count) => setUnreadMsgCount(count),
    });
    return () => unsub();
  }, [isOwner]);

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

  // Handle ESC key and outside clicks to close menus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setProfileDropdownOpen(false);
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Main navigation order: Home, Profile, Messaging, Engineering Hub, Projects, Blog / Articles (+ Admin Dashboard when owner logged in)
  const navParts: { id: PortfolioPart; label: string; sub: string; hasDropdown?: boolean }[] = [
    { id: 'home', label: 'Home', sub: 'Welcome & Portfolio Overview' },
    { id: 'profile', label: 'Profile', sub: 'Bio, Experience, Publications & Awards', hasDropdown: true },
    { id: 'messaging', label: 'Messaging', sub: 'Direct Chat & Technical Inquiries' },
    { id: 'overview', label: 'Engineering Hub', sub: 'Technical Documents & Device Uploads' },
    { id: 'projects', label: 'Projects', sub: 'Engineering Portfolio & Case Studies' },
    { id: 'articles', label: 'Blog / Articles', sub: 'Engineering Articles & Publications' },
  ];

  if (isOwner) {
    navParts.push({
      id: 'admin',
      label: 'Admin Dashboard',
      sub: 'Manage Portfolio, Articles & Website Settings',
    });
  }

  const handleNavClick = (part: PortfolioPart, sectionId?: string) => {
    setProfileDropdownOpen(false);
    setMenuOpen(false);
    onSelectPart(part, sectionId);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#d6dce4]/95 backdrop-blur-md border-b border-[#abb8c7] shadow-xs transition-all font-serif">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* LEFT: MENU BUTTON & FESLINE BRAND */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#e4eaf1] hover:bg-white text-slate-800 hover:text-slate-950 border border-[#b4c2d1] hover:border-slate-400 shadow-xs transition-all cursor-pointer group focus:outline-none focus:ring-2 focus:ring-cyan-700/50 whitespace-nowrap shrink-0"
              aria-label="Toggle Menu Bar"
              title="Open Navigation Menu"
            >
              <div className="relative w-4 h-4 flex flex-col justify-center items-center gap-1">
                <span className={`block h-0.5 w-3.5 bg-slate-800 group-hover:bg-cyan-900 transition-all ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`} />
                <span className={`block h-0.5 w-3.5 bg-slate-800 group-hover:bg-cyan-900 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
                <span className={`block h-0.5 w-3.5 bg-slate-800 group-hover:bg-cyan-900 transition-all ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`} />
              </div>
              <span className="text-[11px] font-bold tracking-wide uppercase text-slate-700 group-hover:text-cyan-950">
                Menu
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleNavClick('home')}
              className="text-left group cursor-pointer focus:outline-none transition-all pl-0.5 py-1 flex items-center shrink-0"
              title="Fesline — Return to Home"
            >
              <FeslineLogo className="h-7 sm:h-8 w-auto" showSubtitle={true} />
            </button>
          </div>

          {/* CENTER: DESKTOP NAVIGATION LINKS (Order: Home, Profile, Messaging, Engineering Hub, Projects, Blog / Articles, [Admin Dashboard]) */}
          <nav
            ref={dropdownRef}
            className="hidden lg:flex items-center gap-0.5 bg-[#e0e7ee]/90 px-1.5 py-1 rounded-xl border border-[#b4c2d1] shadow-inner font-serif relative"
          >
            {navParts.map((part) => {
              const isActive = activePart === part.id;

              if (part.hasDropdown) {
                return (
                  <div key={part.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setProfileDropdownOpen((prev) => !prev)}
                      aria-expanded={profileDropdownOpen}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                        isActive || profileDropdownOpen
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-800 hover:text-slate-950 hover:bg-white/80'
                      }`}
                      title="Open Profile Sections"
                    >
                      <span>{part.label}</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-150 ${
                          profileDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {profileDropdownOpen && (
                      <div className="absolute left-0 mt-2 w-56 rounded-xl bg-white border border-[#b4c2d1] shadow-xl py-1.5 z-50 font-serif animate-fade-in">
                        {PROFILE_SUBSECTIONS.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleNavClick('profile', sub.id)}
                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-[#e6ecf4] hover:text-cyan-950 flex items-center justify-between transition-colors cursor-pointer"
                          >
                            <span>{sub.label}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <button
                  key={part.id}
                  type="button"
                  onClick={() => handleNavClick(part.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-800 hover:text-slate-950 hover:bg-white/80'
                  }`}
                  title={`Navigate to ${part.label}`}
                >
                  {part.id === 'messaging' && unreadMsgCount > 0 && (
                    <span
                      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-none shadow-2xs shrink-0"
                      aria-label={`${unreadMsgCount} unread messages`}
                    >
                      {unreadMsgCount > 99 ? '99+' : unreadMsgCount}
                    </span>
                  )}
                  <span>{part.label}</span>
                </button>
              );
            })}
          </nav>

          {/* RIGHT: PROFILE AVATAR BUTTON (NO STATUS TEXT / LOCK ICONS) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleNavClick('profile', 'profile-bio')}
              className={`relative flex items-center justify-center p-0.5 rounded-full transition-all cursor-pointer group focus:outline-none ${
                activePart === 'profile'
                  ? 'ring-2 ring-cyan-800 ring-offset-2 ring-offset-[#d6dce4]'
                  : 'hover:ring-2 hover:ring-slate-400 hover:ring-offset-1 ring-offset-[#d6dce4]'
              }`}
              title={`View ${userName}'s Profile`}
              aria-label="Go to Profile"
            >
              <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm bg-slate-200 shrink-0 flex items-center justify-center">
                {profileAvatar ? (
                  <img
                    src={withRecordVersion(profileAvatar, updatedAt)}
                    alt={userName}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <User className="w-5 h-5 text-slate-500" />
                )}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* SLIDE-OUT NAVIGATION DRAWER */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />

          <div className="relative w-60 sm:w-64 bg-[#eaf0f6] text-slate-900 h-full shadow-2xl flex flex-col justify-between z-10 border-r border-[#b0bece] overflow-y-auto font-serif">
            <div>
              {/* Drawer Header */}
              <div className="px-3.5 py-3 border-b border-[#cbd5e1] flex items-center justify-between bg-[#dbe3ed]">
                <div className="flex items-center gap-2">
                  <FeslineLogo className="h-5 w-auto" showSubtitle={false} />
                  <h2 className="text-sm font-bold text-slate-900 leading-none">Navigation</h2>
                </div>

                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/80 transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Items List */}
              <div className="p-3 space-y-1.5">
                {navParts.map((part) => {
                  const isActive = activePart === part.id;

                  if (part.hasDropdown) {
                    return (
                      <div key={part.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setDrawerProfileOpen((prev) => !prev)}
                          aria-expanded={drawerProfileOpen}
                          className={`w-full text-left px-2.5 py-2 rounded-lg border flex items-center justify-between transition-all cursor-pointer ${
                            isActive || drawerProfileOpen
                              ? 'bg-slate-900 border-slate-900 text-white font-bold shadow-sm'
                              : 'bg-white hover:bg-white/80 border-[#cbd5e1] text-slate-800 hover:border-slate-400'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="block text-xs font-bold leading-tight">{part.label}</span>
                            <span
                              className={`block text-[10px] mt-0.5 truncate ${
                                isActive || drawerProfileOpen ? 'text-slate-300' : 'text-slate-600'
                              }`}
                            >
                              {part.sub}
                            </span>
                          </div>
                          <ChevronDown
                            className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                              drawerProfileOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </button>

                        {drawerProfileOpen && (
                          <div className="pl-2.5 space-y-1">
                            {PROFILE_SUBSECTIONS.map((sub) => (
                              <button
                                key={sub.id}
                                type="button"
                                onClick={() => handleNavClick('profile', sub.id)}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg bg-white/90 hover:bg-[#dbe5f0] border border-[#cbd5e1] text-[11px] font-semibold text-slate-800 flex items-center justify-between transition-colors cursor-pointer"
                              >
                                <span>{sub.label}</span>
                                <ChevronRight className="w-3 h-3 text-slate-400" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => handleNavClick(part.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg border flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-950 border-slate-950 text-white font-bold shadow-md'
                          : 'bg-white hover:bg-white/80 border-[#cbd5e1] text-slate-800 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {part.id === 'messaging' && unreadMsgCount > 0 && (
                          <span
                            className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold leading-none shadow-2xs shrink-0"
                            aria-label={`${unreadMsgCount} unread messages`}
                          >
                            {unreadMsgCount > 99 ? '99+' : unreadMsgCount}
                          </span>
                        )}
                        <div className="min-w-0">
                          <span className="block text-xs font-bold leading-tight">{part.label}</span>
                          <span
                            className={`block text-[10px] mt-0.5 truncate ${
                              isActive ? 'text-slate-300' : 'text-slate-600'
                            }`}
                          >
                            {part.sub}
                          </span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-cyan-300' : 'text-slate-400'}`}
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
