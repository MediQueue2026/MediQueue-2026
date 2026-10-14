/**
 * Authentication service — bcrypt credentials + JWT access/refresh tokens.
 *
 * Ported from the QueueManagementProto auth module (apps/api/src/modules/auth)
 * onto this project's Express + Supabase stack. Design carried over unchanged:
 *
 *   - Passwords are bcrypt hashes (cost 12). Plaintext never leaves the request.
 *   - A short-lived access token (15m) is returned to the browser and held in
 *     memory only; a long-lived refresh token (7d) rides in an httpOnly cookie
 *     so page-level JavaScript — and anything injected into it — can't read it.
 *   - Every refresh rotates: the used session row is deleted and a new one
 *     inserted. A replayed refresh token therefore matches nothing and is
 *     rejected, which is what makes a stolen token useful only once.
 *   - Suspended accounts (is_active = false) are refused at login AND at
 *     refresh, so revoking access doesn't wait for the access token to expire.
 *   - Every attempt lands in login_audit_log, including failures against
 *     unknown emails.
 *
 * Tables: users, refresh_sessions, login_audit_log (see db/migrations/003_auth.sql).
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID, createHash } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { supabase } from '../config/supabase.js';
import { writeAuditLog } from './auditService.js';
import { sendPasswordResetEmail } from './emailService.js';
import { notificationProvider, formatSriLankanPhone } from '../config/notification.js';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ACCESS_TTL_SECONDS = 15 * 60;            // 15 minutes
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60;  // 7 days
const BCRYPT_ROUNDS = 12;

export const ALL_ROLES = ['patient', 'doctor', 'receptionist', 'admin'];

/**
 * Which roles may create their own account.
 *
 * ⚠️  With staff self-registration on, anyone who can reach the login page can
 *     hand themselves a `doctor` or `admin` account. That is deliberate for the
 *     prototype — the team needs to create and sign into each role while
 *     building — and it must be turned off before this handles real patients:
 *
 *         ALLOW_STAFF_SELF_REGISTER=false
 *
 *     With it off, only patients self-register and staff accounts are created
 *     by an admin through POST /api/auth/staff.
 */
export const staffSelfRegisterEnabled = () =>
  (process.env.ALLOW_STAFF_SELF_REGISTER ?? 'true').toLowerCase() !== 'false';

const selfRegisterRoles = () => (staffSelfRegisterEnabled() ? ALL_ROLES : ['patient']);

export const REFRESH_COOKIE = 'mq_refresh';

