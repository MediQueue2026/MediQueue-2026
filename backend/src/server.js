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
app.use(helmet());

/**
 * The refresh-token cookie only travels on credentialed requests, and the CORS
 * spec forbids pairing `credentials: true` with a wildcard origin — so the
 * allowed origins have to be listed explicitly. Override in .env with a
 * comma-separated ALLOWED_ORIGINS when the frontend moves off localhost.
 */
const ALLOWED_ORIGINS = (
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:8443,http://localhost:5173,http://localhost:3000,http://localhost:4173'
)
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header = same-origin, curl, or a server-side call.
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

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
