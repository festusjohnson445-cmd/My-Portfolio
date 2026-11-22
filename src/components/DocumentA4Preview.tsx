import React, { useMemo } from 'react';
import { FileText } from 'lucide-react';
import {
  DocumentFormPayload,
  getCategoryMeta,
} from '../types/documentWorkspace';
import { buildDocumentBlueprint } from '../utils/documentExport';

interface DocumentA4PreviewProps {
  payload: DocumentFormPayload;
  zoomPct?: number;
  className?: string;
}

const hasAnyUserInput = (payload: DocumentFormPayload): boolean => {
  switch (payload.category) {
    case 'international_cv':
      return Boolean(
        payload.data.header.fullName.trim() ||
          payload.data.header.email.trim() ||
          payload.data.professionalSummary.trim() ||
          payload.data.coreCompetencies.trim() ||
          payload.data.experiences.some((e) => e.roleTitle.trim() || e.organization.trim()) ||
          payload.data.education.some((e) => e.degree.trim() || e.institution.trim())
      );
    case 'academic_resume':
      return Boolean(
        payload.data.header.fullName.trim() ||
          payload.data.researchProfile.trim() ||
          payload.data.education.some((e) => e.degree.trim() || e.institution.trim()) ||
          payload.data.publications.some((p) => p.citation.trim())
      );
    case 'job_resume':
      return Boolean(
        payload.data.header.fullName.trim() ||
          payload.data.targetJobTitle.trim() ||
          payload.data.professionalSummary.trim() ||
          payload.data.workExperience.some((w) => w.roleTitle.trim() || w.organization.trim())
      );
    case 'sop':
      return Boolean(
        payload.data.applicantName.trim() ||
          payload.data.targetDegreeAndProgram.trim() ||
          payload.data.openingMotivation.trim() ||
          payload.data.academicFoundation.trim()
      );
    case 'personal_statement':
      return Boolean(
        payload.data.applicantName.trim() ||
          payload.data.targetProgramOrOpportunity.trim() ||
          payload.data.definingStoryAndOrigin.trim() ||
          payload.data.challengesAndResilience.trim()
      );
    case 'scholarship_letter':
      return Boolean(
        payload.data.applicantName.trim() ||
          payload.data.scholarshipName.trim() ||
          payload.data.purposeAndStanding.trim() ||
          payload.data.motivationAndMerit.trim()
      );
    case 'research_proposal':
      return Boolean(
        payload.data.proposalTitle.trim() ||
          payload.data.applicantName.trim() ||
          payload.data.abstractSummary.trim() ||
          payload.data.problemStatement.trim()
      );
    case 'study_plan':
      return Boolean(
        payload.data.applicantName.trim() ||
          payload.data.targetDegree.trim() ||
          payload.data.purposeAndSpecialization.trim() ||
          payload.data.academicBackground.trim()
      );
  }
};

