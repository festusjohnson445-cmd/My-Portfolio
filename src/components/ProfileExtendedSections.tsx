import React, { useState, useEffect, useRef } from 'react';
import {
  Briefcase,
  BookOpen,
  Award,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  FileText,
  Calendar,
  MapPin,
  Building,
  Upload,
  Loader2,
  CheckCircle2,
  X,
  Sparkles,
  GraduationCap,
  Wrench,
  Users,
  Code,
  ShieldCheck,
  ChevronRight,
  Download,
  Eye,
} from 'lucide-react';
import {
  ExperienceItem,
  PublicationItem,
  AchievementItem,
} from '../types/portfolio';
import { uploadMaterialToSupabaseBucket } from '../utils/supabase';
import {
  fetchExperiencesFromSupabase,
  upsertExperienceToSupabase,
  deleteExperienceFromSupabase,
  fetchPublicationsFromSupabase,
  upsertPublicationToSupabase,
  deletePublicationFromSupabase,
  fetchAchievementsFromSupabase,
  upsertAchievementToSupabase,
  deleteAchievementFromSupabase,
} from '../utils/portfolioSupabase';
import { renderPdfFirstPageToImage } from '../utils/pdfRenderer';
import { categorizeSkills, SkillCategoryName } from '../data/skillsData';

async function fetchExperienceFromSupabase(): Promise<ExperienceItem[]> {
  const rows = await fetchExperiencesFromSupabase();
  return rows.map((r) => ({
    id: r.id,
    title: r.roleTitle,
    role: r.roleTitle,
    company: r.organization,
    organization: r.organization,
    location: r.location,
    start_date: r.startDate,
    end_date: r.endDate,
    period: r.isCurrent ? `${r.startDate} – Present` : `${r.startDate}${r.endDate ? ` – ${r.endDate}` : ''}`,
    description: r.summary,
    highlights: r.highlights,
    key_responsibilities: r.highlights,
    order_index: r.sortOrder,
  }));
}

async function saveExperienceToSupabase(item: ExperienceItem): Promise<void> {
  await upsertExperienceToSupabase({
    id: item.id,
    roleTitle: item.role || item.title,
    organization: item.company || item.organization || '',
    location: item.location || '',
    startDate: item.start_date || item.period || '',
    endDate: item.end_date || '',
    isCurrent: Boolean(item.is_current),
    summary: item.description,
    highlights: item.highlights || item.key_responsibilities || [],
    sortOrder: item.order_index || 0,
  });
}

async function savePublicationToSupabase(item: PublicationItem): Promise<void> {
  await upsertPublicationToSupabase({
    id: item.id,
    title: item.title,
    venueOrJournal: item.journal_or_conference || item.publisher || '',
    year: item.publication_date || '',
    authors: item.authors || '',
    doiOrUrl: item.doi_or_url || item.doi_url || item.doi || '',
    abstract: item.abstract || '',
    category: 'Journal Article',
    attachmentUrl: item.document_url || item.pdf_url || item.file_url || '',
    sortOrder: item.order_index || 0,
  });
}

async function saveAchievementToSupabase(item: AchievementItem): Promise<void> {
  await upsertAchievementToSupabase({
    id: item.id,
    title: item.title,
    issuer: item.issuer || item.organization || item.issuer_or_organization || '',
    dateStr: item.date_awarded || item.award_date || '',
    category: item.category || item.badge_label || 'Award',
    description: item.description || '',
    certificateUrl: item.certificate_url || item.credential_url || '',
    verified: Boolean(item.verification_url || item.certificate_url),
    sortOrder: item.order_index || 0,
  });
}

async function fetchPublicationsAdapted(): Promise<PublicationItem[]> {
  const rows = await fetchPublicationsFromSupabase();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    authors: r.authors,
    publisher: r.venueOrJournal,
    journal_or_conference: r.venueOrJournal,
    publication_date: r.year,
    doi_or_url: r.doiOrUrl,
    abstract: r.abstract,
    document_url: r.attachmentUrl,
    pdf_url: r.attachmentUrl,
    order_index: r.sortOrder,
  }));
}

async function fetchAchievementsAdapted(): Promise<AchievementItem[]> {
  const rows = await fetchAchievementsFromSupabase();
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    issuer: r.issuer,
    organization: r.issuer,
    issuer_or_organization: r.issuer,
    category: r.category,
    badge_label: r.category,
    date_awarded: r.dateStr,
    description: r.description,
    certificate_url: r.certificateUrl,
    verification_url: r.certificateUrl,
    order_index: r.sortOrder,
  }));
}

interface ProfileExtendedSectionsProps {
  isOwnerAuthenticated: boolean;
  onRequireAuth: () => void;
  rawSkillsString: string;
}

