import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  MoreVertical,
  X,
  Download,
  Repeat,
} from 'lucide-react';
import { formatMediaDuration } from '../utils/mediaMetadata';

interface CustomVideoPlayerProps {
  src: string;
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
  zoomLevel?: number;
  sizeBoost?: boolean;
  className?: string;
}

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({
  src,
  aspectRatio = '16/9',
  objectFit = 'contain',
  zoomLevel = 1,
  sizeBoost = true,
  className = '',
}) => {
  const inlineVideoRef = useRef<HTMLVideoElement | null>(null);
  const fullVideoRef = useRef<HTMLVideoElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoop, setIsLoop] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [fullViewOpen, setFullViewOpen] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setMenuOpen(false);
    setFullViewOpen(false);
  }, [src]);

  useEffect(() => {
    const vid = fullViewOpen ? fullVideoRef.current : inlineVideoRef.current;
    if (vid) {
      vid.playbackRate = playbackRate;
      vid.muted = isMuted;
      vid.loop = isLoop;
    }
  }, [playbackRate, isMuted, isLoop, fullViewOpen]);

  useEffect(() => {
    if (!fullViewOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeFullView();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullViewOpen]);

  const togglePlay = () => {
    const vid = fullViewOpen ? fullVideoRef.current : inlineVideoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  };

  const openFullView = () => {
    const inlineVid = inlineVideoRef.current;
    const resumeTime = inlineVid ? inlineVid.currentTime : currentTime;
    const wasPlaying = inlineVid ? !inlineVid.paused : false;
    if (inlineVid && !inlineVid.paused) {
      inlineVid.pause();
    }
    setMenuOpen(false);
    setFullViewOpen(true);

    requestAnimationFrame(() => {
      const fullVid = fullVideoRef.current;
      if (fullVid) {
        fullVid.currentTime = resumeTime || 0;
        fullVid.playbackRate = playbackRate;
        fullVid.muted = isMuted;
        fullVid.loop = isLoop;
        if (wasPlaying) {
          fullVid.play().catch(() => {});
        }
      }
    });
  };

  const closeFullView = () => {
    const fullVid = fullVideoRef.current;
    const inlineVid = inlineVideoRef.current;
    const resumeTime = fullVid ? fullVid.currentTime : currentTime;
    const wasPlaying = fullVid ? !fullVid.paused : false;
    if (fullVid && !fullVid.paused) {
      fullVid.pause();
    }
    setFullViewOpen(false);
    setMenuOpen(false);

    requestAnimationFrame(() => {
      if (inlineVid) {
        inlineVid.currentTime = resumeTime || 0;
        if (wasPlaying) {
          inlineVid.play().catch(() => {});
        }
      }
    });
  };

  const handleSeek = (val: number) => {
    const vid = fullViewOpen ? fullVideoRef.current : inlineVideoRef.current;
    if (!vid || !Number.isFinite(val)) return;
    vid.currentTime = val;
    setCurrentTime(val);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (inlineVideoRef.current) inlineVideoRef.current.muted = next;
    if (fullVideoRef.current) fullVideoRef.current.muted = next;
  };

  const formattedCur = formatMediaDuration(currentTime) || '0:00';
  const formattedDur = formatMediaDuration(duration) || '0:00';

  const renderControlBar = (isModal: boolean) => (
    <div
      onClick={(e) => e.stopPropagation()}
      className="relative z-20 flex items-center gap-2 px-2.5 py-1.5 bg-slate-950/90 text-white border-t border-white/10 text-[11px] select-none"
    >
      <button
        type="button"
        onClick={togglePlay}
        className="p-1 rounded hover:bg-white/15 cursor-pointer shrink-0"
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
      </button>

      <span className="font-mono text-[10px] text-slate-200 tabular-nums shrink-0">
        {formattedCur} / {formattedDur}
      </span>

      <input
        type="range"
        min={0}
        max={duration > 0 ? duration : 100}
        step={0.1}
        value={Math.min(currentTime, duration > 0 ? duration : 100)}
        onChange={(e) => handleSeek(Number(e.target.value))}
        aria-label="Seek video timeline"
        className="flex-1 min-w-0 h-1 accent-cyan-400 cursor-pointer"
      />

      <button
        type="button"
        onClick={toggleMute}
        className="p-1 rounded hover:bg-white/15 cursor-pointer shrink-0"
        aria-label={isMuted ? 'Unmute video' : 'Mute video'}
      >
        {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-300" /> : <Volume2 className="w-3.5 h-3.5" />}
      </button>

      {!isModal ? (
        <button
          type="button"
          onClick={openFullView}
          className="p-1 rounded hover:bg-white/15 cursor-pointer shrink-0"
          aria-label="Full view video"
          title="Full view"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          type="button"
          onClick={closeFullView}
          className="p-1 rounded hover:bg-white/15 cursor-pointer shrink-0"
          aria-label="Exit full view"
          title="Exit full view"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Small compact 3-dots menu popover (no huge browser sheet) */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="p-1 rounded hover:bg-white/15 cursor-pointer"
          aria-label="Video options"
          title="Options"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 bottom-full mb-1.5 w-36 rounded-lg bg-slate-900 border border-slate-700 shadow-xl py-1 text-[11px] text-slate-100 z-30">
            <div className="px-2 py-1 text-[10px] text-slate-400 font-semibold border-b border-slate-800">
              Speed ({playbackRate}x)
            </div>
            <div className="grid grid-cols-3 gap-0.5 px-1.5 py-1 border-b border-slate-800">
              {[0.75, 1, 1.25, 1.5, 2].map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => {
                    setPlaybackRate(spd);
                    setMenuOpen(false);
                  }}
                  className={`px-1 py-0.5 rounded text-[10px] cursor-pointer ${
                    playbackRate === spd ? 'bg-cyan-700 text-white font-bold' : 'hover:bg-slate-800 text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsLoop((prev) => !prev);
                setMenuOpen(false);
              }}
              className="w-full px-2.5 py-1.5 text-left hover:bg-slate-800 flex items-center justify-between cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <Repeat className="w-3 h-3 text-cyan-400" />
                <span>Loop</span>
              </span>
              <span className="text-[10px] text-cyan-300 font-mono">{isLoop ? 'On' : 'Off'}</span>
            </button>
            <a
              href={src}
              download
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMenuOpen(false)}
              className="w-full px-2.5 py-1.5 text-left hover:bg-slate-800 flex items-center gap-1.5 text-slate-100 no-underline"
            >
              <Download className="w-3 h-3 text-cyan-400" />
              <span>Download</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div
        className={`relative rounded-xl border border-slate-200 bg-slate-950 overflow-hidden flex flex-col w-full ${className}`}
      >
        <div
          onClick={togglePlay}
          className={`relative w-full overflow-hidden bg-slate-950 flex items-center justify-center cursor-pointer ${
            sizeBoost ? 'min-h-[250px] sm:min-h-[300px]' : 'min-h-[210px]'
          }`}
          style={{ aspectRatio: aspectRatio || '16/9' }}
        >
          <video
            ref={inlineVideoRef}
            src={src}
            playsInline
            controls={false}
            preload="metadata"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => {
              const dur = e.currentTarget.duration;
              if (dur && Number.isFinite(dur)) setDuration(dur);
            }}
            className="w-full h-full transition-transform duration-200"
            style={{
              objectFit: objectFit || 'contain',
              transform: `scale(${zoomLevel || 1})`,
            }}
          />

          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-white/95 text-slate-950 shadow-lg flex items-center justify-center">
                <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
              </div>
            </div>
          )}
        </div>

        {renderControlBar(false)}
      </div>

      {/* Custom In-App Full View Lightbox (never triggers browser native fullscreen banner text) */}
      {fullViewOpen && (
        <div
          onClick={closeFullView}
          className="fixed inset-0 z-[95] bg-slate-950/95 backdrop-blur-xs flex flex-col items-center justify-center p-2 sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Full view video player"
        >
          <button
            type="button"
            onClick={closeFullView}
            className="fixed top-3 right-3 z-[96] w-9 h-9 rounded-full bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-600 flex items-center justify-center cursor-pointer shadow-lg"
            aria-label="Close full view"
          >
            <X className="w-4 h-4" />
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden border border-slate-700 bg-black shadow-2xl"
          >
            <div
              onClick={togglePlay}
              className="relative flex-1 bg-black flex items-center justify-center cursor-pointer min-h-[260px] max-h-[82vh]"
            >
              <video
                ref={fullVideoRef}
                src={src}
                playsInline
                controls={false}
                preload="auto"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  const dur = e.currentTarget.duration;
                  if (dur && Number.isFinite(dur)) setDuration(dur);
                }}
                className="w-full max-h-[82vh] object-contain"
              />

              {!isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                  <div className="w-14 h-14 rounded-full bg-white/95 text-slate-950 shadow-lg flex items-center justify-center">
                    <Play className="w-6 h-6 fill-slate-950 ml-0.5" />
                  </div>
                </div>
              )}
            </div>

            {renderControlBar(true)}
          </div>
        </div>
      )}
    </>
  );
};
