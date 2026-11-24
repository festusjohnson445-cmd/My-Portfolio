import type { Session, User } from '@supabase/supabase-js';
import {
  supabase,
  AUTHORIZED_ADMIN_EMAIL,
  AUTHORIZED_ADMIN_EMAILS,
  isAuthorizedAdminEmail,
  isEmailConfirmedUser,
  isRealOwnerUser,
  getSessionAalClaim,
} from './supabase';

export {
  AUTHORIZED_ADMIN_EMAIL,
  AUTHORIZED_ADMIN_EMAILS,
  isAuthorizedAdminEmail,
  isEmailConfirmedUser,
  getSessionAalClaim,
};

export interface AdminTotpFactorInfo {
  id: string;
  friendlyName: string;
  status: 'verified' | 'unverified';
  createdAt?: string;
  updatedAt?: string;
}

export interface LiveAdminAal2Status {
  ok: boolean;
  user: User | null;
  session: Session | null;
  currentLevel: 'aal1' | 'aal2' | null;
  nextLevel: 'aal1' | 'aal2' | null;
  verifiedFactorsCount: number;
  expiresAt: string | null;
  reason?: string;
}

export interface TotpEnrollmentPayload {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
  friendlyName: string;
}

export interface AuthRateLimitStatus {
  blocked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number;
  lockedUntil?: string | null;
  message?: string;
}

export function isAuthorizedAdminIdentity(user?: User | null): boolean {
  return isRealOwnerUser(user);
}

/**
 * Verifies live Supabase session + email confirmation + authorized admin email +
 * authenticator assurance level AAL2 + at least one verified TOTP factor.
 */
export async function verifyLiveAdminAal2(): Promise<LiveAdminAal2Status> {
  try {
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    const session = sessionData?.session || null;
    if (sessionErr || !session) {
      return {
        ok: false,
        user: null,
        session: null,
        currentLevel: null,
        nextLevel: null,
        verifiedFactorsCount: 0,
        expiresAt: null,
        reason: 'No active Supabase session.',
      };
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const liveUser = userData?.user || session.user || null;
    if (userErr || !liveUser) {
      return {
        ok: false,
        user: null,
        session: null,
        currentLevel: null,
        nextLevel: null,
        verifiedFactorsCount: 0,
        expiresAt: null,
        reason: 'Unable to validate Supabase user.',
      };
    }

    if ((liveUser as any).is_anonymous) {
      return {
        ok: false,
        user: liveUser,
        session,
        currentLevel: null,
        nextLevel: null,
        verifiedFactorsCount: 0,
        expiresAt: null,
        reason: 'Anonymous sessions are not permitted.',
      };
    }

    if (!isAuthorizedAdminEmail(liveUser.email)) {
      return {
        ok: false,
        user: liveUser,
        session,
        currentLevel: null,
        nextLevel: null,
        verifiedFactorsCount: 0,
        expiresAt: null,
        reason: 'Access restricted to the authorized administrator account.',
      };
    }

    if (!isEmailConfirmedUser(liveUser)) {
      return {
        ok: false,
        user: liveUser,
        session,
        currentLevel: null,
        nextLevel: null,
        verifiedFactorsCount: 0,
        expiresAt: null,
        reason: 'Email confirmation is required before accessing administrator features.',
      };
    }

    const jwtAal = getSessionAalClaim(session);
    const { data: aalData, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const currentLevel = (aalData?.currentLevel as 'aal1' | 'aal2' | null) || jwtAal || null;
    const nextLevel = (aalData?.nextLevel as 'aal1' | 'aal2' | null) || null;

    const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();
    const verifiedTotp = (factorsData?.totp || []).filter((f) => f.status === 'verified');

    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null;

    if (aalErr || factorsErr) {
      return {
        ok: false,
        user: liveUser,
        session,
        currentLevel,
        nextLevel,
        verifiedFactorsCount: verifiedTotp.length,
        expiresAt,
        reason: aalErr?.message || factorsErr?.message || 'Unable to verify MFA assurance level.',
      };
    }

    if (verifiedTotp.length === 0) {
      return {
        ok: false,
        user: liveUser,
        session,
        currentLevel,
        nextLevel,
        verifiedFactorsCount: 0,
        expiresAt,
        reason: 'TOTP authenticator enrollment is required.',
      };
    }

    if (currentLevel !== 'aal2' || jwtAal !== 'aal2') {
      return {
        ok: false,
        user: liveUser,
        session,
        currentLevel,
        nextLevel,
        verifiedFactorsCount: verifiedTotp.length,
        expiresAt,
        reason: 'Six-digit TOTP verification (AAL2) is required.',
      };
    }

    return {
      ok: true,
      user: liveUser,
      session,
      currentLevel: 'aal2',
      nextLevel: nextLevel || 'aal2',
      verifiedFactorsCount: verifiedTotp.length,
      expiresAt,
    };
  } catch (err: any) {
    return {
      ok: false,
      user: null,
      session: null,
      currentLevel: null,
      nextLevel: null,
      verifiedFactorsCount: 0,
      expiresAt: null,
      reason: err?.message || 'Security verification error.',
    };
  }
}

/**
 * Lists all enrolled TOTP authenticator factors for the active administrator.
 */
export async function listAdminTotpFactors(): Promise<{
  verified: AdminTotpFactorInfo[];
  unverified: AdminTotpFactorInfo[];
}> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    throw new Error(error.message || 'Failed to load enrolled MFA devices.');
  }
  const allTotp: AdminTotpFactorInfo[] = (data?.totp || []).map((f) => ({
    id: f.id,
    friendlyName: (f.friendly_name || 'Authenticator App').trim(),
    status: f.status === 'verified' ? 'verified' : 'unverified',
    createdAt: f.created_at,
    updatedAt: f.updated_at,
  }));

  return {
    verified: allTotp.filter((f) => f.status === 'verified'),
    unverified: allTotp.filter((f) => f.status === 'unverified'),
  };
}

