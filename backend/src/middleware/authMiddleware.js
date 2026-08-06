import { supabase } from '../config/supabase.js';

export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Development bypass / public access check
      req.user = { id: 'dev-user-id', role: 'patient', email: 'guest@mediqueue.local' };
      return next();
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized invalid token' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
