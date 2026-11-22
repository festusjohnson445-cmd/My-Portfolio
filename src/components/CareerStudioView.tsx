import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileDown,
  FileText,
  Globe,
  HelpCircle,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import {
  CAREER_CATEGORY_META,
  CAREER_STUDIO_CATEGORIES,
  createDefaultSectionCustomization,
  createEmptyFormData,
  deleteCareerStudioDocument,
  fetchCareerStudioDocuments,
  getCachedCareerStudioDocs,
  getCareerStudioClientToken,
  resolveDocumentTitle,
  saveCareerStudioDocument,
  subscribeToCareerStudioDocuments,
  uploadCareerStudioArtifact,
  validateCareerStudioForm,
  type CareerCertificationEntry,
  type CareerEducationEntry,
  type CareerExperienceEntry,
  type CareerLanguageEntry,
  type CareerMilestoneEntry,
  type CareerProjectEntry,
  type CareerPublicationEntry,
  type CareerRefereeEntry,
  type CareerSectionCustomization,
  type CareerStudioCategory,
  type CareerStudioDocumentRecord,
  type CareerStudioFormData,
} from '../utils/careerStudio';
import {
  buildCareerStudioDocxBlob,
  buildCareerStudioPdfBytes,
  downloadCareerStudioDocx,
  downloadCareerStudioPdf,
} from '../utils/careerStudioExport';
import { CareerStudioPreview } from './CareerStudioPreview';
import { renderPdfFirstPageToImage } from '../utils/pdfRenderer';
import { useProfileSync } from '../utils/profileState';
import { useWebsiteSettingsSync } from '../utils/portfolioSupabase';

function makeUid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const inputCls =
  'w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-[#b8c6d4] bg-white text-slate-900 placeholder-slate-400 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-cyan-800';
const textareaCls =
  'w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-[#b8c6d4] bg-white text-slate-900 placeholder-slate-400 text-xs font-sans leading-relaxed focus:outline-none focus:ring-1 focus:ring-cyan-800';
const labelCls = 'block text-[10.5px] font-bold text-slate-800 mb-0.5 font-sans';
const smallBtnCls =
  'inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0';

