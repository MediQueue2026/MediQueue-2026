import { Router } from 'express';
import { loginUser, registerUser } from '../controllers/authController.js';
import { getCenters, createCenter } from '../controllers/centerController.js';
import { createAppointment, getAppointments } from '../controllers/appointmentController.js';
import { updateDoctorStatus, getDoctors } from '../controllers/doctorController.js';
import { issueWalkinToken, callNextPatient } from '../controllers/queueController.js';
import { uploadHealthRecord, getPatientRecords } from '../controllers/recordController.js';
import { updateSlotConfig, getAuditLogs } from '../controllers/adminController.js';

const router = Router();

// Health Check
router.get('/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));

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
router.post('/queue/walkin', issueWalkinToken);
router.post('/queue/call-next', callNextPatient);

// Health Records Routes
router.post('/records/upload', uploadHealthRecord);
router.get('/records/:patientId', getPatientRecords);

// Admin Routes
router.put('/admin/slot-config', updateSlotConfig);
router.get('/admin/audit-logs', getAuditLogs);

export default router;
