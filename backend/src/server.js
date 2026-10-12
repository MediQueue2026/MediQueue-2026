import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/apiRoutes.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Logging Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));

/**
 * Configure allowed origins for CORS.
 * Checks ALLOWED_ORIGINS, ALLOW_ORIGINS, CORS_ORIGIN, and defaults to include
 * the company domain (theinnovibe.com and all subdomains) and local dev ports.
 */
const rawEnvOrigins = [
  process.env.ALLOWED_ORIGINS,
  process.env.ALLOW_ORIGINS,
  process.env.CORS_ORIGIN,
  process.env.CORS_ORIGINS,
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
]
  .filter(Boolean)
  .join(',');

const configuredOrigins = new Set([
  'http://localhost:8443',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'https://mediqueue.theinnovibe.com',
  'http://mediqueue.theinnovibe.com',
  'https://theinnovibe.com',
]);

const registerOrigin = (val) => {
  if (!val) return;
  const cleaned = val.trim().replace(/\/+$/, '');
  if (!cleaned) return;
  configuredOrigins.add(cleaned);
  if (!/^https?:\/\//i.test(cleaned)) {
    configuredOrigins.add(`https://${cleaned}`);
    configuredOrigins.add(`http://${cleaned}`);
  }
};

if (rawEnvOrigins) {
  rawEnvOrigins.split(',').forEach(registerOrigin);
}

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser calls (Postman, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = origin.trim().replace(/\/+$/, '');

    // Allow configured origins or wildcard
    if (configuredOrigins.has('*') || configuredOrigins.has(cleanOrigin)) {
      return callback(null, true);
    }

    // Dynamic hostname regex matching:
    // 1. Any subdomain of theinnovibe.com or theinnovibe.com apex
    // 2. Any *.vercel.app deployment
    // 3. Any *.onrender.com deployment
    // 4. Any localhost / 127.0.0.1 port
    try {
      const url = new URL(cleanOrigin);
      const hostname = url.hostname.toLowerCase();

      if (
        hostname === 'theinnovibe.com' ||
        hostname.endsWith('.theinnovibe.com') ||
        hostname.endsWith('.vercel.app') ||
        hostname.endsWith('.onrender.com') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1'
      ) {
        return callback(null, true);
      }
    } catch {
      // Fallback regex matching if URL parsing fails
      if (
        /\.theinnovibe\.com$/i.test(cleanOrigin) ||
        /\.vercel\.app$/i.test(cleanOrigin) ||
        /\.onrender\.com$/i.test(cleanOrigin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(cleanOrigin)
      ) {
        return callback(null, true);
      }
    }

    console.warn(`[CORS Disallowed] ${origin}. Configured origins:`, Array.from(configuredOrigins));
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// Serve local file uploads (fallback storage)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api', apiRoutes);

// Global Error Handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 MediQueue Backend Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔔 Notification Provider: ${process.env.NOTIFICATION_PROVIDER || 'mock'}`);
  console.log(`🔑 Supabase Key Mode: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Service Role Key (Admin)' : 'Anon Key'}`);
});
