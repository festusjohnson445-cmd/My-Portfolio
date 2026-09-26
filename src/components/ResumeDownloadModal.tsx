import React, { useState } from 'react';
import { X, Download, Printer, Copy, Check, ExternalLink, ShieldCheck, Mail, Phone, MapPin, Award } from 'lucide-react';
import { generateAndDownloadResume } from '../utils/generateResumePdf';

interface ResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloaded: () => void;
}

export const ResumeDownloadModal: React.FC<ResumeModalProps> = ({
  isOpen,
  onClose,
  onDownloaded,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    onDownloaded();
    window.print();
  };

  const handleDownloadPdf = () => {
    setDownloading(true);
    try {
      const savedBio = localStorage.getItem('fesline_custom_profile_bio');
      const savedDocs = localStorage.getItem('fesline_custom_documents');

      let parsedBio: any = {};
      let parsedDocs: any[] = [];

      if (savedBio) parsedBio = JSON.parse(savedBio);
      if (savedDocs) parsedDocs = JSON.parse(savedDocs);

      generateAndDownloadResume({
        fullName: parsedBio.fullName || 'Festus, Olorunsogo Johnson',
        header: parsedBio.header || 'Lead Mechanical Design Engineer · Precision Mechanisms, Flight Gimbals & FEA Topology',
        email: parsedBio.email || 'festusjohnson028@gmail.com',
        country: parsedBio.country || 'United States',
        discipline: parsedBio.discipline || 'Mechanical & Optomechanical Design Engineering',
        badges: parsedBio.badges || 'Verified Engineer · CSWP · ASME GDTP Senior · FE EIT',
        degree: parsedBio.degree || 'B.S. in Mechanical Engineering (BSME)',
        academicHonors: parsedBio.academicHonors || 'ABET Accredited · Honors (GPA 3.84 / 4.00)',
        leadership: parsedBio.leadership || 'Lead Mechanical Hardware Engineer · Airborne Gimbal Mechanism Lead',
        skills: parsedBio.skills || 'SolidWorks (CSWP), PTC Creo, Ansys Workbench (Static / Modal / Thermal FEA), ASME Y14.5 GD&T, 5-Axis CNC Milling',
        description: parsedBio.description || 'Lead Mechanical Design Engineer with 6+ years of specialized experience in high-precision hardware mechanisms, complex flight-rated assemblies, and mission-critical robotic systems.',
        documents: parsedDocs.length > 0 ? parsedDocs.map((d: any) => ({
          title: d.title,
          issuer: d.issuer,
          id: d.credentialId || d.id,
          date: d.date,
          description: d.description,
          competencies: d.competencies || [],
        })) : undefined,
      });

      onDownloaded();
    } catch (e) {
      console.error('Error generating PDF resume', e);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyMarkdown = () => {
    const text = `
FESTUS JOHNSON — LEAD MECHANICAL DESIGN ENGINEER (CSWP, ASME GDTP)
Email: festusjohnson028@gmail.com | Portfolio: Fesline Engineering
Location: Available for Relocation & Remote (San Francisco / Seattle / Austin / Boston)
Availability: Full-time / Contract Q4 2026 | Clearance: US Authorized

SUMMARY:
Results-driven Mechanical Design Engineer with 6+ years of expertise in precision mechanism design, non-linear FEA, ASME Y14.5 GD&T, and 5-axis CNC DFM. Proven track record reducing aerospace gimbal mass by 41.8%, engineering 115 N·m zero-backlash robotic actuators, and delivering >$120k in direct DFM manufacturing savings.

CORE CREDENTIALS:
- Certified SolidWorks Professional (CSWP #C-7X8M9Q4K)
- ASME GDTP Geometric Dimensioning & Tolerancing Professional
- Fundamentals of Engineering (FE) Mechanical Exam (NCEES EIT)
- Mastercam 5-Axis Multi-Axis Programming Specialist

TECHNICAL SKILLS:
- CAD: SolidWorks (Expert), PTC Creo, Autodesk Inventor, Onshape, Complex Surfacing, Large Assemblies
- FEA & Physics: Ansys Workbench (Static Structural, Modal, Transient Thermal), SolidWorks Simulation, Abaqus
- Fabrication & DFM: 5-Axis CNC Milling (Haas/Mastercam), Wire EDM, Mill-Turn, DMLS Metal 3D Printing, Sheet Metal
- Metrology: ASME Y14.5-2018 GD&T, CMM Probing (Zeiss Calypso), Surface Profilometry (Ra/Rz), Optical Comparators
- Computation: Python (NumPy/SciPy FEA scripts, Monte Carlo Stacks), MATLAB & Simulink, C/C++ Embedded Motor Control

HIGHLIGHTED ENGINEERING PROJECTS:
1. AeroMount-7075: 5-Axis Optical Gimbal Yoke (Lead Mechanical Design)
   - Reduced mass by 41.8% (1,420g to 826g) using topology optimization while maintaining SF = 2.45 under 12g shock.
   - Raised fundamental natural resonance from 180 Hz to 342 Hz, decoupling from rotor vibrations.
   - Reduced machining cycle time from 115 min to 48 min on Haas 5-axis UMC-750, saving $385/unit at 1,000 units.

EDUCATION:
- B.S. in Mechanical Engineering, ABET Accredited (Honors / GPA 3.84)
`.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#edf2f8] border border-[#b8c6d4] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-serif">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#b8c6d4] bg-[#dce2e9] shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-800" />
            <h3 className="text-base sm:text-lg font-bold text-slate-950 font-sans">Verified Engineering Resume</h3>
            <span className="text-xs font-sans font-bold text-cyan-900 bg-cyan-100 border border-cyan-300 px-2.5 py-0.5 rounded">
              PDF / Print Ready
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold bg-[#e2e8f0] hover:bg-white text-slate-800 border border-[#b8c6d4] transition-colors cursor-pointer"
              title="Copy Plaintext / Markdown format for ATS"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy ATS Text'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold bg-[#e2e8f0] hover:bg-white text-slate-800 border border-[#b8c6d4] transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-sans font-semibold bg-cyan-700 hover:bg-cyan-800 text-white shadow transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Preparing...' : 'Download PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-white transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Resume Canvas */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white text-slate-800 text-base leading-relaxed space-y-6 print:bg-white print:text-black">
          {/* Header */}
          <div className="border-b border-[#cbd5e1] pb-5">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 print:text-black">
                  Festus Johnson
                </h1>
                <p className="text-cyan-900 font-sans font-bold text-sm sm:text-base print:text-cyan-800">
                  Lead Mechanical Design Engineer · CSWP · ASME GDTP
                </p>
              </div>
              <div className="text-sm font-sans text-slate-700 space-y-1 sm:text-right print:text-slate-600">
                <div className="flex items-center sm:justify-end gap-1.5">
                  <Mail className="w-4 h-4 text-cyan-800 print:hidden" />
                  <a href="mailto:festusjohnson028@gmail.com" className="hover:underline text-cyan-900 font-semibold print:text-black">
                    festusjohnson028@gmail.com
                  </a>
                </div>
                <div className="flex items-center sm:justify-end gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-500 print:hidden" />
                  <span>Relocation: SF / Seattle / Austin / Boston / Remote</span>
                </div>
                <div className="flex items-center sm:justify-end gap-1.5 text-emerald-800 font-bold print:text-emerald-700">
                  <span>● Available: Q4 2026 (Immediate / 2-Week Notice)</span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-base sm:text-lg text-slate-700 print:text-slate-700 leading-normal">
              Senior-level mechanical design engineer specializing in high-precision mechanism architecture, non-linear structural/thermal FEA, ASME Y14.5 GD&amp;T tolerance allocation, and 5-axis CNC DFM/DFA. Recognized for combining analytical first-principles mechanics with hands-on machining fluency. Total quantifiable DFM savings of <strong className="text-slate-950 font-bold print:text-black">$120k+</strong> across flight-ready aerospace and robotics systems.
            </p>
          </div>

          {/* Credentials Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 px-4 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] text-sm font-sans print:bg-slate-100 print:border-slate-300">
            <div>
              <span className="text-slate-500 block text-xs uppercase font-bold">SolidWorks</span>
              <strong className="text-cyan-900 font-bold print:text-black">CSWP Professional</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-xs uppercase font-bold">Tolerancing</span>
              <strong className="text-cyan-900 font-bold print:text-black">ASME GDTP Senior</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-xs uppercase font-bold">Engineering Board</span>
              <strong className="text-cyan-900 font-bold print:text-black">FE Mechanical Exam</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-xs uppercase font-bold">Manufacturing</span>
              <strong className="text-cyan-900 font-bold print:text-black">5-Axis CAM Certified</strong>
            </div>
          </div>

          {/* Key Mechanical Engineering Projects */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b border-[#cbd5e1] pb-1.5 mb-3 font-sans">
              Selected Mechanical Engineering Case Studies
            </h2>

            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between text-base sm:text-lg">
                  <h3 className="font-bold text-slate-950 print:text-black">
                    AeroMount-7075: 5-Axis Lightweight Optical Gimbal Yoke
                  </h3>
                  <span className="text-xs sm:text-sm font-sans text-slate-600">Lead Mechanical &amp; DFM</span>
                </div>
                <ul className="mt-1.5 text-sm sm:text-base text-slate-700 list-disc list-inside space-y-1 print:text-slate-700">
                  <li>Formulated topology optimization in Ansys, slashing mass by <strong className="text-slate-950 font-bold print:text-black">41.8% (1,420g to 826g)</strong> while maintaining SF = 2.45 under 12g limit shock loads.</li>
                  <li>Synthesized Rayleigh-Ritz and FEA modal dynamics to elevate structural resonance to 342 Hz, safely bypassing UAV 180 Hz propeller harmonics.</li>
                  <li>Authored ASME Y14.5-2018 drawings with MMC position tolerances (±0.012mm) and optimized Haas 5-axis UMC-750 toolpaths, cutting cycle time from 115m to 48m (-$385/unit DFM savings).</li>
                </ul>
              </div>


            </div>
          </div>

          {/* Technical Skills & Machinery */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b border-[#cbd5e1] pb-1.5 mb-2 font-sans">
              Technical Skill Matrix &amp; Machine Proficiencies
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm sm:text-base">
              <div>
                <span className="font-bold text-slate-950 print:text-black">CAD &amp; Modeling:</span>{' '}
                <span className="text-slate-700 print:text-slate-700">SolidWorks (CSWP), PTC Creo, Autodesk Inventor, Onshape, Complex Surfacing, Large Assemblies.</span>
              </div>
              <div>
                <span className="font-bold text-slate-950 print:text-black">FEA &amp; Physics:</span>{' '}
                <span className="text-slate-700 print:text-slate-700">Ansys Workbench (Static Structural, Modal, Transient Thermal), SolidWorks Simulation, Abaqus, CFD.</span>
              </div>
              <div>
                <span className="font-bold text-slate-950 print:text-black">Machining &amp; CAM:</span>{' '}
                <span className="text-slate-700 print:text-slate-700">5-Axis CNC Milling (Haas/Mastercam), Wire EDM, Mill-Turn Live Tooling, DMLS Metal 3D Printing.</span>
              </div>
              <div>
                <span className="font-bold text-slate-950 print:text-black">Metrology &amp; Standards:</span>{' '}
                <span className="text-slate-700 print:text-slate-700">ASME Y14.5-2018 GD&amp;T, CMM Probing (Zeiss Calypso), Surface Profilometry (Ra/Rz), Gauge Blocks.</span>
              </div>
            </div>
          </div>

          {/* Education */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 border-b border-[#cbd5e1] pb-1.5 mb-2 font-sans">
              Education &amp; Academic Foundation
            </h2>
            <div className="flex items-baseline justify-between text-sm sm:text-base">
              <div>
                <strong className="text-slate-950 font-bold print:text-black">Bachelor of Science in Mechanical Engineering (BSME)</strong>
                <span className="text-slate-600 block text-xs sm:text-sm font-sans">ABET Accredited · Mechanical Design &amp; Computational Mechanics Concentration</span>
              </div>
              <div className="text-right font-sans text-slate-600 text-xs sm:text-sm">
                <span className="font-semibold">Honors (GPA: 3.84 / 4.00)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3.5 border-t border-[#b8c6d4] bg-[#dce2e9] flex items-center justify-between text-xs sm:text-sm text-slate-700 font-sans shrink-0">
          <span>Direct recruiter inquiry: <a href="mailto:festusjohnson028@gmail.com" className="text-cyan-900 font-bold hover:underline">festusjohnson028@gmail.com</a></span>
          <span className="text-xs text-slate-500">SHA-256 Verified · Fesline Portfolio</span>
        </div>
      </div>
    </div>
  );
};