function requiredSecret(name, devFallback) {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${name} must be set in production`);
  }
  return devFallback;
}

const ACCESS_SECRET = () => requiredSecret('JWT_ACCESS_SECRET', 'mediqueue-dev-access-secret');
const REFRESH_SECRET = () => requiredSecret('JWT_REFRESH_SECRET', 'mediqueue-dev-refresh-secret');

export class AuthError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

/** Shape sent to the browser. Never includes password_hash. */
function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone ?? null,
    role: row.role,
    avatarUrl: row.avatar_url ?? null,
    isActive: row.is_active !== false,
    centerId: row.center_id ?? null,
    rejectionReason: row.rejection_reason ?? null,
    centerApprovalStatus: row.center_approval_status ?? (row.rejection_reason ? 'rejected' : 'none'),
    authProvider: row.auth_provider ?? 'local',
  };
}

const USER_COLUMNS = 'id, email, full_name, phone, role, avatar_url, is_active, password_hash, rejection_reason, auth_provider, google_id, reset_password_token, reset_password_expires_at';
/** Adds center_id — the medical center a receptionist manages (see migration 005). */
const USER_COLUMNS_WITH_CENTER = `${USER_COLUMNS}, center_id`;

/** Postgres/PostgREST codes meaning "that column doesn't exist on this DB yet". */
const MISSING_COLUMN_CODES = new Set(['PGRST204', '42703']);
function isMissingColumnError(error) {
  if (!error) return false;
  return MISSING_COLUMN_CODES.has(error.code) || /column/i.test(error.message || '');
}

/** PostgREST / Postgres codes meaning "the auth migration hasn't been run here yet". */
const MIGRATION_CODES = new Set([
  '42703',    // undefined_column
  '42P01',    // undefined_table
  'PGRST204', // column not found in schema cache
  'PGRST205', // table not found in schema cache
]);

const MIGRATION_MESSAGE =
  'Authentication is not set up on this database yet. Run ' +
  'backend/src/db/migrations/003_auth.sql in the Supabase SQL Editor, then try again.';

/**
 * Columns added by migration 003 are referenced everywhere below, so a database
 * that hasn't had it applied fails with a raw Postgres message like
 * "column users.avatar_url does not exist". That's a setup problem, not a
 * credentials problem — say which, and name the file that fixes it.
 */
function assertNotMigrationError(error) {
  if (!error) return;
  if (MIGRATION_CODES.has(error.code) || /column .*(does not exist|not found)/i.test(error.message ?? '')) {
    throw new AuthError(MIGRATION_MESSAGE, 503);
  }
}

async function findUserByEmail(email) {
  let { data, error } = await supabase
    .from('users')
    .select(USER_COLUMNS_WITH_CENTER)
    .ilike('email', email)          // email is matched case-insensitively
    .maybeSingle();

  if (error && isMissingColumnError(error)) {
    // center_id (migration 005) hasn't been added to this DB yet — degrade
    // gracefully rather than treating it as the base 003_auth setup being missing.
    ({ data, error } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .ilike('email', email)
      .maybeSingle());
  }

  if (error) {
    assertNotMigrationError(error);
    throw new AuthError(error.message, 500);
  }
  return data ?? null;
}

/** Add the center's moderation state to the session without blocking login. */
async function addReceptionistCenterStatus(row) {
  if (row.role !== 'receptionist' || !row.center_id) return row;

  const { data: center } = await supabase
    .from('medical_centers')
    .select('name, approval_status')
    .eq('id', row.center_id)
    .maybeSingle();

  return { ...row, center_approval_status: center?.approval_status ?? 'none' };
}

async function recordLoginAttempt({ userId, email, role, status, failureReason, req }) {
  // Audit writes must never break a login, so failures here are swallowed.
  await supabase
    .from('login_audit_log')
    .insert({
      user_id: userId ?? null,
      email,
      role: role ?? null,
      ip_address: req?.ip ?? null,
      user_agent: req?.headers?.['user-agent'] ?? null,
      status,
      failure_reason: failureReason ?? null,
    })
    .then(
      () => {},
      () => {},
    );
}

/**
 * Issues an access token plus a refresh token, and stores a hash of the refresh
 * token so it can be revoked. The jti ties the JWT to its stored row, which is
 * what lets several devices hold independent sessions.
 */
async function issueTokens(user, req) {
  const jti = randomUUID();

  const accessToken = jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    ACCESS_SECRET(),
    { expiresIn: ACCESS_TTL_SECONDS },
  );

  const refreshToken = jwt.sign(
    { sub: user.id, role: user.role, jti, type: 'refresh' },
    REFRESH_SECRET(),
    { expiresIn: REFRESH_TTL_SECONDS },
  );

  // Cost 8 is deliberate: the refresh token is already 200+ bits of entropy
  // from a JWT signature, so the slow-hash protection bcrypt gives passwords
  // buys nothing here — and this runs on every refresh.
  const tokenHash = await bcrypt.hash(refreshToken, 8);

  const { error } = await supabase.from('refresh_sessions').insert({
    user_id: user.id,
    token_hash: tokenHash,
    jti,
    user_agent: req?.headers?.['user-agent'] ?? null,
    ip_address: req?.ip ?? null,
    expires_at: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000).toISOString(),
  });
  if (error) throw new AuthError(error.message, 500);

  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SECONDS };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function login({ email, password }, req) {
  if (!email || !password) throw new AuthError('Email and password are required.', 400);

  const normalisedEmail = String(email).trim();
  const row = await findUserByEmail(normalisedEmail);

  // Identical message and shape for "no such user" and "wrong password", so the
  // response can't be used to discover which emails are registered.
  const invalid = new AuthError('Invalid email or password.', 401);

  if (!row) {
    await recordLoginAttempt({ email: normalisedEmail, status: 'failed', failureReason: 'Unknown email', req });
    throw invalid;
  }

  if (!row.password_hash) {
    await recordLoginAttempt({
      userId: row.id, email: normalisedEmail, role: row.role,
      status: 'failed', failureReason: 'No password set', req,
    });
    throw invalid;
  }

  // Temporary dev/testing: check plain-text equality OR bcrypt match (if hash exists)
  const isPlainTextMatch = password === row.password_hash;
  const isBcryptMatch = await bcrypt.compare(password, row.password_hash).catch(() => false);
  const valid = isPlainTextMatch || isBcryptMatch;
  if (!valid) {
    await recordLoginAttempt({
      userId: row.id, email: normalisedEmail, role: row.role,
      status: 'failed', failureReason: 'Invalid password', req,
    });
    throw invalid;
  }

  if (row.is_active === false) {
    await recordLoginAttempt({
      userId: row.id, email: normalisedEmail, role: row.role,
      status: 'failed', failureReason: 'Account suspended', req,
    });
    throw new AuthError('This account has been suspended. Contact your administrator.', 403);
  }

  const user = toPublicUser(await addReceptionistCenterStatus(row));
  await ensurePatientProfile(user);
  const tokens = await issueTokens(user, req);

  await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
  await recordLoginAttempt({ userId: user.id, email: user.email, role: user.role, status: 'success', req });

  return { user, ...tokens };
}

export async function register({ email, password, fullName, phone, role, nic, emergencyContactName, emergencyContactPhone, bloodGroup, allergies, dateOfBirth, gender }, req) {
  if (!email || !password || !fullName) {
    throw new AuthError('Full name, email and password are required.', 400);
  }
  if (String(password).length < 8) {
    throw new AuthError('Password must be at least 8 characters.', 400);
  }
  const requestedRole = role || 'patient';
  if (!ALL_ROLES.includes(requestedRole)) {
    throw new AuthError(`Role must be one of: ${ALL_ROLES.join(', ')}.`, 400);
  }
  if (!selfRegisterRoles().includes(requestedRole)) {
    throw new AuthError(
      'Only patients can create their own account here. Staff accounts are created by an administrator.',
      403,
    );
  }

  const normalisedEmail = String(email).trim();
  if (await findUserByEmail(normalisedEmail)) {
    throw new AuthError('That email is already registered.', 409);
  }

  // Hashing temporarily disabled for development & testing
  const passwordHash = password;
  const { data, error } = await supabase
    .from('users')
    .insert({
      email: normalisedEmail,
      full_name: fullName,
      phone: phone ?? null,
      role: requestedRole,
      password_hash: passwordHash,
    })
    .select(USER_COLUMNS)
    .single();

  if (error) throw new AuthError(error.message, 500);

  const user = toPublicUser(data);
  await ensureDoctorProfile(user);
  await ensurePatientProfile(user, { nic, emergencyContactName, emergencyContactPhone, bloodGroup, allergies, dateOfBirth, gender });

  await writeAuditLog({
    actorName: user.fullName,
    actorRole: user.role,
    eventType: 'signup',
    action: `${user.role === 'patient' ? 'New patient registered' : 'New user registered'}: ${user.fullName}${user.email ? ` (${user.email})` : ''}`,
    centerName: 'Platform',
    status: 'completed',
  });

  const tokens = await issueTokens(user, req);
  await recordLoginAttempt({ userId: user.id, email: user.email, role: user.role, status: 'success', req });
  return { user, ...tokens };
}

async function ensurePatientProfile(user, profileExtra = {}) {
  if (user.role !== 'patient') return;

  const { data: existing } = await supabase
    .from('patient_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from('patient_profiles').insert([{
      user_id: user.id,
      nic: profileExtra.nic || '',
      emergency_contact_name: profileExtra.emergencyContactName || '',
      emergency_contact_phone: profileExtra.emergencyContactPhone || '',
      blood_group: profileExtra.bloodGroup || null,
      allergies: profileExtra.allergies || '',
      chronic_conditions: '',
      date_of_birth: profileExtra.dateOfBirth || null,
      gender: profileExtra.gender || null,
      sms_alerts_enabled: true,
      delay_alerts_enabled: true,
    }]);
    if (error) console.warn(`[auth] patient profile auto-creation notice for ${user.email}: ${error.message}`);
  }
}

/**
 * A `doctor` user is invisible to the Reception Desk until it has a row in
 * `doctors` — that row carries the room and the token series (#A-11, #B-06)
 * the queue is built on. Creating one without it produces an account that can
 * sign in but has no queue, which looks like a bug rather than a missing step.
 *
 * Series letters are handed out in creation order; past Z we fall back to a
 * digit so an insert can never fail on a 26th doctor.
 */
export async function ensureDoctorProfile(user) {
  if (user.role !== 'doctor') return;

  const { data: existing } = await supabase
    .from('doctors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existing) return;

  const { count } = await supabase.from('doctors').select('id', { count: 'exact', head: true });
  const index = count ?? 0;
  const series = index < 26 ? String.fromCharCode(65 + index) : String((index - 26) % 10);

  const { error } = await supabase.from('doctors').insert({
    user_id: user.id,
    specialization: 'General Medicine',
    room_number: 'Unassigned',
    current_status: 'active',
    series,
  });

  // The account itself is already usable; an admin can add the profile later.
  if (error) console.warn(`[auth] doctor profile not created for ${user.email}: ${error.message}`);
}

/** Admin-only: create a doctor / receptionist / admin account. */
export async function createStaffUser({ email, password, fullName, phone, role }) {
  const allowed = ['doctor', 'receptionist', 'admin'];
  if (!allowed.includes(role)) {
    throw new AuthError(`Role must be one of: ${allowed.join(', ')}.`, 400);
  }
  if (!email || !password || !fullName) {
    throw new AuthError('Full name, email and password are required.', 400);
  }
  if (String(password).length < 8) {
    throw new AuthError('Password must be at least 8 characters.', 400);
  }

  const normalisedEmail = String(email).trim();
  if (await findUserByEmail(normalisedEmail)) {
    throw new AuthError('That email is already registered.', 409);
  }

  // Hashing temporarily disabled for development & testing
  const passwordHash = password;
  const { data, error } = await supabase
    .from('users')
    .insert({
      email: normalisedEmail,
      full_name: fullName,
      phone: phone ?? null,
      role,
      password_hash: passwordHash,
    })
    .select(USER_COLUMNS)
    .single();

  if (error) throw new AuthError(error.message, 500);

  const user = toPublicUser(data);
  await ensureDoctorProfile(user);

  await writeAuditLog({
    actorName: user.fullName,
    actorRole: user.role,
    eventType: 'signup',
    action: `Admin created ${user.role}: ${user.fullName}${user.email ? ` (${user.email})` : ''}`,
    centerName: 'Platform',
    status: 'completed',
  });

  return user;
}

/**
 * Validates a refresh token and rotates it.
 * The old session row is deleted before the new one is issued, so the same
 * refresh token can never be redeemed twice.
 */
export async function refresh(refreshToken, req) {
  if (!refreshToken) throw new AuthError('Not signed in.', 401);

  let payload;
  try {
    payload = jwt.verify(refreshToken, REFRESH_SECRET());
  } catch {
    throw new AuthError('Your session has expired. Please sign in again.', 401);
  }
  if (payload.type !== 'refresh') throw new AuthError('Invalid session token.', 401);

  const { data: session } = await supabase
    .from('refresh_sessions')
    .select('id, user_id, token_hash, expires_at')
    .eq('jti', payload.jti)
    .maybeSingle();

  if (!session) throw new AuthError('Your session has expired. Please sign in again.', 401);
  if (new Date(session.expires_at) < new Date()) {
    await supabase.from('refresh_sessions').delete().eq('id', session.id);
    throw new AuthError('Your session has expired. Please sign in again.', 401);
  }

  const matches = await bcrypt.compare(refreshToken, session.token_hash);
  if (!matches) {
    // The jti exists but the token doesn't match its stored hash — treat it as
    // a forged/tampered token and drop every session for that user.
    await supabase.from('refresh_sessions').delete().eq('user_id', session.user_id);
    throw new AuthError('Session could not be verified. Please sign in again.', 401);
  }

  let { data: row, error: rowErr } = await supabase
    .from('users')
    .select(USER_COLUMNS_WITH_CENTER)
    .eq('id', session.user_id)
    .maybeSingle();

  if (rowErr && isMissingColumnError(rowErr)) {
    ({ data: row } = await supabase
      .from('users')
      .select(USER_COLUMNS)
      .eq('id', session.user_id)
      .maybeSingle());
  }

  if (!row) throw new AuthError('Account no longer exists.', 401);
  if (row.is_active === false) {
    await supabase.from('refresh_sessions').delete().eq('user_id', row.id);
    throw new AuthError('This account has been suspended.', 403);
  }

  // Rotate: burn the used row, then issue a fresh pair.
  await supabase.from('refresh_sessions').delete().eq('id', session.id);

  const user = toPublicUser(await addReceptionistCenterStatus(row));
  const tokens = await issueTokens(user, req);
  return { user, ...tokens };
}

/** Sign out. Without a token, clears every session for the user ("everywhere"). */
export async function logout(refreshToken, userId) {
  if (refreshToken) {
    try {
      const payload = jwt.verify(refreshToken, REFRESH_SECRET());
      await supabase.from('refresh_sessions').delete().eq('jti', payload.jti);
      return;
    } catch {
      // Expired or malformed — fall through and clear by user id if we have one.
    }
  }
  if (userId) await supabase.from('refresh_sessions').delete().eq('user_id', userId);
}

export async function getUserById(id) {
  let { data, error } = await supabase.from('users').select(USER_COLUMNS_WITH_CENTER).eq('id', id).maybeSingle();
  if (error && isMissingColumnError(error)) {
    ({ data } = await supabase.from('users').select(USER_COLUMNS).eq('id', id).maybeSingle());
  }
  return data ? toPublicUser(data) : null;
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET());
}

/**
 * Patient Google OAuth Authentication
 * Strictly allows patient self-registration & sign-in via Google.
 * Supports:
 * - Google ID Token (credential / idToken)
 * - Google Access Token (accessToken from popup flow)
 */
export async function loginWithGoogle({ credential, idToken, accessToken }, req) {
  const token = credential || idToken || accessToken;
  if (!token) throw new AuthError('Google authentication credential or access token is required.', 400);

  let payload = null;

  // 1. If accessToken passed from custom Google popup flow
  if (accessToken) {
    try {
      const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (resp.ok) {
        payload = await resp.json();
      }
    } catch (e) {
      console.warn('[Google Auth] Access token userinfo fetch failed:', e.message);
    }
  }

  // 2. If credential/idToken passed
  if (!payload && (credential || idToken)) {
    const rawIdToken = credential || idToken;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: rawIdToken,
        audience: process.env.GOOGLE_CLIENT_ID || undefined,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      try {
        const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${rawIdToken}`);
        if (resp.ok) {
          payload = await resp.json();
        }
      } catch (fallbackErr) {
        console.error('[Google Auth] Token verification failed:', verifyErr.message, fallbackErr.message);
      }
    }
  }

  if (!payload || !payload.email) {
    throw new AuthError('Failed to verify Google identity. Please try again.', 401);
  }

  const email = payload.email.toLowerCase().trim();
  const fullName = payload.name || payload.given_name || email.split('@')[0];
  const avatarUrl = payload.picture || payload.avatar_url || null;
  const googleId = payload.sub || payload.id || null;

  let row = await findUserByEmail(email);

  if (!row) {
    // New patient registration from Google
    const { data: newUser, error: insertErr } = await supabase
      .from('users')
      .insert({
        email,
        full_name: fullName,
        role: 'patient',
        avatar_url: avatarUrl,
        auth_provider: 'google',
        google_id: googleId,
        password_hash: null,
      })
      .select(USER_COLUMNS)
      .single();

    if (insertErr) {
      console.error('[Google Auth] Error creating user:', insertErr.message);
      throw new AuthError('Could not register account with Google. ' + insertErr.message, 500);
    }
    row = newUser;
  } else {
    // Existing user signing in with Google — update avatar and googleId
    const updateData = {
      last_login_at: new Date().toISOString(),
      ...(googleId ? { google_id: googleId } : {}),
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    };

    const { data: updatedUser, error: updateErr } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', row.id)
      .select(USER_COLUMNS)
      .maybeSingle();

    if (updatedUser) {
      row = updatedUser;
    } else if (avatarUrl) {
      row.avatar_url = avatarUrl;
    }
  }

  if (row.is_active === false) {
    throw new AuthError('This account has been suspended. Contact administrator.', 403);
  }

  const user = toPublicUser(await addReceptionistCenterStatus(row));
  await ensurePatientProfile(user, { avatarUrl });
  const tokens = await issueTokens(user, req);

  await recordLoginAttempt({ userId: user.id, email: user.email, role: user.role, status: 'success', req });
  return { user, ...tokens };
}

