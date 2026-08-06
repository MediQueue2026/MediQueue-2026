import { Router } from 'express';
import { createAppointment, getAppointments } from '../controllers/appointmentController.js';
import { updateDoctorStatus, getDoctors } from '../controllers/doctorController.js';

const router = Router();

// Health check
router.get('/health', (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() }));

// Doctor Routes
router.get('/doctors', getDoctors);
router.put('/doctors/:doctorId/status', updateDoctorStatus);

// Appointment Routes
router.get('/appointments', getAppointments);
router.post('/appointments', createAppointment);

// Centers Route
router.get('/centers', (req, res) => {
  res.json({
    centers: [
      { id: 'c1', name: 'MediQueue Central Clinic', address: '124 Medical Plaza', hours: '08:00 - 20:00', services: ['Cardiology', 'General', 'Pediatrics'] }
    ]
  });
});

export default router;
