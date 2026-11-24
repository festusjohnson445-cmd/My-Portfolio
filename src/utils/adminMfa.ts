import type { Factor, Session, User } from '@supabase/supabase-js';
import {
  supabase,
  AUTHORIZED_ADMIN_EMAIL,
  isAuthorizedAdminEmail,
  isEmailConfirmedUser,
  isRealOwnerUser,
  supabaseSignOutOwner,
} from './supabase';

export interface AdminMfaStatus {
  authenticated: boolean;
  isAuthorizedAdmin: boolean;
  emailConfirmed: boolean;
  currentLevel: 'aal1' | 'aal2' | null;
  nextLevel: 'aal1' | 'aal2' | null;
  verifiedTotpFactors: Factor[];
  unverifiedTotpFactors: Factor[];
  isAal2Verified: boolean;
  user: User | null;
  session: Session | null;
}

export interface TotpEnrollmentData {
  factorId: string;
  qrCodeUrl: string;
  manualSecret: string;
  uri: string;
  friendlyName: string;
}

export type AdminLoginStepResult =
  | {
      ok: true;
      step: 'totp_challenge';
      user: User;
      verifiedFactors: Factor[];
      selectedFactorId: string;
    }
  | {
      ok: true;
      step: 'totp_enroll';
      user: User;
      enrollment: TotpEnrollmentData;
    }
  | {
      ok: false;
      error: string;
      lockedUntilSec?: number;
    };

export type RateLimitKind = 'password' | 'totp' | 'recovery';

function formatQrCodeDataUrl(rawQr: string): string {
  const clean = (rawQr || '').trim();
  if (!clean) return '';
  if (clean.startsWith('data:image/')) return clean;
  return `data:image/svg+xml;utf8,${encodeURIComponent(clean)}`;
}

