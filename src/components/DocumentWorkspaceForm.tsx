import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  CertificationEntry,
  ContactHeaderBlock,
  DocumentFormPayload,
  EducationEntry,
  ExperienceEntry,
  LanguageEntry,
  ProjectEntry,
  PublicationEntry,
  RefereeEntry,
  StudyTermEntry,
  TimelineMilestoneEntry,
  makeUid,
} from '../types/documentWorkspace';

interface DocumentWorkspaceFormProps {
  payload: DocumentFormPayload;
  onChange: (next: DocumentFormPayload) => void;
  validationErrors: string[];
}

const inputCls =
  'w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-[#b8c6d4] bg-[#f8fafc] text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-700 focus:bg-white font-serif';

const textareaCls = `${inputCls} leading-relaxed resize-y`;

const labelCls = 'block text-[11px] font-bold text-slate-800 mb-0.5 font-serif';

const SectionBlock: React.FC<{
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, action, children }) => (
  <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-[#b8c6d4] shadow-2xs space-y-3 font-serif">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
      <div className="min-w-0 flex-1">
        <h3 className="text-xs sm:text-sm font-bold text-slate-950 font-serif">{title}</h3>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
    {children}
  </div>
);

const ContactHeaderFields: React.FC<{
  value: ContactHeaderBlock;
  onChange: (next: ContactHeaderBlock) => void;
  roleLabel?: string;
  rolePlaceholder?: string;
}> = ({
  value,
  onChange,
  roleLabel = 'Professional Headline (Optional)',
  rolePlaceholder = 'e.g. Project Manager | M.Sc. Candidate',
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
    <div>
      <label className={labelCls}>Full Name *</label>
      <input
        type="text"
        value={value.fullName}
        onChange={(e) => onChange({ ...value, fullName: e.target.value })}
        placeholder="Enter full legal name"
        className={inputCls}
      />
    </div>
    <div>
      <label className={labelCls}>{roleLabel}</label>
      <input
        type="text"
        value={value.headlineOrTargetRole}
        onChange={(e) => onChange({ ...value, headlineOrTargetRole: e.target.value })}
        placeholder={rolePlaceholder}
        className={inputCls}
      />
    </div>
    <div>
      <label className={labelCls}>Email Address *</label>
      <input
        type="email"
        value={value.email}
        onChange={(e) => onChange({ ...value, email: e.target.value })}
        placeholder="name@example.com"
        className={inputCls}
      />
    </div>
    <div>
      <label className={labelCls}>Phone Number (Optional)</label>
      <input
        type="text"
        value={value.phone}
        onChange={(e) => onChange({ ...value, phone: e.target.value })}
        placeholder="+1 / country code + number"
        className={inputCls}
      />
    </div>
    <div>
      <label className={labelCls}>City, Country</label>
      <input
        type="text"
        value={value.location}
        onChange={(e) => onChange({ ...value, location: e.target.value })}
        placeholder="City, State/Country"
        className={inputCls}
      />
    </div>
    <div>
      <label className={labelCls}>LinkedIn or Portfolio URL (Optional)</label>
      <input
        type="text"
        value={value.linkedinOrPortfolio}
        onChange={(e) => onChange({ ...value, linkedinOrPortfolio: e.target.value })}
        placeholder="linkedin.com/in/..."
        className={inputCls}
      />
    </div>
  </div>
);

const ExperienceListEditor: React.FC<{
  items: ExperienceEntry[];
  onChange: (next: ExperienceEntry[]) => void;
  titlePlaceholder?: string;
  orgPlaceholder?: string;
}> = ({
  items,
  onChange,
  titlePlaceholder = 'Role / Position Title',
  orgPlaceholder = 'Company or Institution',
}) => (
  <div className="space-y-3">
    {items.map((item, idx) => (
      <div
        key={item.id}
        className="p-3 rounded-lg bg-[#f8fafc] border border-slate-200 space-y-2 relative"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] font-bold text-cyan-900 uppercase tracking-wider font-serif">
            Entry #{idx + 1}
          </span>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => onChange(items.filter((x) => x.id !== item.id))}
              className="inline-flex items-center gap-1 text-[10.5px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Remove</span>
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={item.roleTitle}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === item.id ? { ...x, roleTitle: e.target.value } : x)))
            }
            placeholder={titlePlaceholder}
            className={inputCls}
          />
          <input
            type="text"
            value={item.organization}
            onChange={(e) =>
              onChange(
                items.map((x) => (x.id === item.id ? { ...x, organization: e.target.value } : x))
              )
            }
            placeholder={orgPlaceholder}
            className={inputCls}
          />
          <input
            type="text"
            value={item.location}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === item.id ? { ...x, location: e.target.value } : x)))
            }
            placeholder="Location (City, Country)"
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={item.startDate}
              onChange={(e) =>
                onChange(
                  items.map((x) => (x.id === item.id ? { ...x, startDate: e.target.value } : x))
                )
              }
              placeholder="Start (MM/YYYY)"
              className={inputCls}
            />
            <input
              type="text"
              value={item.endDate}
              onChange={(e) =>
                onChange(items.map((x) => (x.id === item.id ? { ...x, endDate: e.target.value } : x)))
              }
              placeholder="End / Present"
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className="block text-[10.5px] font-semibold text-slate-700 mb-0.5 font-serif">
            Key Responsibilities &amp; Measurable Impact (one bullet per line)
          </label>
          <textarea
            rows={3}
            value={item.highlights}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === item.id ? { ...x, highlights: e.target.value } : x)))
            }
            placeholder="Enter one action-oriented achievement per line..."
            className={textareaCls}
          />
        </div>
      </div>
    ))}
  </div>
);

const EducationListEditor: React.FC<{
  items: EducationEntry[];
  onChange: (next: EducationEntry[]) => void;
  showThesis?: boolean;
}> = ({ items, onChange, showThesis = true }) => (
  <div className="space-y-3">
    {items.map((item, idx) => (
      <div
        key={item.id}
        className="p-3 rounded-lg bg-[#f8fafc] border border-slate-200 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] font-bold text-cyan-900 uppercase tracking-wider font-serif">
            Education #{idx + 1}
          </span>
          <button
            type="button"
            onClick={() => onChange(items.filter((x) => x.id !== item.id))}
            className="inline-flex items-center gap-1 text-[10.5px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            value={item.degree}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === item.id ? { ...x, degree: e.target.value } : x)))
            }
            placeholder="Degree & Major"
            className={inputCls}
          />
          <input
            type="text"
            value={item.institution}
            onChange={(e) =>
              onChange(
                items.map((x) => (x.id === item.id ? { ...x, institution: e.target.value } : x))
              )
            }
            placeholder="University / Institution"
            className={inputCls}
          />
          <input
            type="text"
            value={item.location}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === item.id ? { ...x, location: e.target.value } : x)))
            }
            placeholder="City, Country"
            className={inputCls}
          />
          <div className="grid grid-cols-2 gap-1.5">
            <input
              type="text"
              value={item.startYear}
              onChange={(e) =>
                onChange(
                  items.map((x) => (x.id === item.id ? { ...x, startYear: e.target.value } : x))
                )
              }
              placeholder="Start Year"
              className={inputCls}
            />
            <input
              type="text"
              value={item.endYear}
              onChange={(e) =>
                onChange(items.map((x) => (x.id === item.id ? { ...x, endYear: e.target.value } : x)))
              }
              placeholder="Grad Year"
              className={inputCls}
            />
          </div>
          <input
            type="text"
            value={item.gpaOrHonors || ''}
            onChange={(e) =>
              onChange(
                items.map((x) => (x.id === item.id ? { ...x, gpaOrHonors: e.target.value } : x))
              )
            }
            placeholder="GPA / Classification / Honors (Optional)"
            className={inputCls}
          />
          {showThesis && (
            <input
              type="text"
              value={item.thesisOrCoursework || ''}
              onChange={(e) =>
                onChange(
                  items.map((x) =>
                    x.id === item.id ? { ...x, thesisOrCoursework: e.target.value } : x
                  )
                )
              }
              placeholder="Thesis Topic or Key Coursework (Optional)"
              className={inputCls}
            />
          )}
        </div>
      </div>
    ))}
  </div>
);

const CertificationListEditor: React.FC<{
  items: CertificationEntry[];
  onChange: (next: CertificationEntry[]) => void;
}> = ({ items, onChange }) => (
  <div className="space-y-2.5">
    {items.map((c) => (
      <div
        key={c.id}
        className="p-2.5 rounded-lg bg-[#f8fafc] border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center"
      >
        <input
          type="text"
          value={c.name}
          onChange={(e) =>
            onChange(items.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))
          }
          placeholder="Certification Name"
          className={inputCls}
        />
        <input
          type="text"
          value={c.issuer}
          onChange={(e) =>
            onChange(items.map((x) => (x.id === c.id ? { ...x, issuer: e.target.value } : x)))
          }
          placeholder="Issuing Organization"
          className={inputCls}
        />
        <input
          type="text"
          value={c.year}
          onChange={(e) =>
            onChange(items.map((x) => (x.id === c.id ? { ...x, year: e.target.value } : x)))
          }
          placeholder="Year"
          className={inputCls}
        />
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={c.credentialId || ''}
            onChange={(e) =>
              onChange(
                items.map((x) => (x.id === c.id ? { ...x, credentialId: e.target.value } : x))
              )
            }
            placeholder="Credential ID (Opt)"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((x) => x.id !== c.id))}
            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer shrink-0"
            title="Remove certification"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    ))}
    {items.length === 0 && (
      <p className="text-[11px] text-slate-500 italic font-serif">
        No certifications added yet. Click &quot;+ Add Certification&quot; if applicable.
      </p>
    )}
  </div>
);

