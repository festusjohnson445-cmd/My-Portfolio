import React, { useState, useMemo, useEffect } from 'react';
import { X, Download, Printer, Copy, Check } from 'lucide-react';
import { generateAndDownloadResume, categorizeSkills } from '../utils/generateResumePdf';
import { resolveSkillStatus, formatSkillStatusLabel } from '../data/skillsData';
import { getStoredBio, getStoredDocuments } from '../utils/profileState';
import {
  fetchExperiencesFromSupabase,
  fetchPublicationsFromSupabase,
  fetchAchievementsFromSupabase,
  type ProfileExperience,
  type ProfilePublication,
  type ProfileAchievement,
} from '../utils/portfolioSupabase';

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

  const bio = useMemo(() => getStoredBio(), [isOpen]);
  const docs = useMemo(() => getStoredDocuments(), [isOpen]);
  const categorizedSkills = useMemo(() => categorizeSkills(bio.skills), [bio.skills]);

  const [experiences, setExperiences] = useState<ProfileExperience[]>(() =>
    Array.isArray(bio.experiences) ? bio.experiences : []
  );
  const [publications, setPublications] = useState<ProfilePublication[]>(() =>
    Array.isArray(bio.publications) ? bio.publications : []
  );
  const [achievements, setAchievements] = useState<ProfileAchievement[]>(() =>
    Array.isArray(bio.achievements) ? bio.achievements : []
  );

  useEffect(() => {
    if (!isOpen) return;
    Promise.all([
      fetchExperiencesFromSupabase(),
      fetchPublicationsFromSupabase(),
      fetchAchievementsFromSupabase(),
    ]).then(([exps, pubs, achs]) => {
      if (exps.length > 0) setExperiences(exps);
      else if (Array.isArray(bio.experiences)) setExperiences(bio.experiences);

      if (pubs.length > 0) setPublications(pubs);
      else if (Array.isArray(bio.publications)) setPublications(bio.publications);

      if (achs.length > 0) setAchievements(achs);
      else if (Array.isArray(bio.achievements)) setAchievements(bio.achievements);
    });
  }, [isOpen, bio.experiences, bio.publications, bio.achievements]);

  if (!isOpen) return null;

  const certifiedSet = new Set((bio.certifiedSkills || []).map((s) => s.toLowerCase()));

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
        skills: bio.skills,
        certifiedSkills: bio.certifiedSkills || [],
        skillStatuses: bio.skillStatuses || {},
        description: bio.description,
        experiences,
        publications,
        achievements,
        documents: docs.map((d) => ({
          id: d.id,
          title: d.title,
          issuer: d.issuer,
          credentialId: d.credentialId,
          date: d.date,
          description: d.description,
          competencies: d.competencies || [],
          credentialGroup: d.credentialGroup,
          parentSpecializationId: d.parentSpecializationId,
        })),
      });
      onDownloaded();
    } catch (e) {
      console.error('Error generating PDF resume', e);
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyText = () => {
    const text = [
      `${(bio.fullName || 'FESTUS JOHNSON').toUpperCase()} — ${bio.header}`,
      `Email: ${bio.email} | Location: ${bio.country} | Discipline: ${bio.discipline}`,
      `\nBIO & ABOUT:\n${bio.description}`,
      experiences.length
        ? `\nEXPERIENCE & CAREER:\n${experiences
            .map((e) => `- ${e.roleTitle} at ${e.organization} (${e.startDate} - ${e.isCurrent ? 'Present' : e.endDate}): ${e.summary}`)
            .join('\n')}`
        : '',
      publications.length
        ? `\nRESEARCH & PUBLICATIONS:\n${publications
            .map((p) => `- ${p.title} (${p.venueOrJournal}, ${p.year})`)
            .join('\n')}`
        : '',
      achievements.length
        ? `\nACHIEVEMENTS & AWARDS:\n${achievements
            .map((a) => `- ${a.title} (${a.issuer}, ${a.dateStr})`)
            .join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#edf2f8] border border-[#b8c6d4] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-serif">
        {/* Top Controls */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-[#b8c6d4] bg-[#dce2e9] shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-700" />
            <span className="text-[11px] font-semibold text-slate-800">Resume Preview</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopyText}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#e2e8f0] hover:bg-white text-slate-800 border border-[#b8c6d4] transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#e2e8f0] hover:bg-white text-slate-800 border border-[#b8c6d4] transition-colors cursor-pointer"
            >
              <Printer className="w-3 h-3 text-slate-600" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={downloading}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-semibold bg-cyan-800 hover:bg-cyan-900 text-white shadow-2xs transition-colors cursor-pointer"
            >
              <Download className="w-3 h-3 text-cyan-200" />
              <span>{downloading ? 'Formatting...' : 'Download PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-white transition-colors cursor-pointer ml-1"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Times New Roman Resume Preview */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 bg-white text-slate-900 font-serif leading-relaxed space-y-3.5 shadow-inner">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-2.5 text-center sm:text-left">
            <h1 className="text-base sm:text-lg font-bold uppercase tracking-wide text-slate-950">
              {bio.fullName || 'Festus, Olorunsogo Johnson'}
            </h1>
            <p className="text-[11px] sm:text-xs italic text-slate-800 mt-0.5">{bio.header}</p>
            <div className="text-[10px] sm:text-[11px] text-slate-600 mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5 justify-center sm:justify-start">
              {bio.email && <span>Email: {bio.email}</span>}
              {bio.country && <span>| Location: {bio.country}</span>}
              {bio.discipline && <span>| Discipline: {bio.discipline}</span>}
              {bio.badges && <span>| Credentials: {bio.badges}</span>}
            </div>
          </div>

          {/* 1. Bio & About */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5 mb-1.5 text-center">
              Bio &amp; About
            </h2>
            <div className="text-[11px] sm:text-xs text-slate-800 leading-relaxed whitespace-pre-line text-justify">
              {bio.description}
            </div>
            {(bio.degree || bio.leadership) && (
              <div className="mt-2 pt-1.5 border-t border-slate-100 text-[10.5px] sm:text-[11px] text-slate-700 space-y-0.5">
                {bio.degree && (
                  <p>
                    <strong>Education:</strong> {bio.degree}
                    {bio.academicHonors ? ` — ${bio.academicHonors}` : ''}
                  </p>
                )}
                {bio.leadership && (
                  <p>
                    <strong>Leadership:</strong> {bio.leadership}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 2. Experience & Career */}
          {experiences.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5 mb-1.5 text-center">
                Experience &amp; Career
              </h2>
              <div className="space-y-2.5">
                {experiences.map((exp) => (
                  <div key={exp.id} className="text-[11px]">
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="text-slate-950">
                        {exp.roleTitle}
                        {exp.organization ? ` — ${exp.organization}` : ''}
                      </strong>
                      <span className="italic text-[10px] text-slate-600 shrink-0">
                        {exp.startDate}
                        {exp.isCurrent ? ' – Present' : exp.endDate ? ` – ${exp.endDate}` : ''}
                      </span>
                    </div>
                    {exp.location && <p className="italic text-[10px] text-slate-600">{exp.location}</p>}
                    {exp.summary && <p className="text-slate-800 mt-0.5">{exp.summary}</p>}
                    {exp.highlights && exp.highlights.length > 0 && (
                      <ul className="list-disc pl-4 mt-0.5 text-slate-700 space-y-0.5">
                        {exp.highlights.map((h, i) => (
                          <li key={i}>{h}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Research & Publications */}
          {publications.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5 mb-1.5 text-center">
                Research &amp; Publications
              </h2>
              <div className="space-y-2">
                {publications.map((pub, idx) => (
                  <div key={pub.id} className="text-[11px]">
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="text-slate-950">
                        {idx + 1}. {pub.title}
                      </strong>
                      {pub.year && <span className="italic text-[10px] text-slate-600">{pub.year}</span>}
                    </div>
                    <p className="italic text-[10px] text-slate-600">
                      {[pub.authors, pub.venueOrJournal, pub.doiOrUrl].filter(Boolean).join(' | ')}
                    </p>
                    {pub.abstract && <p className="text-slate-800 mt-0.5">{pub.abstract}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Achievements, Awards & Technical Skills */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5 mb-1.5 text-center">
              Achievements, Awards &amp; Skills
            </h2>
            {achievements.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {achievements.map((ach) => (
                  <div key={ach.id} className="text-[11px]">
                    <div className="flex items-baseline justify-between gap-2">
                      <strong className="text-slate-950">
                        • {ach.title}
                        {ach.issuer ? ` (${ach.issuer})` : ''}
                      </strong>
                      {ach.dateStr && <span className="italic text-[10px] text-slate-600">{ach.dateStr}</span>}
                    </div>
                    {ach.description && <p className="text-slate-700 pl-3">{ach.description}</p>}
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1 text-[10.5px] sm:text-[11px] text-slate-800">
              {categorizedSkills.map((cat, idx) => (
                <div key={idx}>
                  <strong className="text-slate-950">• {cat.category}:</strong>{' '}
                  {cat.skills
                    .map((s) => {
                      const st = resolveSkillStatus(s, bio.skillStatuses, bio.certifiedSkills);
                      return `${s} [${formatSkillStatusLabel(st)}]`;
                    })
                    .join(' • ')}
                </div>
              ))}
            </div>
          </div>

          {/* 5. Verified Credentials */}
          {docs.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5 mb-1.5 text-center">
                Verified Credentials
              </h2>
              <div className="space-y-2">
                {docs.map((d, idx) => (
                  <div key={d.id || idx} className="text-[11px]">
                    <div className="flex items-baseline justify-between">
                      <strong className="text-slate-950">
                        {idx + 1}. {d.title} {d.credentialGroup ? `[${d.credentialGroup}]` : ''}
                      </strong>
                      <span className="italic text-[10px] text-slate-600">{d.date || 'Verified'}</span>
                    </div>
                    <div className="text-[10px] text-slate-600 italic">
                      Issuer: {d.issuer} {d.credentialId ? `| ID: ${d.credentialId}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