/**
 * Starts one-time QR enrollment for Duo Mobile / Google Authenticator / TOTP apps.
 * Cleans up any abandoned unverified factors first so enrollment never hits stale duplicates.
 */
export async function startAdminTotpEnrollment(
  friendlyName = 'Duo Mobile Authenticator'
): Promise<TotpEnrollmentPayload> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user || !isRealOwnerUser(user)) {
    throw new Error('Confirmed authorized administrator credentials are required before enrolling MFA.');
  }

  // Clean up any abandoned unverified TOTP factors before creating a fresh QR enrollment
  const { unverified, verified } = await listAdminTotpFactors();
  for (const stale of unverified) {
    try {
      await supabase.auth.mfa.unenroll({ factorId: stale.id });
    } catch {}
  }

  // Ensure a unique friendly name if multiple authenticator devices are enrolled
  const existingNames = new Set(verified.map((f) => f.friendlyName.toLowerCase()));
  let finalFriendlyName = friendlyName.trim() || 'Duo Mobile Authenticator';
  if (existingNames.has(finalFriendlyName.toLowerCase())) {
    finalFriendlyName = `${finalFriendlyName} (${verified.length + 1})`;
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: finalFriendlyName,
    issuer: 'Fesline Engineering',
  });

  if (error || !data?.id || !data?.totp) {
    throw new Error(error?.message || 'Unable to generate authenticator QR enrollment.');
  }

  const rawQr = String(data.totp.qr_code || '').trim();
  const formattedQr = rawQr.startsWith('data:image/')
    ? rawQr
    : rawQr
    ? `data:image/svg+xml;utf8,${encodeURIComponent(rawQr)}`
    : '';

  return {
    factorId: data.id,
    qrCode: formattedQr,
    secret: data.totp.secret,
    uri: data.totp.uri,
    friendlyName: data.friendly_name || finalFriendlyName,
  };
}

/**
 * Safely removes an abandoned unverified TOTP enrollment when the user cancels setup.
 */
export async function cancelPendingTotpEnrollment(factorId?: string | null): Promise<void> {
  if (!factorId) return;
  try {
    const { unverified } = await listAdminTotpFactors();
    if (unverified.some((f) => f.id === factorId)) {
      await supabase.auth.mfa.unenroll({ factorId });
    }
  } catch {}
}

/**
 * Verifies a 6-digit TOTP code against a Supabase TOTP factor and confirms AAL2 promotion.
 */
export async function verifyAdminTotpChallenge(
  factorId: string,
  rawCode: string
): Promise<{ ok: boolean; user?: User; session?: Session; message?: string }> {
  const code = rawCode.replace(/\D/g, '').trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, message: 'Enter a valid 6-digit passcode from your authenticator app.' };
  }

  const { error: challengeErr } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });

  if (challengeErr) {
    return {
      ok: false,
      message: challengeErr.message || 'Incorrect or expired 6-digit authenticator code.',
    };
  }

  // Refresh/verify live AAL2 state immediately after TOTP verification
  try {
    await supabase.auth.refreshSession();
  } catch {}

  const live = await verifyLiveAdminAal2();
  if (!live.ok || !live.user || !live.session) {
    return {
      ok: false,
      message: live.reason || 'Session did not reach AAL2 assurance level.',
    };
  }

  return { ok: true, user: live.user, session: live.session };
}

/**
 * Removes an enrolled TOTP authenticator device while preventing removal of the final
 * active verified factor (so mandatory 2FA cannot be disabled or bypassed).
 */
