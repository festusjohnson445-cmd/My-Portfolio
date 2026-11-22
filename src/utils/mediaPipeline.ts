import { Upload as TusUpload } from 'tus-js-client';
import {
  supabase,
  getResolvedSupabaseConfig,
  isRealOwnerUser,
} from './supabase';

export type MediaPageType = 'project' | 'article';
export type MediaKindType = 'image' | 'video';
export type MediaJobStatus = 'uploading' | 'queued' | 'processing' | 'completed' | 'failed';

export interface MediaAssetRow {
  id: string;
  page_type: MediaPageType;
  media_type: MediaKindType;
  status: MediaJobStatus;
  raw_path: string;
  file_name?: string | null;
  av1_1080p_url?: string | null;
  av1_720p_url?: string | null;
  mp4_fallback_url?: string | null;
  optimized_image_url?: string | null;
  webp_fallback_url?: string | null;
  jpeg_fallback_url?: string | null;
  thumbnail_url?: string | null;
  original_bytes: number;
  optimized_bytes: number;
  compression_percent: number;
  width?: number | null;
  height?: number | null;
  error_message?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface PipelineProgressCallback {
  (progressPct: number, stage: string, row?: MediaAssetRow): void;
}

const RAW_BUCKET = 'raw-uploads';
const TUS_THRESHOLD_BYTES = 6 * 1024 * 1024; // Resumable TUS upload for files >= 6 MB

export function getMaxUploadBytes(): number {
  const envMb = Number((import.meta as any)?.env?.VITE_MAX_UPLOAD_MB || 50);
  const clampedMb = Number.isFinite(envMb) && envMb > 0 ? envMb : 50;
  return clampedMb * 1024 * 1024;
}

export function getMediaWorkerBaseUrl(): string {
  const raw = String((import.meta as any)?.env?.VITE_MEDIA_WORKER_URL || '').trim();
  return raw.replace(/\/+$/, '');
}

function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Upload cancelled', 'AbortError');
  }
}

async function resolveStorageAuthToken(pageType: MediaPageType): Promise<{ token: string; anonKey: string }> {
  const cfg = getResolvedSupabaseConfig();
  try {
    let { data } = await supabase.auth.getSession();
    if (data?.session?.expires_at && data.session.expires_at * 1000 < Date.now() + 120_000) {
      const refreshed: any = await Promise.race([
        supabase.auth.refreshSession().catch(() => null),
        new Promise((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);
      if (refreshed?.data?.session) data = refreshed.data;
    }
    const user = data?.session?.user;
    const accessToken = data?.session?.access_token;
    const notExpired = data?.session?.expires_at ? data.session.expires_at * 1000 > Date.now() + 5000 : false;
    if (accessToken && notExpired && (isRealOwnerUser(user) || pageType === 'article')) {
      return { token: accessToken, anonKey: cfg.anonKey };
    }
  } catch {}
  return { token: cfg.anonKey, anonKey: cfg.anonKey };
}

function uploadSmallRawWithXhr(params: {
  url: string;
  anonKey: string;
  bearerToken: string;
  file: File;
  onProgress: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(params.signal);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', params.url, true);
    xhr.setRequestHeader('apikey', params.anonKey);
    xhr.setRequestHeader('Authorization', `Bearer ${params.bearerToken}`);
    xhr.setRequestHeader('Content-Type', params.file.type || 'application/octet-stream');
    xhr.setRequestHeader('x-upsert', 'true');

    const onAbort = () => {
      try {
        xhr.abort();
      } catch {}
      reject(new DOMException('Upload cancelled', 'AbortError'));
    };
    params.signal?.addEventListener('abort', onAbort, { once: true });

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        params.onProgress(ev.loaded, ev.total);
      }
    };

    xhr.onload = () => {
      params.signal?.removeEventListener('abort', onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        params.onProgress(params.file.size, params.file.size);
        resolve();
      } else {
        const err: any = new Error(xhr.responseText || `Storage upload failed (HTTP ${xhr.status})`);
        err.status = xhr.status;
        reject(err);
      }
    };

    xhr.onerror = () => {
      params.signal?.removeEventListener('abort', onAbort);
      reject(new Error('Network error during direct Supabase upload.'));
    };

    xhr.send(params.file);
  });
}