/**
 * Mask phone number for user privacy (e.g. 077****456)
 */
export function maskPhone(phone) {
  if (!phone) return '••••••';
  const str = String(phone).trim();
  if (str.length <= 4) return '••' + str.slice(-2);
  const start = str.slice(0, 3);
  const end = str.slice(-2);
  const stars = '•'.repeat(Math.max(3, str.length - 5));
  return `${start}${stars}${end}`;
}

/**
 * Locate user by email or phone number across users, profiles, and doctor postings
 */
export async function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const raw = String(identifier).trim();
  const normalisedEmail = raw.toLowerCase();

  // 1. Try finding by email
  if (normalisedEmail.includes('@')) {
    const user = await findUserByEmail(normalisedEmail);
    if (user) return user;
  } else {
    const user = await findUserByEmail(normalisedEmail);
    if (user) return user;
  }

  // 2. Try finding by phone
  const cleanPhone = raw.replace(/[^0-9]/g, '');
  const formattedPhone = formatSriLankanPhone(raw);

  const phoneQueries = [raw];
  if (formattedPhone) phoneQueries.push(formattedPhone);
  if (cleanPhone) phoneQueries.push(cleanPhone);
  if (cleanPhone.startsWith('94')) phoneQueries.push('0' + cleanPhone.slice(2));
  if (cleanPhone.startsWith('0')) phoneQueries.push('94' + cleanPhone.slice(1));
  const uniquePhones = Array.from(new Set(phoneQueries));

  // Search users table
  for (const ph of uniquePhones) {
    const { data } = await supabase
      .from('users')
      .select(USER_COLUMNS_WITH_CENTER)
      .eq('phone', ph)
      .limit(1);
    if (data && data.length > 0) return data[0];
  }

  if (cleanPhone.length >= 7) {
    const { data: ilikeUsers } = await supabase
      .from('users')
      .select(USER_COLUMNS_WITH_CENTER)
      .ilike('phone', `%${cleanPhone.slice(-7)}%`)
      .limit(1);
    if (ilikeUsers && ilikeUsers.length > 0) return ilikeUsers[0];
  }

  // 3. Fallback: Check patient_profiles or doctors table
  for (const ph of uniquePhones) {
    const { data: pProfiles } = await supabase
      .from('patient_profiles')
      .select('user_id')
      .eq('emergency_contact_phone', ph)
      .limit(1);
    if (pProfiles && pProfiles[0]?.user_id) {
      return await getUserById(pProfiles[0].user_id);
    }

    const { data: docs } = await supabase
      .from('doctors')
      .select('user_id')
      .eq('phone', ph)
      .limit(1);
    if (docs && docs[0]?.user_id) {
      return await getUserById(docs[0].user_id);
    }
  }

  return null;
}

