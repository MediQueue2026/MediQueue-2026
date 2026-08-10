import { notifySubscribedPatients } from '../services/notificationService.js';
import { supabase } from '../config/supabase.js';

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

export async function updateDoctor(req, res, next) {
  try {
    const { doctorId } = req.params;
    const updates = {};

    if (req.body.centerId !== undefined) updates.center_id = req.body.centerId;
    if (typeof req.body.roomNumber === 'string') updates.room_number = req.body.roomNumber;
    if (typeof req.body.specialization === 'string') updates.specialization = req.body.specialization;
    if (typeof req.body.currentStatus === 'string') updates.current_status = req.body.currentStatus;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    const { data, error } = await supabase
      .from('doctors')
      .update(updates)
      .eq('id', doctorId)
      .select('id, specialization, room_number, current_status, max_appointments_per_hour, series, center_id, medical_centers(name), users(full_name)')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const doctor = {
      id: data.id,
      name: data.users?.full_name ?? 'Unknown Doctor',
      dept: data.specialization,
      room: data.room_number ?? '—',
      series: data.series ?? '?',
      status: data.current_status ?? 'active',
      avgConsultMinutes: Math.max(1, Math.round(60 / (data.max_appointments_per_hour || 4))),
      centerId: data.center_id ?? null,
      centerName: data.medical_centers?.name ?? null,
    };

    res.json({ message: 'Doctor updated successfully', doctor });
  } catch (err) {
    next(err);
  }
}

/** Prototype roster shown when the `doctors` table has no rows yet (fresh/unseeded project). */
const FALLBACK_DOCTORS = [
  { id: 'doc-1', name: 'Dr. Aisha Patel', dept: 'Cardiology', room: 'Room 03', series: 'A', status: 'active', avgConsultMinutes: 12 },
  { id: 'doc-2', name: 'Dr. Marcus Reeves', dept: 'General Medicine', room: 'Room 07', series: 'B', status: 'active', avgConsultMinutes: 10 },
  { id: 'doc-3', name: 'Dr. Sofia Montoya', dept: 'Pediatrics', room: 'Room 11', series: 'C', status: 'delayed', avgConsultMinutes: 15 },
];

export async function getDoctors(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('id, specialization, room_number, current_status, max_appointments_per_hour, series, center_id, medical_centers(name), users(full_name)')
      .order('created_at', { ascending: true });
 
    if (error || !data || data.length === 0) {
      return res.json({ doctors: FALLBACK_DOCTORS });
    }
 
    res.json({
      doctors: data.map(d => ({
        id: d.id,
        name: d.users?.full_name ?? 'Unknown Doctor',
        dept: d.specialization,
        room: d.room_number ?? '—',
        series: d.series ?? '?',
        status: d.current_status ?? 'active',
        avgConsultMinutes: Math.max(1, Math.round(60 / (d.max_appointments_per_hour || 4))),
        centerId: d.center_id ?? null,
        centerName: d.medical_centers?.name ?? null,
      })),
    });
  } catch (err) {
    next(err);
  }
}
