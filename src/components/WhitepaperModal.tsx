import React, { useState } from 'react';
import { X, Download, Printer, FileText, CheckCircle2, ShieldAlert, Award } from 'lucide-react';
import { Project } from '../types/portfolio';

interface WhitepaperModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WhitepaperModal: React.FC<WhitepaperModalProps> = ({
  project,
  isOpen,
  onClose,
}) => {
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen || !project) return null;

  const handlePrint = () => {
    setDownloaded(true);
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#edf2f8] border border-[#b8c6d4] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col font-serif">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#dce2e9] border-b border-[#b8c6d4] shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-800" />
            <h3 className="text-base sm:text-lg font-bold text-slate-950 font-sans">Engineering Calculation Whitepaper</h3>
            <span className="text-xs font-sans font-bold text-cyan-900 bg-cyan-100 border border-cyan-300 px-2.5 py-0.5 rounded">
              {project.calculationWhitepaper.docRef}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-sans font-semibold bg-cyan-700 hover:bg-cyan-800 text-white transition-colors cursor-pointer shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloaded ? 'Downloaded' : 'Print / Save PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white text-slate-800 text-base leading-relaxed space-y-6">
          <div className="border-b border-[#cbd5e1] pb-4">
            <div className="text-xs sm:text-sm font-sans font-bold text-cyan-900 mb-1">
              FESLINE MECHANICAL RESEARCH &amp; DESIGN LAB · {project.calculationWhitepaper.date}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
              {project.calculationWhitepaper.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs sm:text-sm font-sans text-slate-600">
              <span>Author: Festus Johnson (CSWP, Lead MechE)</span>
              <span>·</span>
              <span>Document Ref: {project.calculationWhitepaper.docRef}</span>
              <span>·</span>
              <span>Pages: {project.calculationWhitepaper.pages}</span>
            </div>
          </div>

          {/* Abstract */}
          <div className="p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-cyan-900 font-sans mb-1.5">
              Executive Abstract
            </h2>
            <p className="text-base sm:text-lg text-slate-700 leading-relaxed font-serif">
              {project.calculationWhitepaper.abstract}
            </p>
          </div>

          {/* Key Findings */}
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 font-sans mb-2 border-b border-[#cbd5e1] pb-1">
              Empirical Findings &amp; Analytical Corroboration
            </h2>
            <ul className="space-y-2 mt-2">
              {project.calculationWhitepaper.keyFindings.map((finding, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-base sm:text-lg text-slate-700">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-1" />
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Hand Calculation Methodology Snippet */}
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 font-sans mb-2 border-b border-[#cbd5e1] pb-1">
              Governing Mathematical Formulation
            </h2>
            <div className="space-y-3.5">
              {project.handCalculations.map((calc, i) => (
                <div key={i} className="p-4 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] text-sm">
                  <div className="font-bold text-slate-950 font-serif text-base mb-1">{calc.title}</div>
                  <div className="font-mono text-cyan-950 font-bold bg-white border border-[#cbd5e1] px-3 py-2 rounded-lg mb-2 overflow-x-auto text-sm">
                    {calc.formula}
                  </div>
                  <div className="text-slate-600 font-sans text-xs sm:text-sm mb-2">{calc.variables}</div>
                  <div className="text-emerald-800 font-bold font-sans">{calc.outcome}</div>
                </div>
              ))}
            </div>
          </div>

          {/* IP / NDA Compliance Notice */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 flex items-start gap-3 text-sm text-amber-950 shadow-xs">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-900 font-bold font-sans block mb-0.5">IP &amp; NDA Compliance Disclaimer</strong>
              <p className="font-serif leading-relaxed">{project.ipComplianceDisclaimer}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#b8c6d4] bg-[#dce2e9] flex items-center justify-between text-xs sm:text-sm text-slate-700 font-sans shrink-0">
          <span>Author: Festus Johnson · Fesline Portfolio</span>
          <span className="font-semibold">Verified Engineering Artifact</span>
        </div>
      </div>
    </div>
  );
};
