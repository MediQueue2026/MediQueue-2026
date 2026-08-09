/**
 * Auth endpoints. All credential handling lives in services/authService.js —
 * these handlers only translate between HTTP and that service.
 *
 * The refresh token is set as an httpOnly cookie and never returned in a JSON
 * body, so the browser can hold a long-lived session without any script being
 * able to read the token.
 */

import {
  AuthError,
  REFRESH_COOKIE,
  createStaffUser,
  getUserById,
  login,
  logout,
  refresh,
  register,
} from '../services/authService.js';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * `sameSite: 'lax'` works because the dev frontend (Vite, port 8443) and the
 * API (port 5000) are both localhost. Behind a single domain in production this
 * stays correct; if the API ever moves to a different site, this must become
 * `sameSite: 'none'` with `secure: true` or the cookie will be dropped.
 */
function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TTL_MS,
  };
}

function fail(res, err, next) {
  if (err instanceof AuthError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  return next(err);
}

export async function loginUser(req, res, next) {
  try {
    const { user, accessToken, refreshToken, expiresIn } = await login(req.body, req);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.json({ user, accessToken, expiresIn });
  } catch (err) {
    fail(res, err, next);
  }
}

export async function registerUser(req, res, next) {
  try {
    const { user, accessToken, refreshToken, expiresIn } = await register(req.body, req);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.status(201).json({ user, accessToken, expiresIn });
  } catch (err) {
    fail(res, err, next);
  }
}

export async function refreshSession(req, res, next) {
  try {
    const { user, accessToken, refreshToken, expiresIn } = await refresh(
      req.cookies?.[REFRESH_COOKIE],
      req,
    );
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
    res.json({ user, accessToken, expiresIn });
  } catch (err) {
    // A dead session should leave no cookie behind to retry with.
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    fail(res, err, next);
  }
}

export async function logoutUser(req, res, next) {
  try {
    await logout(req.cookies?.[REFRESH_COOKIE], req.user?.id);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.json({ success: true });
  } catch (err) {
    fail(res, err, next);
  }
}

export async function getMe(req, res, next) {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
    res.json({ user });
  } catch (err) {
    fail(res, err, next);
  }
}

/** Admin-only — see requireRole(['admin']) on the route. */
export async function createStaff(req, res, next) {
  try {
    const user = await createStaffUser(req.body);
    res.status(201).json({ user });
  } catch (err) {
    fail(res, err, next);
  }
}
