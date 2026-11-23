import { useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isRealOwnerUser } from './supabase';
import { setOwnerAuthenticated } from './profileState';

// ============================================================================
// ADMIN SECURITY PIPELINE:
// 1. Single-Session Enforcement (Restrict Multiple Logins across tabs/devices)
// 2. 5-Minute Inactivity & Offline Auto Sign-Out
// 3. 2-Step Email Verification Code (OTP) Pipeline Integrated into Admin Login
// ============================================================================

export const ADMIN_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const ADMIN_HEARTBEAT_INTERVAL_MS = 30 * 1000; // 30 seconds
export const ADMIN_MONITOR_TICK_MS = 5 * 1000; // 5 seconds

const TAB_SESSION_STORAGE_KEY = 'fesline_admin_tab_session_id';
const ACTIVE_LOCK_STORAGE_KEY = 'fesline_admin_active_session_lock_v1';
const VERIFIED_SESSION_STORAGE_KEY = 'fesline_admin_otp_verified_v1';
const LAST_ACTIVITY_STORAGE_KEY = 'fesline_admin_last_activity_at';
const OFFLINE_SINCE_STORAGE_KEY = 'fesline_admin_offline_since';
const BROADCAST_CHANNEL_NAME = 'fesline_admin_session_channel';

export type AdminSignOutReason = 'manual' | 'inactivity' | 'offline' | 'session_conflict';

interface LocalSessionLockRecord {
  sessionId: string;
  ownerUid: string;
  lastActiveAt: number;
  verifiedAt: number;
}

