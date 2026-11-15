import React, { useState, useEffect } from 'react';
import {
  Plus,
  ExternalLink,
  Download,
  Eye,
  Layers,
  Sparkles,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  Wrench,
  Globe,
  Box,
  Code,
  Tag,
  X,
  Upload,
  Link as LinkIcon,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { supabase, uploadMaterialToSupabaseBucket } from '../utils/supabase';
import { useProfileSync } from '../utils/profileState';
import { PROJECTS as DEFAULT_STATIC_PROJECTS } from '../data/projectsData';

export interface DynamicProject {
  id: string;
  title: string;
  tagline: string;
  category: 'CAD' | 'Web' | 'General';
  template_type: 'cad' | 'web' | 'general';
  completion_date: string;
  role: string;
  lead_time_weeks: number;
  status: string;
  overview: string;
  objectives: string;
  methodology: string;
  technical_specifications: string;
  cad_drawings_url?: string | null;
  website_url?: string | null;
  live_demo_url?: string | null;
  tools_used: string[];
  results: string;
  metrics?: Array<{ label: string; value: string; sub?: string }>;
  media_gallery?: Array<{ url: string; name?: string; type?: string }>;
  hero_image: string;
  video_url?: string;
  video_settings?: {
    aspect_ratio?: string;
    fit_mode?: string;
    zoom_level?: number;
  };
  created_at?: string;
  updated_at?: string;
}

interface ProjectsPageProps {
  onOpenWhitepaper?: (project: any) => void;
  onNavigatePart?: (part: any, anchorId?: string) => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = () => {
  const { isOwner } = useProfileSync();
  const [projects, setProjects] = useState<DynamicProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'All' | 'CAD' | 'Web' | 'General'>('All');
  const [activeProject, setActiveProject] = useState<DynamicProject | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Project Form State
  const [formTemplate, setFormTemplate] = useState<'cad' | 'web' | 'general'>('cad');
  const [formTitle, setFormTitle] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formCategory, setFormCategory] = useState<'CAD' | 'Web' | 'General'>('CAD');
  const [formCompletionDate, setFormCompletionDate] = useState('2026');
  const [formRole, setFormRole] = useState('Lead Engineer');
  const [formLeadTime, setFormLeadTime] = useState(6);
  const [formStatus, setFormStatus] = useState('Validated Prototype');
  const [formOverview, setFormOverview] = useState('');
  const [formObjectives, setFormObjectives] = useState('');
  const [formMethodology, setFormMethodology] = useState('');
  const [formTechnicalSpecs, setFormTechnicalSpecs] = useState('');
  const [formCadUrl, setFormCadUrl] = useState('');
  const [formWebsiteUrl, setFormWebsiteUrl] = useState('');
  const [formLiveDemoUrl, setFormLiveDemoUrl] = useState('');
  const [formToolsUsed, setFormToolsUsed] = useState('');
  const [formResults, setFormResults] = useState('');
  const [formHeroImage, setFormHeroImage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch projects from Supabase
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('[Supabase Projects Fetch Note]:', error.message);
        setProjects([]);
      } else if (data && data.length > 0) {
        setProjects(data);
      } else {
        // Empty by default, ready for uploads from the owner
        setProjects([]);
      }
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    const channel = supabase
      .channel('public:projects_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        fetchProjects();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update category and template synchronization
  const handleTemplateChange = (template: 'cad' | 'web' | 'general') => {
    setFormTemplate(template);
    if (template === 'cad') setFormCategory('CAD');
    else if (template === 'web') setFormCategory('Web');
    else setFormCategory('General');
  };

  // Export PDF Attachment for project: exact filename format "<Title of the project>.pdf"
  const handleExportProjectPdf = (proj: DynamicProject) => {
    try {
      const doc = new jsPDF({
        unit: 'mm',
        format: 'a4',
      });

      doc.setFont('times', 'bold');
      doc.setFontSize(18);
      doc.text(proj.title, 14, 20);

      doc.setFont('times', 'italic');
      doc.setFontSize(10.5);
      doc.setTextColor(80, 80, 80);
      doc.text(`${proj.category} Portfolio Dossier · ${proj.status} · Completed: ${proj.completion_date}`, 14, 27);
      doc.text(`Role: ${proj.role} · Lead Time: ${proj.lead_time_weeks} Weeks`, 14, 32);

      doc.setDrawColor(180, 190, 200);
      doc.line(14, 35, 196, 35);

      let currentY = 42;
      doc.setTextColor(15, 23, 42);

      // Overview
      doc.setFont('times', 'bold');
      doc.setFontSize(12);
      doc.text('1. Project Overview & Tagline', 14, currentY);
      currentY += 6;
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      const splitOverview = doc.splitTextToSize(proj.overview || proj.tagline || 'Engineering project documentation.', 180);
      doc.text(splitOverview, 14, currentY);
      currentY += splitOverview.length * 5 + 4;

      // Objectives
      if (proj.objectives) {
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text('2. Objectives & Design Requirements', 14, currentY);
        currentY += 6;
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        const splitObjectives = doc.splitTextToSize(proj.objectives, 180);
        doc.text(splitObjectives, 14, currentY);
        currentY += splitObjectives.length * 5 + 4;
      }

      // Methodology
      if (proj.methodology) {
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text('3. Engineering Methodology', 14, currentY);
        currentY += 6;
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        const splitMethodology = doc.splitTextToSize(proj.methodology, 180);
        doc.text(splitMethodology, 14, currentY);
        currentY += splitMethodology.length * 5 + 4;
      }

      // Technical Specifications
      if (proj.technical_specifications) {
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text('4. Technical Specifications', 14, currentY);
        currentY += 6;
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        const splitSpecs = doc.splitTextToSize(proj.technical_specifications, 180);
        doc.text(splitSpecs, 14, currentY);
        currentY += splitSpecs.length * 5 + 4;
      }

      // Tools Used
      if (proj.tools_used && proj.tools_used.length > 0) {
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text('5. Tools, Software & Hardware Used', 14, currentY);
        currentY += 6;
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        doc.text(proj.tools_used.join(' · '), 14, currentY);
        currentY += 8;
      }

      // Results
      if (proj.results) {
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text('6. Empirical Results & Performance Verification', 14, currentY);
        currentY += 6;
        doc.setFont('times', 'normal');
        doc.setFontSize(10);
        const splitResults = doc.splitTextToSize(proj.results, 180);
        doc.text(splitResults, 14, currentY);
        currentY += splitResults.length * 5 + 4;
      }

      // Footer
      doc.setFont('times', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`Official Engineering Dossier · Generated on ${new Date().toLocaleDateString()}`, 14, 287);

      // Exact filename format: "<Title of the project>.pdf"
      const cleanFileName = `${proj.title.trim().replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;
      doc.save(cleanFileName);
    } catch (e) {
      console.error('Failed to export project PDF:', e);
    }
  };

  // Submit New Project
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      setIsSubmitting(true);
      const toolsArray = formToolsUsed
        .split(/[,;]/)
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title: formTitle.trim(),
        tagline: formTagline.trim(),
        category: formCategory,
        template_type: formTemplate,
        completion_date: formCompletionDate,
        role: formRole,
        lead_time_weeks: Number(formLeadTime) || 4,
        status: formStatus,
        overview: formOverview.trim(),
        objectives: formObjectives.trim(),
        methodology: formMethodology.trim(),
        technical_specifications: formTechnicalSpecs.trim(),
        cad_drawings_url: formCadUrl.trim() || null,
        website_url: formWebsiteUrl.trim() || null,
        live_demo_url: formLiveDemoUrl.trim() || null,
        tools_used: toolsArray,
        results: formResults.trim(),
        hero_image: formHeroImage.trim() || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase.from('projects').insert(payload).select().single();

      if (error) {
        console.warn('[Supabase Insert Project Note]:', error.message);
        // Add to local state
        setProjects((prev) => [{ id: `proj_${Date.now()}`, ...payload }, ...prev]);
      } else if (data) {
        setProjects((prev) => [data, ...prev]);
      }

      setIsCreateModalOpen(false);
      // Reset form
      setFormTitle('');
      setFormTagline('');
      setFormOverview('');
      setFormObjectives('');
      setFormMethodology('');
      setFormTechnicalSpecs('');
      setFormCadUrl('');
      setFormWebsiteUrl('');
      setFormLiveDemoUrl('');
      setFormToolsUsed('');
      setFormResults('');
      setFormHeroImage('');
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // File upload helper for project media
  const handleHeroFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadMaterialToSupabaseBucket(file, file.name);
      if (res?.publicUrl) {
        setFormHeroImage(res.publicUrl);
      }
    } catch (err) {
      console.warn('Direct upload notice:', err);
    }
  };

  const filteredProjects = selectedCategory === 'All'
    ? projects
    : projects.filter((p) => p.category === selectedCategory);

  return (
    <div className="w-full flex-1 flex flex-col font-serif pb-16">
      {/* 1. Header Section: Center justified, compact container reading exactly "Engineering Portfolio" */}
      <div className="w-full py-4 sm:py-6 border-b border-[#b8c6d4] bg-[#dbe2eb]/90">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-block py-1 px-4">
            <h1 className="text-xl sm:text-2xl font-bold font-serif text-slate-950 tracking-tight">
              Engineering Portfolio
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full">
        {/* Controls Toolbar: Categories Filter & Admin "New Project" Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-5 border-b border-[#cbd5e1]">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0">
            {(['All', 'CAD', 'Web', 'General'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-serif font-bold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                }`}
              >
                {cat === 'All' ? 'All Projects' : cat === 'CAD' ? '3D CAD & Hardware' : cat === 'Web' ? 'Web Development' : 'General Projects'}
              </button>
            ))}
          </div>

          {/* Admin "New Project" Trigger: Show compact button ONLY when owner is logged in */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-950 text-white text-xs font-serif font-bold shadow-2xs transition-all cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          )}
        </div>

        {/* Dynamic Project Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-800 mb-2" />
            <span className="text-xs font-serif">Loading Engineering Portfolio from Supabase...</span>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="py-20 text-center border-2 border-dashed border-[#b8c6d4] rounded-2xl bg-white/50 p-8 my-6">
            <Layers className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Projects Found</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto mt-1">
              {isOwner
                ? 'Your project portfolio starts blank and is ready for your uploads. Click "New Project" above to create your first portfolio entry.'
                : 'Projects are being prepared and verified by the Chief Engineer.'}
            </p>
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-900 text-white text-xs font-serif font-bold shadow-2xs hover:bg-cyan-950 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Project</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-6">
            {filteredProjects.map((project) => (
              <div
                key={project.id}
                onClick={() => {
                  setActiveProject(project);
                  setIsModalOpen(true);
                }}
                className="group rounded-2xl bg-white/95 border border-slate-300 hover:border-cyan-800 shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                <div>
                  {/* Top Thumbnail */}
                  <div className="relative w-full h-44 bg-slate-200 overflow-hidden">
                    <img
                      src={project.hero_image}
                      alt={project.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-sans font-bold bg-slate-900/90 text-white backdrop-blur-xs">
                        {project.category}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-sans font-bold bg-emerald-600/90 text-white backdrop-blur-xs">
                        {project.status}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 sm:p-4.5">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-cyan-900 transition-colors line-clamp-1">
                      {project.title}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                      {project.tagline || project.overview}
                    </p>

                    {/* Metadata Tags */}
                    {project.tools_used && project.tools_used.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-3">
                        {project.tools_used.slice(0, 3).map((tool, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-sans text-slate-700"
                          >
                            {tool}
                          </span>
                        ))}
                        {project.tools_used.length > 3 && (
                          <span className="text-[10px] text-slate-400 font-sans">
                            +{project.tools_used.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs font-serif text-cyan-900">
                  <span className="font-bold inline-flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Specifications</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExportProjectPdf(project);
                    }}
                    className="p-1 rounded text-slate-500 hover:text-slate-900 transition-colors"
                    title={`Download ${project.title}.pdf`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* 2. DETAILED PROJECT MODAL VIEW                            */}
      {/* ======================================================== */}
      {isModalOpen && activeProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-[#eaf0f6] border border-[#b8c6d4] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-serif">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#d8e0eb] border-b border-[#b8c6d4] shrink-0">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-sans font-bold text-cyan-900">
                  <span>{activeProject.category} SPECIFICATION</span>
                  <span>·</span>
                  <span className="text-emerald-700">{activeProject.status}</span>
                  <span>·</span>
                  <span className="text-slate-500">{activeProject.completion_date}</span>
                </div>
                <h2 className="text-base sm:text-lg font-bold text-slate-950 mt-0.5">
                  {activeProject.title}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportProjectPdf(activeProject)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-900 hover:bg-cyan-950 text-white text-xs font-serif font-bold shadow-2xs transition-colors cursor-pointer"
                  title="Export PDF: <Title of the project>.pdf"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-white/80 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
              {/* Hero Image */}
              <div className="w-full h-56 sm:h-72 rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shadow-2xs">
                <img
                  src={activeProject.hero_image}
                  alt={activeProject.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Tagline / Executive Summary */}
              {activeProject.tagline && (
                <div className="p-3.5 rounded-xl bg-white border border-slate-300 text-slate-800 italic leading-relaxed">
                  "{activeProject.tagline}"
                </div>
              )}

              {/* Overview */}
              {activeProject.overview && (
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1 pb-1 border-b border-slate-300">
                    Overview
                  </h4>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                    {activeProject.overview}
                  </p>
                </div>
              )}

              {/* Objectives */}
              {activeProject.objectives && (
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1 pb-1 border-b border-slate-300">
                    Objectives
                  </h4>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                    {activeProject.objectives}
                  </p>
                </div>
              )}

              {/* Methodology */}
              {activeProject.methodology && (
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1 pb-1 border-b border-slate-300">
                    Methodology
                  </h4>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                    {activeProject.methodology}
                  </p>
                </div>
              )}

              {/* Technical Specifications */}
              {activeProject.technical_specifications && (
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1 pb-1 border-b border-slate-300">
                    Technical Specifications
                  </h4>
                  <div className="p-3 bg-white rounded-lg border border-slate-300 font-mono text-[11px] text-slate-800 whitespace-pre-line">
                    {activeProject.technical_specifications}
                  </div>
                </div>
              )}

              {/* Tools Used */}
              {activeProject.tools_used && activeProject.tools_used.length > 0 && (
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1 pb-1 border-b border-slate-300">
                    Tools &amp; Hardware Used
                  </h4>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeProject.tools_used.map((tool, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-800 text-xs font-sans"
                      >
                        {tool}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Results */}
              {activeProject.results && (
                <div>
                  <h4 className="font-bold text-slate-900 text-sm mb-1 pb-1 border-b border-slate-300">
                    Results &amp; Verification
                  </h4>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-line">
                    {activeProject.results}
                  </p>
                </div>
              )}

              {/* CAD Drawings / Live Demo Links */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {activeProject.cad_drawings_url && (
                  <a
                    href={activeProject.cad_drawings_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 hover:text-cyan-900 text-xs font-serif font-bold transition-colors"
                  >
                    <Box className="w-3.5 h-3.5 text-cyan-800" />
                    <span>View CAD Drawings</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                )}
                {activeProject.website_url && (
                  <a
                    href={activeProject.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 hover:text-cyan-900 text-xs font-serif font-bold transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5 text-cyan-800" />
                    <span>Project Website</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                )}
                {activeProject.live_demo_url && (
                  <a
                    href={activeProject.live_demo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-serif font-bold hover:bg-emerald-800 transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>Live Interactive Demo</span>
                    <ExternalLink className="w-3 h-3 text-emerald-200" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ADMIN "NEW PROJECT" CREATION MODAL                    */}
      {/* ======================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-[#eaf0f6] border border-[#b8c6d4] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-serif">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#d8e0eb] border-b border-[#b8c6d4] shrink-0">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-900" />
                <h3 className="text-sm sm:text-base font-bold text-slate-950">
                  Add New Project to Engineering Portfolio
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Template Selector Ribbon: 3 Basic Templates */}
            <div className="p-3 bg-[#e0e7f1] border-b border-[#b8c6d4] flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-700">Select Template:</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleTemplateChange('cad')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    formTemplate === 'cad' ? 'bg-cyan-900 text-white' : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  1. 3D Modeling (CAD)
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplateChange('web')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    formTemplate === 'web' ? 'bg-cyan-900 text-white' : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  2. Web Development
                </button>
                <button
                  type="button"
                  onClick={() => handleTemplateChange('general')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    formTemplate === 'general' ? 'bg-cyan-900 text-white' : 'bg-white text-slate-700 border border-slate-300'
                  }`}
                >
                  3. General Project
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateProject} className="p-5 overflow-y-auto space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Project Title *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Bi-Axial Flight Gimbal Mechanism"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Tagline</label>
                <input
                  type="text"
                  value={formTagline}
                  onChange={(e) => setFormTagline(e.target.value)}
                  placeholder="e.g. 5-Axis CNC Titanium yoke cutting structural mass by 41.8%"
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-cyan-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Completion Date</label>
                  <input
                    type="text"
                    value={formCompletionDate}
                    onChange={(e) => setFormCompletionDate(e.target.value)}
                    placeholder="e.g. June 2026"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Lead Time (Weeks)</label>
                  <input
                    type="number"
                    value={formLeadTime}
                    onChange={(e) => setFormLeadTime(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Status</label>
                  <input
                    type="text"
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    placeholder="e.g. Flight Ready"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Overview</label>
                <textarea
                  rows={2}
                  value={formOverview}
                  onChange={(e) => setFormOverview(e.target.value)}
                  placeholder="Summary of constraints, requirements, and design execution..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Objectives</label>
                <textarea
                  rows={2}
                  value={formObjectives}
                  onChange={(e) => setFormObjectives(e.target.value)}
                  placeholder="Primary design goals, mass target, thermal boundaries..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Methodology</label>
                <textarea
                  rows={2}
                  value={formMethodology}
                  onChange={(e) => setFormMethodology(e.target.value)}
                  placeholder="Hand calculations, FEA topology, CAM toolpaths, testing..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Technical Specifications</label>
                <textarea
                  rows={2}
                  value={formTechnicalSpecs}
                  onChange={(e) => setFormTechnicalSpecs(e.target.value)}
                  placeholder="Envelope, thermal range, mass budget, vibration, factor of safety..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 font-mono text-[11px]"
                />
              </div>

              {/* Template specific fields */}
              {formTemplate === 'cad' && (
                <div>
                  <label className="block font-bold text-slate-800 mb-1">CAD Drawings URL / 3D Spec</label>
                  <input
                    type="text"
                    value={formCadUrl}
                    onChange={(e) => setFormCadUrl(e.target.value)}
                    placeholder="https://... CAD drawing or 3D model URL"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                </div>
              )}

              {formTemplate === 'web' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Live Demo URL</label>
                    <input
                      type="text"
                      value={formLiveDemoUrl}
                      onChange={(e) => setFormLiveDemoUrl(e.target.value)}
                      placeholder="https://my-app.vercel.app"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">Project Website / Repo</label>
                    <input
                      type="text"
                      value={formWebsiteUrl}
                      onChange={(e) => setFormWebsiteUrl(e.target.value)}
                      placeholder="https://github.com/..."
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-800 mb-1">Tools Used (comma separated)</label>
                <input
                  type="text"
                  value={formToolsUsed}
                  onChange={(e) => setFormToolsUsed(e.target.value)}
                  placeholder="SolidWorks, Ansys FEA, 5-Axis CNC, React, TypeScript..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Results &amp; Verification</label>
                <textarea
                  rows={2}
                  value={formResults}
                  onChange={(e) => setFormResults(e.target.value)}
                  placeholder="Empirical measurements, mass savings, tolerance verification..."
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                />
              </div>

              {/* Dual input for hero thumbnail: URL or direct file upload */}
              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Thumbnail / Hero Media (Direct File Upload or External URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formHeroImage}
                    onChange={(e) => setFormHeroImage(e.target.value)}
                    placeholder="https://... or upload below"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900"
                  />
                  <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 cursor-pointer font-bold">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleHeroFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-300 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-900 hover:bg-cyan-950 text-white font-bold cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Publish Project</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
