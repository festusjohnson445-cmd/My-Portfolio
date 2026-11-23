import { User, Session } from '@supabase/supabase-js';
import { supabase, isRealOwnerUser, supabaseSignOutOwner } from './supabase';

export const ADMIN_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const ADMIN_OFFLINE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const ADMIN_HEARTBEAT_INTERVAL_MS = 25 * 1000; // 25 seconds
export const ADMIN_LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes

const KEY_TAB_SESSION_ID = 'fesline_admin_tab_session_id_v1';
const KEY_VERIFIED_SESSION = 'fesline_admin_verified_session_v1';
const KEY_OTP_PENDING = 'fesline_admin_otp_pending_v1';
const KEY_LAST_ACTIVITY = 'fesline_admin_last_activity_v1';
const KEY_OFFLINE_SINCE = 'fesline_admin_offline_since_v1';
const KEY_LAST_ONLINE = 'fesline_admin_last_online_v1';
const CHANNEL_NAME = 'fesline_admin_security_channel_v1';

export type AdminSignOutReason = 'manual' | 'inactivity' | 'offline' | 'concurrent';
export type OtpDeliveryMode = 'server_email' | 'supabase_otp';

export interface VerifiedAdminSessionRecord {
  uid: string;
  sessionId: string;
  verifiedAt: number;
  lastActivityAt: number;
}

function safeReadJson<T>(storage: Storage | undefined, key: string): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function generateOpaqueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function getOrCreateAdminTabSessionId(): string {
  if (typeof window === 'undefined') return 'ssr-session';
  try {
    const existing = window.sessionStorage.getItem(KEY_TAB_SESSION_ID);
    if (existing && existing.trim().length >= 8) return existing.trim();
    const created = generateOpaqueId();
    window.sessionStorage.setItem(KEY_TAB_SESSION_ID, created);
    return created;
  } catch {
    return generateOpaqueId();
  }
}

export function setAdminOtpPending(email: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (email) {
      window.sessionStorage.setItem(
        KEY_OTP_PENDING,
        JSON.stringify({ email: email.trim().toLowerCase(), startedAt: Date.now() })
      );
    } else {
      window.sessionStorage.removeItem(KEY_OTP_PENDING);
    }
  } catch {}
}

export function getAdminOtpPending(): { email: string; startedAt: number } | null {
  if (typeof window === 'undefined') return null;
  const parsed = safeReadJson<{ email: string; startedAt: number }>(window.sessionStorage, KEY_OTP_PENDING);
  if (!parsed || !parsed.email) return null;
  // Expire pending challenge after 10 minutes
  if (Date.now() - (parsed.startedAt || 0) > 10 * 60 * 1000) {
    setAdminOtpPending(null);
    return null;
  }
  return parsed;
}

export function isAdminOtpPending(): boolean {
  return getAdminOtpPending() !== null;
}

export function markAdminSessionVerified(uid: string, sessionId: string): void {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const record: VerifiedAdminSessionRecord = {
    uid,
    sessionId,
    verifiedAt: now,
    lastActivityAt: now,
  };
  try {
    window.localStorage.setItem(KEY_VERIFIED_SESSION, JSON.stringify(record));
    window.localStorage.setItem(KEY_LAST_ACTIVITY, String(now));
    window.localStorage.setItem(KEY_LAST_ONLINE, String(now));
    window.localStorage.removeItem(KEY_OFFLINE_SINCE);
    setAdminOtpPending(null);
  } catch {}
}

export function getVerifiedAdminSessionRecord(): VerifiedAdminSessionRecord | null {
  if (typeof window === 'undefined') return null;
  return safeReadJson<VerifiedAdminSessionRecord>(window.localStorage, KEY_VERIFIED_SESSION);
}

export function touchAdminActivityTimestamp(): number {
  const now = Date.now();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY_LAST_ACTIVITY, String(now));
      const rec = getVerifiedAdminSessionRecord();
      if (rec) {
        rec.lastActivityAt = now;
        window.localStorage.setItem(KEY_VERIFIED_SESSION, JSON.stringify(rec));
      }
    } catch {}
  }
  return now;
}

