import React, { useState } from 'react';
import { Upload, Plus, Trash2, Save, X, Loader2, Link as LinkIcon } from 'lucide-react';
import {
  uploadFileToBucket,
  upsertProjectToSupabase,
  formatBytes,
  type PortfolioProject,
  type ProjectSpecification,
  type MediaAssetItem,
  type LinkItem,
  type BucketFileItem,
} from '../utils/portfolioSupabase';
import { cleanDisplayFileName, runWithConcurrency } from '../utils/mediaMetadata';
import { MediaLibraryModal, type MediaLibraryFilter } from './MediaLibraryModal';

interface ProjectFormPanelProps {
  initialProject?: PortfolioProject | null;
  isOwner?: boolean;
  onSaved: (saved: PortfolioProject) => void;
  onCancel: () => void;
}

const isSupabaseStorageUrl = (url?: string): boolean =>
  /supabase\.co\/storage\/v1\/object\//i.test(url || '');

export const ProjectFormPanel: React.FC<ProjectFormPanelProps> = ({
  initialProject,
  isOwner = true,
  onSaved,
  onCancel,
}) => {
  const [title, setTitle] = useState(initialProject?.title || '');
  const [category, setCategory] = useState(initialProject?.category || '');
  const [description, setDescription] = useState(initialProject?.description || '');
  const [overview, setOverview] = useState(initialProject?.overview || '');
  const [objectives, setObjectives] = useState(initialProject?.objectives || '');
  const [methodology, setMethodology] = useState(initialProject?.methodology || '');
  const [results, setResults] = useState(initialProject?.results || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(initialProject?.thumbnailUrl || '');
  const [toolsText, setToolsText] = useState(initialProject?.toolsUsed?.join(', ') || '');
  const [isFeatured, setIsFeatured] = useState(Boolean(initialProject?.isFeatured));
  const [isCadProject, setIsCadProject] = useState(Boolean(initialProject?.isCadProject));
  const [cadModelType, setCadModelType] = useState<PortfolioProject['cadModelType']>(
    initialProject?.cadModelType || ''
  );
  const [status, setStatus] = useState<PortfolioProject['status']>(
    initialProject?.status || 'published'
  );

  const [specifications, setSpecifications] = useState<ProjectSpecification[]>(
    initialProject?.specifications || []
  );
  const [images, setImages] = useState<MediaAssetItem[]>(initialProject?.images || []);
  const [videos, setVideos] = useState<MediaAssetItem[]>(initialProject?.videos || []);
  const [cadDrawings, setCadDrawings] = useState<MediaAssetItem[]>(
    initialProject?.cadDrawings || []
  );
  const [documents, setDocuments] = useState<MediaAssetItem[]>(initialProject?.documents || []);
  const [demoLinks, setDemoLinks] = useState<LinkItem[]>(initialProject?.demoLinks || []);

  // Auxiliary quick-add URL inputs
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageTitle, setNewImageTitle] = useState('');
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [newCadUrl, setNewCadUrl] = useState('');
  const [newCadTitle, setNewCadTitle] = useState('');
  const [newDocUrl, setNewDocUrl] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('');

  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<string>('');
  const [mediaPickerTarget, setMediaPickerTarget] = useState<
    'thumbnail' | 'image' | 'video' | 'cad' | 'document' | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleBucketUpload = async (
    files: FileList | null,
    target: 'thumbnail' | 'image' | 'video' | 'cad' | 'document'
  ) => {
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    setUploadingField(target);
    setUploadProgress(5);
    setUploadStage('Preparing media pipeline...');
    setErrorMsg(null);
    try {
      const concurrency = target === 'video' ? 2 : 3;
      const uploadedAssets = await runWithConcurrency(fileArr, concurrency, async (file) => {
        const res = await uploadFileToBucket('projects', file, target, (pct, stage) => {
          setUploadProgress(pct);
          setUploadStage(stage);
        });
        return {
          title: '',
          url: res.publicUrl,
          fileName: res.fileName,
          fileSize: res.fileSize,
          fileType: file.type,
        } as MediaAssetItem;
      });

      if (target === 'thumbnail') {
        const first = uploadedAssets[0];
        if (first?.url) setThumbnailUrl(first.url);
      } else if (target === 'image') {
        setImages((prev) => [...prev, ...uploadedAssets]);
      } else if (target === 'video') {
        setVideos((prev) => [...prev, ...uploadedAssets]);
      } else if (target === 'cad') {
        setCadDrawings((prev) => [...prev, ...uploadedAssets]);
        setIsCadProject(true);
      } else if (target === 'document') {
        setDocuments((prev) => [...prev, ...uploadedAssets]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'File upload to projects bucket failed.');
    } finally {
      setUploadingField(null);
      setUploadProgress(0);
      setUploadStage('');
    }
  };

  const handleMediaLibrarySelect = (
    items: BucketFileItem[],
    target: 'thumbnail' | 'image' | 'video' | 'cad' | 'document'
  ) => {
    if (!items || items.length === 0) return;
    const mapped: MediaAssetItem[] = items.map((item) => ({
      title: cleanDisplayFileName(item.name).replace(/\.[^/.]+$/, ''),
      url: item.publicUrl,
      fileName: cleanDisplayFileName(item.name),
      fileSize: item.size ? formatBytes(item.size) : undefined,
      fileType: item.mimeType,
    }));

    if (target === 'thumbnail') {
      setThumbnailUrl(items[0].publicUrl);
    } else if (target === 'image') {
      setImages((prev) => [...prev, ...mapped]);
    } else if (target === 'video') {
      setVideos((prev) => [...prev, ...mapped]);
    } else if (target === 'cad') {
      setCadDrawings((prev) => [...prev, ...mapped]);
      setIsCadProject(true);
    } else if (target === 'document') {
      setDocuments((prev) => [...prev, ...mapped]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMsg('Project title and short description are required.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const saved = await upsertProjectToSupabase({
        id: initialProject?.id,
        slug: initialProject?.slug,
        title: title.trim(),
        category: category.trim() || 'Mechanical Design',
        description: description.trim(),
        overview: overview.trim(),
        objectives: objectives.trim(),
        methodology: methodology.trim(),
        results: results.trim(),
        thumbnailUrl: thumbnailUrl.trim(),
        toolsUsed: toolsText
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        isFeatured,
        isCadProject,
        cadModelType,
        status,
        specifications: specifications.filter((s) => s.label.trim() || s.value.trim()),
        images,
        videos,
        cadDrawings,
        documents,
        demoLinks: demoLinks.filter((l) => l.url.trim()),
      });
      onSaved(saved);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save project.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-full overflow-hidden box-border bg-white border border-[#b8c6d4] rounded-xl p-4 sm:p-5 shadow-xs space-y-4 font-serif text-slate-900"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2.5 min-w-0">
        <h3 className="text-sm font-bold text-slate-950 text-center flex-1 truncate">
          {initialProject ? 'Edit Project' : 'New Engineering Project'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {uploadingField && (
        <div className="w-full p-2.5 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center gap-2 text-xs text-cyan-950 font-semibold">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>uploading...</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs break-words">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs min-w-0">
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Project Title *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter project title"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Category *</label>
          <input
            type="text"
            list="project-category-suggestions"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. CAD Design, Robotics, FEA, Web Engineering"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
          <datalist id="project-category-suggestions">
            <option value="CAD Design" />
            <option value="Mechanical Systems" />
            <option value="FEA & Simulation" />
            <option value="Robotics & Mechatronics" />
            <option value="Web & Software" />
          </datalist>
        </div>
      </div>

      {/* Thumbnail Upload + URL */}
      <div className="w-full max-w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
        <label className="block font-bold text-slate-700">Thumbnail Image (Upload or URL)</label>
        <div className="flex flex-col sm:flex-row gap-2 min-w-0">
          {isOwner ? (
            <button
              type="button"
              onClick={() => setMediaPickerTarget('thumbnail')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-xs font-semibold cursor-pointer shrink-0"
            >
              {uploadingField === 'thumbnail' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Upload / Media Library</span>
            </button>
          ) : (
            <label className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-xs font-semibold cursor-pointer shrink-0">
              {uploadingField === 'thumbnail' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              <span>Upload to projects</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleBucketUpload(e.target.files, 'thumbnail')}
                className="hidden"
              />
            </label>
          )}
          <input
            type="url"
            value={isSupabaseStorageUrl(thumbnailUrl) ? '' : thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder={
              isSupabaseStorageUrl(thumbnailUrl)
                ? 'Thumbnail uploaded (paste external URL to replace)'
                : 'Or paste thumbnail URL (https://...)'
            }
            className="flex-1 min-w-0 w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>
        {thumbnailUrl && (
          <div className="flex items-center gap-3 flex-wrap">
            <img
              src={thumbnailUrl}
              alt="Thumbnail preview"
              className="h-24 w-auto max-w-full rounded-md border border-slate-300 object-contain bg-white"
            />
            <button
              type="button"
              onClick={() => setThumbnailUrl('')}
              className="px-2.5 py-1 rounded bg-rose-100 text-rose-800 text-[11px] font-semibold cursor-pointer"
            >
              Remove Image
            </button>
          </div>
        )}
      </div>

      <div className="text-xs min-w-0">
        <label className="block font-bold text-slate-700 mb-1">Short Description *</label>
        <textarea
          rows={2}
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Concise summary displayed on the project card"
          className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs min-w-0">
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Overview</label>
          <textarea
            rows={3}
            value={overview}
            onChange={(e) => setOverview(e.target.value)}
            placeholder="Project background and architectural scope"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Objectives</label>
          <textarea
            rows={3}
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            placeholder="Engineering targets, requirements, and constraints"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Methodology</label>
          <textarea
            rows={3}
            value={methodology}
            onChange={(e) => setMethodology(e.target.value)}
            placeholder="Design steps, calculations, simulation, fabrication"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Results &amp; Outcomes</label>
          <textarea
            rows={3}
            value={results}
            onChange={(e) => setResults(e.target.value)}
            placeholder="Measured performance, validation metrics, deliverables"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-cyan-700"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs items-center min-w-0">
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Tools Used (comma-separated)</label>
          <input
            type="text"
            value={toolsText}
            onChange={(e) => setToolsText(e.target.value)}
            placeholder="SolidWorks, Ansys FEA, 5-Axis CNC"
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50"
          />
        </div>
        <div className="min-w-0">
          <label className="block font-bold text-slate-700 mb-1">Publication Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PortfolioProject['status'])}
            className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 cursor-pointer"
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-3 pt-2 sm:pt-4 min-w-0">
          <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
            />
            <span>Featured</span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer font-semibold">
            <input
              type="checkbox"
              checked={isCadProject}
              onChange={(e) => setIsCadProject(e.target.checked)}
            />
            <span>CAD Project</span>
          </label>
        </div>
      </div>

      {isCadProject && (
        <div className="w-full max-w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
            <label className="font-bold text-slate-700">Interactive 3D CAD Viewport Preset (Optional)</label>
            <select
              value={cadModelType || ''}
              onChange={(e) => setCadModelType(e.target.value as PortfolioProject['cadModelType'])}
              className="w-full sm:w-auto min-w-0 px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs"
            >
              <option value="">None (Use uploaded CAD drawings only)</option>
              <option value="harmonic_actuator">Harmonic Drive Actuator</option>
              <option value="gimbal_bracket">Gimbal Optical Yoke</option>
              <option value="planetary_gearbox">Planetary Gearbox</option>
              <option value="chassis_suspension">Chassis Suspension</option>
            </select>
          </div>
        </div>
      )}

      {/* Specifications Dynamic Rows */}
      <div className="w-full max-w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-slate-700">Technical Specifications</span>
          <button
            type="button"
            onClick={() => setSpecifications((prev) => [...prev, { label: '', value: '' }])}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Spec</span>
          </button>
        </div>
        {specifications.map((spec, idx) => (
          <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-w-0">
            <input
              type="text"
              placeholder="Parameter (e.g. Material)"
              value={spec.label}
              onChange={(e) =>
                setSpecifications((prev) =>
                  prev.map((s, i) => (i === idx ? { ...s, label: e.target.value } : s))
                )
              }
              className="flex-1 min-w-0 w-full px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <input
              type="text"
              placeholder="Value (e.g. 7075-T6 Aluminum)"
              value={spec.value}
              onChange={(e) =>
                setSpecifications((prev) =>
                  prev.map((s, i) => (i === idx ? { ...s, value: e.target.value } : s))
                )
              }
              className="flex-1 min-w-0 w-full px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              type="button"
              onClick={() => setSpecifications((prev) => prev.filter((_, i) => i !== idx))}
              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Media & Document Upload Sections */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs min-w-0">
        {/* Gallery Images */}
        <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="font-bold text-slate-700 truncate">Project Images ({images.length})</span>
            {isOwner ? (
              <button
                type="button"
                onClick={() => setMediaPickerTarget('image')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] cursor-pointer shrink-0"
              >
                <Upload className="w-3 h-3" />
                <span>Upload / Library</span>
              </button>
            ) : (
              <label className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 text-white text-[11px] cursor-pointer shrink-0">
                <Upload className="w-3 h-3" />
                <span>Upload</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleBucketUpload(e.target.files, 'image')}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-1.5 min-w-0">
            <input
              type="text"
              placeholder="Caption"
              value={newImageTitle}
              onChange={(e) => setNewImageTitle(e.target.value)}
              className="w-full sm:w-24 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <input
              type="url"
              placeholder="Image URL"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (!newImageUrl.trim()) return;
                setImages((prev) => [
                  ...prev,
                  { title: newImageTitle.trim() || 'Project Image', url: newImageUrl.trim() },
                ]);
                setNewImageUrl('');
                setNewImageTitle('');
              }}
              className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
            >
              Add
            </button>
          </div>
          {images.map((img, i) => (
            <div key={i} className="flex items-center justify-between gap-2 bg-white px-2 py-1 rounded border border-slate-200 min-w-0">
              <span className="truncate flex-1 min-w-0">{img.title || `Uploaded Image ${i + 1}`}</span>
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-rose-600 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Videos */}
        <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="font-bold text-slate-700 truncate">Project Videos ({videos.length})</span>
            {isOwner ? (
              <button
                type="button"
                onClick={() => setMediaPickerTarget('video')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] cursor-pointer shrink-0"
              >
                <Upload className="w-3 h-3" />
                <span>Upload / Library</span>
              </button>
            ) : (
              <label className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 text-white text-[11px] cursor-pointer shrink-0">
                <Upload className="w-3 h-3" />
                <span>Upload</span>
                <input
                  type="file"
                  multiple
                  accept="video/*"
                  onChange={(e) => handleBucketUpload(e.target.files, 'video')}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-1.5 min-w-0">
            <input
              type="text"
              placeholder="Title"
              value={newVideoTitle}
              onChange={(e) => setNewVideoTitle(e.target.value)}
              className="w-full sm:w-24 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <input
              type="url"
              placeholder="Video URL"
              value={newVideoUrl}
              onChange={(e) => setNewVideoUrl(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (!newVideoUrl.trim()) return;
                setVideos((prev) => [
                  ...prev,
                  { title: newVideoTitle.trim() || 'Demo Video', url: newVideoUrl.trim() },
                ]);
                setNewVideoUrl('');
                setNewVideoTitle('');
              }}
              className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
            >
              Add
            </button>
          </div>
          {videos.map((v, i) => (
            <div key={i} className="flex items-center justify-between gap-2 bg-white px-2 py-1 rounded border border-slate-200 min-w-0">
              <span className="truncate flex-1 min-w-0">{v.title || `Uploaded Video ${i + 1}`}</span>
              <button
                type="button"
                onClick={() => setVideos((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-rose-600 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* CAD Drawings */}
        <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="font-bold text-slate-700 truncate">CAD Drawings ({cadDrawings.length})</span>
            {isOwner ? (
              <button
                type="button"
                onClick={() => setMediaPickerTarget('cad')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] cursor-pointer shrink-0"
              >
                <Upload className="w-3 h-3" />
                <span>Upload / Library</span>
              </button>
            ) : (
              <label className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 text-white text-[11px] cursor-pointer shrink-0">
                <Upload className="w-3 h-3" />
                <span>Upload</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.dwg,.dxf,.step,.stp,.iges,.igs,.sldprt,.sldasm,image/*"
                  onChange={(e) => handleBucketUpload(e.target.files, 'cad')}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-1.5 min-w-0">
            <input
              type="text"
              placeholder="Sheet Name"
              value={newCadTitle}
              onChange={(e) => setNewCadTitle(e.target.value)}
              className="w-full sm:w-24 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <input
              type="url"
              placeholder="CAD / Drawing URL"
              value={newCadUrl}
              onChange={(e) => setNewCadUrl(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (!newCadUrl.trim()) return;
                setCadDrawings((prev) => [
                  ...prev,
                  { title: newCadTitle.trim() || 'CAD Drawing', url: newCadUrl.trim() },
                ]);
                setIsCadProject(true);
                setNewCadUrl('');
                setNewCadTitle('');
              }}
              className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
            >
              Add
            </button>
          </div>
          {cadDrawings.map((c, i) => (
            <div key={i} className="flex items-center justify-between gap-2 bg-white px-2 py-1 rounded border border-slate-200 min-w-0">
              <span className="truncate flex-1 min-w-0">
                {c.title || (c.fileName && !/^\d+(\.[^/.]+)?$/.test(c.fileName) ? c.fileName : `Uploaded CAD Drawing ${i + 1}`)}
              </span>
              <button
                type="button"
                onClick={() => setCadDrawings((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-rose-600 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Downloadable Technical Documents */}
        <div className="min-w-0 w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <span className="font-bold text-slate-700 truncate">Technical Documents ({documents.length})</span>
            {isOwner ? (
              <button
                type="button"
                onClick={() => setMediaPickerTarget('document')}
                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 hover:bg-cyan-900 text-white text-[11px] cursor-pointer shrink-0"
              >
                <Upload className="w-3 h-3" />
                <span>Upload / Library</span>
              </button>
            ) : (
              <label className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-800 text-white text-[11px] cursor-pointer shrink-0">
                <Upload className="w-3 h-3" />
                <span>Upload</span>
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleBucketUpload(e.target.files, 'document')}
                  className="hidden"
                />
              </label>
            )}
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-1.5 min-w-0">
            <input
              type="text"
              placeholder="Doc Title"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              className="w-full sm:w-24 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <input
              type="url"
              placeholder="Document URL"
              value={newDocUrl}
              onChange={(e) => setNewDocUrl(e.target.value)}
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (!newDocUrl.trim()) return;
                setDocuments((prev) => [
                  ...prev,
                  { title: newDocTitle.trim() || 'Technical Document', url: newDocUrl.trim() },
                ]);
                setNewDocUrl('');
                setNewDocTitle('');
              }}
              className="px-2.5 py-1 rounded bg-slate-800 text-white cursor-pointer shrink-0"
            >
              Add
            </button>
          </div>
          {documents.map((d, i) => (
            <div key={i} className="flex items-center justify-between gap-2 bg-white px-2 py-1 rounded border border-slate-200 min-w-0">
              <span className="truncate flex-1 min-w-0">
                {d.title || (d.fileName && !/^\d+(\.[^/.]+)?$/.test(d.fileName) ? d.fileName : `Uploaded Document ${i + 1}`)}
              </span>
              <button
                type="button"
                onClick={() => setDocuments((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-rose-600 cursor-pointer shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Demonstration Links */}
      <div className="w-full max-w-full overflow-hidden p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <LinkIcon className="w-3.5 h-3.5 text-cyan-800" />
            <span>Demonstration Links</span>
          </span>
          <button
            type="button"
            onClick={() => setDemoLinks((prev) => [...prev, { label: '', url: '' }])}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-slate-300 hover:bg-slate-100 text-[11px] font-semibold cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Add Link</span>
          </button>
        </div>
        {demoLinks.map((lnk, idx) => (
          <div key={idx} className="flex flex-wrap sm:flex-nowrap items-center gap-2 min-w-0">
            <input
              type="text"
              placeholder="Label (e.g. Live Demo / GitHub)"
              value={lnk.label}
              onChange={(e) =>
                setDemoLinks((prev) =>
                  prev.map((l, i) => (i === idx ? { ...l, label: e.target.value } : l))
                )
              }
              className="w-full sm:w-40 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <input
              type="url"
              placeholder="https://..."
              value={lnk.url}
              onChange={(e) =>
                setDemoLinks((prev) =>
                  prev.map((l, i) => (i === idx ? { ...l, url: e.target.value } : l))
                )
              }
              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-300 bg-white"
            />
            <button
              type="button"
              onClick={() => setDemoLinks((prev) => prev.filter((_, i) => i !== idx))}
              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || uploadingField !== null}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-900 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{initialProject ? 'Update Project' : 'Publish Project'}</span>
        </button>
      </div>

      {isOwner && mediaPickerTarget && (
        <MediaLibraryModal
          isOpen={true}
          title={
            mediaPickerTarget === 'thumbnail'
              ? 'Thumbnail Image'
              : mediaPickerTarget === 'image'
              ? 'Project Images'
              : mediaPickerTarget === 'video'
              ? 'Project Videos'
              : mediaPickerTarget === 'cad'
              ? 'CAD Drawings'
              : 'Technical Documents'
          }
          defaultBucket="projects"
          defaultFilter={
            (mediaPickerTarget === 'thumbnail' || mediaPickerTarget === 'image'
              ? 'image'
              : mediaPickerTarget === 'video'
              ? 'video'
              : mediaPickerTarget === 'document'
              ? 'document'
              : 'all') as MediaLibraryFilter
          }
          allowMultiple={mediaPickerTarget !== 'thumbnail'}
          accept={
            mediaPickerTarget === 'thumbnail' || mediaPickerTarget === 'image'
              ? 'image/*'
              : mediaPickerTarget === 'video'
              ? 'video/*'
              : mediaPickerTarget === 'cad'
              ? '.pdf,.dwg,.dxf,.step,.stp,.iges,.igs,.sldprt,.sldasm,image/*'
              : undefined
          }
          onUploadFiles={(chosenFiles) => {
            void handleBucketUpload(chosenFiles, mediaPickerTarget);
          }}
          onSelectExisting={(chosenItems) => {
            handleMediaLibrarySelect(chosenItems, mediaPickerTarget);
          }}
          onClose={() => setMediaPickerTarget(null)}
        />
      )}
    </form>
  );
};
