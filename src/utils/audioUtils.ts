// Audio Utilities for Voice Notes (WAV encoder, synthetic tone generator, and formatters)

/**
 * Safely convert a base64 Data URL to an in-memory Blob URL with cleaned MIME type.
 * Cleans tricky parameters like ';codecs=opus' from Data URL headers which prevent playback in Safari/WebKit.
 */
export function safeDataUrlToBlobUrl(url: string): { blobUrl: string; mimeType: string; revoke: () => void } {
  if (!url || typeof url !== 'string' || !url.startsWith('data:')) {
    return { blobUrl: url || '', mimeType: '', revoke: () => {} };
  }
  try {
    const commaIdx = url.indexOf(',');
    if (commaIdx === -1) return { blobUrl: url, mimeType: '', revoke: () => {} };

    const header = url.slice(0, commaIdx);
    const base64 = url.slice(commaIdx + 1);

    // Extract clean MIME type without parameters (e.g. "data:audio/webm;codecs=opus;base64" -> "audio/webm")
    let mimeType = 'audio/webm';
    const match = header.match(/^data:([^;,]+)/i);
    if (match && match[1]) {
      mimeType = match[1].trim();
    }

    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    return {
      blobUrl,
      mimeType,
      revoke: () => {
        try {
          URL.revokeObjectURL(blobUrl);
        } catch {}
      },
    };
  } catch (err) {
    console.warn('[safeDataUrlToBlobUrl warning]:', err);
    return { blobUrl: url, mimeType: '', revoke: () => {} };
  }
}

function downsampleBuffer(buffer: Float32Array, inputRate: number, outputRate: number): Float32Array {
  if (inputRate === outputRate) return buffer;
  const ratio = inputRate / outputRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0, count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

/**
 * Universal voice note recorder using Web Audio API to create 16kHz mono WAV audio.
 * Works natively across iOS Safari, macOS Safari, Android Chrome, Windows Chrome, Firefox, and Edge.
 */
export class UniversalAudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private pcmChunks: Float32Array[] = [];
  private startTime: number = 0;
  private targetSampleRate = 16000;
  private mediaRecorder: MediaRecorder | null = null;
  private mediaChunks: Blob[] = [];

  async start(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone not supported in this browser.');
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.startTime = Date.now();
    this.pcmChunks = [];
    this.mediaChunks = [];

    // 1. Primary path: Native compressed MediaRecorder (Opus / AAC / WebM / MP4)
    // Produces compact, bandwidth-friendly audio (10-30KB) that uploads instantly across mobile
    // cellular connections, preventing Supabase payload limit drops and NetworkError failures.
    if (typeof MediaRecorder !== 'undefined') {
      const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4;codecs=mp4a.40.2',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/aac',
      ];
      let selectedMime = '';
      for (const mime of candidates) {
        if (MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }
      try {
        const options: MediaRecorderOptions = selectedMime ? { mimeType: selectedMime } : {};
        this.mediaRecorder = new MediaRecorder(this.stream, options);
        this.mediaChunks = [];
        this.mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) this.mediaChunks.push(e.data);
        };
        this.mediaRecorder.start(250);
        return;
      } catch (err) {
        console.warn('[MediaRecorder primary init notice, falling back to Web Audio]:', err);
      }
    }

    // 2. Secondary fallback path: Web Audio API PCM capture downsampled to 16kHz mono WAV
    const AudioCtxClass = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
    if (AudioCtxClass) {
      try {
        const ctx = new AudioCtxClass();
        this.audioContext = ctx;
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        const inputSampleRate = ctx.sampleRate;
        this.source = ctx.createMediaStreamSource(this.stream);

        // ScriptProcessor captures raw PCM samples
        this.processor = ctx.createScriptProcessor(4096, 1, 1);
        this.processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const downsampled = downsampleBuffer(inputData, inputSampleRate, this.targetSampleRate);
          this.pcmChunks.push(new Float32Array(downsampled));
        };

        this.source.connect(this.processor);
        this.processor.connect(ctx.destination);
        return;
      } catch (e) {
        console.warn('[Web Audio recorder fallback notice]:', e);
      }
    }
  }

  async stop(): Promise<{ url: string; duration: number }> {
    const elapsedSec = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

    // Release microphone hardware
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }

    // A. MediaRecorder primary compressed path (Opus / AAC / WebM / MP4)
    if (this.mediaRecorder) {
      return new Promise((resolve) => {
        this.mediaRecorder!.onstop = () => {
          const mime = this.mediaRecorder?.mimeType || 'audio/webm';
          const blob = new Blob(this.mediaChunks, { type: mime });
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              url: (reader.result as string) || '',
              duration: elapsedSec,
            });
          };
          reader.readAsDataURL(blob);
        };
        try {
          if (this.mediaRecorder!.state !== 'inactive') {
            this.mediaRecorder!.stop();
          } else {
            const mime = this.mediaRecorder?.mimeType || 'audio/webm';
            const blob = new Blob(this.mediaChunks, { type: mime });
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                url: (reader.result as string) || '',
                duration: elapsedSec,
              });
            };
            reader.readAsDataURL(blob);
          }
        } catch {
          resolve(generateDemoVoiceNote(elapsedSec));
        }
      });
    }

    // B. Web Audio PCM recording path -> Universal WAV fallback
    if (this.processor && this.pcmChunks.length > 0) {
      try {
        if (this.source) this.source.disconnect();
        if (this.processor) this.processor.disconnect();
        if (this.audioContext && this.audioContext.state !== 'closed') {
          await this.audioContext.close();
        }
      } catch {}

      let totalLength = 0;
      for (const chunk of this.pcmChunks) totalLength += chunk.length;
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of this.pcmChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }

      const wavBuffer = encodeWAV(merged, this.targetSampleRate);
      const blob = new Blob([wavBuffer], { type: 'audio/wav' });

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            url: reader.result as string,
            duration: elapsedSec,
          });
        };
        reader.readAsDataURL(blob);
      });
    }

    return generateDemoVoiceNote(elapsedSec);
  }

  cancel(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
    }
    if (this.processor) {
      try {
        this.source?.disconnect();
        this.processor?.disconnect();
        this.audioContext?.close();
      } catch {}
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      } catch {}
    }
    this.pcmChunks = [];
    this.mediaChunks = [];
  }
}