export const ProfileExtendedSections: React.FC<ProfileExtendedSectionsProps> = ({
  isOwnerAuthenticated,
  onRequireAuth,
  rawSkillsString,
}) => {
  // Experience State
  const [experiences, setExperiences] = useState<ExperienceItem[]>([]);
  const [loadingExp, setLoadingExp] = useState(true);
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<ExperienceItem | null>(null);

  // Publications State
  const [publications, setPublications] = useState<PublicationItem[]>([]);
  const [loadingPub, setLoadingPub] = useState(true);
  const [isPubModalOpen, setIsPubModalOpen] = useState(false);
  const [editingPub, setEditingPub] = useState<PublicationItem | null>(null);

  // Achievements State
  const [achievements, setAchievements] = useState<AchievementItem[]>([]);
  const [loadingAch, setLoadingAch] = useState(true);
  const [isAchModalOpen, setIsAchModalOpen] = useState(false);
  const [editingAch, setEditingAch] = useState<AchievementItem | null>(null);

  // Notice
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  // Load from Supabase on mount
  useEffect(() => {
    fetchExperienceFromSupabase()
      .then((data) => setExperiences(data))
      .catch((err) => console.warn('Could not fetch experience:', err))
      .finally(() => setLoadingExp(false));

    fetchPublicationsAdapted()
      .then((data) => setPublications(data))
      .catch((err) => console.warn('Could not fetch publications:', err))
      .finally(() => setLoadingPub(false));

    fetchAchievementsAdapted()
      .then((data) => setAchievements(data))
      .catch((err) => console.warn('Could not fetch achievements:', err))
      .finally(() => setLoadingAch(false));
  }, []);

  // ----------------------------------------------------
  // Experience Handlers
  // ----------------------------------------------------
  const handleOpenAddExp = () => {
    if (!isOwnerAuthenticated) {
      onRequireAuth();
      return;
    }
    setEditingExp(null);
    setIsExpModalOpen(true);
  };

  const handleEditExp = (item: ExperienceItem) => {
    if (!isOwnerAuthenticated) {
      onRequireAuth();
      return;
    }
    setEditingExp(item);
    setIsExpModalOpen(true);
  };

  const handleDeleteExp = async (id: string) => {
    if (!isOwnerAuthenticated) {
      onRequireAuth();
      return;
    }
    if (!confirm('Are you sure you want to delete this career experience record?')) return;
    try {
      await deleteExperienceFromSupabase(id);
      setExperiences((prev) => prev.filter((e) => e.id !== id));
      showNotice('Experience record deleted successfully.');
    } catch (err: any) {
      alert('Delete failed: ' + (err.message || 'Error occurred'));
    }
  };

  // ----------------------------------------------------
  // Publications Handlers
  // ----------------------------------------------------
  const handleOpenAddPub = () => {
    if (!isOwnerAuthenticated) {
      onRequireAuth();
      return;
    }
    setEditingPub(null);
    setIsPubModalOpen(true);
  };

  const handleEditPub = (item: PublicationItem) => {
    if (!isOwnerAuthenticated) {
      onRequireAuth();
      return;
    }
    setEditingPub(item);
    setIsPubModalOpen(true);
  };

  const handleDeletePub = async (id: string) => {
    if (!isOwnerAuthenticated) {
      onRequireAuth();
      return;
    }
    if (!confirm('Are you sure you want to delete this publication record?')) return;
    try {
      await deletePublicationFromSupabase(id);
      setPublications((prev) => prev.filter((p) => p.id !== id));
      showNotice('Publication record deleted successfully.');
    } catch (err: any) {
      alert('Delete failed: ' + (err.message || 'Error occurred'));
    }
  };

  // ----------------------------------------------------
  // Achievements Handlers
  // ----------------------------------------------------
  const handleOpenAddAch = () => {
    if (!isOwnerAuthenticated) {
      onRequireAuth();
      return;
    }
    setEditingAch(null);
    setIsAchModalOpen(true);
  };

  const handleEditAch = (item: AchievementItem) => {
    if (!isOwnerAuthenticated) {
      onRequireAuth();
      return;
    }
    setEditingAch(item);
    setIsAchModalOpen(true);
  };

  const handleDeleteAch = async (id: string) => {
    if (!isOwnerAuthenticated) {
      onRequireAuth();
      return;
    }
    if (!confirm('Are you sure you want to delete this achievement record?')) return;
    try {
      await deleteAchievementFromSupabase(id);
      setAchievements((prev) => prev.filter((a) => a.id !== id));
      showNotice('Achievement record deleted successfully.');
    } catch (err: any) {
      alert('Delete failed: ' + (err.message || 'Error occurred'));
    }
  };

  return (
    <div className="space-y-8 font-serif text-slate-800">
      {notice && (
        <div className="fixed top-18 right-4 z-50 p-2.5 px-3.5 rounded-xl bg-slate-900 text-white border border-cyan-500/40 shadow-xl flex items-center gap-2 text-xs font-sans animate-fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. EXPERIENCE & CAREER SECTION                           */}
      {/* ======================================================== */}
      <section id="profile-experience" className="scroll-mt-20">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-xs space-y-3">
          {/* Section Header (Centered) */}
          <div className="border-b border-[#cbd5e1] pb-2.5 text-center flex flex-col items-center justify-center">
            <span className="text-[9.5px] sm:text-[10px] font-sans font-bold text-cyan-900 uppercase tracking-wider bg-cyan-100 border border-cyan-300 px-2 py-0.5 rounded-full shadow-2xs inline-block">
              CAREER &amp; EMPLOYMENT
            </span>
            <h2 className="text-xs sm:text-sm md:text-[14.5px] font-bold text-slate-950 mt-1 font-serif text-center">
              Experience &amp; Career
            </h2>
            <p className="text-[10.5px] sm:text-[11px] text-slate-600 mt-0.5 text-center leading-relaxed max-w-lg">
              Professional history, hardware development leadership, mechanism engineering, and industry tenures.
            </p>

            {isOwnerAuthenticated && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleOpenAddExp}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-[10.5px] font-sans font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3 h-3 text-cyan-200" />
                  <span>+ Add Experience</span>
                </button>
              </div>
            )}
          </div>

          {/* Loading / Content */}
          {loadingExp ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500 font-sans">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-700" />
              <span>Loading career history...</span>
            </div>
          ) : experiences.length === 0 ? (
            <div className="p-6 rounded-xl bg-white border border-dashed border-[#b8c6d4] text-center space-y-2">
              <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center mx-auto text-cyan-800">
                <Briefcase className="w-4 h-4" />
              </div>
              <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 font-serif text-center">
                No Career Experience Records Yet
              </h4>
              <p className="text-[10.5px] text-slate-600 max-w-md mx-auto text-center leading-relaxed">
                {isOwnerAuthenticated
                  ? 'Click "+ Add Experience" above to post your engineering roles, companies, responsibilities, and achievements.'
                  : 'Career and professional engineering experience records will appear here once published.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {experiences.map((exp) => (
                <div
                  key={exp.id}
                  className="p-3 sm:p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-cyan-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1.5 border-b border-slate-100 pb-1.5">
                      <div>
                        <h3 className="text-xs sm:text-[12.5px] font-bold text-slate-950 font-serif">
                          {exp.role || exp.title}
                        </h3>
                        <p className="text-[10.5px] font-sans font-semibold text-cyan-900 flex items-center gap-1">
                          <Building className="w-2.5 h-2.5 text-cyan-700 shrink-0" />
                          <span>{exp.company}</span>
                        </p>
                      </div>

                      {isOwnerAuthenticated && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditExp(exp)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-cyan-800 transition-colors cursor-pointer"
                            title="Edit experience"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteExp(exp.id)}
                            className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete experience"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[9.5px] font-sans text-slate-500">
                      <span className="inline-flex items-center gap-0.5">
                        <Calendar className="w-2.5 h-2.5 text-slate-400" />
                        <span>{exp.period || exp.start_date}</span>
                      </span>
                      {exp.location && (
                        <span className="inline-flex items-center gap-0.5">
                          <MapPin className="w-2.5 h-2.5 text-slate-400" />
                          <span>{exp.location}</span>
                        </span>
                      )}
                    </div>

                    {exp.description && (
                      <p className="text-[10.5px] text-slate-700 font-serif text-justify leading-relaxed whitespace-pre-line pt-1">
                        {exp.description}
                      </p>
                    )}

                    {(exp.highlights || exp.key_responsibilities || []).length > 0 && (
                      <ul className="space-y-0.5 pt-1 text-[10px] text-slate-700 font-serif list-disc list-inside">
                        {(exp.highlights || exp.key_responsibilities || []).map((hl: string, i: number) => (
                          <li key={i} className="text-justify leading-relaxed">
                            {hl}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. RESEARCH & PUBLICATIONS SECTION                       */}
      {/* ======================================================== */}
      <section id="profile-publications" className="scroll-mt-20">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-xs space-y-3">
          {/* Section Header (Centered) */}
          <div className="border-b border-[#cbd5e1] pb-2.5 text-center flex flex-col items-center justify-center">
            <span className="text-[9.5px] sm:text-[10px] font-sans font-bold text-cyan-900 uppercase tracking-wider bg-cyan-100 border border-cyan-300 px-2 py-0.5 rounded-full shadow-2xs inline-block">
              SCHOLARLY &amp; APPLIED RESEARCH
            </span>
            <h2 className="text-xs sm:text-sm md:text-[14.5px] font-bold text-slate-950 mt-1 font-serif text-center">
              Research &amp; Publications
            </h2>
            <p className="text-[10.5px] sm:text-[11px] text-slate-600 mt-0.5 text-center leading-relaxed max-w-lg">
              Peer-reviewed technical whitepapers, applied mechanical research, CAD methodology, and conference proceedings.
            </p>

            {isOwnerAuthenticated && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleOpenAddPub}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-[10.5px] font-sans font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3 h-3 text-cyan-200" />
                  <span>+ Add Publication</span>
                </button>
              </div>
            )}
          </div>

          {/* Loading / Content */}
          {loadingPub ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500 font-sans">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-700" />
              <span>Loading research publications...</span>
            </div>
          ) : publications.length === 0 ? (
            <div className="p-6 rounded-xl bg-white border border-dashed border-[#b8c6d4] text-center space-y-2">
              <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center mx-auto text-cyan-800">
                <BookOpen className="w-4 h-4" />
              </div>
              <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 font-serif text-center">
                No Research or Publications Uploaded Yet
              </h4>
              <p className="text-[10.5px] text-slate-600 max-w-md mx-auto text-center leading-relaxed">
                {isOwnerAuthenticated
                  ? 'Click "+ Add Publication" above to upload your technical reports, journal papers, or research whitepapers with first-page thumbnail rendering.'
                  : 'Scholarly papers and research publications will appear here once published.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {publications.map((pub) => (
                <div
                  key={pub.id}
                  className="rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-cyan-300 transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* Top Rendering: Thumbnail / First page */}
                  {pub.thumbnail_url ? (
                    <div className="h-32 w-full bg-slate-900 overflow-hidden relative group">
                      <img
                        src={pub.thumbnail_url}
                        alt={pub.title}
                        loading="lazy"
                        className="w-full h-full object-cover object-top opacity-90 group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                      <span className="absolute bottom-1.5 left-2 text-[9px] font-mono text-cyan-200 bg-slate-900/80 px-1.5 py-0.5 rounded border border-cyan-400/30">
                        First Page Preview
                      </span>
                    </div>
                  ) : (
                    <div className="h-20 w-full bg-slate-100 flex items-center justify-center border-b border-slate-200 text-slate-400">
                      <FileText className="w-6 h-6 text-slate-400" />
                    </div>
                  )}

                  <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-1 border-b border-slate-100 pb-1">
                        <h3 className="text-xs font-bold text-slate-950 font-serif line-clamp-2">
                          {pub.title}
                        </h3>
                        {isOwnerAuthenticated && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleEditPub(pub)}
                              className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-cyan-800 transition-colors cursor-pointer"
                              title="Edit publication"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePub(pub.id)}
                              className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Delete publication"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <p className="text-[10px] font-sans font-medium text-cyan-900 truncate">
                        {pub.journal_or_conference || pub.publisher || 'Technical Whitepaper'}
                      </p>

                      <div className="flex items-center gap-1 text-[9px] text-slate-500 font-sans">
                        <span>{pub.publication_date}</span>
                        {pub.authors && <span>· By {pub.authors}</span>}
                      </div>

                      {pub.abstract && (
                        <p className="text-[10px] text-slate-600 font-serif text-justify line-clamp-3 leading-relaxed pt-0.5">
                          {pub.abstract}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-sans font-semibold text-cyan-900">
                      {(pub.pdf_url || pub.document_url) ? (
                        <a
                          href={pub.pdf_url || pub.document_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 hover:text-cyan-950 underline"
                        >
                          <Download className="w-2.5 h-2.5" />
                          <span>Document PDF</span>
                        </a>
                      ) : (
                        <span className="text-[9px] text-slate-400 italic">Archived Record</span>
                      )}

                      {pub.doi_or_url && (
                        <a
                          href={pub.doi_or_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 hover:text-cyan-950"
                        >
                          <span>DOI / Link</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. ACHIEVEMENTS & AWARDS SECTION                         */}
      {/* ======================================================== */}
      <section id="profile-achievements" className="scroll-mt-20">
        <div className="p-4 sm:p-5 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-xs space-y-3">
          {/* Section Header (Centered) */}
          <div className="border-b border-[#cbd5e1] pb-2.5 text-center flex flex-col items-center justify-center">
            <span className="text-[9.5px] sm:text-[10px] font-sans font-bold text-cyan-900 uppercase tracking-wider bg-cyan-100 border border-cyan-300 px-2 py-0.5 rounded-full shadow-2xs inline-block">
              RECOGNITION &amp; HONORS
            </span>
            <h2 className="text-xs sm:text-sm md:text-[14.5px] font-bold text-slate-950 mt-1 font-serif text-center">
              Achievements &amp; Awards
            </h2>
            <p className="text-[10.5px] sm:text-[11px] text-slate-600 mt-0.5 text-center leading-relaxed max-w-lg">
              Official distinctions, engineering competition awards, leadership recognitions, and professional citations.
            </p>

            {isOwnerAuthenticated && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={handleOpenAddAch}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-[10.5px] font-sans font-semibold transition-colors cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3 h-3 text-cyan-200" />
                  <span>+ Add Achievement</span>
                </button>
              </div>
            )}
          </div>

          {/* Loading / Content */}
          {loadingAch ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500 font-sans">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-700" />
              <span>Loading achievements...</span>
            </div>
          ) : achievements.length === 0 ? (
            <div className="p-6 rounded-xl bg-white border border-dashed border-[#b8c6d4] text-center space-y-2">
              <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center mx-auto text-cyan-800">
                <Award className="w-4 h-4" />
              </div>
              <h4 className="text-xs sm:text-[13px] font-bold text-slate-900 font-serif text-center">
                No Achievements or Awards Added Yet
              </h4>
              <p className="text-[10.5px] text-slate-600 max-w-md mx-auto text-center leading-relaxed">
                {isOwnerAuthenticated
                  ? 'Click "+ Add Achievement" above to feature honors, award descriptions, issuing organizations, and credentials.'
                  : 'Distinctions and honors will appear here once published.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {achievements.map((ach) => (
                <div
                  key={ach.id}
                  className="p-3 sm:p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs hover:border-cyan-300 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1.5 border-b border-slate-100 pb-1.5">
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-md bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                          <Award className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-950 font-serif">
                            {ach.title}
                          </h3>
                          <p className="text-[10px] font-sans font-semibold text-cyan-900">
                            {ach.issuer_or_organization || ach.organization}
                          </p>
                        </div>
                      </div>

                      {isOwnerAuthenticated && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEditAch(ach)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-600 hover:text-cyan-800 transition-colors cursor-pointer"
                            title="Edit achievement"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAch(ach.id)}
                            className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete achievement"
                          >
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[9px] font-sans text-slate-500">
                      <span>{ach.date_awarded}</span>
                      {(ach.badge_label || ach.category) && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[8.5px] font-bold">
                          {ach.badge_label || ach.category}
                        </span>
                      )}
                    </div>

                    {ach.description && (
                      <p className="text-[10.5px] text-slate-700 font-serif text-justify leading-relaxed whitespace-pre-line pt-0.5">
                        {ach.description}
                      </p>
                    )}
                  </div>

                  {(ach.certificate_url || ach.verification_url) && (
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end text-[10px] font-sans font-semibold text-cyan-900">
                      <a
                        href={ach.certificate_url || ach.verification_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-cyan-950 underline"
                      >
                        <span>View Award Citation / Credential</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ======================================================== */}
          {/* 4. REDESIGNED SKILL SECTION DIRECTLY UNDER ACHIEVEMENTS  */}
          {/* ======================================================== */}
          <div className="mt-4 pt-3.5 border-t border-[#cbd5e1] space-y-3">
            <div className="text-center flex flex-col items-center justify-center">
              <span className="text-[9px] font-sans font-bold text-slate-700 uppercase tracking-wider bg-slate-200/80 border border-slate-300 px-2 py-0.5 rounded-full inline-block">
                TECHNICAL PROFICIENCIES
              </span>
              <h3 className="text-xs sm:text-[13px] font-bold text-slate-950 mt-0.5 font-serif text-center">
                Skills &amp; Certified Competencies
              </h3>
              <p className="text-[10px] text-slate-600 text-center max-w-md">
                Categorized engineering, CAD modeling, shop machining, and programming tools with certification verification.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {(() => {
                const categorized = categorizeSkills(rawSkillsString);
                const categoryMeta: Array<{
                  name: SkillCategoryName;
                  label: string;
                  subLabel: string;
                  icon: React.ReactNode;
                  badgeClass: string;
                  borderClass: string;
                }> = [
                  {
                    name: 'Core Engineering Skills',
                    label: 'Core Engineering Skills',
                    subLabel: 'CAD, FEA & Mechanisms',
                    icon: <Sparkles className="w-3 h-3 text-cyan-700" />,
                    badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-200',
                    borderClass: 'border-cyan-200/80 bg-white',
                  },
                  {
                    name: 'Handful Skills',
                    label: 'Handful Skills',
                    subLabel: '5-Axis CNC & Shop',
                    icon: <Wrench className="w-3 h-3 text-amber-700" />,
                    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
                    borderClass: 'border-amber-200/80 bg-white',
                  },
                  {
                    name: 'IT Skills',
                    label: 'IT Skills',
                    subLabel: 'Code & Software',
                    icon: <Code className="w-3 h-3 text-emerald-700" />,
                    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
                    borderClass: 'border-emerald-200/80 bg-white',
                  },
                ];

                return categoryMeta.map((cat) => {
                  const skills = categorized[cat.name] || [];
                  return (
                    <div
                      key={cat.name}
                      className={`p-2.5 rounded-xl border ${cat.borderClass} space-y-1.5 shadow-2xs`}
                    >
                      <div className="flex items-center justify-between gap-1 border-b border-slate-100 pb-1">
                        <div className="flex items-center gap-1.5">
                          {cat.icon}
                          <span className="text-[10px] font-bold text-slate-800 font-sans">{cat.label}</span>
                        </div>
                        <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded border ${cat.badgeClass}`}>
                          {cat.subLabel}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {skills.length > 0 ? (
                          skills.map((skill, sIdx) => {
                            const isCertified = /\[certified/i.test(skill);
                            const cleanName = skill.replace(/\[certified[^\]]*\]/gi, '').trim();
                            return (
                              <span
                                key={sIdx}
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-colors ${
                                  isCertified
                                    ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 font-semibold'
                                    : 'bg-slate-50 text-slate-700 border border-slate-200 hover:border-cyan-300'
                                }`}
                              >
                                {isCertified && <ShieldCheck className="w-2.5 h-2.5 text-emerald-600 shrink-0" />}
                                <span>{cleanName}</span>
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[8.5px] text-slate-400 italic">No skills listed</span>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* ADD / EDIT EXPERIENCE MODAL                              */}
      {/* ======================================================== */}
      {isExpModalOpen && (
        <ExperienceEditModal
          item={editingExp}
          onClose={() => setIsExpModalOpen(false)}
          onSaved={(savedItem) => {
            setExperiences((prev) => {
              const idx = prev.findIndex((e) => e.id === savedItem.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = savedItem;
                return next;
              }
              return [savedItem, ...prev];
            });
            setIsExpModalOpen(false);
            showNotice('Experience saved successfully.');
          }}
        />
      )}

      {/* ======================================================== */}
      {/* ADD / EDIT PUBLICATION MODAL                            */}
      {/* ======================================================== */}
      {isPubModalOpen && (
        <PublicationEditModal
          item={editingPub}
          onClose={() => setIsPubModalOpen(false)}
          onSaved={(savedItem) => {
            setPublications((prev) => {
              const idx = prev.findIndex((p) => p.id === savedItem.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = savedItem;
                return next;
              }
              return [savedItem, ...prev];
            });
            setIsPubModalOpen(false);
            showNotice('Publication saved successfully.');
          }}
        />
      )}

      {/* ======================================================== */}
      {/* ADD / EDIT ACHIEVEMENT MODAL                            */}
      {/* ======================================================== */}
      {isAchModalOpen && (
        <AchievementEditModal
          item={editingAch}
          onClose={() => setIsAchModalOpen(false)}
          onSaved={(savedItem) => {
            setAchievements((prev) => {
              const idx = prev.findIndex((a) => a.id === savedItem.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = savedItem;
                return next;
              }
              return [savedItem, ...prev];
            });
            setIsAchModalOpen(false);
            showNotice('Achievement saved successfully.');
          }}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------
// Modals for CRUD operations with small inputs & buttons
// ----------------------------------------------------
const ExperienceEditModal: React.FC<{
  item: ExperienceItem | null;
  onClose: () => void;
  onSaved: (item: ExperienceItem) => void;
}> = ({ item, onClose, onSaved }) => {
  const [role, setRole] = useState(item?.role || item?.title || '');
  const [company, setCompany] = useState(item?.company || '');
  const [period, setPeriod] = useState(item?.period || item?.start_date || '');
  const [location, setLocation] = useState(item?.location || '');
  const [description, setDescription] = useState(item?.description || '');
  const [highlightsInput, setHighlightsInput] = useState(item?.highlights?.join('\n') || item?.key_responsibilities?.join('\n') || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role.trim() || !company.trim() || !period.trim()) {
      alert('Role, Company, and Period are required.');
      return;
    }
    setSaving(true);
    try {
      const highlights = highlightsInput
        .split('\n')
        .map((s: string) => s.trim())
        .filter(Boolean);

      const savedItem: ExperienceItem = {
        id: item?.id || `exp_${Date.now()}`,
        title: role.trim(),
        role: role.trim(),
        company: company.trim(),
        period: period.trim(),
        start_date: period.trim(),
        location: location.trim(),
        description: description.trim(),
        highlights,
        key_responsibilities: highlights,
        order_index: item?.order_index || 0,
      };
      await saveExperienceToSupabase(savedItem);
      onSaved(savedItem);
    } catch (err: any) {
      alert('Error saving experience: ' + (err.message || 'Error occurred'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs font-serif">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-md w-full p-4.5 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-3.5 top-3.5 p-1 rounded-md text-slate-400 hover:text-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <h3 className="text-xs sm:text-[13px] font-bold text-slate-950 text-center font-serif mb-3">
          {item ? 'Edit Career Experience' : 'Add Career Experience'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-2.5 text-[11px] font-sans">
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Role / Title *</label>
            <input
              type="text"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Lead Mechanical Hardware Engineer"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Company *</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Apex Aero Systems"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Period / Dates *</label>
              <input
                type="text"
                required
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="e.g. 2021 — Present"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Houston, TX · On-site"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Summary Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Concise overview of engineering focus, leadership scope, and hardware deployed..."
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700 font-serif leading-relaxed"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Key Highlights (1 per line)</label>
            <textarea
              rows={2}
              value={highlightsInput}
              onChange={(e) => setHighlightsInput(e.target.value)}
              placeholder="Designed 5-axis CNC titanium bracket with 35% weight reduction&#10;Validated thermal FEA under space vacuum conditions"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700 font-serif leading-relaxed"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded-md text-[10.5px] border border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1 rounded-md text-[10.5px] bg-cyan-800 hover:bg-cyan-900 text-white font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              <span>{saving ? 'Saving...' : 'Save Experience'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const PublicationEditModal: React.FC<{
  item: PublicationItem | null;
  onClose: () => void;
  onSaved: (item: PublicationItem) => void;
}> = ({ item, onClose, onSaved }) => {
  const [title, setTitle] = useState(item?.title || '');
  const [authors, setAuthors] = useState(item?.authors || 'Festus, Olorunsogo Johnson');
  const [journal, setJournal] = useState(item?.journal_or_conference || item?.publisher || '');
  const [pubDate, setPubDate] = useState(item?.publication_date || '');
  const [abstract, setAbstract] = useState(item?.abstract || '');
  const [doi, setDoi] = useState(item?.doi_or_url || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(item?.thumbnail_url || '');
  const [pdfUrl, setPdfUrl] = useState(item?.pdf_url || item?.document_url || '');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [saving, setSaving] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const uploadRes = await uploadMaterialToSupabaseBucket(file, file.name);
      setPdfUrl(uploadRes.publicUrl);

      // Render first page as thumbnail
      const arrayBuffer = await file.arrayBuffer();
      const thumb = await renderPdfFirstPageToImage(arrayBuffer);
      if (thumb) {
        setThumbnailUrl(thumb);
      }
    } catch (err: any) {
      alert('Upload failed: ' + (err.message || 'Error occurred'));
    } finally {
      setUploadingPdf(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !pubDate.trim()) {
      alert('Title and Publication Date are required.');
      return;
    }
    setSaving(true);
    try {
      const savedItem: PublicationItem = {
        id: item?.id || `pub_${Date.now()}`,
        title: title.trim(),
        authors: authors.trim(),
        publisher: journal.trim() || 'Applied Engineering Publication',
        journal_or_conference: journal.trim(),
        publication_date: pubDate.trim(),
        abstract: abstract.trim(),
        doi_or_url: doi.trim(),
        thumbnail_url: thumbnailUrl.trim(),
        pdf_url: pdfUrl.trim(),
        document_url: pdfUrl.trim(),
        order_index: item?.order_index || 0,
      };
      await savePublicationToSupabase(savedItem);
      onSaved(savedItem);
    } catch (err: any) {
      alert('Error saving publication: ' + (err.message || 'Error occurred'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs font-serif">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-md w-full p-4.5 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-3.5 top-3.5 p-1 rounded-md text-slate-400 hover:text-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <h3 className="text-xs sm:text-[13px] font-bold text-slate-950 text-center font-serif mb-3">
          {item ? 'Edit Research Publication' : 'Add Research Publication'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-2.5 text-[11px] font-sans">
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Publication Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Non-linear FEA Topology Optimization in Aerospace Gimbals"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Journal / Publisher</label>
              <input
                type="text"
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
                placeholder="e.g. ASME Journal of Mechanical Design"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Publication Date *</label>
              <input
                type="text"
                required
                value={pubDate}
                onChange={(e) => setPubDate(e.target.value)}
                placeholder="e.g. 2024"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Authors</label>
            <input
              type="text"
              value={authors}
              onChange={(e) => setAuthors(e.target.value)}
              placeholder="e.g. Festus, Olorunsogo Johnson, et al."
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Upload PDF Document (Auto-renders first page thumbnail)</label>
            <input
              type="file"
              ref={pdfInputRef}
              accept=".pdf,application/pdf"
              onChange={handlePdfUpload}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => pdfInputRef.current?.click()}
                disabled={uploadingPdf}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-slate-50 text-[10.5px] font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                {uploadingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                <span>{uploadingPdf ? 'Rendering PDF...' : 'Select PDF'}</span>
              </button>
              {pdfUrl && <span className="text-[10px] text-emerald-700 truncate max-w-[200px]">PDF Uploaded</span>}
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Thumbnail / Cover Image URL</label>
            <input
              type="url"
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://... or auto-rendered from PDF"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Abstract / Summary</label>
            <textarea
              rows={3}
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Executive summary of the research methodology and conclusions..."
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700 font-serif leading-relaxed"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">DOI or External URL</label>
            <input
              type="url"
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              placeholder="https://doi.org/... or external link"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded-md text-[10.5px] border border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1 rounded-md text-[10.5px] bg-cyan-800 hover:bg-cyan-900 text-white font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              <span>{saving ? 'Saving...' : 'Save Publication'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AchievementEditModal: React.FC<{
  item: AchievementItem | null;
  onClose: () => void;
  onSaved: (item: AchievementItem) => void;
}> = ({ item, onClose, onSaved }) => {
  const [title, setTitle] = useState(item?.title || '');
  const [issuer, setIssuer] = useState(item?.issuer_or_organization || item?.organization || '');
  const [dateAwarded, setDateAwarded] = useState(item?.date_awarded || '');
  const [badgeLabel, setBadgeLabel] = useState(item?.badge_label || item?.category || '');
  const [description, setDescription] = useState(item?.description || '');
  const [certificateUrl, setCertificateUrl] = useState(item?.certificate_url || item?.verification_url || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !issuer.trim()) {
      alert('Title and Issuing Organization are required.');
      return;
    }
    setSaving(true);
    try {
      const savedItem: AchievementItem = {
        id: item?.id || `ach_${Date.now()}`,
        title: title.trim(),
        organization: issuer.trim(),
        issuer_or_organization: issuer.trim(),
        date_awarded: dateAwarded.trim(),
        badge_label: badgeLabel.trim(),
        category: badgeLabel.trim() || 'Award',
        description: description.trim(),
        certificate_url: certificateUrl.trim(),
        verification_url: certificateUrl.trim(),
        order_index: item?.order_index || 0,
      };
      await saveAchievementToSupabase(savedItem);
      onSaved(savedItem);
    } catch (err: any) {
      alert('Error saving achievement: ' + (err.message || 'Error occurred'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-xs font-serif">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-md w-full p-4.5 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute right-3.5 top-3.5 p-1 rounded-md text-slate-400 hover:text-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>
        <h3 className="text-xs sm:text-[13px] font-bold text-slate-950 text-center font-serif mb-3">
          {item ? 'Edit Achievement & Award' : 'Add Achievement & Award'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-2.5 text-[11px] font-sans">
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Award / Achievement Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. National Mechanical Design Excellence Award"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Issuing Organization *</label>
              <input
                type="text"
                required
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="e.g. ASME / Institution"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Date Awarded</label>
              <input
                type="text"
                value={dateAwarded}
                onChange={(e) => setDateAwarded(e.target.value)}
                placeholder="e.g. 2023"
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Badge / Honor Label</label>
            <input
              type="text"
              value={badgeLabel}
              onChange={(e) => setBadgeLabel(e.target.value)}
              placeholder="e.g. 1st Place · Senior Design"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Description &amp; Where / Scope</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the recognition, evaluation criteria, and significance..."
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700 font-serif leading-relaxed"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-700 mb-0.5">Credential / Citation URL</label>
            <input
              type="url"
              value={certificateUrl}
              onChange={(e) => setCertificateUrl(e.target.value)}
              placeholder="https://... or certificate verification link"
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 rounded-md text-[10.5px] border border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1 rounded-md text-[10.5px] bg-cyan-800 hover:bg-cyan-900 text-white font-bold cursor-pointer disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              <span>{saving ? 'Saving...' : 'Save Achievement'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