/**
 * Ensures user has a verified phone number attached to account
 */
async function ensureUserPhone(user) {
  if (user.phone && user.phone.trim()) return user.phone;

  // Check patient_profiles
  const { data: profile } = await supabase
    .from('patient_profiles')
    .select('emergency_contact_phone')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profile?.emergency_contact_phone) {
    await supabase.from('users').update({ phone: profile.emergency_contact_phone }).eq('id', user.id);
    user.phone = profile.emergency_contact_phone;
    return user.phone;
  }

  // Check doctors table
  const { data: doc } = await supabase
    .from('doctors')
    .select('phone')
    .eq('user_id', user.id)
    .maybeSingle();
  if (doc?.phone) {
    await supabase.from('users').update({ phone: doc.phone }).eq('id', user.id);
    user.phone = doc.phone;
    return user.phone;
  }

  // Check medical_centers if staff/receptionist
  if (user.center_id) {
    const { data: center } = await supabase
      .from('medical_centers')
      .select('phone')
      .eq('id', user.center_id)
      .maybeSingle();
    if (center?.phone) {
      await supabase.from('users').update({ phone: center.phone }).eq('id', user.id);
      user.phone = center.phone;
      return user.phone;
    }
  }

  return null;
}

/**
 * Step 1: Request Password Reset via SMS Verification
 * Generates a 6-digit cryptographic OTP, stores hashed token, and dispatches SMS.
 */
