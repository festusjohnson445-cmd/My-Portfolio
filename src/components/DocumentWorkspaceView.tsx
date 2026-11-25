import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Download,
  RefreshCw,
  Send,
  Trash2,
  Save,
  Eye,
  Edit3,
  Search,
  CheckCircle2,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FolderOpen,
  Lock,
} from 'lucide-react';
import {
  DOCUMENT_CATEGORY_META,
  DocumentFormPayload,
  DocumentWorkspaceCategory,
  GeneratedDocumentRecord,
  createEmptyFormPayload,
  getCategoryMeta,
  normalizeDocumentPayload,
  validateDocumentPayload,
} from '../types/documentWorkspace';
import {
  downloadDocumentDocx,
  downloadDocumentPdf,
  renderDocumentFirstPageDataUrl,
} from '../utils/documentExport';
import {
  deleteGeneratedDocumentRecord,
  fetchLocalDraftDocuments,
  fetchPublishedGeneratedDocuments,
  getCachedPublishedGeneratedDocuments,
  hasDraftModifications,
  incrementGeneratedDocumentDownloads,
  incrementGeneratedDocumentViews,
  publishGeneratedDocument,
  removeLocalDraft,
  removeLocalDraftsByCategory,
  saveDraftLocally,
  subscribeToGeneratedDocumentsRealtime,
} from '../utils/documentWorkspaceSupabase';
import { useWebsiteSettingsSync } from '../utils/portfolioSupabase';
import { useProfileSync } from '../utils/profileState';
import { DocumentWorkspaceForm } from './DocumentWorkspaceForm';
import { DocumentA4Preview } from './DocumentA4Preview';

