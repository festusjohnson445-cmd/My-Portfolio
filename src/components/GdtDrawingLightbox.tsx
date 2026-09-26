import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize, FileCheck, Info, CheckCircle } from 'lucide-react';

interface GdtDrawingProps {
  drawingNo?: string;
  revision?: string;
  partName?: string;
}

export const GdtDrawingLightbox: React.FC<GdtDrawingProps> = ({
  drawingNo = 'DWG-7075-AM-REV-D',
  revision = 'REV D',
  partName = 'AeroMount-7075 Gimbal Yoke',
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panPos, setPanPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedCallout, setSelectedCallout] = useState<string | null>('pos-bore');

  const handleZoomIn = () => setZoomLevel((z) => Math.min(3.0, z + 0.25));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(0.75, z - 0.25));
  const handleReset = () => {
    setZoomLevel(1);
    setPanPos({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsPanning(true);
    setStartPan({ x: e.clientX - panPos.x, y: e.clientY - panPos.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanPos({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  return (
    <div className="w-full bg-[#edf2f8] rounded-2xl border border-[#b8c6d4] p-5 sm:p-7 shadow-sm space-y-4 font-serif">
      {/* Header and Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-cyan-800" />
            <span className="text-xs sm:text-sm font-sans font-bold text-cyan-900 uppercase tracking-wider">
              ASME Y14.5-2018 Engineering Drawing
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-950 mt-1">
            2D Manufacturing Blueprint Inspection Lightbox
          </h3>
          <p className="text-sm sm:text-base text-slate-700">
            {partName} · Drawing No: <span className="font-mono text-cyan-900 font-semibold">{drawingNo}</span> ({revision})
          </p>
        </div>

        {/* Zoom & Pan Controls */}
        <div className="flex items-center gap-2 bg-[#e2e8f0] p-1.5 rounded-lg border border-[#b8c6d4] font-sans text-xs">
          <button
            onClick={handleZoomIn}
            className="p-2 rounded text-slate-700 hover:text-slate-950 hover:bg-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="w-14 text-center font-bold text-slate-900 tabular-nums text-xs">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={handleZoomOut}
            className="p-2 rounded text-slate-700 hover:text-slate-950 hover:bg-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded text-slate-700 hover:text-slate-950 hover:bg-white transition-colors cursor-pointer"
            title="Reset View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Blueprint Canvas Lightbox Area */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative w-full h-[450px] sm:h-[540px] bg-[#07192f] rounded-xl border-2 border-cyan-800/80 overflow-hidden shadow-md select-none ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        } bg-blueprint-grid`}
      >
        {/* SVG Drawing Group scaled & translated */}
        <div
          style={{
            transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
          }}
          className="w-full h-full flex items-center justify-center p-4"
        >
          <svg
            viewBox="0 0 1000 680"
            className="w-[960px] h-[640px] drop-shadow-lg"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.5"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer Drawing Border per ASME Standard */}
            <rect x="20" y="20" width="960" height="640" stroke="#38bdf8" strokeWidth="2.5" fill="none" />
            <rect x="28" y="28" width="944" height="624" stroke="#0284c7" strokeWidth="1" strokeDasharray="6,4" fill="none" />

            {/* Grid Coordinates (A-D, 1-8) */}
            <text x="500" y="24" fill="#0284c7" fontSize="10" fontFamily="monospace" textAnchor="middle">C</text>
            <text x="24" y="340" fill="#0284c7" fontSize="10" fontFamily="monospace" textAnchor="middle">2</text>
            <text x="976" y="340" fill="#0284c7" fontSize="10" fontFamily="monospace" textAnchor="middle">2</text>

            {/* Title Block (Bottom-Right) */}
            <g transform="translate(620, 500)">
              <rect x="0" y="0" width="340" height="144" stroke="#38bdf8" strokeWidth="2" fill="#051428" />
              <line x1="0" y1="28" x2="340" y2="28" stroke="#38bdf8" strokeWidth="1" />
              <line x1="0" y1="56" x2="340" y2="56" stroke="#38bdf8" strokeWidth="1" />
              <line x1="0" y1="84" x2="340" y2="84" stroke="#38bdf8" strokeWidth="1" />
              <line x1="0" y1="112" x2="340" y2="112" stroke="#38bdf8" strokeWidth="1" />
              <line x1="160" y1="0" x2="160" y2="84" stroke="#38bdf8" strokeWidth="1" />

              <text x="10" y="18" fill="#7dd3fc" fontSize="10" fontFamily="monospace">DWG NO: DWG-7075-AM</text>
              <text x="170" y="18" fill="#38bdf8" fontSize="10" fontFamily="monospace" fontWeight="bold">REV: D</text>
              <text x="10" y="46" fill="#7dd3fc" fontSize="10" fontFamily="monospace">MATERIAL: 7075-T6 AL</text>
              <text x="170" y="46" fill="#7dd3fc" fontSize="10" fontFamily="monospace">UNITS: mm [INCH REF]</text>
              <text x="10" y="74" fill="#7dd3fc" fontSize="10" fontFamily="monospace">DESIGNER: F. JOHNSON</text>
              <text x="170" y="74" fill="#7dd3fc" fontSize="10" fontFamily="monospace">CHECKED: G. VANCE, PE</text>
              <text x="10" y="102" fill="#38bdf8" fontSize="11" fontFamily="sans-serif" fontWeight="bold">AEROMOUNT 5-AXIS GIMBAL YOKE</text>
              <text x="10" y="130" fill="#94a3b8" fontSize="9" fontFamily="monospace">CONFIDENTIAL · ASME Y14.5-2018 · SCALE 1:1</text>
            </g>

            {/* General Tolerance Block (Top-Right) */}
            <g transform="translate(680, 40)">
              <rect x="0" y="0" width="280" height="74" stroke="#0284c7" strokeWidth="1" fill="#051428" />
              <text x="10" y="18" fill="#38bdf8" fontSize="9" fontFamily="monospace" fontWeight="bold">UNLESS OTHERWISE SPECIFIED:</text>
              <text x="10" y="34" fill="#94a3b8" fontSize="9" fontFamily="monospace">TOLERANCES: .X ±0.2 | .XX ±0.05</text>
              <text x="10" y="48" fill="#94a3b8" fontSize="9" fontFamily="monospace">ANGLES: ±0.25° | MACHINED SURFACES: Ra 1.6</text>
              <text x="10" y="62" fill="#38bdf8" fontSize="9" fontFamily="monospace">THIRD ANGLE PROJECTION: (⨁ ⏢)</text>
            </g>

            {/* PART GEOMETRY - Orthographic Section View A-A */}
            {/* Centerline Crosshairs */}
            <line x1="280" y1="80" x2="280" y2="460" stroke="#0284c7" strokeDasharray="16,4,4,4" strokeWidth="1" />
            <line x1="120" y1="260" x2="440" y2="260" stroke="#0284c7" strokeDasharray="16,4,4,4" strokeWidth="1" />

            {/* Main Gimbal Yoke Contours */}
            {/* Primary Azimuth Base (Datum A) */}
            <rect x="180" y="360" width="200" height="42" fill="#0e3a66" stroke="#38bdf8" strokeWidth="2" />
            {/* Left Fork Arm */}
            <path d="M 180 360 L 180 160 Q 180 130 210 130 L 225 130 L 225 360 Z" fill="#0e3a66" stroke="#38bdf8" strokeWidth="2" />
            {/* Right Fork Arm */}
            <path d="M 380 360 L 380 160 Q 380 130 350 130 L 335 130 L 335 360 Z" fill="#0e3a66" stroke="#38bdf8" strokeWidth="2" />

            {/* Bearing Bores (Datum B and Trunnion Pivots) */}
            <circle cx="280" cy="381" r="21" fill="#051428" stroke="#38bdf8" strokeWidth="2" />
            <circle cx="280" cy="381" r="16" fill="#081b33" stroke="#0284c7" strokeWidth="1.5" strokeDasharray="4,3" />

            {/* Trunnion Left Bearing Bore */}
            <circle cx="202" cy="180" r="14" fill="#051428" stroke="#38bdf8" strokeWidth="2" />
            {/* Trunnion Right Bearing Bore */}
            <circle cx="358" cy="180" r="14" fill="#051428" stroke="#38bdf8" strokeWidth="2" />

            {/* Dimension Lines */}
            <line x1="180" y1="430" x2="380" y2="430" stroke="#38bdf8" strokeWidth="1" />
            <line x1="180" y1="410" x2="180" y2="440" stroke="#0284c7" strokeWidth="1" />
            <line x1="380" y1="410" x2="380" y2="440" stroke="#0284c7" strokeWidth="1" />
            <text x="280" y="425" fill="#38bdf8" fontSize="12" fontFamily="monospace" textAnchor="middle" fontWeight="bold">200.00 ±0.10</text>

            {/* Center Bore Ø42.000 +0.008/-0.000 */}
            <line x1="280" y1="381" x2="480" y2="350" stroke="#38bdf8" strokeWidth="1" />
            <text x="490" y="345" fill="#7dd3fc" fontSize="12" fontFamily="monospace" fontWeight="bold">
              Ø42.000 +0.008/-0.000
            </text>

            {/* GD&T Feature Control Frame: Center Pilot Bore Position */}
            <g
              transform="translate(490, 355)"
              onClick={() => setSelectedCallout('pos-bore')}
              className="cursor-pointer hover:opacity-80"
            >
              <rect x="0" y="0" width="220" height="26" fill="#051428" stroke="#38bdf8" strokeWidth="1.8" />
              <line x1="30" y1="0" x2="30" y2="26" stroke="#38bdf8" />
              <line x1="120" y1="0" x2="120" y2="26" stroke="#38bdf8" />
              <line x1="150" y1="0" x2="150" y2="26" stroke="#38bdf8" />
              <line x1="185" y1="0" x2="185" y2="26" stroke="#38bdf8" />

              <text x="15" y="18" fill="#38bdf8" fontSize="14" textAnchor="middle">⌖</text>
              <text x="75" y="17" fill="#38bdf8" fontSize="11" fontFamily="monospace" textAnchor="middle">Ø 0.012 Ⓜ</text>
              <text x="135" y="17" fill="#38bdf8" fontSize="11" fontFamily="monospace" textAnchor="middle">A</text>
              <text x="167" y="17" fill="#38bdf8" fontSize="11" fontFamily="monospace" textAnchor="middle">B Ⓜ</text>
              <text x="202" y="17" fill="#38bdf8" fontSize="11" fontFamily="monospace" textAnchor="middle">C</text>
            </g>

            {/* DATUM -A- (Bottom Mounting Flange) */}
            <g
              transform="translate(250, 445)"
              onClick={() => setSelectedCallout('datum-a')}
              className="cursor-pointer hover:opacity-80"
            >
              <line x1="30" y1="-43" x2="30" y2="-12" stroke="#38bdf8" strokeWidth="1.5" />
              <polygon points="30,-43 25,-32 35,-32" fill="#38bdf8" />
              <rect x="15" y="-12" width="30" height="24" fill="#051428" stroke="#38bdf8" strokeWidth="1.8" />
              <text x="30" y="4" fill="#38bdf8" fontSize="12" fontFamily="monospace" textAnchor="middle" fontWeight="bold">-A-</text>
            </g>

            {/* GD&T Feature Control Frame: Flatness of Datum A */}
            <g
              transform="translate(140, 480)"
              onClick={() => setSelectedCallout('flatness')}
              className="cursor-pointer hover:opacity-80"
            >
              <line x1="90" y1="0" x2="90" y2="-38" stroke="#38bdf8" strokeWidth="1" />
              <rect x="0" y="0" width="120" height="24" fill="#051428" stroke="#38bdf8" strokeWidth="1.5" />
              <line x1="30" y1="0" x2="30" y2="24" stroke="#38bdf8" />
              <text x="15" y="17" fill="#38bdf8" fontSize="14" textAnchor="middle">⏥</text>
              <text x="75" y="16" fill="#38bdf8" fontSize="11" fontFamily="monospace" textAnchor="middle">0.008</text>
            </g>

            {/* DATUM -B- (Center Pilot Bore Diameter) */}
            <g
              transform="translate(420, 240)"
              onClick={() => setSelectedCallout('datum-b')}
              className="cursor-pointer hover:opacity-80"
            >
              <line x1="0" y1="20" x2="-80" y2="120" stroke="#38bdf8" strokeWidth="1" />
              <rect x="0" y="8" width="30" height="24" fill="#051428" stroke="#38bdf8" strokeWidth="1.8" />
              <text x="15" y="24" fill="#38bdf8" fontSize="12" fontFamily="monospace" textAnchor="middle" fontWeight="bold">-B-</text>
            </g>

            {/* GD&T Feature Control Frame: Perpendicularity of Trunnion to A */}
            <g
              transform="translate(80, 110)"
              onClick={() => setSelectedCallout('perp')}
              className="cursor-pointer hover:opacity-80"
            >
              <line x1="120" y1="30" x2="160" y2="50" stroke="#38bdf8" strokeWidth="1" />
              <rect x="0" y="0" width="130" height="24" fill="#051428" stroke="#38bdf8" strokeWidth="1.5" />
              <line x1="30" y1="0" x2="30" y2="24" stroke="#38bdf8" />
              <line x1="90" y1="0" x2="90" y2="24" stroke="#38bdf8" />
              <text x="15" y="17" fill="#38bdf8" fontSize="14" textAnchor="middle">⟂</text>
              <text x="60" y="16" fill="#38bdf8" fontSize="11" fontFamily="monospace" textAnchor="middle">0.015</text>
              <text x="110" y="16" fill="#38bdf8" fontSize="11" fontFamily="monospace" textAnchor="middle">A</text>
            </g>

            {/* Surface Finish Symbol Ra 0.8 */}
            <g
              transform="translate(180, 210)"
              onClick={() => setSelectedCallout('finish')}
              className="cursor-pointer hover:opacity-80"
            >
              <path d="M 0 16 L 8 0 L 22 0" stroke="#38bdf8" strokeWidth="1.5" fill="none" />
              <text x="12" y="-4" fill="#38bdf8" fontSize="9" fontFamily="monospace">Ra 0.8</text>
            </g>
          </svg>
        </div>

        {/* Blueprint watermark indicator */}
        <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-sans text-cyan-300 border border-cyan-800 shadow">
          Click any GD&amp;T callout box to inspect tolerance mechanics
        </div>
      </div>

      {/* Selected Callout Analysis Explainer Box */}
      <div className="bg-[#f4f7fb] rounded-xl p-5 border border-[#b8c6d4] text-sm sm:text-base space-y-2 shadow-xs text-slate-800">
        {selectedCallout === 'pos-bore' && (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-cyan-900 font-bold font-sans">
              <span className="px-2.5 py-1 rounded bg-cyan-100 border border-cyan-300 font-mono text-sm">
                [ ⌖ | Ø 0.012 Ⓜ | A | B Ⓜ | C ]
              </span>
              <span className="text-base">True Position at Maximum Material Condition (MMC)</span>
            </div>
            <p className="text-slate-700 mt-2 leading-relaxed">
              <strong className="text-slate-900">Engineering Justification:</strong> The bearing press bore must maintain concentricity with the optical line-of-sight. The Ⓜ (MMC) modifier is specified because as the bore departs from MMC (Ø42.000mm) toward Least Material Condition (Ø42.008mm), bonus tolerance equal to the size departure is unlocked without risking interference. This saved 32% in scrap rates during initial CNC roughing passes.
            </p>
          </div>
        )}

        {selectedCallout === 'flatness' && (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-cyan-900 font-bold font-sans">
              <span className="px-2.5 py-1 rounded bg-cyan-100 border border-cyan-300 font-mono text-sm">
                [ ⏥ | 0.008 ]
              </span>
              <span className="text-base">Primary Mounting Flange Flatness</span>
            </div>
            <p className="text-slate-700 mt-2 leading-relaxed">
              <strong className="text-slate-900">Engineering Justification:</strong> Restricts the mounting surface between two parallel planes 0.008mm apart. Prevents angular distortion or clamping strain from propagating into the optical azimuth encoder when torqued down with 4× M4 bolts at 2.8 N·m.
            </p>
          </div>
        )}

        {selectedCallout === 'perp' && (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-cyan-900 font-bold font-sans">
              <span className="px-2.5 py-1 rounded bg-cyan-100 border border-cyan-300 font-mono text-sm">
                [ ⟂ | 0.015 | A ]
              </span>
              <span className="text-base">Elevation Trunnion Perpendicularity to Datum A</span>
            </div>
            <p className="text-slate-700 mt-2 leading-relaxed">
              <strong className="text-slate-900">Engineering Justification:</strong> Controls the orthogonality of the elevation pitch axis relative to the base plane. Exceeding 0.015mm perpendicularity would induce cross-axis gimbal lock and tracking errors in airborne target tracking algorithms.
            </p>
          </div>
        )}

        {selectedCallout === 'finish' && (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-cyan-900 font-bold font-sans">
              <span className="px-2.5 py-1 rounded bg-cyan-100 border border-cyan-300 font-mono text-sm">
                [ ⎷ Ra 0.8 µm ]
              </span>
              <span className="text-base">Surface Roughness Finish</span>
            </div>
            <p className="text-slate-700 mt-2 leading-relaxed">
              <strong className="text-slate-900">Engineering Justification:</strong> Bearing outer race seats require Ra ≤ 0.8 µm (equivalent to N6 grinding or micro-milling) to prevent localized fretting corrosion and micro-asperity collapse under high-g flight vibrations.
            </p>
          </div>
        )}

        {selectedCallout === 'datum-a' && (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-cyan-900 font-bold font-sans">
              <span className="px-2.5 py-1 rounded bg-cyan-100 border border-cyan-300 font-mono text-sm">-A-</span>
              <span className="text-base">Primary Azimuth Mounting Flange Datum</span>
            </div>
            <p className="text-slate-700 mt-2 leading-relaxed">
              <strong className="text-slate-900">Engineering Justification:</strong> Primary datum arresting 3 degrees of freedom (Z translation, pitch rotation, roll rotation). Established first in CNC fixture setup using precision vacuum chuck clamping.
            </p>
          </div>
        )}

        {selectedCallout === 'datum-b' && (
          <div>
            <div className="flex flex-wrap items-center gap-2 text-cyan-900 font-bold font-sans">
              <span className="px-2.5 py-1 rounded bg-cyan-100 border border-cyan-300 font-mono text-sm">-B-</span>
              <span className="text-base">Secondary Pilot Center Bore Datum</span>
            </div>
            <p className="text-slate-700 mt-2 leading-relaxed">
              <strong className="text-slate-900">Engineering Justification:</strong> Secondary datum arresting X and Y radial translations. Serves as the central origin for all polar coordinate hole placements.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
