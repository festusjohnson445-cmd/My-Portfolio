const STORAGE_KEY_MEDIA_DURATIONS = 'fesline_media_durations_v1';

const memoryDurationCache = new Map<string, number>();
const inflightDurationProbes = new Map<string, Promise<number | undefined>>();

let hydratedStorage = false;
function hydrateDurationCache() {
  if (hydratedStorage) return;
  hydratedStorage = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MEDIA_DURATIONS);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
          memoryDurationCache.set(k, v);
        }
      }
    }
  } catch {}
}

function persistDurationCache() {
  try {
    const entries = Array.from(memoryDurationCache.entries()).slice(-300);
    localStorage.setItem(STORAGE_KEY_MEDIA_DURATIONS, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

export function getCachedMediaDuration(url?: string): number | undefined {
  if (!url) return undefined;
  hydrateDurationCache();
  return memoryDurationCache.get(url);
}

export function setCachedMediaDuration(url: string, seconds?: number): void {
  if (!url || typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return;
  hydrateDurationCache();
  memoryDurationCache.set(url, Math.round(seconds * 10) / 10);
  persistDurationCache();
}

export function formatMediaDuration(seconds?: number | null): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.round(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatMediaTimestamp(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function cleanDisplayFileName(nameOrPath: string): string {
  const leaf = (nameOrPath || '').split('/').pop() || nameOrPath;
  // Strip upload timestamp + hex prefix (e.g. "1794756087944_a1b2c3_my_video.mp4")
  const stripped = leaf.replace(/^\d{10,16}_[a-zA-Z0-9]{4,10}_/, '');
  return stripped || leaf;
}

export async function probeLocalFileDuration(file: File): Promise<number | undefined> {
  if (!file || (!file.type.startsWith('video/') && !file.type.startsWith('audio/'))) {
    return undefined;
  }
  if (typeof document === 'undefined') return undefined;
  const objUrl = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const el = document.createElement(file.type.startsWith('audio/') ? 'audio' : 'video');
    let settled = false;
    const finish = (val?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      el.onloadedmetadata = null;
      el.onerror = null;
      el.removeAttribute('src');
      try {
        el.load();
      } catch {}
      URL.revokeObjectURL(objUrl);
      resolve(val && Number.isFinite(val) && val > 0 ? Math.round(val * 10) / 10 : undefined);
    };
    const timer = setTimeout(() => finish(undefined), 3000);
    el.preload = 'metadata';
    el.muted = true;
    el.onloadedmetadata = () => finish(el.duration);
    el.onerror = () => finish(undefined);
    el.src = objUrl;
  });
}

export async function probeMediaDuration(
  url: string,
  kind: 'video' | 'audio' = 'video'
): Promise<number | undefined> {
  if (!url || typeof document === 'undefined') return undefined;
  const cached = getCachedMediaDuration(url);
  if (cached !== undefined) return cached;

  const existing = inflightDurationProbes.get(url);
  if (existing) return existing;

  const promise = new Promise<number | undefined>((resolve) => {
    const el = document.createElement(kind);
    let settled = false;
    const finish = (val?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      el.onloadedmetadata = null;
      el.onerror = null;
      el.removeAttribute('src');
      try {
        el.load();
      } catch {}
      inflightDurationProbes.delete(url);
      if (val && Number.isFinite(val) && val > 0) {
        setCachedMediaDuration(url, val);
        resolve(Math.round(val * 10) / 10);
      } else {
        resolve(undefined);
      }
    };
    const timer = setTimeout(() => finish(undefined), 5500);
    el.preload = 'metadata';
    el.muted = true;
    el.crossOrigin = 'anonymous';
    el.onloadedmetadata = () => finish(el.duration);
    el.onerror = () => finish(undefined);
    el.src = url;
  });

  inflightDurationProbes.set(url, promise);
  return promise;
}

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIdx = 0;
  const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

export function formatLiveRelativeTime(dateInput?: string | number | Date, nowMs: number = Date.now()): string {
  if (!dateInput) return 'just now';
  const ts = dateInput instanceof Date ? dateInput.getTime() : typeof dateInput === 'number' ? dateInput : new Date(dateInput).getTime();
  if (!Number.isFinite(ts)) return 'just now';
  const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (diffSec < 1) return 'just now';
  if (diffSec < 60) return diffSec === 1 ? '1 sec ago' : `${diffSec} secs ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin === 1 ? '1 min ago' : `${diffMin} mins ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return diffHr === 1 ? '1 hr ago' : `${diffHr} hrs ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return diffDay === 1 ? '1 day ago' : `${diffDay} days ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return diffMonth === 1 ? '1 mo ago' : `${diffMonth} mos ago`;
  const diffYear = Math.floor(diffDay / 365);
  return diffYear === 1 ? '1 yr ago' : `${diffYear} yrs ago`;
}