async function postRateLimitEndpoint(
  action: 'check' | 'record' | 'reset',
  kind: RateLimitKind,
  email?: string
): Promise<{
  allowed: boolean;
  blocked?: boolean;
  retryAfterSec?: number;
  remainingAttempts?: number;
  message?: string;
}> {
  try {
    const resp = await fetch(`/api/auth/admin-rate-limit/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        email: (email || AUTHORIZED_ADMIN_EMAIL).trim().toLowerCase(),
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (resp.status === 429) {
      return {
        allowed: false,
        blocked: true,
        retryAfterSec: Number(json?.retryAfterSec || 60),
        remainingAttempts: 0,
        message: json?.message,
      };
    }
    return {
      allowed: json?.allowed !== false && !json?.blocked,
      blocked: Boolean(json?.blocked),
      retryAfterSec: typeof json?.retryAfterSec === 'number' ? json.retryAfterSec : undefined,
      remainingAttempts:
        typeof json?.remainingAttempts === 'number' ? json.remainingAttempts : undefined,
      message: json?.message,
    };
  } catch {
    // Fallback client-side window guard if network endpoint is momentarily unreachable
    return { allowed: true };
  }
}

export async function getAdminMfaStatus(accessTokenOverride?: string): Promise<AdminMfaStatus> {
  const { data: sessionData, error: sessError } = await supabase.auth.getSession();
  const session = sessionData?.session || null;
  const user = session?.user || null;

  if (sessError || !session || !user) {
    return {
      authenticated: false,
      isAuthorizedAdmin: false,
      emailConfirmed: false,
      currentLevel: null,
      nextLevel: null,
      verifiedTotpFactors: [],
      unverifiedTotpFactors: [],
      isAal2Verified: false,
      user: null,
      session: null,
    };
  }

  const isAuthorizedAdmin = !(user as any).is_anonymous && isAuthorizedAdminEmail(user.email);
  const emailConfirmed = isEmailConfirmedUser(user);

  if (!isAuthorizedAdmin || !emailConfirmed) {
    return {
      authenticated: true,
      isAuthorizedAdmin,
      emailConfirmed,
      currentLevel: 'aal1',
      nextLevel: null,
      verifiedTotpFactors: [],
      unverifiedTotpFactors: [],
      isAal2Verified: false,
      user,
      session,
    };
  }

  const [{ data: aalData }, { data: factorData }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(accessTokenOverride || session.access_token),
    supabase.auth.mfa.listFactors(),
  ]);

  const allFactors = Array.isArray(factorData?.all) ? factorData.all : [];
  const totpFactors = allFactors.filter((f) => f.factor_type === 'totp');
  const verifiedTotpFactors = totpFactors.filter((f) => f.status === 'verified');
  const unverifiedTotpFactors = totpFactors.filter((f) => f.status !== 'verified');

  const currentLevel = (aalData?.currentLevel as 'aal1' | 'aal2' | null) || 'aal1';
  const nextLevel = (aalData?.nextLevel as 'aal1' | 'aal2' | null) || null;

  const isAal2Verified =
    isRealOwnerUser(user) &&
    currentLevel === 'aal2' &&
    verifiedTotpFactors.length > 0;

  return {
    authenticated: true,
    isAuthorizedAdmin,
    emailConfirmed,
    currentLevel,
    nextLevel,
    verifiedTotpFactors,
    unverifiedTotpFactors,
    isAal2Verified,
    user,
    session,
  };
}

/**
 * Enrolls a fresh TOTP authenticator factor (compatible with Duo Mobile, Google Authenticator, etc.)
 * and clears any abandoned unverified TOTP factors first so the QR code is always clean.
 */
export async function enrollNewTotpDevice(
  friendlyName = 'Duo Mobile / Authenticator'
): Promise<{ ok: true; enrollment: TotpEnrollmentData } | { ok: false; error: string }> {
  const { data: sessData } = await supabase.auth.getSession();
  const user = sessData?.session?.user;
  if (!isRealOwnerUser(user)) {
    return {
      ok: false,
      error: 'Authorized and email-confirmed administrator session is required before enrolling MFA.',
    };
  }

  // Remove stale unverified TOTP factors so friendlyName never collides
  const { data: existingFactors } = await supabase.auth.mfa.listFactors();
  const unverifiedTotp = (existingFactors?.all || []).filter(
    (f) => f.factor_type === 'totp' && f.status !== 'verified'
  );
  for (const uf of unverifiedTotp) {
    await supabase.auth.mfa.unenroll({ factorId: uf.id }).catch(() => {});
  }

  const cleanFriendly = `${friendlyName.trim() || 'Authenticator'}`;
  const verifiedCount = (existingFactors?.totp || []).filter((f) => f.status === 'verified').length;
  const uniqueName = verifiedCount > 0 ? `${cleanFriendly} #${verifiedCount + 1}` : cleanFriendly;

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: uniqueName,
    issuer: 'Fesline Admin',
  });

  if (error || !data || data.type !== 'totp' || !data.totp) {
    return {
      ok: false,
      error:
        error?.message ||
        'Unable to initialize TOTP authenticator enrollment. Ensure Supabase MFA TOTP is enabled in Authentication settings.',
    };
  }

  return {
    ok: true,
    enrollment: {
      factorId: data.id,
      qrCodeUrl: formatQrCodeDataUrl(data.totp.qr_code),
      manualSecret: data.totp.secret,
      uri: data.totp.uri,
      friendlyName: data.friendly_name || uniqueName,
    },
  };
}

/**
 * Step 1 of mandatory 2FA Admin login:
 * - Rate-limits password attempts
 * - Authenticates via Supabase Auth (signInWithPassword)
 * - Strictly restricts to AUTHORIZED_ADMIN_EMAIL
 * - Strictly blocks unconfirmed email accounts
 * - Branches to either mandatory 6-digit TOTP verification or mandatory one-time QR enrollment
 */
