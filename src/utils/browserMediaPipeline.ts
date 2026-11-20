import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import ffmpegCoreJsUrl from '@ffmpeg/core?url';
import ffmpegCoreWasmUrl from '@ffmpeg/core/wasm?url';
import * as tus from 'tus-js-client';
import heic2any from 'heic2any';
import {
  supabase,
  getResolvedSupabaseConfig,
  buildSupabaseStorageAuthHeaders,
  isRealOwnerUser,
} from './supabase';
import { formatBytes } from './portfolioSupabase';
import { probeLocalFileDuration } from './mediaMetadata';

function resolveMaxUploadMb(): number {
  const raw = Number((import.meta as any).env?.VITE_MAX_UPLOAD_MB);
  return Number.isFinite(raw) && raw > 0 ? raw : 60;
}

export const MAX_VIDEO_MB = resolveMaxUploadMb();
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024; // 60 MB default ceiling
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024; // 6 MB TUS threshold
const FFMPEG_CDN_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

export type BrowserPipelineProgress = (progress: number, stage: string) => void;

export interface BrowserOptimizedImageResult {
  blob: Blob;
  mimeType: string;
  fileName: string;
  format: 'webp' | 'jpeg';
  width: number;
  height: number;
  resolution: string;
  originalBytes: number;
  optimizedBytes: number;
  compressionPct: number;
}

export interface BrowserCompressedVideoResult {
  videoBlob: Blob;
  mimeType: string;
  fileName: string;
  format: string;
  width?: number;
  height?: number;
  resolution?: string;
  durationSec?: number;
  originalBytes: number;
  optimizedBytes: number;
  compressionPct: number;
  usedFallbackDirect: boolean;
  fallbackReason?: string;
  poster?: {
    blob: Blob;
    mimeType: string;
    fileName: string;
  };
}

let ffmpegSingleton: FFmpeg | null = null;
let ffmpegLoadPromise: Promise<FFmpeg> | null = null;
let ffmpegMutex: Promise<void> = Promise.resolve();

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Upload cancelled', 'AbortError');
  }
}

export function validateVideoSizeLimit(file: File): void {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `Video "${file.name}" (${formatBytes(file.size)}) exceeds the ${MAX_VIDEO_MB} MB maximum file size limit. Please trim or export at a lower bitrate (≤ ${MAX_VIDEO_MB} MB) before uploading.`
    );
  }
}