export function hasVerifiedAdminSession(uid?: string | null): boolean {
  if (typeof window === 'undefined') return false;
  if (!uid) return false;
  if (isAdminOtpPending()) return false;

  const rec = getVerifiedAdminSessionRecord();
  if (!rec || rec.uid !== uid || !rec.sessionId) return false;

  const tabId = getOrCreateAdminTabSessionId();
  if (rec.sessionId !== tabId) {
    return false;
  }

  const now = Date.now();
  let lastActivity = rec.lastActivityAt || rec.verifiedAt || 0;
  try {
    const rawActivity = Number(window.localStorage.getItem(KEY_LAST_ACTIVITY) || '0');
    if (Number.isFinite(rawActivity) && rawActivity > lastActivity) {
      lastActivity = rawActivity;
    }
  } catch {}

  if (!lastActivity || now - lastActivity >= ADMIN_INACTIVITY_TIMEOUT_MS) {
    return false;
  }

  try {
    const offlineSince = Number(window.localStorage.getItem(KEY_OFFLINE_SINCE) || '0');
    if (Number.isFinite(offlineSince) && offlineSince > 0 && now - offlineSince >= ADMIN_OFFLINE_TIMEOUT_MS) {
      return false;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const lastOnline = Number(window.localStorage.getItem(KEY_LAST_ONLINE) || String(rec.verifiedAt || now));
      if (Number.isFinite(lastOnline) && now - lastOnline >= ADMIN_OFFLINE_TIMEOUT_MS) {
        return false;
      }
    }
  } catch {}

  return true;
}

export function clearLocalAdminVerification(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY_VERIFIED_SESSION);
    window.localStorage.removeItem(KEY_LAST_ACTIVITY);
    window.localStorage.removeItem(KEY_OFFLINE_SINCE);
    window.localStorage.removeItem(KEY_LAST_ONLINE);
    window.sessionStorage.removeItem(KEY_OTP_PENDING);
  } catch {}
}

function broadcastSecurityMessage(payload: { type: string; sessionId?: string; reason?: string }) {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const bc = new BroadcastChannel(CHANNEL_NAME);
    bc.postMessage(payload);
    bc.close();
  } catch {}
}

/**
 * Probes any other live open tabs in the same browser to detect if an active Admin tab is open.
 */
async function probeLiveBrowserTabsForAdmin(currentSessionId: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return false;
  return new Promise((resolve) => {
    let resolved = false;
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (ev) => {
        const msg = ev?.data;
        if (msg?.type === 'PONG_ACTIVE_ADMIN' && msg.sessionId && msg.sessionId !== currentSessionId) {
          if (!resolved) {
            resolved = true;
            try {
              bc?.close();
            } catch {}
            resolve(true);
          }
        }
      };
      bc.postMessage({ type: 'PING_ACTIVE_ADMIN', sessionId: currentSessionId });
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try {
            bc?.close();
          } catch {}
          resolve(false);
        }
      }, 220);
    } catch {
      resolve(false);
    }
  });
}

function isTimestampFresh(isoOrMs?: string | number | null): boolean {
  if (!isoOrMs) return false;
  const ms = typeof isoOrMs === 'number' ? isoOrMs : new Date(isoOrMs).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return false;
  return Date.now() - ms < ADMIN_LOCK_TTL_MS;
}

export interface SessionLockCheckResult {
  locked: boolean;
  reason?: string;
}

/**
 * Checks across same-browser tabs, Supabase (`admin_sessions` + `website_settings`),
 * and the backend server (`/api/admin/session/status`) whether another active Admin session exists.
 */
