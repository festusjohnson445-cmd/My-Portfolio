import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  MoreVertical,
  X,
  PictureInPicture2,
} from 'lucide-react';
import { formatMediaDuration } from '../utils/mediaMetadata';

interface CleanVideoPlayerProps {
  src: string;
  aspectRatio?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  zoomLevel?: number;
  autoPlay?: boolean;
  onDurationResolved?: (seconds: number) => void;
  className?: string;
}

const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2];

export const CleanVideoPlayer: React.FC<CleanVideoPlayerProps> = ({
  src,
  aspectRatio = '16/9',
  objectFit = 'contain',
  zoomLevel = 1,
  autoPlay = false,
  onDurationResolved,
  className = '',
}) => {
  const inlineVideoRef = useRef<HTMLVideoElement | null>(null);
  const theaterVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isTheaterOpen, setIsTheaterOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(autoPlay);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const activeVideo = isTheaterOpen ? theaterVideoRef.current : inlineVideoRef.current;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!isTheaterOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeTheater();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isTheaterOpen]);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setHasStarted(autoPlay);
  }, [src, autoPlay]);

  const syncPlayPause = (vid: HTMLVideoElement | null) => {
    if (!vid) return;
    setHasStarted(true);
    if (vid.paused) {
      vid.play().catch(() => {});
    } else {
      vid.pause();
    }
  };

  const handleToggleMute = (vid: HTMLVideoElement | null) => {
    if (!vid) return;
    const next = !vid.muted;
    vid.muted = next;
    setIsMuted(next);
  };

  const handleSeek = (vid: HTMLVideoElement | null, value: number) => {
    if (!vid) return;
    vid.currentTime = value;
    setCurrentTime(value);
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (inlineVideoRef.current) inlineVideoRef.current.playbackRate = rate;
    if (theaterVideoRef.current) theaterVideoRef.current.playbackRate = rate;
    setIsMenuOpen(false);
  };

  const handlePiP = async (vid: HTMLVideoElement | null) => {
    setIsMenuOpen(false);
    if (!vid) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (typeof vid.requestPictureInPicture === 'function') {
        await vid.requestPictureInPicture();
      }
    } catch {}
  };

  const openTheater = () => {
    setIsMenuOpen(false);
    const inVid = inlineVideoRef.current;
    const t = inVid?.currentTime || currentTime;
    const wasPlaying = inVid ? !inVid.paused : isPlaying;
    if (inVid && !inVid.paused) inVid.pause();
    setIsTheaterOpen(true);
    requestAnimationFrame(() => {
      const thVid = theaterVideoRef.current;
      if (thVid) {
        thVid.currentTime = t;
        thVid.muted = isMuted;
        thVid.playbackRate = playbackRate;
        if (wasPlaying) {
          thVid.play().catch(() => {});
        }
      }
    });
  };

  const closeTheater = () => {
    setIsMenuOpen(false);
    const thVid = theaterVideoRef.current;
    const t = thVid?.currentTime || currentTime;
    const wasPlaying = thVid ? !thVid.paused : false;
    if (thVid && !thVid.paused) thVid.pause();
    setIsTheaterOpen(false);
    requestAnimationFrame(() => {
      const inVid = inlineVideoRef.current;
      if (inVid) {
        inVid.currentTime = t;
        inVid.muted = isMuted;
        inVid.playbackRate = playbackRate;
        if (wasPlaying) {
          inVid.play().catch(() => {});
        }
      }
    });
  };

  const renderControlsBar = (vidRef: React.RefObject<HTMLVideoElement | null>, expanded: boolean) => {
    const safeDur = duration > 0 ? duration : 0;
    const pct = safeDur > 0 ? Math.min(100, Math.max(0, (currentTime / safeDur) * 100)) : 0;
    return (
      <div
        className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2.5 pb-2 pt-5 flex flex-col gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="range"
          min={0}
          max={safeDur || 100}
          step={0.1}
          value={safeDur > 0 ? currentTime : 0}
          onChange={(e) => handleSeek(vidRef.current, Number(e.target.value))}
          aria-label="Seek video"
          className="w-full h-1 accent-cyan-400 cursor-pointer"
          style={{
            background: `linear-gradient(to right, #22d3ee ${pct}%, rgba(255,255,255,0.28) ${pct}%)`,
          }}
        />
        <div className="flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => syncPlayPause(vidRef.current)}
              className="p-1 rounded hover:bg-white/15 cursor-pointer"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-white" />}
            </button>

            <span className="text-[10.5px] font-mono tabular-nums text-white/90 whitespace-nowrap">
              {formatMediaDuration(currentTime) || '0:00'} / {formatMediaDuration(safeDur) || '0:00'}
            </span>
          </div>

          <div className="flex items-center gap-1 relative" ref={expanded ? undefined : menuRef}>
            <button
              type="button"
              onClick={() => handleToggleMute(vidRef.current)}
              className="p-1 rounded hover:bg-white/15 cursor-pointer"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={() => (expanded ? closeTheater() : openTheater())}
              className="p-1 rounded hover:bg-white/15 cursor-pointer"
              aria-label={expanded ? 'Exit full view' : 'Expand view'}
              title={expanded ? 'Exit full view' : 'Full view'}
            >
              {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <div className="relative" ref={expanded ? menuRef : undefined}>
              <button
                type="button"
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="p-1 rounded hover:bg-white/15 cursor-pointer"
                aria-label="Video options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 bottom-7 w-28 bg-slate-900/95 border border-white/15 rounded-lg shadow-xl py-1 text-[10.5px] text-white z-30">
                  <div className="px-2 py-0.5 text-[9.5px] text-slate-400 uppercase tracking-wider font-semibold">
                    Speed
                  </div>
                  <div className="px-1.5 pb-1 flex flex-wrap gap-1 border-b border-white/10">
                    {SPEED_OPTIONS.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => handleSpeedChange(rate)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer ${
                          playbackRate === rate
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'hover:bg-white/15 text-slate-200'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePiP(vidRef.current)}
                    className="w-full px-2 py-1 text-left hover:bg-white/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    <PictureInPicture2 className="w-3 h-3" />
                    <span>PiP</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div
        className={`relative w-full overflow-hidden bg-slate-950 flex items-center justify-center group select-none ${className}`}
        style={{ aspectRatio }}
        onClick={() => syncPlayPause(inlineVideoRef.current)}
      >
        <video
          ref={inlineVideoRef}
          src={src}
          autoPlay={autoPlay}
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            if (dur && Number.isFinite(dur) && dur > 0) {
              setDuration(dur);
              onDurationResolved?.(dur);
            }
          }}
          onTimeUpdate={(e) => {
            if (!isTheaterOpen) setCurrentTime(e.currentTarget.currentTime);
          }}
          onPlay={() => {
            setHasStarted(true);
            setIsPlaying(true);
          }}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          className="w-full h-full transition-transform duration-200 cursor-pointer"
          style={{
            objectFit,
            transform: `scale(${zoomLevel || 1})`,
          }}
        />

        {(!isPlaying || !hasStarted) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              syncPlayPause(inlineVideoRef.current);
            }}
            aria-label="Play video"
            className="absolute inset-0 m-auto w-11 h-11 rounded-full bg-white/95 hover:bg-white text-slate-950 flex items-center justify-center shadow-lg transition-transform group-hover:scale-105 cursor-pointer z-10"
          >
            <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
          </button>
        )}

        {renderControlsBar(inlineVideoRef, false)}
      </div>

      {/* Custom In-Viewport Theater Mode — eliminates Chrome/Android native fullscreen exit banner */}
      {isTheaterOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center p-2 sm:p-4 select-none"
          onClick={closeTheater}
          role="dialog"
          aria-modal="true"
          aria-label="Video player full view"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeTheater();
            }}
            aria-label="Close full view"
            className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div
            className="relative w-full max-w-5xl max-h-[88vh] aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center shadow-2xl"
            onClick={(e) => {
              e.stopPropagation();
              syncPlayPause(theaterVideoRef.current);
            }}
          >
            <video
              ref={theaterVideoRef}
              src={src}
              playsInline
              preload="metadata"
              onLoadedMetadata={(e) => {
                const dur = e.currentTarget.duration;
                if (dur && Number.isFinite(dur) && dur > 0) {
                  setDuration(dur);
                }
              }}
              onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-contain cursor-pointer"
            />

            {!isPlaying && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  syncPlayPause(theaterVideoRef.current);
                }}
                aria-label="Play video"
                className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-white/95 hover:bg-white text-slate-950 flex items-center justify-center shadow-xl cursor-pointer z-10"
              >
                <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
              </button>
            )}

            {renderControlsBar(theaterVideoRef, true)}
          </div>
        </div>
      )}
    </>
  );
};
