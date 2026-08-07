import { Router } from 'express';
import { supabase } from '../config/supabase.js';
import { loginUser, registerUser } from '../controllers/authController.js';
import { getCenters, createCenter } from '../controllers/centerController.js';
import { createAppointment, getAppointments } from '../controllers/appointmentController.js';
import { updateDoctorStatus, getDoctors } from '../controllers/doctorController.js';
import { getQueue, issueWalkinToken, callNextPatient, updateQueueEntryStatus } from '../controllers/queueController.js';
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

// Auth Routes
router.post('/auth/login', loginUser);
router.post('/auth/register', registerUser);

// Center Routes
router.get('/centers', getCenters);
router.post('/centers', createCenter);

// Doctor Routes
router.get('/doctors', getDoctors);
router.put('/doctors/:doctorId/status', updateDoctorStatus);

// Appointment Routes
router.get('/appointments', getAppointments);
router.post('/appointments', createAppointment);

// Queue & Reception Routes
router.get('/queue', getQueue);
router.post('/queue/walkin', issueWalkinToken);
router.post('/queue/call-next', callNextPatient);
router.patch('/queue/:id/status', updateQueueEntryStatus);

// Health Records Routes
router.post('/records/upload', uploadHealthRecord);
router.get('/records/:patientId', getPatientRecords);

// Admin Routes
router.put('/admin/slot-config', updateSlotConfig);
router.get('/admin/audit-logs', getAuditLogs);

export default router;
