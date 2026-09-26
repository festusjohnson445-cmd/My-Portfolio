import React, { useState } from 'react';
import {
  X,
  FileText,
  Calculator,
  Layers,
  DollarSign,
  ShieldAlert,
  Award,
  CheckCircle2,
  ExternalLink,
  Cpu,
  ArrowRight,
  TrendingDown,
  Clock,
  Sparkles,
  Download,
  Upload
} from 'lucide-react';
import { Project, BomItem } from '../types/portfolio';
import { Interactive3DViewer } from './Interactive3DViewer';

interface ProjectDetailModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenWhitepaper: (project: Project) => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  project,
  isOpen,
  onClose,
  onOpenWhitepaper,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'constraints' | 'calcs' | 'bom' | 'endorsements'>('overview');
  const [bomProcessFilter, setBomProcessFilter] = useState<string>('All');

  if (!isOpen || !project) return null;

  // Calculate BOM financial savings
  const totalProtoCost = project.bom.reduce((sum, item) => sum + item.prototypeCost * item.qty, 0);
  const totalProdCost1k = project.bom.reduce((sum, item) => sum + item.productionCost1k * item.qty, 0);
  const totalSavingsDollars = totalProtoCost - totalProdCost1k;
  const overallDfmSavingsPercent = ((totalSavingsDollars / totalProtoCost) * 100).toFixed(1);

  const filteredBom = bomProcessFilter === 'All'
    ? project.bom
    : project.bom.filter((item) => item.process.toLowerCase().includes(bomProcessFilter.toLowerCase()));

  const uniqueProcesses = ['All', ...Array.from(new Set(project.bom.map((b) => b.process.split(' ')[0])))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#edf2f8] border border-[#b8c6d4] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col font-serif">
        {/* Modal Top Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#dce2e9] border-b border-[#b8c6d4] shrink-0">
          <div>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-sans font-bold text-cyan-900">
              <span>{project.category} CASE STUDY</span>
              <span className="text-slate-400">·</span>
              <span className="text-emerald-800">{project.status}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600">{project.completionDate}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-950 tracking-tight mt-0.5">
              {project.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenWhitepaper(project)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold bg-[#e4eaf1] hover:bg-white text-slate-900 border border-[#b8c6d4] transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-cyan-800" />
              <span>Calculation Whitepaper</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation Ribbon */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 bg-[#e2e8f0] border-b border-[#b8c6d4] overflow-x-auto text-sm font-sans shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'overview' ? 'bg-slate-900 text-white font-bold shadow' : 'text-slate-700 hover:text-slate-950 hover:bg-white'
            }`}
          >
            01. Overview &amp; 3D Assembly
          </button>
          <button
            onClick={() => setActiveTab('constraints')}
            className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'constraints' ? 'bg-slate-900 text-white font-bold shadow' : 'text-slate-700 hover:text-slate-950 hover:bg-white'
            }`}
          >
            02. Problem Constraints
          </button>
          <button
            onClick={() => setActiveTab('calcs')}
            className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'calcs' ? 'bg-slate-900 text-white font-bold shadow' : 'text-slate-700 hover:text-slate-950 hover:bg-white'
            }`}
          >
            03. Hand Calculations
          </button>
          <button
            onClick={() => setActiveTab('bom')}
            className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'bom' ? 'bg-slate-900 text-white font-bold shadow' : 'text-slate-700 hover:text-slate-950 hover:bg-white'
            }`}
          >
            04. Interactive BOM &amp; DFM
          </button>
          <button
            onClick={() => setActiveTab('endorsements')}
            className={`px-3.5 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'endorsements' ? 'bg-slate-900 text-white font-bold shadow' : 'text-slate-700 hover:text-slate-950 hover:bg-white'
            }`}
          >
            05. Endorsements &amp; NDA
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-800">
          {/* TAB 1: OVERVIEW & 3D */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Executive Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {project.metrics.map((m, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
                    <span className="text-xs font-sans text-slate-600 block">{m.label}</span>
                    <strong className="text-xl sm:text-2xl font-bold font-sans text-cyan-900 block mt-1">{m.value}</strong>
                    <span className="text-xs font-sans text-slate-500 block mt-0.5">{m.sub}</span>
                  </div>
                ))}
              </div>

              {/* Interactive 3D WebGL Assembly Viewer */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-950 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-800" />
                    <span>Interactive 3D Assembly CAD Inspection Stage</span>
                  </h3>
                  <span className="text-xs sm:text-sm font-sans text-slate-600">WebGL 60FPS · Orbit &amp; Explode</span>
                </div>
                <Interactive3DViewer modelType={project.modelType} />
              </div>

              {/* Role & Contributions Summary */}
              <div className="p-5 sm:p-6 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-3 shadow-xs">
                <h4 className="text-xs sm:text-sm font-sans uppercase font-bold tracking-wider text-cyan-900">
                  Individual Engineering Responsibilities &amp; Execution
                </h4>
                <div className="text-sm font-sans text-slate-700">
                  Design Lead: <strong className="text-slate-950 font-bold">{project.role}</strong>
                </div>
                {project.websiteUrl && (
                  <a href={project.websiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-cyan-800 hover:text-cyan-950 hover:underline font-semibold text-sm">
                    <span>Official Project Website</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <ul className="space-y-2.5 mt-2">
                  {project.individualContributions.map((c, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm sm:text-base text-slate-700 leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Verified Credentials */}
              <div className="p-4 sm:p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
                <h4 className="text-xs sm:text-sm font-sans uppercase font-bold tracking-wider text-slate-600 mb-2.5">
                  Verified Engineering Credentials Applied to this Project
                </h4>
                <div className="flex flex-wrap gap-2">
                  {project.verifiedCredentials.map((cred, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#cbd5e1] text-xs sm:text-sm font-sans text-cyan-900 font-semibold shadow-xs">
                      <Award className="w-4 h-4 text-cyan-800" />
                      <span>{cred}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PROBLEM CONSTRAINTS */}
          {activeTab === 'constraints' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mb-1">
                  Exhaustive Boundary Constraints Matrix
                </h3>
                <p className="text-sm sm:text-base text-slate-700">
                  Real engineering problems are defined by hard mechanical, thermal, and spatial envelopes.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 sm:p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-1.5 shadow-xs">
                  <span className="text-xs sm:text-sm font-sans font-bold text-cyan-900 uppercase tracking-wide block">
                    Envelope &amp; Geometric Clearance
                  </span>
                  <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                    {project.problemConstraints.envelope}
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-1.5 shadow-xs">
                  <span className="text-xs sm:text-sm font-sans font-bold text-cyan-900 uppercase tracking-wide block">
                    Thermal Dissipation &amp; Range
                  </span>
                  <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                    {project.problemConstraints.thermal}
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-1.5 shadow-xs">
                  <span className="text-xs sm:text-sm font-sans font-bold text-cyan-900 uppercase tracking-wide block">
                    Mass Budget &amp; Structural Target
                  </span>
                  <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                    {project.problemConstraints.massBudget}
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-1.5 shadow-xs">
                  <span className="text-xs sm:text-sm font-sans font-bold text-cyan-900 uppercase tracking-wide block">
                    Dynamic Resonances &amp; Vibration
                  </span>
                  <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                    {project.problemConstraints.vibrationDynamic}
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-1.5 shadow-xs">
                  <span className="text-xs sm:text-sm font-sans font-bold text-cyan-900 uppercase tracking-wide block">
                    Factor of Safety (SF) &amp; Fatigue Target
                  </span>
                  <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                    {project.problemConstraints.factorOfSafety}
                  </p>
                </div>

                <div className="p-4 sm:p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-1.5 shadow-xs">
                  <span className="text-xs sm:text-sm font-sans font-bold text-cyan-900 uppercase tracking-wide block">
                    Environmental &amp; Corrosion Standards
                  </span>
                  <p className="text-sm sm:text-base text-slate-700 leading-relaxed">
                    {project.problemConstraints.environmental}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: HAND CALCULATIONS */}
          {activeTab === 'calcs' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mb-1">
                  First-Principles Analytical Hand Calculations
                </h3>
                <p className="text-sm sm:text-base text-slate-700">
                  Hand calculations establish mathematical sanity checks before launching complex 3D CAD modeling simulations.
                </p>
              </div>

              <div className="space-y-6">
                {project.handCalculations.map((calc, idx) => (
                  <div key={idx} className="p-5 sm:p-6 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base sm:text-lg font-bold text-slate-950">{calc.title}</h4>
                      <span className="text-xs font-sans font-bold text-cyan-900 bg-cyan-100 px-2.5 py-1 rounded border border-cyan-300">
                        Calc #{idx + 1}
                      </span>
                    </div>

                    <div className="p-3.5 rounded-lg bg-white border border-[#cbd5e1] font-mono text-sm text-cyan-950 font-bold overflow-x-auto">
                      {calc.formula}
                    </div>

                    <div className="text-sm font-sans text-slate-700">
                      <strong className="text-slate-900 font-semibold">Variables &amp; Constants: </strong>
                      {calc.variables}
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[#cbd5e1]">
                      <span className="text-xs font-sans font-bold text-slate-600 uppercase block">
                        Step-by-Step Derivation:
                      </span>
                      {calc.stepByStep.map((step, sIdx) => (
                        <div key={sIdx} className="text-sm font-mono text-slate-800 pl-3 border-l-2 border-slate-400">
                          {step}
                        </div>
                      ))}
                    </div>

                    <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-300 text-sm font-sans text-emerald-900">
                      <strong className="font-bold">Verification Outcome: </strong>
                      {calc.outcome}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* TAB 5: INTERACTIVE BOM & DFM */}
          {activeTab === 'bom' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mb-0.5">
                    Interactive Bill of Materials (BOM) &amp; DFM Savings
                  </h3>
                  <p className="text-sm sm:text-base text-slate-700">
                    Calculated per-unit cost reduction moving from rapid prototype tooling to 1,000-unit batch manufacturing.
                  </p>
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1.5 overflow-x-auto text-sm font-sans">
                  {uniqueProcesses.map((proc) => (
                    <button
                      key={proc}
                      onClick={() => setBomProcessFilter(proc)}
                      className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                        bomProcessFilter === proc
                          ? 'bg-slate-900 text-white font-bold shadow'
                          : 'bg-white text-slate-700 hover:text-slate-950 border border-[#b8c6d4]'
                      }`}
                    >
                      {proc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total DFM Financial Impact Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
                  <span className="text-xs sm:text-sm text-slate-600 font-sans block">Prototype Build Unit Cost</span>
                  <strong className="text-xl font-bold font-sans text-slate-900 block mt-0.5">
                    ${totalProtoCost.toFixed(2)}
                  </strong>
                  <span className="text-xs text-slate-500 font-sans">Includes single-piece CNC setups</span>
                </div>

                <div className="p-4 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] shadow-xs">
                  <span className="text-xs sm:text-sm text-slate-600 font-sans block">Volume Run Unit Cost (1,000 pcs)</span>
                  <strong className="text-xl font-bold font-sans text-emerald-800 block mt-0.5">
                    ${totalProdCost1k.toFixed(2)}
                  </strong>
                  <span className="text-xs text-slate-500 font-sans">Gang fixturing &amp; optimized G-code</span>
                </div>

                <div className="p-4 rounded-xl bg-[#f4f7fb] border border-cyan-600/40 shadow-xs">
                  <span className="text-xs sm:text-sm text-cyan-900 font-sans font-bold block">Total DFM Savings Delta</span>
                  <strong className="text-xl font-bold font-sans text-cyan-900 block mt-0.5">
                    -${totalSavingsDollars.toFixed(2)} ({overallDfmSavingsPercent}%)
                  </strong>
                  <span className="text-xs text-cyan-800 font-sans">Direct margin improvement</span>
                </div>
              </div>

              {/* BOM Table */}
              <div className="overflow-x-auto rounded-xl border border-[#cbd5e1] bg-white shadow-xs">
                <table className="w-full text-left text-sm font-sans">
                  <thead className="bg-[#edf2f8] text-slate-700 border-b border-[#cbd5e1] font-semibold">
                    <tr>
                      <th className="px-3.5 py-3">#</th>
                      <th className="px-3.5 py-3">Part Name</th>
                      <th className="px-3.5 py-3">Material</th>
                      <th className="px-3.5 py-3">Process</th>
                      <th className="px-3.5 py-3 text-right">Qty</th>
                      <th className="px-3.5 py-3 text-right">Proto Cost</th>
                      <th className="px-3.5 py-3 text-right">1k Vol Cost</th>
                      <th className="px-3.5 py-3 text-right">DFM Delta</th>
                      <th className="px-3.5 py-3">Supplier</th>
                      <th className="px-3.5 py-3 text-right">Lead</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0] text-slate-800">
                    {filteredBom.map((item) => (
                      <tr key={item.itemNo} className="hover:bg-[#f8fafc] transition-colors">
                        <td className="px-3.5 py-2.5 text-slate-500 font-mono text-xs">{item.itemNo}</td>
                        <td className="px-3.5 py-2.5 font-serif font-bold text-slate-950">{item.partName}</td>
                        <td className="px-3.5 py-2.5 text-cyan-900 font-medium">{item.material}</td>
                        <td className="px-3.5 py-2.5">{item.process}</td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums">{item.qty}</td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums text-slate-600">${item.prototypeCost.toFixed(2)}</td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums font-bold text-slate-950">${item.productionCost1k.toFixed(2)}</td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums font-bold text-emerald-800">-{item.dfmSavingsPercent}%</td>
                        <td className="px-3.5 py-2.5 text-slate-600">{item.supplier}</td>
                        <td className="px-3.5 py-2.5 text-right tabular-nums text-slate-600">{item.leadTimeWeeks}w</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 6: ENDORSEMENTS & NDA */}
          {activeTab === 'endorsements' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mb-1">
                  Supervisor Endorsements &amp; Legal IP Compliance
                </h3>
                <p className="text-sm sm:text-base text-slate-700">
                  Verifiable technical recommendations and non-disclosure IP clearance guidelines.
                </p>
              </div>

              {/* Endorsements */}
              <div className="space-y-4">
                {project.supervisorEndorsements.map((end, idx) => (
                  <div key={idx} className="p-5 sm:p-6 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-3 shadow-xs">
                    <p className="text-base sm:text-lg text-slate-800 italic leading-relaxed font-serif">
                      "{end.quote}"
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-sm pt-2.5 border-t border-[#cbd5e1] gap-2 font-sans">
                      <div>
                        <strong className="text-slate-950 font-bold block">{end.name}</strong>
                        <span className="text-slate-600">{end.role} · {end.company}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-500 font-mono text-xs">{end.date}</span>
                        <a
                          href={end.linkedin}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-cyan-800 hover:text-cyan-950 hover:underline font-semibold text-xs"
                        >
                          <span>Verify LinkedIn</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* IP / NDA Compliance Disclaimer */}
              <div className="p-4 sm:p-5 rounded-xl bg-amber-50 border border-amber-300 space-y-1.5 text-sm text-amber-950 shadow-xs">
                <div className="flex items-center gap-2 text-amber-900 font-bold font-sans">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Confidentiality &amp; NDA Disclaimer</span>
                </div>
                <p className="leading-relaxed font-serif">
                  {project.ipComplianceDisclaimer}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="px-6 py-4 bg-[#dce2e9] border-t border-[#b8c6d4] flex items-center justify-between shrink-0">
          <div className="text-xs sm:text-sm font-sans text-slate-700">
            Fesline Engineering Archive · Project ID: <span className="text-cyan-900 font-bold">{project.id}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onOpenWhitepaper(project)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-700 hover:bg-cyan-800 text-white shadow-md transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Calculation Whitepaper</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
