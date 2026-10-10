import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Play, Pause, Download, Mic, Loader2 } from 'lucide-react';
import { formatDuration, safeDataUrlToBlobUrl } from '../utils/audioUtils';

export interface VoiceNoteData {
  url: string;
  duration: number; // in seconds
  mimeType?: string;
}

interface VoiceNotePlayerProps {
  voiceNote: VoiceNoteData;
  isSender: boolean;
  senderName?: string;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({
  voiceNote,
  isSender,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Web Audio API fallback refs for devices/browsers that reject WebM in HTML5 audio
  const webAudioCtxRef = useRef<AudioContext | null>(null);
  const webAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const webAudioBufferRef = useRef<AudioBuffer | null>(null);
  const webAudioStartTimeRef = useRef<number>(0);
  const webAudioPauseOffsetRef = useRef<number>(0);
  const webAudioTimerRef = useRef<any>(null);

  // Convert raw Base64 data URL to clean in-memory Blob URL to eliminate data URI parsing bugs in Safari/WebKit
  const { blobUrl, mimeType, revoke } = useMemo(() => {
    return safeDataUrlToBlobUrl(voiceNote.url);
  }, [voiceNote.url]);

  useEffect(() => {
    return () => {
      revoke();
      if (webAudioTimerRef.current) clearInterval(webAudioTimerRef.current);
      if (webAudioSourceRef.current) {
        try { webAudioSourceRef.current.stop(); } catch {}
      }
      if (webAudioCtxRef.current && webAudioCtxRef.current.state !== 'closed') {
        try { webAudioCtxRef.current.close(); } catch {}
      }
    };
  }, [revoke]);

  // Clean and parse duration
  const fallbackDuration = Math.max(1, Math.round(Number(voiceNote.duration) || 1));
  const [audioDuration, setAudioDuration] = useState<number>(fallbackDuration);

  // Sync duration when metadata loads
  const handleLoadedMetadata = () => {
    if (audioRef.current && isFinite(audioRef.current.duration) && !isNaN(audioRef.current.duration) && audioRef.current.duration > 0) {
      setAudioDuration(Math.round(audioRef.current.duration));
    }
  };

  const onTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const onEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Web Audio API playback fallback for unsupported HTML5 media
  const playWithWebAudioFallback = async (targetOffset = 0) => {
    try {
      setIsLoading(true);
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) throw new Error('Web Audio not supported');

      if (!webAudioCtxRef.current || webAudioCtxRef.current.state === 'closed') {
        webAudioCtxRef.current = new AudioCtx();
      }
      const ctx = webAudioCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      if (!webAudioBufferRef.current) {
        const response = await fetch(blobUrl || voiceNote.url);
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await new Promise<AudioBuffer>((resolve, reject) => {
          const res = ctx.decodeAudioData(
            arrayBuffer,
            (buf) => resolve(buf),
            (err) => reject(err)
          );
          if (res && typeof (res as any).then === 'function') {
            (res as any).then(resolve).catch(reject);
          }
        });
        webAudioBufferRef.current = decoded;
        if (decoded.duration > 0 && isFinite(decoded.duration)) {
          setAudioDuration(Math.round(decoded.duration));
        }
      }

      const buffer = webAudioBufferRef.current;
      if (!buffer) throw new Error('Could not decode audio buffer');

      if (webAudioSourceRef.current) {
        try { webAudioSourceRef.current.stop(); } catch {}
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      source.connect(ctx.destination);

      const offset = targetOffset >= buffer.duration ? 0 : targetOffset;
      webAudioStartTimeRef.current = ctx.currentTime - (offset / playbackRate);
      webAudioPauseOffsetRef.current = offset;

      source.onended = () => {
        setIsPlaying(false);
        setCurrentTime(0);
        webAudioPauseOffsetRef.current = 0;
        if (webAudioTimerRef.current) clearInterval(webAudioTimerRef.current);
      };

      source.start(0, offset);
      webAudioSourceRef.current = source;
      setIsPlaying(true);
      setIsLoading(false);
      setLoadError(false);

      if (webAudioTimerRef.current) clearInterval(webAudioTimerRef.current);
      webAudioTimerRef.current = setInterval(() => {
        if (!webAudioCtxRef.current) return;
        const cur = (webAudioCtxRef.current.currentTime - webAudioStartTimeRef.current) * playbackRate;
        if (cur >= buffer.duration) {
          setCurrentTime(buffer.duration);
          setIsPlaying(false);
          clearInterval(webAudioTimerRef.current);
        } else {
          setCurrentTime(cur);
        }
      }, 100);

      return true;
    } catch (fallbackErr) {
      console.warn('[Web Audio Fallback Error]:', fallbackErr);
      setIsLoading(false);
      setLoadError(true);
      return false;
    }
  };

  const stopWebAudioFallback = () => {
    if (webAudioTimerRef.current) clearInterval(webAudioTimerRef.current);
    if (webAudioSourceRef.current) {
      try { webAudioSourceRef.current.stop(); } catch {}
      webAudioSourceRef.current = null;
    }
    if (webAudioCtxRef.current) {
      webAudioPauseOffsetRef.current = currentTime;
    }
    setIsPlaying(false);
  };

  const togglePlay = async () => {
    // If currently playing, pause
    if (isPlaying) {
      if (webAudioSourceRef.current) {
        stopWebAudioFallback();
      } else if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    // Proactively unlock Web Audio context during user click gesture for iOS/Safari
    if (webAudioCtxRef.current && webAudioCtxRef.current.state === 'suspended') {
      try { await webAudioCtxRef.current.resume(); } catch {}
    }

    // Try HTML5 Audio element first
    const audio = audioRef.current;
    if (audio) {
      if (audio.ended || (audioDuration > 0 && Math.abs(audio.currentTime - audioDuration) < 0.2)) {
        audio.currentTime = 0;
        setCurrentTime(0);
      }
      audio.playbackRate = playbackRate;
      setIsLoading(true);

      try {
        await audio.play();
        setIsPlaying(true);
        setIsLoading(false);
        setLoadError(false);
        return;
      } catch (playErr) {
        console.warn('[HTML5 Audio play failed, switching to Web Audio API fallback]:', playErr);
        // Fallback to Web Audio API
        const ok = await playWithWebAudioFallback(currentTime);
        if (!ok) {
          setIsPlaying(false);
          setIsLoading(false);
        }
      }
    } else {
      await playWithWebAudioFallback(currentTime);
    }
  };

  const handleSeek = (percentage: number) => {
    const target = percentage * audioDuration;
    setCurrentTime(target);

    if (webAudioSourceRef.current) {
      playWithWebAudioFallback(target);
    } else if (audioRef.current) {
      try {
        audioRef.current.currentTime = target;
      } catch {}
    }
  };

  const cycleSpeed = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
    if (webAudioSourceRef.current) {
      webAudioSourceRef.current.playbackRate.value = nextRate;
    }
  };

  const progressPct = audioDuration > 0 ? Math.min(100, (currentTime / audioDuration) * 100) : 0;

  // WhatsApp-style 28 acoustic equalizer waveform bars with dynamic visual variance
  const waveformHeights = [
    8, 14, 22, 12, 18, 28, 16, 24, 30, 20,
    14, 26, 32, 22, 18, 28, 20, 26, 14, 22,
    30, 16, 24, 18, 12, 20, 14, 10
  ];

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[220px] sm:min-w-[270px] select-none font-sans">
      {/* Hidden standard HTML5 Audio element in DOM with playsInline */}
      <audio
        ref={audioRef}
        src={blobUrl || voiceNote.url}
        playsInline
        preload="auto"
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
        onError={() => {
          // If HTML5 element fails, Web Audio fallback will handle it on togglePlay
          setLoadError(false);
        }}
        className="sr-only"
      />

      {/* WhatsApp Play / Pause Round Button */}
      <button
        type="button"
        onClick={togglePlay}
        disabled={isLoading}
        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-all active:scale-95 cursor-pointer ${
          isSender
            ? 'bg-[#243346] hover:bg-[#1a2533] text-white'
            : 'bg-[#00a884] hover:bg-[#008f6f] text-white'
        }`}
        title={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-white" />
        ) : isPlaying ? (
          <Pause className="w-4 h-4 fill-current text-white" />
        ) : (
          <Play className="w-4 h-4 fill-current text-white ml-0.5" />
        )}
      </button>

      {/* Waveform & Scrubber */}
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, clickX / rect.width));
            handleSeek(pct);
          }}
          className="h-7 flex items-center gap-[2.5px] cursor-pointer group py-1"
          title="Click to seek"
        >
          {waveformHeights.map((h, i) => {
            const barPct = (i / waveformHeights.length) * 100;
            const isPlayed = barPct <= progressPct;
            return (
              <span
                key={i}
                style={{ height: `${h}px` }}
                className={`w-[2.5px] sm:w-[3px] rounded-full transition-colors ${
                  isPlayed
                    ? isSender
                      ? 'bg-[#243346]'
                      : 'bg-[#00a884]'
                    : isSender
                    ? 'bg-slate-400/50'
                    : 'bg-slate-300'
                } group-hover:opacity-85`}
              />
            );
          })}
        </div>

        {/* Timestamps & Quick Actions */}
        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono -mt-0.5">
          <span className="font-medium">
            {formatDuration(Math.round(currentTime > 0 ? currentTime : (isFinite(audioDuration) && audioDuration > 0 ? audioDuration : fallbackDuration)))}
          </span>

          <div className="flex items-center gap-1.5">
            {/* Speed Toggle Pill (WhatsApp 1x, 1.5x, 2x) */}
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-1.5 py-0.5 rounded-full bg-black/10 hover:bg-black/20 text-slate-700 font-bold text-[9px] transition-colors cursor-pointer"
              title="Toggle playback speed (1x, 1.5x, 2x)"
            >
              {playbackRate}x
            </button>

            {/* Download audio backup link */}
            <a
              href={blobUrl || voiceNote.url}
              download={`voicenote_${Date.now()}.${mimeType?.includes('webm') ? 'webm' : mimeType?.includes('ogg') ? 'ogg' : mimeType?.includes('mp4') || mimeType?.includes('m4a') ? 'm4a' : mimeType?.includes('mp3') ? 'mp3' : 'wav'}`}
              className="p-1 hover:text-slate-900 transition-colors cursor-pointer"
              title="Download audio recording"
            >
              <Download className="w-3 h-3 text-slate-500" />
            </a>

            {/* WhatsApp voice note mic badge */}
            <Mic className={`w-3 h-3 ${isSender ? 'text-[#243346]' : 'text-[#00a884]'}`} />
          </div>
        </div>

        {loadError && (
          <span className="text-[9px] text-rose-500 font-sans mt-0.5">
            Unable to stream audio codec. Click download icon to listen offline.
          </span>
        )}
      </div>
    </div>
  );
};

