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
import { randomUUID } from 'crypto';
import { supabase } from '../config/supabase.js';

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
  };
}

const USER_COLUMNS = 'id, email, full_name, phone, role, avatar_url, is_active, password_hash';

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
  const { data, error } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .ilike('email', email)          // email is matched case-insensitively
    .maybeSingle();
  if (error) {
    assertNotMigrationError(error);
    throw new AuthError(error.message, 500);
  }
  return data ?? null;
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

  const valid = await bcrypt.compare(password, row.password_hash);
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

  const user = toPublicUser(row);
  await ensurePatientProfile(user);
  const tokens = await issueTokens(user, req);

  await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
  await recordLoginAttempt({ userId: user.id, email: user.email, role: user.role, status: 'success', req });

  return { user, ...tokens };
}

export async function register({ email, password, fullName, phone, role }, req) {
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

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
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
  await ensurePatientProfile(user);

  const tokens = await issueTokens(user, req);
  await recordLoginAttempt({ userId: user.id, email: user.email, role: user.role, status: 'success', req });
  return { user, ...tokens };
}

async function ensurePatientProfile(user) {
  if (user.role !== 'patient') return;

  const { data: existing } = await supabase
    .from('patient_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase.from('patient_profiles').insert([{
      user_id: user.id,
      nic: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      blood_group: 'O+',
      allergies: '',
      chronic_conditions: '',
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

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
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

  const { data: row } = await supabase
    .from('users')
    .select(USER_COLUMNS)
    .eq('id', session.user_id)
    .maybeSingle();

  if (!row) throw new AuthError('Account no longer exists.', 401);
  if (row.is_active === false) {
    await supabase.from('refresh_sessions').delete().eq('user_id', row.id);
    throw new AuthError('This account has been suspended.', 403);
  }

  // Rotate: burn the used row, then issue a fresh pair.
  await supabase.from('refresh_sessions').delete().eq('id', session.id);

  const user = toPublicUser(row);
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
  const { data } = await supabase.from('users').select(USER_COLUMNS).eq('id', id).maybeSingle();
  return data ? toPublicUser(data) : null;
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET());
}
