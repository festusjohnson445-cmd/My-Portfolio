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
          (payload.data.experiences || []).some((e) => safeTrim(e?.roleTitle) || safeTrim(e?.organization)) ||
          (payload.data.leadershipRoles || []).some((e) => safeTrim(e?.roleTitle) || safeTrim(e?.organization)) ||
          (payload.data.selectedProjects || []).some((p) => safeTrim(p?.name)) ||
          (payload.data.education || []).some((e) => safeTrim(e?.degree) || safeTrim(e?.institution)) ||
          safeTrim(payload.data.technicalTraining)
      );
    case 'academic_resume':
      return Boolean(
        safeTrim(payload.data.header?.fullName) ||
          safeTrim(payload.data.researchProfile) ||
          (payload.data.education || []).some((e) => safeTrim(e?.degree) || safeTrim(e?.institution)) ||
          (payload.data.professionalExperience || []).some((e) => safeTrim(e?.roleTitle) || safeTrim(e?.organization)) ||
          (payload.data.leadershipRoles || []).some((e) => safeTrim(e?.roleTitle) || safeTrim(e?.organization)) ||
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
          (payload.data.workExperience || []).some((w) => safeTrim(w?.roleTitle) || safeTrim(w?.organization)) ||
          (payload.data.leadershipRoles || []).some((l) => safeTrim(l?.roleTitle) || safeTrim(l?.organization)) ||
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

  return (
    <div className={`w-full flex justify-center ${className}`}>
      <article
        aria-label={`${meta.label} A4 Preview`}
        style={{
          fontSize: `${Math.max(85, Math.min(115, zoomPct))}%`,
          fontFamily: '"Times New Roman", Times, serif',
        }}
        className="a4-paper-sheet w-full max-w-[794px] bg-white text-[#1e293b] border border-slate-300 shadow-md rounded-sm px-5 py-6 sm:px-12 sm:py-11 min-h-[560px] sm:min-h-[960px] select-text font-serif flex flex-col justify-between gap-8"
      >
        <div>
          {/* Document Top Header */}
          {!isFormalLetter && (
            <header
              className={`${showHeaderRule ? 'pb-3 mb-4 border-b-[1.5px] border-[#0e627c]' : 'pb-2 mb-3'} ${
                isCentered ? 'text-center' : 'text-left'
              }`}
            >
              <h1 className="font-bold text-[#0f2b46] leading-tight tracking-wide break-words text-lg sm:text-[24px] font-serif">
                {blueprint.title}
              </h1>

              {blueprint.subtitle && (
                <p
                  className={`mt-1 text-[11px] sm:text-[12.5px] text-[#0e627c] tracking-wide font-serif ${
                    blueprint.uppercaseHeaderSubtitle ? 'font-bold uppercase' : 'italic font-medium'
                  }`}
                >
                  {blueprint.subtitle}
                </p>
              )}

              {blueprint.contactLine && (
                <p className="mt-1.5 text-[10.5px] sm:text-[11.5px] text-[#475569] break-words font-serif">
                  {blueprint.contactLine}
                </p>
              )}

              {blueprint.secondaryContactLine && (
                <p className="mt-0.5 text-[10px] sm:text-[11px] text-[#475569] break-words font-serif">
                  {blueprint.secondaryContactLine}
                </p>
              )}
            </header>
          )}

          {/* Body Blocks */}
          <div className="space-y-3 text-[11.5px] sm:text-[13px] leading-[1.55] text-[#1e293b] font-serif">
            {blueprint.blocks.map((block, bIdx) => {
              if (block.kind === 'section-heading') {
                return (
                  <h2
                    key={`blk-${bIdx}`}
                    className="pt-2 pb-1 text-[11.5px] sm:text-[13.5px] font-bold tracking-wide text-[#0f2b46] border-b-[1.5px] border-[#0e627c] uppercase font-serif"
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
                          <span className="font-bold text-[#0f2b46] text-[12px] sm:text-[13.5px]">
                            {entry.primaryLeft}
                          </span>
                          {entry.primaryRight && (
                            <span className="text-[11px] sm:text-xs text-[#475569] shrink-0">
                              {entry.primaryRight}
                            </span>
                          )}
                        </div>
                        {(entry.secondaryLeft || entry.secondaryRight) && (
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2 text-[#475569] italic text-[11px] sm:text-xs">
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
                    <table className="w-full border-collapse border border-slate-300 text-[11px] sm:text-xs">
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
                    className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1 text-[11px] sm:text-xs font-serif"
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
                        <p className="text-[11px] text-[#475569]">{block.subline}</p>
                      )}
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        </div>

        {/* Bottom Executive Running Footer */}
        {blueprint.footerText && (
          <footer className="pt-2.5 border-t border-slate-300 text-center text-[9.5px] sm:text-[10px] uppercase tracking-wider text-[#64748b] font-serif">
            {blueprint.footerText}
          </footer>
        )}
      </article>
    </div>
  );
};
