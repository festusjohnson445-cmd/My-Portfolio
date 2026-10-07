import React from 'react';
import { X, Zap, Download, Award, FileText, Mail, ShieldCheck, Briefcase, CheckCircle2 } from 'lucide-react';

interface RecruiterScanProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSelectProject?: (projectId: string) => void;
  onResumeClick?: () => void;
}

export const RecruiterScanMode: React.FC<RecruiterScanProps> = ({
  isOpen = false,
  onClose,
  onResumeClick,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in font-sans">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#1f2937] text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center">
              <Zap className="w-5 h-5 fill-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-serif text-white tracking-tight">
                  60-Second Recruiter Executive Scan
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  VERIFIED HARDWARE
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Festus Johnson · Lead Mechanical Hardware &amp; Precision Mechanism Engineer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Experience</span>
              <span className="text-base font-bold text-slate-900">6+ Years</span>
              <span className="text-[10px] text-slate-500 block">Flight Mechanisms</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Education</span>
              <span className="text-base font-bold text-slate-900">BSME Honors</span>
              <span className="text-[10px] text-slate-500 block">ABET Accredited</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Certification</span>
              <span className="text-base font-bold text-emerald-700">CSWP Verified</span>
              <span className="text-[10px] text-slate-500 block">SolidWorks Pro</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Standard</span>
              <span className="text-base font-bold text-cyan-800">ASME Y14.5</span>
              <span className="text-[10px] text-slate-500 block">GD&amp;T Senior</span>
            </div>
          </div>

          {/* Core Hardware Disciplines */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
            <h3 className="font-bold text-slate-900 flex items-center gap-1.5 text-xs uppercase tracking-wide">
              <Briefcase className="w-3.5 h-3.5 text-cyan-700" />
              Core Competencies &amp; Technical Scope
            </h3>
            <div className="grid sm:grid-cols-2 gap-2 text-[11px]">
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>High-Precision Mechanism Design:</strong> Optomechanical assemblies, harmonic drives, brushless gimbal mounts.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Finite Element Analysis (FEA):</strong> Von Mises structural fatigue, modal vibration, and thermal conduction.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>DFM / DFA Production:</strong> CNC 5-axis machining, sheet metal forming, laser cutting, injection molding.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span><strong>Engineering Toolchain:</strong> SolidWorks (CSWP), PTC Creo, Siemens NX, Inventor, Fusion 360, AutoCAD.</span>
              </div>
            </div>
          </div>

          {/* Availability & Clearance */}
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span><strong>Status:</strong> Available for Mechanical Design &amp; Hardware Lead Roles (US Authorized).</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
          <a
            href="mailto:festusjohnson028@gmail.com?subject=Recruiter%20Inquiry%20-%20Festus%20Johnson"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-cyan-700" />
            <span>Direct Email Inquiry</span>
          </a>

          <div className="flex items-center gap-2">
            {onResumeClick && (
              <button
                type="button"
                onClick={() => {
                  onResumeClick();
                  onClose?.();
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Verified Resume</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