export const DocumentWorkspaceView: React.FC = () => {
  const websiteSettings = useWebsiteSettingsSync();
  const { isOwner } = useProfileSync();
  const studioConfig = websiteSettings.appearanceConfig.careerStudioConfig;
  const studioEnabled = isOwner || studioConfig.enabled;
  const canAccessBuilder = isOwner || studioConfig.allowVisitorAccess;
  const showPublishedTab = isOwner || studioConfig.showPublishedShowcase;

  const availableCategories = useMemo(
    () =>
      DOCUMENT_CATEGORY_META.filter(
        (c) => isOwner || (studioConfig.forms[c.id]?.enabled ?? true)
      ),
    [isOwner, studioConfig.forms]
  );

  const [activeMode, setActiveMode] = useState<'builder' | 'published'>('builder');
  const [selectedCategory, setSelectedCategory] =
    useState<DocumentWorkspaceCategory>('international_cv');

  // Hydrate per-category payloads from auto-saved drafts on mount
  const [draftsByCat, setDraftsByCat] = useState<
    Record<DocumentWorkspaceCategory, DocumentFormPayload>
  >(() => {
    const initial: Record<DocumentWorkspaceCategory, DocumentFormPayload> = {
      international_cv: createEmptyFormPayload('international_cv'),
      academic_resume: createEmptyFormPayload('academic_resume'),
      job_resume: createEmptyFormPayload('job_resume'),
      sop: createEmptyFormPayload('sop'),
      personal_statement: createEmptyFormPayload('personal_statement'),
      scholarship_letter: createEmptyFormPayload('scholarship_letter'),
      research_proposal: createEmptyFormPayload('research_proposal'),
      study_plan: createEmptyFormPayload('study_plan'),
    };
    const saved = fetchLocalDraftDocuments();
    for (const dr of saved) {
      if (dr?.category && dr.formData && initial[dr.category]) {
        // Prefer deterministic auto-draft or most recent draft per category
        initial[dr.category] = normalizeDocumentPayload(dr.formData);
      }
    }
    return initial;
  });

  const currentFormPayload = draftsByCat[selectedCategory];
  const [committedPreviewPayload, setCommittedPreviewPayload] =
    useState<DocumentFormPayload>(() => draftsByCat.international_cv);

  // Sync live updates into the preview smoothly while keeping Update Preview button authoritative
  useEffect(() => {
    setCommittedPreviewPayload(currentFormPayload);
  }, [currentFormPayload]);

  const [editingRecordId, setEditingRecordId] = useState<string | undefined>(undefined);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [zoomPct, setZoomPct] = useState<number>(100);
  const [notice, setNotice] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(
    null
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>(() =>
    hasDraftModifications(draftsByCat.international_cv) ? 'saved' : 'idle'
  );

  const [publishedDocs, setPublishedDocs] = useState<GeneratedDocumentRecord[]>(() =>
    getCachedPublishedGeneratedDocuments()
  );
  const [galleryCategoryFilter, setGalleryCategoryFilter] = useState<string>('All');
  const [gallerySearch, setGallerySearch] = useState('');

  const pendingDraftSaveRef = useRef<{
    payload: DocumentFormPayload;
    recordId?: string;
  } | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

  const [viewingDoc, setViewingDoc] = useState<GeneratedDocumentRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement | null>(null);

  const loadPublished = async () => {
    try {
      const list = await fetchPublishedGeneratedDocuments();
      setPublishedDocs(list);
    } catch {}
  };

  useEffect(() => {
    loadPublished();
    const unsub = subscribeToGeneratedDocumentsRealtime(() => {
      loadPublished();
    });
    return () => unsub();
  }, []);

  // Keep activeMode and selectedCategory aligned with Admin settings
  useEffect(() => {
    if (!canAccessBuilder && showPublishedTab && activeMode === 'builder') {
      setActiveMode('published');
    } else if (!showPublishedTab && canAccessBuilder && activeMode === 'published') {
      setActiveMode('builder');
    }
  }, [canAccessBuilder, showPublishedTab, activeMode]);

  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.some((c) => c.id === selectedCategory)) {
      const nextCat = availableCategories[0].id;
      setSelectedCategory(nextCat);
      setCommittedPreviewPayload(draftsByCat[nextCat]);
    }
  }, [availableCategories, selectedCategory, draftsByCat]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotice({ text, type });
    setTimeout(() => {
      setNotice((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const flushPendingAutoSave = () => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const pending = pendingDraftSaveRef.current;
    if (!pending) return;
    pendingDraftSaveRef.current = null;
    if (hasDraftModifications(pending.payload)) {
      saveDraftLocally(pending.payload, pending.recordId || `draft_${pending.payload.category}`, {
        skipPreview: true,
      });
      setAutoSaveState('saved');
    } else {
      removeLocalDraftsByCategory(pending.payload.category);
      setAutoSaveState('idle');
    }
  };

  useEffect(() => {
    const handleUnload = () => {
      const pending = pendingDraftSaveRef.current;
      if (!pending) return;
      if (hasDraftModifications(pending.payload)) {
        saveDraftLocally(pending.payload, pending.recordId || `draft_${pending.payload.category}`, {
          skipPreview: true,
        });
      } else {
        removeLocalDraftsByCategory(pending.payload.category);
      }
      pendingDraftSaveRef.current = null;
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
      handleUnload();
    };
  }, []);

  const handlePayloadChange = (next: DocumentFormPayload) => {
    setDraftsByCat((prev) => ({
      ...prev,
      [next.category]: next,
    }));
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }

    pendingDraftSaveRef.current = {
      payload: next,
      recordId: editingRecordId || `draft_${next.category}`,
    };
    setAutoSaveState('saving');
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = window.setTimeout(() => {
      flushPendingAutoSave();
    }, 250);
  };

  const handleSelectCategory = (cat: DocumentWorkspaceCategory) => {
    flushPendingAutoSave();
    setSelectedCategory(cat);
    setEditingRecordId(undefined);
    setValidationErrors([]);
    setAutoSaveState(hasDraftModifications(draftsByCat[cat]) ? 'saved' : 'idle');
    setCommittedPreviewPayload(draftsByCat[cat]);
  };

  const handleUpdatePreview = () => {
    const check = validateDocumentPayload(currentFormPayload);
    setValidationErrors(check.errors);
    setCommittedPreviewPayload({ ...currentFormPayload });
    if (!check.valid) {
      showToast('Review the highlighted required fields to complete the preview.', 'info');
    } else {
      showToast('Preview updated with formatted A4 layout.', 'success');
    }
    if (window.innerWidth < 1024 && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleClearOrDeleteOutput = async () => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    pendingDraftSaveRef.current = null;

    let deleteWarning: string | undefined;
    if (editingRecordId) {
      const existingPublished = publishedDocs.find((d) => d.id === editingRecordId);
      if (existingPublished) {
        const res = await deleteGeneratedDocumentRecord(existingPublished);
        if (!res.ok && res.error) {
          deleteWarning = res.error;
        }
        setPublishedDocs((prev) => prev.filter((d) => d.id !== editingRecordId));
      } else {
        removeLocalDraft(editingRecordId);
      }
      setEditingRecordId(undefined);
    }
    removeLocalDraftsByCategory(selectedCategory);
    const fresh = createEmptyFormPayload(selectedCategory);
    setDraftsByCat((prev) => ({ ...prev, [selectedCategory]: fresh }));
    setCommittedPreviewPayload(fresh);
    setValidationErrors([]);
    setAutoSaveState('idle');
    if (deleteWarning) {
      showToast(`Cleared locally, but Supabase delete reported: ${deleteWarning}`, 'error');
    } else {
      showToast('Document output cleared and removed.', 'info');
    }
  };

  const handleSaveDraft = () => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    pendingDraftSaveRef.current = null;
    saveDraftLocally(currentFormPayload, editingRecordId || `draft_${selectedCategory}`);
    setAutoSaveState('saved');
    showToast('Draft saved locally in your browser workspace.', 'success');
  };

  const handleDownloadPdf = () => {
    const check = validateDocumentPayload(currentFormPayload);
    if (!check.valid) {
      setValidationErrors(check.errors);
      showToast('Please complete required fields before downloading PDF.', 'error');
      return;
    }
    downloadDocumentPdf(currentFormPayload);
    showToast('A4 PDF exported with selectable text.', 'success');
  };

  const handleDownloadDocx = async () => {
    const check = validateDocumentPayload(currentFormPayload);
    if (!check.valid) {
      setValidationErrors(check.errors);
      showToast('Please complete required fields before downloading DOCX.', 'error');
      return;
    }
    setIsExportingDocx(true);
    try {
      await downloadDocumentDocx(currentFormPayload);
      showToast('DOCX Word document exported cleanly.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not generate DOCX.', 'error');
    } finally {
      setIsExportingDocx(false);
    }
  };

  const handlePublish = async () => {
    const check = validateDocumentPayload(currentFormPayload);
    if (!check.valid) {
      setValidationErrors(check.errors);
      showToast('Please complete all required fields before publishing.', 'error');
      return;
    }

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    pendingDraftSaveRef.current = null;

    setIsPublishing(true);
    try {
      const result = await publishGeneratedDocument(currentFormPayload, editingRecordId);
      removeLocalDraftsByCategory(selectedCategory);
      setPublishedDocs((prev) => [result.record, ...prev.filter((x) => x.id !== result.record.id)]);
      setEditingRecordId(result.record.id);
      setAutoSaveState('idle');

      if (result.syncedToSupabase) {
        showToast('Document published to Supabase & Added to Published Gallery.', 'success');
      } else {
        showToast(
          result.warning
            ? `Published locally (${result.warning}). Run the updated SQL in Settings to sync with Supabase.`
            : 'Document published to your local session gallery.',
          'info'
        );
      }
      setActiveMode('published');
    } catch (err: any) {
      showToast(err?.message || 'Publish failed.', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleOpenPublishedDoc = (doc: GeneratedDocumentRecord) => {
    setViewingDoc(doc);
    incrementGeneratedDocumentViews(doc.id).then((cnt) => {
      if (typeof cnt === 'number') {
        setPublishedDocs((prev) =>
          prev.map((d) => (d.id === doc.id ? { ...d, viewsCount: cnt } : d))
        );
      }
    });
  };

  const handleLoadIntoEditor = (doc: GeneratedDocumentRecord) => {
    if (!doc.formData) return;
    const normalized = normalizeDocumentPayload(doc.formData);
    setSelectedCategory(doc.category);
    setDraftsByCat((prev) => ({
      ...prev,
      [doc.category]: normalized,
    }));
    setCommittedPreviewPayload(normalized);
    setEditingRecordId(doc.id);
    setValidationErrors([]);
    setViewingDoc(null);
    setActiveMode('builder');
    showToast(`Loaded "${doc.title}" into editor.`, 'info');
  };

  const handleDeletePublished = async (doc: GeneratedDocumentRecord) => {
    setIsDeletingId(doc.id);
    try {
      const res = await deleteGeneratedDocumentRecord(doc);
      setPublishedDocs((prev) => prev.filter((d) => d.id !== doc.id));
      if (viewingDoc?.id === doc.id) setViewingDoc(null);
      if (editingRecordId === doc.id) setEditingRecordId(undefined);
      setConfirmDeleteId(null);
      if (!res.ok && res.error) {
        showToast(`Removed locally, but Supabase delete failed: ${res.error}`, 'error');
      } else {
        showToast('Published document and stored files deleted.', 'info');
      }
    } finally {
      setIsDeletingId(null);
    }
  };

  const filteredPublishedDocs = useMemo(() => {
    const q = gallerySearch.trim().toLowerCase();
    return publishedDocs.filter((doc) => {
      const catOk = galleryCategoryFilter === 'All' || doc.category === galleryCategoryFilter;
      if (!catOk) return false;
      if (!q) return true;
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.authorName.toLowerCase().includes(q) ||
        doc.summary.toLowerCase().includes(q) ||
        getCategoryMeta(doc.category).label.toLowerCase().includes(q)
      );
    });
  }, [publishedDocs, galleryCategoryFilter, gallerySearch]);

  const activeMeta = getCategoryMeta(selectedCategory);
  const activeCatConfig = studioConfig.forms[selectedCategory];
  const canPublishSelected =
    isOwner || (studioConfig.allowVisitorPublish && (activeCatConfig?.allowPublish ?? true));
  const adminCustomHint =
    activeCatConfig?.showGuidance && activeCatConfig.customHint?.trim()
      ? activeCatConfig.customHint.trim()
      : '';

  if (!studioEnabled) {
    return (
      <div
        style={{ fontFamily: '"Times New Roman", Times, serif' }}
        className="max-w-3xl mx-auto w-full px-4 py-12 text-center font-serif"
      >
        <div className="p-8 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-[#b8c6d4] flex items-center justify-center text-cyan-900 mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-950 font-serif">
            Career and Academic Studio Unavailable
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-serif">
            This workspace is currently paused by the administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ fontFamily: '"Times New Roman", Times, serif' }}
      className="max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 font-serif"
    >
      {/* Workspace Header Card */}
      <div className="p-4 sm:p-6 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1.5 text-center md:text-left">
            <span className="inline-block px-2.5 py-0.5 rounded bg-cyan-100 border border-cyan-300 text-cyan-950 text-[11px] font-bold uppercase tracking-wider font-serif">
              Career and Academic Studio
            </span>
            <p className="text-xs sm:text-sm text-slate-800 font-serif max-w-2xl">
              Build your professional career and Academic Documents here
            </p>
          </div>

          {/* Primary Mode Switcher */}
          <div className="flex items-center justify-center gap-2 shrink-0">
            {canAccessBuilder && (
              <button
                type="button"
                onClick={() => setActiveMode('builder')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer font-serif ${
                  activeMode === 'builder'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-800 border-[#b8c6d4] hover:border-slate-400'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Workspace</span>
              </button>
            )}
            {showPublishedTab && (
              <button
                type="button"
                onClick={() => setActiveMode('published')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer font-serif ${
                  activeMode === 'published'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-800 border-[#b8c6d4] hover:border-slate-400'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Published ({publishedDocs.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Toast Feedback */}
        {notice && (
          <div
            className={`p-2.5 rounded-xl border text-xs font-serif flex items-center justify-between gap-2 ${
              notice.type === 'error'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : notice.type === 'info'
                ? 'bg-cyan-50 border-cyan-200 text-cyan-950'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{notice.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="p-0.5 opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODE 1: WORKSPACE BUILDER (8 INDEPENDENT CATEGORIES)     */}
      {/* ======================================================== */}
      {activeMode === 'builder' && canAccessBuilder && (
        <div className="space-y-4">
          {/* Category Selector Bar */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-white border border-[#b8c6d4] shadow-2xs space-y-2 font-serif">
            <div className="flex flex-col items-center justify-center gap-1.5 text-center">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-serif text-center">
                Templates
              </span>
            </div>

            {availableCategories.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-500 font-serif">
                No templates are currently enabled.
              </div>
            ) : (
              <div className="grid grid-cols-4 lg:grid-cols-8 gap-1">
                {availableCategories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleSelectCategory(cat.id)}
                      className={`px-1.5 py-1 rounded-md border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 min-w-0 font-serif ${
                        isSelected
                          ? 'bg-cyan-900 border-cyan-900 text-white shadow-xs'
                          : 'bg-[#f8fafc] border-slate-300 text-slate-800 hover:bg-white hover:border-cyan-700'
                      }`}
                    >
                      <span className="text-[9.5px] sm:text-[10px] font-bold leading-tight truncate w-full font-serif">
                        {cat.shortLabel}
                      </span>
                      <span
                        className={`text-[8px] leading-none truncate w-full font-serif ${
                          isSelected ? 'text-cyan-200' : 'text-slate-500'
                        }`}
                      >
                        {cat.badgeText}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {adminCustomHint && (
              <div className="px-2.5 py-1.5 rounded-lg bg-cyan-50/70 border border-cyan-200 text-[11px] text-cyan-950 font-serif">
                {adminCustomHint}
              </div>
            )}
          </div>

          {/* Compact Two-Row Action Toolbar */}
          <div className="p-2 sm:p-2.5 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] flex flex-col gap-1.5 font-serif">
            {/* Row 1: Update View, PDF, Docx */}
            <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
              <button
                type="button"
                onClick={handleUpdatePreview}
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-[10px] sm:text-[11px] font-bold shadow-2xs transition-colors cursor-pointer font-serif whitespace-nowrap"
              >
                <RefreshCw className="w-3 h-3 shrink-0" />
                <span className="truncate">Update View</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 text-[10px] sm:text-[11px] font-bold shadow-2xs cursor-pointer font-serif whitespace-nowrap"
              >
                <Download className="w-3 h-3 text-cyan-800 shrink-0" />
                <span className="truncate">PDF</span>
              </button>

              <button
                type="button"
                disabled={isExportingDocx}
                onClick={handleDownloadDocx}
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-900 border border-slate-300 text-[10px] sm:text-[11px] font-bold shadow-2xs cursor-pointer font-serif whitespace-nowrap"
              >
                {isExportingDocx ? (
                  <Loader2 className="w-3 h-3 animate-spin text-cyan-800 shrink-0" />
                ) : (
                  <Download className="w-3 h-3 text-cyan-800 shrink-0" />
                )}
                <span className="truncate">Docx</span>
              </button>
            </div>

            {/* Row 2: Save Draft, Reset, Publish */}
            <div className="flex items-center justify-between gap-1.5 w-full min-w-0">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-[10px] sm:text-[11px] font-semibold cursor-pointer font-serif whitespace-nowrap"
                title="Changes auto-save automatically as you type"
              >
                <Save className="w-3 h-3 text-slate-600 shrink-0" />
                <span className="truncate">
                  {autoSaveState === 'saving'
                    ? 'Saving Draft...'
                    : autoSaveState === 'saved'
                    ? 'Draft Auto-Saved'
                    : 'Save Draft'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleClearOrDeleteOutput}
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10px] sm:text-[11px] font-semibold cursor-pointer font-serif whitespace-nowrap"
                title="Delete generated output and reset form"
              >
                {editingRecordId ? (
                  <>
                    <Trash2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">Delete</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3 h-3 shrink-0" />
                    <span className="truncate">Reset</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isPublishing || !canPublishSelected}
                onClick={handlePublish}
                title={
                  !canPublishSelected
                    ? 'Publishing for this category is disabled by admin; export PDF/DOCX or save local drafts.'
                    : 'Publish document to directory'
                }
                className="flex-1 min-w-0 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] sm:text-[11px] font-bold shadow-2xs transition-colors cursor-pointer font-serif whitespace-nowrap"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    <span className="truncate">Publishing...</span>
                  </>
                ) : !canPublishSelected ? (
                  <>
                    <Lock className="w-3 h-3 text-slate-300 shrink-0" />
                    <span className="truncate">Locked</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3 text-cyan-300 shrink-0" />
                    <span className="truncate">Publish</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Split-Pane Editor & Live A4 Preview */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-6 space-y-4">
              <DocumentWorkspaceForm
                payload={currentFormPayload}
                onChange={handlePayloadChange}
                validationErrors={validationErrors}
              />
            </div>

            <div
              ref={previewRef}
              className="lg:col-span-6 lg:sticky lg:top-20 space-y-2.5"
            >
              {/* Preview Bar */}
              <div className="p-2.5 rounded-xl bg-white border border-[#b8c6d4] flex flex-wrap items-center justify-between gap-2 text-xs font-serif">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-800 shrink-0" />
                  <span className="font-bold text-slate-900">
                    {activeMeta.label} — Live A4 Preview
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setZoomPct((z) => Math.max(85, z - 5))}
                    className="p-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title="Zoom out preview"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5 text-[11px] font-serif text-slate-700">{zoomPct}%</span>
                  <button
                    type="button"
                    onClick={() => setZoomPct((z) => Math.min(115, z + 5))}
                    className="p-1 rounded border border-slate-300 hover:bg-slate-100 text-slate-700 cursor-pointer"
                    title="Zoom in preview"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="p-2 sm:p-4 rounded-2xl bg-slate-200/70 border border-[#b8c6d4] overflow-hidden">
                <DocumentA4Preview payload={committedPreviewPayload} zoomPct={zoomPct} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: PUBLISHED DOCUMENTS DIRECTORY                    */}
      {/* ======================================================== */}
      {activeMode === 'published' && showPublishedTab && (
        <div className="space-y-4 font-serif">
          {/* Search & Category Filter */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-[#edf2f8] border border-[#b8c6d4] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 font-serif overflow-hidden">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={gallerySearch}
                onChange={(e) => setGallerySearch(e.target.value)}
                placeholder="Search published documents..."
                className="w-full min-w-0 pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-700 font-serif"
              />
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-1.5 shrink-0 min-w-0">
              <select
                value={galleryCategoryFilter}
                onChange={(e) => setGalleryCategoryFilter(e.target.value)}
                className="flex-1 sm:flex-initial min-w-0 max-w-full sm:max-w-[190px] px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 cursor-pointer truncate font-serif"
              >
                <option value="All">All</option>
                {DOCUMENT_CATEGORY_META.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              {canAccessBuilder && (
                <button
                  type="button"
                  onClick={() => setActiveMode('builder')}
                  className="px-2.5 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 font-serif"
                >
                  + Create
                </button>
              )}
            </div>
          </div>

          {/* Directory Grid */}
          {filteredPublishedDocs.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white border border-dashed border-[#b8c6d4] text-center space-y-3 font-serif">
              <div className="w-12 h-12 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] flex items-center justify-center text-cyan-900 mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-950 font-serif">
                  No Published Documents Yet
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto font-serif">
                  Build a CV, Resume, SOP, Personal Statement, Motivation Letter, Research Proposal, or Study Plan and publish it here.
                </p>
              </div>
              {canAccessBuilder && (
                <button
                  type="button"
                  onClick={() => setActiveMode('builder')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-900 hover:bg-cyan-800 text-white text-xs font-bold cursor-pointer font-serif"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Create</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPublishedDocs.map((doc) => {
                const catMeta = getCategoryMeta(doc.category);
                const page1Thumb =
                  doc.previewImageUrl ||
                  (doc.formData ? renderDocumentFirstPageDataUrl(doc.formData) : '');
                return (
                  <article
                    key={doc.id}
                    className="rounded-2xl bg-white border border-[#b8c6d4] hover:border-cyan-700 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                  >
                    <div>
                      {/* Card Top: Clean Visual Preview of First Page of Document */}
                      <div
                        onClick={() => handleOpenPublishedDoc(doc)}
                        className="relative w-full aspect-[4/3] sm:aspect-[210/220] bg-slate-100 border-b border-slate-200 overflow-hidden cursor-pointer flex items-start justify-center p-2"
                      >
                        {page1Thumb ? (
                          <img
                            src={page1Thumb}
                            alt={`First page preview of ${doc.title}`}
                            loading="lazy"
                            className="w-full h-full object-contain bg-white shadow-xs rounded-xs border border-slate-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <FileText className="w-10 h-10" />
                          </div>
                        )}
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-white/95 border border-cyan-300 text-cyan-950 text-[10px] font-bold shadow-2xs font-serif">
                          {catMeta.shortLabel}
                        </span>
                      </div>

                      <div className="p-3.5 space-y-1.5">
                        <h3
                          onClick={() => handleOpenPublishedDoc(doc)}
                          className="text-sm font-bold text-slate-950 leading-snug cursor-pointer hover:text-cyan-900 font-serif"
                        >
                          {doc.title}
                        </h3>
                        {doc.authorName && (
                          <p className="text-[11px] font-semibold text-cyan-900 font-serif">
                            By: {doc.authorName}
                          </p>
                        )}
                        {doc.summary && (
                          <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed font-serif">
                            {doc.summary}
                          </p>
                        )}
                        <div className="flex items-center justify-between pt-1 text-[10.5px] text-slate-500 font-serif">
                          <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                          <div className="flex items-center gap-2.5 font-serif">
                            <span className="inline-flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {doc.viewsCount}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Download className="w-3 h-3" />
                              {doc.downloadsCount}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Bottom Actions */}
                    <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-1.5 font-serif">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenPublishedDoc(doc)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-900 hover:bg-cyan-800 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (doc.formData) {
                              downloadDocumentPdf(doc.formData, doc.title);
                              incrementGeneratedDocumentDownloads(doc.id);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-semibold cursor-pointer"
                          title="Download A4 PDF"
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (doc.formData) {
                              await downloadDocumentDocx(doc.formData, doc.title);
                              incrementGeneratedDocumentDownloads(doc.id);
                            }
                          }}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 text-[11px] font-semibold cursor-pointer"
                          title="Download Word DOCX"
                        >
                          DOCX
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {canAccessBuilder && (
                          <button
                            type="button"
                            onClick={() => handleLoadIntoEditor(doc)}
                            className="p-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 cursor-pointer"
                            title="Edit in Builder"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {confirmDeleteId === doc.id ? (
                          <button
                            type="button"
                            disabled={isDeletingId === doc.id}
                            onClick={() => handleDeletePublished(doc)}
                            className="px-2 py-1 rounded-lg bg-rose-700 text-white text-[10.5px] font-bold cursor-pointer"
                          >
                            {isDeletingId === doc.id ? '...' : 'Confirm'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(doc.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 cursor-pointer"
                            title="Delete published document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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

      {!canAccessBuilder && !showPublishedTab && (
        <div className="p-8 rounded-2xl bg-white border border-[#b8c6d4] text-center space-y-2 font-serif">
          <Lock className="w-6 h-6 text-cyan-900 mx-auto" />
          <p className="text-sm font-bold text-slate-900 font-serif">
            Visitor Workspace &amp; Showcase Restricted
          </p>
          <p className="text-xs text-slate-600 font-serif">
            The administrator has temporarily restricted public access to Career Studio tools.
          </p>
        </div>
      )}

      {/* ======================================================== */}
      {/* FULL DOCUMENT READER MODAL                               */}
      {/* ======================================================== */}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-[#edf2f8] rounded-2xl max-w-4xl w-full max-h-[92vh] border border-[#b8c6d4] shadow-2xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 font-serif">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase text-cyan-900 block">
                  {getCategoryMeta(viewingDoc.category).label}
                </span>
                <h3 className="text-sm sm:text-base font-bold text-slate-950 truncate font-serif">
                  {viewingDoc.title}
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (viewingDoc.formData) {
                      downloadDocumentPdf(viewingDoc.formData, viewingDoc.title);
                      incrementGeneratedDocumentDownloads(viewingDoc.id);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-900 text-white text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (viewingDoc.formData) {
                      await downloadDocumentDocx(viewingDoc.formData, viewingDoc.title);
                      incrementGeneratedDocumentDownloads(viewingDoc.id);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOCX</span>
                </button>
                {canAccessBuilder && (
                  <button
                    type="button"
                    onClick={() => handleLoadIntoEditor(viewingDoc)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeletePublished(viewingDoc)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingDoc(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-6 overflow-y-auto flex-1">
              {viewingDoc.formData && <DocumentA4Preview payload={viewingDoc.formData} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