export const DocumentA4Preview: React.FC<DocumentA4PreviewProps> = ({
  payload,
  zoomPct = 100,
  className = '',
}) => {
  const meta = getCategoryMeta(payload.category);
  const blueprint = useMemo(() => buildDocumentBlueprint(payload), [payload]);
  const hasContent = useMemo(() => hasAnyUserInput(payload), [payload]);

  const isCentered =
    blueprint.headerStyle === 'ats-centered' ||
    blueprint.headerStyle === 'academic-essay' ||
    blueprint.headerStyle === 'research-title' ||
    blueprint.headerStyle === 'study-plan';

  const paperFontClass = blueprint.fontMode === 'sans' ? 'font-sans' : 'font-serif';

  if (!hasContent) {
    return (
      <div
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
        className={`w-full bg-white rounded-xl border border-slate-300 shadow-sm min-h-[460px] sm:min-h-[620px] flex flex-col items-center justify-center p-6 sm:p-10 text-center font-serif ${className}`}
      >
        <div className="w-12 h-12 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] flex items-center justify-center text-cyan-900 mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <span className="px-2.5 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-900 text-[10px] font-bold uppercase tracking-wider mb-2 font-serif">
          {meta.label} · A4 Ready
        </span>
        <h3 className="text-sm sm:text-base font-bold text-slate-900 font-serif">
          Awaiting Document Details
        </h3>
        <p className="text-xs text-slate-600 max-w-sm mt-1.5 leading-relaxed font-serif">
          Complete the {meta.label} fields on the form, then click{' '}
          <strong className="text-cyan-900">Update View</strong> or type directly to see your
          print-ready A4 layout rendered live with selectable text.
        </p>
      </div>
    );
  }

  return (
    <div className={`w-full flex justify-center ${className}`}>
      <article
        aria-label={`${meta.label} A4 Preview`}
        style={{
          fontSize: `${Math.max(85, Math.min(115, zoomPct))}%`,
        }}
        className={`w-full max-w-[794px] bg-white text-slate-900 border border-slate-300 shadow-md rounded-sm px-5 py-6 sm:px-11 sm:py-12 min-h-[560px] sm:min-h-[960px] select-text ${paperFontClass}`}
      >
        {/* Document Top Header */}
        <header
          className={`pb-3 mb-4 border-b-2 border-slate-900 ${
            isCentered ? 'text-center' : 'text-left'
          }`}
        >
          <h1
            className={`font-bold text-slate-950 leading-tight break-words ${
              blueprint.headerStyle === 'formal-letter'
                ? 'text-base sm:text-xl'
                : 'text-lg sm:text-2xl'
            }`}
          >
            {blueprint.title}
          </h1>

          {blueprint.subtitle && (
            <p
              className={`mt-1 text-xs sm:text-sm text-cyan-900 ${
                blueprint.fontMode === 'serif' ? 'italic' : 'font-semibold'
              }`}
            >
              {blueprint.subtitle}
            </p>
          )}

          {blueprint.contactLine && (
            <p className="mt-1.5 text-[11px] sm:text-xs text-slate-700 break-words">
              {blueprint.contactLine}
            </p>
          )}

          {blueprint.secondaryContactLine && (
            <p className="mt-0.5 text-[10.5px] sm:text-[11.5px] text-slate-600 break-words">
              {blueprint.secondaryContactLine}
            </p>
          )}
        </header>

        {/* Body Blocks */}
        <div className="space-y-3 text-[11.5px] sm:text-[13px] leading-relaxed text-slate-800">
          {blueprint.blocks.map((block, bIdx) => {
            if (block.kind === 'section-heading') {
              return (
                <h2
                  key={`blk-${bIdx}`}
                  className="pt-2 pb-1 text-[11.5px] sm:text-[13.5px] font-bold tracking-wide text-slate-950 border-b border-slate-300 uppercase"
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
                  className={`whitespace-pre-line break-words ${alignCls} ${
                    block.bold ? 'font-bold text-slate-950' : ''
                  } ${block.italic ? 'italic' : ''}`}
                >
                  {block.text}
                </p>
              );
            }

            if (block.kind === 'labeled-line') {
              return (
                <p key={`blk-${bIdx}`} className="text-left break-words">
                  <strong className="font-bold text-slate-950">{block.label}: </strong>
                  <span>{block.value}</span>
                </p>
              );
            }

            if (block.kind === 'bullet-list') {
              return (
                <ul key={`blk-${bIdx}`} className="list-disc pl-5 space-y-1">
                  {block.items.map((item, iIdx) => (
                    <li key={`li-${bIdx}-${iIdx}`} className="text-left break-words">
                      {item}
                    </li>
                  ))}
                </ul>
              );
            }

            if (block.kind === 'entries') {
              return (
                <div key={`blk-${bIdx}`} className="space-y-3">
                  {block.items.map((entry, eIdx) => (
                    <div key={`ent-${bIdx}-${eIdx}`} className="space-y-0.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="font-bold text-slate-950 text-[12px] sm:text-[13.5px]">
                          {entry.primaryLeft}
                        </span>
                        {entry.primaryRight && (
                          <span className="text-[11px] sm:text-xs text-slate-600 shrink-0">
                            {entry.primaryRight}
                          </span>
                        )}
                      </div>
                      {(entry.secondaryLeft || entry.secondaryRight) && (
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-slate-700 italic text-[11px] sm:text-xs">
                          <span>{entry.secondaryLeft}</span>
                          {entry.secondaryRight && (
                            <span className="shrink-0">{entry.secondaryRight}</span>
                          )}
                        </div>
                      )}
                      {entry.bodyText && (
                        <p className="text-slate-800 pt-0.5 whitespace-pre-line break-words">
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

            if (block.kind === 'address-block') {
              return (
                <div
                  key={`blk-${bIdx}`}
                  className={`space-y-0.5 ${
                    block.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {block.lines.map((ln, lIdx) => (
                    <div
                      key={`addr-${bIdx}-${lIdx}`}
                      className={lIdx === 0 ? 'font-bold text-slate-950' : 'text-slate-700'}
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
                  className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1 text-[11px] sm:text-xs"
                >
                  {block.rows.map((row, rIdx) => (
                    <div key={`meta-${bIdx}-${rIdx}`} className="flex flex-wrap gap-1.5">
                      <span className="font-bold text-cyan-900 min-w-[125px] shrink-0">
                        {row.label}:
                      </span>
                      <span className="text-slate-900 flex-1 break-words">{row.value}</span>
                    </div>
                  ))}
                </div>
              );
            }

            if (block.kind === 'signature') {
              return (
                <div key={`blk-${bIdx}`} className="pt-4 space-y-2">
                  <p>{block.signOff}</p>
                  <div className="pt-2">
                    <p className="font-bold text-slate-950">{block.name}</p>
                    {block.subline && (
                      <p className="text-[11px] text-slate-600">{block.subline}</p>
                    )}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>
      </article>
    </div>
  );
};