function uploadLargeRawWithTus(params: {
  supabaseUrl: string;
  anonKey: string;
  bearerToken: string;
  objectName: string;
  file: File;
  onProgress: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(params.signal);
    const endpoint = `${params.supabaseUrl.replace(/\/+$/, '')}/storage/v1/upload/resumable`;
    let aborted = false;

    const upload = new TusUpload(params.file, {
      endpoint,
      retryDelays: [0, 1000, 3000, 5000],
      chunkSize: 6 * 1024 * 1024,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: {
        apikey: params.anonKey,
        authorization: `Bearer ${params.bearerToken}`,
        'x-upsert': 'true',
      },
      metadata: {
        bucketName: RAW_BUCKET,
        objectName: params.objectName,
        contentType: params.file.type || 'application/octet-stream',
        cacheControl: '3600',
      },
      onError: (err) => {
        params.signal?.removeEventListener('abort', onAbort);
        if (aborted) return;
        reject(err);
      },
      onProgress: (bytesUploaded, bytesTotal) => {
        params.onProgress(bytesUploaded, bytesTotal || params.file.size);
      },
      onSuccess: () => {
        params.signal?.removeEventListener('abort', onAbort);
        params.onProgress(params.file.size, params.file.size);
        resolve();
      },
    });

    const onAbort = () => {
      aborted = true;
      try {
        void upload.abort(true);
      } catch {}
      reject(new DOMException('Upload cancelled', 'AbortError'));
    };
    params.signal?.addEventListener('abort', onAbort, { once: true });

    upload
      .findPreviousUploads()
      .then((previous) => {
        if (aborted) return;
        if (previous.length > 0) {
          upload.resumeFromPreviousUpload(previous[0]);
        }
        upload.start();
      })
      .catch(() => {
        if (!aborted) upload.start();
      });
  });
}

async function uploadDirectToRawBucket(params: {
  pageType: MediaPageType;
  rawPath: string;
  file: File;
  onProgress: (pct: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const cfg = getResolvedSupabaseConfig();
  const { token, anonKey } = await resolveStorageAuthToken(params.pageType);
  const encodedPath = params.rawPath
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/');
  const standardUrl = `${cfg.url.replace(/\/+$/, '')}/storage/v1/object/${RAW_BUCKET}/${encodedPath}`;

  const handlePct = (loaded: number, total: number) => {
    const ratio = total > 0 ? Math.min(1, loaded / total) : 0;
    params.onProgress(Math.round(ratio * 100));
  };

  if (params.file.size >= TUS_THRESHOLD_BYTES) {
    try {
      await uploadLargeRawWithTus({
        supabaseUrl: cfg.url,
        anonKey,
        bearerToken: token,
        objectName: params.rawPath,
        file: params.file,
        onProgress: handlePct,
        signal: params.signal,
      });
      return;
    } catch (tusErr: any) {
      if (params.signal?.aborted || tusErr?.name === 'AbortError') throw tusErr;
      // Fallback to single XHR POST if resumable endpoint hits transient CORS/TLS issue
    }
  }

  try {
    await uploadSmallRawWithXhr({
      url: standardUrl,
      anonKey,
      bearerToken: token,
      file: params.file,
      onProgress: handlePct,
      signal: params.signal,
    });
  } catch (xhrErr: any) {
    if (params.signal?.aborted || xhrErr?.name === 'AbortError') throw xhrErr;
    // If stale user JWT fails on public article submission, retry cleanly with anonKey
    if (params.pageType === 'article' && token !== anonKey && (xhrErr?.status === 401 || xhrErr?.status === 403 || xhrErr?.status === 400)) {
      await uploadSmallRawWithXhr({
        url: standardUrl,
        anonKey,
        bearerToken: anonKey,
        file: params.file,
        onProgress: handlePct,
        signal: params.signal,
      });
      return;
    }
    throw xhrErr;
  }
}

/**
 * Sends a lightweight JSON-only trigger ({ jobId }) to wake/notify the Hugging Face Spaces worker.
 * Never sends raw file bytes, never includes WORKER_SECRET in the browser bundle, and never throws
 * unhandled "Failed to fetch" errors if the Space is waking from cold start.
 */
export async function triggerWorkerForJob(jobId: string): Promise<void> {
  const workerBase = getMediaWorkerBaseUrl();
  const payload = JSON.stringify({ jobId });

  const fireSafePost = async (url: string, timeoutMs: number) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: controller.signal,
      });
    } catch {
      // Intentionally swallowed: HF Spaces cold start / CORS / wake-up delays are handled by worker poller
    } finally {
      clearTimeout(timer);
    }
  };

  // Trigger both:
  // 1) Lightweight same-origin server relay (/api/media/trigger attaches WORKER_SECRET if configured)
  // 2) Direct wake-up ping to VITE_MEDIA_WORKER_URL (never throws Failed to fetch)
  await Promise.allSettled([
    fireSafePost('/api/media/trigger', 8_000),
    ...(workerBase ? [fireSafePost(`${workerBase}/process`, 8_000)] : []),
  ]);
}

