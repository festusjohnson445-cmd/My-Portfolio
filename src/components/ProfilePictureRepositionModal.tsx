import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Move,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Info,
  Camera,
} from 'lucide-react';
import {
  LoadedImageDetails,
  executeAvatarPipeline,
  uploadOptimizedAvatarToSupabase,
} from '../utils/imagePipeline';

interface ProfilePictureRepositionModalProps {
  isOpen: boolean;
  imageDetails: LoadedImageDetails | null;
  onClose: () => void;
  onSuccess: (newAvatarUrl: string, previewDataUrl?: string) => void;
}

export const ProfilePictureRepositionModal: React.FC<ProfilePictureRepositionModalProps> = ({
  isOpen,
  imageDetails,
  onClose,
  onSuccess,
}) => {
  const [zoom, setZoom] = useState<number>(1.0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasPreviewRef = useRef<HTMLCanvasElement>(null);

  // Compact viewport size (260px) ensuring full middle-section visibility on all screens
  const VIEWPORT_SIZE = 260;

  // Initialize or reset framing when imageDetails changes
  const calculateDefaultFraming = useCallback(
    (mode: 'best-fit' | 'fill-square' = 'fill-square') => {
      if (!imageDetails) return;
      const { originalWidth, originalHeight } = imageDetails;

      if (mode === 'best-fit') {
        // Fits entire image inside the square viewport
        const fitScale = Math.min(VIEWPORT_SIZE / originalWidth, VIEWPORT_SIZE / originalHeight);
        const baseScale = Math.max(VIEWPORT_SIZE / originalWidth, VIEWPORT_SIZE / originalHeight);
        setZoom(Math.max(0.4, Number((fitScale / baseScale).toFixed(2))));
      } else {
        // Covers viewport fully centered on the middle section
        setZoom(1.0);
      }
      setOffset({ x: 0, y: 0 });
      setErrorMessage(null);
    },
    [imageDetails, VIEWPORT_SIZE]
  );

  useEffect(() => {
    if (isOpen && imageDetails) {
      setRotation(0);
      calculateDefaultFraming('fill-square');
    }
  }, [isOpen, imageDetails, calculateDefaultFraming]);

  // Live mini-preview rendering
  useEffect(() => {
    if (!isOpen || !imageDetails || !canvasPreviewRef.current) return;

    const canvas = canvasPreviewRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageDetails.image;
    const size = 120;
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, size, size);

    const naturalWidth = img.naturalWidth;
    const naturalHeight = img.naturalHeight;
    const baseScale = Math.max(VIEWPORT_SIZE / naturalWidth, VIEWPORT_SIZE / naturalHeight);
    const currentScale = baseScale * zoom;

    const scaledWidth = naturalWidth * currentScale;
    const scaledHeight = naturalHeight * currentScale;
    const destScale = size / VIEWPORT_SIZE;

    ctx.save();
    ctx.translate(size / 2, size / 2);
    if (rotation) {
      ctx.rotate((rotation * Math.PI) / 180);
    }
    ctx.translate(offset.x * destScale, offset.y * destScale);
    const drawW = scaledWidth * destScale;
    const drawH = scaledHeight * destScale;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }, [isOpen, imageDetails, zoom, offset, rotation, VIEWPORT_SIZE]);

  // Pointer/Mouse Drag Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      setIsDragging(false);
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Wheel zoom handler
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.min(3.5, Math.max(0.4, Number((prev + zoomDelta).toFixed(2)))));
  };

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Save & Upload through automated pipeline
  const handleSaveAndUpload = async () => {
    if (!imageDetails) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);

      // Step 1: Execute 500x500 crop, resize, and WebP @ 80% quality with rotation & offsets
      const processed = await executeAvatarPipeline(
        imageDetails.image,
        {
          offsetX: offset.x,
          offsetY: offset.y,
          zoom,
          viewportSize: VIEWPORT_SIZE,
          rotation,
        },
        500, // 500x500 retina resolution
        0.80 // 80% quality target
      );

      // Step 2: Upload WebP blob directly to Supabase storage bucket 'avatars'
      const uploadRes = await uploadOptimizedAvatarToSupabase(processed.webpBlob);

      if (!uploadRes.publicUrl) {
        throw new Error('Supabase Storage: Did not receive valid public avatar URL.');
      }

      // Step 3: Trigger callback with final Supabase public URL and instant local preview data URL
      onSuccess(uploadRes.publicUrl, processed.previewDataUrl);
      onClose();
    } catch (err: any) {
      console.error('[Avatar Pipeline Error]:', err);
      setErrorMessage(
        err?.message ||
          'Failed to process and upload avatar. Please verify your connection and Supabase storage permissions.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !imageDetails) return null;

  // Natural scaling math for UI display
  const naturalWidth = imageDetails.originalWidth;
  const naturalHeight = imageDetails.originalHeight;
  const baseScale = Math.max(VIEWPORT_SIZE / naturalWidth, VIEWPORT_SIZE / naturalHeight);
  const currentScale = baseScale * zoom;
  const displayW = naturalWidth * currentScale;
  const displayH = naturalHeight * currentScale;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header - Reduced text size and hidden subtitle */}
        <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-cyan-700 text-white flex items-center justify-center shadow-xs">
              <Camera className="w-3.5 h-3.5 text-cyan-100" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight">
              Position Profile Picture
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 overflow-y-auto space-y-3 flex-1 flex flex-col items-center">
          {/* Metadata Specs Pill - Reduced by 45% */}
          <div className="w-full flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg bg-cyan-50/70 border border-cyan-200 text-[9px] sm:text-[10px] text-cyan-950 leading-tight">
            <div className="flex items-center gap-1 font-medium truncate">
              <Info className="w-3 h-3 text-cyan-700 shrink-0" />
              <span className="truncate">
                Original: <strong className="font-bold">{naturalWidth} × {naturalHeight} px</strong> ({imageDetails.fileType})
              </span>
            </div>
            <div className="flex items-center gap-1 font-mono font-semibold text-cyan-800 bg-white px-1.5 py-0.5 rounded border border-cyan-300 shrink-0 text-[8.5px] sm:text-[9px]">
              <Sparkles className="w-2.5 h-2.5 text-cyan-600" />
              <span>Target: 500×500 px • WebP @ 80%</span>
            </div>
          </div>

          {/* Interactive Positioning Canvas & Framing Viewport - Full Middle Section Visible */}
          <div className="flex flex-col items-center justify-center select-none w-full">
            <div
              ref={containerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
              style={{ width: `${VIEWPORT_SIZE}px`, height: `${VIEWPORT_SIZE}px` }}
              className={`relative rounded-2xl overflow-hidden bg-slate-900 border-2 border-cyan-600/70 shadow-inner flex items-center justify-center touch-none ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
            >
              {/* Image element positioned, scaled, and rotated */}
              <img
                src={imageDetails.dataUrl}
                alt="Source for profile"
                draggable={false}
                style={{
                  width: `${displayW}px`,
                  height: `${displayH}px`,
                  transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
                  transition: isDragging ? 'none' : 'transform 0.05s ease-out',
                  maxWidth: 'none',
                }}
                className="pointer-events-none absolute"
              />

              {/* Circular Avatar Cutout Mask */}
              <div
                className="absolute inset-0 pointer-events-none rounded-2xl"
                style={{
                  boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.65)',
                }}
              />

              {/* Circular Boundary Ring */}
              <div className="absolute inset-3 rounded-full border border-white/80 pointer-events-none shadow-sm flex items-center justify-center">
                {/* 3x3 Rule of Thirds Guide Grid */}
                {showGrid && (
                  <div className="w-full h-full rounded-full overflow-hidden grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                    <div className="border-r border-b border-white/60" />
                    <div className="border-r border-b border-white/60" />
                    <div className="border-b border-white/60" />
                    <div className="border-r border-b border-white/60" />
                    <div className="border-r border-b border-white/60" />
                    <div className="border-b border-white/60" />
                    <div className="border-r border-b border-white/60" />
                    <div className="border-r border-b border-white/60" />
                    <div />
                  </div>
                )}
              </div>

              {/* Drag Indicator Overlay */}
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-white/90 text-[9px] font-sans font-medium flex items-center gap-1 pointer-events-none border border-white/20">
                <Move className="w-2.5 h-2.5" />
                <span>Drag to reposition</span>
              </div>
            </div>
          </div>

          {/* BASE OF VIEW SECTION: Zoom In/Out, Rotate, and Small Quick Fit Controls */}
          <div className="w-full space-y-2 pt-0.5">
            {/* Primary Controls Row: Zoom Out, Slider, Zoom In, Rotate, Grid Toggle */}
            <div className="flex items-center justify-between gap-1.5 p-1.5 rounded-xl bg-slate-50 border border-slate-200">
              {/* Zoom Controls */}
              <div className="flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.max(0.4, Number((prev - 0.1).toFixed(2))))}
                  className="w-6 h-6 rounded-md bg-white border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
                <input
                  type="range"
                  min="0.4"
                  max="3.0"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-700"
                />
                <button
                  type="button"
                  onClick={() => setZoom((prev) => Math.min(3.0, Number((prev + 0.1).toFixed(2))))}
                  className="w-6 h-6 rounded-md bg-white border border-slate-300 flex items-center justify-center text-slate-700 hover:bg-slate-100 cursor-pointer shadow-2xs"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
                <span className="font-mono text-cyan-800 font-bold text-[10px] w-8 text-right">
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              {/* Rotate Button (90 deg clockwise) */}
              <button
                type="button"
                onClick={handleRotate}
                className="px-2 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-300 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs shrink-0"
                title={`Rotate 90° (Current: ${rotation}°)`}
              >
                <RotateCw className="w-3 h-3 text-cyan-700" />
                <span>Rotate</span>
              </button>

              {/* Grid Toggle */}
              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`px-1.5 py-1 rounded-md text-[9.5px] font-semibold transition-colors cursor-pointer border shrink-0 ${
                  showGrid
                    ? 'bg-cyan-100/70 border-cyan-300 text-cyan-800'
                    : 'bg-white border-slate-300 text-slate-500'
                }`}
                title="Toggle alignment grid"
              >
                Grid
              </button>
            </div>

            {/* Quick Fit Controls Row (All small buttons) */}
            <div className="flex items-center justify-between gap-1 w-full">
              <button
                type="button"
                onClick={() => calculateDefaultFraming('fill-square')}
                className="flex-1 px-1.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer border border-slate-200"
                title="Fill square frame"
              >
                <Maximize2 className="w-2.5 h-2.5 text-cyan-700" />
                <span>Fill</span>
              </button>
              <button
                type="button"
                onClick={() => calculateDefaultFraming('best-fit')}
                className="flex-1 px-1.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer border border-slate-200"
                title="Fit full image in frame"
              >
                <Minimize2 className="w-2.5 h-2.5 text-cyan-700" />
                <span>Fit</span>
              </button>
              <button
                type="button"
                onClick={() => setOffset({ x: 0, y: 0 })}
                className="flex-1 px-1.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer border border-slate-200"
                title="Center position"
              >
                <Move className="w-2.5 h-2.5 text-slate-600" />
                <span>Center</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setRotation(0);
                  calculateDefaultFraming('fill-square');
                }}
                className="flex-1 px-1.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer border border-slate-200"
                title="Reset position, zoom and rotation"
              >
                <RotateCcw className="w-2.5 h-2.5 text-slate-600" />
                <span>Reset</span>
              </button>

              {/* Tiny Live Avatar Preview Badge */}
              <div className="w-7 h-7 rounded-full overflow-hidden border border-cyan-600 shadow-xs bg-white shrink-0 ml-1" title="Live Avatar Result">
                <canvas ref={canvasPreviewRef} className="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          {/* Error Message Banner */}
          {errorMessage && (
            <div className="w-full p-2 rounded-lg bg-rose-50 border border-rose-300 text-rose-800 text-[11px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions - Small Buttons, "Save & Upload", and hidden automated pipeline text */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveAndUpload}
            disabled={isProcessing}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-700 hover:bg-cyan-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5 text-cyan-200" />
                <span>Save &amp; Upload</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