let inMemoryTabSessionId: string | null = null;
let inMemoryPendingOtp = false;
let inMemoryLastActivityAt = 0;
let inMemoryOfflineSince: number | null = null;
let signOutInProgress = false;

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `adm_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Tab-scoped session ID stored in sessionStorage (survives page refresh on the SAME tab,
 * while a different tab/browser/device receives a distinct ID).
 */
export function getAdminTabSessionId(): string {
  if (inMemoryTabSessionId) return inMemoryTabSessionId;
  if (typeof window !== 'undefined') {
    try {
      const existing = window.sessionStorage.getItem(TAB_SESSION_STORAGE_KEY);
      if (existing && existing.trim()) {
        inMemoryTabSessionId = existing.trim();
        return inMemoryTabSessionId;
      }
      const created = generateSessionId();
      window.sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, created);
      inMemoryTabSessionId = created;
      return created;
    } catch {}
  }
  inMemoryTabSessionId = generateSessionId();
  return inMemoryTabSessionId;
}

export function isPendingAdminOtpVerification(): boolean {
  return inMemoryPendingOtp;
}

export function setPendingAdminOtpVerification(pending: boolean): void {
  inMemoryPendingOtp = pending;
}

function readLocalLockRecord(): LocalSessionLockRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_LOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.sessionId === 'string' && typeof parsed.ownerUid === 'string') {
      return parsed as LocalSessionLockRecord;
    }
  } catch {}
  return null;
}

function writeLocalLockRecord(record: LocalSessionLockRecord | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (record) {
      window.localStorage.setItem(ACTIVE_LOCK_STORAGE_KEY, JSON.stringify(record));
      window.localStorage.setItem(
        VERIFIED_SESSION_STORAGE_KEY,
        JSON.stringify({ uid: record.ownerUid, sessionId: record.sessionId, verifiedAt: record.verifiedAt })
      );
    } else {
      window.localStorage.removeItem(ACTIVE_LOCK_STORAGE_KEY);
      window.localStorage.removeItem(VERIFIED_SESSION_STORAGE_KEY);
    }
  } catch {}
}

export function getLastAdminActivityAt(): number {
  if (inMemoryLastActivityAt > 0) return inMemoryLastActivityAt;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          inMemoryLastActivityAt = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return 0;
}

export function recordAdminActivity(force = false): void {
  const now = Date.now();
  if (!force && inMemoryLastActivityAt > 0 && now - inMemoryLastActivityAt < 2000) {
    return;
  }
  inMemoryLastActivityAt = now;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
      const lock = readLocalLockRecord();
      const tabId = getAdminTabSessionId();
      if (lock && lock.sessionId === tabId) {
        lock.lastActiveAt = now;
        window.localStorage.setItem(ACTIVE_LOCK_STORAGE_KEY, JSON.stringify(lock));
      }
    } catch {}
  }
}

function getOfflineSince(): number | null {
  if (inMemoryOfflineSince !== null) return inMemoryOfflineSince;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(OFFLINE_SINCE_STORAGE_KEY);
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (Number.isFinite(parsed) && parsed > 0) {
          inMemoryOfflineSince = parsed;
          return parsed;
        }
      }
    } catch {}
  }
  return null;
}

function setOfflineSince(ts: number | null): void {
  inMemoryOfflineSince = ts;
  if (typeof window !== 'undefined') {
    try {
      if (ts !== null) {
        window.localStorage.setItem(OFFLINE_SINCE_STORAGE_KEY, String(ts));
      } else {
        window.localStorage.removeItem(OFFLINE_SINCE_STORAGE_KEY);
      }
    } catch {}
  }
}

function clearAdminTimingState(): void {
  inMemoryLastActivityAt = 0;
  inMemoryOfflineSince = null;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
      window.localStorage.removeItem(OFFLINE_SINCE_STORAGE_KEY);
    } catch {}
  }
}

function isRpcMissingError(error: any): boolean {
  const msg = String(error?.message || error?.details || '');
  const code = String(error?.code || '');
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    code === '42P01' ||
    /could not find the function|does not exist|schema cache/i.test(msg)
  );
}

/**
 * Ping other open tabs in the same browser via BroadcastChannel to detect an active admin tab.
 */
async function pingOtherActiveAdminTab(currentTabId: string, ownerUid?: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    const localLock = readLocalLockRecord();
    if (
      localLock &&
      localLock.sessionId !== currentTabId &&
      (!ownerUid || localLock.ownerUid === ownerUid) &&
      Date.now() - localLock.lastActiveAt < ADMIN_INACTIVITY_TIMEOUT_MS
    ) {
      return true;
    }
    return false;
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try { channel?.close(); } catch {}
          resolve(false);
        }
      }, 220);

      channel.onmessage = (event) => {
        const msg = event?.data;
        if (
          msg &&
          msg.type === 'PONG_ACTIVE_SESSION' &&
          msg.sessionId &&
          msg.sessionId !== currentTabId &&
          (!ownerUid || !msg.ownerUid || msg.ownerUid === ownerUid)
        ) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            try { channel?.close(); } catch {}
            resolve(true);
          }
        }
      };

      channel.postMessage({ type: 'PING_ACTIVE_SESSION', fromSessionId: currentTabId, ownerUid });
    } catch {
      resolve(false);
    }
  });
}

function broadcastSessionEvent(type: 'SESSION_CLAIMED' | 'SESSION_RELEASED', sessionId: string, ownerUid?: string): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channel.postMessage({ type, sessionId, ownerUid, at: Date.now() });
    channel.close();
  } catch {}
}

/**
 * Check remote session lock using dedicated RPC (primary) with fallback to profiles.bio lock metadata.
 */
async function checkRemoteSessionLock(
  ownerUid: string,
  tabSessionId: string
): Promise<{ allowed: boolean; message?: string }> {
  try {
    const { data, error } = await supabase.rpc('check_admin_session_lock', {
      p_session_id: tabSessionId,
    });
    if (!error && data && typeof data === 'object') {
      if ((data as any).allowed === false) {
        return {
          allowed: false,
          message:
            (data as any).reason ||
            'Multiple logins restricted: Chief Admin is already signed in on another device or tab. Please sign out there or wait 5 minutes of inactivity.',
        };
      }
      return { allowed: true };
    }
    if (error && !isRpcMissingError(error)) {
      console.warn('[Admin Session Check RPC Note]:', error.message);
    }
  } catch {}

  // Fallback check via profiles.bio._adminSessionLock (works even before SQL migration is executed)
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('bio')
      .eq('id', ownerUid)
      .maybeSingle();
    const lock = (prof?.bio as any)?._adminSessionLock;
    if (lock && lock.isActive === true && lock.sessionId && lock.sessionId !== tabSessionId) {
      const lastActiveMs = new Date(lock.lastActiveAt || 0).getTime();
      if (Number.isFinite(lastActiveMs) && Date.now() - lastActiveMs < ADMIN_INACTIVITY_TIMEOUT_MS) {
        return {
          allowed: false,
          message:
            'Multiple logins restricted: Chief Admin is already signed in on another device or browser. Sign out there or wait 5 minutes of inactivity.',
        };
      }
    }
  } catch {}

  return { allowed: true };
}

/**
 * Claim exclusive remote session lock after OTP verification completes.
 */
async function claimRemoteSessionLock(
  ownerUid: string,
  tabSessionId: string
): Promise<{ success: boolean; message?: string }> {
  const deviceInfo =
    typeof navigator !== 'undefined'
      ? String(navigator.userAgent || 'Browser').slice(0, 140)
      : 'Browser';

  try {
    const { data, error } = await supabase.rpc('claim_admin_session_lock', {
      p_session_id: tabSessionId,
      p_device_info: deviceInfo,
    });
    if (!error && data && typeof data === 'object') {
      if ((data as any).success === false) {
        return {
          success: false,
          message:
            (data as any).message ||
            'Another active admin session is already signed in.',
        };
      }
      return { success: true };
    }
    if (error && !isRpcMissingError(error)) {
      console.warn('[Admin Session Claim RPC Note]:', error.message);
    }
  } catch {}

  // Fallback: record lock inside profiles.bio._adminSessionLock
  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('bio')
      .eq('id', ownerUid)
      .maybeSingle();
    const currentBio =
      prof?.bio && typeof prof.bio === 'object' ? { ...(prof.bio as any) } : {};
    const existingLock = currentBio._adminSessionLock;
    if (
      existingLock &&
      existingLock.isActive === true &&
      existingLock.sessionId &&
      existingLock.sessionId !== tabSessionId
    ) {
      const lastActiveMs = new Date(existingLock.lastActiveAt || 0).getTime();
      if (Number.isFinite(lastActiveMs) && Date.now() - lastActiveMs < ADMIN_INACTIVITY_TIMEOUT_MS) {
        return {
          success: false,
          message:
            'Multiple logins restricted: Chief Admin is already signed in on another device or browser.',
        };
      }
    }
    const nowIso = new Date().toISOString();
    currentBio._adminSessionLock = {
      sessionId: tabSessionId,
      isActive: true,
      lastActiveAt: nowIso,
      deviceInfo,
    };
    await supabase
      .from('profiles')
      .update({ bio: currentBio, updated_at: nowIso })
      .eq('id', ownerUid);
  } catch {}

  return { success: true };
}

/**
 * Refresh heartbeat on the remote session lock every 30s while active & online.
 */
async function heartbeatRemoteSessionLock(
  ownerUid: string,
  tabSessionId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('heartbeat_admin_session_lock', {
      p_session_id: tabSessionId,
    });
    if (!error && data && typeof data === 'object') {
      return (data as any).valid !== false;
    }
    if (error && !isRpcMissingError(error)) {
      return true; // Do not log out on transient network errors
    }
  } catch {
    return true;
  }

  // Fallback heartbeat on profiles.bio._adminSessionLock
  try {
    const { data: prof, error } = await supabase
      .from('profiles')
      .select('bio')
      .eq('id', ownerUid)
      .maybeSingle();
    if (error) return true;
    const currentBio =
      prof?.bio && typeof prof.bio === 'object' ? { ...(prof.bio as any) } : {};
    const existingLock = currentBio._adminSessionLock;
    if (
      existingLock &&
      existingLock.isActive === true &&
      existingLock.sessionId &&
      existingLock.sessionId !== tabSessionId
    ) {
      const lastActiveMs = new Date(existingLock.lastActiveAt || 0).getTime();
      if (Number.isFinite(lastActiveMs) && Date.now() - lastActiveMs < ADMIN_INACTIVITY_TIMEOUT_MS) {
        return false;
      }
    }
    const nowIso = new Date().toISOString();
    currentBio._adminSessionLock = {
      sessionId: tabSessionId,
      isActive: true,
      lastActiveAt: nowIso,
    };
    await supabase
      .from('profiles')
      .update({ bio: currentBio })
      .eq('id', ownerUid);
  } catch {}

  return true;
}

/**
 * Release remote session lock immediately when admin signs out or times out.
 */
async function releaseRemoteSessionLock(ownerUid: string, tabSessionId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('release_admin_session_lock', {
      p_session_id: tabSessionId,
    });
    if (!error) return;
  } catch {}

  try {
    const { data: prof } = await supabase
      .from('profiles')
      .select('bio')
      .eq('id', ownerUid)
      .maybeSingle();
    if (prof?.bio && typeof prof.bio === 'object') {
      const currentBio = { ...(prof.bio as any) };
      if (
        !currentBio._adminSessionLock?.sessionId ||
        currentBio._adminSessionLock.sessionId === tabSessionId
      ) {
        currentBio._adminSessionLock = {
          sessionId: tabSessionId,
          isActive: false,
          lastActiveAt: new Date(0).toISOString(),
        };
        await supabase
          .from('profiles')
          .update({ bio: currentBio })
          .eq('id', ownerUid);
      }
    }
  } catch {}
}

/**
 * Step 1 of Admin Login:
 * 1. Validate email + password with Supabase Auth.
 * 2. Verify user is a real non-anonymous owner account.
 * 3. Enforce single active session across tabs and devices (blocking concurrent login).
 * 4. Dispatch Email Verification OTP code to the admin's authenticated email.
 * 5. Clear temporary local session until Step 2 OTP verification succeeds.
 */
export async function initiateAdminPasswordAndOtp(
  email: string,
  password: string
): Promise<{ ok: boolean; email?: string; error?: string }> {
  const cleanEmail = email.trim();
  const cleanPassword = password.trim();
  const tabSessionId = getAdminTabSessionId();

  if (!cleanEmail || !cleanPassword) {
    return { ok: false, error: 'Email and password are required.' };
  }

  setPendingAdminOtpVerification(true);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (error) {
      setPendingAdminOtpVerification(false);
      return {
        ok: false,
        error: error.message || 'Authentication failed. Please verify your credentials.',
      };
    }

    if (!data?.session || !data.user) {
      setPendingAdminOtpVerification(false);
      return { ok: false, error: 'Authentication succeeded but no active session was returned.' };
    }

    if (!isRealOwnerUser(data.user)) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setPendingAdminOtpVerification(false);
      return { ok: false, error: 'This account is not authorized as the portfolio owner.' };
    }

    const ownerUid = data.user.id;
    const authenticatedEmail = (data.user.email || cleanEmail).trim();

    // Check same-browser other tabs first
    const anotherTabAlive = await pingOtherActiveAdminTab(tabSessionId, ownerUid);
    if (anotherTabAlive) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setPendingAdminOtpVerification(false);
      return {
        ok: false,
        error:
          'Multiple logins restricted: Chief Admin is already signed in on another browser tab. Please sign out there first.',
      };
    }

    // Check remote active session lock across other browsers/devices
    const remoteCheck = await checkRemoteSessionLock(ownerUid, tabSessionId);
    if (!remoteCheck.allowed) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setPendingAdminOtpVerification(false);
      return {
        ok: false,
        error:
          remoteCheck.message ||
          'Multiple logins restricted: Chief Admin is already signed in on another device.',
      };
    }

    // Dispatch Email Verification Code (OTP) to the authenticated admin email
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: authenticatedEmail,
      options: {
        shouldCreateUser: false,
      },
    });

    // Clear unverified local password session immediately so admin access CANNOT open before OTP verification
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});

    if (otpError) {
      setPendingAdminOtpVerification(false);
      return {
        ok: false,
        error:
          otpError.message ||
          'Unable to send verification code to your email. Please try again shortly.',
      };
    }

    return { ok: true, email: authenticatedEmail };
  } catch (err: any) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setPendingAdminOtpVerification(false);
    return {
      ok: false,
      error: err?.message || 'Failed to initiate admin verification.',
    };
  }
}

/**
 * Resend verification code to the admin's authenticated email during Step 2.
 */
export async function resendAdminVerificationCode(
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    return { ok: false, error: 'Missing email address.' };
  }
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: false,
      },
    });
    if (error) {
      return { ok: false, error: error.message || 'Failed to resend verification code.' };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Failed to resend verification code.' };
  }
}

/**
 * Step 2 of Admin Login:
 * Verify the email OTP code, enforce single active session lock, revoke any stale sessions,
 * and grant verified Chief Admin access.
 */
export async function verifyAdminEmailOtpAndCompleteLogin(
  email: string,
  token: string
): Promise<{ ok: boolean; user?: User; error?: string }> {
  const cleanEmail = email.trim();
  const cleanToken = token.trim().replace(/\s+/g, '');
  const tabSessionId = getAdminTabSessionId();

  if (!cleanEmail || !cleanToken) {
    return { ok: false, error: 'Please enter the verification code sent to your email.' };
  }

  setPendingAdminOtpVerification(true);
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'email',
    });

    if (error) {
      return {
        ok: false,
        error: error.message || 'Invalid or expired verification code. Please check your email and try again.',
      };
    }

    if (!data?.session || !data.user || !isRealOwnerUser(data.user)) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      return {
        ok: false,
        error: 'Verification failed or this account is not authorized as Chief Admin.',
      };
    }

    const ownerUid = data.user.id;

    // Final single-session guard across tabs and remote devices before activating admin session
    const anotherTabAlive = await pingOtherActiveAdminTab(tabSessionId, ownerUid);
    if (anotherTabAlive) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setPendingAdminOtpVerification(false);
      return {
        ok: false,
        error: 'Multiple logins restricted: Another browser tab already holds the active admin session.',
      };
    }

    const claim = await claimRemoteSessionLock(ownerUid, tabSessionId);
    if (!claim.success) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      setPendingAdminOtpVerification(false);
      return {
        ok: false,
        error:
          claim.message ||
          'Multiple logins restricted: Another device is already logged into this admin account.',
      };
    }

    // Revoke any other existing sessions on Supabase Auth for this user
    await supabase.auth.signOut({ scope: 'others' }).catch(() => {});

    const now = Date.now();
    writeLocalLockRecord({
      sessionId: tabSessionId,
      ownerUid,
      lastActiveAt: now,
      verifiedAt: now,
    });
    setOfflineSince(null);
    recordAdminActivity(true);
    setPendingAdminOtpVerification(false);
    setOwnerAuthenticated(true, ownerUid);
    broadcastSessionEvent('SESSION_CLAIMED', tabSessionId, ownerUid);

    return { ok: true, user: data.user };
  } catch (err: any) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    return {
      ok: false,
      error: err?.message || 'Unable to verify email code.',
    };
  }
}

/**
 * Determine if the current tab is allowed to hold an active, OTP-verified Chief Admin session.
 * Prevents unverified Step-1 sessions, other browser tabs, or timed-out sessions from unlocking Admin UI.
 */
export function canActivateAdminSessionOnCurrentTab(user?: User | null): boolean {
  if (!isRealOwnerUser(user) || !user) return false;
  if (isPendingAdminOtpVerification()) return false;

  const tabSessionId = getAdminTabSessionId();
  const lock = readLocalLockRecord();
  if (!lock) return false;

  // Must belong to THIS user and THIS browser tab's session
  if (lock.ownerUid !== user.id || lock.sessionId !== tabSessionId) {
    return false;
  }

  // Enforce 5-minute inactivity timeout across reloads/sleep
  const lastActivity = getLastAdminActivityAt() || lock.lastActiveAt || lock.verifiedAt;
  if (lastActivity > 0 && Date.now() - lastActivity >= ADMIN_INACTIVITY_TIMEOUT_MS) {
    return false;
  }

  // Enforce 5-minute offline timeout across reloads/sleep
  const offlineSince = getOfflineSince();
  if (offlineSince !== null && Date.now() - offlineSince >= ADMIN_INACTIVITY_TIMEOUT_MS) {
    return false;
  }

  return true;
}

/**
 * Cleanly sign out the Chief Admin session, release locks, clear verified state,
 * and broadcast notification if auto-signed-out due to inactivity, offline timeout, or conflict.
 */
export async function signOutAdminSession(
  reason: AdminSignOutReason = 'manual'
): Promise<void> {
  if (signOutInProgress) return;
  signOutInProgress = true;
  const tabSessionId = getAdminTabSessionId();

  try {
    setPendingAdminOtpVerification(false);

    let ownerUid = '';
    try {
      const { data } = await supabase.auth.getSession();
      ownerUid = data?.session?.user?.id || '';
    } catch {}
    if (!ownerUid) {
      ownerUid = readLocalLockRecord()?.ownerUid || '';
    }

    if (ownerUid && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
      await releaseRemoteSessionLock(ownerUid, tabSessionId).catch(() => {});
    }

    writeLocalLockRecord(null);
    clearAdminTimingState();
    broadcastSessionEvent('SESSION_RELEASED', tabSessionId, ownerUid);

    try {
      const isOnline = typeof navigator === 'undefined' || navigator.onLine !== false;
      const scope = reason === 'session_conflict' || !isOnline ? 'local' : 'global';
      await supabase.auth.signOut({ scope });
    } catch {
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
    }

    setOwnerAuthenticated(false);

    if (typeof window !== 'undefined' && reason !== 'manual') {
      const message =
        reason === 'inactivity'
          ? 'Automatically signed out after 5 minutes of inactivity.'
          : reason === 'offline'
          ? 'Automatically signed out after being offline for 5 minutes.'
          : 'Admin session ended because another active session was detected.';
      window.dispatchEvent(
        new CustomEvent('fesline_admin_signed_out', {
          detail: { reason, message },
        })
      );
    }
  } finally {
    signOutInProgress = false;
  }
}

/**
 * Global Admin Session Monitor Hook:
 * - Tracks user activity and automatically signs out after 5 minutes of inactivity.
 * - Tracks browser online/offline state and automatically signs out after 5 minutes offline.
 * - Responds to BroadcastChannel pings from other tabs to block duplicate tabs.
 * - Sends remote heartbeats every 30s to keep the single-session lock alive.
 */
export function useAdminSessionMonitor(isOwner: boolean): void {
  useEffect(() => {
    if (!isOwner || typeof window === 'undefined') return;

    const tabSessionId = getAdminTabSessionId();
    const initialLock = readLocalLockRecord();
    const ownerUid = initialLock?.ownerUid || '';

    // Initialize activity timestamp if absent
    if (!getLastAdminActivityAt()) {
      recordAdminActivity(true);
    }

    // Check immediate expiration on mount (e.g. browser woke from sleep or refreshed after >5 min)
    const checkExpiryNow = (): boolean => {
      const now = Date.now();
      const lastAct = getLastAdminActivityAt();
      if (lastAct > 0 && now - lastAct >= ADMIN_INACTIVITY_TIMEOUT_MS) {
        void signOutAdminSession('inactivity');
        return true;
      }

      const offSince = getOfflineSince();
      if (offSince !== null && now - offSince >= ADMIN_INACTIVITY_TIMEOUT_MS) {
        void signOutAdminSession('offline');
        return true;
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (offSince === null) {
          setOfflineSince(now);
        }
      } else if (offSince !== null) {
        setOfflineSince(null);
      }

      return false;
    };

    if (checkExpiryNow()) return;

    // 1. User activity listeners
    const onUserActivity = () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return;
      }
      recordAdminActivity(false);
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'pointerdown',
      'click',
    ];
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });

    // 2. Online / Offline listeners
    const onOffline = () => {
      if (getOfflineSince() === null) {
        setOfflineSince(Date.now());
      }
    };
    const onOnline = () => {
      const offSince = getOfflineSince();
      if (offSince !== null && Date.now() - offSince >= ADMIN_INACTIVITY_TIMEOUT_MS) {
        void signOutAdminSession('offline');
        return;
      }
      setOfflineSince(null);
      checkExpiryNow();
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    // 3. Visibility / focus wake-up check (handles laptop sleep or backgrounded tab throttling)
    const onWakeCheck = () => {
      if (document.visibilityState === 'visible') {
        checkExpiryNow();
      }
    };
    document.addEventListener('visibilitychange', onWakeCheck);
    window.addEventListener('focus', onWakeCheck);

    // 4. BroadcastChannel responder to block duplicate tabs and sync cross-tab signout
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        channel.onmessage = (event) => {
          const msg = event?.data;
          if (!msg) return;
          if (msg.type === 'PING_ACTIVE_SESSION' && msg.fromSessionId !== tabSessionId) {
            channel?.postMessage({
              type: 'PONG_ACTIVE_SESSION',
              sessionId: tabSessionId,
              ownerUid,
            });
          } else if (
            msg.type === 'SESSION_CLAIMED' &&
            msg.sessionId &&
            msg.sessionId !== tabSessionId
          ) {
            void signOutAdminSession('session_conflict');
          } else if (
            msg.type === 'SESSION_RELEASED' &&
            msg.sessionId === tabSessionId
          ) {
            void signOutAdminSession('manual');
          }
        };
      }
    } catch {}

    // 5. Storage event listener if another window overwrote the lock
    const onStorageChange = (e: StorageEvent) => {
      if (e.key === ACTIVE_LOCK_STORAGE_KEY) {
        const current = readLocalLockRecord();
        if (!current || current.sessionId !== tabSessionId) {
          void signOutAdminSession(current ? 'session_conflict' : 'manual');
        }
      }
    };
    window.addEventListener('storage', onStorageChange);

    // 6. Periodic expiry timer (every 5 seconds)
    const expiryTimer = window.setInterval(() => {
      checkExpiryNow();
    }, ADMIN_MONITOR_TICK_MS);

    // 7. Periodic remote lock heartbeat (every 30 seconds while online)
    const heartbeatTimer = window.setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if (checkExpiryNow()) return;
      if (ownerUid) {
        void heartbeatRemoteSessionLock(ownerUid, tabSessionId).then((stillValid) => {
          if (!stillValid) {
            void signOutAdminSession('session_conflict');
          }
        });
      }
    }, ADMIN_HEARTBEAT_INTERVAL_MS);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, onUserActivity);
      });
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onWakeCheck);
      window.removeEventListener('focus', onWakeCheck);
      window.removeEventListener('storage', onStorageChange);
      window.clearInterval(expiryTimer);
      window.clearInterval(heartbeatTimer);
      try {
        channel?.close();
      } catch {}
    };
  }, [isOwner]);
}
