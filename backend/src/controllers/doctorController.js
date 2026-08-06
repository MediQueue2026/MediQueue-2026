import { notifySubscribedPatients } from '../services/notificationService.js';

export async function updateDoctorStatus(req, res, next) {
  try {
    const { doctorId } = req.params;
    const { currentStatus, delayMinutes, roomNumber, doctorName } = req.body;

    // Send SMS / In-App alerts to subscribers if delayed (BR-05, FR-07)
    let alertResult = null;
    if (currentStatus === 'delayed' || delayMinutes > 0) {
      alertResult = await notifySubscribedPatients(doctorId, {
        doctorName: doctorName || 'Your Doctor',
        delayMinutes: delayMinutes || 15
      });
    }

    res.json({
      message: 'Doctor status updated successfully',
      status: { doctorId, currentStatus, delayMinutes, roomNumber },
      alertsSent: alertResult
    });
  } catch (err) {
    next(err);
  }
}

export async function getDoctors(req, res, next) {
  try {
    res.json({
      doctors: [
        { id: 'doc-1', name: 'Dr. Aisha Patel', spec: 'Cardiology', room: 'Room 03', serving: '#A-14', wait: '8 min', status: 'active', maxSlots: 4 },
        { id: 'doc-2', name: 'Dr. Marcus Reeves', spec: 'General Medicine', room: 'Room 07', serving: '#B-22', wait: '12 min', status: 'active', maxSlots: 5 },
        { id: 'doc-3', name: 'Dr. Sofia Montoya', spec: 'Pediatrics', room: 'Room 11', serving: '#C-09', wait: '~25 min', status: 'delayed', maxSlots: 3 }
      ]
    });
  } catch (err) {
    next(err);
  }
}
