import React, { useState } from 'react';
import { X, Zap, Check, Copy, ExternalLink, Calendar, MapPin, DollarSign, Clock, ShieldCheck, Mail, ArrowRight } from 'lucide-react';

interface RecruiterScanProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (projectId: string) => void;
  onResumeClick: () => void;
}

export const RecruiterScanMode: React.FC<RecruiterScanProps> = ({
  isOpen,
  onClose,
  onSelectProject,
  onResumeClick,
}) => {
  const [copiedEmail, setCopiedEmail] = useState(false);

  if (!isOpen) return null;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('festusjohnson028@gmail.com');
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#edf2f8] border border-[#b8c6d4] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col font-serif">
        {/* Recruiter Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#dce2e9] border-b border-[#b8c6d4] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-600 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-700"></span>
            </span>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-950 flex items-center gap-2 font-sans">
                <span>Recruiter 60-Second Executive Scan</span>
                <span className="text-xs font-sans px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 font-bold border border-cyan-300">
                  HIGH-YIELD
                </span>
              </h2>
              <p className="text-sm text-slate-600 font-sans">Everything needed to evaluate technical fit for Senior Mechanical Roles</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800">
          {/* Quick Fit Summary Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
              <span className="text-xs font-sans font-bold text-slate-600 block flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-800" /> Availability
              </span>
              <p className="text-base font-bold text-slate-950 font-sans mt-1">Q4 2026</p>
              <span className="text-xs text-emerald-800 font-semibold font-sans">Immediate / 2 Wk Notice</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
              <span className="text-xs font-sans font-bold text-slate-600 block flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-cyan-800" /> Target Locations
              </span>
              <p className="text-base font-bold text-slate-950 font-sans mt-1">SF / Seattle / Austin</p>
              <span className="text-xs text-slate-600 font-sans">Open to Relocation &amp; Remote</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
              <span className="text-xs font-sans font-bold text-slate-600 block flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Work Auth
              </span>
              <p className="text-base font-bold text-slate-950 font-sans mt-1">US Authorized</p>
              <span className="text-xs text-slate-600 font-sans">No sponsorship needed</span>
            </div>

            <div className="p-3.5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
              <span className="text-xs font-sans font-bold text-slate-600 block flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-cyan-800" /> Target Level
              </span>
              <p className="text-base font-bold text-slate-950 font-sans mt-1">Senior / Lead MechE</p>
              <span className="text-xs text-slate-600 font-sans">Competitive Base + Equity</span>
            </div>
          </div>

          {/* Hard Numbers & Proof Metrics */}
          <div>
            <h3 className="text-xs sm:text-sm font-sans uppercase font-bold tracking-wider text-cyan-900 mb-2.5">
              Verified Mechanical Engineering Impact Metrics
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
                <div className="text-2xl font-bold font-sans text-cyan-900">-41.8%</div>
                <div className="text-sm text-slate-900 font-bold mt-0.5">Airborne Gimbal Mass</div>
                <div className="text-xs text-slate-600 font-sans">1,420g → 826g (Ansys)</div>
              </div>
              <div className="p-4 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
                <div className="text-2xl font-bold font-sans text-cyan-900">115 N·m</div>
                <div className="text-sm text-slate-900 font-bold mt-0.5">Peak Actuator Torque</div>
                <div className="text-xs text-slate-600 font-sans">&lt;6 arcsec backlash</div>
              </div>
              <div className="p-4 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
                <div className="text-2xl font-bold font-sans text-cyan-900">$120k+</div>
                <div className="text-sm text-slate-900 font-bold mt-0.5">DFM Tooling Savings</div>
                <div className="text-xs text-slate-600 font-sans">Cycle times cut by 58%</div>
              </div>
              <div className="p-4 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
                <div className="text-2xl font-bold font-sans text-cyan-900">±0.005mm</div>
                <div className="text-sm text-slate-900 font-bold mt-0.5">Machining Precision</div>
                <div className="text-xs text-slate-600 font-sans">ASME Y14.5 MMC GD&amp;T</div>
              </div>
            </div>
          </div>

          {/* Engineering Proof Highlights */}
          <div>
            <h3 className="text-xs sm:text-sm font-sans uppercase font-bold tracking-wider text-cyan-900 mb-2.5">
              Verified Mechanical Engineering Capabilities
            </h3>
            <div className="p-4 rounded-xl bg-white border border-[#cbd5e1] space-y-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">
                Precision 3D CAD Modeling, Multi-Axis DFM &amp; Metrology Verification
              </p>
              <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                Full technical documentation, GD&amp;T drawings (ASME Y14.5), and interactive 3D WebGL assembly inspection tools available in the Engineering Hub &amp; Case Studies.
              </p>
            </div>
          </div>

          {/* Quick Technical Interview Booking / Direct Inquiry */}
          <div className="p-5 rounded-xl bg-[#e2e8f0] border border-[#b8c6d4] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
            <div>
              <h4 className="text-base font-bold text-slate-950 font-sans">Ready to move to technical phone screen?</h4>
              <p className="text-sm text-slate-700 mt-0.5">
                Send an intro or reach out directly at <strong className="text-cyan-950 font-bold">festusjohnson028@gmail.com</strong>
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
              <button
                onClick={handleCopyEmail}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-sm font-sans font-semibold bg-white hover:bg-slate-100 text-slate-900 border border-[#b8c6d4] transition-colors cursor-pointer"
              >
                {copiedEmail ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-700" />}
                <span>{copiedEmail ? 'Email Copied!' : 'Copy Email'}</span>
              </button>

              <a
                href="mailto:festusjohnson028@gmail.com?subject=Technical%20Interview%20Inquiry%20%E2%80%94%20Mechanical%20Engineering%20Role&body=Hi%20Festus%2C%0A%0AWe%20reviewed%20your%20Fesline%20portfolio%20and%20would%20like%20to%20schedule%20a%20technical%20screen%20for%20our%20mechanical%20engineering%20team.%0A%0ABest%20regards%2C"
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-sans font-semibold bg-cyan-700 hover:bg-cyan-800 text-white transition-colors cursor-pointer shadow"
              >
                <Mail className="w-4 h-4" />
                <span>Email Direct</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
