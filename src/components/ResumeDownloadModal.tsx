import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Printer,
  Copy,
  Check,
  ShieldCheck,
  Mail,
  MapPin,
  Award,
  GraduationCap,
  Briefcase,
  Layers,
} from 'lucide-react';
import { generateAndDownloadResume, categorizeSkills } from '../utils/generateResumePdf';
import { getStoredBio, getStoredDocuments } from '../utils/profileState';

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

  // Dynamically load profile bio and documents
  const bio = useMemo(() => getStoredBio(), [isOpen]);
  const docs = useMemo(() => getStoredDocuments(), [isOpen]);
  const categorizedSkills = useMemo(() => categorizeSkills(bio.skills), [bio.skills]);

  if (!isOpen) return null;

  const handlePrint = () => {
    onDownloaded();
    window.print();
  };

  const handleDownloadPdf = () => {
    setDownloading(true);
    try {
      generateAndDownloadResume({
        fullName: bio.fullName || 'Festus, Olorunsogo Johnson',
        header:
          bio.header ||
          'Lead Mechanical Design Engineer · Precision Mechanisms, Flight Gimbals & FEA Topology',
        email: bio.email || 'festusjohnson028@gmail.com',
        country: bio.country || 'United States',
        discipline:
          bio.discipline || 'Mechanical & Optomechanical Design Engineering',
        badges:
          bio.badges || 'Verified Engineer · CSWP · ASME GDTP Senior · FE EIT',
        degree: bio.degree || 'B.S. in Mechanical Engineering (BSME)',
        academicHonors:
          bio.academicHonors || 'ABET Accredited · Honors (GPA 3.84 / 4.00)',
        leadership:
          bio.leadership ||
          'Lead Mechanical Hardware Engineer · Airborne Gimbal Mechanism Lead',
        skills:
          bio.skills ||
          'SolidWorks (CSWP/CSWE), PTC Creo, Autodesk Inventor, Siemens NX, Fusion 360, AutoCAD Mechanical, Design Calculation, CNC Machine, Laser Engraver/Cutter, 3D Animation, 3D Maxs, React.js & Full-Stack Web Development, Web Developer, C/C++, IT, AI & Machine Learning, Cybersecurity, Graphic Design, Microsoft Office',
        description:
          bio.description ||
          'Lead Mechanical Design Engineer with 6+ years of specialized experience in high-precision hardware mechanisms, complex flight-rated assemblies, and mission-critical robotic systems.',
        documents:
          docs.length > 0
            ? docs.map((d: any) => ({
                title: d.title,
                issuer: d.issuer,
                id: d.credentialId || d.id,
                date: d.date,
                description: d.description,
                competencies: d.competencies || [],
              }))
            : undefined,
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
    const skillsText = categorizedSkills
      .map((cat) => `• ${cat.category}: ${cat.skills.join('  •  ')}`)
      .join('\n');

    const text = `
${(bio.fullName || 'FESTUS JOHNSON').toUpperCase()} — ${bio.header || 'LEAD MECHANICAL DESIGN ENGINEER'}
Email: ${bio.email || 'festusjohnson028@gmail.com'} | Location: ${bio.country || 'United States'}
Discipline: ${bio.discipline || 'Mechanical Design'} | Credentials: ${bio.badges || 'CSWP, ASME GDTP, FE EIT'}

PROFESSIONAL SUMMARY:
${bio.description || 'Lead Mechanical Design Engineer with 6+ years of specialized experience in high-precision hardware mechanisms.'}

TECHNICAL SKILLS & CORE COMPETENCIES:
${skillsText}

EDUCATION:
${bio.degree || 'B.S. in Mechanical Engineering (BSME)'} — ${bio.academicHonors || 'ABET Accredited'}

LEADERSHIP & APPOINTMENTS:
${bio.leadership || 'Lead Mechanical Hardware Engineer'}

VERIFIED CREDENTIALS:
${docs.map((d: any) => `- ${d.title} (${d.issuer || 'Verified Body'} | ID: ${d.credentialId || d.id})`).join('\n')}
`.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#edf2f8] border border-[#b8c6d4] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-serif">
        {/* Modal Header Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#b8c6d4] bg-[#dce2e9] shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-800" />
            <h3 className="text-base sm:text-lg font-bold text-slate-950 font-sans">
              Verified Professional Resume
            </h3>
            <span className="text-xs font-sans font-bold text-cyan-900 bg-cyan-100 border border-cyan-300 px-2.5 py-0.5 rounded">
              Times New Roman · 11.4pt PDF (-5%)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold bg-[#e2e8f0] hover:bg-white text-slate-800 border border-[#b8c6d4] transition-colors cursor-pointer"
              title="Copy Plaintext / Markdown format for ATS"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold bg-cyan-700 hover:bg-cyan-800 text-white shadow transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Formatting...' : 'Download PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-white transition-colors ml-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Formatted Times New Roman Document Preview (Reduced by 5%) */}
        <div className="flex-1 overflow-y-auto p-7 sm:p-10 bg-white text-slate-900 font-serif leading-relaxed space-y-5 shadow-inner">
          {/* Header Block */}
          <div className="border-b-2 border-slate-900 pb-3.5">
            <h1 className="text-[22px] sm:text-[26px] font-bold uppercase tracking-wide text-slate-950">
              {bio.fullName || 'Festus, Olorunsogo Johnson'}
            </h1>
            <p className="text-[14px] sm:text-[15px] italic text-slate-800 mt-1">
              {bio.header ||
                'Lead Mechanical Design Engineer · Precision Mechanisms, Flight Gimbals & FEA Topology'}
            </p>
            <div className="text-[12.5px] sm:text-[13.5px] text-slate-700 mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {bio.email && <span>Email: {bio.email}</span>}
              {bio.country && <span>| Location: {bio.country}</span>}
              {bio.discipline && <span>| Discipline: {bio.discipline}</span>}
              {bio.badges && <span>| Credentials: {bio.badges}</span>}
            </div>
          </div>

          {/* 1. Summary */}
          <div>
            <h2 className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
              Professional Summary &amp; Engineering Philosophy
            </h2>
            <div className="text-[14px] sm:text-[15px] text-slate-800 leading-relaxed whitespace-pre-line text-justify">
              {bio.description ||
                'Lead Mechanical Design Engineer with 6+ years of specialized experience in high-precision hardware mechanisms, complex flight-rated assemblies, and mission-critical robotic systems.'}
            </div>
          </div>

          {/* 2. Technical Skills & Core Competencies (Categorized from Screenshot) */}
          <div>
            <h2 className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
              Technical Skills &amp; Core Competencies
            </h2>
            <div className="space-y-1.5 text-[13.5px] sm:text-[14.5px] text-slate-800 leading-relaxed">
              {categorizedSkills.map((cat, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                  <span className="font-bold text-slate-950 shrink-0">• {cat.category}:</span>
                  <span className="text-slate-800">{cat.skills.join('  •  ')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Education */}
          <div>
            <h2 className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
              Education &amp; Academic Accreditations
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between text-[14px] sm:text-[15px]">
              <div>
                <strong className="font-bold text-slate-950">
                  {bio.degree || 'Bachelor of Science in Mechanical Engineering (BSME)'}
                </strong>
                {bio.academicHonors && (
                  <span className="italic text-slate-700 ml-2">
                    — {bio.academicHonors}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 4. Leadership */}
          {bio.leadership && (
            <div>
              <h2 className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                Leadership &amp; Key Appointments
              </h2>
              <p className="text-[14px] sm:text-[15px] text-slate-800 leading-relaxed">
                {bio.leadership}
              </p>
            </div>
          )}

          {/* 5. Verified Credentials & Documents */}
          {docs.length > 0 && (
            <div>
              <h2 className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1 mb-2">
                Verified Credentials &amp; Engineering Documents
              </h2>
              <div className="space-y-3.5">
                {docs.map((d: any, idx: number) => (
                  <div key={d.id || idx} className="text-[13.5px] sm:text-[14.5px]">
                    <div className="flex items-baseline justify-between">
                      <strong className="text-slate-950 font-bold">
                        {idx + 1}. {d.title}
                      </strong>
                      <span className="italic text-xs text-slate-600">
                        {d.date || 'Verified'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 italic">
                      Issuer: {d.issuer || 'Accredited Body'}{' '}
                      {d.credentialId ? `| Credential ID: ${d.credentialId}` : ''}
                    </div>
                    {d.description && (
                      <p className="text-slate-800 mt-1 leading-normal text-[13px] sm:text-[14px]">
                        {d.description}
                      </p>
                    )}
                    {d.competencies && d.competencies.length > 0 && (
                      <p className="text-xs text-slate-600 italic mt-0.5">
                        Competencies: {d.competencies.join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3.5 border-t border-[#b8c6d4] bg-[#dce2e9] flex items-center justify-between text-xs sm:text-sm text-slate-700 font-sans shrink-0">
          <span>
            Direct Recruiter Verification:{' '}
            <a
              href={`mailto:${bio.email || 'festusjohnson028@gmail.com'}`}
              className="text-cyan-900 font-bold hover:underline"
            >
              {bio.email || 'festusjohnson028@gmail.com'}
            </a>
          </span>
          <span className="text-xs text-slate-500">
            Professional Times New Roman Format
          </span>
        </div>
      </div>
    </div>
  );
};
