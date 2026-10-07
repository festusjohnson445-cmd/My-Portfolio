import React from 'react';
import {
  User,
  ArrowRight,
  Layers,
  Zap,
  MessageSquare,
  BrainCircuit
} from 'lucide-react';
import { PortfolioPart } from './Navbar';
import { useProfileSync, getRightBadgeCertifications } from '../utils/profileState';
import { withRecordVersion } from '../utils/supabase';

interface LandingHomeViewProps {
  onNavigatePart: (part: PortfolioPart) => void;
  onResumeClick: () => void;
  onRecruiterScanClick: () => void;
}

export const LandingHomeView: React.FC<LandingHomeViewProps> = ({
  onNavigatePart,
  onResumeClick,
  onRecruiterScanClick,
}) => {
  const { bio, documents, avatar, updatedAt } = useProfileSync();
  const heroMessage = bio.header || "Mechanical Design Engineer specializing in precision mechanism design, non-linear structural & thermal FEA, CNC multi-axis machining, and mission-critical hardware for flight-ready aerospace, quantum systems, and robotics.";
  const dynamicCertifications = getRightBadgeCertifications(bio, documents);

  return (
    <div className="flex-1 w-full flex flex-col font-serif text-slate-800 text-[0.95em]">
      {/* ======================================================== */}
      {/* 1. HERO SECTION WITH MODERN ENGINEERING STYLING          */}
      {/* ======================================================== */}
      <section className="relative overflow-hidden pt-8 pb-14 sm:pt-12 sm:pb-20 border-b border-[#b0bece] bg-gradient-to-b from-[#f0f4f9] via-[#e4ecf5] to-[#d6e0ec]">
        {/* Engineering precision grid background */}
        <div 
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(#334155 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
        />

        {/* Ambient subtle glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
            
            {/* Live Availability & Verified Credential Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 backdrop-blur-xs border border-slate-300 text-xs font-sans text-cyan-950 shadow-xs mb-5 max-w-full">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-bold shrink-0">Lead Mechanical Engineer • CAD drafting</span>
              <span className="text-slate-300 shrink-0">|</span>
              <span className="font-mono text-slate-600 truncate text-[11px]" title={dynamicCertifications}>
                {dynamicCertifications}
              </span>
            </div>

            {/* Main Welcome Heading */}
            <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-950 leading-tight">
              Welcome to{' '}
              <span className="text-cyan-900 block mt-1 sm:mt-2">
                {bio.fullName ? `${bio.fullName.split(',')[0]}'s Portfolio` : "Festus, Olorunsogo's Portfolio"}
              </span>
            </h1>

            {/* Subtitle & Engineering Statement */}
            <p className="mt-4 text-sm sm:text-base md:text-lg text-slate-700 max-w-2xl leading-relaxed font-sans font-normal">
              {heroMessage}
            </p>

            {/* CTA Action Buttons */}
            <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-md mx-auto">
              {/* Primary User CTA: My Profile */}
              <button
                onClick={() => onNavigatePart('profile')}
                className="w-full min-w-0 inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl bg-cyan-900 hover:bg-cyan-800 text-white text-xs sm:text-sm font-sans font-bold shadow-sm hover:shadow-md transition-all cursor-pointer whitespace-nowrap group"
              >
                <User className="w-4 h-4 text-cyan-200 group-hover:scale-110 transition-transform shrink-0" />
                <span className="truncate">My Profile</span>
              </button>

              {/* Secondary CTA: Explore Engineering Hub */}
              <button
                onClick={() => onNavigatePart('overview')}
                className="w-full min-w-0 inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-900 text-xs sm:text-sm font-sans font-bold border border-slate-300 shadow-2xs hover:border-slate-400 transition-all cursor-pointer whitespace-nowrap"
              >
                <Layers className="w-4 h-4 text-cyan-800 shrink-0" />
                <span className="truncate">Engineering Hub</span>
              </button>
            </div>

            {/* Recruiter 60-Second Scan Link */}
            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-sans text-slate-600">
              <span>3D Modeling</span>
              <button
                onClick={onRecruiterScanClick}
                className="inline-flex items-center gap-1 font-bold text-cyan-900 hover:text-cyan-950 underline cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                <span>Launch 60-Second Executive Scan</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. WEBSITE SECTIONS DIRECT ACCESS HUB                     */}
      {/* ======================================================== */}
      <section className="py-12 sm:py-16 bg-[#d6dce4]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-block px-3.5 py-1 rounded-full bg-cyan-900/10 border border-cyan-800/25 text-cyan-900 text-[11px] font-sans font-extrabold uppercase tracking-widest mb-2 shadow-2xs">
              Navigation &amp; Portals
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-cyan-950 mt-1 font-serif tracking-tight drop-shadow-2xs">
              Explore More
            </h2>
            <p className="text-xs sm:text-sm font-sans text-slate-700 mt-2 max-w-lg mx-auto font-medium leading-relaxed">
              Explore 3D CAD mechanisms, empirical metrology verification, FEA boundary post-mortems, and direct communication.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-5xl mx-auto">
            {/* Card 1: My Profile */}
            <div 
              onClick={() => onNavigatePart('profile')}
              className="p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-300 hover:border-cyan-700 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                      {avatar ? (
                        <img
                          src={withRecordVersion(avatar, updatedAt)}
                          alt="Profile"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-cyan-800" />
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-sans font-bold text-cyan-900 uppercase tracking-wider block">
                        Verified
                      </span>
                      <span className="text-xs font-serif font-bold text-slate-900 truncate">
                        {bio.fullName || 'Festus, Olorunsogo Johnson'}
                      </span>
                    </div>
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-cyan-950 transition-colors font-serif">
                  My Profile &amp; Credentials
                </h3>
                <p className="text-xs sm:text-sm font-sans text-slate-600 mt-1.5 leading-relaxed">
                  Portrait profile, comprehensive biography, direct ATS resume generator, verified engineering certifications, and contact channels.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-cyan-900 group-hover:text-cyan-950">
                <span>View Full Profile</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 2: Engineering Hub */}
            <div 
              onClick={() => onNavigatePart('overview')}
              className="p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-300 hover:border-cyan-700 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                    <Layers className="w-5 h-5 text-cyan-800" />
                  </div>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-cyan-950 transition-colors font-serif">
                  Engineering Hub
                </h3>
                <p className="text-xs sm:text-sm font-sans text-slate-600 mt-1.5 leading-relaxed">
                  Access different categories of Engineering Documents and Technical Archive, Inspirational Books, Christian literature and more. Direct 1-click device uploads.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-cyan-900 group-hover:text-cyan-950">
                <span>Explore Engineering Hub</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 3: EaseStudy Studio */}
            <div 
              onClick={() => onNavigatePart('easestudy')}
              className="p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-300 hover:border-cyan-700 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                    <BrainCircuit className="w-5 h-5 text-cyan-800" />
                  </div>
                  <span className="text-[10px] font-sans font-bold text-cyan-900 bg-cyan-50 px-2.5 py-0.5 rounded-md border border-cyan-200">
                    AI STUDIO
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-cyan-950 transition-colors font-serif">
                  EaseStudy - Studio
                </h3>
                <p className="text-xs sm:text-sm font-sans text-slate-600 mt-1.5 leading-relaxed">
                  Upload handouts, PDF papers, engineering drawings, or lecture notes to generate instant executive summaries, key concept breakdowns, and practice exams.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-cyan-900 group-hover:text-cyan-950">
                <span>Open EaseStudy Studio</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Card 4: Direct Messaging & Inquiry Channel */}
            <div 
              onClick={() => onNavigatePart('messaging')}
              className="p-5 sm:p-6 rounded-2xl bg-white/90 border border-slate-300 hover:border-cyan-700 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 border border-cyan-300 flex items-center justify-center group-hover:scale-105 transition-transform shadow-2xs">
                    <MessageSquare className="w-5 h-5 text-cyan-800" />
                  </div>
                  <span className="text-[10px] font-sans font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    LIVE
                  </span>
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-950 group-hover:text-cyan-950 transition-colors font-serif">
                  Direct Messaging Channel
                </h3>
                <p className="text-xs sm:text-sm font-sans text-slate-600 mt-1.5 leading-relaxed">
                  Direct inquiry workspace to discuss job roles, design consulting, tolerance reviews, or technical proposals.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-cyan-900 group-hover:text-cyan-950">
                <span>Open Direct Chat</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
};
