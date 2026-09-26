import React from 'react';
import { ArrowUpRight, Cpu, Layers, ShieldCheck, ChevronRight } from 'lucide-react';
import { Project } from '../types/portfolio';

interface ProjectCardProps {
  project: Project;
  onSelect: (project: Project) => void;
  onOpenWhitepaper: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onSelect,
  onOpenWhitepaper,
}) => {
  return (
    <div
      onClick={() => onSelect(project)}
      className="group relative bg-[#edf2f8] rounded-2xl border border-[#b8c6d4] hover:border-cyan-700 hover:bg-white transition-all duration-300 overflow-hidden cursor-pointer flex flex-col shadow-sm hover:shadow-md font-serif"
    >
      {/* Hero Image Container */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#cbd5e1]">
        <img
          src={project.heroImage}
          alt={project.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />

        {/* Clean category & status text metadata */}
        <div className="absolute top-3 left-3 flex items-center gap-2 text-xs sm:text-sm font-sans font-semibold text-slate-900 bg-[#edf2f8]/95 backdrop-blur-md px-3 py-1 rounded-md border border-[#b8c6d4] shadow-sm">
          <span>{project.category}</span>
          <span className="text-slate-400">/</span>
          <span>{project.status}</span>
        </div>

        {/* Hover inspect affordance */}
        <div className="absolute top-3 right-3 p-2 rounded-lg bg-[#edf2f8]/95 backdrop-blur-md text-slate-700 group-hover:text-cyan-900 group-hover:bg-white border border-[#b8c6d4] shadow-sm transition-all">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>

      {/* Content Container */}
      <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Metadata line per zero-pill discipline */}
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-600 font-sans mb-2">
            <span className="font-semibold text-slate-800">{project.role}</span>
            <span>·</span>
            <span>Lead Time: {project.leadTimeWeeks}w</span>
            <span>·</span>
            <span>{project.completionDate}</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold text-slate-950 group-hover:text-cyan-900 transition-colors tracking-tight">
            {project.title}
          </h3>

          <p className="mt-2 text-sm sm:text-base text-slate-700 line-clamp-2 leading-relaxed">
            {project.tagline}
          </p>
        </div>

        {/* High-Impact Proof Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#cbd5e1]">
          {project.metrics.slice(0, 2).map((m, idx) => (
            <div key={idx} className="p-2.5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
              <span className="text-xs text-slate-600 font-sans block truncate">{m.label}</span>
              <strong className="text-base sm:text-lg font-bold font-sans text-cyan-900 block mt-0.5">{m.value}</strong>
              <span className="text-xs text-slate-500 font-sans block truncate">{m.sub}</span>
            </div>
          ))}
        </div>

        {/* Bottom Post-Mortem CTAs */}
        <div className="pt-2 flex items-center justify-between text-sm sm:text-base font-semibold">
          <span className="text-cyan-800 group-hover:text-cyan-950 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
            <span>Inspect Post-Mortem &amp; BOM</span>
            <ChevronRight className="w-4 h-4" />
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenWhitepaper(project);
            }}
            className="text-slate-600 hover:text-slate-950 underline decoration-slate-400 hover:decoration-slate-800 transition-colors cursor-pointer"
          >
            Whitepaper PDF
          </button>
        </div>
      </div>
    </div>
  );
};