export const CareerStudioView: React.FC = () => {
  const { isOwner } = useProfileSync();
  const settings = useWebsiteSettingsSync();
  const csConfig = settings.appearanceConfig.careerStudioConfig;

  const enabledCategories = useMemo(
    () =>
      CAREER_STUDIO_CATEGORIES.filter(
        (cat) => isOwner || csConfig?.forms?.[cat]?.enabled !== false
      ),
    [isOwner, csConfig]
  );

  const [selectedCategory, setSelectedCategory] = useState<CareerStudioCategory>('International CV');
  const [formData, setFormData] = useState<CareerStudioFormData>(() => createEmptyFormData());
  const [sectionCustomization, setSectionCustomization] = useState<CareerSectionCustomization>(() =>
    createDefaultSectionCustomization('International CV')
  );
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);
  const [showGuidancePanel, setShowGuidancePanel] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState<'pdf' | 'docx' | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [postDownloadPrompt, setPostDownloadPrompt] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  // Saved & Published docs
  const [documents, setDocuments] = useState<CareerStudioDocumentRecord[]>(() =>
    getCachedCareerStudioDocs()
  );
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showcaseFilter, setShowcaseFilter] = useState<string>('All');
  const [showcaseSearch, setShowcaseSearch] = useState('');
  const [inspectDoc, setInspectDoc] = useState<CareerStudioDocumentRecord | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'studio' | 'published' | 'saved'>('studio');

  const previewRef = useRef<HTMLDivElement | null>(null);
  const clientToken = useMemo(() => getCareerStudioClientToken(), []);

  // Ensure selectedCategory stays valid if admin disables a form
  useEffect(() => {
    if (enabledCategories.length > 0 && !enabledCategories.includes(selectedCategory)) {
      const next = enabledCategories[0];
      setSelectedCategory(next);
      setSectionCustomization(createDefaultSectionCustomization(next));
    }
  }, [enabledCategories, selectedCategory]);

  const loadDocuments = async () => {
    setLoadingDocs(true);
    try {
      const list = await fetchCareerStudioDocuments(isOwner);
      setDocuments(list);
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
    const unsub = subscribeToCareerStudioDocuments(() => {
      void loadDocuments();
    });
    return () => unsub();
  }, [isOwner]);

  const flashNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice((cur) => (cur === msg ? null : cur)), 4500);
  };

  const handleCategoryChange = (nextCat: CareerStudioCategory) => {
    setSelectedCategory(nextCat);
    setSectionCustomization(createDefaultSectionCustomization(nextCat));
    setValidationErrors([]);
    setPostDownloadPrompt(false);
  };

  const categoryMeta = CAREER_CATEGORY_META[selectedCategory];
  const formRule = csConfig?.forms?.[selectedCategory];
  const canShowGuidance = (formRule?.showGuidance ?? true) && showGuidancePanel;
  const canPublishCategory =
    isOwner || ((csConfig?.allowVisitorPublish ?? true) && (formRule?.allowPublish ?? true));

  const validation = useMemo(
    () => validateCareerStudioForm(selectedCategory, formData),
    [selectedCategory, formData]
  );

  // Synchronized preview + explicit Update Preview trigger
  const handleUpdatePreview = () => {
    const res = validateCareerStudioForm(selectedCategory, formData);
    setValidationErrors(res.errors);
    setPreviewNonce((n) => n + 1);
    previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (res.valid) {
      flashNotice('Preview updated.');
    } else {
      flashNotice('Preview updated — review required fields.');
    }
  };

  const handleClearForm = () => {
    setFormData(createEmptyFormData());
    setSectionCustomization(createDefaultSectionCustomization(selectedCategory));
    setEditingDocId(null);
    setValidationErrors([]);
    setPostDownloadPrompt(false);
    flashNotice('Form cleared.');
  };

  const handleSaveDraft = async () => {
    const res = validateCareerStudioForm(selectedCategory, formData);
    setValidationErrors(res.errors);
    if (!res.valid) {
      flashNotice('Complete required fields before saving.');
      return;
    }
    setIsSaving(true);
    try {
      const id = editingDocId || makeUid('cs_doc');
      const title = resolveDocumentTitle(selectedCategory, formData);
      const saved = await saveCareerStudioDocument({
        id,
        category: selectedCategory,
        title,
        authorName: formData.fullName.trim() || 'Anonymous',
        formData,
        sectionConfig: sectionCustomization,
        status: 'draft',
      });
      setEditingDocId(saved.id);
      setDocuments((prev) =>
        prev.some((d) => d.id === saved.id)
          ? prev.map((d) => (d.id === saved.id ? saved : d))
          : [saved, ...prev]
      );
      flashNotice('Saved to your workspace.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    const res = validateCareerStudioForm(selectedCategory, formData);
    setValidationErrors(res.errors);
    if (!res.valid) {
      flashNotice('Complete required fields to export PDF.');
      return;
    }
    setIsExporting('pdf');
    try {
      downloadCareerStudioPdf(selectedCategory, formData, sectionCustomization);
      setPostDownloadPrompt(true);
      flashNotice('PDF downloaded.');
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadDocx = async () => {
    const res = validateCareerStudioForm(selectedCategory, formData);
    setValidationErrors(res.errors);
    if (!res.valid) {
      flashNotice('Complete required fields to export DOCX.');
      return;
    }
    setIsExporting('docx');
    try {
      await downloadCareerStudioDocx(selectedCategory, formData, sectionCustomization);
      setPostDownloadPrompt(true);
      flashNotice('DOCX downloaded.');
    } finally {
      setIsExporting(null);
    }
  };

  const handlePublishDocument = async () => {
    const res = validateCareerStudioForm(selectedCategory, formData);
    setValidationErrors(res.errors);
    if (!res.valid) {
      flashNotice('Complete required fields before publishing.');
      return;
    }
    setIsPublishing(true);
    try {
      const id = editingDocId || makeUid('cs_doc');
      const title = resolveDocumentTitle(selectedCategory, formData);

      // Generate PDF, DOCX & crisp Page-1 thumbnail preview
      const pdfRes = buildCareerStudioPdfBytes(selectedCategory, formData, sectionCustomization);
      const docxRes = await buildCareerStudioDocxBlob(selectedCategory, formData, sectionCustomization);
      const page1DataUrl = await renderPdfFirstPageToImage(pdfRes.arrayBuffer, 560).catch(() => null);

      const [pdfUrl, docxUrl, previewImageUrl] = await Promise.all([
        uploadCareerStudioArtifact(pdfRes.blob, `${id}_${pdfRes.fileName}`, 'application/pdf'),
        uploadCareerStudioArtifact(
          docxRes.blob,
          `${id}_${docxRes.fileName}`,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ),
        (async () => {
          if (!page1DataUrl || !page1DataUrl.startsWith('data:image/')) return '';
          const parts = page1DataUrl.split(',');
          const bin = atob(parts[1] || '');
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const imgBlob = new Blob([bytes], { type: 'image/jpeg' });
          return uploadCareerStudioArtifact(imgBlob, `${id}_page1.jpg`, 'image/jpeg');
        })(),
      ]);

      const published = await saveCareerStudioDocument({
        id,
        category: selectedCategory,
        title,
        authorName: formData.fullName.trim() || 'Contributor',
        formData,
        sectionConfig: sectionCustomization,
        pdfUrl,
        docxUrl,
        previewImageUrl: previewImageUrl || page1DataUrl || '',
        status: 'published',
      });

      setEditingDocId(published.id);
      setPostDownloadPrompt(false);
      setDocuments((prev) =>
        prev.some((d) => d.id === published.id)
          ? prev.map((d) => (d.id === published.id ? published : d))
          : [published, ...prev]
      );
      flashNotice('Document published to Career Studio.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDeleteCurrentOutput = async () => {
    if (editingDocId) {
      await deleteCareerStudioDocument(editingDocId);
      setDocuments((prev) => prev.filter((d) => d.id !== editingDocId));
    }
    setFormData(createEmptyFormData());
    setSectionCustomization(createDefaultSectionCustomization(selectedCategory));
    setEditingDocId(null);
    setPostDownloadPrompt(false);
    flashNotice('Output deleted.');
  };

  const handleLoadIntoStudio = (doc: CareerStudioDocumentRecord) => {
    setSelectedCategory(doc.category);
    setFormData(doc.formData);
    setSectionCustomization(doc.sectionConfig);
    setEditingDocId(doc.id);
    setValidationErrors([]);
    setPostDownloadPrompt(false);
    setActiveWorkspaceTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    flashNotice(`Loaded "${doc.title}" for editing.`);
  };

  const handleDeleteSavedDoc = async (doc: CareerStudioDocumentRecord) => {
    await deleteCareerStudioDocument(doc.id);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    if (editingDocId === doc.id) setEditingDocId(null);
    if (inspectDoc?.id === doc.id) setInspectDoc(null);
    flashNotice('Document deleted.');
  };

  const publishedDocs = useMemo(() => {
    const q = showcaseSearch.trim().toLowerCase();
    return documents.filter((d) => {
      if (d.status !== 'published') return false;
      if (showcaseFilter !== 'All' && d.category !== showcaseFilter) return false;
      if (q) {
        return (
          d.title.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          d.authorName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [documents, showcaseFilter, showcaseSearch]);

  const savedDrafts = useMemo(
    () =>
      documents.filter(
        (d) => d.status === 'draft' && (isOwner || d.clientToken === clientToken)
      ),
    [documents, isOwner, clientToken]
  );

  // Move section order in customization panel
  const moveSectionOrder = (sectionId: string, dir: -1 | 1) => {
    setSectionCustomization((prev) => {
      const arr = [...prev.order];
      const idx = arr.indexOf(sectionId);
      if (idx === -1) return prev;
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return { ...prev, order: arr };
    });
  };

  const toggleSectionVisibility = (sectionId: string) => {
    setSectionCustomization((prev) => {
      const exists = prev.hiddenSections.includes(sectionId);
      return {
        ...prev,
        hiddenSections: exists
          ? prev.hiddenSections.filter((x) => x !== sectionId)
          : [...prev.hiddenSections, sectionId],
      };
    });
  };

  // Dynamic Repeatable Array Mutators
  const addEducation = () =>
    setFormData((p) => ({
      ...p,
      education: [
        ...p.education,
        {
          id: makeUid('edu'),
          degree: '',
          institution: '',
          location: '',
          startYear: '',
          endYear: '',
          gradeOrGpa: '',
          highlights: '',
        },
      ],
    }));

  const updateEducation = (id: string, patch: Partial<CareerEducationEntry>) =>
    setFormData((p) => ({
      ...p,
      education: p.education.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const addExperience = () =>
    setFormData((p) => ({
      ...p,
      experience: [
        ...p.experience,
        {
          id: makeUid('exp'),
          role: '',
          organization: '',
          location: '',
          startDate: '',
          endDate: '',
          isCurrent: false,
          bullets: '',
        },
      ],
    }));

  const updateExperience = (id: string, patch: Partial<CareerExperienceEntry>) =>
    setFormData((p) => ({
      ...p,
      experience: p.experience.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const addProject = () =>
    setFormData((p) => ({
      ...p,
      projects: [
        ...p.projects,
        { id: makeUid('prj'), name: '', roleOrContext: '', tools: '', outcome: '' },
      ],
    }));

  const updateProject = (id: string, patch: Partial<CareerProjectEntry>) =>
    setFormData((p) => ({
      ...p,
      projects: p.projects.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const addPublication = () =>
    setFormData((p) => ({
      ...p,
      publications: [
        ...p.publications,
        { id: makeUid('pub'), title: '', authors: '', venue: '', year: '', doiOrUrl: '' },
      ],
    }));

  const updatePublication = (id: string, patch: Partial<CareerPublicationEntry>) =>
    setFormData((p) => ({
      ...p,
      publications: p.publications.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const addCertification = () =>
    setFormData((p) => ({
      ...p,
      certifications: [
        ...p.certifications,
        { id: makeUid('cert'), name: '', issuer: '', year: '', credentialId: '' },
      ],
    }));

  const updateCertification = (id: string, patch: Partial<CareerCertificationEntry>) =>
    setFormData((p) => ({
      ...p,
      certifications: p.certifications.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const addLanguage = () =>
    setFormData((p) => ({
      ...p,
      languages: [...p.languages, { id: makeUid('lang'), language: '', proficiency: '' }],
    }));

  const updateLanguage = (id: string, patch: Partial<CareerLanguageEntry>) =>
    setFormData((p) => ({
      ...p,
      languages: p.languages.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const addReferee = () =>
    setFormData((p) => ({
      ...p,
      referees: [
        ...p.referees,
        { id: makeUid('ref'), name: '', titleAndOrg: '', email: '', phone: '' },
      ],
    }));

  const updateReferee = (id: string, patch: Partial<CareerRefereeEntry>) =>
    setFormData((p) => ({
      ...p,
      referees: p.referees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const addMilestone = (field: 'milestones' | 'studySchedule') =>
    setFormData((p) => ({
      ...p,
      [field]: [...p[field], { id: makeUid('ms'), phase: '', duration: '', deliverable: '' }],
    }));

  const updateMilestone = (
    field: 'milestones' | 'studySchedule',
    id: string,
    patch: Partial<CareerMilestoneEntry>
  ) =>
    setFormData((p) => ({
      ...p,
      [field]: p[field].map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));

  const addCustomSection = () =>
    setFormData((p) => ({
      ...p,
      customSections: [...p.customSections, { id: makeUid('csec'), heading: '', content: '' }],
    }));

  // Respect Admin Dashboard master & visitor gates
  if (csConfig?.enabled === false || (!isOwner && csConfig?.allowVisitorAccess === false)) {
    return (
      <div className="flex-1 w-full max-w-2xl mx-auto px-4 py-12 font-serif text-center">
        <div className="p-6 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] space-y-2">
          <h1 className="text-base font-bold text-slate-950">Career and Academic</h1>
          <p className="text-xs text-slate-600">
            Career Studio is currently restricted by the administrator.
          </p>
        </div>
      </div>
    );
  }

  // Shared Reusable Sub-Editors (Education, Experience, Referees)
  const renderEducationBuilder = () => (
    <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-900">Education</span>
        <button
          type="button"
          onClick={addEducation}
          className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
        >
          <Plus className="w-3 h-3" />
          <span>Add</span>
        </button>
      </div>
      {formData.education.map((ed, idx) => (
        <div key={ed.id} className="p-2.5 rounded-lg bg-[#edf2f8]/70 border border-[#b8c6d4] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-cyan-900 uppercase">Entry {idx + 1}</span>
            <button
              type="button"
              onClick={() =>
                setFormData((p) => ({ ...p, education: p.education.filter((x) => x.id !== ed.id) }))
              }
              className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
              title="Remove entry"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Degree / Qualification"
              value={ed.degree}
              onChange={(e) => updateEducation(ed.id, { degree: e.target.value })}
              className={inputCls}
            />
            <input
              type="text"
              placeholder="Institution / University"
              value={ed.institution}
              onChange={(e) => updateEducation(ed.id, { institution: e.target.value })}
              className={inputCls}
            />
            <input
              type="text"
              placeholder="City, Country (optional)"
              value={ed.location}
              onChange={(e) => updateEducation(ed.id, { location: e.target.value })}
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-1.5 min-w-0">
              <input
                type="text"
                placeholder="Start year"
                value={ed.startYear}
                onChange={(e) => updateEducation(ed.id, { startYear: e.target.value })}
                className={inputCls}
              />
              <input
                type="text"
                placeholder="End year"
                value={ed.endYear}
                onChange={(e) => updateEducation(ed.id, { endYear: e.target.value })}
                className={inputCls}
              />
            </div>
            <input
              type="text"
              placeholder="GPA / Honors / Class (optional)"
              value={ed.gradeOrGpa}
              onChange={(e) => updateEducation(ed.id, { gradeOrGpa: e.target.value })}
              className={inputCls}
            />
          </div>
          <textarea
            rows={2}
            placeholder="Thesis, coursework, or academic highlights (one per line)"
            value={ed.highlights}
            onChange={(e) => updateEducation(ed.id, { highlights: e.target.value })}
            className={textareaCls}
          />
        </div>
      ))}
    </div>
  );

  const renderExperienceBuilder = (headingLabel: string) => (
    <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-900">{headingLabel}</span>
        <button
          type="button"
          onClick={addExperience}
          className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
        >
          <Plus className="w-3 h-3" />
          <span>Add</span>
        </button>
      </div>
      {formData.experience.map((exp, idx) => (
        <div key={exp.id} className="p-2.5 rounded-lg bg-[#edf2f8]/70 border border-[#b8c6d4] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-cyan-900 uppercase">Entry {idx + 1}</span>
            <button
              type="button"
              onClick={() =>
                setFormData((p) => ({
                  ...p,
                  experience: p.experience.filter((x) => x.id !== exp.id),
                }))
              }
              className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
              title="Remove entry"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Role / Position title"
              value={exp.role}
              onChange={(e) => updateExperience(exp.id, { role: e.target.value })}
              className={inputCls}
            />
            <input
              type="text"
              placeholder="Organization / Company / Lab"
              value={exp.organization}
              onChange={(e) => updateExperience(exp.id, { organization: e.target.value })}
              className={inputCls}
            />
            <input
              type="text"
              placeholder="Location (optional)"
              value={exp.location}
              onChange={(e) => updateExperience(exp.id, { location: e.target.value })}
              className={inputCls}
            />
            <div className="flex items-center gap-1.5 min-w-0">
              <input
                type="text"
                placeholder="Start date"
                value={exp.startDate}
                onChange={(e) => updateExperience(exp.id, { startDate: e.target.value })}
                className={inputCls}
              />
              {!exp.isCurrent && (
                <input
                  type="text"
                  placeholder="End date"
                  value={exp.endDate}
                  onChange={(e) => updateExperience(exp.id, { endDate: e.target.value })}
                  className={inputCls}
                />
              )}
              <label className="inline-flex items-center gap-1 text-[10px] font-sans text-slate-700 whitespace-nowrap shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exp.isCurrent}
                  onChange={(e) => updateExperience(exp.id, { isCurrent: e.target.checked })}
                />
                <span>Current</span>
              </label>
            </div>
          </div>
          <textarea
            rows={3}
            placeholder="Key responsibilities & quantified achievements (one per line)"
            value={exp.bullets}
            onChange={(e) => updateExperience(exp.id, { bullets: e.target.value })}
            className={textareaCls}
          />
        </div>
      ))}
    </div>
  );

  const renderRefereesBuilder = () => (
    <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-900">References / Referees (optional)</span>
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-1 text-[10.5px] font-sans text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.refereesAvailableOnRequest}
              onChange={(e) =>
                setFormData((p) => ({ ...p, refereesAvailableOnRequest: e.target.checked }))
              }
            />
            <span>Available on request</span>
          </label>
          <button
            type="button"
            onClick={addReferee}
            className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
          >
            <Plus className="w-3 h-3" />
            <span>Add</span>
          </button>
        </div>
      </div>
      {formData.referees.map((r, idx) => (
        <div key={r.id} className="p-2.5 rounded-lg bg-[#edf2f8]/70 border border-[#b8c6d4] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-cyan-900 uppercase">Referee {idx + 1}</span>
            <button
              type="button"
              onClick={() =>
                setFormData((p) => ({ ...p, referees: p.referees.filter((x) => x.id !== r.id) }))
              }
              className="p-1 rounded text-rose-600 hover:bg-rose-50 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Referee full name"
              value={r.name}
              onChange={(e) => updateReferee(r.id, { name: e.target.value })}
              className={inputCls}
            />
            <input
              type="text"
              placeholder="Title & organization"
              value={r.titleAndOrg}
              onChange={(e) => updateReferee(r.id, { titleAndOrg: e.target.value })}
              className={inputCls}
            />
            <input
              type="email"
              placeholder="Email address"
              value={r.email}
              onChange={(e) => updateReferee(r.id, { email: e.target.value })}
              className={inputCls}
            />
            <input
              type="text"
              placeholder="Phone (optional)"
              value={r.phone}
              onChange={(e) => updateReferee(r.id, { phone: e.target.value })}
              className={inputCls}
            />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-16 space-y-5 font-serif text-slate-900">
      {/* HEADER CONTAINER */}
      <div className="max-w-md mx-auto px-4 py-2.5 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs text-center space-y-0.5">
        <h1 className="text-base sm:text-lg font-bold text-slate-950 tracking-tight text-center">
          Career and Academic
        </h1>
        <p className="text-[11px] sm:text-xs font-sans text-slate-600 text-center">
          Build your professional career document here !!
        </p>
      </div>

      {/* COMPACT WORKSPACE BAR */}
      <div className="p-3 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <button
            type="button"
            onClick={() => setActiveWorkspaceTab('studio')}
            className={`${smallBtnCls} ${
              activeWorkspaceTab === 'studio'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-800 border border-[#b8c6d4] hover:bg-slate-50'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Builder</span>
          </button>
          {(csConfig?.showPublishedShowcase ?? true) && (
            <button
              type="button"
              onClick={() => setActiveWorkspaceTab('published')}
              className={`${smallBtnCls} ${
                activeWorkspaceTab === 'published'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-800 border border-[#b8c6d4] hover:bg-slate-50'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Published ({publishedDocs.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveWorkspaceTab('saved')}
            className={`${smallBtnCls} ${
              activeWorkspaceTab === 'saved'
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-800 border border-[#b8c6d4] hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Saved ({savedDrafts.length})</span>
          </button>
        </div>

        {activeWorkspaceTab === 'studio' && (
          <div className="flex items-center gap-1.5 min-w-0 flex-1 sm:flex-initial justify-end">
            <label htmlFor="career-cat-select" className="text-[10.5px] font-sans font-bold text-slate-700 hidden sm:inline whitespace-nowrap">
              Document:
            </label>
            <select
              id="career-cat-select"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value as CareerStudioCategory)}
              className="min-w-0 max-w-[210px] px-2 py-1 rounded-lg border border-[#b8c6d4] bg-white text-slate-900 text-[11px] font-sans font-semibold cursor-pointer truncate"
            >
              {enabledCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowGuidancePanel((v) => !v)}
              className={`${smallBtnCls} bg-white border border-[#b8c6d4] text-slate-700 hover:bg-slate-50`}
              title="Toggle writing guidance"
            >
              <HelpCircle className="w-3 h-3" />
              <span className="hidden sm:inline">Guide</span>
            </button>
            <button
              type="button"
              onClick={() => setShowCustomization((v) => !v)}
              className={`${smallBtnCls} bg-white border border-[#b8c6d4] text-slate-700 hover:bg-slate-50`}
              title="Customize sections"
            >
              <Sliders className="w-3 h-3" />
              <span className="hidden sm:inline">Sections</span>
            </button>
          </div>
        )}
      </div>

      {/* STATUS NOTICE */}
      {notice && (
        <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-sans flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>{notice}</span>
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 1: DOCUMENT BUILDER + LIVE SYNCHRONIZED PREVIEW                 */}
      {/* =================================================================== */}
      {activeWorkspaceTab === 'studio' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* LEFT: CATEGORY-SPECIFIC STRUCTURED FORM */}
          <div className="lg:col-span-6 p-3.5 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs space-y-3 min-w-0">
            {/* Category Bar & Completeness */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#b8c6d4]">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-950">{selectedCategory}</span>
                  {categoryMeta.atsCompliant && (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-900 text-white text-[9px] font-sans font-bold">
                      ATS Standard
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-sans text-slate-600">
                  Completeness: {validation.completenessPct}%
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleUpdatePreview}
                  className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white shadow-2xs`}
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Update Preview</span>
                </button>
                <button
                  type="button"
                  onClick={handleClearForm}
                  className={`${smallBtnCls} bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-[#b8c6d4]`}
                  title="Clear form"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* Guidance Banner */}
            {canShowGuidance && (
              <div className="p-2.5 rounded-lg bg-white/90 border border-cyan-800/30 text-[11px] font-sans text-slate-700 leading-relaxed">
                <strong className="text-cyan-950 block mb-0.5">Guidance:</strong>
                {formRule?.customHint?.trim() || categoryMeta.summaryTip}
              </div>
            )}

            {/* Section Customization Panel */}
            {showCustomization && (
              <div className="p-2.5 rounded-lg bg-white border border-[#b8c6d4] space-y-2 text-xs font-sans">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-[11px]">
                    Section Order, Visibility &amp; Headings
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSectionCustomization(createDefaultSectionCustomization(selectedCategory))
                    }
                    className="text-[10px] text-cyan-900 underline cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
                <div className="space-y-1.5">
                  {sectionCustomization.order.map((secId, idx) => {
                    const defaultLabel = categoryMeta.sectionLabels[secId] || secId;
                    const isHidden = sectionCustomization.hiddenSections.includes(secId);
                    return (
                      <div
                        key={secId}
                        className="flex items-center gap-1.5 p-1.5 rounded bg-slate-50 border border-slate-200"
                      >
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          onChange={() => toggleSectionVisibility(secId)}
                          title="Show section"
                        />
                        <input
                          type="text"
                          value={sectionCustomization.customTitleOverrides[secId] ?? defaultLabel}
                          onChange={(e) =>
                            setSectionCustomization((prev) => ({
                              ...prev,
                              customTitleOverrides: {
                                ...prev.customTitleOverrides,
                                [secId]: e.target.value,
                              },
                            }))
                          }
                          className="flex-1 min-w-0 px-2 py-0.5 rounded border border-slate-300 bg-white text-[11px]"
                        />
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSectionOrder(secId, -1)}
                          className="p-1 rounded bg-white border border-slate-300 disabled:opacity-40 cursor-pointer"
                          title="Move up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === sectionCustomization.order.length - 1}
                          onClick={() => moveSectionOrder(secId, 1)}
                          className="p-1 rounded bg-white border border-slate-300 disabled:opacity-40 cursor-pointer"
                          title="Move down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-sans space-y-0.5">
                <strong className="block">Required fields missing:</strong>
                <ul className="list-disc pl-4 space-y-0.5">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 1. IDENTITY & DOCUMENT METADATA (TAILORED PER CATEGORY) */}
            <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2.5">
              <span className="block text-xs font-bold text-slate-900">
                Identity &amp; Header Details
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="min-w-0">
                  <label className={labelCls}>Full Name *</label>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={formData.fullName}
                    onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="min-w-0">
                  <label className={labelCls}>Email *</label>
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="min-w-0">
                  <label className={labelCls}>Phone (optional)</label>
                  <input
                    type="text"
                    placeholder="Phone number"
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="min-w-0">
                  <label className={labelCls}>City &amp; Country (optional)</label>
                  <input
                    type="text"
                    placeholder="City, Country"
                    value={formData.location}
                    onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="min-w-0">
                  <label className={labelCls}>Portfolio / LinkedIn / ORCID (optional)</label>
                  <input
                    type="text"
                    placeholder="URL or identifier"
                    value={formData.websiteOrLink}
                    onChange={(e) => setFormData((p) => ({ ...p, websiteOrLink: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div className="min-w-0">
                  <label className={labelCls}>Saved Document Title (optional)</label>
                  <input
                    type="text"
                    placeholder="Custom document title"
                    value={formData.documentTitle}
                    onChange={(e) => setFormData((p) => ({ ...p, documentTitle: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              {(selectedCategory === 'International CV' || selectedCategory === 'Job Resume') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="min-w-0">
                    <label className={labelCls}>
                      {selectedCategory === 'Job Resume'
                        ? 'Target Role / Job Headline *'
                        : 'Professional Title (optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="Target job title or specialization"
                      value={formData.headlineOrTargetRole}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, headlineOrTargetRole: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={labelCls}>Work Authorization / Mobility (optional)</label>
                    <input
                      type="text"
                      placeholder="Visa status or relocation note"
                      value={formData.workAuthorization}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, workAuthorization: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              {selectedCategory === 'Academic Resume' && (
                <div className="pt-1">
                  <label className={labelCls}>Current Academic Title &amp; Affiliation *</label>
                  <input
                    type="text"
                    placeholder="Title, Department, Institution"
                    value={formData.academicAffiliation}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, academicAffiliation: e.target.value }))
                    }
                    className={inputCls}
                  />
                </div>
              )}

              {(selectedCategory === 'Statement of Purpose (SOP)' ||
                selectedCategory === 'Personal Statement' ||
                selectedCategory === 'Scholarship Motivation Letter' ||
                selectedCategory === 'Research Proposal' ||
                selectedCategory === 'Study Plan') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="min-w-0">
                    <label className={labelCls}>
                      {selectedCategory === 'Research Proposal'
                        ? 'Proposed Degree / Grant Level'
                        : 'Target Degree & Program *'}
                    </label>
                    <input
                      type="text"
                      placeholder="Degree or program name"
                      value={
                        selectedCategory === 'Research Proposal'
                          ? formData.proposedDegreeLevel
                          : formData.targetProgram
                      }
                      onChange={(e) =>
                        setFormData((p) =>
                          selectedCategory === 'Research Proposal'
                            ? { ...p, proposedDegreeLevel: e.target.value }
                            : { ...p, targetProgram: e.target.value }
                        )
                      }
                      className={inputCls}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={labelCls}>
                      {selectedCategory === 'Research Proposal'
                        ? 'Host Institution (optional)'
                        : 'Target University / Institution *'}
                    </label>
                    <input
                      type="text"
                      placeholder="Institution name"
                      value={formData.targetInstitution}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, targetInstitution: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={labelCls}>Department / Faculty (optional)</label>
                    <input
                      type="text"
                      placeholder="Department name"
                      value={formData.targetDepartment}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, targetDepartment: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={labelCls}>Date (optional)</label>
                    <input
                      type="text"
                      placeholder="Month Year or date"
                      value={formData.documentDate}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, documentDate: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>

                  {selectedCategory === 'Statement of Purpose (SOP)' && (
                    <div className="min-w-0 sm:col-span-2">
                      <label className={labelCls}>Application Term / Intake (optional)</label>
                      <input
                        type="text"
                        placeholder="Intake term and year"
                        value={formData.applicationTerm}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, applicationTerm: e.target.value }))
                        }
                        className={inputCls}
                      />
                    </div>
                  )}

                  {selectedCategory === 'Scholarship Motivation Letter' && (
                    <>
                      <div className="min-w-0">
                        <label className={labelCls}>Scholarship Name *</label>
                        <input
                          type="text"
                          placeholder="Scholarship or fellowship name"
                          value={formData.scholarshipName}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, scholarshipName: e.target.value }))
                          }
                          className={inputCls}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className={labelCls}>Awarding Body / Foundation (optional)</label>
                        <input
                          type="text"
                          placeholder="Funding organization"
                          value={formData.awardingBody}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, awardingBody: e.target.value }))
                          }
                          className={inputCls}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className={labelCls}>Host Country (optional)</label>
                        <input
                          type="text"
                          placeholder="Country of study"
                          value={formData.hostCountry}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, hostCountry: e.target.value }))
                          }
                          className={inputCls}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className={labelCls}>Salutation (optional)</label>
                        <input
                          type="text"
                          placeholder="Greeting line"
                          value={formData.recipientSalutation}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, recipientSalutation: e.target.value }))
                          }
                          className={inputCls}
                        />
                      </div>
                    </>
                  )}

                  {selectedCategory === 'Research Proposal' && (
                    <div className="min-w-0 sm:col-span-2">
                      <label className={labelCls}>Target Supervisor / Lab (optional)</label>
                      <input
                        type="text"
                        placeholder="Supervisor name or research group"
                        value={formData.targetSupervisor}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, targetSupervisor: e.target.value }))
                        }
                        className={inputCls}
                      />
                    </div>
                  )}

                  {selectedCategory === 'Study Plan' && (
                    <>
                      <div className="min-w-0">
                        <label className={labelCls}>Citizenship / Home Country (optional)</label>
                        <input
                          type="text"
                          placeholder="Home country"
                          value={formData.citizenshipCountry}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, citizenshipCountry: e.target.value }))
                          }
                          className={inputCls}
                        />
                      </div>
                      <div className="min-w-0">
                        <label className={labelCls}>Host Country &amp; Study Duration (optional)</label>
                        <input
                          type="text"
                          placeholder="Country and duration"
                          value={formData.studyDuration}
                          onChange={(e) =>
                            setFormData((p) => ({ ...p, studyDuration: e.target.value }))
                          }
                          className={inputCls}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 2. CATEGORY-INDEPENDENT BODY SECTIONS */}
            {(selectedCategory === 'International CV' || selectedCategory === 'Job Resume') && (
              <>
                <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2">
                  <label className={labelCls}>
                    Professional Summary {selectedCategory === 'International CV' ? '*' : ''}
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Concise career summary highlighting years of experience and key strengths"
                    value={formData.professionalSummary}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, professionalSummary: e.target.value }))
                    }
                    className={textareaCls}
                  />
                </div>

                {renderExperienceBuilder(
                  selectedCategory === 'International CV' ? 'Work Experience' : 'Professional Experience'
                )}

                {selectedCategory === 'Job Resume' && (
                  <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">Key Projects</span>
                      <button
                        type="button"
                        onClick={addProject}
                        className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>
                    {formData.projects.map((pr, idx) => (
                      <div
                        key={pr.id}
                        className="p-2.5 rounded-lg bg-[#edf2f8]/70 border border-[#b8c6d4] space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-cyan-900 uppercase">
                            Project {idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((p) => ({
                                ...p,
                                projects: p.projects.filter((x) => x.id !== pr.id),
                              }))
                            }
                            className="p-1 text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Project title"
                            value={pr.name}
                            onChange={(e) => updateProject(pr.id, { name: e.target.value })}
                            className={inputCls}
                          />
                          <input
                            type="text"
                            placeholder="Role or context"
                            value={pr.roleOrContext}
                            onChange={(e) => updateProject(pr.id, { roleOrContext: e.target.value })}
                            className={inputCls}
                          />
                        </div>
                        <input
                          type="text"
                          placeholder="Tools & technologies used (optional)"
                          value={pr.tools}
                          onChange={(e) => updateProject(pr.id, { tools: e.target.value })}
                          className={inputCls}
                        />
                        <textarea
                          rows={2}
                          placeholder="Measurable project outcome (one per line)"
                          value={pr.outcome}
                          onChange={(e) => updateProject(pr.id, { outcome: e.target.value })}
                          className={textareaCls}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {renderEducationBuilder()}

                <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2">
                  <label className={labelCls}>Core Competencies &amp; Skills</label>
                  <textarea
                    rows={3}
                    placeholder="Enter skills or categorized skill lines (one category per line)"
                    value={formData.skillsText}
                    onChange={(e) => setFormData((p) => ({ ...p, skillsText: e.target.value }))}
                    className={textareaCls}
                  />
                </div>

                {/* Certifications */}
                <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">Certifications (optional)</span>
                    <button
                      type="button"
                      onClick={addCertification}
                      className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                  {formData.certifications.map((c) => (
                    <div key={c.id} className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center">
                      <input
                        type="text"
                        placeholder="Certification title"
                        value={c.name}
                        onChange={(e) => updateCertification(c.id, { name: e.target.value })}
                        className={`${inputCls} sm:col-span-5`}
                      />
                      <input
                        type="text"
                        placeholder="Issuer"
                        value={c.issuer}
                        onChange={(e) => updateCertification(c.id, { issuer: e.target.value })}
                        className={`${inputCls} sm:col-span-4`}
                      />
                      <input
                        type="text"
                        placeholder="Year"
                        value={c.year}
                        onChange={(e) => updateCertification(c.id, { year: e.target.value })}
                        className={`${inputCls} sm:col-span-2`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            certifications: p.certifications.filter((x) => x.id !== c.id),
                          }))
                        }
                        className="p-1 text-rose-600 justify-self-end cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {selectedCategory === 'International CV' && (
                  <>
                    {/* Languages */}
                    <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900">Languages (optional)</span>
                        <button
                          type="button"
                          onClick={addLanguage}
                          className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      </div>
                      {formData.languages.map((l) => (
                        <div key={l.id} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="Language"
                            value={l.language}
                            onChange={(e) => updateLanguage(l.id, { language: e.target.value })}
                            className={inputCls}
                          />
                          <input
                            type="text"
                            placeholder="Proficiency"
                            value={l.proficiency}
                            onChange={(e) => updateLanguage(l.id, { proficiency: e.target.value })}
                            className={inputCls}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setFormData((p) => ({
                                ...p,
                                languages: p.languages.filter((x) => x.id !== l.id),
                              }))
                            }
                            className="p-1 text-rose-600 cursor-pointer shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {renderRefereesBuilder()}
                  </>
                )}
              </>
            )}

            {selectedCategory === 'Academic Resume' && (
              <>
                <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2">
                  <label className={labelCls}>Academic Profile &amp; Research Interests *</label>
                  <textarea
                    rows={3}
                    placeholder="Summarize your research specialization and scholarly focus"
                    value={formData.researchInterests}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, researchInterests: e.target.value }))
                    }
                    className={textareaCls}
                  />
                </div>
                {renderEducationBuilder()}
                {renderExperienceBuilder('Research & Teaching Appointments')}
                {/* Publications */}
                <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Publications &amp; Conference Papers
                    </span>
                    <button
                      type="button"
                      onClick={addPublication}
                      className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                  {formData.publications.map((pub, idx) => (
                    <div
                      key={pub.id}
                      className="p-2.5 rounded-lg bg-[#edf2f8]/70 border border-[#b8c6d4] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-cyan-900 uppercase">
                          Publication {idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((p) => ({
                              ...p,
                              publications: p.publications.filter((x) => x.id !== pub.id),
                            }))
                          }
                          className="p-1 text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Paper title"
                        value={pub.title}
                        onChange={(e) => updatePublication(pub.id, { title: e.target.value })}
                        className={inputCls}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Authors"
                          value={pub.authors}
                          onChange={(e) => updatePublication(pub.id, { authors: e.target.value })}
                          className={inputCls}
                        />
                        <input
                          type="text"
                          placeholder="Journal or conference"
                          value={pub.venue}
                          onChange={(e) => updatePublication(pub.id, { venue: e.target.value })}
                          className={inputCls}
                        />
                        <input
                          type="text"
                          placeholder="Year"
                          value={pub.year}
                          onChange={(e) => updatePublication(pub.id, { year: e.target.value })}
                          className={inputCls}
                        />
                        <input
                          type="text"
                          placeholder="DOI or URL (optional)"
                          value={pub.doiOrUrl}
                          onChange={(e) => updatePublication(pub.id, { doiOrUrl: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2">
                  <label className={labelCls}>Grants, Fellowships &amp; Awards (optional)</label>
                  <textarea
                    rows={2}
                    placeholder="List awards, fellowships, or scholarships (one per line)"
                    value={formData.grantsAndAwards}
                    onChange={(e) => setFormData((p) => ({ ...p, grantsAndAwards: e.target.value }))}
                    className={textareaCls}
                  />
                  <label className={labelCls}>Academic Service, Memberships &amp; Tools (optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Peer review roles, committees, or academic societies (one per line)"
                    value={formData.academicService}
                    onChange={(e) => setFormData((p) => ({ ...p, academicService: e.target.value }))}
                    className={textareaCls}
                  />
                  <input
                    type="text"
                    placeholder="Technical & laboratory tools (optional)"
                    value={formData.skillsText}
                    onChange={(e) => setFormData((p) => ({ ...p, skillsText: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                {renderRefereesBuilder()}
              </>
            )}

            {selectedCategory === 'Statement of Purpose (SOP)' && (
              <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2.5">
                <div>
                  <label className={labelCls}>Introduction &amp; Academic Motivation *</label>
                  <textarea
                    rows={3}
                    placeholder="State your academic origin, core intellectual question, and purpose"
                    value={formData.secIntro}
                    onChange={(e) => setFormData((p) => ({ ...p, secIntro: e.target.value }))}
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Academic Background &amp; Coursework</label>
                  <textarea
                    rows={3}
                    placeholder="Detail key degrees, quantitative courses, and thesis preparation"
                    value={formData.secAcademic}
                    onChange={(e) => setFormData((p) => ({ ...p, secAcademic: e.target.value }))}
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Research &amp; Professional Experience</label>
                  <textarea
                    rows={3}
                    placeholder="Describe significant research projects, methods used, and outcomes"
                    value={formData.secExperience}
                    onChange={(e) => setFormData((p) => ({ ...p, secExperience: e.target.value }))}
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Program &amp; Faculty Fit *</label>
                  <textarea
                    rows={3}
                    placeholder="Explain why this university, department, laboratories, and faculty align with your work"
                    value={formData.secFit}
                    onChange={(e) => setFormData((p) => ({ ...p, secFit: e.target.value }))}
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Short-Term &amp; Long-Term Career Goals</label>
                  <textarea
                    rows={3}
                    placeholder="Outline immediate post-degree targets and long-term impact"
                    value={formData.secGoals}
                    onChange={(e) => setFormData((p) => ({ ...p, secGoals: e.target.value }))}
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Closing Statement (optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Brief concluding remarks"
                    value={formData.secClosing}
                    onChange={(e) => setFormData((p) => ({ ...p, secClosing: e.target.value }))}
                    className={textareaCls}
                  />
                </div>
              </div>
            )}

            {selectedCategory === 'Personal Statement' && (
              <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2.5">
                <div>
                  <label className={labelCls}>Personal Origin &amp; Motivation *</label>
                  <textarea
                    rows={3}
                    placeholder="Describe the personal story or moment that sparked your commitment"
                    value={formData.secPersonalOrigin}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, secPersonalOrigin: e.target.value }))
                    }
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Formative Experiences &amp; Growth</label>
                  <textarea
                    rows={3}
                    placeholder="Share challenges navigated, lessons learned, and intellectual maturity"
                    value={formData.secPersonalMilestones}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, secPersonalMilestones: e.target.value }))
                    }
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Leadership, Service &amp; Values</label>
                  <textarea
                    rows={3}
                    placeholder="Highlight initiatives led, community impact, and guiding principles"
                    value={formData.secPersonalLeadership}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, secPersonalLeadership: e.target.value }))
                    }
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Future Contribution &amp; Fit *</label>
                  <textarea
                    rows={3}
                    placeholder="Explain what you bring to the cohort and how the opportunity advances your mission"
                    value={formData.secPersonalAlignment}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, secPersonalAlignment: e.target.value }))
                    }
                    className={textareaCls}
                  />
                </div>
              </div>
            )}

            {selectedCategory === 'Scholarship Motivation Letter' && (
              <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2.5">
                <div>
                  <label className={labelCls}>Opening &amp; Purpose of Application *</label>
                  <textarea
                    rows={3}
                    placeholder="State the scholarship and program applied for and summarize your candidacy"
                    value={formData.secLetterOpening}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, secLetterOpening: e.target.value }))
                    }
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Academic Merit &amp; Relevant Achievements *</label>
                  <textarea
                    rows={3}
                    placeholder="Present academic distinctions, honors, publications, or professional milestones"
                    value={formData.secLetterMerit}
                    onChange={(e) => setFormData((p) => ({ ...p, secLetterMerit: e.target.value }))}
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Leadership &amp; Home/Community Impact Plan</label>
                  <textarea
                    rows={3}
                    placeholder="Explain leadership record and how you will apply knowledge to solve real problems"
                    value={formData.secLetterImpact}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, secLetterImpact: e.target.value }))
                    }
                    className={textareaCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Program Readiness &amp; Closing Appeal</label>
                  <textarea
                    rows={3}
                    placeholder="Confirm readiness, financial/academic commitment, and polite closing"
                    value={formData.secLetterReadiness}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, secLetterReadiness: e.target.value }))
                    }
                    className={textareaCls}
                  />
                </div>
              </div>
            )}

            {selectedCategory === 'Research Proposal' && (
              <>
                <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2.5">
                  <div>
                    <label className={labelCls}>Research Proposal Title *</label>
                    <input
                      type="text"
                      placeholder="Full research proposal title"
                      value={formData.documentTitle}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, documentTitle: e.target.value }))
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Abstract *</label>
                    <textarea
                      rows={3}
                      placeholder="Concise summary of problem, method, and expected contribution"
                      value={formData.secAbstract}
                      onChange={(e) => setFormData((p) => ({ ...p, secAbstract: e.target.value }))}
                      className={textareaCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Background &amp; Problem Statement *</label>
                    <textarea
                      rows={3}
                      placeholder="Define the scientific/engineering context and specific problem"
                      value={formData.secBackground}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, secBackground: e.target.value }))
                      }
                      className={textareaCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Literature Review &amp; Research Gap</label>
                    <textarea
                      rows={3}
                      placeholder="Synthesize prior work and identify the unresolved knowledge gap"
                      value={formData.secLiteratureGap}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, secLiteratureGap: e.target.value }))
                      }
                      className={textareaCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Research Questions &amp; Objectives</label>
                    <textarea
                      rows={3}
                      placeholder="List hypotheses or numbered objectives (one per line)"
                      value={formData.researchObjectivesList}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, researchObjectivesList: e.target.value }))
                      }
                      className={textareaCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Proposed Methodology &amp; Tools *</label>
                    <textarea
                      rows={4}
                      placeholder="Describe experimental, numerical, or theoretical methods and validation metrics"
                      value={formData.secMethodology}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, secMethodology: e.target.value }))
                      }
                      className={textareaCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Expected Outcomes &amp; Significance</label>
                    <textarea
                      rows={3}
                      placeholder="State deliverables, scholarly significance, and practical applications"
                      value={formData.secExpectedOutcomes}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, secExpectedOutcomes: e.target.value }))
                      }
                      className={textareaCls}
                    />
                  </div>
                </div>

                {/* Proposal Timeline */}
                <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">Work Plan &amp; Milestones</span>
                    <button
                      type="button"
                      onClick={() => addMilestone('milestones')}
                      className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                  {formData.milestones.map((m) => (
                    <div key={m.id} className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center">
                      <input
                        type="text"
                        placeholder="Phase"
                        value={m.phase}
                        onChange={(e) => updateMilestone('milestones', m.id, { phase: e.target.value })}
                        className={`${inputCls} sm:col-span-3`}
                      />
                      <input
                        type="text"
                        placeholder="Duration"
                        value={m.duration}
                        onChange={(e) =>
                          updateMilestone('milestones', m.id, { duration: e.target.value })
                        }
                        className={`${inputCls} sm:col-span-3`}
                      />
                      <input
                        type="text"
                        placeholder="Key deliverable"
                        value={m.deliverable}
                        onChange={(e) =>
                          updateMilestone('milestones', m.id, { deliverable: e.target.value })
                        }
                        className={`${inputCls} sm:col-span-5`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            milestones: p.milestones.filter((x) => x.id !== m.id),
                          }))
                        }
                        className="p-1 text-rose-600 justify-self-end cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-1.5">
                  <label className={labelCls}>Key References (optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Enter citations (one reference per line)"
                    value={formData.referencesList}
                    onChange={(e) => setFormData((p) => ({ ...p, referencesList: e.target.value }))}
                    className={textareaCls}
                  />
                </div>
              </>
            )}

            {selectedCategory === 'Study Plan' && (
              <>
                <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2.5">
                  <div>
                    <label className={labelCls}>Academic Background &amp; Major Rationale *</label>
                    <textarea
                      rows={3}
                      placeholder="Explain your prior education and why you selected this major"
                      value={formData.secStudyBackground}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, secStudyBackground: e.target.value }))
                      }
                      className={textareaCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Rationale for Host Country &amp; University</label>
                    <textarea
                      rows={3}
                      placeholder="Explain why this country and institution match your academic goals"
                      value={formData.secHostUniversityRationale}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, secHostUniversityRationale: e.target.value }))
                      }
                      className={textareaCls}
                    />
                  </div>
                </div>

                {/* Study Schedule */}
                <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Semester / Year Study Schedule
                    </span>
                    <button
                      type="button"
                      onClick={() => addMilestone('studySchedule')}
                      className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add</span>
                    </button>
                  </div>
                  {formData.studySchedule.map((m) => (
                    <div key={m.id} className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-center">
                      <input
                        type="text"
                        placeholder="Year / Term"
                        value={m.phase}
                        onChange={(e) =>
                          updateMilestone('studySchedule', m.id, { phase: e.target.value })
                        }
                        className={`${inputCls} sm:col-span-3`}
                      />
                      <input
                        type="text"
                        placeholder="Credits / Period"
                        value={m.duration}
                        onChange={(e) =>
                          updateMilestone('studySchedule', m.id, { duration: e.target.value })
                        }
                        className={`${inputCls} sm:col-span-3`}
                      />
                      <input
                        type="text"
                        placeholder="Planned courses & research focus"
                        value={m.deliverable}
                        onChange={(e) =>
                          updateMilestone('studySchedule', m.id, { deliverable: e.target.value })
                        }
                        className={`${inputCls} sm:col-span-5`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            studySchedule: p.studySchedule.filter((x) => x.id !== m.id),
                          }))
                        }
                        className="p-1 text-rose-600 justify-self-end cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2.5">
                  <div>
                    <label className={labelCls}>Language &amp; Cultural Readiness (optional)</label>
                    <textarea
                      rows={2}
                      placeholder="Language certifications, study preparation, and adaptability"
                      value={formData.secLanguageAdaptation}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, secLanguageAdaptation: e.target.value }))
                      }
                      className={textareaCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Post-Graduation &amp; Career Plan *</label>
                    <textarea
                      rows={3}
                      placeholder="Explain your career trajectory and impact after completing the degree"
                      value={formData.secPostGradPlan}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, secPostGradPlan: e.target.value }))
                      }
                      className={textareaCls}
                    />
                  </div>
                </div>
              </>
            )}

            {/* 3. CUSTOM EXTRA SECTIONS */}
            <div className="p-3 rounded-xl bg-white/80 border border-[#b8c6d4] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">Custom Sections (optional)</span>
                <button
                  type="button"
                  onClick={addCustomSection}
                  className={`${smallBtnCls} bg-slate-800 hover:bg-slate-900 text-white`}
                >
                  <Plus className="w-3 h-3" />
                  <span>Add</span>
                </button>
              </div>
              {formData.customSections.map((cs) => (
                <div key={cs.id} className="p-2 rounded-lg bg-[#edf2f8]/70 border border-[#b8c6d4] space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Section heading"
                      value={cs.heading}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          customSections: p.customSections.map((x) =>
                            x.id === cs.id ? { ...x, heading: e.target.value } : x
                          ),
                        }))
                      }
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          customSections: p.customSections.filter((x) => x.id !== cs.id),
                        }))
                      }
                      className="p-1 text-rose-600 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Section content"
                    value={cs.content}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        customSections: p.customSections.map((x) =>
                          x.id === cs.id ? { ...x, content: e.target.value } : x
                        ),
                      }))
                    }
                    className={textareaCls}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: LIVE SYNCHRONIZED A4 PREVIEW + EXPORT / SAVE / PUBLISH BAR */}
          <div
            ref={previewRef}
            className="lg:col-span-6 p-3.5 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] shadow-2xs space-y-3 min-w-0 lg:sticky lg:top-20"
          >
            {/* Compact Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-[#b8c6d4]">
              <span className="text-xs font-bold text-slate-950 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-cyan-800" />
                <span>Document Preview</span>
              </span>

              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(true)}
                  className={`${smallBtnCls} bg-white hover:bg-slate-50 text-slate-800 border border-[#b8c6d4]`}
                  title="Review full preview"
                >
                  <Eye className="w-3 h-3" />
                  <span>Review</span>
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleSaveDraft()}
                  className={`${smallBtnCls} bg-slate-800 hover:bg-slate-900 text-white disabled:opacity-50`}
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  <span>{editingDocId ? 'Update' : 'Save'}</span>
                </button>
                <button
                  type="button"
                  disabled={isExporting !== null}
                  onClick={() => void handleDownloadPdf()}
                  className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white disabled:opacity-50`}
                >
                  {isExporting === 'pdf' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  disabled={isExporting !== null}
                  onClick={() => void handleDownloadDocx()}
                  className={`${smallBtnCls} bg-cyan-800 hover:bg-cyan-900 text-white disabled:opacity-50`}
                >
                  {isExporting === 'docx' ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <FileDown className="w-3 h-3" />
                  )}
                  <span>DOCX</span>
                </button>
                {canPublishCategory && (
                  <button
                    type="button"
                    disabled={isPublishing}
                    onClick={() => void handlePublishDocument()}
                    className={`${smallBtnCls} bg-emerald-700 hover:bg-emerald-800 text-white disabled:opacity-50`}
                  >
                    {isPublishing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    <span>Publish</span>
                  </button>
                )}
              </div>
            </div>

            {/* Post-Download Review Prompt: Delete Output OR Publish */}
            {postDownloadPrompt && (
              <div className="p-2.5 rounded-lg bg-white border border-cyan-800/40 flex flex-wrap items-center justify-between gap-2 text-[11px] font-sans">
                <span className="text-slate-800 font-medium">
                  Export complete. Keep, publish, or remove output?
                </span>
                <div className="flex items-center gap-1.5">
                  {canPublishCategory && (
                    <button
                      type="button"
                      disabled={isPublishing}
                      onClick={() => void handlePublishDocument()}
                      className={`${smallBtnCls} bg-emerald-700 hover:bg-emerald-800 text-white`}
                    >
                      <Send className="w-3 h-3" />
                      <span>Publish</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDeleteCurrentOutput()}
                    className={`${smallBtnCls} bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200`}
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete Output</span>
                  </button>
                </div>
              </div>
            )}

            {/* Synchronized A4 Sheet Container */}
            <div
              key={previewNonce}
              className="max-h-[72vh] overflow-y-auto pr-0.5 rounded-lg"
            >
              <CareerStudioPreview
                category={selectedCategory}
                data={formData}
                customization={sectionCustomization}
              />
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 2: PUBLISHED DOCUMENTS SHOWCASE (PAGE-1 PREVIEW AT TOP OF CARD) */}
      {/* =================================================================== */}
      {activeWorkspaceTab === 'published' && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search published documents..."
                value={showcaseSearch}
                onChange={(e) => setShowcaseSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1 rounded-lg border border-[#b8c6d4] bg-white text-xs font-sans"
              />
            </div>
            <select
              value={showcaseFilter}
              onChange={(e) => setShowcaseFilter(e.target.value)}
              className="min-w-0 max-w-[180px] px-2 py-1 rounded-lg border border-[#b8c6d4] bg-white text-[11px] font-sans font-medium cursor-pointer truncate"
            >
              <option value="All">All</option>
              {CAREER_STUDIO_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {loadingDocs && publishedDocs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-600">Loading published documents...</div>
          ) : publishedDocs.length === 0 ? (
            <div className="p-8 rounded-xl bg-white/80 border border-dashed border-[#b8c6d4] text-center space-y-2">
              <p className="text-xs text-slate-600">No published career or academic documents yet.</p>
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab('studio')}
                className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
              >
                <Plus className="w-3 h-3" />
                <span>Create Document</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {publishedDocs.map((doc) => {
                const canDelete = isOwner || doc.clientToken === clientToken;
                return (
                  <article
                    key={doc.id}
                    className="rounded-xl bg-white border border-[#b8c6d4] hover:border-cyan-800 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                  >
                    {/* TOP OF CARD: CLEAN VISUAL PREVIEW OF PAGE 1 */}
                    <div
                      onClick={() => setInspectDoc(doc)}
                      className="w-full aspect-[4/4.3] max-h-[260px] bg-slate-50 border-b border-slate-200 overflow-hidden cursor-pointer relative flex items-center justify-center"
                    >
                      {doc.previewImageUrl ? (
                        <img
                          src={doc.previewImageUrl}
                          alt={`${doc.title} page 1 preview`}
                          loading="lazy"
                          className="w-full h-full object-contain object-top bg-white block"
                        />
                      ) : (
                        <CareerStudioPreview
                          category={doc.category}
                          data={doc.formData}
                          customization={doc.sectionConfig}
                          compactThumbnail={true}
                        />
                      )}
                    </div>

                    <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-900 text-[10px] font-sans font-bold truncate">
                            {doc.category}
                          </span>
                          <span className="text-[10px] font-sans text-slate-500 shrink-0">
                            {new Date(doc.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-950 line-clamp-2 leading-snug">
                          {doc.title}
                        </h3>
                        <p className="text-[10.5px] font-sans text-slate-600 truncate">
                          By: {doc.authorName}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setInspectDoc(doc)}
                            className={`${smallBtnCls} bg-slate-100 hover:bg-slate-200 text-slate-800`}
                            title="Preview document"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadCareerStudioPdf(doc.category, doc.formData, doc.sectionConfig)
                            }
                            className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
                            title="Download PDF"
                          >
                            <Download className="w-3 h-3" />
                            <span>PDF</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void downloadCareerStudioDocx(
                                doc.category,
                                doc.formData,
                                doc.sectionConfig
                              )
                            }
                            className={`${smallBtnCls} bg-cyan-800 hover:bg-cyan-900 text-white`}
                            title="Download DOCX"
                          >
                            <FileDown className="w-3 h-3" />
                            <span>DOCX</span>
                          </button>
                        </div>

                        {canDelete && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleLoadIntoStudio(doc)}
                              className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                              title="Edit in Builder"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteSavedDoc(doc)}
                              className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                              title="Delete document"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 3: SAVED DRAFTS                                                 */}
      {/* =================================================================== */}
      {activeWorkspaceTab === 'saved' && (
        <div className="space-y-3">
          {savedDrafts.length === 0 ? (
            <div className="p-8 rounded-xl bg-white/80 border border-dashed border-[#b8c6d4] text-center space-y-2">
              <p className="text-xs text-slate-600">No saved drafts in your workspace yet.</p>
              <button
                type="button"
                onClick={() => setActiveWorkspaceTab('studio')}
                className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
              >
                <BookOpen className="w-3 h-3" />
                <span>Open Builder</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {savedDrafts.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-xl bg-white border border-[#b8c6d4] space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-sans font-bold">
                        {doc.category}
                      </span>
                      <span className="text-[10px] font-sans text-slate-500">
                        {new Date(doc.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-950 truncate">{doc.title}</h3>
                    <p className="text-[10.5px] font-sans text-slate-600 truncate">
                      By: {doc.authorName}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => handleLoadIntoStudio(doc)}
                      className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          downloadCareerStudioPdf(doc.category, doc.formData, doc.sectionConfig)
                        }
                        className={`${smallBtnCls} bg-slate-100 hover:bg-slate-200 text-slate-800`}
                      >
                        <Download className="w-3 h-3" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteSavedDoc(doc)}
                        className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
                        title="Delete draft"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* FULL DOCUMENT REVIEW MODAL (CURRENT BUILDER OR PUBLISHED CARD)     */}
      {/* =================================================================== */}
      {(reviewModalOpen || inspectDoc) && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-[#edf2f8] rounded-2xl border border-[#b8c6d4] shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 bg-white border-b border-[#b8c6d4] flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-slate-950 truncate">
                  {inspectDoc ? inspectDoc.title : resolveDocumentTitle(selectedCategory, formData)}
                </h3>
                <span className="text-[10px] font-sans text-slate-600">
                  {inspectDoc ? inspectDoc.category : selectedCategory}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const target = inspectDoc;
                    if (target) {
                      downloadCareerStudioPdf(target.category, target.formData, target.sectionConfig);
                    } else {
                      void handleDownloadPdf();
                    }
                  }}
                  className={`${smallBtnCls} bg-cyan-900 hover:bg-cyan-800 text-white`}
                >
                  <Download className="w-3 h-3" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = inspectDoc;
                    if (target) {
                      void downloadCareerStudioDocx(
                        target.category,
                        target.formData,
                        target.sectionConfig
                      );
                    } else {
                      void handleDownloadDocx();
                    }
                  }}
                  className={`${smallBtnCls} bg-cyan-800 hover:bg-cyan-900 text-white`}
                >
                  <FileDown className="w-3 h-3" />
                  <span>DOCX</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReviewModalOpen(false);
                    setInspectDoc(null);
                  }}
                  className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-6 overflow-y-auto flex-1">
              <div className="max-w-3xl mx-auto">
                <CareerStudioPreview
                  category={inspectDoc ? inspectDoc.category : selectedCategory}
                  data={inspectDoc ? inspectDoc.formData : formData}
                  customization={inspectDoc ? inspectDoc.sectionConfig : sectionCustomization}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