const ProjectListEditor: React.FC<{
  items: ProjectEntry[];
  onChange: (next: ProjectEntry[]) => void;
  emptyLabel?: string;
}> = ({
  items,
  onChange,
  emptyLabel = 'No projects added yet. Click "+ Project" to add selected projects.',
}) => (
  <div className="space-y-2.5">
    {items.map((proj, idx) => (
      <div
        key={proj.id}
        className="p-2.5 rounded-lg bg-[#f8fafc] border border-slate-200 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10.5px] font-bold text-cyan-900">
            Selected Project #{idx + 1}
          </span>
          <button
            type="button"
            onClick={() => onChange(items.filter((x) => x.id !== proj.id))}
            className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 text-[10.5px] font-semibold cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove</span>
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            value={proj.name}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === proj.id ? { ...x, name: e.target.value } : x)))
            }
            placeholder="Project Title"
            className={inputCls}
          />
          <input
            type="text"
            value={proj.roleOrContext}
            onChange={(e) =>
              onChange(
                items.map((x) =>
                  x.id === proj.id ? { ...x, roleOrContext: e.target.value } : x
                )
              )
            }
            placeholder="Role / Tools Used"
            className={inputCls}
          />
          <input
            type="text"
            value={proj.period}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === proj.id ? { ...x, period: e.target.value } : x)))
            }
            placeholder="Year / Period"
            className={inputCls}
          />
        </div>
        <textarea
          rows={2}
          value={proj.impactBullets}
          onChange={(e) =>
            onChange(
              items.map((x) =>
                x.id === proj.id ? { ...x, impactBullets: e.target.value } : x
              )
            )
          }
          placeholder="Key objectives, methods, or measurable outcomes (one per line)"
          className={textareaCls}
        />
      </div>
    ))}
    {items.length === 0 && (
      <p className="text-[11px] text-slate-500 italic font-serif">{emptyLabel}</p>
    )}
  </div>
);

const RefereeListEditor: React.FC<{
  items: RefereeEntry[];
  onChange: (next: RefereeEntry[]) => void;
  emptyLabel?: string;
}> = ({
  items,
  onChange,
  emptyLabel = 'No referees added yet.',
}) => (
  <div className="space-y-2">
    {items.map((ref) => (
      <div
        key={ref.id}
        className="p-2.5 rounded-lg bg-[#f8fafc] border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center"
      >
        <input
          type="text"
          value={ref.name}
          onChange={(e) =>
            onChange(items.map((x) => (x.id === ref.id ? { ...x, name: e.target.value } : x)))
          }
          placeholder="Full Name"
          className={inputCls}
        />
        <input
          type="text"
          value={ref.titleAndDepartment}
          onChange={(e) =>
            onChange(
              items.map((x) =>
                x.id === ref.id ? { ...x, titleAndDepartment: e.target.value } : x
              )
            )
          }
          placeholder="Title & Department"
          className={inputCls}
        />
        <input
          type="text"
          value={ref.institution}
          onChange={(e) =>
            onChange(
              items.map((x) => (x.id === ref.id ? { ...x, institution: e.target.value } : x))
            )
          }
          placeholder="Organization / Institution"
          className={inputCls}
        />
        <div className="flex items-center gap-1.5">
          <input
            type="email"
            value={ref.email}
            onChange={(e) =>
              onChange(items.map((x) => (x.id === ref.id ? { ...x, email: e.target.value } : x)))
            }
            placeholder="Email Address"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((x) => x.id !== ref.id))}
            className="p-1.5 text-rose-600 cursor-pointer shrink-0"
            title="Remove referee"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    ))}
    {items.length === 0 && (
      <p className="text-[11px] text-slate-500 italic font-serif">{emptyLabel}</p>
    )}
  </div>
);