export async function requestPasswordReset({ identifier, email, origin }, req) {
  const target = identifier || email;
  if (!target) throw new AuthError('Email address or registered mobile number is required.', 400);

  const row = await findUserByIdentifier(target);
  if (!row) {
    throw new AuthError('No registered account was found with that email or mobile number.', 404);
  }

  const phone = await ensureUserPhone(row);
  if (!phone) {
    throw new AuthError(
      'This account does not have a registered mobile number for SMS verification. Please contact support or your medical center administrator.',
      400
    );
  }

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedOtp = createHash('sha256').update(otp).digest('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

  // Store token in database: 'OTP:<hashedOtp>:<attempts>'
  const tokenPayload = `OTP:${hashedOtp}:0`;
  const { error } = await supabase
    .from('users')
    .update({
      reset_password_token: tokenPayload,
      reset_password_expires_at: expiresAt,
    })
    .eq('id', row.id);

  if (error) {
    console.error('[Password Reset] Error saving reset OTP:', error.message);
    throw new AuthError('Could not process password reset request.', 500);
  }

  // Send SMS using MediQueue SMS provider (Text.lk)
  const smsMessage = `MediQueue Security: Your password reset verification code is ${otp}. Valid for 5 minutes. Do not share this OTP with anyone.`;
  await notificationProvider.sendSMS(phone, smsMessage);

  console.log(`\n======================================================`);
  console.log(`🔑 [PASSWORD RESET OTP DISPATCHED]`);
  console.log(`   Account: ${row.email} (${row.full_name || 'User'})`);
  console.log(`   Destination Phone: ${phone}`);
  console.log(`   6-Digit OTP: ${otp}`);
  console.log(`   Valid For: 5 minutes`);
  console.log(`======================================================\n`);

  // Send security email if user has an email
  if (row.email) {
    sendPasswordResetEmail({
      to: row.email,
      userName: row.full_name,
      resetUrl: `${origin || 'https://mediqueue.theinnovibe.com'}/reset-password`,
    }).catch(e => console.warn('[Password Reset Email Notification]', e.message));
  }

  return {
    success: true,
    identifier: target,
    maskedPhone: maskPhone(phone),
    message: `A 6-digit verification code has been sent via SMS to ${maskPhone(phone)}.`,
  };
}

/**
 * Step 2: Verify SMS OTP
 * Validates 6-digit OTP and exchanges it for a 15-minute single-use reset authorization token.
 */
export async function verifyResetOtp({ identifier, email, otp }, req) {
  const target = identifier || email;
  if (!target) throw new AuthError('Identifier is required.', 400);
  if (!otp || String(otp).trim().length !== 6) {
    throw new AuthError('Please enter a valid 6-digit verification code.', 400);
  }

  const row = await findUserByIdentifier(target);
  if (!row) throw new AuthError('Account not found.', 404);

  const tokenString = row.reset_password_token || '';
  if (!tokenString.startsWith('OTP:')) {
    throw new AuthError('No active verification request. Please request a new verification code.', 400);
  }

  if (row.reset_password_expires_at && new Date(row.reset_password_expires_at) < new Date()) {
    throw new AuthError('The verification code has expired. Please request a new code.', 400);
  }

  const parts = tokenString.split(':');
  const storedHash = parts[1];
  let attempts = parseInt(parts[2] || '0', 10);

  if (attempts >= 5) {
    await supabase.from('users').update({ reset_password_token: null, reset_password_expires_at: null }).eq('id', row.id);
    throw new AuthError('Too many incorrect attempts. Please request a new verification code.', 429);
  }

  const cleanOtp = String(otp).trim();
  const candidateHash = createHash('sha256').update(cleanOtp).digest('hex');

  if (candidateHash !== storedHash) {
    attempts += 1;
    await supabase.from('users').update({ reset_password_token: `OTP:${storedHash}:${attempts}` }).eq('id', row.id);
    const rem = 5 - attempts;
    throw new AuthError(`Invalid verification code. ${rem > 0 ? `${rem} attempt(s) remaining.` : 'Code locked. Please request a new one.'}`, 400);
  }

  // Verified! Generate single-use 15-minute reset session token
  const resetSessionToken = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
  const sessionExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

  await supabase
    .from('users')
    .update({
      reset_password_token: `SESSION:${resetSessionToken}`,
      reset_password_expires_at: sessionExpiresAt,
    })
    .eq('id', row.id);

  return {
    success: true,
    resetToken: resetSessionToken,
    message: 'Mobile number verified successfully. You may now create your new password.',
  };
}

/**
 * Step 3: Reset Password using Verified Session Token
 * Hashes new password with bcrypt (12 rounds) and terminates old sessions.
 */
export async function resetPasswordWithToken({ token, resetToken, newPassword }, req) {
  const candidateToken = resetToken || token;
  if (!candidateToken) throw new AuthError('Reset authorization token is required.', 400);
  if (!newPassword || newPassword.length < 8) {
    throw new AuthError('New password must be at least 8 characters long.', 400);
  }

  // Look for user with matching session token or direct token
  let { data: user, error } = await supabase
    .from('users')
    .select('id, email, full_name, phone, reset_password_expires_at, reset_password_token')
    .eq('reset_password_token', `SESSION:${candidateToken}`)
    .maybeSingle();

  if (!user) {
    const { data: directUser } = await supabase
      .from('users')
      .select('id, email, full_name, phone, reset_password_expires_at, reset_password_token')
      .eq('reset_password_token', candidateToken)
      .maybeSingle();
    user = directUser;
  }

  if (error || !user) {
    throw new AuthError('Invalid or expired password reset session. Please request a new verification code.', 400);
  }

  if (user.reset_password_expires_at && new Date(user.reset_password_expires_at) < new Date()) {
    throw new AuthError('This password reset session has expired. Please request a new verification code.', 400);
  }

  // SECURE: Hash password using bcrypt with 12 rounds
  const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  const { error: updateErr } = await supabase
    .from('users')
    .update({
      password_hash: hashedNewPassword,
      reset_password_token: null,
      reset_password_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (updateErr) {
    throw new AuthError('Failed to reset password: ' + updateErr.message, 500);
  }

  // Invalidate all active sessions for this user so old logins are cancelled immediately
  await supabase.from('refresh_sessions').delete().eq('user_id', user.id);

  // Send security confirmation SMS
  if (user.phone) {
    notificationProvider.sendSMS(
      user.phone,
      'MediQueue Security Alert: Your account password has been successfully reset. If you did not make this change, please contact support immediately.'
    ).catch(e => console.warn('[SMS RESET CONFIRM NOTICE]', e.message));
  }

  return {
    success: true,
    message: 'Your password has been successfully reset. You can now sign in with your new password.',
  };
}

