import { supabase } from '../config/supabase.js';

let cachedMaintenanceMode = null;
let lastCacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

export const maintenanceMiddleware = async (req, res, next) => {
  // Allow admin routes, auth routes, and health checks to bypass maintenance mode
  if (
    req.path.startsWith('/admin') ||
    req.path.startsWith('/auth') ||
    req.path === '/health' ||
    req.path === '/db-check' ||
    req.path === '/settings/public'
  ) {
    return next();
  }

  // Allow admins to bypass if they are authenticated
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  try {
    const now = Date.now();
    // Use short-lived in-memory cache to avoid hammering DB on every request
    if (cachedMaintenanceMode === null || (now - lastCacheTime > CACHE_TTL)) {
      const { data, error } = await supabase
        .from('system_settings')
        .select('maintenance_mode')
        .eq('id', 'f1000000-0000-0000-0000-000000000001')
        .single();
      
      if (!error && data) {
        cachedMaintenanceMode = data.maintenance_mode;
        lastCacheTime = now;
      } else {
        cachedMaintenanceMode = false;
      }
    }

    if (cachedMaintenanceMode) {
      return res.status(503).json({
        error: 'System Under Maintenance',
        code: 'MAINTENANCE_MODE',
        message: 'The MediQueue platform is currently undergoing scheduled maintenance. Please try again later.'
      });
    }

    next();
  } catch (error) {
    console.error('Maintenance check error:', error);
    next();
  }
};
