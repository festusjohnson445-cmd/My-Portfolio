import React, { useMemo } from 'react';
import {
  Award,
  Briefcase,
  Calendar,
  Camera,
  FileText,
  Globe,
  GraduationCap,
  Hash,
  Heart,
  Layers,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import {
  DocumentFormPayload,
  getCategoryMeta,
  getPayloadTemplateId,
} from '../types/documentWorkspace';
import { buildDocumentBlueprint } from '../utils/documentExport';
import {
  SinglePageDensity,
  SinglePageDocumentModel,
  TemplateContactItem,
  TemplateSection,
  TwoPageDocumentModel,
  buildSinglePageDocumentModel,
  buildTwoPageDocumentModel,
} from '../utils/careerStudioTemplates';

export type PreviewAspectMode = 'a4' | 'letter' | 'auto';

interface DocumentA4PreviewProps {
  payload: DocumentFormPayload;
  zoomPct?: number;
  textScalePct?: number;
  aspectMode?: PreviewAspectMode;
  onUploadPassportClick?: () => void;
  className?: string;
}

const safeTrim = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

const hasAnyUserInput = (payload: DocumentFormPayload): boolean => {
  if (!payload || !payload.data) return false;
  switch (payload.category) {
    case 'international_cv':
      return Boolean(
        safeTrim(payload.data.header?.fullName) ||
          safeTrim(payload.data.header?.email) ||
          safeTrim(payload.data.professionalSummary) ||
          safeTrim(payload.data.coreCompetencies) ||
          safeTrim(payload.data.technicalAndDigitalSkills) ||
          (payload.data.experiences || []).some(
            (e) => safeTrim(e?.roleTitle) || safeTrim(e?.organization)
          ) ||
          (payload.data.leadershipRoles || []).some(
            (e) => safeTrim(e?.roleTitle) || safeTrim(e?.organization)
          ) ||
          (payload.data.selectedProjects || []).some((p) => safeTrim(p?.name)) ||
          (payload.data.education || []).some(
            (e) => safeTrim(e?.degree) || safeTrim(e?.institution)
          ) ||
          safeTrim(payload.data.technicalTraining)
      );
    case 'academic_resume':
      return Boolean(
        safeTrim(payload.data.header?.fullName) ||
          safeTrim(payload.data.researchProfile) ||
          (payload.data.education || []).some(
            (e) => safeTrim(e?.degree) || safeTrim(e?.institution)
          ) ||
          (payload.data.researchAppointments || []).some(
            (e) => safeTrim(e?.roleTitle) || safeTrim(e?.organization)
          ) ||
          (payload.data.professionalExperience || []).some(
            (e) => safeTrim(e?.roleTitle) || safeTrim(e?.organization)
          ) ||
          (payload.data.leadershipRoles || []).some(
            (e) => safeTrim(e?.roleTitle) || safeTrim(e?.organization)
          ) ||
          (payload.data.selectedProjects || []).some((p) => safeTrim(p?.name)) ||
          safeTrim(payload.data.technicalAndDigitalSkills) ||
          safeTrim(payload.data.technicalTraining) ||
          (payload.data.publications || []).some((p) => safeTrim(p?.citation))
      );
    case 'job_resume':
      return Boolean(
        safeTrim(payload.data.header?.fullName) ||
          safeTrim(payload.data.targetJobTitle) ||
          safeTrim(payload.data.professionalSummary) ||
          safeTrim(payload.data.technicalSkills) ||
          (payload.data.workExperience || []).some(
            (w) => safeTrim(w?.roleTitle) || safeTrim(w?.organization)
          ) ||
          (payload.data.leadershipRoles || []).some(
            (l) => safeTrim(l?.roleTitle) || safeTrim(l?.organization)
          ) ||
          (payload.data.keyProjects || []).some((p) => safeTrim(p?.name)) ||
          safeTrim(payload.data.technicalTraining)
      );
    case 'sop':
      return Boolean(
        safeTrim(payload.data.applicantName) ||
          safeTrim(payload.data.targetDegreeAndProgram) ||
          safeTrim(payload.data.openingMotivation) ||
          safeTrim(payload.data.academicFoundation)
      );
    case 'personal_statement':
      return Boolean(
        safeTrim(payload.data.applicantName) ||
          safeTrim(payload.data.targetProgramOrOpportunity) ||
          safeTrim(payload.data.definingStoryAndOrigin) ||
          safeTrim(payload.data.challengesAndResilience)
      );
    case 'scholarship_letter':
      return Boolean(
        safeTrim(payload.data.applicantName) ||
          safeTrim(payload.data.scholarshipName) ||
          safeTrim(payload.data.purposeAndStanding) ||
          safeTrim(payload.data.motivationAndMerit)
      );
    case 'research_proposal':
      return Boolean(
        safeTrim(payload.data.proposalTitle) ||
          safeTrim(payload.data.applicantName) ||
          safeTrim(payload.data.abstractSummary) ||
          safeTrim(payload.data.problemStatement)
      );
    case 'study_plan':
      return Boolean(
        safeTrim(payload.data.applicantName) ||
          safeTrim(payload.data.targetDegree) ||
          safeTrim(payload.data.purposeAndSpecialization) ||
          safeTrim(payload.data.academicBackground)
      );
    default:
      return false;
  }
};

const renderContactIcon = (icon: TemplateContactItem['icon'], cls = 'w-3 h-3 shrink-0') => {
  switch (icon) {
    case 'phone':
      return <Phone className={cls} />;
    case 'link':
      return <Globe className={cls} />;
    case 'mail':
      return <Mail className={cls} />;
    case 'pin':
      return <MapPin className={cls} />;
    case 'date':
      return <Calendar className={cls} />;
    default:
      return <Hash className={cls} />;
  }
};

const renderSectionBadgeIcon = (heading: string, cls = 'w-3 h-3 shrink-0') => {
  const h = heading.toUpperCase();
  if (h.includes('EDU') || h.includes('DEGREE') || h.includes('STUDY')) {
    return <GraduationCap className={cls} />;
  }
  if (h.includes('EXP') || h.includes('APPOINT') || h.includes('SUMMARY') || h.includes('WORK')) {
    return <Briefcase className={cls} />;
  }
  if (h.includes('PROJECT') || h.includes('PUB') || h.includes('METHOD') || h.includes('TIMELINE')) {
    return <Layers className={cls} />;
  }
  if (h.includes('CERT') || h.includes('GRANT') || h.includes('QUAL')) {
    return <Award className={cls} />;
  }
  if (h.includes('SKILL') || h.includes('PREP') || h.includes('KEY')) {
    return <Sparkles className={cls} />;
  }
  if (h.includes('LANG')) {
    return <Globe className={cls} />;
  }
  if (h.includes('INTEREST')) {
    return <Heart className={cls} />;
  }
  if (h.includes('REF')) {
    return <Users className={cls} />;
  }
  if (h.includes('PROFILE') || h.includes('ADMISSION')) {
    return <User className={cls} />;
  }
  return <FileText className={cls} />;
};

const aspectRatioClass = (aspectMode: PreviewAspectMode): string => {
  if (aspectMode === 'letter') return 'sm:aspect-[8.5/11]';
  if (aspectMode === 'auto') return 'min-h-[780px]';
  return 'sm:aspect-[210/297]';
};

const makeFontMetrics = (density: SinglePageDensity, textScalePct: number) => {
  const mul = Math.max(0.8, Math.min(1.25, textScalePct / 100));
  const px = (base: number) => `${(base * mul).toFixed(2)}px`;
  if (density === 'ultra') {
    return {
      bodyPx: px(9.4),
      lineHeight: 1.32,
      headingPx: px(10.6),
      subHeadingPx: px(9.8),
      metaPx: px(8.8),
      namePx: px(20.5),
      rolePx: px(10.2),
      sectionGap: 'space-y-2',
      itemGap: 'space-y-1',
    };
  }
  if (density === 'compact') {
    return {
      bodyPx: px(10.1),
      lineHeight: 1.38,
      headingPx: px(11.3),
      subHeadingPx: px(10.3),
      metaPx: px(9.3),
      namePx: px(22.5),
      rolePx: px(11),
      sectionGap: 'space-y-2.5',
      itemGap: 'space-y-1.5',
    };
  }
  return {
    bodyPx: px(10.9),
    lineHeight: 1.44,
    headingPx: px(12.2),
    subHeadingPx: px(11),
    metaPx: px(9.8),
    namePx: px(24.5),
    rolePx: px(11.8),
    sectionGap: 'space-y-3',
    itemGap: 'space-y-2',
  };
};

// Zoom container: uses native CSS `zoom` (scales width, height & fonts cleanly with zero dead space)
const ZoomSheetFrame: React.FC<{ zoomPct: number; children: React.ReactNode }> = ({
  zoomPct,
  children,
}) => {
  const scale = Math.max(0.65, Math.min(1.4, zoomPct / 100));
  return (
    <div className="w-full overflow-x-auto flex justify-center">
      <div
        className="flex flex-col items-center gap-5 w-full max-w-[794px]"
        style={{ zoom: scale } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
  );
};

// ============================================================================
// TEMPLATE 1: NAVY GEOMETRIC SIDEBAR (Single Page A4)
// ============================================================================
const NavySidebarSheet: React.FC<{
  model: SinglePageDocumentModel;
  textScalePct: number;
  aspectMode: PreviewAspectMode;
  ariaLabel: string;
}> = ({ model, textScalePct, aspectMode, ariaLabel }) => {
  const m = makeFontMetrics(model.density, textScalePct);
  const sansFont = '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif';

  const renderSidebarSection = (sec: TemplateSection) => (
    <div key={sec.id} className="space-y-1">
      <h3
        className="font-bold uppercase tracking-wider text-white"
        style={{ fontFamily: sansFont, fontSize: m.headingPx }}
      >
        {sec.heading}
      </h3>
      {sec.kind === 'contacts' && sec.contacts && (
        <ul
          className="space-y-1 text-[#E2E8F0]"
          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.contacts.map((c, idx) => (
            <li key={`nc-${idx}`} className="flex items-start gap-1.5 break-all">
              <span className="mt-0.5 text-[#93C5FD]">
                {renderContactIcon(c.icon, 'w-2.5 h-2.5 shrink-0')}
              </span>
              <span className="break-words">{c.value}</span>
            </li>
          ))}
        </ul>
      )}
      {sec.kind === 'bullets' && sec.bullets && (
        <ul
          className="space-y-0.5 text-[#DCE4EE]"
          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.bullets.map((b, idx) => (
            <li key={`nb-${idx}`} className="flex items-start gap-1.5 break-words">
              <span className="text-[#CBD5E1] shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      {sec.kind === 'subgroups' && sec.subgroups && (
        <div className="space-y-1.5">
          {sec.subgroups.map((sg, idx) => (
            <div key={`nsg-${idx}`} className="space-y-0.5">
              {sg.subtitle && (
                <div
                  className="font-semibold uppercase tracking-wide text-[#93C5FD]"
                  style={{ fontSize: m.metaPx }}
                >
                  {sg.subtitle}
                </div>
              )}
              <ul
                className="space-y-0.5 text-[#DCE4EE]"
                style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
              >
                {sg.items.map((item, j) => (
                  <li key={`nsgi-${j}`} className="flex items-start gap-1.5 break-words">
                    <span className="text-[#CBD5E1] shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMainSection = (sec: TemplateSection) => (
    <div key={sec.id} className="space-y-1">
      <div className="border-b-[1.5px] border-[#334155] pb-0.5">
        <h2
          className="font-extrabold uppercase tracking-wide text-[#1E293B]"
          style={{ fontFamily: sansFont, fontSize: m.headingPx }}
        >
          {sec.heading}
        </h2>
      </div>

      {sec.kind === 'paragraph' && sec.text && (
        <p
          className="text-[#334155] text-justify whitespace-pre-line break-words pt-0.5"
          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.text}
        </p>
      )}

      {sec.kind === 'paragraphs' && sec.paragraphs && (
        <div className="space-y-1 pt-0.5">
          {sec.paragraphs.map((p, idx) => (
            <p
              key={`np-${idx}`}
              className="text-[#334155] text-justify whitespace-pre-line break-words"
              style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
            >
              {p}
            </p>
          ))}
        </div>
      )}

      {sec.kind === 'bullets' && sec.bullets && (
        <ul
          className="space-y-0.5 pt-0.5 text-[#334155]"
          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.bullets.map((b, idx) => {
            const isCitation = /^\[\d+\]\s/.test(b);
            return (
              <li
                key={`nmb-${idx}`}
                className={`break-words ${isCitation ? 'pl-4 -indent-4' : 'flex items-start gap-1.5'}`}
              >
                {!isCitation && <span className="text-[#1E293B] font-bold shrink-0">•</span>}
                <span>{b}</span>
              </li>
            );
          })}
        </ul>
      )}

      {sec.kind === 'entries' && sec.entries && (
        <div className={`${m.itemGap} pt-0.5`}>
          {sec.entries.map((entry, eIdx) => (
            <div key={`ne-${eIdx}`} className="space-y-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <div
                  className="font-bold uppercase text-[#1E293B] leading-tight"
                  style={{ fontSize: m.subHeadingPx }}
                >
                  {entry.primary}
                </div>
                {entry.dateRange && (
                  <span className="font-medium text-[#475569] shrink-0" style={{ fontSize: m.metaPx }}>
                    {entry.dateRange}
                  </span>
                )}
              </div>
              {entry.secondary && (
                <div
                  className="font-semibold text-[#334155] leading-tight"
                  style={{ fontSize: m.bodyPx }}
                >
                  {entry.secondary}
                </div>
              )}
              {entry.bodyText && (
                <p
                  className="text-[#334155] whitespace-pre-line break-words"
                  style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                >
                  {entry.bodyText}
                </p>
              )}
              {entry.bullets && entry.bullets.length > 0 && (
                <ul
                  className="space-y-0.5 pl-1 text-[#334155]"
                  style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                >
                  {entry.bullets.map((b, bIdx) => (
                    <li key={`neb-${bIdx}`} className="flex items-start gap-1.5 break-words">
                      <span className="text-[#1E293B] shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {sec.kind === 'signature' && sec.signature && (
        <div className="pt-1 text-[#1E293B]" style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}>
          <p>{sec.signature.signOff}</p>
          <p className="font-bold mt-1">{sec.signature.name}</p>
          {sec.signature.subline && (
            <p className="text-[#475569]" style={{ fontSize: m.metaPx }}>
              {sec.signature.subline}
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <article
      aria-label={ariaLabel}
      style={{ fontFamily: sansFont }}
      className={`a4-paper-sheet w-full max-w-[794px] ${aspectRatioClass(
        aspectMode
      )} bg-white text-[#1E293B] border border-slate-300 shadow-md rounded-sm overflow-hidden select-text flex flex-col sm:flex-row`}
    >
      <aside className="relative w-full sm:w-[33%] bg-[#1B3047] text-white px-5 py-7 flex flex-col justify-between overflow-hidden shrink-0">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 w-full h-full"
          viewBox="0 0 260 1120"
          preserveAspectRatio="none"
        >
          <line x1="-10" y1="115" x2="120" y2="-10" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
          <line x1="-10" y1="145" x2="150" y2="-10" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
          <line x1="160" y1="110" x2="265" y2="110" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <line x1="190" y1="126" x2="265" y2="126" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          <line x1="200" y1="320" x2="265" y2="255" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
          <line x1="215" y1="335" x2="265" y2="285" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <line x1="-10" y1="980" x2="110" y2="860" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
          <line x1="0" y1="940" x2="130" y2="940" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
          <line x1="90" y1="1125" x2="265" y2="950" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="125" y1="1125" x2="265" y2="985" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
        </svg>

        <div className={`relative z-10 pt-4 ${m.sectionGap}`}>
          {model.sidebarSections.map(renderSidebarSection)}
        </div>
      </aside>

      <div className={`flex-1 bg-white px-6 py-6 sm:px-7 sm:py-7 flex flex-col justify-between ${m.sectionGap}`}>
        <div className={m.sectionGap}>
          <header className="pb-1">
            <h1
              className="font-extrabold uppercase tracking-tight text-[#22262A] leading-tight break-words"
              style={{ fontSize: m.namePx }}
            >
              {model.displayName}
            </h1>
            {model.displayRole && (
              <p
                className="font-normal uppercase tracking-wide text-[#374151] mt-0.5 break-words"
                style={{ fontSize: m.rolePx }}
              >
                {model.displayRole}
              </p>
            )}
          </header>

          <div className={m.sectionGap}>{model.mainSections.map(renderMainSection)}</div>

          {model.trailingSections.length > 0 && (
            <div className={m.sectionGap}>{model.trailingSections.map(renderMainSection)}</div>
          )}

          {model.skillsGridItems.length > 0 && (
            <div className="space-y-1.5">
              <div className="border-b-[1.5px] border-[#334155] pb-0.5">
                <h2
                  className="font-extrabold uppercase tracking-wide text-[#1E293B]"
                  style={{ fontSize: m.headingPx }}
                >
                  {model.skillsGridTitle}
                </h2>
              </div>
              <div
                className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[#334155]"
                style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
              >
                {model.skillsGridItems.map((item, idx) => (
                  <div key={`nsg-bot-${idx}`} className="flex items-start gap-1.5 break-words">
                    <span className="text-[#1E293B] font-bold shrink-0">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

// ============================================================================
// TEMPLATE 2: WARM CREAM & TERRACOTTA EDITORIAL (Single Page A4)
// ============================================================================
const WarmEditorialSheet: React.FC<{
  model: SinglePageDocumentModel;
  textScalePct: number;
  aspectMode: PreviewAspectMode;
  ariaLabel: string;
}> = ({ model, textScalePct, aspectMode, ariaLabel }) => {
  const m = makeFontMetrics(model.density, textScalePct);
  const serifFont = 'Georgia, "Times New Roman", serif';
  const sansFont = '"DM Sans", "Helvetica Neue", Arial, sans-serif';

  const renderEditorialHeading = (title: string) => (
    <div className="mb-1.5">
      <h2
        className="font-normal uppercase tracking-[0.06em] text-[#4A4640] pb-1"
        style={{ fontFamily: serifFont, fontSize: m.headingPx }}
      >
        {title}
      </h2>
      <div className="relative h-[1px] w-full bg-[#9F9A92]">
        <div className="absolute left-0 top-[-1.5px] h-[3px] w-7 bg-[#B9735B]" />
      </div>
    </div>
  );

  const renderLeftSection = (sec: TemplateSection) => (
    <div key={sec.id} className="space-y-1">
      {renderEditorialHeading(sec.heading)}
      {sec.kind === 'contacts' && sec.contacts && (
        <ul
          className="space-y-0.5 text-[#3D3A35]"
          style={{ fontFamily: sansFont, fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.contacts.map((c, idx) => (
            <li key={`wc-${idx}`} className="flex items-start gap-1.5 break-all">
              <span className="mt-0.5 text-[#B9735B]">{renderContactIcon(c.icon, 'w-2.5 h-2.5 shrink-0')}</span>
              <span className="break-words">{c.value}</span>
            </li>
          ))}
        </ul>
      )}
      {sec.kind === 'bullets' && sec.bullets && (
        <ul
          className="space-y-0.5 text-[#3D3A35]"
          style={{ fontFamily: sansFont, fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.bullets.map((b, idx) => (
            <li key={`wb-${idx}`} className="flex items-start gap-1.5 break-words">
              <span className="text-[#8E8A82] shrink-0">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      {sec.kind === 'subgroups' && sec.subgroups && (
        <div className="space-y-1.5" style={{ fontFamily: sansFont }}>
          {sec.subgroups.map((sg, idx) => (
            <div key={`wsg-${idx}`} className="space-y-0.5">
              {sg.subtitle && (
                <div className="font-bold text-[#2B2A28]" style={{ fontSize: m.subHeadingPx }}>
                  {sg.subtitle}
                </div>
              )}
              <ul
                className="space-y-0.5 text-[#3D3A35]"
                style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
              >
                {sg.items.map((item, j) => (
                  <li key={`wsgi-${j}`} className="flex items-start gap-1.5 break-words">
                    <span className="text-[#8E8A82] shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderRightSection = (sec: TemplateSection) => (
    <div key={sec.id} className="space-y-1" style={{ fontFamily: sansFont }}>
      {renderEditorialHeading(sec.heading)}

      {sec.kind === 'paragraph' && sec.text && (
        <p
          className="text-[#3D3A35] text-justify whitespace-pre-line break-words"
          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.text}
        </p>
      )}

      {sec.kind === 'paragraphs' && sec.paragraphs && (
        <div className="space-y-1">
          {sec.paragraphs.map((p, idx) => (
            <p
              key={`wp-${idx}`}
              className="text-[#3D3A35] text-justify whitespace-pre-line break-words"
              style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
            >
              {p}
            </p>
          ))}
        </div>
      )}

      {sec.kind === 'bullets' && sec.bullets && (
        <ul
          className="space-y-0.5 text-[#3D3A35]"
          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.bullets.map((b, idx) => {
            const isCitation = /^\[\d+\]\s/.test(b);
            return (
              <li
                key={`wrb-${idx}`}
                className={`break-words ${isCitation ? 'pl-4 -indent-4' : 'flex items-start gap-1.5'}`}
              >
                {!isCitation && <span className="text-[#8E8A82] shrink-0">•</span>}
                <span>{b}</span>
              </li>
            );
          })}
        </ul>
      )}

      {sec.kind === 'entries' && sec.entries && (
        <div className={m.itemGap}>
          {sec.entries.map((entry, eIdx) => (
            <div key={`we-${eIdx}`} className="space-y-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-bold text-[#2B2A28]" style={{ fontSize: m.subHeadingPx }}>
                  {entry.primary}
                </span>
                {entry.dateRange && (
                  <span className="text-[#5E5B55] shrink-0" style={{ fontSize: m.metaPx }}>
                    {entry.dateRange}
                  </span>
                )}
              </div>
              {entry.secondary && (
                <div className="text-[#4A4640]" style={{ fontSize: m.bodyPx }}>
                  {entry.secondary}
                </div>
              )}
              {entry.bodyText && (
                <p
                  className="text-[#3D3A35] whitespace-pre-line break-words"
                  style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                >
                  {entry.bodyText}
                </p>
              )}
              {entry.bullets && entry.bullets.length > 0 && (
                <ul
                  className="space-y-0.5 pl-1 text-[#3D3A35]"
                  style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                >
                  {entry.bullets.map((b, bIdx) => (
                    <li key={`web-${bIdx}`} className="flex items-start gap-1.5 break-words">
                      <span className="text-[#8E8A82] shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {sec.kind === 'signature' && sec.signature && (
        <div className="pt-1 text-[#2B2A28]" style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}>
          <p>{sec.signature.signOff}</p>
          <p className="font-bold mt-1">{sec.signature.name}</p>
          {sec.signature.subline && (
            <p className="text-[#5E5B55]" style={{ fontSize: m.metaPx }}>
              {sec.signature.subline}
            </p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <article
      aria-label={ariaLabel}
      style={{ fontFamily: sansFont }}
      className={`a4-paper-sheet w-full max-w-[794px] ${aspectRatioClass(
        aspectMode
      )} bg-[#F4F2ED] text-[#2B2A28] border border-[#D4CFC5] shadow-md rounded-sm px-6 py-6 sm:px-8 sm:py-7 overflow-hidden select-text flex flex-col gap-5`}
    >
      <header className="border border-[#969188] border-b-[3.5px] border-b-[#B9735B] px-5 py-3.5 text-center bg-[#F4F2ED]">
        <h1
          className="font-normal uppercase tracking-[0.08em] text-[#4A4640] leading-tight break-words"
          style={{ fontFamily: serifFont, fontSize: m.namePx }}
        >
          {model.displayName}
        </h1>
        {model.displayRole && (
          <p
            className="font-medium uppercase tracking-[0.14em] text-[#2B2A28] mt-1 break-words"
            style={{ fontSize: m.rolePx }}
          >
            {model.displayRole}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-[33%_1fr] gap-5 flex-1">
        <div className={m.sectionGap}>{model.sidebarSections.map(renderLeftSection)}</div>
        <div className={m.sectionGap}>
          {model.mainSections.map(renderRightSection)}
          {model.trailingSections.map(renderRightSection)}
        </div>
      </div>
    </article>
  );
};

// ============================================================================
// TEMPLATE 3: SWISS MINIMALIST MONOCHROME (Single Page A4)
// ============================================================================
const SwissMinimalSheet: React.FC<{
  model: SinglePageDocumentModel;
  textScalePct: number;
  aspectMode: PreviewAspectMode;
  ariaLabel: string;
}> = ({ model, textScalePct, aspectMode, ariaLabel }) => {
  const m = makeFontMetrics(model.density, textScalePct);
  const sansFont = '"DM Sans", "Helvetica Neue", Arial, sans-serif';

  return (
    <article
      aria-label={ariaLabel}
      style={{ fontFamily: sansFont }}
      className={`a4-paper-sheet w-full max-w-[794px] ${aspectRatioClass(
        aspectMode
      )} bg-white text-[#111827] border border-slate-300 shadow-md rounded-sm px-6 py-6 sm:px-9 sm:py-8 overflow-hidden select-text flex flex-col gap-3.5`}
    >
      <header className="pb-2.5 border-b-[2px] border-[#4B5563]">
        <h1
          className="font-extrabold uppercase tracking-tight text-[#111827] leading-tight break-words"
          style={{ fontSize: m.namePx }}
        >
          {model.displayName}
        </h1>
        {model.displayRole && (
          <p
            className="font-normal uppercase tracking-wide text-[#1F2937] mt-0.5 break-words"
            style={{ fontSize: m.rolePx }}
          >
            {model.displayRole}
          </p>
        )}
        {model.inlineContactLine && (
          <p className="text-[#4B5563] mt-1 break-words" style={{ fontSize: m.metaPx }}>
            {model.inlineContactLine}
          </p>
        )}
      </header>

      <div className={m.sectionGap}>
        {model.swissSections.map((sec) => {
          const isFourColSkills = sec.id === 'swiss-skills-grid' && sec.bullets && sec.bullets.length > 0;
          return (
            <div key={sec.id} className="space-y-1">
              <h2
                className="font-extrabold uppercase tracking-wide text-[#111827] pb-0.5 border-b border-[#6B7280]"
                style={{ fontSize: m.headingPx }}
              >
                {sec.heading}
              </h2>

              {sec.kind === 'paragraph' && sec.text && (
                <p
                  className="text-[#374151] text-justify whitespace-pre-line break-words pt-0.5"
                  style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                >
                  {sec.text}
                </p>
              )}

              {sec.kind === 'paragraphs' && sec.paragraphs && (
                <div className="space-y-1 pt-0.5">
                  {sec.paragraphs.map((p, idx) => (
                    <p
                      key={`sp-${idx}`}
                      className="text-[#374151] text-justify whitespace-pre-line break-words"
                      style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                    >
                      {p}
                    </p>
                  ))}
                </div>
              )}

              {isFourColSkills && sec.bullets && (
                <div
                  className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5 pt-0.5 text-[#374151]"
                  style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                >
                  {sec.bullets.map((skill, sIdx) => (
                    <div key={`sk4-${sIdx}`} className="flex items-start gap-1.5 break-words">
                      <span className="text-[#111827] font-bold shrink-0">•</span>
                      <span>{skill}</span>
                    </div>
                  ))}
                </div>
              )}

              {!isFourColSkills && sec.kind === 'bullets' && sec.bullets && (
                <ul
                  className="space-y-0.5 pt-0.5 text-[#374151]"
                  style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                >
                  {sec.bullets.map((b, idx) => {
                    const isCitation = /^\[\d+\]\s/.test(b);
                    return (
                      <li
                        key={`sb-${idx}`}
                        className={`break-words ${isCitation ? 'pl-4 -indent-4' : 'flex items-start gap-1.5'}`}
                      >
                        {!isCitation && <span className="text-[#111827] font-bold shrink-0">•</span>}
                        <span>{b}</span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {sec.kind === 'entries' && sec.entries && (
                <div className={`${m.itemGap} pt-0.5`}>
                  {sec.entries.map((entry, eIdx) => (
                    <div key={`se-${eIdx}`} className="space-y-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span
                          className="font-bold uppercase text-[#111827]"
                          style={{ fontSize: m.subHeadingPx }}
                        >
                          {entry.primary}
                          {entry.secondary ? ` / ${entry.secondary}` : ''}
                        </span>
                      </div>
                      {entry.dateRange && (
                        <div className="uppercase tracking-wide text-[#4B5563]" style={{ fontSize: m.metaPx }}>
                          {entry.dateRange}
                        </div>
                      )}
                      {entry.bodyText && (
                        <p
                          className="text-[#374151] whitespace-pre-line break-words"
                          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                        >
                          {entry.bodyText}
                        </p>
                      )}
                      {entry.bullets && entry.bullets.length > 0 && (
                        <ul
                          className="space-y-0.5 pl-1 text-[#374151]"
                          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                        >
                          {entry.bullets.map((b, bIdx) => (
                            <li key={`seb-${bIdx}`} className="flex items-start gap-1.5 break-words">
                              <span className="text-[#111827] font-bold shrink-0">•</span>
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {sec.kind === 'signature' && sec.signature && (
                <div className="pt-1 text-[#111827]" style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}>
                  <p>{sec.signature.signOff}</p>
                  <p className="font-bold mt-1">{sec.signature.name}</p>
                  {sec.signature.subline && (
                    <p className="text-[#4B5563]" style={{ fontSize: m.metaPx }}>
                      {sec.signature.subline}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </article>
  );
};

// ============================================================================
// TEMPLATE 4: STEEL BLUE 2-PAGE EDITORIAL (Matches Screenshots 1 & 2)
// Pure White Paper, #5B87AC Steel Blue Headings + Vertical Spine, Corner Triangle
// ============================================================================
const SlateTwoPageSheet: React.FC<{
  model: TwoPageDocumentModel;
  textScalePct: number;
  aspectMode: PreviewAspectMode;
  onUploadPassportClick?: () => void;
  ariaLabel: string;
}> = ({ model, textScalePct, aspectMode, onUploadPassportClick, ariaLabel }) => {
  const m = makeFontMetrics(model.density, textScalePct);
  const sansFont = '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif';

  const renderSection = (sec: TemplateSection) => (
    <div key={sec.id} className="space-y-1.5">
      <h3
        className="font-medium text-[#5B87AC] tracking-tight"
        style={{ fontSize: m.headingPx }}
      >
        {sec.heading}
      </h3>

      {sec.kind === 'contacts' && sec.contacts && (
        <ul
          className="space-y-1.5 text-[#2D3748]"
          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.contacts.map((c, idx) => (
            <li key={`tc-${idx}`} className="flex items-start gap-2 break-words">
              <span className="mt-0.5 text-[#1E293B] shrink-0">
                {renderContactIcon(c.icon, 'w-3 h-3 shrink-0')}
              </span>
              <span className={c.icon === 'mail' ? 'text-[#5B87AC] underline break-all' : 'break-words'}>
                {c.value}
              </span>
            </li>
          ))}
        </ul>
      )}

      {sec.kind === 'paragraph' && sec.text && (
        <p
          className="text-[#2D3748] text-justify whitespace-pre-line break-words"
          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.text}
        </p>
      )}

      {sec.kind === 'paragraphs' && sec.paragraphs && (
        <div className="space-y-1.5">
          {sec.paragraphs.map((p, idx) => (
            <p
              key={`tp-${idx}`}
              className="text-[#2D3748] text-justify whitespace-pre-line break-words"
              style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
            >
              {p}
            </p>
          ))}
        </div>
      )}

      {sec.kind === 'bullets' && sec.bullets && (
        <ul
          className="space-y-1 text-[#2D3748]"
          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.bullets.map((b, idx) => {
            const isCitation = /^\[\d+\]\s/.test(b);
            return (
              <li
                key={`tb-${idx}`}
                className={`break-words ${isCitation ? 'pl-4 -indent-4' : 'flex items-start gap-1.5'}`}
              >
                {!isCitation && <span className="text-[#2D3748] shrink-0">•</span>}
                <span>{b}</span>
              </li>
            );
          })}
        </ul>
      )}

      {sec.kind === 'subgroups' && sec.subgroups && (
        <div className="space-y-1.5">
          {sec.subgroups.map((sg, idx) => (
            <div key={`tsg-${idx}`} className="space-y-0.5">
              {sg.subtitle && (
                <div className="font-semibold text-[#1E293B]" style={{ fontSize: m.subHeadingPx }}>
                  {sg.subtitle}
                </div>
              )}
              <ul
                className="space-y-0.5 text-[#2D3748]"
                style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
              >
                {sg.items.map((item, j) => (
                  <li key={`tsgi-${j}`} className="flex items-start gap-1.5 break-words">
                    <span className="text-[#2D3748] shrink-0">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {sec.kind === 'entries' && sec.entries && (
        <div className="space-y-2.5">
          {sec.entries.map((entry, eIdx) => (
            <div key={`te-${eIdx}`} className="space-y-0.5">
              <div
                className="font-bold text-[#1E293B] leading-snug break-words"
                style={{ fontSize: m.subHeadingPx }}
              >
                {entry.primary}
                {entry.secondary ? ` | ${entry.secondary}` : ''}
              </div>
              {entry.dateRange && (
                <div className="italic text-[#475569]" style={{ fontSize: m.metaPx }}>
                  {entry.dateRange}
                </div>
              )}
              {entry.bodyText && (
                <p
                  className="text-[#2D3748] whitespace-pre-line break-words pt-0.5"
                  style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                >
                  {entry.bodyText}
                </p>
              )}
              {entry.bullets && entry.bullets.length > 0 && (
                <ul
                  className="space-y-1 pt-0.5 text-[#2D3748]"
                  style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                >
                  {entry.bullets.map((b, bIdx) => (
                    <li key={`teb-${bIdx}`} className="flex items-start gap-1.5 break-words">
                      <span className="text-[#2D3748] shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {sec.kind === 'signature' && sec.signature && (
        <div className="pt-1 text-[#2D3748]" style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}>
          <p>{sec.signature.signOff}</p>
          <p className="font-bold mt-1 text-[#1E293B]">{sec.signature.name}</p>
          {sec.signature.subline && (
            <p className="text-[#64748B]" style={{ fontSize: m.metaPx }}>
              {sec.signature.subline}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const renderPageCornerFooter = (pageNum: number) => (
    <div className="relative mt-auto pt-4 flex items-end justify-between min-h-[38px]">
      <span className="text-[#94A3B8] font-normal" style={{ fontSize: m.metaPx }}>
        {model.footerName} · Page {pageNum} of 2
      </span>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-7 -right-8 w-24 h-24"
        viewBox="0 0 100 100"
      >
        <polygon points="100,18 100,100 18,100" fill="#9CB8D0" opacity="0.88" />
      </svg>
    </div>
  );

  return (
    <div aria-label={ariaLabel} className="w-full flex flex-col gap-5">
      {/* PAGE 1 */}
      <article
        style={{ fontFamily: sansFont }}
        className={`a4-paper-sheet w-full max-w-[794px] ${aspectRatioClass(
          aspectMode
        )} bg-white text-[#2D3748] border border-slate-300 shadow-md rounded-sm px-6 py-7 sm:px-9 sm:py-8 overflow-hidden select-text flex flex-col`}
      >
        {/* Top Portrait + Steel Blue Name + Rule */}
        <header className="flex items-start gap-5 pb-5">
          <button
            type="button"
            onClick={onUploadPassportClick}
            title={
              onUploadPassportClick
                ? 'Click to upload or change portrait photo'
                : 'Applicant Portrait'
            }
            className="w-[84px] sm:w-[96px] h-[104px] sm:h-[118px] bg-[#1B3047] border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center relative group cursor-pointer"
          >
            {model.passportImageUrl ? (
              <img
                src={model.passportImageUrl}
                alt={model.displayName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 96 118"
                className="w-full h-full"
              >
                <rect width="96" height="118" fill="#1B3047" />
                <circle cx="48" cy="44" r="18" fill="#D9A384" />
                <path d="M18 118 C18 82 78 82 78 118 Z" fill="#2B3D54" />
                <polygon points="44,74 52,74 48,100" fill="#5B87AC" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0 pt-1">
            <h1
              className="font-normal text-[#5B87AC] tracking-tight leading-tight break-words"
              style={{ fontSize: `${(parseFloat(m.namePx) * 1.18).toFixed(2)}px` }}
            >
              {model.displayName}
            </h1>
            {model.displayRole && (
              <p
                className="text-[#64748B] font-medium mt-0.5 break-words"
                style={{ fontSize: m.rolePx }}
              >
                {model.displayRole}
              </p>
            )}
            <div className="h-[2.5px] w-full bg-[#5B87AC] mt-3" />
          </div>
        </header>

        {/* Page 1 Two-Column Split with Vertical Steel Blue Spine */}
        <div className="grid grid-cols-1 sm:grid-cols-[33%_2px_1fr] gap-y-4 sm:gap-x-5 flex-1">
          <div className={m.sectionGap}>{model.page1Left.map(renderSection)}</div>
          <div className="hidden sm:block bg-[#5B87AC] w-[2px] h-full" aria-hidden="true" />
          <div className={m.sectionGap}>{model.page1Right.map(renderSection)}</div>
        </div>

        {renderPageCornerFooter(1)}
      </article>

      {/* PAGE 2 */}
      <article
        style={{ fontFamily: sansFont }}
        className={`a4-paper-sheet w-full max-w-[794px] ${aspectRatioClass(
          aspectMode
        )} bg-white text-[#2D3748] border border-slate-300 shadow-md rounded-sm px-6 py-7 sm:px-9 sm:py-8 overflow-hidden select-text flex flex-col gap-5`}
      >
        {(model.page2Left.length > 0 || model.page2Right.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-[33%_2px_1fr] gap-y-4 sm:gap-x-5">
            <div className={m.sectionGap}>{model.page2Left.map(renderSection)}</div>
            <div className="hidden sm:block bg-[#5B87AC] w-[2px] h-full" aria-hidden="true" />
            <div className={m.sectionGap}>{model.page2Right.map(renderSection)}</div>
          </div>
        )}

        {model.page2FullWidth.length > 0 && (
          <div className={`pt-1 ${m.sectionGap}`}>
            {model.page2FullWidth.map(renderSection)}
          </div>
        )}

        {renderPageCornerFooter(2)}
      </article>
    </div>
  );
};

// ============================================================================
// TEMPLATE 5: ROYAL PASSPORT EXECUTIVE (Matches Passport Image Reference)
// Requires Passport Photo: Circular Frame, Diagonal Ribbons, #EAEFF5 Left Panel, #0B2D4D Badges
// ============================================================================
const RoyalPassportSheet: React.FC<{
  model: SinglePageDocumentModel;
  textScalePct: number;
  aspectMode: PreviewAspectMode;
  onUploadPassportClick?: () => void;
  ariaLabel: string;
}> = ({ model, textScalePct, aspectMode, onUploadPassportClick, ariaLabel }) => {
  const m = makeFontMetrics(model.density, textScalePct);
  const serifFont = 'Georgia, "Times New Roman", serif';
  const sansFont = '"Plus Jakarta Sans", "Helvetica Neue", Arial, sans-serif';

  const renderSidebarSection = (sec: TemplateSection, idx: number) => {
    const isTopNavyPill = idx === 0;
    return (
      <div key={sec.id} className="space-y-1.5">
        {isTopNavyPill ? (
          <div className="inline-flex w-full items-center gap-2 rounded-full bg-[#0B2D4D] px-2.5 py-1 text-white">
            <span className="w-4 h-4 rounded-full bg-white text-[#0B2D4D] flex items-center justify-center shrink-0">
              {renderSectionBadgeIcon(sec.heading, 'w-2.5 h-2.5')}
            </span>
            <h3
              className="font-bold uppercase tracking-wider text-white truncate"
              style={{ fontSize: m.headingPx }}
            >
              {sec.heading}
            </h3>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-[#0B2D4D] text-white flex items-center justify-center shrink-0">
                {renderSectionBadgeIcon(sec.heading, 'w-2.5 h-2.5')}
              </span>
              <h3
                className="font-bold uppercase tracking-wider text-[#0B2D4D]"
                style={{ fontSize: m.headingPx }}
              >
                {sec.heading}
              </h3>
            </div>
            <div className="h-[1px] w-full bg-[#1D70B8]" />
          </div>
        )}

        {sec.kind === 'bullets' && sec.bullets && (
          <ul
            className="space-y-0.5 text-[#1E293B]"
            style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
          >
            {sec.bullets.map((b, j) => (
              <li key={`rpb-${j}`} className="flex items-start gap-1.5 break-words">
                <span className="text-[#0B2D4D] font-bold shrink-0">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        {sec.kind === 'subgroups' && sec.subgroups && (
          <div className="space-y-1">
            {sec.subgroups.map((sg, j) => (
              <div key={`rpsg-${j}`} className="space-y-0.5">
                {sg.subtitle && (
                  <div className="font-bold text-[#0B2D4D]" style={{ fontSize: m.metaPx }}>
                    {sg.subtitle}
                  </div>
                )}
                <ul
                  className="space-y-0.5 text-[#1E293B]"
                  style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                >
                  {sg.items.map((item, k) => (
                    <li key={`rpsgi-${k}`} className="flex items-start gap-1.5 break-words">
                      <span className="text-[#0B2D4D] font-bold shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {sec.kind === 'paragraph' && sec.text && (
          <p
            className="text-[#1E293B] text-justify whitespace-pre-line break-words"
            style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
          >
            {sec.text}
          </p>
        )}
      </div>
    );
  };

  const renderMainSection = (sec: TemplateSection) => (
    <div key={sec.id} className="space-y-1.5">
      {/* #0B2D4D rounded pill badge + inline Cerulean #1D70B8 rule */}
      <div className="flex items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-[#0B2D4D] px-2.5 py-0.5 text-white shrink-0">
          <span className="text-white">{renderSectionBadgeIcon(sec.heading, 'w-3 h-3')}</span>
          <h2
            className="font-bold uppercase tracking-wider text-white"
            style={{ fontSize: m.headingPx }}
          >
            {sec.heading}
          </h2>
        </div>
        <div className="h-[1.5px] flex-1 bg-[#1D70B8]" />
      </div>

      {sec.kind === 'paragraph' && sec.text && (
        <p
          className="text-[#1E293B] text-justify whitespace-pre-line break-words"
          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.text}
        </p>
      )}

      {sec.kind === 'paragraphs' && sec.paragraphs && (
        <div className="space-y-1">
          {sec.paragraphs.map((p, idx) => (
            <p
              key={`rpp-${idx}`}
              className="text-[#1E293B] text-justify whitespace-pre-line break-words"
              style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
            >
              {p}
            </p>
          ))}
        </div>
      )}

      {sec.kind === 'bullets' && sec.bullets && (
        <ul
          className="space-y-0.5 text-[#1E293B]"
          style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
        >
          {sec.bullets.map((b, idx) => {
            const isCitation = /^\[\d+\]\s/.test(b);
            return (
              <li
                key={`rpmb-${idx}`}
                className={`break-words ${isCitation ? 'pl-4 -indent-4' : 'flex items-start gap-1.5'}`}
              >
                {!isCitation && <span className="text-[#0B2D4D] font-bold shrink-0">•</span>}
                <span>{b}</span>
              </li>
            );
          })}
        </ul>
      )}

      {sec.kind === 'entries' && sec.entries && (
        <div className={m.itemGap}>
          {sec.entries.map((entry, eIdx) => (
            <div key={`rpe-${eIdx}`} className="space-y-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span className="font-bold text-[#0F172A]" style={{ fontSize: m.subHeadingPx }}>
                  {entry.primary}
                </span>
                {entry.dateRange && (
                  <span className="font-semibold text-[#1E293B] shrink-0" style={{ fontSize: m.metaPx }}>
                    {entry.dateRange}
                  </span>
                )}
              </div>
              {entry.secondary && (
                <div className="italic text-[#334155]" style={{ fontSize: m.bodyPx }}>
                  {entry.secondary}
                </div>
              )}
              {entry.bodyText && (
                <p
                  className="text-[#1E293B] whitespace-pre-line break-words"
                  style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                >
                  {entry.bodyText}
                </p>
              )}
              {entry.bullets && entry.bullets.length > 0 && (
                <ul
                  className="space-y-0.5 pl-1 text-[#1E293B]"
                  style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}
                >
                  {entry.bullets.map((b, bIdx) => (
                    <li key={`rpeb-${bIdx}`} className="flex items-start gap-1.5 break-words">
                      <span className="text-[#0B2D4D] font-bold shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {sec.kind === 'signature' && sec.signature && (
        <div className="pt-1 text-[#1E293B]" style={{ fontSize: m.bodyPx, lineHeight: m.lineHeight }}>
          <p>{sec.signature.signOff}</p>
          <p className="font-bold mt-1 text-[#0B2D4D]">{sec.signature.name}</p>
          {sec.signature.subline && (
            <p className="text-[#475569]" style={{ fontSize: m.metaPx }}>
              {sec.signature.subline}
            </p>
          )}
        </div>
      )}
    </div>
  );

  const leftNonContactSections = model.sidebarSections.filter((sec) => sec.kind !== 'contacts');

  return (
    <article
      aria-label={ariaLabel}
      style={{ fontFamily: sansFont }}
      className={`a4-paper-sheet relative w-full max-w-[794px] ${aspectRatioClass(
        aspectMode
      )} bg-white text-[#1E293B] border border-slate-300 shadow-md rounded-sm overflow-hidden select-text flex flex-col justify-between`}
    >
      {/* Top-Left Diagonal Navy & Cerulean Accent Ribbons */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 w-56 h-52"
        viewBox="0 0 220 200"
      >
        <polygon points="0,0 135,0 0,145" fill="#0B2D4D" />
        <polygon points="135,0 185,0 0,185 0,145" fill="#1D70B8" />
        <polygon points="185,0 218,0 0,198 0,185" fill="#2E96D8" />
      </svg>

      {/* Top Header: Circular Passport Photo + Serif Name + Contact Grid */}
      <header className="relative z-10 px-5 pt-5 pb-3 flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <button
          type="button"
          onClick={onUploadPassportClick}
          title="Upload required passport photo"
          className="w-[120px] h-[120px] sm:w-[132px] sm:h-[132px] rounded-full border-[4px] border-white ring-[3px] ring-[#0B2D4D] bg-slate-100 shadow-md overflow-hidden shrink-0 flex flex-col items-center justify-center text-center cursor-pointer group"
        >
          {model.passportImageUrl ? (
            <img
              src={model.passportImageUrl}
              alt={model.displayName}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="flex flex-col items-center justify-center px-3 text-[#0B2D4D]">
              <Camera className="w-6 h-6 mb-1 text-[#1D70B8]" />
              <span className="text-[10px] font-bold uppercase tracking-wide leading-tight">
                Upload Passport Photo
              </span>
            </span>
          )}
        </button>

        <div className="flex-1 min-w-0 w-full pt-1 text-center sm:text-left">
          <h1
            className="font-bold text-[#0B2D4D] leading-tight break-words"
            style={{ fontFamily: serifFont, fontSize: `${(parseFloat(m.namePx) * 1.15).toFixed(2)}px` }}
          >
            {model.displayName}
          </h1>
          {model.displayRole && (
            <p
              className="font-medium uppercase tracking-[0.22em] text-[#1E293B] mt-0.5 break-words"
              style={{ fontSize: m.rolePx }}
            >
              {model.displayRole}
            </p>
          )}
          <div className="h-[1.5px] w-full bg-[#1D70B8] my-2" />

          {model.contacts.length > 0 && (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-[#1E293B]"
              style={{ fontSize: m.metaPx }}
            >
              {model.contacts.map((c, idx) => (
                <div key={`rpc-${idx}`} className="flex items-center gap-1.5 min-w-0">
                  <span className="w-4 h-4 rounded-sm bg-[#0B2D4D] text-white flex items-center justify-center shrink-0">
                    {renderContactIcon(c.icon, 'w-2.5 h-2.5')}
                  </span>
                  <span className="truncate">{c.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Main Two-Column Body */}
      <div className="relative z-10 px-5 pb-3 grid grid-cols-1 sm:grid-cols-[34%_1fr] gap-4 flex-1 items-start">
        <aside className={`bg-[#EAEFF5] rounded-2xl p-3.5 ${m.sectionGap}`}>
          {leftNonContactSections.map((sec, idx) => renderSidebarSection(sec, idx))}
        </aside>

        <div className={m.sectionGap}>
          {model.mainSections.map(renderMainSection)}
          {model.trailingSections.map(renderMainSection)}
        </div>
      </div>

      {/* Bottom Navy Motto Footer with Corner Accent */}
      <footer className="relative z-10 mt-auto bg-[#0B2D4D] text-white px-6 py-2.5 flex items-center justify-center overflow-hidden">
        <div className="flex items-center gap-3 w-full max-w-xl justify-center">
          <span className="hidden sm:block h-[1px] flex-1 bg-white/40" aria-hidden="true" />
          <p
            className="italic text-center text-white/95 truncate"
            style={{ fontFamily: serifFont, fontSize: m.metaPx }}
          >
            {model.footerMotto || model.displayRole || 'Excellence Through Precision & Integrity'}
          </p>
          <span className="hidden sm:block h-[1px] flex-1 bg-white/40" aria-hidden="true" />
        </div>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-0 bottom-0 h-full w-24"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
        >
          <polygon points="35,40 100,0 100,40" fill="#1D70B8" />
          <polygon points="62,40 100,12 100,40" fill="#2E96D8" />
        </svg>
      </footer>
    </article>
  );
};

// ============================================================================
// MAIN PREVIEW ENTRYPOINT (Default + 5 Selectable Templates)
// ============================================================================
export const DocumentA4Preview: React.FC<DocumentA4PreviewProps> = ({
  payload,
  zoomPct = 100,
  textScalePct = 100,
  aspectMode = 'a4',
  onUploadPassportClick,
  className = '',
}) => {
  const meta = getCategoryMeta(payload.category);
  const templateId = getPayloadTemplateId(payload);
  const blueprint = useMemo(() => buildDocumentBlueprint(payload), [payload]);
  const singlePageModel = useMemo(
    () =>
      templateId === 'default' || templateId === 'slate_two_page'
        ? null
        : buildSinglePageDocumentModel(payload),
    [payload, templateId]
  );
  const twoPageModel = useMemo(
    () => (templateId === 'slate_two_page' ? buildTwoPageDocumentModel(payload) : null),
    [payload, templateId]
  );
  const hasContent = useMemo(() => hasAnyUserInput(payload), [payload]);

  const textMul = Math.max(0.8, Math.min(1.25, textScalePct / 100));
  const dPx = (base: number) => `${(base * textMul).toFixed(2)}px`;

  const isCentered =
    blueprint.headerStyle === 'ats-centered' ||
    blueprint.headerStyle === 'academic-essay' ||
    blueprint.headerStyle === 'research-title' ||
    blueprint.headerStyle === 'study-plan';

  const isFormalLetter = blueprint.headerStyle === 'formal-letter';
  const showHeaderRule = blueprint.blocks[0]?.kind !== 'section-heading';

  if (!hasContent) {
    return (
      <div
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
        className={`a4-paper-sheet w-full bg-white rounded-xl border border-slate-300 shadow-sm min-h-[460px] sm:min-h-[620px] flex flex-col items-center justify-center p-6 sm:p-10 text-center font-serif ${className}`}
      >
        <div className="w-12 h-12 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] flex items-center justify-center text-[#0e627c] mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <span className="px-2.5 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-[#0f2b46] text-[10px] font-bold uppercase tracking-wider mb-2 font-serif">
          {meta.label} · A4 Ready
        </span>
        <h3 className="text-sm sm:text-base font-bold text-[#0f2b46] font-serif">
          Awaiting Document Details
        </h3>
        <p className="text-xs text-slate-600 max-w-sm mt-1.5 leading-relaxed font-serif">
          Complete the {meta.label} fields on the form, then click{' '}
          <strong className="text-[#0e627c]">Update View</strong> or type directly to see your
          print-ready A4 layout rendered live.
        </p>
      </div>
    );
  }

  if (templateId === 'navy_sidebar' && singlePageModel) {
    return (
      <div className={`w-full ${className}`}>
        <ZoomSheetFrame zoomPct={zoomPct}>
          <NavySidebarSheet
            model={singlePageModel}
            textScalePct={textScalePct}
            aspectMode={aspectMode}
            ariaLabel={`${meta.label} Navy Sidebar A4 Preview`}
          />
        </ZoomSheetFrame>
      </div>
    );
  }

  if (templateId === 'warm_editorial' && singlePageModel) {
    return (
      <div className={`w-full ${className}`}>
        <ZoomSheetFrame zoomPct={zoomPct}>
          <WarmEditorialSheet
            model={singlePageModel}
            textScalePct={textScalePct}
            aspectMode={aspectMode}
            ariaLabel={`${meta.label} Warm Editorial A4 Preview`}
          />
        </ZoomSheetFrame>
      </div>
    );
  }

  if (templateId === 'swiss_minimal' && singlePageModel) {
    return (
      <div className={`w-full ${className}`}>
        <ZoomSheetFrame zoomPct={zoomPct}>
          <SwissMinimalSheet
            model={singlePageModel}
            textScalePct={textScalePct}
            aspectMode={aspectMode}
            ariaLabel={`${meta.label} Swiss Minimal A4 Preview`}
          />
        </ZoomSheetFrame>
      </div>
    );
  }

  if (templateId === 'slate_two_page' && twoPageModel) {
    return (
      <div className={`w-full ${className}`}>
        <ZoomSheetFrame zoomPct={zoomPct}>
          <SlateTwoPageSheet
            model={twoPageModel}
            textScalePct={textScalePct}
            aspectMode={aspectMode}
            onUploadPassportClick={onUploadPassportClick}
            ariaLabel={`${meta.label} 2-Page Slate Preview`}
          />
        </ZoomSheetFrame>
      </div>
    );
  }

  if (templateId === 'royal_passport' && singlePageModel) {
    return (
      <div className={`w-full ${className}`}>
        <ZoomSheetFrame zoomPct={zoomPct}>
          <RoyalPassportSheet
            model={singlePageModel}
            textScalePct={textScalePct}
            aspectMode={aspectMode}
            onUploadPassportClick={onUploadPassportClick}
            ariaLabel={`${meta.label} Passport Executive Preview`}
          />
        </ZoomSheetFrame>
      </div>
    );
  }

  // RETAINED DEFAULT TEMPLATE (Classic Executive Serif)
  return (
    <div className={`w-full ${className}`}>
      <ZoomSheetFrame zoomPct={zoomPct}>
        <article
          aria-label={`${meta.label} A4 Preview`}
          style={{ fontFamily: '"Times New Roman", Times, serif' }}
          className={`a4-paper-sheet w-full max-w-[794px] ${
            aspectMode === 'auto' ? 'min-h-[780px]' : aspectRatioClass(aspectMode)
          } bg-white text-[#1e293b] border border-slate-300 shadow-md rounded-sm px-5 py-6 sm:px-12 sm:py-11 select-text font-serif flex flex-col justify-between gap-8`}
        >
          <div>
            {!isFormalLetter && (
              <header
                className={`${showHeaderRule ? 'pb-3 mb-4 border-b-[1.5px] border-[#0e627c]' : 'pb-2 mb-3'} ${
                  isCentered ? 'text-center' : 'text-left'
                }`}
              >
                <h1
                  className="font-bold text-[#0f2b46] leading-tight tracking-wide break-words font-serif"
                  style={{ fontSize: dPx(24) }}
                >
                  {blueprint.title}
                </h1>

                {blueprint.subtitle && (
                  <p
                    className={`mt-1 text-[#0e627c] tracking-wide font-serif ${
                      blueprint.uppercaseHeaderSubtitle ? 'font-bold uppercase' : 'italic font-medium'
                    }`}
                    style={{ fontSize: dPx(12.5) }}
                  >
                    {blueprint.subtitle}
                  </p>
                )}

                {blueprint.contactLine && (
                  <p
                    className="mt-1.5 text-[#475569] break-words font-serif"
                    style={{ fontSize: dPx(11.5) }}
                  >
                    {blueprint.contactLine}
                  </p>
                )}

                {blueprint.secondaryContactLine && (
                  <p
                    className="mt-0.5 text-[#475569] break-words font-serif"
                    style={{ fontSize: dPx(11) }}
                  >
                    {blueprint.secondaryContactLine}
                  </p>
                )}
              </header>
            )}

            <div
              className="space-y-3 text-[#1e293b] font-serif"
              style={{ fontSize: dPx(13), lineHeight: 1.55 }}
            >
              {blueprint.blocks.map((block, bIdx) => {
                if (block.kind === 'section-heading') {
                  return (
                    <h2
                      key={`blk-${bIdx}`}
                      className="pt-2 pb-1 font-bold tracking-wide text-[#0f2b46] border-b-[1.5px] border-[#0e627c] uppercase font-serif"
                      style={{ fontSize: dPx(13.5) }}
                    >
                      {block.title}
                    </h2>
                  );
                }

                if (block.kind === 'paragraph') {
                  const alignCls =
                    block.align === 'justify'
                      ? 'text-justify'
                      : block.align === 'center'
                      ? 'text-center'
                      : block.align === 'right'
                      ? 'text-right'
                      : 'text-left';
                  return (
                    <p
                      key={`blk-${bIdx}`}
                      className={`whitespace-pre-line break-words font-serif ${alignCls} ${
                        block.bold ? 'font-bold text-[#0f2b46]' : ''
                      } ${block.italic ? 'italic' : ''} ${
                        block.underlineRule ? 'pb-1.5 border-b-[1.5px] border-[#0e627c]' : ''
                      }`}
                    >
                      {block.text}
                    </p>
                  );
                }

                if (block.kind === 'labeled-line') {
                  return (
                    <p key={`blk-${bIdx}`} className="text-left break-words font-serif">
                      <strong className="font-bold text-[#0f2b46]">{block.label}: </strong>
                      <span>{block.value}</span>
                    </p>
                  );
                }

                if (block.kind === 'bullet-list') {
                  const hasCitations = block.items.some((item) => /^\[\d+\]\s/.test(item));
                  return (
                    <ul
                      key={`blk-${bIdx}`}
                      className={`${
                        hasCitations ? 'list-none pl-0 space-y-1.5' : 'list-disc pl-5 space-y-1'
                      } font-serif`}
                    >
                      {block.items.map((item, iIdx) => (
                        <li
                          key={`li-${bIdx}-${iIdx}`}
                          className={`text-left break-words font-serif ${
                            /^\[\d+\]\s/.test(item) ? 'pl-5 -indent-5' : ''
                          }`}
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  );
                }

                if (block.kind === 'entries') {
                  return (
                    <div key={`blk-${bIdx}`} className="space-y-3 font-serif">
                      {block.items.map((entry, eIdx) => (
                        <div key={`ent-${bIdx}-${eIdx}`} className="space-y-0.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                            <span
                              className="font-bold text-[#0f2b46]"
                              style={{ fontSize: dPx(13.5) }}
                            >
                              {entry.primaryLeft}
                            </span>
                            {entry.primaryRight && (
                              <span
                                className="text-[#475569] shrink-0"
                                style={{ fontSize: dPx(11.5) }}
                              >
                                {entry.primaryRight}
                              </span>
                            )}
                          </div>
                          {(entry.secondaryLeft || entry.secondaryRight) && (
                            <div
                              className="flex flex-wrap items-baseline justify-between gap-x-2 text-[#475569] italic"
                              style={{ fontSize: dPx(11.5) }}
                            >
                              <span>{entry.secondaryLeft}</span>
                              {entry.secondaryRight && (
                                <span className="shrink-0">{entry.secondaryRight}</span>
                              )}
                            </div>
                          )}
                          {entry.bodyText && (
                            <p className="text-[#1e293b] pt-0.5 whitespace-pre-line break-words">
                              {entry.bodyText}
                            </p>
                          )}
                          {entry.bullets && entry.bullets.length > 0 && (
                            <ul className="list-disc pl-5 pt-1 space-y-0.5">
                              {entry.bullets.map((b, k) => (
                                <li key={`eb-${bIdx}-${eIdx}-${k}`} className="break-words">
                                  {b}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                }

                if (block.kind === 'table') {
                  return (
                    <div key={`blk-${bIdx}`} className="overflow-x-auto font-serif">
                      <table
                        className="w-full border-collapse border border-slate-300"
                        style={{ fontSize: dPx(11.5) }}
                      >
                        <thead>
                          <tr className="bg-slate-100">
                            {block.columns.map((col, cIdx) => (
                              <th
                                key={`th-${bIdx}-${cIdx}`}
                                style={
                                  block.colWidthsPct?.[cIdx]
                                    ? { width: `${block.colWidthsPct[cIdx]}%` }
                                    : undefined
                                }
                                className="border border-slate-300 px-2.5 py-1.5 text-left font-bold text-[#0e627c]"
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {block.rows.map((row, rIdx) => (
                            <tr key={`tr-${bIdx}-${rIdx}`}>
                              {block.columns.map((_, cIdx) => (
                                <td
                                  key={`td-${bIdx}-${rIdx}-${cIdx}`}
                                  className={`border border-slate-300 px-2.5 py-1.5 align-top break-words ${
                                    cIdx === 0 ? 'font-bold text-[#0f2b46]' : 'text-[#1e293b]'
                                  }`}
                                >
                                  {row[cIdx] || '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                }

                if (block.kind === 'address-block') {
                  return (
                    <div
                      key={`blk-${bIdx}`}
                      className={`space-y-0.5 font-serif ${
                        block.align === 'right' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {block.lines.map((ln, lIdx) => (
                        <div
                          key={`addr-${bIdx}-${lIdx}`}
                          className={lIdx === 0 ? 'font-bold text-[#0f2b46]' : 'text-[#1e293b]'}
                        >
                          {ln}
                        </div>
                      ))}
                    </div>
                  );
                }

                if (block.kind === 'meta-grid') {
                  return (
                    <div
                      key={`blk-${bIdx}`}
                      className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1 font-serif"
                      style={{ fontSize: dPx(11.5) }}
                    >
                      {block.rows.map((row, rIdx) => (
                        <div key={`meta-${bIdx}-${rIdx}`} className="flex flex-wrap gap-1.5">
                          <span className="font-bold text-[#0e627c] min-w-[130px] shrink-0">
                            {row.label}:
                          </span>
                          <span className="text-[#0f2b46] flex-1 break-words">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                }

                if (block.kind === 'signature') {
                  return (
                    <div key={`blk-${bIdx}`} className="pt-4 space-y-2 font-serif">
                      <p>{block.signOff}</p>
                      <div className="pt-2">
                        <p className="font-bold text-[#0f2b46]">{block.name}</p>
                        {block.subline && (
                          <p className="text-[#475569]" style={{ fontSize: dPx(11) }}>
                            {block.subline}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>

          {blueprint.footerText && (
            <footer
              className="pt-2.5 border-t border-slate-300 text-center uppercase tracking-wider text-[#64748b] font-serif"
              style={{ fontSize: dPx(9.5) }}
            >
              {blueprint.footerText}
            </footer>
          )}
        </article>
      </ZoomSheetFrame>
    </div>
  );
};
