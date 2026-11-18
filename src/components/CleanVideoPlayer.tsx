import React, { useEffect, useMemo, useRef, useState } from 'react';
import '@vidstack/react/player/styles/default/theme.css';
import '@vidstack/react/player/styles/default/layouts/video.css';
import {
  MediaPlayer,
  MediaProvider,
  Poster,
  Track,
  type MediaPlayerInstance,
} from '@vidstack/react';
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from '@vidstack/react/player/layouts/default';
import { RotateCcw, Repeat } from 'lucide-react';

export interface VideoSubtitleTrack {
  src: string;
  label?: string;
  lang?: string;
  default?: boolean;
}

interface CleanVideoPlayerProps {
  src: string;
  poster?: string;
  av1Src?: string;
  h264Src?: string;
  av1Urls?: { '720p'?: string; '1080p'?: string };
  h264Urls?: { '720p'?: string; '1080p'?: string };
  vttThumbnailsUrl?: string;
  thumbnailsVtt?: string;
  subtitles?: VideoSubtitleTrack[];
  subtitleUrl?: string;
  mediaId?: string;
  title?: string;
  aspectRatio?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  zoomLevel?: number;
  autoPlay?: boolean;
  defaultLoop?: boolean;
  onDurationResolved?: (seconds: number) => void;
  className?: string;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function supportsAv1Playback(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const v = document.createElement('video');
    const av1Test = v.canPlayType('video/mp4; codecs="av01.0.04M.08"');
    if (av1Test === 'probably' || av1Test === 'maybe') return true;
    const altTest = v.canPlayType('video/mp4; codecs="av01.0.08M.08"');
    return altTest === 'probably' || altTest === 'maybe';
  } catch {
    return false;
  }
}

