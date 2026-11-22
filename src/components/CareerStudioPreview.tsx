import React from 'react';
import {
  CAREER_CATEGORY_META,
  createDefaultSectionCustomization,
  resolveDocumentTitle,
  type CareerStudioCategory,
  type CareerStudioFormData,
  type CareerSectionCustomization,
} from '../utils/careerStudio';

interface CareerStudioPreviewProps {
  category: CareerStudioCategory;
  data: CareerStudioFormData;
  customization?: CareerSectionCustomization;
  compactThumbnail?: boolean;
}

function splitParagraphs(raw?: string): string[] {
  return (raw || '')
    .split(/\n{2,}|\r\n\r\n/)
    .map((s) => s.replace(/\r?\n/g, ' ').trim())
    .filter(Boolean);
}

function splitBullets(raw?: string): string[] {
  return (raw || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);
}

export const CareerStudioPreview: React.FC<CareerStudioPreviewProps> = ({
  category,
  data,
  customization,
  compactThumbnail = false,
}) => {
  const meta = CAREER_CATEGORY_META[category];
  const cfg = customization || createDefaultSectionCustomization(category);
  const hidden = new Set(cfg.hiddenSections || []);
  const order = cfg.order && cfg.order.length > 0 ? cfg.order : meta.sectionOrderDefaults;
  const fullOrder = [...order, ...meta.sectionOrderDefaults.filter((k) => !order.includes(k))];
  const visibleSections = fullOrder
    .filter((id) => !hidden.has(id) && meta.sectionLabels[id])
    .map((id) => ({
      id,
      label: cfg.customTitleOverrides?.[id]?.trim() || meta.sectionLabels[id],
    }));

  const isStrictAts = category === 'International CV' || category === 'Job Resume';
  const isAcademicFont = !isStrictAts;

  const contactItems = [
    data.email.trim(),
    data.phone.trim(),
    data.location.trim(),
    data.websiteOrLink.trim(),
    data.workAuthorization.trim(),
  ].filter(Boolean);

  const hasAnyContent =
    Boolean(
      data.fullName.trim() ||
        data.documentTitle.trim() ||
        data.professionalSummary.trim() ||
        data.researchInterests.trim() ||
        data.skillsText.trim() ||
        data.education.length ||
        data.experience.length ||
        data.projects.length ||
        data.publications.length ||
        data.secIntro.trim() ||
        data.secPersonalOrigin.trim() ||
        data.secLetterOpening.trim() ||
        data.secAbstract.trim() ||
        data.secStudyBackground.trim()
    );

  const wrapperClass = compactThumbnail
    ? `w-full h-full bg-white text-slate-900 p-4 overflow-hidden select-none pointer-events-none ${
        isAcademicFont ? 'font-serif' : 'font-sans'
      }`
    : `w-full bg-white text-slate-950 border border-slate-300 shadow-md rounded-lg p-6 sm:p-9 mx-auto select-text leading-relaxed ${
        isAcademicFont ? 'font-serif' : 'font-sans'
      }`;

  if (!hasAnyContent) {
    return (
      <div
        className={`${wrapperClass} min-h-[340px] flex flex-col items-center justify-center text-center border-dashed`}
      >
        <p className="text-xs font-bold text-slate-700">{meta.shortLabel} Preview</p>
        <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
          Enter your details in the form and click Update Preview to inspect your formatted A4 document.
        </p>
      </div>
    );
  }

  const renderSectionHeading = (title: string) => (
    <div className="mt-4 mb-1.5">
      <h2
        className={`font-bold uppercase tracking-wider text-slate-950 border-b ${
          isStrictAts ? 'border-slate-500 text-[11px] pb-0.5' : 'border-cyan-900 text-[11.5px] pb-0.5'
        }`}
      >
        {title}
      </h2>
    </div>
  );

  const renderParagraphs = (raw: string, justify = !isStrictAts) =>
    splitParagraphs(raw).map((p, idx) => (
      <p
        key={idx}
        className={`text-[11px] sm:text-[11.5px] text-slate-900 leading-[1.55] mb-2 ${
          justify ? 'text-justify' : 'text-left'
        }`}
      >
        {p}
      </p>
    ));

  const renderBullets = (raw: string) => {
    const items = splitBullets(raw);
    if (items.length === 0) return null;
    return (
      <ul className="list-disc pl-4.5 space-y-0.5 text-[10.5px] sm:text-[11px] text-slate-800 leading-[1.48]">
        {items.map((item, idx) => (
          <li key={idx} className={isStrictAts ? 'text-left' : 'text-justify'}>
            {item}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <article
      className={wrapperClass}
      style={compactThumbnail ? { zoom: 0.54 } : undefined}
    >
      {/* HEADER BLOCK BY CATEGORY */}
      {(isStrictAts || category === 'Academic Resume') && (
        <header className="pb-2.5 border-b-2 border-slate-900 mb-2">
          <h1 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-slate-950 leading-tight">
            {data.fullName.trim() || 'CANDIDATE NAME'}
          </h1>
          {(data.headlineOrTargetRole.trim() || data.academicAffiliation.trim()) && (
            <p
              className={`text-xs sm:text-[13px] text-slate-800 mt-0.5 ${
                isAcademicFont ? 'italic' : 'font-medium'
              }`}
            >
              {[data.headlineOrTargetRole.trim(), data.academicAffiliation.trim()]
                .filter(Boolean)
                .join(' — ')}
            </p>
          )}
          {contactItems.length > 0 && (
            <p className="text-[10px] sm:text-[10.5px] text-slate-700 mt-1 break-words">
              {contactItems.join('  |  ')}
            </p>
          )}
        </header>
      )}

      {category === 'Scholarship Motivation Letter' && (
        <header className="space-y-2.5 mb-3 text-[11px]">
          <div className="text-slate-900">
            <div className="font-bold text-sm">{data.fullName.trim() || 'Applicant Name'}</div>
            {contactItems.map((c, i) => (
              <div key={i} className="text-[10.5px] text-slate-700">
                {c}
              </div>
            ))}
          </div>
          {data.documentDate.trim() && <div className="text-slate-800">{data.documentDate.trim()}</div>}
          <div className="text-slate-900 leading-snug">
            <div className="font-semibold">Scholarship Selection Committee</div>
            {data.awardingBody.trim() && <div>{data.awardingBody.trim()}</div>}
            {data.targetInstitution.trim() && <div>{data.targetInstitution.trim()}</div>}
            {data.hostCountry.trim() && <div>{data.hostCountry.trim()}</div>}
          </div>
          <div className="font-bold uppercase tracking-wide text-[11px] text-slate-950 pt-1">
            SUBJECT: APPLICATION FOR {data.scholarshipName.trim() || 'SCHOLARSHIP'}
            {data.targetProgram.trim() ? ` — ${data.targetProgram.trim()}` : ''}
          </div>
          <div className="pt-0.5">{data.recipientSalutation.trim() || 'Dear Selection Committee,'}</div>
        </header>
      )}

      {!isStrictAts &&
        category !== 'Academic Resume' &&
        category !== 'Scholarship Motivation Letter' && (
          <header className="pb-2.5 border-b-2 border-cyan-900 mb-3">
            <h1 className="text-base sm:text-lg font-bold text-slate-950 leading-snug">
              {resolveDocumentTitle(category, data)}
            </h1>
            <div className="text-[10.5px] text-slate-700 mt-1 space-y-0.5">
              {data.fullName.trim() && (
                <div>
                  <span className="font-semibold text-slate-900">Applicant:</span> {data.fullName.trim()}
                  {contactItems.length > 0 ? `  |  ${contactItems.join('  |  ')}` : ''}
                </div>
              )}
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {[
                  data.targetProgram.trim() || data.proposedDegreeLevel.trim(),
                  data.targetDepartment.trim(),
                  data.targetInstitution.trim(),
                  data.hostCountry.trim(),
                  data.applicationTerm.trim() || data.studyDuration.trim(),
                  data.targetSupervisor.trim() ? `Supervisor: ${data.targetSupervisor.trim()}` : '',
                  data.citizenshipCountry.trim() ? `Citizenship: ${data.citizenshipCountry.trim()}` : '',
                  data.documentDate.trim(),
                ]
                  .filter(Boolean)
                  .join('  |  ')}
              </div>
            </div>
          </header>
        )}

      {/* SECTIONS BODY */}
      <div className="space-y-2">
        {visibleSections.map(({ id, label }) => {
          if (category === 'International CV' || category === 'Job Resume') {
            if (id === 'summary' && data.professionalSummary.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderParagraphs(data.professionalSummary, false)}
                </section>
              );
            }
            if (id === 'experience' && data.experience.length > 0) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  <div className="space-y-2.5">
                    {data.experience.map((exp) => (
                      <div key={exp.id}>
                        <div className="flex items-baseline justify-between gap-2 text-[11px] font-bold text-slate-950">
                          <span>
                            {[exp.role.trim(), exp.organization.trim()].filter(Boolean).join(' — ')}
                          </span>
                          <span className="text-[10px] font-normal text-slate-600 shrink-0">
                            {[exp.startDate.trim(), exp.isCurrent ? 'Present' : exp.endDate.trim()]
                              .filter(Boolean)
                              .join(' – ')}
                          </span>
                        </div>
                        {exp.location.trim() && (
                          <div className="text-[10px] italic text-slate-600 mb-0.5">{exp.location.trim()}</div>
                        )}
                        {renderBullets(exp.bullets)}
                      </div>
                    ))}
                  </div>
                </section>
              );
            }
            if (id === 'projects' && data.projects.length > 0) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  <div className="space-y-2">
                    {data.projects.map((pr) => (
                      <div key={pr.id}>
                        <div className="text-[11px] font-bold text-slate-950">
                          {[pr.name.trim(), pr.roleOrContext.trim()].filter(Boolean).join(' — ')}
                        </div>
                        {pr.tools.trim() && (
                          <div className="text-[10px] italic text-slate-600 mb-0.5">Tools: {pr.tools.trim()}</div>
                        )}
                        {renderBullets(pr.outcome)}
                      </div>
                    ))}
                  </div>
                </section>
              );
            }
            if (id === 'education' && data.education.length > 0) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  <div className="space-y-2">
                    {data.education.map((ed) => (
                      <div key={ed.id}>
                        <div className="flex items-baseline justify-between gap-2 text-[11px] font-bold text-slate-950">
                          <span>
                            {[ed.degree.trim(), ed.institution.trim()].filter(Boolean).join(' — ')}
                          </span>
                          <span className="text-[10px] font-normal text-slate-600 shrink-0">
                            {[ed.startYear.trim(), ed.endYear.trim()].filter(Boolean).join(' – ')}
                          </span>
                        </div>
                        {(ed.location.trim() || ed.gradeOrGpa.trim()) && (
                          <div className="text-[10px] italic text-slate-600">
                            {[ed.location.trim(), ed.gradeOrGpa.trim()].filter(Boolean).join('  |  ')}
                          </div>
                        )}
                        {renderBullets(ed.highlights)}
                      </div>
                    ))}
                  </div>
                </section>
              );
            }
            if (id === 'skills' && data.skillsText.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  <div className="space-y-1 text-[10.5px] text-slate-900">
                    {splitBullets(data.skillsText).map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </section>
              );
            }
            if (id === 'certifications' && data.certifications.length > 0) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  <ul className="list-disc pl-4.5 space-y-0.5 text-[10.5px] text-slate-800">
                    {data.certifications.map((c) => (
                      <li key={c.id}>
                        <span className="font-semibold text-slate-950">{c.name.trim()}</span>
                        {c.issuer.trim() ? ` — ${c.issuer.trim()}` : ''}
                        {c.year.trim() ? ` (${c.year.trim()})` : ''}
                        {c.credentialId.trim() ? ` [ID: ${c.credentialId.trim()}]` : ''}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            }
            if (id === 'languages' && data.languages.length > 0) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  <p className="text-[10.5px] text-slate-900">
                    {data.languages
                      .map(
                        (l) =>
                          `${l.language.trim()}${l.proficiency.trim() ? ` (${l.proficiency.trim()})` : ''}`
                      )
                      .filter(Boolean)
                      .join('  •  ')}
                  </p>
                </section>
              );
            }
            if (id === 'referees' && (data.refereesAvailableOnRequest || data.referees.length > 0)) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {data.refereesAvailableOnRequest && data.referees.length === 0 ? (
                    <p className="text-[10.5px] text-slate-800">Available upon request.</p>
                  ) : (
                    <ul className="list-disc pl-4.5 space-y-0.5 text-[10.5px] text-slate-800">
                      {data.referees.map((r) => (
                        <li key={r.id}>
                          {[r.name.trim(), r.titleAndOrg.trim(), r.email.trim(), r.phone.trim()]
                            .filter(Boolean)
                            .join('  |  ')}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            }
            return null;
          }

          if (category === 'Academic Resume') {
            if (id === 'interests' && (data.researchInterests.trim() || data.professionalSummary.trim())) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderParagraphs(data.researchInterests || data.professionalSummary, true)}
                </section>
              );
            }
            if (id === 'education' && data.education.length > 0) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  <div className="space-y-2">
                    {data.education.map((ed) => (
                      <div key={ed.id}>
                        <div className="flex items-baseline justify-between gap-2 text-[11px] font-bold text-slate-950">
                          <span>{[ed.degree.trim(), ed.institution.trim()].filter(Boolean).join(', ')}</span>
                          <span className="text-[10px] italic font-normal text-slate-600 shrink-0">
                            {[ed.startYear.trim(), ed.endYear.trim()].filter(Boolean).join(' – ')}
                          </span>
                        </div>
                        {(ed.location.trim() || ed.gradeOrGpa.trim()) && (
                          <div className="text-[10px] italic text-slate-700">
                            {[ed.location.trim(), ed.gradeOrGpa.trim()].filter(Boolean).join('  |  ')}
                          </div>
                        )}
                        {renderBullets(ed.highlights)}
                      </div>
                    ))}
                  </div>
                </section>
              );
            }
            if (id === 'appointments' && data.experience.length > 0) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  <div className="space-y-2">
                    {data.experience.map((exp) => (
                      <div key={exp.id}>
                        <div className="flex items-baseline justify-between gap-2 text-[11px] font-bold text-slate-950">
                          <span>{[exp.role.trim(), exp.organization.trim()].filter(Boolean).join(' — ')}</span>
                          <span className="text-[10px] italic font-normal text-slate-600 shrink-0">
                            {[exp.startDate.trim(), exp.isCurrent ? 'Present' : exp.endDate.trim()]
                              .filter(Boolean)
                              .join(' – ')}
                          </span>
                        </div>
                        {renderBullets(exp.bullets)}
                      </div>
                    ))}
                  </div>
                </section>
              );
            }
            if (id === 'publications' && data.publications.length > 0) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  <ol className="list-decimal pl-4.5 space-y-1 text-[10.5px] text-slate-900 text-justify">
                    {data.publications.map((pub) => (
                      <li key={pub.id}>
                        {pub.authors.trim() ? `${pub.authors.trim()} ` : ''}
                        {pub.year.trim() ? `(${pub.year.trim()}). ` : ''}
                        <span className="font-semibold">"{pub.title.trim()}."</span>{' '}
                        <span className="italic">{pub.venue.trim()}</span>
                        {pub.doiOrUrl.trim() ? ` (${pub.doiOrUrl.trim()})` : ''}
                      </li>
                    ))}
                  </ol>
                </section>
              );
            }
            if (id === 'grants' && data.grantsAndAwards.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderBullets(data.grantsAndAwards)}
                </section>
              );
            }
            if (id === 'service' && (data.academicService.trim() || data.skillsText.trim())) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderBullets(data.academicService)}
                  {data.skillsText.trim() && (
                    <p className="text-[10.5px] text-slate-800 mt-1">
                      <span className="font-semibold">Technical Tools:</span> {data.skillsText.trim()}
                    </p>
                  )}
                </section>
              );
            }
            if (id === 'referees' && (data.refereesAvailableOnRequest || data.referees.length > 0)) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {data.refereesAvailableOnRequest && data.referees.length === 0 ? (
                    <p className="text-[10.5px] text-slate-800">Available upon request.</p>
                  ) : (
                    <ul className="list-disc pl-4.5 space-y-0.5 text-[10.5px] text-slate-800">
                      {data.referees.map((r) => (
                        <li key={r.id}>
                          {[r.name.trim(), r.titleAndOrg.trim(), r.email.trim(), r.phone.trim()]
                            .filter(Boolean)
                            .join('  |  ')}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            }
            return null;
          }

          if (category === 'Statement of Purpose (SOP)') {
            const map: Record<string, string> = {
              intro: data.secIntro,
              academic: data.secAcademic,
              experience: data.secExperience,
              fit: data.secFit,
              goals: data.secGoals,
              closing: data.secClosing,
            };
            const txt = map[id] || '';
            if (!txt.trim()) return null;
            return (
              <section key={id}>
                {renderSectionHeading(label)}
                {renderParagraphs(txt, true)}
              </section>
            );
          }

          if (category === 'Personal Statement') {
            const map: Record<string, string> = {
              origin: data.secPersonalOrigin,
              milestones: data.secPersonalMilestones,
              leadership: data.secPersonalLeadership,
              alignment: data.secPersonalAlignment,
            };
            const txt = map[id] || '';
            if (!txt.trim()) return null;
            return (
              <section key={id}>
                {renderSectionHeading(label)}
                {renderParagraphs(txt, true)}
              </section>
            );
          }

          if (category === 'Scholarship Motivation Letter') {
            const map: Record<string, string> = {
              opening: data.secLetterOpening,
              merit: data.secLetterMerit,
              impact: data.secLetterImpact,
              readiness: data.secLetterReadiness,
            };
            const txt = map[id] || '';
            if (!txt.trim()) return null;
            return <div key={id}>{renderParagraphs(txt, true)}</div>;
          }

          if (category === 'Research Proposal') {
            if (id === 'abstract' && data.secAbstract.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderParagraphs(data.secAbstract, true)}
                </section>
              );
            }
            if (id === 'background' && data.secBackground.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderParagraphs(data.secBackground, true)}
                </section>
              );
            }
            if (id === 'literature' && data.secLiteratureGap.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderParagraphs(data.secLiteratureGap, true)}
                </section>
              );
            }
            if (id === 'objectives' && data.researchObjectivesList.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderBullets(data.researchObjectivesList)}
                </section>
              );
            }
            if (id === 'methodology' && data.secMethodology.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderParagraphs(data.secMethodology, true)}
                </section>
              );
            }
            if (id === 'outcomes' && data.secExpectedOutcomes.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderParagraphs(data.secExpectedOutcomes, true)}
                </section>
              );
            }
            if (id === 'timeline' && data.milestones.length > 0) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  <ul className="list-disc pl-4.5 space-y-1 text-[10.5px] text-slate-900 text-justify">
                    {data.milestones.map((m) => (
                      <li key={m.id}>
                        <span className="font-bold">{m.phase.trim()}</span>
                        {m.duration.trim() ? ` (${m.duration.trim()})` : ''}: {m.deliverable.trim()}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            }
            if (id === 'references' && data.referencesList.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  <ol className="list-decimal pl-4.5 space-y-1 text-[10px] text-slate-800">
                    {splitBullets(data.referencesList).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ol>
                </section>
              );
            }
            return null;
          }

          if (category === 'Study Plan') {
            if (id === 'background' && data.secStudyBackground.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderParagraphs(data.secStudyBackground, true)}
                </section>
              );
            }
            if (id === 'hostFit' && data.secHostUniversityRationale.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderParagraphs(data.secHostUniversityRationale, true)}
                </section>
              );
            }
            if (id === 'schedule' && data.studySchedule.length > 0) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  <ul className="list-disc pl-4.5 space-y-1 text-[10.5px] text-slate-900 text-justify">
                    {data.studySchedule.map((m) => (
                      <li key={m.id}>
                        <span className="font-bold">{m.phase.trim()}</span>
                        {m.duration.trim() ? ` [${m.duration.trim()}]` : ''}: {m.deliverable.trim()}
                      </li>
                    ))}
                  </ul>
                </section>
              );
            }
            if (id === 'adaptation' && data.secLanguageAdaptation.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderParagraphs(data.secLanguageAdaptation, true)}
                </section>
              );
            }
            if (id === 'careerReturn' && data.secPostGradPlan.trim()) {
              return (
                <section key={id}>
                  {renderSectionHeading(label)}
                  {renderParagraphs(data.secPostGradPlan, true)}
                </section>
              );
            }
            return null;
          }

          return null;
        })}

        {/* Custom User Sections */}
        {data.customSections?.map((cs) =>
          cs.heading.trim() && cs.content.trim() ? (
            <section key={cs.id}>
              {renderSectionHeading(cs.heading.trim())}
              {renderParagraphs(cs.content, !isStrictAts)}
            </section>
          ) : null
        )}

        {/* Signature Sign-Off */}
        {(category === 'Scholarship Motivation Letter' ||
          category === 'Statement of Purpose (SOP)' ||
          category === 'Personal Statement' ||
          category === 'Study Plan') && (
          <div className="pt-4 text-[11px] text-slate-900">
            <div>
              {category === 'Scholarship Motivation Letter' ? 'Sincerely,' : 'Respectfully submitted,'}
            </div>
            <div className="font-bold mt-2">{data.fullName.trim() || 'Applicant Name'}</div>
          </div>
        )}
      </div>
    </article>
  );
};