export const DocumentWorkspaceForm: React.FC<DocumentWorkspaceFormProps> = ({
  payload,
  onChange,
  validationErrors,
}) => {
  return (
    <div
      className="space-y-4 font-serif"
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
    >
      {/* Validation Alert */}
      {validationErrors.length > 0 && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-serif space-y-1">
          <p className="font-bold">Please complete required fields before previewing/publishing:</p>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 1. INTERNATIONAL CV */}
      {payload.category === 'international_cv' && (
        <>
          <SectionBlock title="1. Contact & International Eligibility">
            <ContactHeaderFields
              value={payload.data.header}
              onChange={(header) =>
                onChange({ category: 'international_cv', data: { ...payload.data, header } })
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className={labelCls}>Nationality / Work Authorization (Optional)</label>
                <input
                  type="text"
                  value={payload.data.nationalityOrWorkAuth}
                  onChange={(e) =>
                    onChange({
                      category: 'international_cv',
                      data: { ...payload.data, nationalityOrWorkAuth: e.target.value },
                    })
                  }
                  placeholder="e.g. Authorized to work in EU / UK / US"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>GitHub / ORCID / Website (Optional)</label>
                <input
                  type="text"
                  value={payload.data.orcidOrGithub}
                  onChange={(e) =>
                    onChange({
                      category: 'international_cv',
                      data: { ...payload.data, orcidOrGithub: e.target.value },
                    })
                  }
                  placeholder="github.com/... or orcid.org/..."
                  className={inputCls}
                />
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="2. Professional Summary & Core Competencies">
            <div>
              <label className={labelCls}>Professional Summary *</label>
              <textarea
                rows={3}
                value={payload.data.professionalSummary}
                onChange={(e) =>
                  onChange({
                    category: 'international_cv',
                    data: { ...payload.data, professionalSummary: e.target.value },
                  })
                }
                placeholder="Write a brief overview of your experience and strengths..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Core Competencies (comma or pipe separated)</label>
              <textarea
                rows={2}
                value={payload.data.coreCompetencies}
                onChange={(e) =>
                  onChange({
                    category: 'international_cv',
                    data: { ...payload.data, coreCompetencies: e.target.value },
                  })
                }
                placeholder="e.g. Strategic Planning, Data Analysis, Research, Team Leadership..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock title="3. Technical & Digital Skills">
            <div>
              <label className={labelCls}>
                Technical and Digital Skills (one category per line or comma-separated)
              </label>
              <textarea
                rows={3}
                value={payload.data.technicalAndDigitalSkills || ''}
                onChange={(e) =>
                  onChange({
                    category: 'international_cv',
                    data: { ...payload.data, technicalAndDigitalSkills: e.target.value },
                  })
                }
                placeholder="e.g. Domain Software: Tool A, Tool B&#10;Programming & Data: Python, SQL, Office Suite"
                className={textareaCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock
            title="4. Experience"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'international_cv',
                    data: {
                      ...payload.data,
                      experiences: [
                        ...payload.data.experiences,
                        {
                          id: makeUid('exp'),
                          roleTitle: '',
                          organization: '',
                          location: '',
                          startDate: '',
                          endDate: '',
                          highlights: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Role</span>
              </button>
            }
          >
            <ExperienceListEditor
              items={payload.data.experiences}
              onChange={(experiences) =>
                onChange({ category: 'international_cv', data: { ...payload.data, experiences } })
              }
            />
          </SectionBlock>

          <SectionBlock
            title="5. Leadership"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'international_cv',
                    data: {
                      ...payload.data,
                      leadershipRoles: [
                        ...(payload.data.leadershipRoles || []),
                        {
                          id: makeUid('lead'),
                          roleTitle: '',
                          organization: '',
                          location: '',
                          startDate: '',
                          endDate: '',
                          highlights: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Leadership</span>
              </button>
            }
          >
            {(payload.data.leadershipRoles || []).length === 0 ? (
              <p className="text-[11px] text-slate-500 italic font-serif">
                No leadership roles added yet. Click &quot;+ Add Leadership&quot; if applicable.
              </p>
            ) : (
              <ExperienceListEditor
                items={payload.data.leadershipRoles || []}
                titlePlaceholder="Leadership Title (e.g. Team Lead, President)"
                orgPlaceholder="Organization / Association"
                onChange={(leadershipRoles) =>
                  onChange({
                    category: 'international_cv',
                    data: { ...payload.data, leadershipRoles },
                  })
                }
              />
            )}
          </SectionBlock>

          <SectionBlock
            title="6. Projects / Selected Projects"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'international_cv',
                    data: {
                      ...payload.data,
                      selectedProjects: [
                        ...(payload.data.selectedProjects || []),
                        {
                          id: makeUid('proj'),
                          name: '',
                          roleOrContext: '',
                          period: '',
                          impactBullets: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Project</span>
              </button>
            }
          >
            <ProjectListEditor
              items={payload.data.selectedProjects || []}
              emptyLabel='No selected projects added yet. Click "+ Add Project" if applicable.'
              onChange={(selectedProjects) =>
                onChange({
                  category: 'international_cv',
                  data: { ...payload.data, selectedProjects },
                })
              }
            />
          </SectionBlock>

          <SectionBlock
            title="7. Education"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'international_cv',
                    data: {
                      ...payload.data,
                      education: [
                        ...payload.data.education,
                        {
                          id: makeUid('edu'),
                          degree: '',
                          institution: '',
                          location: '',
                          startYear: '',
                          endYear: '',
                          gpaOrHonors: '',
                          thesisOrCoursework: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Education</span>
              </button>
            }
          >
            <EducationListEditor
              items={payload.data.education}
              onChange={(education) =>
                onChange({ category: 'international_cv', data: { ...payload.data, education } })
              }
            />
          </SectionBlock>

          <SectionBlock title="8. Technical Training and Development">
            <div>
              <label className={labelCls}>
                Training Programs, Workshops &amp; Courses (one per line)
              </label>
              <textarea
                rows={3}
                value={payload.data.technicalTraining || ''}
                onChange={(e) =>
                  onChange({
                    category: 'international_cv',
                    data: { ...payload.data, technicalTraining: e.target.value },
                  })
                }
                placeholder="Enter workshops, short courses, or professional development programs..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock
            title="9. Cert. & Lang"
            action={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      category: 'international_cv',
                      data: {
                        ...payload.data,
                        certifications: [
                          ...payload.data.certifications,
                          { id: makeUid('cert'), name: '', issuer: '', year: '', credentialId: '' },
                        ],
                      },
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 text-white text-[10.5px] font-semibold cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Cert</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      category: 'international_cv',
                      data: {
                        ...payload.data,
                        languages: [
                          ...payload.data.languages,
                          { id: makeUid('lang'), language: '', proficiency: '' },
                        ],
                      },
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Lang</span>
                </button>
              </div>
            }
          >
            <CertificationListEditor
              items={payload.data.certifications}
              onChange={(certifications) =>
                onChange({
                  category: 'international_cv',
                  data: { ...payload.data, certifications },
                })
              }
            />
            {payload.data.languages.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-2">
                <span className={labelCls}>Languages &amp; Proficiency (e.g. CEFR C1 / Native)</span>
                {payload.data.languages.map((lang: LanguageEntry) => (
                  <div key={lang.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={lang.language}
                      onChange={(e) =>
                        onChange({
                          category: 'international_cv',
                          data: {
                            ...payload.data,
                            languages: payload.data.languages.map((x) =>
                              x.id === lang.id ? { ...x, language: e.target.value } : x
                            ),
                          },
                        })
                      }
                      placeholder="Language (e.g. English)"
                      className={inputCls}
                    />
                    <input
                      type="text"
                      value={lang.proficiency}
                      onChange={(e) =>
                        onChange({
                          category: 'international_cv',
                          data: {
                            ...payload.data,
                            languages: payload.data.languages.map((x) =>
                              x.id === lang.id ? { ...x, proficiency: e.target.value } : x
                            ),
                          },
                        })
                      }
                      placeholder="Proficiency (e.g. C2 / Fluent)"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          category: 'international_cv',
                          data: {
                            ...payload.data,
                            languages: payload.data.languages.filter((x) => x.id !== lang.id),
                          },
                        })
                      }
                      className="p-1.5 text-rose-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionBlock>

          <SectionBlock title="10. Professional Interests (Optional)">
            <div>
              <label className={labelCls}>Areas of Interest (Optional)</label>
              <input
                type="text"
                value={payload.data.professionalInterests || ''}
                onChange={(e) =>
                  onChange({
                    category: 'international_cv',
                    data: { ...payload.data, professionalInterests: e.target.value },
                  })
                }
                placeholder="e.g. Applied Research, Sustainability, Community Mentoring..."
                className={inputCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock
            title="11. References (Optional)"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'international_cv',
                    data: {
                      ...payload.data,
                      references: [
                        ...(payload.data.references || []),
                        {
                          id: makeUid('ref'),
                          name: '',
                          titleAndDepartment: '',
                          institution: '',
                          email: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Reference</span>
              </button>
            }
          >
            <div>
              <label className={labelCls}>Reference Statement (Optional)</label>
              <input
                type="text"
                value={payload.data.referencesNote || ''}
                onChange={(e) =>
                  onChange({
                    category: 'international_cv',
                    data: { ...payload.data, referencesNote: e.target.value },
                  })
                }
                placeholder="e.g. Academic and professional references available upon request"
                className={inputCls}
              />
            </div>
            {(payload.data.references || []).length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <RefereeListEditor
                  items={payload.data.references || []}
                  onChange={(references) =>
                    onChange({
                      category: 'international_cv',
                      data: { ...payload.data, references },
                    })
                  }
                />
              </div>
            )}
          </SectionBlock>
        </>
      )}

      {/* 2. ACADEMIC RESUME */}
      {payload.category === 'academic_resume' && (
        <>
          <SectionBlock title="1. Scholar Identity & Contact">
            <ContactHeaderFields
              value={payload.data.header}
              roleLabel="Current Position / Rank"
              rolePlaceholder="e.g. Graduate Research Assistant"
              onChange={(header) =>
                onChange({ category: 'academic_resume', data: { ...payload.data, header } })
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div>
                <label className={labelCls}>Academic Discipline / Specialization</label>
                <input
                  type="text"
                  value={payload.data.academicTitleOrField}
                  onChange={(e) =>
                    onChange({
                      category: 'academic_resume',
                      data: { ...payload.data, academicTitleOrField: e.target.value },
                    })
                  }
                  placeholder="e.g. Public Health & Policy"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>ORCID / Google Scholar URL (Optional)</label>
                <input
                  type="text"
                  value={payload.data.orcidOrScholarUrl}
                  onChange={(e) =>
                    onChange({
                      category: 'academic_resume',
                      data: { ...payload.data, orcidOrScholarUrl: e.target.value },
                    })
                  }
                  placeholder="orcid.org/0000-..."
                  className={inputCls}
                />
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="2. Research Profile & Core Interests">
            <div>
              <label className={labelCls}>Research Profile / Academic Statement *</label>
              <textarea
                rows={3}
                value={payload.data.researchProfile}
                onChange={(e) =>
                  onChange({
                    category: 'academic_resume',
                    data: { ...payload.data, researchProfile: e.target.value },
                  })
                }
                placeholder="Summarize your academic focus and research goals..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Research Interests (comma-separated)</label>
              <input
                type="text"
                value={payload.data.researchInterests}
                onChange={(e) =>
                  onChange({
                    category: 'academic_resume',
                    data: { ...payload.data, researchInterests: e.target.value },
                  })
                }
                placeholder="e.g. Applied Research, Quantitative Methods, Policy Analysis"
                className={inputCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock
            title="3. Education & Academic Training"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'academic_resume',
                    data: {
                      ...payload.data,
                      education: [
                        ...payload.data.education,
                        {
                          id: makeUid('edu'),
                          degree: '',
                          institution: '',
                          location: '',
                          startYear: '',
                          endYear: '',
                          gpaOrHonors: '',
                          thesisOrCoursework: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Degree</span>
              </button>
            }
          >
            <EducationListEditor
              items={payload.data.education}
              onChange={(education) =>
                onChange({ category: 'academic_resume', data: { ...payload.data, education } })
              }
            />
          </SectionBlock>

          <SectionBlock
            title="4. Research Appoint. & Teaching Exp."
            action={
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      category: 'academic_resume',
                      data: {
                        ...payload.data,
                        researchAppointments: [
                          ...payload.data.researchAppointments,
                          {
                            id: makeUid('res'),
                            roleTitle: '',
                            organization: '',
                            location: '',
                            startDate: '',
                            endDate: '',
                            highlights: '',
                          },
                        ],
                      },
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer whitespace-nowrap"
                >
                  <span>+ Research</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      category: 'academic_resume',
                      data: {
                        ...payload.data,
                        teachingExperience: [
                          ...payload.data.teachingExperience,
                          {
                            id: makeUid('teach'),
                            roleTitle: '',
                            organization: '',
                            location: '',
                            startDate: '',
                            endDate: '',
                            highlights: '',
                          },
                        ],
                      },
                    })
                  }
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 text-white text-[10.5px] font-semibold cursor-pointer whitespace-nowrap"
                >
                  <span>+ Teach Exp.</span>
                </button>
              </div>
            }
          >
            <ExperienceListEditor
              items={payload.data.researchAppointments}
              titlePlaceholder="Research Role (e.g. Graduate Researcher)"
              orgPlaceholder="Laboratory / University"
              onChange={(researchAppointments) =>
                onChange({
                  category: 'academic_resume',
                  data: { ...payload.data, researchAppointments },
                })
              }
            />
            {payload.data.teachingExperience.length > 0 && (
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <span className={labelCls}>Teaching &amp; Mentorship Roles</span>
                <ExperienceListEditor
                  items={payload.data.teachingExperience}
                  titlePlaceholder="Course / Teaching Role (e.g. Teaching Assistant)"
                  orgPlaceholder="Department / University"
                  onChange={(teachingExperience) =>
                    onChange({
                      category: 'academic_resume',
                      data: { ...payload.data, teachingExperience },
                    })
                  }
                />
              </div>
            )}
          </SectionBlock>

          <SectionBlock
            title="5. Experience"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'academic_resume',
                    data: {
                      ...payload.data,
                      professionalExperience: [
                        ...(payload.data.professionalExperience || []),
                        {
                          id: makeUid('exp'),
                          roleTitle: '',
                          organization: '',
                          location: '',
                          startDate: '',
                          endDate: '',
                          highlights: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Experience</span>
              </button>
            }
          >
            {(payload.data.professionalExperience || []).length === 0 ? (
              <p className="text-[11px] text-slate-500 italic font-serif">
                No additional work experience added yet.
              </p>
            ) : (
              <ExperienceListEditor
                items={payload.data.professionalExperience || []}
                onChange={(professionalExperience) =>
                  onChange({
                    category: 'academic_resume',
                    data: { ...payload.data, professionalExperience },
                  })
                }
              />
            )}
          </SectionBlock>

          <SectionBlock
            title="6. Leadership"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'academic_resume',
                    data: {
                      ...payload.data,
                      leadershipRoles: [
                        ...(payload.data.leadershipRoles || []),
                        {
                          id: makeUid('lead'),
                          roleTitle: '',
                          organization: '',
                          location: '',
                          startDate: '',
                          endDate: '',
                          highlights: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Leadership</span>
              </button>
            }
          >
            {(payload.data.leadershipRoles || []).length === 0 ? (
              <p className="text-[11px] text-slate-500 italic font-serif">
                No academic or organization leadership roles added yet.
              </p>
            ) : (
              <ExperienceListEditor
                items={payload.data.leadershipRoles || []}
                titlePlaceholder="Leadership Role"
                orgPlaceholder="Society / Department / Organization"
                onChange={(leadershipRoles) =>
                  onChange({
                    category: 'academic_resume',
                    data: { ...payload.data, leadershipRoles },
                  })
                }
              />
            )}
          </SectionBlock>

          <SectionBlock
            title="7. Projects / Selected Projects"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'academic_resume',
                    data: {
                      ...payload.data,
                      selectedProjects: [
                        ...(payload.data.selectedProjects || []),
                        {
                          id: makeUid('proj'),
                          name: '',
                          roleOrContext: '',
                          period: '',
                          impactBullets: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Project</span>
              </button>
            }
          >
            <ProjectListEditor
              items={payload.data.selectedProjects || []}
              emptyLabel='No selected projects added yet. Click "+ Add Project" if applicable.'
              onChange={(selectedProjects) =>
                onChange({
                  category: 'academic_resume',
                  data: { ...payload.data, selectedProjects },
                })
              }
            />
          </SectionBlock>

          <SectionBlock
            title="8. Publications"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'academic_resume',
                    data: {
                      ...payload.data,
                      publications: [
                        ...payload.data.publications,
                        {
                          id: makeUid('pub'),
                          citation: '',
                          venueOrJournal: '',
                          year: '',
                          doiOrUrl: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer whitespace-nowrap"
              >
                <span>+ Publication</span>
              </button>
            }
          >
            {payload.data.publications.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic font-serif">
                No publications added yet. Click &quot;+ Publication&quot; to add an entry.
              </p>
            ) : (
              payload.data.publications.map((pub: PublicationEntry) => (
                <div
                  key={pub.id}
                  className="p-2.5 rounded-lg bg-[#f8fafc] border border-slate-200 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-bold text-cyan-900">Publication</span>
                    <button
                      type="button"
                      onClick={() =>
                        onChange({
                          category: 'academic_resume',
                          data: {
                            ...payload.data,
                            publications: payload.data.publications.filter((x) => x.id !== pub.id),
                          },
                        })
                      }
                      className="text-rose-600 text-[10.5px] font-semibold cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={pub.citation}
                    onChange={(e) =>
                      onChange({
                        category: 'academic_resume',
                        data: {
                          ...payload.data,
                          publications: payload.data.publications.map((x) =>
                            x.id === pub.id ? { ...x, citation: e.target.value } : x
                          ),
                        },
                      })
                    }
                    placeholder="Authors & Paper Title"
                    className={textareaCls}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={pub.venueOrJournal}
                      onChange={(e) =>
                        onChange({
                          category: 'academic_resume',
                          data: {
                            ...payload.data,
                            publications: payload.data.publications.map((x) =>
                              x.id === pub.id ? { ...x, venueOrJournal: e.target.value } : x
                            ),
                          },
                        })
                      }
                      placeholder="Journal / Conference"
                      className={inputCls}
                    />
                    <input
                      type="text"
                      value={pub.year}
                      onChange={(e) =>
                        onChange({
                          category: 'academic_resume',
                          data: {
                            ...payload.data,
                            publications: payload.data.publications.map((x) =>
                              x.id === pub.id ? { ...x, year: e.target.value } : x
                            ),
                          },
                        })
                      }
                      placeholder="Year"
                      className={inputCls}
                    />
                    <input
                      type="text"
                      value={pub.doiOrUrl || ''}
                      onChange={(e) =>
                        onChange({
                          category: 'academic_resume',
                          data: {
                            ...payload.data,
                            publications: payload.data.publications.map((x) =>
                              x.id === pub.id ? { ...x, doiOrUrl: e.target.value } : x
                            ),
                          },
                        })
                      }
                      placeholder="DOI / URL (Optional)"
                      className={inputCls}
                    />
                  </div>
                </div>
              ))
            )}
          </SectionBlock>

          <SectionBlock title="9. Grants, Fellowships & Honors">
            <div>
              <label className={labelCls}>Grants, Fellowships &amp; Academic Honors (one per line)</label>
              <textarea
                rows={2}
                value={payload.data.grantsAndAwards}
                onChange={(e) =>
                  onChange({
                    category: 'academic_resume',
                    data: { ...payload.data, grantsAndAwards: e.target.value },
                  })
                }
                placeholder="List scholarships, fellowships, or academic awards..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock title="10. Laboratory, Computational & Analytical Methods">
            <div>
              <label className={labelCls}>Laboratory, Computational &amp; Analytical Methods</label>
              <textarea
                rows={2}
                value={payload.data.technicalMethods}
                onChange={(e) =>
                  onChange({
                    category: 'academic_resume',
                    data: { ...payload.data, technicalMethods: e.target.value },
                  })
                }
                placeholder="e.g. Statistical Analysis, Python, Survey Design, Archival Research..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock title="11. Technical & Digital Skills">
            <div>
              <label className={labelCls}>
                Technical and Digital Skills (one category per line or comma-separated)
              </label>
              <textarea
                rows={2}
                value={payload.data.technicalAndDigitalSkills || ''}
                onChange={(e) =>
                  onChange({
                    category: 'academic_resume',
                    data: { ...payload.data, technicalAndDigitalSkills: e.target.value },
                  })
                }
                placeholder="e.g. Software & Research Tools: R, MATLAB, LaTeX, Office Suite"
                className={textareaCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock title="12. Technical Training and Development">
            <div>
              <label className={labelCls}>Training Programs &amp; Academic Workshops (one per line)</label>
              <textarea
                rows={2}
                value={payload.data.technicalTraining || ''}
                onChange={(e) =>
                  onChange({
                    category: 'academic_resume',
                    data: { ...payload.data, technicalTraining: e.target.value },
                  })
                }
                placeholder="List workshops, lab trainings, or academic development courses..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock title="13. Professional Interests (Optional)">
            <div>
              <label className={labelCls}>Professional &amp; Academic Interests (Optional)</label>
              <input
                type="text"
                value={payload.data.professionalInterests || ''}
                onChange={(e) =>
                  onChange({
                    category: 'academic_resume',
                    data: { ...payload.data, professionalInterests: e.target.value },
                  })
                }
                placeholder="e.g. Open Science, Peer Mentoring, Policy Outreach..."
                className={inputCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock
            title="14. Referees"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'academic_resume',
                    data: {
                      ...payload.data,
                      referees: [
                        ...payload.data.referees,
                        {
                          id: makeUid('ref'),
                          name: '',
                          titleAndDepartment: '',
                          institution: '',
                          email: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[10.5px] font-semibold cursor-pointer whitespace-nowrap"
              >
                <span>+ Referees</span>
              </button>
            }
          >
            <RefereeListEditor
              items={payload.data.referees}
              emptyLabel='No referees added yet. Click "+ Referees" to add academic referees.'
              onChange={(referees) =>
                onChange({ category: 'academic_resume', data: { ...payload.data, referees } })
              }
            />
          </SectionBlock>
        </>
      )}

      {/* 3. JOB RESUME */}
      {payload.category === 'job_resume' && (
        <>
          <SectionBlock title="1. Candidate Header & Target Role">
            <ContactHeaderFields
              value={payload.data.header}
              roleLabel="Professional Tagline (Optional)"
              onChange={(header) =>
                onChange({ category: 'job_resume', data: { ...payload.data, header } })
              }
            />
            <div className="pt-1">
              <label className={labelCls}>Target Job Title *</label>
              <input
                type="text"
                value={payload.data.targetJobTitle}
                onChange={(e) =>
                  onChange({
                    category: 'job_resume',
                    data: { ...payload.data, targetJobTitle: e.target.value },
                  })
                }
                placeholder="e.g. Senior Operations Analyst"
                className={inputCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock title="2. Executive Summary & Technical / Digital Skills">
            <div>
              <label className={labelCls}>Executive Summary *</label>
              <textarea
                rows={3}
                value={payload.data.professionalSummary}
                onChange={(e) =>
                  onChange({
                    category: 'job_resume',
                    data: { ...payload.data, professionalSummary: e.target.value },
                  })
                }
                placeholder="Summarize your work experience, key achievements, and core strengths..."
                className={textareaCls}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Technical &amp; Digital Skills</label>
                <textarea
                  rows={2}
                  value={payload.data.technicalSkills}
                  onChange={(e) =>
                    onChange({
                      category: 'job_resume',
                      data: { ...payload.data, technicalSkills: e.target.value },
                    })
                  }
                  placeholder="Project Management, Excel, SQL, Python, Reporting..."
                  className={textareaCls}
                />
              </div>
              <div>
                <label className={labelCls}>Leadership &amp; Operations Skills (Optional)</label>
                <textarea
                  rows={2}
                  value={payload.data.softAndLeadershipSkills}
                  onChange={(e) =>
                    onChange({
                      category: 'job_resume',
                      data: { ...payload.data, softAndLeadershipSkills: e.target.value },
                    })
                  }
                  placeholder="Team Leadership, Process Improvement, Communication..."
                  className={textareaCls}
                />
              </div>
            </div>
          </SectionBlock>

          <SectionBlock
            title="3. Experience"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'job_resume',
                    data: {
                      ...payload.data,
                      workExperience: [
                        ...payload.data.workExperience,
                        {
                          id: makeUid('work'),
                          roleTitle: '',
                          organization: '',
                          location: '',
                          startDate: '',
                          endDate: '',
                          highlights: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Experience</span>
              </button>
            }
          >
            <ExperienceListEditor
              items={payload.data.workExperience}
              onChange={(workExperience) =>
                onChange({ category: 'job_resume', data: { ...payload.data, workExperience } })
              }
            />
          </SectionBlock>

          <SectionBlock
            title="4. Leadership"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'job_resume',
                    data: {
                      ...payload.data,
                      leadershipRoles: [
                        ...(payload.data.leadershipRoles || []),
                        {
                          id: makeUid('lead'),
                          roleTitle: '',
                          organization: '',
                          location: '',
                          startDate: '',
                          endDate: '',
                          highlights: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Leadership</span>
              </button>
            }
          >
            {(payload.data.leadershipRoles || []).length === 0 ? (
              <p className="text-[11px] text-slate-500 italic font-serif">
                No leadership entries added yet. Click &quot;+ Add Leadership&quot; if applicable.
              </p>
            ) : (
              <ExperienceListEditor
                items={payload.data.leadershipRoles || []}
                titlePlaceholder="Leadership Title"
                orgPlaceholder="Organization / Team"
                onChange={(leadershipRoles) =>
                  onChange({ category: 'job_resume', data: { ...payload.data, leadershipRoles } })
                }
              />
            )}
          </SectionBlock>

          <SectionBlock
            title="5. Key Projects / Selected Projects"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'job_resume',
                    data: {
                      ...payload.data,
                      keyProjects: [
                        ...payload.data.keyProjects,
                        {
                          id: makeUid('proj'),
                          name: '',
                          roleOrContext: '',
                          period: '',
                          impactBullets: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Project</span>
              </button>
            }
          >
            <ProjectListEditor
              items={payload.data.keyProjects}
              emptyLabel='No projects added yet. Click "+ Add Project" if applicable.'
              onChange={(keyProjects) =>
                onChange({ category: 'job_resume', data: { ...payload.data, keyProjects } })
              }
            />
          </SectionBlock>

          <SectionBlock
            title="6. Education"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'job_resume',
                    data: {
                      ...payload.data,
                      education: [
                        ...payload.data.education,
                        {
                          id: makeUid('edu'),
                          degree: '',
                          institution: '',
                          location: '',
                          startYear: '',
                          endYear: '',
                          gpaOrHonors: '',
                          thesisOrCoursework: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Edu</span>
              </button>
            }
          >
            <EducationListEditor
              items={payload.data.education}
              showThesis={false}
              onChange={(education) =>
                onChange({ category: 'job_resume', data: { ...payload.data, education } })
              }
            />
          </SectionBlock>

          <SectionBlock
            title="7. Certifications"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'job_resume',
                    data: {
                      ...payload.data,
                      certifications: [
                        ...payload.data.certifications,
                        { id: makeUid('cert'), name: '', issuer: '', year: '', credentialId: '' },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-800 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Cert</span>
              </button>
            }
          >
            <CertificationListEditor
              items={payload.data.certifications}
              onChange={(certifications) =>
                onChange({ category: 'job_resume', data: { ...payload.data, certifications } })
              }
            />
          </SectionBlock>

          <SectionBlock title="8. Technical Training and Development">
            <div>
              <label className={labelCls}>
                Training Programs &amp; Professional Development (one per line)
              </label>
              <textarea
                rows={2}
                value={payload.data.technicalTraining || ''}
                onChange={(e) =>
                  onChange({
                    category: 'job_resume',
                    data: { ...payload.data, technicalTraining: e.target.value },
                  })
                }
                placeholder="List workshops, short courses, or executive training programs..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock title="9. Professional Interests (Optional)">
            <div>
              <label className={labelCls}>Professional Interests (Optional)</label>
              <input
                type="text"
                value={payload.data.professionalInterests || ''}
                onChange={(e) =>
                  onChange({
                    category: 'job_resume',
                    data: { ...payload.data, professionalInterests: e.target.value },
                  })
                }
                placeholder="e.g. Process Automation, Cross-Functional Mentorship..."
                className={inputCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock
            title="10. References (Optional)"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'job_resume',
                    data: {
                      ...payload.data,
                      references: [
                        ...(payload.data.references || []),
                        {
                          id: makeUid('ref'),
                          name: '',
                          titleAndDepartment: '',
                          institution: '',
                          email: '',
                        },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Reference</span>
              </button>
            }
          >
            <div>
              <label className={labelCls}>Reference Statement (Optional)</label>
              <input
                type="text"
                value={payload.data.referencesNote || ''}
                onChange={(e) =>
                  onChange({
                    category: 'job_resume',
                    data: { ...payload.data, referencesNote: e.target.value },
                  })
                }
                placeholder="e.g. Professional references available upon request"
                className={inputCls}
              />
            </div>
            {(payload.data.references || []).length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <RefereeListEditor
                  items={payload.data.references || []}
                  onChange={(references) =>
                    onChange({
                      category: 'job_resume',
                      data: { ...payload.data, references },
                    })
                  }
                />
              </div>
            )}
          </SectionBlock>
        </>
      )}

      {/* 4. STATEMENT OF PURPOSE (SOP) */}
      {payload.category === 'sop' && (
        <>
          <SectionBlock title="1. Applicant & Target Graduate Program Metadata">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Applicant Full Name *</label>
                <input
                  type="text"
                  value={payload.data.applicantName}
                  onChange={(e) =>
                    onChange({
                      category: 'sop',
                      data: { ...payload.data, applicantName: e.target.value },
                    })
                  }
                  placeholder="Full name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Document Heading (Optional)</label>
                <input
                  type="text"
                  value={payload.data.documentTitle}
                  onChange={(e) =>
                    onChange({
                      category: 'sop',
                      data: { ...payload.data, documentTitle: e.target.value },
                    })
                  }
                  placeholder="Defaults to Statement of Purpose"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Target Degree &amp; Program *</label>
                <input
                  type="text"
                  value={payload.data.targetDegreeAndProgram}
                  onChange={(e) =>
                    onChange({
                      category: 'sop',
                      data: { ...payload.data, targetDegreeAndProgram: e.target.value },
                    })
                  }
                  placeholder="e.g. M.Sc. / Ph.D. in Target Field"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Target University / Institution *</label>
                <input
                  type="text"
                  value={payload.data.targetInstitution}
                  onChange={(e) =>
                    onChange({
                      category: 'sop',
                      data: { ...payload.data, targetInstitution: e.target.value },
                    })
                  }
                  placeholder="University name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Department (Optional)</label>
                <input
                  type="text"
                  value={payload.data.targetDepartment}
                  onChange={(e) =>
                    onChange({
                      category: 'sop',
                      data: { ...payload.data, targetDepartment: e.target.value },
                    })
                  }
                  placeholder="Academic department"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Intended Intake Term (Optional)</label>
                <input
                  type="text"
                  value={payload.data.intendedTerm}
                  onChange={(e) =>
                    onChange({
                      category: 'sop',
                      data: { ...payload.data, intendedTerm: e.target.value },
                    })
                  }
                  placeholder="e.g. Fall 2026"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Target Faculty / Research Lab (Optional)</label>
                <input
                  type="text"
                  value={payload.data.targetFacultyOrLab}
                  onChange={(e) =>
                    onChange({
                      category: 'sop',
                      data: { ...payload.data, targetFacultyOrLab: e.target.value },
                    })
                  }
                  placeholder="Faculty members or research group"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email &amp; Contact</label>
                <input
                  type="email"
                  value={payload.data.applicantEmail}
                  onChange={(e) =>
                    onChange({
                      category: 'sop',
                      data: { ...payload.data, applicantEmail: e.target.value },
                    })
                  }
                  placeholder="applicant@email.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Phone (Optional)</label>
                <input
                  type="text"
                  value={payload.data.applicantPhone}
                  onChange={(e) =>
                    onChange({
                      category: 'sop',
                      data: { ...payload.data, applicantPhone: e.target.value },
                    })
                  }
                  placeholder="Phone number"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>City, Country (Optional)</label>
                <input
                  type="text"
                  value={payload.data.applicantLocation}
                  onChange={(e) =>
                    onChange({
                      category: 'sop',
                      data: { ...payload.data, applicantLocation: e.target.value },
                    })
                  }
                  placeholder="Current location"
                  className={inputCls}
                />
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="2. Structured Statement of Purpose Essay">
            <div>
              <label className={labelCls}>Paragraph 1 — Opening Hook &amp; Motivation *</label>
              <textarea
                rows={4}
                value={payload.data.openingMotivation}
                onChange={(e) =>
                  onChange({
                    category: 'sop',
                    data: { ...payload.data, openingMotivation: e.target.value },
                  })
                }
                placeholder="Explain the core question or motivation driving your application..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Paragraph 2 — Academic Foundation &amp; Coursework</label>
              <textarea
                rows={4}
                value={payload.data.academicFoundation}
                onChange={(e) =>
                  onChange({
                    category: 'sop',
                    data: { ...payload.data, academicFoundation: e.target.value },
                  })
                }
                placeholder="Highlight prior coursework, academic preparation, and key milestones..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Paragraph 3 — Research &amp; Practical Experience</label>
              <textarea
                rows={4}
                value={payload.data.researchAndPracticalExperience}
                onChange={(e) =>
                  onChange({
                    category: 'sop',
                    data: { ...payload.data, researchAndPracticalExperience: e.target.value },
                  })
                }
                placeholder="Detail your thesis, field or lab projects, methodology, and key outcomes..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Paragraph 4 — Program &amp; Faculty Alignment</label>
              <textarea
                rows={4}
                value={payload.data.programAndFacultyFit}
                onChange={(e) =>
                  onChange({
                    category: 'sop',
                    data: { ...payload.data, programAndFacultyFit: e.target.value },
                  })
                }
                placeholder="Explain why this department, curriculum, and specific professors or labs fit your research agenda..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Paragraph 5 — Career Trajectory &amp; Closing</label>
              <textarea
                rows={3}
                value={payload.data.careerGoalsAndClosing}
                onChange={(e) =>
                  onChange({
                    category: 'sop',
                    data: { ...payload.data, careerGoalsAndClosing: e.target.value },
                  })
                }
                placeholder="Articulate short- and long-term career goals and how you will contribute to the cohort..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>
        </>
      )}

      {/* 5. PERSONAL STATEMENT */}
      {payload.category === 'personal_statement' && (
        <>
          <SectionBlock title="1. Applicant & Target Opportunity">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Applicant Full Name *</label>
                <input
                  type="text"
                  value={payload.data.applicantName}
                  onChange={(e) =>
                    onChange({
                      category: 'personal_statement',
                      data: { ...payload.data, applicantName: e.target.value },
                    })
                  }
                  placeholder="Full name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Document Title (Optional)</label>
                <input
                  type="text"
                  value={payload.data.documentTitle}
                  onChange={(e) =>
                    onChange({
                      category: 'personal_statement',
                      data: { ...payload.data, documentTitle: e.target.value },
                    })
                  }
                  placeholder="Defaults to Personal Statement"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Target Program / Opportunity *</label>
                <input
                  type="text"
                  value={payload.data.targetProgramOrOpportunity}
                  onChange={(e) =>
                    onChange({
                      category: 'personal_statement',
                      data: { ...payload.data, targetProgramOrOpportunity: e.target.value },
                    })
                  }
                  placeholder="Degree, fellowship, or residency program"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Institution / Organization</label>
                <input
                  type="text"
                  value={payload.data.targetOrganization}
                  onChange={(e) =>
                    onChange({
                      category: 'personal_statement',
                      data: { ...payload.data, targetOrganization: e.target.value },
                    })
                  }
                  placeholder="Institution name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email Address</label>
                <input
                  type="email"
                  value={payload.data.applicantEmail}
                  onChange={(e) =>
                    onChange({
                      category: 'personal_statement',
                      data: { ...payload.data, applicantEmail: e.target.value },
                    })
                  }
                  placeholder="applicant@email.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>City, Country (Optional)</label>
                <input
                  type="text"
                  value={payload.data.applicantLocation}
                  onChange={(e) =>
                    onChange({
                      category: 'personal_statement',
                      data: { ...payload.data, applicantLocation: e.target.value },
                    })
                  }
                  placeholder="Current location"
                  className={inputCls}
                />
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="2. Personal Narrative Sections">
            <div>
              <label className={labelCls}>Defining Personal Story &amp; Origin *</label>
              <textarea
                rows={4}
                value={payload.data.definingStoryAndOrigin}
                onChange={(e) =>
                  onChange({
                    category: 'personal_statement',
                    data: { ...payload.data, definingStoryAndOrigin: e.target.value },
                  })
                }
                placeholder="Share a formative experience or turning point that shaped your perspective and purpose..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Challenges Overcome &amp; Resilience</label>
              <textarea
                rows={4}
                value={payload.data.challengesAndResilience}
                onChange={(e) =>
                  onChange({
                    category: 'personal_statement',
                    data: { ...payload.data, challengesAndResilience: e.target.value },
                  })
                }
                placeholder="Reflect on obstacles navigated, lessons learned, and personal growth..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Leadership, Service &amp; Character</label>
              <textarea
                rows={4}
                value={payload.data.leadershipAndCharacter}
                onChange={(e) =>
                  onChange({
                    category: 'personal_statement',
                    data: { ...payload.data, leadershipAndCharacter: e.target.value },
                  })
                }
                placeholder="Describe teamwork, mentorship, volunteering, or community leadership milestones..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Values Alignment &amp; Future Contribution</label>
              <textarea
                rows={3}
                value={payload.data.valuesAndFutureContribution}
                onChange={(e) =>
                  onChange({
                    category: 'personal_statement',
                    data: { ...payload.data, valuesAndFutureContribution: e.target.value },
                  })
                }
                placeholder="Connect your values to the institution's mission and how you plan to contribute..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>
        </>
      )}

      {/* 6. SCHOLARSHIP MOTIVATION LETTER */}
      {payload.category === 'scholarship_letter' && (
        <>
          <SectionBlock title="1. Formal Letter Sender & Recipient Blocks">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Applicant Full Name *</label>
                <input
                  type="text"
                  value={payload.data.applicantName}
                  onChange={(e) =>
                    onChange({
                      category: 'scholarship_letter',
                      data: { ...payload.data, applicantName: e.target.value },
                    })
                  }
                  placeholder="Full name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input
                  type="text"
                  value={payload.data.letterDate}
                  onChange={(e) =>
                    onChange({
                      category: 'scholarship_letter',
                      data: { ...payload.data, letterDate: e.target.value },
                    })
                  }
                  placeholder="e.g. November 22, 2026"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Applicant Address / Location</label>
                <input
                  type="text"
                  value={payload.data.applicantAddress}
                  onChange={(e) =>
                    onChange({
                      category: 'scholarship_letter',
                      data: { ...payload.data, applicantAddress: e.target.value },
                    })
                  }
                  placeholder="Street / City / Country"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Applicant Email &amp; Phone</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="email"
                    value={payload.data.applicantEmail}
                    onChange={(e) =>
                      onChange({
                        category: 'scholarship_letter',
                        data: { ...payload.data, applicantEmail: e.target.value },
                      })
                    }
                    placeholder="Email"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={payload.data.applicantPhone}
                    onChange={(e) =>
                      onChange({
                        category: 'scholarship_letter',
                        data: { ...payload.data, applicantPhone: e.target.value },
                      })
                    }
                    placeholder="Phone"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Scholarship / Award Name *</label>
                <input
                  type="text"
                  value={payload.data.scholarshipName}
                  onChange={(e) =>
                    onChange({
                      category: 'scholarship_letter',
                      data: { ...payload.data, scholarshipName: e.target.value },
                    })
                  }
                  placeholder="e.g. Chevening / DAAD / Erasmus Mundus"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Sponsoring Organization / Foundation</label>
                <input
                  type="text"
                  value={payload.data.sponsoringOrganization}
                  onChange={(e) =>
                    onChange({
                      category: 'scholarship_letter',
                      data: { ...payload.data, sponsoringOrganization: e.target.value },
                    })
                  }
                  placeholder="Awarding institution or body"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Recipient Title</label>
                <input
                  type="text"
                  value={payload.data.recipientTitle}
                  onChange={(e) =>
                    onChange({
                      category: 'scholarship_letter',
                      data: { ...payload.data, recipientTitle: e.target.value },
                    })
                  }
                  placeholder="Scholarship Selection Committee"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Host University / Country (Optional)</label>
                <input
                  type="text"
                  value={payload.data.hostCountryOrUniversity}
                  onChange={(e) =>
                    onChange({
                      category: 'scholarship_letter',
                      data: { ...payload.data, hostCountryOrUniversity: e.target.value },
                    })
                  }
                  placeholder="Destination university or country"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Subject Line (Optional override)</label>
                <input
                  type="text"
                  value={payload.data.subjectLine}
                  onChange={(e) =>
                    onChange({
                      category: 'scholarship_letter',
                      data: { ...payload.data, subjectLine: e.target.value },
                    })
                  }
                  placeholder="RE: Application for [Scholarship Name]"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Salutation &amp; Sign-Off</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={payload.data.salutation}
                    onChange={(e) =>
                      onChange({
                        category: 'scholarship_letter',
                        data: { ...payload.data, salutation: e.target.value },
                      })
                    }
                    placeholder="Dear Selection Committee,"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={payload.data.signOff}
                    onChange={(e) =>
                      onChange({
                        category: 'scholarship_letter',
                        data: { ...payload.data, signOff: e.target.value },
                      })
                    }
                    placeholder="Yours faithfully,"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="2. Letter Body Sections">
            <div>
              <label className={labelCls}>1. Purpose of Application &amp; Academic Standing *</label>
              <textarea
                rows={3}
                value={payload.data.purposeAndStanding}
                onChange={(e) =>
                  onChange({
                    category: 'scholarship_letter',
                    data: { ...payload.data, purposeAndStanding: e.target.value },
                  })
                }
                placeholder="State the scholarship and program applied for along with your credentials..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>2. Motivation, Merit &amp; Key Achievements</label>
              <textarea
                rows={4}
                value={payload.data.motivationAndMerit}
                onChange={(e) =>
                  onChange({
                    category: 'scholarship_letter',
                    data: { ...payload.data, motivationAndMerit: e.target.value },
                  })
                }
                placeholder="Detail your academic merit, professional or research achievements, and fit with the award..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>3. Financial Context &amp; Stewardship (Optional)</label>
              <textarea
                rows={3}
                value={payload.data.financialNeedContext}
                onChange={(e) =>
                  onChange({
                    category: 'scholarship_letter',
                    data: { ...payload.data, financialNeedContext: e.target.value },
                  })
                }
                placeholder="Explain why funding support is essential and how you will maximize the opportunity..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>4. Home/Global Community Impact &amp; Commitment</label>
              <textarea
                rows={3}
                value={payload.data.impactAndCommitment}
                onChange={(e) =>
                  onChange({
                    category: 'scholarship_letter',
                    data: { ...payload.data, impactAndCommitment: e.target.value },
                  })
                }
                placeholder="Describe tangible societal, industrial, or academic contributions after completing the scholarship..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>
        </>
      )}

      {/* 7. RESEARCH PROPOSAL */}
      {payload.category === 'research_proposal' && (
        <>
          <SectionBlock title="1. Proposal Identification & Host Details">
            <div className="space-y-2.5">
              <div>
                <label className={labelCls}>Research Proposal Title *</label>
                <input
                  type="text"
                  value={payload.data.proposalTitle}
                  onChange={(e) =>
                    onChange({
                      category: 'research_proposal',
                      data: { ...payload.data, proposalTitle: e.target.value },
                    })
                  }
                  placeholder="Enter full academic research title"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className={labelCls}>Principal Investigator / Applicant *</label>
                  <input
                    type="text"
                    value={payload.data.applicantName}
                    onChange={(e) =>
                      onChange({
                        category: 'research_proposal',
                        data: { ...payload.data, applicantName: e.target.value },
                      })
                    }
                    placeholder="Full name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Applicant Email</label>
                  <input
                    type="email"
                    value={payload.data.applicantEmail}
                    onChange={(e) =>
                      onChange({
                        category: 'research_proposal',
                        data: { ...payload.data, applicantEmail: e.target.value },
                      })
                    }
                    placeholder="researcher@email.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Target Institution</label>
                  <input
                    type="text"
                    value={payload.data.targetInstitution}
                    onChange={(e) =>
                      onChange({
                        category: 'research_proposal',
                        data: { ...payload.data, targetInstitution: e.target.value },
                      })
                    }
                    placeholder="Host university or research institute"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Department / Faculty (Optional)</label>
                  <input
                    type="text"
                    value={payload.data.targetDepartment}
                    onChange={(e) =>
                      onChange({
                        category: 'research_proposal',
                        data: { ...payload.data, targetDepartment: e.target.value },
                      })
                    }
                    placeholder="Department"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Proposed Supervisor (Optional)</label>
                  <input
                    type="text"
                    value={payload.data.proposedSupervisor}
                    onChange={(e) =>
                      onChange({
                        category: 'research_proposal',
                        data: { ...payload.data, proposedSupervisor: e.target.value },
                      })
                    }
                    placeholder="Advisor / Faculty name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Research Keywords (comma-separated)</label>
                  <input
                    type="text"
                    value={payload.data.keywords}
                    onChange={(e) =>
                      onChange({
                        category: 'research_proposal',
                        data: { ...payload.data, keywords: e.target.value },
                      })
                    }
                    placeholder="e.g. Applied Modeling, Sustainability, Policy Design"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="2. Core Proposal Sections">
            <div>
              <label className={labelCls}>Abstract / Executive Summary *</label>
              <textarea
                rows={3}
                value={payload.data.abstractSummary}
                onChange={(e) =>
                  onChange({
                    category: 'research_proposal',
                    data: { ...payload.data, abstractSummary: e.target.value },
                  })
                }
                placeholder="Concise overview of research rationale, methods, and expected contribution..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Background &amp; Problem Statement</label>
              <textarea
                rows={4}
                value={payload.data.problemStatement}
                onChange={(e) =>
                  onChange({
                    category: 'research_proposal',
                    data: { ...payload.data, problemStatement: e.target.value },
                  })
                }
                placeholder="Define the core research problem or question being investigated..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Research Questions &amp; Objectives (one per line)</label>
              <textarea
                rows={3}
                value={payload.data.researchQuestions}
                onChange={(e) =>
                  onChange({
                    category: 'research_proposal',
                    data: { ...payload.data, researchQuestions: e.target.value },
                  })
                }
                placeholder="List specific research questions or testable hypotheses (one per line)..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Literature Context &amp; Knowledge Gap</label>
              <textarea
                rows={3}
                value={payload.data.literatureGap}
                onChange={(e) =>
                  onChange({
                    category: 'research_proposal',
                    data: { ...payload.data, literatureGap: e.target.value },
                  })
                }
                placeholder="Synthesize prior scholarly work and clearly state the unresolved gap..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Methodology &amp; Experimental / Analytical Design</label>
              <textarea
                rows={4}
                value={payload.data.methodologyDesign}
                onChange={(e) =>
                  onChange({
                    category: 'research_proposal',
                    data: { ...payload.data, methodologyDesign: e.target.value },
                  })
                }
                placeholder="Specify modeling tools, experimental setups, validation metrics, and datasets..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Expected Contributions &amp; Significance</label>
              <textarea
                rows={3}
                value={payload.data.expectedContributions}
                onChange={(e) =>
                  onChange({
                    category: 'research_proposal',
                    data: { ...payload.data, expectedContributions: e.target.value },
                  })
                }
                placeholder="Detail theoretical, industrial, or societal significance..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock
            title="3. Timeline Milestones, Resources & Bibliography"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'research_proposal',
                    data: {
                      ...payload.data,
                      timelineMilestones: [
                        ...payload.data.timelineMilestones,
                        { id: makeUid('ms'), phase: '', timeframe: '', deliverable: '' },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Phase</span>
              </button>
            }
          >
            {payload.data.timelineMilestones.map((ms: TimelineMilestoneEntry, idx) => (
              <div
                key={ms.id}
                className="p-2.5 rounded-lg bg-[#f8fafc] border border-slate-200 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold text-cyan-900">Phase #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        category: 'research_proposal',
                        data: {
                          ...payload.data,
                          timelineMilestones: payload.data.timelineMilestones.filter(
                            (x) => x.id !== ms.id
                          ),
                        },
                      })
                    }
                    className="text-rose-600 text-[10.5px] font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={ms.phase}
                    onChange={(e) =>
                      onChange({
                        category: 'research_proposal',
                        data: {
                          ...payload.data,
                          timelineMilestones: payload.data.timelineMilestones.map((x) =>
                            x.id === ms.id ? { ...x, phase: e.target.value } : x
                          ),
                        },
                      })
                    }
                    placeholder="Phase Name (e.g. Phase 1: Literature & Baseline)"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={ms.timeframe}
                    onChange={(e) =>
                      onChange({
                        category: 'research_proposal',
                        data: {
                          ...payload.data,
                          timelineMilestones: payload.data.timelineMilestones.map((x) =>
                            x.id === ms.id ? { ...x, timeframe: e.target.value } : x
                          ),
                        },
                      })
                    }
                    placeholder="Timeframe (e.g. Months 1–6)"
                    className={inputCls}
                  />
                </div>
                <input
                  type="text"
                  value={ms.deliverable}
                  onChange={(e) =>
                    onChange({
                      category: 'research_proposal',
                      data: {
                        ...payload.data,
                        timelineMilestones: payload.data.timelineMilestones.map((x) =>
                          x.id === ms.id ? { ...x, deliverable: e.target.value } : x
                        ),
                      },
                    })
                  }
                  placeholder="Key deliverable / milestone"
                  className={inputCls}
                />
              </div>
            ))}

            <div>
              <label className={labelCls}>Resources / Equipment Requirements (Optional)</label>
              <textarea
                rows={2}
                value={payload.data.budgetOrResourceNeeds}
                onChange={(e) =>
                  onChange({
                    category: 'research_proposal',
                    data: { ...payload.data, budgetOrResourceNeeds: e.target.value },
                  })
                }
                placeholder="Computing clusters, instrumentation, lab consumables, or travel grants..."
                className={textareaCls}
              />
            </div>

            <div>
              <label className={labelCls}>Key References / Bibliography (one citation per line)</label>
              <textarea
                rows={3}
                value={payload.data.keyReferences}
                onChange={(e) =>
                  onChange({
                    category: 'research_proposal',
                    data: { ...payload.data, keyReferences: e.target.value },
                  })
                }
                placeholder="Enter formatted academic references (one per line)..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>
        </>
      )}

      {/* 8. STUDY PLAN */}
      {payload.category === 'study_plan' && (
        <>
          <SectionBlock title="1. Applicant & Host Program Overview">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Applicant Full Name *</label>
                <input
                  type="text"
                  value={payload.data.applicantName}
                  onChange={(e) =>
                    onChange({
                      category: 'study_plan',
                      data: { ...payload.data, applicantName: e.target.value },
                    })
                  }
                  placeholder="Full name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Document Heading (Optional)</label>
                <input
                  type="text"
                  value={payload.data.documentTitle}
                  onChange={(e) =>
                    onChange({
                      category: 'study_plan',
                      data: { ...payload.data, documentTitle: e.target.value },
                    })
                  }
                  placeholder="Defaults to Academic Study Plan"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Target Degree / Program *</label>
                <input
                  type="text"
                  value={payload.data.targetDegree}
                  onChange={(e) =>
                    onChange({
                      category: 'study_plan',
                      data: { ...payload.data, targetDegree: e.target.value },
                    })
                  }
                  placeholder="e.g. M.Sc. in Business Analytics"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Host University / Institution *</label>
                <input
                  type="text"
                  value={payload.data.hostInstitution}
                  onChange={(e) =>
                    onChange({
                      category: 'study_plan',
                      data: { ...payload.data, hostInstitution: e.target.value },
                    })
                  }
                  placeholder="University name"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Host Country</label>
                <input
                  type="text"
                  value={payload.data.hostCountry}
                  onChange={(e) =>
                    onChange({
                      category: 'study_plan',
                      data: { ...payload.data, hostCountry: e.target.value },
                    })
                  }
                  placeholder="Country"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Program Duration</label>
                <input
                  type="text"
                  value={payload.data.programDuration}
                  onChange={(e) =>
                    onChange({
                      category: 'study_plan',
                      data: { ...payload.data, programDuration: e.target.value },
                    })
                  }
                  placeholder="e.g. 24 Months (2026–2028)"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Email Address</label>
                <input
                  type="email"
                  value={payload.data.applicantEmail}
                  onChange={(e) =>
                    onChange({
                      category: 'study_plan',
                      data: { ...payload.data, applicantEmail: e.target.value },
                    })
                  }
                  placeholder="applicant@email.com"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Current Location (Optional)</label>
                <input
                  type="text"
                  value={payload.data.applicantLocation}
                  onChange={(e) =>
                    onChange({
                      category: 'study_plan',
                      data: { ...payload.data, applicantLocation: e.target.value },
                    })
                  }
                  placeholder="City, Country"
                  className={inputCls}
                />
              </div>
            </div>
          </SectionBlock>

          <SectionBlock title="2. Readiness & Purpose of Study">
            <div>
              <label className={labelCls}>Academic Background &amp; Readiness</label>
              <textarea
                rows={3}
                value={payload.data.academicBackground}
                onChange={(e) =>
                  onChange({
                    category: 'study_plan',
                    data: { ...payload.data, academicBackground: e.target.value },
                  })
                }
                placeholder="Summarize previous degree credentials, foundational courses, and readiness for advanced study..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Purpose of Study &amp; Specialization Focus *</label>
              <textarea
                rows={4}
                value={payload.data.purposeAndSpecialization}
                onChange={(e) =>
                  onChange({
                    category: 'study_plan',
                    data: { ...payload.data, purposeAndSpecialization: e.target.value },
                  })
                }
                placeholder="Explain why you selected this degree, country, and technical specialization..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>

          <SectionBlock
            title="3. Term-by-Term Coursework & Milestones"
            action={
              <button
                type="button"
                onClick={() =>
                  onChange({
                    category: 'study_plan',
                    data: {
                      ...payload.data,
                      studyTerms: [
                        ...payload.data.studyTerms,
                        { id: makeUid('term'), termLabel: '', courses: '', academicGoal: '' },
                      ],
                    },
                  })
                }
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 text-white text-[10.5px] font-semibold cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Term</span>
              </button>
            }
          >
            {payload.data.studyTerms.map((term: StudyTermEntry, idx) => (
              <div
                key={term.id}
                className="p-2.5 rounded-lg bg-[#f8fafc] border border-slate-200 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold text-cyan-900">Term #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        category: 'study_plan',
                        data: {
                          ...payload.data,
                          studyTerms: payload.data.studyTerms.filter((x) => x.id !== term.id),
                        },
                      })
                    }
                    className="text-rose-600 text-[10.5px] font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
                <input
                  type="text"
                  value={term.termLabel}
                  onChange={(e) =>
                    onChange({
                      category: 'study_plan',
                      data: {
                        ...payload.data,
                        studyTerms: payload.data.studyTerms.map((x) =>
                          x.id === term.id ? { ...x, termLabel: e.target.value } : x
                        ),
                      },
                    })
                  }
                  placeholder="Term Label (e.g. Semester 1 — Fall 2026)"
                  className={inputCls}
                />
                <input
                  type="text"
                  value={term.courses}
                  onChange={(e) =>
                    onChange({
                      category: 'study_plan',
                      data: {
                        ...payload.data,
                        studyTerms: payload.data.studyTerms.map((x) =>
                          x.id === term.id ? { ...x, courses: e.target.value } : x
                        ),
                      },
                    })
                  }
                  placeholder="Planned Courses / Modules"
                  className={inputCls}
                />
                <textarea
                  rows={2}
                  value={term.academicGoal}
                  onChange={(e) =>
                    onChange({
                      category: 'study_plan',
                      data: {
                        ...payload.data,
                        studyTerms: payload.data.studyTerms.map((x) =>
                          x.id === term.id ? { ...x, academicGoal: e.target.value } : x
                        ),
                      },
                    })
                  }
                  placeholder="Academic & research milestones for this term..."
                  className={textareaCls}
                />
              </div>
            ))}
          </SectionBlock>

          <SectionBlock title="4. Preparation & Post-Study Career Plan">
            <div>
              <label className={labelCls}>Language &amp; Technical Preparation (Optional)</label>
              <textarea
                rows={2}
                value={payload.data.languageAndTechnicalPrep}
                onChange={(e) =>
                  onChange({
                    category: 'study_plan',
                    data: { ...payload.data, languageAndTechnicalPrep: e.target.value },
                  })
                }
                placeholder="Note language certifications, prerequisite coursework, or preparatory tools..."
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>Post-Study Career &amp; Home-Country Impact</label>
              <textarea
                rows={3}
                value={payload.data.postStudyCareerImpact}
                onChange={(e) =>
                  onChange({
                    category: 'study_plan',
                    data: { ...payload.data, postStudyCareerImpact: e.target.value },
                  })
                }
                placeholder="Describe your career plan upon graduation and intended impact..."
                className={textareaCls}
              />
            </div>
          </SectionBlock>
        </>
      )}
    </div>
  );
};
