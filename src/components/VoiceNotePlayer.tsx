import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Mic } from 'lucide-react';
import { formatDuration } from '../utils/audioUtils';

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(voiceNote.url);
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onError = () => {
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [voiceNote.url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => setIsPlaying(true)).catch((e) => {
        console.warn('Playback error:', e);
        setIsPlaying(false);
      });
    }
  };

  const handleSeek = (percentage: number) => {
    if (!audioRef.current) return;
    const dur = voiceNote.duration || audioRef.current.duration || 1;
    const target = percentage * dur;
    audioRef.current.currentTime = target;
    setCurrentTime(target);
  };

  const cycleSpeed = () => {
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const totalDuration = voiceNote.duration || (audioRef.current?.duration ? Math.round(audioRef.current.duration) : 1);
  const progressPct = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;

  // 24 simulated acoustic waveform bars
  const waveformHeights = [
    12, 20, 14, 28, 18, 30, 24, 16, 22, 28,
    32, 20, 26, 14, 22, 30, 18, 24, 16, 20,
    14, 24, 18, 12
  ];

  return (
    <div className="flex items-center gap-2.5 py-1 min-w-[210px] sm:min-w-[260px] select-none font-sans">
      {/* Play / Pause Round Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm transition-all active:scale-95 cursor-pointer ${
          isSender
            ? 'bg-[#243346] hover:bg-[#1a2533] text-white'
            : 'bg-slate-800 hover:bg-slate-900 text-white'
        }`}
        title={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
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
                className={`w-[3px] rounded-full transition-colors ${
                  isPlayed
                    ? isSender
                      ? 'bg-[#243346]'
                      : 'bg-slate-800'
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
          <span>
            {formatDuration(Math.round(currentTime > 0 ? currentTime : totalDuration))}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-1.5 py-0.5 rounded bg-black/10 hover:bg-black/20 text-slate-700 font-bold text-[9px] transition-colors cursor-pointer"
              title="Toggle speed (1x, 1.5x, 2x)"
            >
              {playbackRate}x
            </button>

            <a
              href={voiceNote.url}
              download="voice_note.wav"
              className="p-1 hover:text-slate-900 transition-colors cursor-pointer"
              title="Download audio recording"
            >
              <Download className="w-3 h-3 text-slate-500" />
            </a>

            <Mic className="w-3 h-3 text-slate-400" />
          </div>
        </div>
      </div>
    </div>
  );
};
