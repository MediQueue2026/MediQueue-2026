/**
 * Bearer-token authentication.
 *
 * Previously this middleware fell back to a hardcoded `dev-user-id` whenever a
 * request arrived without an Authorization header, which meant every
 * unauthenticated request was silently treated as a signed-in patient. That
 * bypass is gone: no token now means 401.
 *
 * The token is the short-lived access JWT issued by services/authService.js.
 * Refresh tokens are never accepted here — they only work against
 * POST /api/auth/refresh, and only from the httpOnly cookie.
 */

import jwt from 'jsonwebtoken';
import { getUserById, verifyAccessToken } from '../services/authService.js';

function readBearer(req) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

/** Rejects the request unless it carries a valid, unexpired access token. */
export async function authMiddleware(req, res, next) {
  const token = readBearer(req);
  if (!token) {
    return res.status(401).json({ error: 'Sign in to continue.' });
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    const expired = err instanceof jwt.TokenExpiredError;
    return res.status(401).json({
      error: expired ? 'Your session has expired.' : 'Invalid session token.',
      // Lets the client tell "refresh and retry" apart from "sign in again".
      code: expired ? 'token_expired' : 'token_invalid',
    });
  }

  try {
    // Re-read the account each request so a suspension takes effect immediately
    // instead of waiting out the access token's remaining lifetime.
    const user = await getUserById(payload.sub);
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' });
    if (!user.isActive) return res.status(403).json({ error: 'This account has been suspended.' });

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Attaches `req.user` when a valid token is present, but lets anonymous
 * requests through. For endpoints that are public yet behave differently for a
 * signed-in caller.
 */
export async function optionalAuth(req, _res, next) {
  const token = readBearer(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await getUserById(payload.sub);
    if (user?.isActive) req.user = user;
  } catch {
    // Anonymous is a valid outcome here.
  }
  next();
}
