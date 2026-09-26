import React, { useState, useRef, useCallback } from 'react';
import { Sliders, CheckCircle2, Ruler, Eye, Sparkles } from 'lucide-react';

interface CadVsPhysicalProps {
  cadImage: string;
  physicalImage: string;
  title?: string;
  partName?: string;
}

export const CadVsPhysicalSlider: React.FC<CadVsPhysicalProps> = ({
  cadImage,
  physicalImage,
  title = 'CAD Solid Model vs. 5-Axis CNC Physical Machined Build',
  partName = 'AeroMount-7075 Optical Gimbal Yoke',
}) => {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activePin, setActivePin] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const clampedX = Math.max(0, Math.min(rect.width, x));
    const percentage = (clampedX / rect.width) * 100;
    setSliderPos(percentage);
  }, []);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    handleMove(e.touches[0].clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };

  const handleStart = () => {
    setIsDragging(true);
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  const verificationPoints = [
    {
      id: 1,
      x: 32,
      y: 42,
      title: 'Precision Azimuth Bearing Bore',
      cadSpec: 'Nominal Ø42.000 +0.008/-0.000mm',
      physicalMeasurement: 'CMM Measured: Ø42.003mm (Within 0.003mm limit)',
      gdt: '⌖ Ø0.012 Ⓜ | A | B Ⓜ | C',
    },
    {
      id: 2,
      x: 68,
      y: 35,
      title: 'Lightweighting Truss Fillet Radii',
      cadSpec: 'CAD Geometry: R3.00mm Continuous Fillet',
      physicalMeasurement: '5-Axis Ball-End Milled, Ra = 0.74 µm',
      gdt: '⌒ 0.020 | A | B',
    },
    {
      id: 3,
      x: 50,
      y: 75,
      title: 'Primary Azimuth Mounting Flange',
      cadSpec: 'Nominal Flatness: 0.008mm',
      physicalMeasurement: 'Granite Table Dial Indicator: 0.004mm Total Runout',
      gdt: '⏥ 0.008 | A',
    },
  ];

  return (
    <div className="w-full bg-[#edf2f8] rounded-2xl border border-[#b8c6d4] p-5 sm:p-7 shadow-sm font-serif">
      {/* Header with Title and Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-cyan-800" />
            <span className="text-xs sm:text-sm font-sans font-bold text-cyan-900 uppercase tracking-wider">
              Metrology &amp; DFM Verification
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mt-1">{title}</h3>
          <p className="text-sm sm:text-base text-slate-700">{partName} · Manufactured in 7075-T6 Aerospace Aluminum</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-sm font-sans">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-cyan-700"></span>
            <span className="text-slate-800 font-semibold">CAD Model (Left)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-600"></span>
            <span className="text-slate-800 font-semibold">Physical CNC (Right)</span>
          </div>
        </div>
      </div>

      {/* Interactive Comparison Slider Stage with Safe Scroll Gesture `touch-action: pan-y` */}
      <div
        ref={containerRef}
        onMouseDown={handleStart}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onMouseMove={handleMouseMove}
        onTouchStart={handleStart}
        onTouchEnd={handleEnd}
        onTouchCancel={handleEnd}
        onTouchMove={handleTouchMove}
        style={{ touchAction: 'pan-y' }}
        className="relative w-full aspect-[4/3] sm:aspect-[16/9] rounded-xl overflow-hidden cursor-ew-resize select-none border border-[#b0bece] bg-[#cbd5e1] shadow-inner group"
      >
        {/* Layer 1: Physical CNC Machined Part (Underneath / Right reveal) */}
        <div className="absolute inset-0 w-full h-full">
          <img
            src={physicalImage}
            alt="Physical 5-axis CNC machined 7075-T6 aluminum part on granite plate"
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-3 right-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs sm:text-sm font-sans font-bold text-emerald-400 border border-emerald-500/40 shadow">
            Physical CNC Build (Haas UMC-750)
          </div>
        </div>

        {/* Layer 2: CAD Solid Model (Top layer clipped by slider position) */}
        <div
          className="absolute inset-0 w-full h-full overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <img
            src={cadImage}
            alt="Parametric SolidWorks CAD Solid Model rendering"
            className="w-full h-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs sm:text-sm font-sans font-bold text-cyan-300 border border-cyan-500/40 shadow">
            SolidWorks Master CAD Model
          </div>
        </div>

        {/* Central Divider Handle */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-cyan-600 via-white to-cyan-600 shadow-[0_0_12px_rgba(2,132,199,0.9)] z-20 pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          {/* Grip Dial */}
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-slate-900 border-2 border-white shadow-xl flex items-center justify-center pointer-events-auto cursor-ew-resize group-hover:scale-110 transition-transform">
            <Sliders className="w-4 h-4 text-cyan-300" />
          </div>
        </div>

        {/* Metrology Inspection Hotspots */}
        {verificationPoints.map((pin) => (
          <button
            key={pin.id}
            onClick={(e) => {
              e.stopPropagation();
              setActivePin(activePin === pin.id ? null : pin.id);
            }}
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            className={`absolute z-30 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center font-sans text-xs font-bold transition-all shadow-lg cursor-pointer ${
              activePin === pin.id
                ? 'bg-cyan-700 text-white ring-4 ring-cyan-500/50 scale-125'
                : 'bg-white/90 text-cyan-900 border border-cyan-700 hover:scale-110 hover:bg-white'
            }`}
          >
            {pin.id}
          </button>
        ))}

        {/* Active Hotspot Inspector Overlay */}
        {activePin !== null && (
          <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-md z-30 bg-[#f4f7fb]/95 backdrop-blur-md border border-[#b8c6d4] rounded-xl p-4 shadow-2xl text-sm space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-950 flex items-center gap-1.5 text-base">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {verificationPoints[activePin - 1].title}
              </span>
              <button
                onClick={() => setActivePin(null)}
                className="text-slate-500 hover:text-slate-950 text-sm px-1 cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>
            <div className="font-sans text-xs sm:text-sm text-cyan-900">
              <span className="text-slate-600 font-semibold">CAD Spec: </span>
              {verificationPoints[activePin - 1].cadSpec}
            </div>
            <div className="font-sans text-xs sm:text-sm text-emerald-800">
              <span className="text-slate-600 font-semibold">CMM Metrology: </span>
              {verificationPoints[activePin - 1].physicalMeasurement}
            </div>
            <div className="font-mono text-xs text-slate-800 bg-white/80 px-2.5 py-1.5 rounded border border-[#cbd5e1]">
              GD&amp;T: {verificationPoints[activePin - 1].gdt}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Slider Instructions & Quick Click Tabs */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between text-sm text-slate-700 gap-3">
        <span className="font-serif">
          ↔ Drag slider horizontally to compare nominal CAD topology vs. CNC surface toolmarks.
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSliderPos(0)}
            className="px-3 py-1 rounded-lg bg-[#e2e8f0] hover:bg-white text-slate-800 border border-[#b8c6d4] font-sans text-xs font-semibold cursor-pointer shadow-xs"
          >
            Physical 100%
          </button>
          <button
            onClick={() => setSliderPos(50)}
            className="px-3 py-1 rounded-lg bg-[#e2e8f0] hover:bg-white text-slate-800 border border-[#b8c6d4] font-sans text-xs font-semibold cursor-pointer shadow-xs"
          >
            50/50 Split
          </button>
          <button
            onClick={() => setSliderPos(100)}
            className="px-3 py-1 rounded-lg bg-[#e2e8f0] hover:bg-white text-slate-800 border border-[#b8c6d4] font-sans text-xs font-semibold cursor-pointer shadow-xs"
          >
            CAD 100%
          </button>
        </div>
      </div>
    </div>
  );
};