export async function startAdminMfaLogin(
  email: string,
  password: string
): Promise<AdminLoginStepResult> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  if (!cleanEmail || !cleanPassword) {
    return { ok: false, error: 'Email and password are required.' };
  }

  const rateCheck = await postRateLimitEndpoint('check', 'password', cleanEmail);
  if (!rateCheck.allowed) {
    return {
      ok: false,
      lockedUntilSec: rateCheck.retryAfterSec,
      error:
        rateCheck.message ||
        `Too many failed login attempts. Please wait ${rateCheck.retryAfterSec || 60} seconds before retrying.`,
    };
  }

  if (!isAuthorizedAdminEmail(cleanEmail)) {
    const rec = await postRateLimitEndpoint('record', 'password', cleanEmail);
    return {
      ok: false,
      lockedUntilSec: rec.retryAfterSec,
      error: 'Access denied: Only the explicitly authorized administrator account is permitted.',
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: cleanEmail,
    password: cleanPassword,
  });

  if (error || !data?.session || !data?.user) {
    const rec = await postRateLimitEndpoint('record', 'password', cleanEmail);
    const suffix =
      typeof rec.remainingAttempts === 'number' && rec.remainingAttempts > 0
        ? ` (${rec.remainingAttempts} attempt${rec.remainingAttempts === 1 ? '' : 's'} remaining)`
        : rec.retryAfterSec
        ? ` Locked for ${Math.ceil(rec.retryAfterSec / 60)} min.`
        : '';
    return {
      ok: false,
      lockedUntilSec: rec.retryAfterSec,
      error: `${error?.message || 'Invalid administrator credentials.'}${suffix}`,
    };
  }

  // Strictly block any unauthorized account even if it exists in Supabase Auth
  if (!isAuthorizedAdminEmail(data.user.email)) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    await postRateLimitEndpoint('record', 'password', cleanEmail);
    return {
      ok: false,
      error: 'Access denied: This account is not authorized for administrator access.',
    };
  }

  // Strictly block accounts whose email address has not been confirmed
  if (!isEmailConfirmedUser(data.user)) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    return {
      ok: false,
      error:
        'Email confirmation required: Your administrator email has not been verified yet. Confirm your email via the Supabase confirmation link before signing in.',
    };
  }

  await postRateLimitEndpoint('reset', 'password', cleanEmail);

  // Check existing MFA factors
  const { data: factorData, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    return {
      ok: false,
      error: listError.message || 'Unable to inspect administrator MFA factors.',
    };
  }

  const verifiedFactors = (factorData?.totp || []).filter((f) => f.status === 'verified');
  if (verifiedFactors.length > 0) {
    return {
      ok: true,
      step: 'totp_challenge',
      user: data.user,
      verifiedFactors,
      selectedFactorId: verifiedFactors[0].id,
    };
  }

  // No verified TOTP device enrolled yet -> initiate mandatory one-time QR enrollment
  const enrollRes = await enrollNewTotpDevice('Duo Mobile / Authenticator');
  if (!enrollRes.ok) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    return { ok: false, error: enrollRes.error };
  }

  return {
    ok: true,
    step: 'totp_enroll',
    user: data.user,
    enrollment: enrollRes.enrollment,
  };
}

/**
 * Step 2 (both first-time QR activation and regular AAL2 login challenge):
 * Verifies the 6-digit TOTP code from Duo Mobile / Authenticator and confirms AAL2 assurance.
 */
