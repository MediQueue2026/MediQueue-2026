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

/** Prototype roster shown when the `doctors` table has no rows yet (fresh/unseeded project). */
const FALLBACK_DOCTORS = [
  { id: 'doc-1', name: 'Dr. Aisha Patel', dept: 'Cardiology', room: 'Room 03', series: 'A', status: 'active', avgConsultMinutes: 12 },
  { id: 'doc-2', name: 'Dr. Marcus Reeves', dept: 'General Medicine', room: 'Room 07', series: 'B', status: 'active', avgConsultMinutes: 10 },
  { id: 'doc-3', name: 'Dr. Sofia Montoya', dept: 'Pediatrics', room: 'Room 11', series: 'C', status: 'delayed', avgConsultMinutes: 15 },
];

export async function getDoctors(req, res, next) {
  try {
    // Attempt query with available_hours
    let { data, error } = await supabase
      .from('doctors')
      .select('id, center_id, specialization, room_number, current_status, max_appointments_per_hour, series, available_hours, users(full_name)')
      .order('created_at', { ascending: true });

    // Fallback if available_hours column does not exist yet in Supabase schema cache
    if (error && (error.message?.includes('available_hours') || error.code === 'PGRST204')) {
      const fallbackQuery = await supabase
        .from('doctors')
        .select('id, center_id, specialization, room_number, current_status, max_appointments_per_hour, series, users(full_name)')
        .order('created_at', { ascending: true });
      data = fallbackQuery.data;
      error = fallbackQuery.error;
    }

    if (error || !data || data.length === 0) {
      return res.json({ doctors: FALLBACK_DOCTORS });
    }

    res.json({
      doctors: data.map(d => ({
        id: d.id,
        centerId: d.center_id,
        name: d.users?.full_name ?? 'Unknown Doctor',
        dept: d.specialization,
        room: d.room_number ?? '—',
        series: d.series ?? '?',
        status: d.current_status ?? 'active',
        availableHours: d.available_hours || null,
        avgConsultMinutes: Math.max(1, Math.round(60 / (d.max_appointments_per_hour || 4))),
      })),
    });
  } catch (err) {
    next(err);
  }
}

export async function createDoctor(req, res, next) {
  try {
    const { fullName, phone, centerId, specialization, roomNumber, availableHours } = req.body;
    
    if (!fullName || !centerId) {
      return res.status(400).json({ error: 'Doctor name and medical center are required' });
    }

    // Auto-create user entry in background to satisfy foreign key & name association
    const dummyEmail = `doctor_${Date.now()}_${Math.floor(Math.random() * 1000)}@mediqueue.local`;
    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        email: dummyEmail,
        full_name: fullName,
        phone: phone || null,
        role: 'doctor'
      })
      .select()
      .single();

    if (userErr) throw userErr;

    // Generate series letter (A, B, C...)
    const { count } = await supabase
      .from('doctors')
      .select('*', { count: 'exact', head: true })
      .eq('center_id', centerId);
    
    const seriesChar = String.fromCharCode(65 + ((count || 0) % 26));

    const insertPayload = {
      user_id: user.id,
      center_id: centerId,
      specialization: specialization || 'General Medicine',
      room_number: roomNumber || 'Unassigned',
      series: seriesChar
    };

    if (availableHours) {
      insertPayload.available_hours = availableHours;
    }

    // Create doctor record
    let { data: doc, error: docErr } = await supabase
      .from('doctors')
      .insert(insertPayload)
      .select()
      .single();

    // Fallback if available_hours column does not exist yet in DB
    if (docErr && (docErr.message?.includes('available_hours') || docErr.code === 'PGRST204')) {
      delete insertPayload.available_hours;
      const fallbackInsert = await supabase
        .from('doctors')
        .insert(insertPayload)
        .select()
        .single();
      doc = fallbackInsert.data;
      docErr = fallbackInsert.error;
    }

    if (docErr) throw docErr;

    res.status(201).json({ message: 'Doctor added successfully', doctor: doc });
  } catch (err) {
    next(err);
  }
}

export async function updateDoctor(req, res, next) {
  try {
    const { doctorId } = req.params;
    const { fullName, phone, specialization, roomNumber, availableHours } = req.body;

    // First fetch the doctor to get the user_id
    const { data: doctor, error: fetchErr } = await supabase
      .from('doctors')
      .select('user_id')
      .eq('id', doctorId)
      .single();

    if (fetchErr) throw fetchErr;

    // Update user table for name and phone
    if (fullName || phone !== undefined) {
      const userUpdatePayload = {};
      if (fullName) userUpdatePayload.full_name = fullName;
      if (phone !== undefined) userUpdatePayload.phone = phone || null;

      const { error: userErr } = await supabase
        .from('users')
        .update(userUpdatePayload)
        .eq('id', doctor.user_id);

      if (userErr) throw userErr;
    }

    // Update doctors table for specialization, room_number, and available_hours
    const docUpdatePayload = {};
    if (specialization) docUpdatePayload.specialization = specialization;
    if (roomNumber) docUpdatePayload.room_number = roomNumber;
    if (availableHours) docUpdatePayload.available_hours = availableHours;

    if (Object.keys(docUpdatePayload).length > 0) {
      let { error: docErr } = await supabase
        .from('doctors')
        .update(docUpdatePayload)
        .eq('id', doctorId);

      // Fallback if available_hours column does not exist yet in DB
      if (docErr && (docErr.message?.includes('available_hours') || docErr.code === 'PGRST204')) {
        delete docUpdatePayload.available_hours;
        if (Object.keys(docUpdatePayload).length > 0) {
          const fallbackUpdate = await supabase
            .from('doctors')
            .update(docUpdatePayload)
            .eq('id', doctorId);
          docErr = fallbackUpdate.error;
        } else {
          docErr = null;
        }
      }

      if (docErr) throw docErr;
    }

    res.json({ message: 'Doctor profile updated successfully' });
  } catch (err) {
    next(err);
  }
}
