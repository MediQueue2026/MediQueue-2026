import { checkSlotAvailability } from '../services/slotLimiterService.js';
import { evaluatePatientNoShowStatus } from '../services/noShowService.js';

export async function createAppointment(req, res, next) {
  try {
    const { doctorId, centerId, appointmentDate, slotHour, patientId } = req.body;

    // 1. Check Slot Limit (BR-02, FR-03)
    const availability = await checkSlotAvailability(doctorId, appointmentDate, slotHour);
    if (!availability.available) {
      return res.status(400).json({
        error: 'Slot limit reached for this hour. Please choose another time slot.',
        availability
      });
    }

    // 2. Check Repeat No-Show Status (BR-03, FR-04)
    const noShowStatus = await evaluatePatientNoShowStatus(patientId);

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment: {
        id: `apt_${Date.now()}`,
        doctorId,
        patientId,
        centerId,
        appointmentDate,
        slotHour,
        isLateNumber: noShowStatus.shouldAssignLateNumber,
        queuePosition: noShowStatus.shouldAssignLateNumber ? 'Late Queue (End of Line)' : '#A-' + Math.floor(Math.random() * 20 + 1)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getAppointments(req, res, next) {
  try {
    res.json({
      appointments: [
        { id: '1', patientName: 'Nimal Silva', token: '#A-11', status: 'waiting', doctor: 'Dr. Aisha Patel' },
        { id: '2', patientName: 'Kasun Perera', token: '#A-12', status: 'next', doctor: 'Dr. Aisha Patel' },
        { id: '3', patientName: 'Rajan Mehta', token: '#A-14', status: 'booked', doctor: 'Dr. Marcus Reeves' }
      ]
    });
  } catch (err) {
    next(err);
  }
}
