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

import { authMiddleware, optionalAuth } from '../middleware/authMiddleware.js';
import { requireRole } from '../middleware/roleMiddleware.js';
import { getCenters, createCenter, updateCenter, deleteCenter } from '../controllers/centerController.js';
import { createAppointment, getAppointments, getPatientAppointments } from '../controllers/appointmentController.js';
import { updateDoctorStatus, getDoctors, updateDoctor, createDoctor, getDoctorHours, upsertDoctorHours, getDoctorSummary } from '../controllers/doctorController.js';
import { getQueue, getPublicBoard, issueWalkinToken, callNextPatient, updateQueueEntryStatus } from '../controllers/queueController.js';
import { uploadHealthRecord, getPatientRecords, createPrescriptionRecord } from '../controllers/recordController.js';
import { updateSlotConfig, getAuditLogs, createAuditLog, updateAuditLogStatus, getUsers, updateUser, deleteUser } from '../controllers/adminController.js';
import { getPatientProfile, updatePatientProfile, getDoctorSubscriptions, toggleDoctorSubscription } from '../controllers/userController.js';

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
router.post('/auth/login', loginUser);
router.post('/auth/register', registerUser);
router.post('/auth/refresh', refreshSession);
router.post('/auth/logout', logoutUser);
router.get('/auth/me', authMiddleware, getMe);
router.post('/auth/staff', authMiddleware, requireRole(['admin']), createStaff);

// ── Patient Profile & Subscription Routes ──────────────────────────────────
router.get('/patient/profile/:userId', getPatientProfile);
router.put('/patient/profile/:userId', updatePatientProfile);
router.get('/subscriptions/patient/:patientId', getDoctorSubscriptions);
router.post('/subscriptions/toggle', toggleDoctorSubscription);

// ── Public Routes ───────────────────────────────────────────────────────────
router.get('/centers', getCenters);
router.get('/doctors', getDoctors);
router.get('/queue/board', getPublicBoard);

// ── Staff & Doctor Management Routes ────────────────────────────────────────
router.post('/centers', authMiddleware, requireRole(['admin']), createCenter);
router.put('/centers/:id', authMiddleware, requireRole(['admin']), updateCenter);
router.delete('/centers/:id', authMiddleware, requireRole(['admin']), deleteCenter);
router.put(
  '/doctors/:doctorId/status',
  optionalAuth,
  updateDoctorStatus,
);
router.put('/doctors/:doctorId', authMiddleware, requireRole(['admin']), updateDoctor);
router.post('/doctors', authMiddleware, requireRole(['receptionist', 'admin']), createDoctor);
router.get('/doctors/:doctorId/summary', getDoctorSummary);
router.get('/doctors/:doctorId/hours', getDoctorHours);
router.put('/doctors/:doctorId/hours', authMiddleware, requireRole(['receptionist', 'admin']), upsertDoctorHours);

// ── Appointment Routes ──────────────────────────────────────────────────────
router.get('/appointments', getAppointments);
router.get('/appointments/patient/:patientId', getPatientAppointments);
router.post('/appointments', createAppointment);

// ── Queue & Reception Routes ────────────────────────────────────────────────
const QUEUE_ROLES = ['receptionist', 'doctor', 'admin'];
router.get('/queue', authMiddleware, requireRole(QUEUE_ROLES), getQueue);
router.post('/queue/walkin', authMiddleware, requireRole(QUEUE_ROLES), issueWalkinToken);
router.post('/queue/call-next', optionalAuth, callNextPatient);
router.patch('/queue/:id/status', optionalAuth, updateQueueEntryStatus);

// ── Health Records Routes ───────────────────────────────────────────────────
router.post('/records/upload', uploadHealthRecord);
router.post('/records/prescription', createPrescriptionRecord);
router.get('/records/:patientId', getPatientRecords);

// ── Admin Routes ────────────────────────────────────────────────────────────
router.get('/users', authMiddleware, requireRole(['admin']), getUsers);
router.put('/users/:id', authMiddleware, requireRole(['admin']), updateUser);
router.delete('/users/:id', authMiddleware, requireRole(['admin']), deleteUser);
router.put('/admin/slot-config', authMiddleware, requireRole(['admin']), updateSlotConfig);
router.get('/admin/audit-logs', authMiddleware, requireRole(['admin']), getAuditLogs);
router.post('/admin/audit-logs', authMiddleware, requireRole(['admin']), createAuditLog);
router.patch('/admin/audit-logs/:id/status', authMiddleware, requireRole(['admin']), updateAuditLogStatus);

export default router;