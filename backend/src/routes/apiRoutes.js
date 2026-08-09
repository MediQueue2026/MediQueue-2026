import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import {
  createStaff,
  getMe,
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
} from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { getCenters, createCenter } from '../controllers/centerController.js';
import { createAppointment, getAppointments } from '../controllers/appointmentController.js';
import { updateDoctorStatus, getDoctors, createDoctor, updateDoctor } from '../controllers/doctorController.js';
import { getQueue, getPublicBoard, issueWalkinToken, callNextPatient, updateQueueEntryStatus } from '../controllers/queueController.js';
import { uploadHealthRecord, getPatientRecords } from '../controllers/recordController.js';
import { updateSlotConfig, getAuditLogs } from '../controllers/adminController.js';

const router = Router();

// Health Check
router.get('/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));

// Database Connection Test Endpoint (With Detailed Diagnostics)
router.get('/db-check', async (req, res) => {
  try {
    const rawUrl = process.env.SUPABASE_URL || '';
    const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    const isPlaceholderUrl = rawUrl.includes('placeholder') || rawUrl.includes('your-supabase-project');
    const isPlaceholderKey = rawKey.includes('placeholder') || rawKey.includes('your-supabase');

    if (isPlaceholderUrl || isPlaceholderKey || !rawUrl || !rawKey) {
      return res.status(400).json({
        status: 'error',
        reason: 'placeholder_credentials',
        message: 'Your backend/.env file is still using placeholder Supabase credentials. Please paste your real SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY into backend/.env and restart the server.',
        envState: {
          hasUrl: !!rawUrl,
          urlPreview: rawUrl.slice(0, 25) + '...',
          hasKey: !!rawKey,
          keyLength: rawKey.length
        }
      });
    }

    const { data: centers, error: centersErr } = await supabase
      .from('medical_centers')
      .select('*');

    if (centersErr) {
      return res.status(500).json({
        status: 'error',
        reason: centersErr.code === '42P01' ? 'table_missing' : 'supabase_error',
        message: centersErr.code === '42P01'
          ? 'Connected to Supabase, but the "medical_centers" table does not exist yet! Please run the backend/src/db/schema.sql script in your Supabase SQL Editor.'
          : `Supabase returned error: ${centersErr.message}`,
        details: {
          code: centersErr.code,
          message: centersErr.message,
          hint: centersErr.hint,
          details: centersErr.details
        }
      });
    }

    const { data: users } = await supabase.from('users').select('id, email, role');

    res.json({
      status: 'connected',
      message: '✅ Successfully connected to Supabase PostgreSQL database via Backend Service Role!',
      database: {
        medicalCentersCount: centers ? centers.length : 0,
        usersCount: users ? users.length : 0,
        sampleCenters: centers,
        sampleUsers: users
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      message: 'Database check failed due to unexpected exception',
      error: err.message
    });
  }
});

// ── Auth Routes ─────────────────────────────────────────────────────────────
// Public: anyone can attempt a sign-in, patients can self-register, and the
// refresh endpoint authenticates via its own httpOnly cookie rather than a
// Bearer token.
router.post('/auth/login', loginUser);
router.post('/auth/register', registerUser);
router.post('/auth/refresh', refreshSession);
router.post('/auth/logout', logoutUser);
router.get('/auth/me', authMiddleware, getMe);
// Staff accounts (doctor / receptionist / admin) are created by an admin only —
// there is deliberately no self-service path to a privileged role.
router.post('/auth/staff', authMiddleware, requireRole(['admin']), createStaff);

// ── Public Routes ───────────────────────────────────────────────────────────
// The landing page reads centres and live doctor status without signing in.
router.get('/centers', getCenters);
router.get('/doctors', getDoctors);
// Token numbers and counts only — no patient identity. Safe for a lobby screen.
router.get('/queue/board', getPublicBoard);

// ── Staff Routes ────────────────────────────────────────────────────────────
router.post('/centers', authMiddleware, requireRole(['admin']), createCenter);
router.post('/doctors', authMiddleware, requireRole(['admin', 'receptionist']), createDoctor);
router.put(
  '/doctors/:doctorId/status',
  authMiddleware,
  requireRole(['doctor', 'receptionist', 'admin']),
  updateDoctorStatus,
);
router.put(
  '/doctors/:doctorId',
  authMiddleware,
  requireRole(['admin', 'receptionist']),
  updateDoctor
);

// Appointment Routes
router.get('/appointments', authMiddleware, getAppointments);
router.post('/appointments', authMiddleware, createAppointment);

// Queue & Reception Routes — the counter, the doctor's panel and admins.
const QUEUE_ROLES = ['receptionist', 'doctor', 'admin'];
router.get('/queue', authMiddleware, requireRole(QUEUE_ROLES), getQueue);
router.post('/queue/walkin', authMiddleware, requireRole(QUEUE_ROLES), issueWalkinToken);
router.post('/queue/call-next', authMiddleware, requireRole(QUEUE_ROLES), callNextPatient);
router.patch('/queue/:id/status', authMiddleware, requireRole(QUEUE_ROLES), updateQueueEntryStatus);

// Health Records Routes
router.post('/records/upload', authMiddleware, requireRole(['doctor', 'admin']), uploadHealthRecord);
router.get('/records/:patientId', authMiddleware, getPatientRecords);

// Admin Routes
router.put('/admin/slot-config', authMiddleware, requireRole(['admin']), updateSlotConfig);
router.get('/admin/audit-logs', authMiddleware, requireRole(['admin']), getAuditLogs);

export default router;