export async function waitForMediaAssetCompletion(
  jobId: string,
  onProgress?: PipelineProgressCallback,
  signal?: AbortSignal
): Promise<MediaAssetRow> {
  const maxWaitMs = 20 * 60 * 1000;
  const startedAt = Date.now();
  let lastStatus: MediaJobStatus = 'queued';

  return new Promise<MediaAssetRow>((resolve, reject) => {
    let settled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let channel: any = null;

    const cleanup = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (channel) {
        supabase.removeChannel(channel).catch(() => {});
        channel = null;
      }
      signal?.removeEventListener('abort', onAbort);
    };

    const finishResolve = (row: MediaAssetRow) => {
      if (settled) return;
      settled = true;
      cleanup();
      onProgress?.(100, 'Optimization complete', row);
      resolve(row);
    };

    const finishReject = (message: string, row?: MediaAssetRow) => {
      if (settled) return;
      settled = true;
      cleanup();
      const err: any = new Error(message);
      err.jobId = jobId;
      err.mediaAssetRow = row;
      reject(err);
    };

    const onAbort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new DOMException('Upload cancelled', 'AbortError'));
    };

    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });

    const handleRowUpdate = (row: MediaAssetRow) => {
      if (settled || !row) return;
      lastStatus = row.status;

      if (row.status === 'queued') {
        const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
        const stage =
          elapsedSec > 8
            ? `Queued — waking media worker Space (${elapsedSec}s)...`
            : 'Queued for background optimization...';
        onProgress?.(55, stage, row);
      } else if (row.status === 'processing') {
        const pct = Math.min(92, 65 + Math.round((Date.now() - startedAt) / 2500));
        onProgress?.(
          pct,
          row.media_type === 'video'
            ? 'Enhancing & encoding AV1 + H.264 video streams...'
            : 'Optimizing image into AVIF, WebP & JPEG...',
          row
        );
      } else if (row.status === 'completed') {
        finishResolve(row);
      } else if (row.status === 'failed') {
        finishReject(row.error_message || 'Background media optimization failed.', row);
      }
    };

    try {
      channel = supabase
        .channel(`media_asset_job_${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'media_assets',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            if (payload?.new) {
              handleRowUpdate(payload.new as MediaAssetRow);
            }
          }
        )
        .subscribe();
    } catch {}

    const checkStatusOnce = async () => {
      if (settled) return;
      if (Date.now() - startedAt > maxWaitMs) {
        finishReject('Background worker timed out waiting for optimization. You can click Retry below.');
        return;
      }
      try {
        const { data, error } = await supabase
          .from('media_assets')
          .select('*')
          .eq('id', jobId)
          .maybeSingle();

        if (!error && data) {
          handleRowUpdate(data as MediaAssetRow);
        } else if (lastStatus === 'queued' && (Date.now() - startedAt) % 15_000 < 3_000) {
          void triggerWorkerForJob(jobId);
        }
      } catch {}
    };

    void checkStatusOnce();
    pollTimer = setInterval(() => {
      void checkStatusOnce();
    }, 2500);
  });
}

/**
 * Full Direct-to-Supabase + Hugging Face Worker pipeline for Project & Article media:
 * 1. Validate file size against VITE_MAX_UPLOAD_MB (50 MB default)
 * 2. Insert 'uploading' row in media_assets
 * 3. Upload raw file directly from browser -> 'raw-uploads' bucket (TUS resumable >= 6 MB)
 * 4. Mark row 'queued' & send lightweight JSON { jobId } trigger (cold-start safe)
 * 5. Subscribe + poll media_assets until completed or failed
 */
export async function runDirectMediaPipeline(params: {
  pageType: MediaPageType;
  mediaType: MediaKindType;
  file: File;
  onProgress?: PipelineProgressCallback;
  signal?: AbortSignal;
}): Promise<MediaAssetRow> {
  const { pageType, mediaType, file, onProgress, signal } = params;
  throwIfAborted(signal);

  const maxBytes = getMaxUploadBytes();
  if (file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(
      `"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB, which exceeds the ${maxMb} MB direct upload limit.`
    );
  }

  const jobId = generateUuidV4();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_') || `${mediaType}_${Date.now()}`;
  const rawPath = `${pageType}/${jobId}/${Date.now()}_${safeName}`;

  onProgress?.(2, 'Initializing direct Supabase upload...');

  const initialInsert = {
    id: jobId,
    page_type: pageType,
    media_type: mediaType,
    status: 'uploading' as MediaJobStatus,
    raw_path: rawPath,
    file_name: file.name,
    original_bytes: file.size,
    optimized_bytes: 0,
    compression_percent: 0,
    updated_at: new Date().toISOString(),
  };

  const { error: insertErr } = await supabase.from('media_assets').insert(initialInsert);
  if (insertErr) {
    throw new Error(
      `Unable to register media job in Supabase media_assets: ${insertErr.message}`
    );
  }

  try {
    await uploadDirectToRawBucket({
      pageType,
      rawPath,
      file,
      onProgress: (rawPct) => {
        const scaledPct = Math.max(4, Math.min(50, Math.round(4 + (rawPct / 100) * 46)));
        onProgress?.(scaledPct, `Uploading raw ${mediaType} (${rawPct}%)...`);
      },
      signal,
    });
  } catch (uploadErr: any) {
    if (signal?.aborted || uploadErr?.name === 'AbortError') {
      try {
        await supabase.from('media_assets').delete().eq('id', jobId);
      } catch {}
      throw uploadErr;
    }
    const errMsg = uploadErr?.message || 'Direct upload to raw-uploads failed.';
    try {
      await supabase
        .from('media_assets')
        .update({
          status: 'failed',
          error_message: errMsg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    } catch {}
    const wrapped: any = new Error(errMsg);
    wrapped.jobId = jobId;
    throw wrapped;
  }

  throwIfAborted(signal);
  onProgress?.(52, 'Queueing background optimization...');

  const { data: queuedRow, error: queueErr } = await supabase
    .from('media_assets')
    .update({
      status: 'queued',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select('*')
    .single();

  if (queueErr) {
    const wrapped: any = new Error(`Failed queueing job ${jobId}: ${queueErr.message}`);
    wrapped.jobId = jobId;
    throw wrapped;
  }

  onProgress?.(54, 'Waking worker & starting optimization...', queuedRow as MediaAssetRow);

  // Fire non-blocking lightweight JSON trigger
  void triggerWorkerForJob(jobId);

  return await waitForMediaAssetCompletion(jobId, onProgress, signal);
}

/**
 * Retries a failed job without re-uploading when raw_path still exists in raw-uploads.
 */
export async function retryMediaAssetJob(
  jobId: string,
  onProgress?: PipelineProgressCallback,
  signal?: AbortSignal
): Promise<MediaAssetRow> {
  const { data: existing, error: fetchErr } = await supabase
    .from('media_assets')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (fetchErr || !existing) {
    throw new Error('Could not find failed media job record in Supabase.');
  }
  const row = existing as MediaAssetRow;
  if (!row.raw_path) {
    throw new Error('Temporary raw file path missing. Please re-select the file.');
  }

  if (row.status === 'completed') {
    return row;
  }

  // Re-queue without re-uploading
  const { data: updated, error: updateErr } = await supabase
    .from('media_assets')
    .update({
      status: 'queued',
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select('*')
    .single();

  if (updateErr) {
    throw new Error(`Unable to re-queue job: ${updateErr.message}`);
  }

  onProgress?.(54, 'Re-queued without re-uploading...', updated as MediaAssetRow);
  void triggerWorkerForJob(jobId);

  return await waitForMediaAssetCompletion(jobId, onProgress, signal);
}

export async function fetchMediaAssetsList(pageType?: MediaPageType): Promise<MediaAssetRow[]> {
  try {
    let query = supabase
      .from('media_assets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(150);

    if (pageType) {
      query = query.eq('page_type', pageType);
    }

    const { data, error } = await query;
    if (error || !Array.isArray(data)) return [];
    return data as MediaAssetRow[];
  } catch {
    return [];
  }
}

export function subscribeToMediaAssets(
  onChange: (rows: MediaAssetRow[]) => void,
  pageType?: MediaPageType
): () => void {
  let cancelled = false;

  const refresh = async () => {
    const list = await fetchMediaAssetsList(pageType);
    if (!cancelled) onChange(list);
  };

  void refresh();

  let channel: any = null;
  try {
    channel = supabase
      .channel(`media_assets_dashboard_${pageType || 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'media_assets' },
        () => {
          void refresh();
        }
      )
      .subscribe();
  } catch {}

  const interval = setInterval(() => {
    void refresh();
  }, 60000);

  return () => {
    cancelled = true;
    clearInterval(interval);
    if (channel) {
      supabase.removeChannel(channel).catch(() => {});
    }
  };
}

export async function deleteMediaAssetById(id: string): Promise<void> {
  const { error } = await supabase.from('media_assets').delete().eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}