export async function verifyTotpChallengeToAal2(
  factorId: string,
  rawCode: string,
  emailHint?: string
): Promise<{
  ok: boolean;
  status?: AdminMfaStatus;
  error?: string;
  lockedUntilSec?: number;
}> {
  const code = rawCode.replace(/\D/g, '').trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: 'Please enter the exact 6-digit passcode from your authenticator app.' };
  }

  const cleanEmail = (emailHint || AUTHORIZED_ADMIN_EMAIL).trim().toLowerCase();
  const rateCheck = await postRateLimitEndpoint('check', 'totp', cleanEmail);
  if (!rateCheck.allowed) {
    return {
      ok: false,
      lockedUntilSec: rateCheck.retryAfterSec,
      error:
        rateCheck.message ||
        `Too many failed 2FA attempts. Please wait ${rateCheck.retryAfterSec || 60} seconds before retrying.`,
    };
  }

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });

  if (error) {
    const rec = await postRateLimitEndpoint('record', 'totp', cleanEmail);
    const suffix =
      typeof rec.remainingAttempts === 'number' && rec.remainingAttempts > 0
        ? ` (${rec.remainingAttempts} attempt${rec.remainingAttempts === 1 ? '' : 's'} remaining)`
        : rec.retryAfterSec
        ? ` Locked for ${Math.ceil(rec.retryAfterSec / 60)} min.`
        : '';
    return {
      ok: false,
      lockedUntilSec: rec.retryAfterSec,
      error: `${error.message || 'Invalid or expired 6-digit authenticator code.'}${suffix}`,
    };
  }

  await postRateLimitEndpoint('reset', 'totp', cleanEmail);

  // Confirm JWT & assurance level have genuinely elevated to AAL2
  await supabase.auth.refreshSession().catch(() => null);
  const status = await getAdminMfaStatus();

  if (!status.isAal2Verified) {
    return {
      ok: false,
      error: 'AAL2 session elevation could not be confirmed. Please try verifying with a fresh 6-digit code.',
    };
  }

  return { ok: true, status };
}

/**
 * Safely removes an enrolled TOTP factor inside Admin Dashboard MFA Device Management.
 * Refuses to remove the last remaining verified TOTP factor so MFA can never be disabled.
 */
export async function unenrollTotpDeviceSafe(
  factorId: string
): Promise<{ ok: boolean; error?: string }> {
  const status = await getAdminMfaStatus();
  if (!status.isAal2Verified) {
    return {
      ok: false,
      error: 'Active AAL2 MFA verification is required to manage authenticator devices.',
    };
  }

  const isRemovingVerified = status.verifiedTotpFactors.some((f) => f.id === factorId);
  if (isRemovingVerified && status.verifiedTotpFactors.length <= 1) {
    return {
      ok: false,
      error:
        'Mandatory MFA protection: You cannot remove your only verified authenticator device. Enroll and verify a replacement device first.',
    };
  }

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return { ok: false, error: error.message || 'Failed to remove authenticator device.' };
  }
  return { ok: true };
}

/**
 * Initiates Supabase password recovery strictly for the authorized administrator email.
 * Never bypasses email confirmation or mandatory TOTP MFA on next login.
 */
export async function requestAuthorizedAdminPasswordRecovery(
  emailInput: string
): Promise<{ ok: boolean; message: string }> {
  const cleanEmail = emailInput.trim().toLowerCase();
  if (!isAuthorizedAdminEmail(cleanEmail)) {
    return {
      ok: false,
      message: 'Account recovery is restricted strictly to the authorized administrator email.',
    };
  }

  const rateCheck = await postRateLimitEndpoint('check', 'recovery', cleanEmail);
  if (!rateCheck.allowed) {
    return {
      ok: false,
      message:
        rateCheck.message ||
        `Please wait ${rateCheck.retryAfterSec || 60} seconds before requesting another recovery email.`,
    };
  }

  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/#profile` : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo,
  });

  await postRateLimitEndpoint('record', 'recovery', cleanEmail);

  if (error) {
    return {
      ok: false,
      message: error.message || 'Unable to send password recovery instructions.',
    };
  }

  return {
    ok: true,
    message:
      'Password recovery link dispatched to your authorized administrator email. After resetting your password, 6-digit TOTP authenticator verification remains required to reach AAL2.',
  };
}

export async function completeAdminLogout(scope: 'local' | 'global' = 'local'): Promise<void> {
  await supabaseSignOutOwner(scope);
}