async function resolveCoreAssetBlobUrls(): Promise<{ coreURL: string; wasmURL: string }> {
  try {
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(ffmpegCoreJsUrl, 'text/javascript'),
      toBlobURL(ffmpegCoreWasmUrl, 'application/wasm'),
    ]);
    return { coreURL, wasmURL };
  } catch {
    const [coreURL, wasmURL] = await Promise.all([
      toBlobURL(`${FFMPEG_CDN_BASE}/ffmpeg-core.js`, 'text/javascript'),
      toBlobURL(`${FFMPEG_CDN_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
    ]);
    return { coreURL, wasmURL };
  }
}

/**
 * Session-level singleton loader for @ffmpeg/ffmpeg (loads once per browser session).
 */
export async function getFFmpegSingleton(signal?: AbortSignal): Promise<FFmpeg> {
  throwIfAborted(signal);
  if (ffmpegSingleton && ffmpegSingleton.loaded) {
    return ffmpegSingleton;
  }
  if (ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }

  ffmpegLoadPromise = (async () => {
    const instance = new FFmpeg();
    const { coreURL, wasmURL } = await resolveCoreAssetBlobUrls();
    throwIfAborted(signal);
    await instance.load({ coreURL, wasmURL });
    ffmpegSingleton = instance;
    return instance;
  })().catch((err) => {
    ffmpegLoadPromise = null;
    ffmpegSingleton = null;
    throw err;
  });

  return ffmpegLoadPromise;
}

function resetFFmpegSingleton(): void {
  try {
    ffmpegSingleton?.terminate();
  } catch {}
  ffmpegSingleton = null;
  ffmpegLoadPromise = null;
}

async function withFFmpegLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = ffmpegMutex;
  let release!: () => void;
  ffmpegMutex = new Promise<void>((res) => {
    release = res;
  });
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function loadHtmlImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(objUrl);
      reject(e);
    };
    img.src = objUrl;
  });
}

/**
 * Browser-side image optimization: decodes (including HEIC), strips EXIF via Canvas,
 * downscales cleanly to max 1600px, and exports lightweight WebP (or JPEG fallback).
 */
export async function optimizeImageInBrowser(
  file: File
): Promise<BrowserOptimizedImageResult> {
  let workingBlob: Blob = file;
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.(heic|heif)$/i.test(file.name);

  if (isHeic) {
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    workingBlob = Array.isArray(converted) ? converted[0] : converted;
  }

  let bitmap: ImageBitmap | HTMLImageElement;
  let width = 0;
  let height = 0;
  let needsCloseBitmap = false;

  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(workingBlob, { imageOrientation: 'from-image' });
      bitmap = bmp;
      width = bmp.width;
      height = bmp.height;
      needsCloseBitmap = true;
    } catch {
      const img = await loadHtmlImageFromBlob(workingBlob);
      bitmap = img;
      width = img.naturalWidth || img.width;
      height = img.naturalHeight || img.height;
    }
  } else {
    const img = await loadHtmlImageFromBlob(workingBlob);
    bitmap = img;
    width = img.naturalWidth || img.width;
    height = img.naturalHeight || img.height;
  }

  try {
    const maxDim = 1600;
    const scale = Math.max(width, height) > maxDim ? maxDim / Math.max(width, height) : 1;
    const targetW = Math.max(1, Math.round(width * scale));
    const targetH = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser Canvas 2D context is unavailable for image optimization.');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);

    const exportBlob = (mime: string, quality: number) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));

    const stem = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'image';

    const webpBlob = await exportBlob('image/webp', 0.8);
    const jpegBlob = await exportBlob('image/jpeg', 0.82);

    let chosenBlob: Blob | null = null;
    let format: 'webp' | 'jpeg' = 'webp';
    let mimeType = 'image/webp';
    let fileName = `${stem}.webp`;

    if (webpBlob && webpBlob.type === 'image/webp' && webpBlob.size > 0) {
      chosenBlob = webpBlob;
      if (jpegBlob && jpegBlob.size > 0 && jpegBlob.size < webpBlob.size * 0.9) {
        chosenBlob = jpegBlob;
        format = 'jpeg';
        mimeType = 'image/jpeg';
        fileName = `${stem}.jpg`;
      }
    } else if (jpegBlob && jpegBlob.size > 0) {
      chosenBlob = jpegBlob;
      format = 'jpeg';
      mimeType = 'image/jpeg';
      fileName = `${stem}.jpg`;
    }

    if (!chosenBlob) {
      throw new Error('Failed to encode image in browser.');
    }

    const compressionPct =
      file.size > 0
        ? Math.max(0, Math.round(((file.size - chosenBlob.size) / file.size) * 1000) / 10)
        : 0;

    return {
      blob: chosenBlob,
      mimeType,
      fileName,
      format,
      width: targetW,
      height: targetH,
      resolution: `${targetW}x${targetH}`,
      originalBytes: file.size,
      optimizedBytes: chosenBlob.size,
      compressionPct,
    };
  } finally {
    if (needsCloseBitmap && typeof (bitmap as ImageBitmap).close === 'function') {
      try {
        (bitmap as ImageBitmap).close();
      } catch {}
    }
  }
}

/**
 * Extracts a poster thumbnail frame + video dimensions/duration from a video Blob in the browser.
 */
export async function extractVideoPosterAndMetadata(
  videoBlob: Blob,
  baseName: string
): Promise<{
  poster?: { blob: Blob; mimeType: string; fileName: string };
  width?: number;
  height?: number;
  durationSec?: number;
}> {
  if (typeof document === 'undefined') return {};
  const objUrl = URL.createObjectURL(videoBlob);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let settled = false;
    const stem = baseName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'video';

    const finish = (res: {
      poster?: { blob: Blob; mimeType: string; fileName: string };
      width?: number;
      height?: number;
      durationSec?: number;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.removeAttribute('src');
      try {
        video.load();
      } catch {}
      URL.revokeObjectURL(objUrl);
      resolve(res);
    };

    const timeout = setTimeout(() => finish({}), 8000);
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    let width: number | undefined;
    let height: number | undefined;
    let durationSec: number | undefined;

    const captureFrame = () => {
      try {
        const vw = video.videoWidth || width || 0;
        const vh = video.videoHeight || height || 0;
        if (!vw || !vh) {
          finish({ width, height, durationSec });
          return;
        }
        const scale = Math.min(1, 1280 / vw, 720 / vh);
        const tw = Math.max(2, Math.round(vw * scale));
        const th = Math.max(2, Math.round(vh * scale));
        const canvas = document.createElement('canvas');
        canvas.width = tw;
        canvas.height = th;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish({ width: vw, height: vh, durationSec });
          return;
        }
        ctx.drawImage(video, 0, 0, tw, th);
        canvas.toBlob(
          (webpBlob) => {
            if (webpBlob && webpBlob.type === 'image/webp' && webpBlob.size > 0) {
              finish({
                poster: { blob: webpBlob, mimeType: 'image/webp', fileName: `${stem}_poster.webp` },
                width: vw,
                height: vh,
                durationSec,
              });
              return;
            }
            canvas.toBlob(
              (jpegBlob) => {
                finish({
                  poster:
                    jpegBlob && jpegBlob.size > 0
                      ? { blob: jpegBlob, mimeType: 'image/jpeg', fileName: `${stem}_poster.jpg` }
                      : undefined,
                  width: vw,
                  height: vh,
                  durationSec,
                });
              },
              'image/jpeg',
              0.82
            );
          },
          'image/webp',
          0.8
        );
      } catch {
        finish({ width, height, durationSec });
      }
    };

    video.onloadedmetadata = () => {
      width = video.videoWidth || undefined;
      height = video.videoHeight || undefined;
      const d = video.duration;
      durationSec = d && Number.isFinite(d) && d > 0 ? Math.round(d * 10) / 10 : undefined;
      const targetSeek = durationSec ? Math.min(1.0, Math.max(0.1, durationSec * 0.12)) : 0.25;
      try {
        video.currentTime = targetSeek;
      } catch {
        captureFrame();
      }
    };

    video.onseeked = () => {
      captureFrame();
    };

    video.onerror = () => finish({});
    video.src = objUrl;
  });
}

/**
 * Compresses video strictly in the browser via singleton @ffmpeg/ffmpeg using the tuned
 * hqdn3d + unsharp + 720p H.264/AAC profile, extracts a poster thumbnail, cleans MEMFS
 * in `finally`, and falls back to direct upload if browser compression fails or times out.
 */
export async function compressVideoInBrowser(
  file: File,
  onProgress?: BrowserPipelineProgress,
  signal?: AbortSignal
): Promise<BrowserCompressedVideoResult> {
  validateVideoSizeLimit(file);
  throwIfAborted(signal);

  const localDurationPromise = probeLocalFileDuration(file);
  const stem = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_') || 'video';
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';

  const runDirectFallback = async (reason: string): Promise<BrowserCompressedVideoResult> => {
    throwIfAborted(signal);
    onProgress?.(68, 'Compression skipped — preparing direct upload...');
    const meta = await extractVideoPosterAndMetadata(file, file.name);
    const localDur = meta.durationSec ?? (await localDurationPromise);
    return {
      videoBlob: file,
      mimeType: file.type || 'video/mp4',
      fileName: file.name,
      format: ext === 'webm' ? 'webm' : 'h264',
      width: meta.width,
      height: meta.height,
      resolution: meta.width && meta.height ? `${meta.width}x${meta.height}` : undefined,
      durationSec: localDur,
      originalBytes: file.size,
      optimizedBytes: file.size,
      compressionPct: 0,
      usedFallbackDirect: true,
      fallbackReason: reason,
      poster: meta.poster,
    };
  };

  try {
    return await withFFmpegLock(async () => {
      throwIfAborted(signal);
      onProgress?.(6, 'Loading browser video compressor...');
      const ffmpeg = await getFFmpegSingleton(signal);
      throwIfAborted(signal);

      const jobTag = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const inName = `in_${jobTag}.${ext}`;
      const outName = `out_${jobTag}.mp4`;
      const posterName = `poster_${jobTag}.jpg`;

      let lastProgressAt = Date.now();
      let latestRatio = 0;

      const onProgressEvent = ({ progress }: { progress: number; time: number }) => {
        if (!Number.isFinite(progress)) return;
        lastProgressAt = Date.now();
        latestRatio = Math.max(0, Math.min(1, progress));
        const mapped = Math.min(68, Math.max(14, Math.round(14 + latestRatio * 54)));
        onProgress?.(mapped, `Compressing video (${Math.round(latestRatio * 100)}%)...`);
      };

      let resolvedDimensions: { width?: number; height?: number } = {};
      const onLogEvent = ({ message }: { type: string; message: string }) => {
        if (!message) return;
        // Capture output stream dimensions from ffmpeg log if available
        const m = message.match(/Stream #0:0.*Video:.*,\s*(\d{2,4})x(\d{2,4})/);
        if (m) {
          resolvedDimensions = { width: Number(m[1]), height: Number(m[2]) };
        }
      };

      ffmpeg.on('progress', onProgressEvent);
      ffmpeg.on('log', onLogEvent);

      // Watchdog prevents hangs near 60 MB on constrained devices
      const maxTotalMs = file.size > 35 * 1024 * 1024 ? 210_000 : 150_000;
      const stallMs = 45_000;
      let timedOutReason = '';
      const watchdog = window.setInterval(() => {
        const idleFor = Date.now() - lastProgressAt;
        if (idleFor > stallMs) {
          timedOutReason = 'Browser video compression stalled on this device.';
          resetFFmpegSingleton();
        }
      }, 2000);
      const hardTimer = window.setTimeout(() => {
        timedOutReason = 'Browser video compression timed out.';
        resetFFmpegSingleton();
      }, maxTotalMs);

      const onCallerAbort = () => {
        resetFFmpegSingleton();
      };
      signal?.addEventListener('abort', onCallerAbort, { once: true });

      try {
        onProgress?.(10, 'Preparing video frames in browser...');
        const fileBytes = new Uint8Array(await file.arrayBuffer());
        throwIfAborted(signal);
        await ffmpeg.writeFile(inName, fileBytes);
        lastProgressAt = Date.now();

        onProgress?.(14, 'Compressing video (H.264 720p)...');

        const vfFilter =
          "hqdn3d=1.5:1.5:3:3,unsharp=5:5:0.35:5:5:0.0,scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,setsar=1";

        const exitCode = await ffmpeg.exec(
          [
            '-i',
            inName,
            '-vf',
            vfFilter,
            '-c:v',
            'libx264',
            '-crf',
            '23',
            '-preset',
            'medium',
            '-pix_fmt',
            'yuv420p',
            '-movflags',
            '+faststart',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            outName,
          ],
          maxTotalMs,
          { signal }
        );

        throwIfAborted(signal);
        if (timedOutReason) {
          throw new Error(timedOutReason);
        }
        if (exitCode !== 0) {
          throw new Error(`FFmpeg exited with code ${exitCode}.`);
        }

        const outData = await ffmpeg.readFile(outName);
        if (!(outData instanceof Uint8Array) || outData.byteLength === 0) {
          throw new Error('Compressed video output was empty.');
        }

        const compressedBytes = new Uint8Array(outData);
        const videoBlob = new Blob([compressedBytes], { type: 'video/mp4' });

        // Discard original input from MEMFS immediately before thumbnail work
        await ffmpeg.deleteFile(inName).catch(() => {});

        onProgress?.(70, 'Extracting poster thumbnail...');
        const meta = await extractVideoPosterAndMetadata(videoBlob, file.name);
        let poster = meta.poster;

        // If HTMLVideoElement frame capture didn't yield a poster, capture 1 frame via FFmpeg
        if (!poster) {
          try {
            const pExit = await ffmpeg.exec(
              ['-ss', '00:00:01', '-i', outName, '-vframes', '1', '-q:v', '3', posterName],
              15_000,
              { signal }
            );
            if (pExit === 0) {
              const pBytes = await ffmpeg.readFile(posterName);
              if (pBytes instanceof Uint8Array && pBytes.byteLength > 0) {
                const rawPosterBlob = new Blob([new Uint8Array(pBytes)], { type: 'image/jpeg' });
                // Re-encode to lightweight WebP if possible via canvas
                try {
                  const posterFile = new File([rawPosterBlob], `${stem}_poster.jpg`, { type: 'image/jpeg' });
                  const optPoster = await optimizeImageInBrowser(posterFile);
                  poster = {
                    blob: optPoster.blob,
                    mimeType: optPoster.mimeType,
                    fileName: `${stem}_poster.${optPoster.format === 'webp' ? 'webp' : 'jpg'}`,
                  };
                } catch {
                  poster = {
                    blob: rawPosterBlob,
                    mimeType: 'image/jpeg',
                    fileName: `${stem}_poster.jpg`,
                  };
                }
              }
            }
          } catch {}
        }

        const width = meta.width || resolvedDimensions.width;
        const height = meta.height || resolvedDimensions.height;
        const durationSec = meta.durationSec ?? (await localDurationPromise);
        const compressionPct =
          file.size > 0
            ? Math.round(((file.size - videoBlob.size) / file.size) * 1000) / 10
            : 0;

        return {
          videoBlob,
          mimeType: 'video/mp4',
          fileName: `${stem}.mp4`,
          format: 'h264',
          width,
          height,
          resolution: width && height ? `${width}x${height}` : '720p',
          durationSec,
          originalBytes: file.size,
          optimizedBytes: videoBlob.size,
          compressionPct,
          usedFallbackDirect: false,
          poster,
        };
      } finally {
        clearInterval(watchdog);
        clearTimeout(hardTimer);
        signal?.removeEventListener('abort', onCallerAbort);
        ffmpeg.off('progress', onProgressEvent);
        ffmpeg.off('log', onLogEvent);
        await ffmpeg.deleteFile(inName).catch(() => {});
        await ffmpeg.deleteFile(outName).catch(() => {});
        await ffmpeg.deleteFile(posterName).catch(() => {});
      }
    });
  } catch (err: any) {
    if (signal?.aborted || err?.name === 'AbortError' || /abort|cancell?ed/i.test(String(err?.message || ''))) {
      throw new DOMException('Upload cancelled', 'AbortError');
    }
    console.warn('[Browser FFmpeg] Falling back to direct upload:', err?.message || err);
    return await runDirectFallback(err?.message || 'Browser compression failed');
  }
}

async function resolveStorageUploadAuth(): Promise<{
  bearerJwt: string | null;
  ownerPrefix: string;
}> {
  let ownerPrefix = '';
  let bearerJwt: string | null = null;
  try {
    let { data } = await supabase.auth.getSession();
    if (data?.session?.expires_at && data.session.expires_at * 1000 < Date.now() + 120_000) {
      const refreshed: any = await Promise.race([
        supabase.auth.refreshSession().catch(() => null),
        new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      if (refreshed?.data?.session) data = refreshed.data;
    }
    if (data?.session?.user && isRealOwnerUser(data.session.user)) {
      ownerPrefix = data.session.user.id;
    }
    const isExpired = data?.session?.expires_at ? data.session.expires_at * 1000 <= Date.now() + 5000 : false;
    if (data?.session?.access_token && !isExpired) {
      bearerJwt = data.session.access_token;
    }
  } catch {}

  return {
    bearerJwt,
    ownerPrefix,
  };
}

function uploadViaXhr(params: {
  url: string;
  blob: Blob;
  headers: Record<string, string>;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
}): Promise<{ status: number; responseText: string }> {
  return new Promise((resolve, reject) => {
    throwIfAborted(params.signal);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', params.url, true);
    for (const [k, v] of Object.entries(params.headers)) {
      xhr.setRequestHeader(k, v);
    }

    const onAbort = () => {
      try {
        xhr.abort();
      } catch {}
      reject(new DOMException('Upload cancelled', 'AbortError'));
    };
    params.signal?.addEventListener('abort', onAbort, { once: true });

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        params.onProgress?.(ev.loaded, ev.total);
      }
    };
    xhr.onload = () => {
      params.signal?.removeEventListener('abort', onAbort);
      resolve({ status: xhr.status, responseText: xhr.responseText || '' });
    };
    xhr.onerror = () => {
      params.signal?.removeEventListener('abort', onAbort);
      reject(new Error('Network connection failed during direct upload to Supabase Storage.'));
    };
    xhr.ontimeout = () => {
      params.signal?.removeEventListener('abort', onAbort);
      reject(new Error('Upload timed out while sending file to Supabase Storage.'));
    };
    xhr.timeout = 120_000;
    xhr.send(params.blob);
  });
}

function uploadViaTusResumable(params: {
  endpoint: string;
  bucket: string;
  storagePath: string;
  blob: Blob;
  contentType: string;
  headers: Record<string, string>;
  onProgress?: (uploadedBytes: number, totalBytes: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(params.signal);
    let settled = false;

    const tusHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(params.headers)) {
      tusHeaders[k.toLowerCase()] = v;
    }

    const upload = new tus.Upload(params.blob, {
      endpoint: params.endpoint,
      retryDelays: [0, 2000, 5000, 10000],
      headers: tusHeaders,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: params.bucket,
        objectName: params.storagePath,
        contentType: params.contentType || 'application/octet-stream',
        cacheControl: '3600',
      },
      chunkSize: 6 * 1024 * 1024, // Supabase Storage standard 6 MB TUS chunk size
      onError: (err) => {
        params.signal?.removeEventListener('abort', onAbort);
        if (settled) return;
        settled = true;
        reject(err);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        params.onProgress?.(bytesUploaded, bytesTotal);
      },
      onSuccess: () => {
        params.signal?.removeEventListener('abort', onAbort);
        if (settled) return;
        settled = true;
        resolve();
      },
    });

    const onAbort = () => {
      settled = true;
      void upload.abort(true).catch(() => {});
      reject(new DOMException('Upload cancelled', 'AbortError'));
    };
    params.signal?.addEventListener('abort', onAbort, { once: true });

    upload.findPreviousUploads().then((previousUploads) => {
      if (params.signal?.aborted) return;
      if (previousUploads.length > 0) {
        upload.resumeFromPreviousUpload(previousUploads[0]);
      }
      upload.start();
    }).catch(() => {
      if (!params.signal?.aborted) {
        upload.start();
      }
    });
  });
}

/**
 * Direct-to-Supabase Storage uploader using standard POST for <= 6 MB
 * and TUS resumable uploads for > 6 MB.
 */
export async function uploadBlobToSupabaseStorage(params: {
  bucket: 'projects' | 'articles' | 'materials' | 'avatars';
  blob: Blob;
  fileName: string;
  contentType: string;
  folderPrefix?: string;
  onBytesProgress?: (uploadedBytes: number, totalBytes: number, isResumable: boolean) => void;
  signal?: AbortSignal;
}): Promise<{
  publicUrl: string;
  storagePath: string;
  fileName: string;
  fileSize: string;
  usedResumable: boolean;
}> {
  throwIfAborted(params.signal);
  const cfg = getResolvedSupabaseConfig();
  const cleanName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniquePrefix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { bearerJwt, ownerPrefix } = await resolveStorageUploadAuth();
  const authHeaders = buildSupabaseStorageAuthHeaders(cfg, bearerJwt);

  const folder = params.folderPrefix || ownerPrefix || 'uploads';
  const pathParts = ownerPrefix && folder !== ownerPrefix
    ? [ownerPrefix, folder, `${uniquePrefix}_${cleanName}`]
    : [folder || 'submissions', `${uniquePrefix}_${cleanName}`];
  const storagePath = pathParts.filter(Boolean).join('/');
  const encodedPath = storagePath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');

  const contentType = params.contentType || 'application/octet-stream';
  const useResumable = params.blob.size > RESUMABLE_UPLOAD_THRESHOLD_BYTES;

  if (useResumable) {
    const tusEndpoint = `${cfg.url}/storage/v1/upload/resumable`;
    try {
      await uploadViaTusResumable({
        endpoint: tusEndpoint,
        bucket: params.bucket,
        storagePath,
        blob: params.blob,
        contentType,
        headers: authHeaders,
        onProgress: (up, total) => params.onBytesProgress?.(up, total, true),
        signal: params.signal,
      });
    } catch (tusErr: any) {
      if (params.signal?.aborted || tusErr?.name === 'AbortError') throw tusErr;
      // Retry anonymously if visitor upload on 'articles' failed due to stale JWT
      const status = tusErr?.originalResponse?.getStatus?.();
      if (
        params.bucket === 'articles' &&
        bearerJwt &&
        (status === 400 || status === 401 || status === 403)
      ) {
        await uploadViaTusResumable({
          endpoint: tusEndpoint,
          bucket: params.bucket,
          storagePath,
          blob: params.blob,
          contentType,
          headers: buildSupabaseStorageAuthHeaders(cfg, null),
          onProgress: (up, total) => params.onBytesProgress?.(up, total, true),
          signal: params.signal,
        });
      } else {
        throw new Error(
          `Resumable upload to "${params.bucket}" failed: ${tusErr?.message || 'Storage error'}`
        );
      }
    }
  } else {
    const uploadUrl = `${cfg.url}/storage/v1/object/${encodeURIComponent(params.bucket)}/${encodedPath}`;
    let resp = await uploadViaXhr({
      url: uploadUrl,
      blob: params.blob,
      headers: {
        ...authHeaders,
        'Content-Type': contentType,
      },
      onProgress: (up, total) => params.onBytesProgress?.(up, total, false),
      signal: params.signal,
    });

    if (
      (resp.status < 200 || resp.status >= 300) &&
      params.bucket === 'articles' &&
      bearerJwt &&
      (resp.status === 400 || resp.status === 401 || resp.status === 403)
    ) {
      resp = await uploadViaXhr({
        url: uploadUrl,
        blob: params.blob,
        headers: {
          ...buildSupabaseStorageAuthHeaders(cfg, null),
          'Content-Type': contentType,
        },
        onProgress: (up, total) => params.onBytesProgress?.(up, total, false),
        signal: params.signal,
      });
    }

    if (resp.status < 200 || resp.status >= 300) {
      throw new Error(
        `Storage upload to "${params.bucket}" failed: ${resp.responseText || `HTTP ${resp.status}`}`
      );
    }
  }

  const { data: pub } = supabase.storage.from(params.bucket).getPublicUrl(storagePath);
  const publicUrl =
    pub?.publicUrl ||
    `${cfg.url}/storage/v1/object/public/${encodeURIComponent(params.bucket)}/${encodedPath}`;

  return {
    publicUrl,
    storagePath,
    fileName: params.fileName,
    fileSize: formatBytes(params.blob.size),
    usedResumable: useResumable,
  };
}
