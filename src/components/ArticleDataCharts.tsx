import React, { useMemo, useState } from 'react';
import { BarChart3, Table as TableIcon } from 'lucide-react';
import type { ArticleChartData, ArticleChartVisualType } from '../utils/portfolioSupabase';

interface ArticleDataChartsProps {
  chartData: ArticleChartData[];
}

const CHART_CATEGORIES: { id: ArticleChartVisualType; label: string }[] = [
  { id: 'bar', label: 'Bar Chart' },
  { id: 'histogram', label: 'Histogram' },
  { id: 'scatter', label: 'Scatter Diagram' },
  { id: 'pie', label: 'Pie Chart' },
  { id: 'line', label: 'Graphic Rep.' },
];

const SERIES_PALETTE = [
  '#0e7490',
  '#1d4ed8',
  '#0f766e',
  '#b45309',
  '#be123c',
  '#4338ca',
  '#047857',
  '#7c2d12',
];

function formatSignedValue(val: number, unit?: string): string {
  if (!Number.isFinite(val)) return `0${unit ? ` ${unit}` : ''}`;
  const formatted = Number.isInteger(val)
    ? val.toLocaleString()
    : val.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${formatted}${unit ? ` ${unit}` : ''}`;
}

function niceAxisTicks(minVal: number, maxVal: number, count = 5): number[] {
  const safeMin = Math.min(minVal, 0);
  const safeMax = Math.max(maxVal, 0);
  const span = safeMax - safeMin || 1;
  const step = span / Math.max(1, count - 1);
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) {
    ticks.push(safeMin + step * i);
  }
  if (!ticks.some((t) => Math.abs(t) < 1e-9) && safeMin < 0 && safeMax > 0) {
    ticks.push(0);
    ticks.sort((a, b) => a - b);
  }
  return ticks;
}

function formatAxisTick(n: number): string {
  if (Math.abs(n) < 1e-9) return '0';
  if (Math.abs(n) >= 1000) return Math.round(n).toLocaleString();
  if (Math.abs(n) >= 10) return Number(n.toFixed(1)).toString();
  return Number(n.toFixed(2)).toString();
}

const SingleDatasetCard: React.FC<{ chart: ArticleChartData; index: number }> = ({
  chart,
  index,
}) => {
  const [selectedVisual, setSelectedVisual] = useState<ArticleChartVisualType>(
    chart.chartType || 'bar'
  );
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const items = chart.items || [];
  const hasExplicitX = items.some((pt) => typeof pt.xValue === 'number' && Number.isFinite(pt.xValue));
  const xHeading = (chart.xHeading || '').trim() || 'Metric / Parameter';
  const yHeading = (chart.yHeading || '').trim() || 'Value';

  const stats = useMemo(() => {
    if (items.length === 0) {
      return { total: 0, mean: 0, min: 0, max: 0, absSum: 1 };
    }
    const vals = items.map((i) => (Number.isFinite(Number(i.value)) ? Number(i.value) : 0));
    const total = vals.reduce((acc, v) => acc + v, 0);
    const absSum = vals.reduce((acc, v) => acc + Math.abs(v), 0) || 1;
    return {
      total,
      mean: total / vals.length,
      min: Math.min(...vals),
      max: Math.max(...vals),
      absSum,
    };
  }, [items]);

  // Histogram binning
  const histogramBins = useMemo(() => {
    if (items.length === 0) return [];
    const vals = items.map((i) => Number(i.value) || 0);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const binCount = Math.min(7, Math.max(3, Math.ceil(Math.sqrt(vals.length))));
    const range = maxV - minV;
    if (range === 0) {
      return [
        {
          label: formatAxisTick(minV),
          from: minV,
          to: maxV,
          count: vals.length,
        },
      ];
    }
    const width = range / binCount;
    const bins = Array.from({ length: binCount }, (_, bIdx) => {
      const from = minV + bIdx * width;
      const to = bIdx === binCount - 1 ? maxV : minV + (bIdx + 1) * width;
      return {
        label: `${formatAxisTick(from)}–${formatAxisTick(to)}`,
        from,
        to,
        count: 0,
      };
    });
    for (const v of vals) {
      let idx = Math.floor((v - minV) / width);
      if (idx >= binCount) idx = binCount - 1;
      if (idx < 0) idx = 0;
      bins[idx].count += 1;
    }
    return bins;
  }, [items]);

  // Shared SVG geometry
  const W = 560;
  const H = 260;
  const PAD_L = 54;
  const PAD_R = 20;
  const PAD_T = 22;
  const PAD_B = 48;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const minSigned = Math.min(0, stats.min);
  const maxSigned = Math.max(0, stats.max);
  const valueSpan = maxSigned - minSigned || 1;
  const yTicks = niceAxisTicks(minSigned, maxSigned, 5);
  const valToY = (v: number) => PAD_T + ((maxSigned - v) / valueSpan) * plotH;
  const zeroY = valToY(0);

  return (
    <div
      data-testid={`article-chart-card-${index}`}
      className="w-full rounded-xl bg-white border border-[#b8c6d4] shadow-2xs overflow-hidden"
    >
      {/* Dataset Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-[#edf2f8] border-b border-[#b8c6d4]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[11px] font-mono font-bold text-cyan-900 tabular-nums shrink-0">
            {String(index + 1).padStart(2, '0')}.
          </span>
          <h3 className="text-xs sm:text-sm font-bold text-slate-950 truncate">
            {chart.title || 'Engineering Data'}
          </h3>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-600 shrink-0 tabular-nums">
          {chart.unit && (
            <span className="font-mono font-bold text-cyan-950">Unit: {chart.unit}</span>
          )}
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="font-semibold">{items.length} entries</span>
        </div>
      </div>

      {/* Two Structured Sub-Sections: 1. Data Table | 2. Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
        {/* SECTION 1: DATA TABLE */}
        <div className="lg:col-span-5 p-3.5 space-y-2.5 bg-white">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <TableIcon className="w-3.5 h-3.5 text-cyan-800" />
              <span>Data Table</span>
            </h4>
            <span className="text-[10.5px] text-slate-500 font-mono">Signed (+/-)</span>
          </div>

          <div className="w-full overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-[11.5px] text-left border-collapse">
              <thead className="bg-slate-50 text-slate-800 border-b border-slate-200 font-bold">
                <tr>
                  <th className="px-2.5 py-2 w-9 text-center">#</th>
                  <th className="px-2.5 py-2">{xHeading}</th>
                  {hasExplicitX && (
                    <th className="px-2.5 py-2 text-right font-mono">X</th>
                  )}
                  <th className="px-2.5 py-2 text-right">
                    {yHeading}
                    {chart.unit ? ` (${chart.unit})` : ''}
                  </th>
                  <th className="px-2.5 py-2 text-right w-16">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((pt, pIdx) => {
                  const val = Number(pt.value) || 0;
                  const sharePct = Math.round((Math.abs(val) / stats.absSum) * 1000) / 10;
                  const isNeg = val < 0;
                  const isPos = val > 0;
                  const isHovered = hoverIdx === pIdx;
                  return (
                    <tr
                      key={pIdx}
                      onMouseEnter={() => setHoverIdx(pIdx)}
                      onMouseLeave={() => setHoverIdx(null)}
                      className={`transition-colors ${isHovered ? 'bg-cyan-50/70' : 'hover:bg-slate-50/80'}`}
                    >
                      <td className="px-2.5 py-1.5 text-center font-mono text-slate-500 tabular-nums">
                        {pIdx + 1}
                      </td>
                      <td className="px-2.5 py-1.5 font-medium text-slate-900 break-words">
                        {pt.label || `Item ${pIdx + 1}`}
                      </td>
                      {hasExplicitX && (
                        <td className="px-2.5 py-1.5 text-right font-mono text-slate-700 tabular-nums">
                          {typeof pt.xValue === 'number' ? formatAxisTick(pt.xValue) : pIdx + 1}
                        </td>
                      )}
                      <td
                        className={`px-2.5 py-1.5 text-right font-mono font-bold tabular-nums whitespace-nowrap ${
                          isNeg
                            ? 'text-rose-700'
                            : isPos
                            ? 'text-cyan-950'
                            : 'text-slate-600'
                        }`}
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          {isNeg && <span aria-hidden="true" className="text-[9px]">▼</span>}
                          {isPos && <span aria-hidden="true" className="text-[9px]">▲</span>}
                          <span>{formatSignedValue(val)}</span>
                        </span>
                      </td>
                      <td className="px-2.5 py-1.5 text-right font-mono text-slate-600 tabular-nums">
                        {sharePct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Row */}
          <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10.5px] font-mono tabular-nums">
            <div className="px-2 py-1 rounded bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Total</div>
              <div className="font-bold text-slate-900 truncate">{formatSignedValue(stats.total)}</div>
            </div>
            <div className="px-2 py-1 rounded bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Mean</div>
              <div className="font-bold text-slate-900 truncate">
                {formatSignedValue(Number(stats.mean.toFixed(2)))}
              </div>
            </div>
            <div className="px-2 py-1 rounded bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Min</div>
              <div className={`font-bold truncate ${stats.min < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                {formatSignedValue(stats.min)}
              </div>
            </div>
            <div className="px-2 py-1 rounded bg-slate-50 border border-slate-200">
              <div className="text-slate-500">Max</div>
              <div className="font-bold text-cyan-950 truncate">{formatSignedValue(stats.max)}</div>
            </div>
          </div>
        </div>

        {/* SECTION 2: VISUALIZATIONS */}
        <div className="lg:col-span-7 p-3.5 space-y-3 bg-slate-50/40 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-cyan-800" />
              <span>Visualization</span>
            </h4>
            <div
              role="tablist"
              aria-label="Chart visualization mode"
              className="flex flex-wrap items-center gap-1 p-0.5 rounded-lg bg-slate-200/75 border border-slate-300/80"
            >
              {CHART_CATEGORIES.map((cat) => {
                const active = selectedVisual === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedVisual(cat.id)}
                    className={`px-2 py-1 rounded-md text-[10.5px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-white text-cyan-950 shadow-2xs border border-slate-300'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chart Canvas Container */}
          <div className="w-full rounded-lg bg-white border border-slate-200 p-2.5 sm:p-3">
            {/* 1. BAR CHART (supports negative & positive bars cleanly around 0 axis) */}
            {selectedVisual === 'bar' && (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto max-h-[290px] overflow-visible font-mono"
                role="img"
                aria-label={`${chart.title} bar chart`}
              >
                {yTicks.map((t, idx) => {
                  const y = valToY(t);
                  const isZero = Math.abs(t) < 1e-9;
                  return (
                    <g key={idx}>
                      <line
                        x1={PAD_L}
                        x2={W - PAD_R}
                        y1={y}
                        y2={y}
                        stroke={isZero ? '#334155' : '#e2e8f0'}
                        strokeWidth={isZero ? 1.4 : 1}
                        strokeDasharray={isZero ? undefined : '3 3'}
                      />
                      <text
                        x={PAD_L - 8}
                        y={y + 3.5}
                        textAnchor="end"
                        className="fill-slate-500 text-[10px]"
                      >
                        {formatAxisTick(t)}
                      </text>
                    </g>
                  );
                })}

                {items.map((pt, idx) => {
                  const slotW = plotW / Math.max(1, items.length);
                  const barW = Math.min(46, Math.max(12, slotW * 0.56));
                  const cx = PAD_L + idx * slotW + slotW / 2;
                  const val = Number(pt.value) || 0;
                  const yVal = valToY(val);
                  const topY = val >= 0 ? yVal : zeroY;
                  const barH = Math.max(2, Math.abs(zeroY - yVal));
                  const isNeg = val < 0;
                  const shortLbl =
                    (pt.label || `${idx + 1}`).length > 10
                      ? `${(pt.label || `${idx + 1}`).slice(0, 9)}…`
                      : pt.label || `${idx + 1}`;
                  return (
                    <g
                      key={idx}
                      onMouseEnter={() => setHoverIdx(idx)}
                      onMouseLeave={() => setHoverIdx(null)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={cx - barW / 2}
                        y={topY}
                        width={barW}
                        height={barH}
                        rx={3}
                        fill={isNeg ? '#be123c' : '#0e7490'}
                        opacity={hoverIdx === null || hoverIdx === idx ? 0.92 : 0.45}
                      />
                      <text
                        x={cx}
                        y={isNeg ? topY + barH + 11 : topY - 5}
                        textAnchor="middle"
                        className={`text-[9.5px] font-bold ${isNeg ? 'fill-rose-800' : 'fill-slate-800'}`}
                      >
                        {formatAxisTick(val)}
                      </text>
                      <text
                        x={cx}
                        y={H - 12}
                        textAnchor="middle"
                        className="fill-slate-600 text-[9.5px]"
                      >
                        {shortLbl}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* 2. HISTOGRAM (frequency distribution bins) */}
            {selectedVisual === 'histogram' && (() => {
              const maxFreq = Math.max(1, ...histogramBins.map((b) => b.count));
              const freqTicks = [0, Math.ceil(maxFreq / 2), maxFreq];
              return (
                <div className="space-y-1.5">
                  <svg
                    viewBox={`0 0 ${W} ${H}`}
                    className="w-full h-auto max-h-[270px] overflow-visible font-mono"
                    role="img"
                    aria-label={`${chart.title} histogram`}
                  >
                    {freqTicks.map((f, idx) => {
                      const y = PAD_T + plotH - (f / maxFreq) * plotH;
                      return (
                        <g key={idx}>
                          <line
                            x1={PAD_L}
                            x2={W - PAD_R}
                            y1={y}
                            y2={y}
                            stroke={f === 0 ? '#334155' : '#e2e8f0'}
                            strokeWidth={f === 0 ? 1.4 : 1}
                            strokeDasharray={f === 0 ? undefined : '3 3'}
                          />
                          <text x={PAD_L - 8} y={y + 3.5} textAnchor="end" className="fill-slate-500 text-[10px]">
                            {f}
                          </text>
                        </g>
                      );
                    })}
                    <text
                      x={14}
                      y={PAD_T + plotH / 2}
                      textAnchor="middle"
                      transform={`rotate(-90 14 ${PAD_T + plotH / 2})`}
                      className="fill-slate-500 text-[9.5px]"
                    >
                      Frequency
                    </text>

                    {histogramBins.map((bin, bIdx) => {
                      const binW = plotW / Math.max(1, histogramBins.length);
                      const bx = PAD_L + bIdx * binW;
                      const bh = (bin.count / maxFreq) * plotH;
                      const by = PAD_T + plotH - bh;
                      return (
                        <g key={bIdx}>
                          <rect
                            x={bx + 1}
                            y={by}
                            width={Math.max(4, binW - 2)}
                            height={Math.max(1, bh)}
                            fill="#0e7490"
                            fillOpacity={0.85}
                            stroke="#ffffff"
                            strokeWidth={1}
                          />
                          <text
                            x={bx + binW / 2}
                            y={Math.max(12, by - 5)}
                            textAnchor="middle"
                            className="fill-slate-900 text-[10px] font-bold"
                          >
                            {bin.count}
                          </text>
                          <text
                            x={bx + binW / 2}
                            y={H - 12}
                            textAnchor="middle"
                            className="fill-slate-600 text-[9px]"
                          >
                            {bin.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  <p className="text-[10.5px] text-slate-500 text-center">
                    Frequency distribution across {histogramBins.length} value intervals{chart.unit ? ` (${chart.unit})` : ''}
                  </p>
                </div>
              );
            })()}

            {/* 3. SCATTER DIAGRAM */}
            {selectedVisual === 'scatter' && (() => {
              const xVals = items.map((pt, idx) =>
                typeof pt.xValue === 'number' && Number.isFinite(pt.xValue) ? pt.xValue : idx + 1
              );
              const xMin = Math.min(...xVals);
              const xMax = Math.max(...xVals);
              const xSpan = xMax - xMin || 1;
              const xToPx = (xv: number) =>
                items.length === 1
                  ? PAD_L + plotW / 2
                  : PAD_L + ((xv - xMin) / xSpan) * (plotW - 24) + 12;
              return (
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="w-full h-auto max-h-[290px] overflow-visible font-mono"
                  role="img"
                  aria-label={`${chart.title} scatter diagram`}
                >
                  {yTicks.map((t, idx) => {
                    const y = valToY(t);
                    const isZero = Math.abs(t) < 1e-9;
                    return (
                      <g key={idx}>
                        <line
                          x1={PAD_L}
                          x2={W - PAD_R}
                          y1={y}
                          y2={y}
                          stroke={isZero ? '#334155' : '#e2e8f0'}
                          strokeWidth={isZero ? 1.4 : 1}
                          strokeDasharray={isZero ? undefined : '3 3'}
                        />
                        <text x={PAD_L - 8} y={y + 3.5} textAnchor="end" className="fill-slate-500 text-[10px]">
                          {formatAxisTick(t)}
                        </text>
                      </g>
                    );
                  })}

                  {items.map((pt, idx) => {
                    const xv = xVals[idx];
                    const yv = Number(pt.value) || 0;
                    const px = xToPx(xv);
                    const py = valToY(yv);
                    const color = yv < 0 ? '#be123c' : '#0e7490';
                    const isActive = hoverIdx === idx;
                    return (
                      <g
                        key={idx}
                        onMouseEnter={() => setHoverIdx(idx)}
                        onMouseLeave={() => setHoverIdx(null)}
                        className="cursor-pointer"
                      >
                        <line
                          x1={px}
                          x2={px}
                          y1={zeroY}
                          y2={py}
                          stroke={color}
                          strokeOpacity={0.25}
                          strokeDasharray="2 2"
                        />
                        <circle
                          cx={px}
                          cy={py}
                          r={isActive ? 6.5 : 5}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                        />
                        <text
                          x={px}
                          y={py - 9}
                          textAnchor="middle"
                          className="fill-slate-800 text-[9px] font-bold"
                        >
                          {formatAxisTick(yv)}
                        </text>
                        <text
                          x={px}
                          y={H - 12}
                          textAnchor="middle"
                          className="fill-slate-600 text-[9px]"
                        >
                          {hasExplicitX ? formatAxisTick(xv) : (pt.label || `#${idx + 1}`).slice(0, 8)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            })()}

            {/* 4. PIE CHART (donut proportional magnitude + signed legend) */}
            {selectedVisual === 'pie' && (() => {
              const cx = 125;
              const cy = 120;
              const r = 88;
              const innerR = 42;
              let startAngle = -Math.PI / 2;
              const slices = items.map((pt, idx) => {
                const mag = Math.abs(Number(pt.value) || 0);
                const frac = mag / stats.absSum;
                const angle = frac * Math.PI * 2;
                const endAngle = startAngle + angle;
                const x1 = cx + r * Math.cos(startAngle);
                const y1 = cy + r * Math.sin(startAngle);
                const x2 = cx + r * Math.cos(endAngle);
                const y2 = cy + r * Math.sin(endAngle);
                const ix1 = cx + innerR * Math.cos(endAngle);
                const iy1 = cy + innerR * Math.sin(endAngle);
                const ix2 = cx + innerR * Math.cos(startAngle);
                const iy2 = cy + innerR * Math.sin(startAngle);
                const largeArc = angle > Math.PI ? 1 : 0;
                const d =
                  frac >= 0.999
                    ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
                    : `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2} Z`;
                startAngle = endAngle;
                return {
                  d,
                  color: SERIES_PALETTE[idx % SERIES_PALETTE.length],
                  frac,
                  pt,
                  idx,
                };
              });

              return (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-6 flex items-center justify-center">
                    <svg viewBox="0 0 250 240" className="w-52 h-52">
                      {slices.map((sl) => (
                        <path
                          key={sl.idx}
                          d={sl.d}
                          fill={sl.color}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          opacity={hoverIdx === null || hoverIdx === sl.idx ? 1 : 0.45}
                          onMouseEnter={() => setHoverIdx(sl.idx)}
                          onMouseLeave={() => setHoverIdx(null)}
                          className="cursor-pointer transition-opacity"
                        />
                      ))}
                      <text
                        x={cx}
                        y={cy - 4}
                        textAnchor="middle"
                        className="fill-slate-500 text-[10px] font-sans"
                      >
                        Magnitude Sum
                      </text>
                      <text
                        x={cx}
                        y={cy + 12}
                        textAnchor="middle"
                        className="fill-slate-950 text-[12px] font-mono font-bold"
                      >
                        {formatAxisTick(stats.absSum)}
                      </text>
                    </svg>
                  </div>
                  <div className="sm:col-span-6 space-y-1.5 max-h-56 overflow-y-auto pr-1 text-[11px]">
                    {slices.map((sl) => (
                      <div
                        key={sl.idx}
                        onMouseEnter={() => setHoverIdx(sl.idx)}
                        onMouseLeave={() => setHoverIdx(null)}
                        className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-50 border border-slate-200"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: sl.color }}
                          />
                          <span className="truncate font-medium text-slate-800">
                            {sl.pt.label || `Item ${sl.idx + 1}`}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-900 shrink-0 tabular-nums">
                          {formatSignedValue(Number(sl.pt.value) || 0)} ({(sl.frac * 100).toFixed(1)}%)
                        </span>
                      </div>
                    ))}
                    {stats.min < 0 && (
                      <p className="text-[10px] text-slate-500 pt-0.5">
                        Pie segments reflect absolute magnitude share; signs are preserved in the table.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 5. GRAPHIC REPRESENTATION (Signed XY Curve + Zero Baseline + Area Fill) */}
            {selectedVisual === 'line' && (() => {
              const xVals = items.map((pt, idx) =>
                typeof pt.xValue === 'number' && Number.isFinite(pt.xValue) ? pt.xValue : idx + 1
              );
              const xMin = Math.min(...xVals);
              const xMax = Math.max(...xVals);
              const xSpan = xMax - xMin || 1;
              const pts = items.map((pt, idx) => {
                const px =
                  items.length === 1
                    ? PAD_L + plotW / 2
                    : PAD_L + ((xVals[idx] - xMin) / xSpan) * (plotW - 24) + 12;
                const val = Number(pt.value) || 0;
                const py = valToY(val);
                return { px, py, val, pt, idx };
              });
              const polyLine = pts.map((p) => `${p.px},${p.py}`).join(' ');
              const areaPath =
                pts.length > 1
                  ? `M ${pts[0].px} ${zeroY} ` +
                    pts.map((p) => `L ${p.px} ${p.py}`).join(' ') +
                    ` L ${pts[pts.length - 1].px} ${zeroY} Z`
                  : '';

              return (
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="w-full h-auto max-h-[290px] overflow-visible font-mono"
                  role="img"
                  aria-label={`${chart.title} graphic representation`}
                >
                  {yTicks.map((t, idx) => {
                    const y = valToY(t);
                    const isZero = Math.abs(t) < 1e-9;
                    return (
                      <g key={idx}>
                        <line
                          x1={PAD_L}
                          x2={W - PAD_R}
                          y1={y}
                          y2={y}
                          stroke={isZero ? '#0f172a' : '#e2e8f0'}
                          strokeWidth={isZero ? 1.5 : 1}
                          strokeDasharray={isZero ? undefined : '3 3'}
                        />
                        <text x={PAD_L - 8} y={y + 3.5} textAnchor="end" className="fill-slate-500 text-[10px]">
                          {formatAxisTick(t)}
                        </text>
                      </g>
                    );
                  })}

                  {areaPath && <path d={areaPath} fill="#0e7490" fillOpacity={0.12} />}
                  {pts.length > 1 && (
                    <polyline
                      fill="none"
                      stroke="#0e7490"
                      strokeWidth={2.25}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={polyLine}
                    />
                  )}
                  {pts.map((p) => (
                    <g
                      key={p.idx}
                      onMouseEnter={() => setHoverIdx(p.idx)}
                      onMouseLeave={() => setHoverIdx(null)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={p.px}
                        cy={p.py}
                        r={hoverIdx === p.idx ? 6 : 4.2}
                        fill={p.val < 0 ? '#be123c' : '#0e7490'}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                      <text
                        x={p.px}
                        y={p.val < 0 ? p.py + 14 : p.py - 8}
                        textAnchor="middle"
                        className={`text-[9.5px] font-bold ${p.val < 0 ? 'fill-rose-800' : 'fill-slate-900'}`}
                      >
                        {formatSignedValue(p.val)}
                      </text>
                      <text
                        x={p.px}
                        y={H - 12}
                        textAnchor="middle"
                        className="fill-slate-600 text-[9px]"
                      >
                        {(p.pt.label || `${p.idx + 1}`).slice(0, 9)}
                      </text>
                    </g>
                  ))}
                </svg>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
};

export const ArticleDataCharts: React.FC<ArticleDataChartsProps> = ({ chartData }) => {
  if (!chartData || chartData.length === 0) return null;
  return (
    <section id="article-charts" className="space-y-3 pt-2 border-t border-slate-200">
      <h2 className="text-sm font-bold text-slate-950 text-center flex items-center justify-center gap-1.5">
        <BarChart3 className="w-3.5 h-3.5 text-cyan-800" />
        <span>Data Charts &amp; Visualizations</span>
      </h2>
      <div className="space-y-4">
        {chartData.map((ch, cIdx) => (
          <SingleDatasetCard key={cIdx} chart={ch} index={cIdx} />
        ))}
      </div>
    </section>
  );
};
