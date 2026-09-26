import React, { useState } from 'react';
import { Ruler, CheckCircle2, AlertTriangle, ShieldCheck, Microscope, Layers } from 'lucide-react';

export const MetrologyInspectionGuide: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'stackup' | 'cmm' | 'as9102'>('stackup');

  return (
    <div className="mt-12 rounded-2xl bg-[#edf2f8] border border-[#b8c6d4] p-6 lg:p-8 shadow-sm font-serif">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#cbd5e1] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-sans font-bold text-cyan-900">
            <Microscope className="w-4 h-4 text-cyan-800" />
            <span>QUALITY ASSURANCE &amp; FIRST-ARTICLE INSPECTION PROTOCOL</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mt-1">
            Metrology Verification &amp; Tolerance Stack-Up Standards
          </h3>
          <p className="text-sm sm:text-base text-slate-700 mt-0.5">
            Physical verification framework applied to all CNC machined 7075-T6 flight hardware before deployment.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-[#e2e8f0] p-1.5 rounded-xl border border-[#b8c6d4] text-sm font-sans">
          <button
            onClick={() => setActiveTab('stackup')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'stackup' ? 'bg-slate-900 text-white font-bold shadow' : 'text-slate-700 hover:text-slate-950 hover:bg-white'
            }`}
          >
            Tolerance Stack-Up
          </button>
          <button
            onClick={() => setActiveTab('cmm')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'cmm' ? 'bg-slate-900 text-white font-bold shadow' : 'text-slate-700 hover:text-slate-950 hover:bg-white'
            }`}
          >
            CMM Probing Routine
          </button>
          <button
            onClick={() => setActiveTab('as9102')}
            className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'as9102' ? 'bg-slate-900 text-white font-bold shadow' : 'text-slate-700 hover:text-slate-950 hover:bg-white'
            }`}
          >
            AS9102 FAI Workflow
          </button>
        </div>
      </div>

      <div className="mt-6">
        {activeTab === 'stackup' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-2 shadow-xs">
              <span className="text-xs font-sans font-bold text-cyan-900 block">METHODOLOGY 01</span>
              <h4 className="text-base sm:text-lg font-bold text-slate-950">Worst-Case Boundary (100% Interchangeability)</h4>
              <p className="text-sm text-slate-700 leading-relaxed">
                Applied to flight-critical optical bearing journals and hermetic O-ring seal glands. Assumes all mating components are simultaneously at their Maximum Material Condition (MMC) or Least Material Condition (LMC).
              </p>
              <div className="mt-3 p-3 rounded-lg bg-white border border-[#cbd5e1] font-mono text-xs sm:text-sm text-cyan-900 font-bold">
                T_wc = Σ |a_i · t_i| = ±0.014 mm
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-2 shadow-xs">
              <span className="text-xs font-sans font-bold text-cyan-900 block">METHODOLOGY 02</span>
              <h4 className="text-base sm:text-lg font-bold text-slate-950">Root Sum of Squares (RSS 3σ Normal Distribution)</h4>
              <p className="text-sm text-slate-700 leading-relaxed">
                Employed for multi-station structural fastener brackets and non-bearing locating dowels to avoid unnecessarily tight and costly machining tolerances, reducing scrap rate by 94%.
              </p>
              <div className="mt-3 p-3 rounded-lg bg-white border border-[#cbd5e1] font-mono text-xs sm:text-sm text-cyan-900 font-bold">
                T_rss = √[ Σ (a_i · t_i)² ] = ±0.0068 mm (3.0 Cp)
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-2 shadow-xs">
              <span className="text-xs font-sans font-bold text-cyan-900 block">METHODOLOGY 03</span>
              <h4 className="text-base sm:text-lg font-bold text-slate-950">Monte Carlo Simulation (100,000 Iterations)</h4>
              <p className="text-sm text-slate-700 leading-relaxed">
                Modeled in Python NumPy with non-symmetric tool wear distributions. Predicted a 0.0012% assembly clash probability, allowing relaxations on secondary yoke gusset radii.
              </p>
              <div className="mt-3 p-3 rounded-lg bg-white border border-[#cbd5e1] font-mono text-xs sm:text-sm text-emerald-800 font-bold">
                P(Interference) &lt; 0.002% (6σ Quality)
              </div>
            </div>
          </div>
        )}

        {activeTab === 'cmm' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-3 shadow-xs">
              <h4 className="text-base sm:text-lg font-bold text-slate-950 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Zeiss Contura Bridge CMM Probing Protocol</span>
              </h4>
              <ul className="text-sm sm:text-base text-slate-700 space-y-2.5 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-800 font-sans font-bold">1.</span>
                  <span><strong>Temperature Soak:</strong> 24-hour thermal stabilization at 20.0°C ±0.5°C in Class 10,000 metrology lab on Grade 00 granite surface plate.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-800 font-sans font-bold">2.</span>
                  <span><strong>Datum Alignment:</strong> Primary Datum A established via 8-point surface scan for flatness; Secondary Datum B established with 12-point cylindrical probe.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-800 font-sans font-bold">3.</span>
                  <span><strong>Stylus Selection:</strong> Renishaw 2.0 mm synthetic ruby tip calibrated against master ceramic reference sphere prior to each inspection lot.</span>
                </li>
              </ul>
            </div>

            <div className="p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-3 shadow-xs">
              <h4 className="text-base sm:text-lg font-bold text-slate-950 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-cyan-800" />
                <span>ASME Y14.5-2018 Feature Verification Summary</span>
              </h4>
              <div className="space-y-2 text-sm font-sans">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#cbd5e1]">
                  <span className="text-slate-700 font-medium">Datum A Flatness:</span>
                  <span className="text-emerald-800 font-bold">Actual: 0.003 mm / Max: 0.008 mm (PASSED)</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#cbd5e1]">
                  <span className="text-slate-700 font-medium">Ø32.000 Bore True Position:</span>
                  <span className="text-emerald-800 font-bold">Actual: Ø0.005 mm / Max: Ø0.012 mm (PASSED)</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#cbd5e1]">
                  <span className="text-slate-700 font-medium">Perpendicularity ⟂ A:</span>
                  <span className="text-emerald-800 font-bold">Actual: 0.007 mm / Max: 0.015 mm (PASSED)</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#cbd5e1]">
                  <span className="text-slate-700 font-medium">Surface Roughness Ra:</span>
                  <span className="text-emerald-800 font-bold">Actual: 0.52 µm / Spec: Ra 0.8 µm (PASSED)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'as9102' && (
          <div className="p-5 rounded-xl bg-[#f4f7fb] border border-[#cbd5e1] space-y-3 shadow-xs">
            <h4 className="text-base sm:text-lg font-bold text-slate-950 flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-800" />
              <span>AS9102 Aerospace First Article Inspection Report (FAIR) Structure</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-4 rounded-xl bg-white border border-[#cbd5e1]">
                <strong className="text-cyan-900 block font-sans font-bold text-base">Form 1: Part Number Accountability</strong>
                <p className="text-slate-700 mt-1.5 leading-relaxed text-sm">
                  Traces drawing number DWG-7075-AM-REV-D, raw stock mill certs (Alcoa 7075-T651 AMS 4045), and serialized trace tags.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white border border-[#cbd5e1]">
                <strong className="text-cyan-900 block font-sans font-bold text-base">Form 2: Product Process Accountability</strong>
                <p className="text-slate-700 mt-1.5 leading-relaxed text-sm">
                  Documents 5-axis Haas CNC toolpaths, MIL-A-8625 Type III Hardcoat Anodizing certification, and bake-out logs.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-white border border-[#cbd5e1]">
                <strong className="text-cyan-900 block font-sans font-bold text-base">Form 3: Characteristic Accountability</strong>
                <p className="text-slate-700 mt-1.5 leading-relaxed text-sm">
                  100% ballooned drawing inspection: 48 dimensional characteristics verified by CMM and Mitutoyo digital micrometers.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
