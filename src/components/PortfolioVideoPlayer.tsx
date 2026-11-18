import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  MoreVertical,
  X,
  RotateCcw,
} from 'lucide-react';

interface PortfolioVideoPlayerProps {
  src: string;
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
  zoomLevel?: number;
  className?: string;
}

function formatVideoClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.floor(sec);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const PortfolioVideoPlayer: React.FC<PortfolioVideoPlayerProps> = ({
  src,
  aspectRatio = '16/9',
  objectFit = 'contain',
  zoomLevel = 1,
  className = '',
}) => {
  const inlineVideoRef = useRef<HTMLVideoElement>(null);
  const modalVideoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setShowMenu(false);
  }, [src]);

  useEffect(() => {
    if (!isLightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isLightboxOpen]);

  const activeVideo = isLightboxOpen ? modalVideoRef.current : inlineVideoRef.current;

  const togglePlay = () => {
    const vid = activeVideo;
    if (!vid) return;
    if (vid.paused || vid.ended) {
      vid.play().catch(() => {});
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isMuted;
    setIsMuted(next);
    if (inlineVideoRef.current) inlineVideoRef.current.muted = next;
    if (modalVideoRef.current) modalVideoRef.current.muted = next;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);
    if (activeVideo) activeVideo.currentTime = val;
  };

  const applyPlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (inlineVideoRef.current) inlineVideoRef.current.playbackRate = rate;
    if (modalVideoRef.current) modalVideoRef.current.playbackRate = rate;
    setShowMenu(false);
  };

  const openLightbox = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const resumeAt = inlineVideoRef.current?.currentTime || currentTime;
    const wasPlaying = inlineVideoRef.current ? !inlineVideoRef.current.paused : isPlaying;
    if (inlineVideoRef.current && !inlineVideoRef.current.paused) {
      inlineVideoRef.current.pause();
    }
    setIsLightboxOpen(true);
    window.setTimeout(() => {
      const mVid = modalVideoRef.current;
      if (mVid) {
        mVid.currentTime = resumeAt;
        mVid.playbackRate = playbackRate;
        mVid.muted = isMuted;
        mVid.loop = isLooping;
        if (wasPlaying) {
          mVid.play().catch(() => {});
          setIsPlaying(true);
        }
      }
    }, 30);
  };

  const closeLightbox = () => {
    const resumeAt = modalVideoRef.current?.currentTime || currentTime;
    const wasPlaying = modalVideoRef.current ? !modalVideoRef.current.paused : false;
    if (modalVideoRef.current && !modalVideoRef.current.paused) {
      modalVideoRef.current.pause();
    }
    setIsLightboxOpen(false);
    window.setTimeout(() => {
      const iVid = inlineVideoRef.current;
      if (iVid) {
        iVid.currentTime = resumeAt;
        iVid.playbackRate = playbackRate;
        iVid.muted = isMuted;
        iVid.loop = isLooping;
        if (wasPlaying) {
          iVid.play().catch(() => {});
          setIsPlaying(true);
        } else {
          setIsPlaying(false);
        }
      }
    }, 30);
  };

  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <>
      <div
        className={`relative w-full bg-slate-950 overflow-hidden select-none group ${className}`}
        style={{ aspectRatio }}
        onClick={togglePlay}
      >
        <video
          ref={inlineVideoRef}
          src={src}
          playsInline
          preload="metadata"
          muted={isMuted}
          loop={isLooping}
          controlsList="nofullscreen nodownload noplaybackrate"
          disablePictureInPicture
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (Number.isFinite(v.duration)) setDuration(v.duration);
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="w-full h-full transition-transform duration-200 cursor-pointer"
          style={{
            objectFit,
            transform: `scale(${zoomLevel || 1})`,
          }}
        />

        {/* Center Play Overlay when paused */}
        {!isPlaying && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-white/90 hover:bg-white text-slate-950 shadow-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
            aria-label="Play video"
          >
            <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
          </button>
        )}

        {/* Custom Compact Control Bar (Zero native fullscreen toast & small 3-dots popout) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2.5 pt-5 pb-2 flex flex-col gap-1.5"
        >
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={Math.min(currentTime, duration || 100)}
            onChange={handleSeek}
            aria-label="Seek video"
            className="w-full h-1 accent-cyan-400 cursor-pointer bg-white/25 rounded-full"
            style={{
              background: `linear-gradient(to right, #22d3ee ${progressPct}%, rgba(255,255,255,0.28) ${progressPct}%)`,
            }}
          />

          <div className="flex items-center justify-between gap-2 text-white">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="p-1 rounded hover:bg-white/15 cursor-pointer"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
              </button>

              <span className="text-[10px] font-mono tabular-nums text-white/90">
                {formatVideoClock(currentTime)} / {formatVideoClock(duration)}
              </span>
            </div>

            <div className="flex items-center gap-1 relative">
              <button
                type="button"
                onClick={toggleMute}
                className="p-1 rounded hover:bg-white/15 cursor-pointer"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              <button
                type="button"
                onClick={openLightbox}
                className="p-1 rounded hover:bg-white/15 cursor-pointer"
                aria-label="Expand video"
                title="Full View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {/* Small 3-dots popout */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu((prev) => !prev);
                }}
                className="p-1 rounded hover:bg-white/15 cursor-pointer"
                aria-label="Playback options"
              >
                <MoreVertical className="w-3 h-3" />
              </button>

              {showMenu && (
                <div className="absolute right-0 bottom-7 w-28 rounded-lg bg-slate-900/95 border border-slate-700 shadow-xl py-1 text-[10px] text-slate-100 z-30">
                  <div className="px-2 py-0.5 text-[9px] text-slate-400 font-semibold border-b border-slate-800">
                    Speed ({playbackRate}x)
                  </div>
                  {[0.75, 1, 1.25, 1.5, 2].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => applyPlaybackRate(r)}
                      className={`w-full text-left px-2 py-1 hover:bg-slate-800 flex items-center justify-between cursor-pointer ${
                        playbackRate === r ? 'text-cyan-300 font-bold' : ''
                      }`}
                    >
                      <span>{r}x</span>
                      {playbackRate === r && <span>✓</span>}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isLooping;
                      setIsLooping(next);
                      if (inlineVideoRef.current) inlineVideoRef.current.loop = next;
                      if (modalVideoRef.current) modalVideoRef.current.loop = next;
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-2 py-1 hover:bg-slate-800 border-t border-slate-800 flex items-center justify-between cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1">
                      <RotateCcw className="w-2.5 h-2.5" />
                      Loop
                    </span>
                    <span className={isLooping ? 'text-cyan-300 font-bold' : 'text-slate-400'}>
                      {isLooping ? 'On' : 'Off'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* In-App Full View Lightbox Modal — never triggers browser fullscreen OS exit popup */}
      {isLightboxOpen && (
        <div
          onClick={closeLightbox}
          className="fixed inset-0 z-[95] bg-black/95 flex flex-col items-center justify-center p-3 sm:p-6"
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-3 right-3 sm:top-5 sm:right-5 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white border border-white/25 flex items-center justify-center cursor-pointer z-20"
            aria-label="Close full video view"
          >
            <X className="w-4 h-4" />
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-6xl max-h-[88vh] flex flex-col items-center justify-center bg-black rounded-xl overflow-hidden border border-white/10"
          >
            <video
              ref={modalVideoRef}
              src={src}
              playsInline
              controls
              controlsList="nofullscreen nodownload"
              disablePictureInPicture
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              className="w-full max-h-[86vh] object-contain bg-black"
            />
          </div>
        </div>
      )}
    </>
  );
};
