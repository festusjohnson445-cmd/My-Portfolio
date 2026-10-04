// Audio Utilities for Voice Notes (WAV encoder, synthetic tone generator, and formatters)

export function formatDuration(sec: number): string {
  if (isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Float to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/**
 * Generates an audio data URL voice note (used for demo/fallback when microphone hardware is unavailable)
 */
export async function generateDemoVoiceNote(durationSec = 6, label = 'Audio Note'): Promise<{ url: string; duration: number }> {
  const sampleRate = 44100;
  const numSamples = sampleRate * durationSec;
  const buffer = new Float32Array(numSamples);

  // Generate a smooth chord progression imitating a voice memo
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const baseFreq = 320 + Math.sin(t * 3) * 60 + Math.sin(t * 8) * 30;
    const harmonic = Math.sin(2 * Math.PI * (baseFreq * 1.5) * t) * 0.2;
    const env = Math.exp(-((t % 1.5) * 1.5)) * 0.45;
    buffer[i] = (Math.sin(2 * Math.PI * baseFreq * t) * 0.4 + harmonic) * env;
  }

  const wavBuffer = encodeWAV(buffer, sampleRate);
  const blob = new Blob([wavBuffer], { type: 'audio/wav' });

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({
        url: reader.result as string,
        duration: durationSec,
      });
    };
    reader.readAsDataURL(blob);
  });
}