export async function unenrollAdminFactor(
  factorId: string
): Promise<{ ok: boolean; message?: string }> {
  const live = await verifyLiveAdminAal2();
  if (!live.ok) {
    return {
      ok: false,
      message: 'Active AAL2 session required to manage authenticator devices.',
    };
  }

  const { verified, unverified } = await listAdminTotpFactors();
  const isVerifiedTarget = verified.some((f) => f.id === factorId);

  if (isVerifiedTarget && verified.length <= 1) {
    return {
      ok: false,
      message:
        'Cannot remove your only active authenticator device. Enroll a replacement device first so mandatory 2FA remains enforced.',
    };
  }

  if (!isVerifiedTarget && !unverified.some((f) => f.id === factorId)) {
    return { ok: false, message: 'Authenticator device not found.' };
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return { ok: false, message: error.message || 'Unable to remove authenticator device.' };
  }
  return { ok: true };
}

/**
 * Server-backed rate limit inspection for login, MFA verification, and recovery actions.
 */
export async function checkAdminAuthRateLimit(
  action: 'login' | 'mfa' | 'recovery',
  email?: string
): Promise<AuthRateLimitStatus> {
  try {
    const params = new URLSearchParams({ action });
    if (email) params.set('email', email.trim().toLowerCase());
    const resp = await fetch(`/api/admin/auth/status?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const json = await resp.json().catch(() => null);
    if (resp.status === 429 && json) {
      return {
        blocked: true,
        remainingAttempts: 0,
        retryAfterSeconds: Number(json.retryAfterSeconds) || 900,
        lockedUntil: json.lockedUntil || null,
        message: json.message || 'Too many failed attempts. Please wait before trying again.',
      };
    }
    if (json) {
      return {
        blocked: Boolean(json.blocked),
        remainingAttempts: Number(json.remainingAttempts ?? 5),
        retryAfterSeconds: Number(json.retryAfterSeconds ?? 0),
        lockedUntil: json.lockedUntil || null,
        message: json.message,
      };
    }
  } catch {}
  return { blocked: false, remainingAttempts: 5, retryAfterSeconds: 0 };
}

/**
 * Records authentication success or failure with the server rate-limiter.
 */
export async function recordAdminAuthAttempt(params: {
  action: 'login' | 'mfa' | 'recovery';
  success: boolean;
  email?: string;
}): Promise<AuthRateLimitStatus> {
  try {
    const resp = await fetch('/api/admin/auth/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: params.action,
        success: params.success,
        email: params.email?.trim().toLowerCase() || undefined,
      }),
    });
    const json = await resp.json().catch(() => null);
    if (json) {
      return {
        blocked: Boolean(json.blocked || resp.status === 429),
        remainingAttempts: Number(json.remainingAttempts ?? (params.success ? 5 : 0)),
        retryAfterSeconds: Number(json.retryAfterSeconds ?? 0),
        lockedUntil: json.lockedUntil || null,
        message: json.message,
      };
    }
  } catch {}
  return { blocked: false, remainingAttempts: 5, retryAfterSeconds: 0 };
}

/**
 * Sends a password reset link strictly to the explicitly authorized administrator email.
 */
export async function sendAdminPasswordRecovery(
  email: string
): Promise<{ ok: boolean; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!isAuthorizedAdminEmail(cleanEmail)) {
    return {
      ok: false,
      message: 'Password recovery is restricted exclusively to the authorized administrator email.',
    };
  }

  const rate = await checkAdminAuthRateLimit('recovery', cleanEmail);
  if (rate.blocked) {
    return {
      ok: false,
      message:
        rate.message ||
        `Too many recovery requests. Please try again in ${Math.ceil(rate.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/#profile` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo,
  });

  await recordAdminAuthAttempt({
    action: 'recovery',
    success: !error,
    email: cleanEmail,
  });

  if (error) {
    return {
      ok: false,
      message: error.message || 'Unable to send recovery email at this time.',
    };
  }

  return {
    ok: true,
    message:
      'Password recovery link dispatched. After resetting your password, your authenticator 6-digit TOTP code will still be required to complete sign-in.',
  };
}

/**
 * Signs out the administrator session (default: global across all active sessions/devices)
 * and clears cached local UID/email hints.
 */
export async function signOutAdminSession(scope: 'global' | 'local' = 'global'): Promise<void> {
  try {
    localStorage.removeItem('fesline_owner_supabase_uid');
    localStorage.removeItem('fesline_owner_supabase_email');
  } catch {}
  try {
    await supabase.auth.signOut({ scope });
  } catch {
    try {
      await supabase.auth.signOut();
    } catch {}
  }
}