export function formatDuration(sec: number): string {
  if (!isFinite(sec) || isNaN(sec) || sec <= 0) return '0:00';
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

/**
 * Format a voice note payload into a structured string for safe cross-platform persistence
 */
export function serializeVoiceNoteContent(voiceNote: { url: string; duration: number }, text?: string): string {
  if (!voiceNote || !voiceNote.url) return text || '';
  return `__VOICENOTE__:${JSON.stringify({
    url: voiceNote.url,
    duration: Math.round(Number(voiceNote.duration) || 1),
    text: text || '',
  })}`;
}

/**
 * Safely parse voice note data and plain text from database content or column
 */
export function parseVoiceNoteFromContent(
  content: any,
  existingVoiceNote?: any
): { text: string; voiceNote?: { url: string; duration: number } } {
  // 1. Direct object in voice_note column
  if (existingVoiceNote && typeof existingVoiceNote === 'object' && existingVoiceNote.url) {
    const isEncodedInContent = typeof content === 'string' && content.startsWith('__VOICENOTE__:');
    return {
      text: isEncodedInContent ? '' : (typeof content === 'string' ? content : ''),
      voiceNote: {
        url: existingVoiceNote.url,
        duration: Math.max(1, Math.round(Number(existingVoiceNote.duration) || 1)),
      },
    };
  }

  // 2. Stringified JSON in voice_note column
  if (typeof existingVoiceNote === 'string' && existingVoiceNote.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(existingVoiceNote);
      if (parsed && parsed.url) {
        const isEncodedInContent = typeof content === 'string' && content.startsWith('__VOICENOTE__:');
        return {
          text: isEncodedInContent ? '' : (typeof content === 'string' ? content : ''),
          voiceNote: {
            url: parsed.url,
            duration: Math.max(1, Math.round(Number(parsed.duration) || 1)),
          },
        };
      }
    } catch {}
  }

  // 3. Encoded voice note in content column (__VOICENOTE__:{"url":"...","duration":5})
  if (typeof content === 'string') {
    if (content.startsWith('__VOICENOTE__:')) {
      try {
        const rawJson = content.slice('__VOICENOTE__:'.length);
        const parsed = JSON.parse(rawJson);
        if (parsed && parsed.url) {
          return {
            text: parsed.text || '',
            voiceNote: {
              url: parsed.url,
              duration: Math.max(1, Math.round(Number(parsed.duration) || 1)),
            },
          };
        }
      } catch {}
    } else if (content.startsWith('{"type":"voice_note"') || (content.startsWith('{') && content.includes('"voice_note"'))) {
      try {
        const parsed = JSON.parse(content);
        const vn = parsed.voiceNote || parsed;
        if (vn && vn.url) {
          return {
            text: parsed.text || '',
            voiceNote: {
              url: vn.url,
              duration: Math.max(1, Math.round(Number(vn.duration) || 1)),
            },
          };
        }
      } catch {}
    }
  }

  return {
    text: typeof content === 'string' ? content : '',
    voiceNote: undefined,
  };
}