function hashStorageKey(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fesline_vid_pos_v1_${(h >>> 0).toString(36)}`;
}

export const CleanVideoPlayer: React.FC<CleanVideoPlayerProps> = ({
  src,
  poster,
  av1Src,
  h264Src,
  av1Urls,
  h264Urls,
  vttThumbnailsUrl,
  thumbnailsVtt,
  subtitles,
  subtitleUrl,
  mediaId,
  title,
  aspectRatio = '16/9',
  objectFit = 'contain',
  zoomLevel = 1,
  autoPlay = false,
  defaultLoop = false,
  onDurationResolved,
  className = '',
}) => {
  const playerRef = useRef<MediaPlayerInstance | null>(null);
  const lastSavedSecRef = useRef<number>(0);
  const resumedOnceRef = useRef<boolean>(false);
  const pendingRestoreRef = useRef<{ time: number; wasPlaying: boolean } | null>(null);

  const hasAv1Variants = Boolean(av1Urls?.['1080p'] || av1Urls?.['720p'] || av1Src);
  const hasH264Variants = Boolean(h264Urls?.['1080p'] || h264Urls?.['720p'] || h264Src);
  const isAdaptiveManifest = /\.(m3u8|mpd)(\?|$)/i.test(src || '');

  const [codecMode, setCodecMode] = useState<'av1' | 'h264'>(() =>
    hasAv1Variants && supportsAv1Playback() ? 'av1' : 'h264'
  );
  const [selectedQuality, setSelectedQuality] = useState<'auto' | '1080p' | '720p'>('auto');
  const [isLooping, setIsLooping] = useState(defaultLoop);
  const [hasError, setHasError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const resumeKey = useMemo(
    () => hashStorageKey(mediaId || h264Urls?.['720p'] || av1Urls?.['720p'] || src || 'vid'),
    [mediaId, h264Urls, av1Urls, src]
  );

  // Sync default codec when source changes
  useEffect(() => {
    resumedOnceRef.current = false;
    pendingRestoreRef.current = null;
    setHasError(false);
    setSelectedQuality('auto');
    setCodecMode(hasAv1Variants && supportsAv1Playback() ? 'av1' : 'h264');
  }, [src, av1Src, h264Src, hasAv1Variants]);

  const availableResolutions = useMemo(() => {
    const activeMap = codecMode === 'av1' ? av1Urls : h264Urls;
    const opts: Array<'1080p' | '720p'> = [];
    if (activeMap?.['1080p'] || h264Urls?.['1080p'] || av1Urls?.['1080p']) opts.push('1080p');
    if (activeMap?.['720p'] || h264Urls?.['720p'] || av1Urls?.['720p']) opts.push('720p');
    return opts;
  }, [codecMode, av1Urls, h264Urls]);

  const resolvedSrc = useMemo(() => {
    if (isAdaptiveManifest) return src;
    const preferMobile720 =
      typeof window !== 'undefined' && window.innerWidth > 0 && window.innerWidth < 640;

    const pickFrom = (
      primaryMap?: { '720p'?: string; '1080p'?: string },
      fallbackSingle?: string
    ): string | undefined => {
      if (selectedQuality === '1080p') {
        return primaryMap?.['1080p'] || primaryMap?.['720p'] || fallbackSingle;
      }
      if (selectedQuality === '720p') {
        return primaryMap?.['720p'] || primaryMap?.['1080p'] || fallbackSingle;
      }
      if (preferMobile720) {
        return primaryMap?.['720p'] || primaryMap?.['1080p'] || fallbackSingle;
      }
      return primaryMap?.['1080p'] || primaryMap?.['720p'] || fallbackSingle;
    };

    if (codecMode === 'av1') {
      return (
        pickFrom(av1Urls, av1Src) ||
        pickFrom(h264Urls, h264Src) ||
        src
      );
    }
    return (
      pickFrom(h264Urls, h264Src) ||
      src ||
      pickFrom(av1Urls, av1Src) ||
      ''
    );
  }, [isAdaptiveManifest, src, codecMode, selectedQuality, av1Urls, h264Urls, av1Src, h264Src]);

  const effectiveThumbnails = vttThumbnailsUrl || thumbnailsVtt || undefined;

  const effectiveSubtitles = useMemo<VideoSubtitleTrack[]>(() => {
    if (Array.isArray(subtitles) && subtitles.length > 0) return subtitles;
    if (subtitleUrl && subtitleUrl.trim()) {
      return [{ src: subtitleUrl.trim(), label: 'English', lang: 'en', default: false }];
    }
    return [];
  }, [subtitles, subtitleUrl]);

  const needsCors = Boolean(effectiveThumbnails || effectiveSubtitles.length > 0);

  const handleQualitySwitch = (nextQuality: 'auto' | '1080p' | '720p') => {
    if (nextQuality === selectedQuality) return;
    const player = playerRef.current;
    if (player) {
      pendingRestoreRef.current = {
        time: Number.isFinite(player.currentTime) ? player.currentTime : 0,
        wasPlaying: !player.paused,
      };
    }
    setHasError(false);
    setSelectedQuality(nextQuality);
  };

  const handlePlayerError = () => {
    const player = playerRef.current;
    if (codecMode === 'av1' && (hasH264Variants || (src && src !== resolvedSrc))) {
      if (player) {
        pendingRestoreRef.current = {
          time: Number.isFinite(player.currentTime) ? player.currentTime : 0,
          wasPlaying: !player.paused,
        };
      }
      setCodecMode('h264');
      setHasError(false);
      return;
    }
    setHasError(true);
  };

  const handleRetry = () => {
    setHasError(false);
    setRetryNonce((n) => n + 1);
    const player = playerRef.current;
    if (player) {
      try {
        player.play().catch(() => {});
      } catch {}
    }
  };

  const normalizedAspect = (aspectRatio || '16/9').replace(':', '/');

  return (
    <div
      className={`fesline-vidstack-wrap group relative w-full overflow-hidden bg-slate-950 min-h-[200px] max-h-[245px] sm:max-h-[420px] flex items-center justify-center ${className}`}
      style={{
        aspectRatio: normalizedAspect,
        ['--media-brand' as string]: 'var(--primary-color, #164e63)',
        ['--fesline-vid-fit' as string]: objectFit,
        ['--fesline-vid-scale' as string]: String(zoomLevel || 1),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <MediaPlayer
        key={`${resumeKey}_${retryNonce}`}
        ref={playerRef}
        title={title || 'Engineering Video'}
        src={resolvedSrc}
        playsInline
        loop={isLooping}
        crossOrigin={needsCors ? 'anonymous' : undefined}
        load="visible"
        posterLoad="visible"
        autoPlay={autoPlay}
        streamType="on-demand"
        keyTarget="player"
        className="w-full h-full fesline-vidstack-player"
        onLoadedMetadata={() => {
          const player = playerRef.current;
          const dur = player?.duration || 0;
          if (dur && Number.isFinite(dur) && dur > 0) {
            onDurationResolved?.(dur);
          }

          if (!resumedOnceRef.current && !pendingRestoreRef.current && player && dur > 6) {
            resumedOnceRef.current = true;
            try {
              const saved = Number(localStorage.getItem(resumeKey) || '0');
              if (Number.isFinite(saved) && saved > 2 && saved < dur - 2) {
                player.currentTime = saved;
              }
            } catch {}
          }
        }}
        onCanPlay={() => {
          setHasError(false);
          const pending = pendingRestoreRef.current;
          const player = playerRef.current;
          if (pending && player) {
            pendingRestoreRef.current = null;
            if (pending.time > 0) {
              player.currentTime = pending.time;
            }
            if (pending.wasPlaying) {
              player.play().catch(() => {});
            }
          }
        }}
        onTimeUpdate={(detail) => {
          const cur = detail?.currentTime || 0;
          if (cur > 0 && Math.abs(cur - lastSavedSecRef.current) >= 1.5) {
            lastSavedSecRef.current = cur;
            try {
              localStorage.setItem(resumeKey, String(Math.floor(cur)));
            } catch {}
          }
        }}
        onEnded={() => {
          try {
            localStorage.removeItem(resumeKey);
          } catch {}
        }}
        onError={handlePlayerError}
      >
        <MediaProvider>
          {poster && (
            <Poster
              src={poster}
              alt={title || 'Video poster'}
              className="vds-poster object-cover w-full h-full"
            />
          )}
          {effectiveSubtitles.map((track, idx) => (
            <Track
              key={`${track.src}_${idx}`}
              src={track.src}
              kind="subtitles"
              label={track.label || 'Subtitles'}
              lang={track.lang || 'en'}
              default={Boolean(track.default)}
            />
          ))}
        </MediaProvider>

        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          thumbnails={effectiveThumbnails}
          playbackRates={SPEED_OPTIONS}
          seekStep={10}
          colorScheme="dark"
          smallLayoutWhen={({ width, height }) => width < 440 || height < 240}
        />
      </MediaPlayer>

      {/* Top-right compact Loop toggle + optional Resolution Selector */}
      {!hasError && (
        <div
          className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-85 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setIsLooping((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold backdrop-blur-xs transition-colors cursor-pointer ${
              isLooping
                ? 'bg-cyan-700/90 border-cyan-400/50 text-white'
                : 'bg-slate-950/70 border-white/15 text-slate-200 hover:bg-slate-900/90'
            }`}
            title={isLooping ? 'Loop On (click to turn off)' : 'Loop Off (click to repeat video)'}
            aria-label="Toggle video loop"
            aria-pressed={isLooping}
          >
            <Repeat className="w-3 h-3" />
            <span>Loop</span>
          </button>

          {!isAdaptiveManifest && availableResolutions.length > 1 && (
            <div className="flex items-center gap-0.5 bg-slate-950/75 backdrop-blur-xs border border-white/15 rounded-md p-0.5 text-[10px] font-mono text-white">
              {(['auto', ...availableResolutions] as Array<'auto' | '1080p' | '720p'>).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => handleQualitySwitch(q)}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    selectedQuality === q
                      ? 'bg-cyan-700 text-white font-bold'
                      : 'text-slate-200 hover:bg-white/15'
                  }`}
                  title={`Switch stream quality to ${q}`}
                >
                  {q === 'auto' ? 'Auto' : q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Playback Error + Retry Overlay */}
      {hasError && (
        <div className="absolute inset-0 z-30 bg-slate-950/90 flex flex-col items-center justify-center gap-2 p-4 text-center text-white">
          <p className="text-xs text-slate-200">Unable to load video stream.</p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-800 hover:bg-cyan-700 text-white text-xs font-semibold cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}
    </div>
  );
};