export async function checkExistingActiveAdminLock(currentSessionId: string): Promise<SessionLockCheckResult> {
  // 1. Check live open browser tabs via BroadcastChannel
  const otherTabActive = await probeLiveBrowserTabsForAdmin(currentSessionId);
  if (otherTabActive) {
    return {
      locked: true,
      reason: 'An Admin session is already active in another open tab. Multiple simultaneous Admin logins are restricted.',
    };
  }

  // 2. Check local browser verified record (if another unclosed session in localStorage is still valid)
  const localRec = getVerifiedAdminSessionRecord();
  if (
    localRec &&
    localRec.sessionId &&
    localRec.sessionId !== currentSessionId &&
    isTimestampFresh(localRec.lastActivityAt || localRec.verifiedAt)
  ) {
    return {
      locked: true,
      reason: 'Another active Admin session is currently signed in on this browser. Please sign out first or wait 5 minutes for expiry.',
    };
  }

  // 3. Check Supabase `admin_sessions` primary lock table
  try {
    const { data, error } = await supabase
      .from('admin_sessions')
      .select('id, active_session_id, is_active, last_heartbeat_at, expires_at')
      .eq('id', 'active_admin')
      .maybeSingle();

    if (!error && data) {
      const expiresMs = data.expires_at ? new Date(data.expires_at).getTime() : 0;
      const heartbeatFresh = isTimestampFresh(data.last_heartbeat_at);
      const notExpired = expiresMs > Date.now() || heartbeatFresh;
      if (data.is_active && data.active_session_id && data.active_session_id !== currentSessionId && notExpired) {
        return {
          locked: true,
          reason: 'Admin is already signed in on another device or browser. Only one active Admin session is allowed at a time.',
        };
      }
    }
  } catch {}

  // 4. Fallback check in `website_settings.appearance_config.activeAdminSession`
  try {
    const { data, error } = await supabase
      .from('website_settings')
      .select('appearance_config')
      .eq('id', 'default')
      .maybeSingle();

    if (!error && data?.appearance_config?.activeAdminSession) {
      const lock = data.appearance_config.activeAdminSession;
      const expiresMs = lock.expiresAt ? new Date(lock.expiresAt).getTime() : 0;
      const heartbeatFresh = isTimestampFresh(lock.lastHeartbeatAt);
      const notExpired = expiresMs > Date.now() || heartbeatFresh;
      if (lock.isActive && lock.sessionId && lock.sessionId !== currentSessionId && notExpired) {
        return {
          locked: true,
          reason: 'Admin is already signed in on another device or browser. Only one active Admin session is allowed at a time.',
        };
      }
    }
  } catch {}

  // 5. Check backend Express / Vercel session guard
  try {
    const resp = await fetch(`/api/admin/session/status?sessionId=${encodeURIComponent(currentSessionId)}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (resp.ok) {
      const json = await resp.json();
      if (json?.active && json?.isSameSession === false) {
        return {
          locked: true,
          reason: 'Admin is already signed in on another browser or device. Only one active Admin session is allowed at a time.',
        };
      }
    }
  } catch {}

  return { locked: false };
}

async function writeWebsiteSettingsFallbackLock(
  ownerUid: string,
  lockPayload: { sessionId: string; isActive: boolean; lastHeartbeatAt: string; expiresAt: string } | null
): Promise<void> {
  try {
    const { data } = await supabase
      .from('website_settings')
      .select('appearance_config')
      .eq('id', 'default')
      .maybeSingle();

    const currentAppearance =
      data?.appearance_config && typeof data.appearance_config === 'object' ? { ...data.appearance_config } : {};

    if (lockPayload) {
      currentAppearance.activeAdminSession = lockPayload;
    } else {
      delete currentAppearance.activeAdminSession;
    }

    await supabase
      .from('website_settings')
      .update({
        owner_id: ownerUid,
        appearance_config: currentAppearance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 'default');
  } catch {}
}

export async function claimAdminSessionLock(
  ownerUid: string,
  sessionId: string,
  accessToken?: string
): Promise<{ ok: boolean; error?: string }> {
  const preCheck = await checkExistingActiveAdminLock(sessionId);
  if (preCheck.locked) {
    return { ok: false, error: preCheck.reason };
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresIso = new Date(now + ADMIN_LOCK_TTL_MS).toISOString();

  // Backend Express /api/admin/session/claim
  if (accessToken) {
    try {
      const resp = await fetch('/api/admin/session/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      if (resp.status === 409) {
        const errJson = await resp.json().catch(() => ({}));
        return {
          ok: false,
          error:
            errJson?.message ||
            'Another Admin session is already active. Only one active Admin login is allowed.',
        };
      }
    } catch {}
  }

  // Supabase primary `admin_sessions` table
  let wrotePrimary = false;
  try {
    const { error } = await supabase.from('admin_sessions').upsert(
      {
        id: 'active_admin',
        owner_id: ownerUid,
        active_session_id: sessionId,
        is_active: true,
        last_heartbeat_at: nowIso,
        expires_at: expiresIso,
        updated_at: nowIso,
      },
      { onConflict: 'id' }
    );
    if (!error) wrotePrimary = true;
  } catch {}

  // Fallback lock inside `website_settings.appearance_config` if `admin_sessions` table is absent
  if (!wrotePrimary) {
    await writeWebsiteSettingsFallbackLock(ownerUid, {
      sessionId,
      isActive: true,
      lastHeartbeatAt: nowIso,
      expiresAt: expiresIso,
    });
  }

  broadcastSecurityMessage({ type: 'ADMIN_SESSION_CLAIMED', sessionId });
  return { ok: true };
}

export async function heartbeatAdminSessionLock(
  ownerUid: string,
  sessionId: string,
  accessToken?: string
): Promise<{ valid: boolean; reason?: AdminSignOutReason }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { valid: true };
  }

  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const expiresIso = new Date(now + ADMIN_LOCK_TTL_MS).toISOString();

  // 1. Check backend lock ownership
  if (accessToken) {
    try {
      const resp = await fetch('/api/admin/session/heartbeat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ sessionId }),
      });
      if (resp.status === 409) {
        return { valid: false, reason: 'concurrent' };
      }
    } catch {}
  }

  // 2. Check & refresh Supabase `admin_sessions`
  try {
    const { data, error } = await supabase
      .from('admin_sessions')
      .select('active_session_id, is_active, expires_at')
      .eq('id', 'active_admin')
      .maybeSingle();

    if (!error) {
      if (
        data?.is_active &&
        data.active_session_id &&
        data.active_session_id !== sessionId &&
        data.expires_at &&
        new Date(data.expires_at).getTime() > now
      ) {
        return { valid: false, reason: 'concurrent' };
      }

      await supabase.from('admin_sessions').upsert(
        {
          id: 'active_admin',
          owner_id: ownerUid,
          active_session_id: sessionId,
          is_active: true,
          last_heartbeat_at: nowIso,
          expires_at: expiresIso,
          updated_at: nowIso,
        },
        { onConflict: 'id' }
      );
      return { valid: true };
    }
  } catch {}

  // 3. Fallback `website_settings`
  try {
    const { data } = await supabase
      .from('website_settings')
      .select('appearance_config')
      .eq('id', 'default')
      .maybeSingle();
    const lock = data?.appearance_config?.activeAdminSession;
    if (
      lock?.isActive &&
      lock.sessionId &&
      lock.sessionId !== sessionId &&
      lock.expiresAt &&
      new Date(lock.expiresAt).getTime() > now
    ) {
      return { valid: false, reason: 'concurrent' };
    }
    await writeWebsiteSettingsFallbackLock(ownerUid, {
      sessionId,
      isActive: true,
      lastHeartbeatAt: nowIso,
      expiresAt: expiresIso,
    });
  } catch {}

  return { valid: true };
}

export async function releaseAdminSessionLock(
  sessionId?: string,
  accessToken?: string
): Promise<void> {
  const sid = sessionId || getOrCreateAdminTabSessionId();
  const nowIso = new Date().toISOString();

  try {
    await fetch('/api/admin/session/release', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ sessionId: sid }),
      keepalive: true,
    });
  } catch {}

  try {
    const { data } = await supabase
      .from('admin_sessions')
      .select('active_session_id')
      .eq('id', 'active_admin')
      .maybeSingle();
    if (!data?.active_session_id || data.active_session_id === sid) {
      await supabase
        .from('admin_sessions')
        .update({
          active_session_id: '',
          is_active: false,
          expires_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', 'active_admin');
    }
  } catch {}

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (uid) {
      const { data: ws } = await supabase
        .from('website_settings')
        .select('appearance_config')
        .eq('id', 'default')
        .maybeSingle();
      const lock = ws?.appearance_config?.activeAdminSession;
      if (!lock?.sessionId || lock.sessionId === sid) {
        await writeWebsiteSettingsFallbackLock(uid, null);
      }
    }
  } catch {}

  broadcastSecurityMessage({ type: 'ADMIN_SESSION_RELEASED', sessionId: sid });
}

/**
 * Full clean sign-out helper releasing remote/local locks and terminating Supabase session.
 */
export async function performFullAdminSignOut(reason: AdminSignOutReason = 'manual'): Promise<void> {
  const sid = getOrCreateAdminTabSessionId();
  let accessToken: string | undefined;
  try {
    const { data } = await supabase.auth.getSession();
    accessToken = data?.session?.access_token;
  } catch {}

  try {
    await releaseAdminSessionLock(sid, accessToken);
  } catch {}

  clearLocalAdminVerification();
  await supabaseSignOutOwner();
  broadcastSecurityMessage({ type: 'ADMIN_SIGNED_OUT', sessionId: sid, reason });
}

/**
 * Sends a 6-digit email verification passcode to the authenticated admin's email.
 * Uses configured backend mailer (Resend/SMTP) if available, otherwise uses Supabase Auth OTP email pipeline.
 */
export async function sendAdminEmailVerificationCode(params: {
  email: string;
  accessToken: string;
}): Promise<{ ok: boolean; deliveryMode: OtpDeliveryMode; message?: string }> {
  const cleanEmail = params.email.trim().toLowerCase();

  // 1. Try server-side email delivery if configured
  try {
    const resp = await fetch('/api/admin/otp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify({ email: cleanEmail }),
    });
    if (resp.ok) {
      const json = await resp.json();
      if (json?.success && json.delivery === 'server_email') {
        return { ok: true, deliveryMode: 'server_email' };
      }
    }
  } catch {}

  // 2. Standard Supabase Auth 6-digit email OTP pipeline
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      return {
        ok: false,
        deliveryMode: 'supabase_otp',
        message: error.message || 'Unable to send 6-digit verification passcode to your email.',
      };
    }

    return { ok: true, deliveryMode: 'supabase_otp' };
  } catch (err: any) {
    return {
      ok: false,
      deliveryMode: 'supabase_otp',
      message: err?.message || 'Failed to send verification email.',
    };
  }
}

/**
 * Verifies the 6-digit passcode entered by the Admin against the active verification pipeline.
 */
export async function verifyAdminEmailVerificationCode(params: {
  email: string;
  code: string;
  deliveryMode: OtpDeliveryMode;
  accessToken?: string;
}): Promise<{ ok: boolean; user: User | null; session: Session | null; message?: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanCode = params.code.replace(/\D/g, '').trim();

  if (!/^\d{6}$/.test(cleanCode)) {
    return {
      ok: false,
      user: null,
      session: null,
      message: 'Please enter the exact 6-digit numeric passcode sent to your email.',
    };
  }

  if (params.deliveryMode === 'server_email') {
    try {
      const resp = await fetch('/api/admin/otp/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(params.accessToken ? { Authorization: `Bearer ${params.accessToken}` } : {}),
        },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json?.success) {
        return {
          ok: false,
          user: null,
          session: null,
          message: json?.message || 'Invalid or expired 6-digit verification passcode.',
        };
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user || null;
      if (!sessionData?.session || !isRealOwnerUser(user)) {
        return {
          ok: false,
          user: null,
          session: null,
          message: 'Active Supabase owner session expired. Please sign in again.',
        };
      }
      return { ok: true, user, session: sessionData.session };
    } catch (err: any) {
      return {
        ok: false,
        user: null,
        session: null,
        message: err?.message || 'Verification request failed.',
      };
    }
  }

  // Standard Supabase Auth Email OTP Verification
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanCode,
      type: 'email',
    });

    if (error) {
      return {
        ok: false,
        user: null,
        session: null,
        message: error.message || 'Invalid or expired 6-digit passcode.',
      };
    }

    if (!data?.session || !data?.user || !isRealOwnerUser(data.user)) {
      return {
        ok: false,
        user: null,
        session: null,
        message: 'Verification did not return an authorized owner session.',
      };
    }

    return { ok: true, user: data.user, session: data.session };
  } catch (err: any) {
    return {
      ok: false,
      user: null,
      session: null,
      message: err?.message || 'Failed to verify 6-digit email passcode.',
    };
  }
}

/**
 * Starts the global Admin session watchdog:
 * - Signs out after 5 minutes of user inactivity
 * - Signs out after 5 minutes offline
 * - Responds to BroadcastChannel probes & sends 25s heartbeats to enforce single active Admin session
 */
export function startAdminSessionWatchdog(params: {
  ownerUid: string;
  onAutoSignOut: (reason: AdminSignOutReason) => void;
}): () => void {
  if (typeof window === 'undefined') return () => {};

  const sessionId = getOrCreateAdminTabSessionId();
  let stopped = false;
  let lastThrottleWrite = 0;

  // Initialize tracking timestamps cleanly
  const now = Date.now();
  try {
    if (!window.localStorage.getItem(KEY_LAST_ACTIVITY)) {
      window.localStorage.setItem(KEY_LAST_ACTIVITY, String(now));
    }
    if (navigator.onLine) {
      window.localStorage.setItem(KEY_LAST_ONLINE, String(now));
      window.localStorage.removeItem(KEY_OFFLINE_SINCE);
    } else if (!window.localStorage.getItem(KEY_OFFLINE_SINCE)) {
      window.localStorage.setItem(KEY_OFFLINE_SINCE, String(now));
    }
  } catch {}

  const recordUserActivity = () => {
    if (stopped) return;
    const t = Date.now();
    if (t - lastThrottleWrite < 2000) return;
    lastThrottleWrite = t;
    touchAdminActivityTimestamp();
  };

  const handleOnline = () => {
    if (stopped) return;
    const t = Date.now();
    try {
      // Check if it was offline for >= 5 min before reconnecting
      const offlineSince = Number(window.localStorage.getItem(KEY_OFFLINE_SINCE) || '0');
      if (Number.isFinite(offlineSince) && offlineSince > 0 && t - offlineSince >= ADMIN_OFFLINE_TIMEOUT_MS) {
        triggerSignOut('offline');
        return;
      }
      window.localStorage.setItem(KEY_LAST_ONLINE, String(t));
      window.localStorage.removeItem(KEY_OFFLINE_SINCE);
    } catch {}
  };

  const handleOffline = () => {
    if (stopped) return;
    try {
      if (!window.localStorage.getItem(KEY_OFFLINE_SINCE)) {
        window.localStorage.setItem(KEY_OFFLINE_SINCE, String(Date.now()));
      }
    } catch {}
  };

  const triggerSignOut = (reason: AdminSignOutReason) => {
    if (stopped) return;
    stopped = true;
    params.onAutoSignOut(reason);
  };

  const evaluateTimers = () => {
    if (stopped) return;
    const t = Date.now();

    // 1. Check verified record mismatch
    const rec = getVerifiedAdminSessionRecord();
    if (!rec || rec.uid !== params.ownerUid || rec.sessionId !== sessionId) {
      triggerSignOut('concurrent');
      return;
    }

    // 2. Check 5-minute inactivity
    const rawActivity = Number(window.localStorage.getItem(KEY_LAST_ACTIVITY) || String(rec.lastActivityAt || 0));
    if (!Number.isFinite(rawActivity) || t - rawActivity >= ADMIN_INACTIVITY_TIMEOUT_MS) {
      triggerSignOut('inactivity');
      return;
    }

    // 3. Check 5-minute offline state
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      let offlineSince = Number(window.localStorage.getItem(KEY_OFFLINE_SINCE) || '0');
      if (!Number.isFinite(offlineSince) || offlineSince <= 0) {
        offlineSince = Number(window.localStorage.getItem(KEY_LAST_ONLINE) || String(t));
        try {
          window.localStorage.setItem(KEY_OFFLINE_SINCE, String(offlineSince));
        } catch {}
      }
      if (t - offlineSince >= ADMIN_OFFLINE_TIMEOUT_MS) {
        triggerSignOut('offline');
        return;
      }
    } else {
      const offlineSince = Number(window.localStorage.getItem(KEY_OFFLINE_SINCE) || '0');
      if (Number.isFinite(offlineSince) && offlineSince > 0 && t - offlineSince >= ADMIN_OFFLINE_TIMEOUT_MS) {
        triggerSignOut('offline');
        return;
      }
      try {
        window.localStorage.setItem(KEY_LAST_ONLINE, String(t));
        window.localStorage.removeItem(KEY_OFFLINE_SINCE);
      } catch {}
    }
  };

  const sendHeartbeat = async () => {
    if (stopped) return;
    evaluateTimers();
    if (stopped) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data?.session?.access_token;
      const res = await heartbeatAdminSessionLock(params.ownerUid, sessionId, accessToken);
      if (!res.valid && !stopped) {
        triggerSignOut(res.reason || 'concurrent');
      }
    } catch {}
  };

  // BroadcastChannel listener to enforce single tab + respond to pings
  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (ev) => {
        if (stopped) return;
        const msg = ev?.data;
        if (!msg) return;
        if (msg.type === 'PING_ACTIVE_ADMIN' && msg.sessionId !== sessionId) {
          bc?.postMessage({ type: 'PONG_ACTIVE_ADMIN', sessionId });
        } else if (msg.type === 'ADMIN_SESSION_CLAIMED' && msg.sessionId && msg.sessionId !== sessionId) {
          triggerSignOut('concurrent');
        } else if (msg.type === 'ADMIN_SIGNED_OUT') {
          triggerSignOut((msg.reason as AdminSignOutReason) || 'manual');
        }
      };
    } catch {}
  }

  const activityEvents: Array<keyof WindowEventMap> = [
    'mousemove',
    'mousedown',
    'keydown',
    'touchstart',
    'scroll',
    'wheel',
    'pointerdown',
  ];
  activityEvents.forEach((evt) => {
    window.addEventListener(evt, recordUserActivity, { passive: true });
  });
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('focus', evaluateTimers);
  document.addEventListener('visibilitychange', evaluateTimers);

  const checkTimer = window.setInterval(evaluateTimers, 5000);
  const heartbeatTimer = window.setInterval(() => {
    void sendHeartbeat();
  }, ADMIN_HEARTBEAT_INTERVAL_MS);

  // Initial heartbeat
  void sendHeartbeat();

  return () => {
    stopped = true;
    window.clearInterval(checkTimer);
    window.clearInterval(heartbeatTimer);
    activityEvents.forEach((evt) => {
      window.removeEventListener(evt, recordUserActivity);
    });
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
    window.removeEventListener('focus', evaluateTimers);
    document.removeEventListener('visibilitychange', evaluateTimers);
    if (bc) {
      try {
        bc.close();
      } catch {}
    }
  };
}
