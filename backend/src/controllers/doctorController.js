import { notifySubscribedPatients } from '../services/notificationService.js';
import { supabase } from '../config/supabase.js';

export async function updateDoctorStatus(req, res, next) {
  try {
    const { doctorId } = req.params;
    const { currentStatus, delayMinutes, roomNumber, doctorName } = req.body;

    const updates = {};
    if (currentStatus) {
      // Map 'online' to 'active' for consistent DB status representation
      const normStatus = currentStatus === 'online' ? 'active' : currentStatus;
      updates.current_status = normStatus;
      if (normStatus !== 'delayed' && (!delayMinutes || delayMinutes === 0)) {
        updates.delay_minutes = 0;
      }
    }
    if (typeof delayMinutes === 'number') updates.delay_minutes = delayMinutes;
    if (roomNumber) updates.room_number = roomNumber;

    const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (Object.keys(updates).length > 0 && doctorId && doctorId !== 'undefined') {
      let query = supabase.from('doctors').update(updates);
      if (isUuid(doctorId)) {
        query = query.or(`id.eq.${doctorId},user_id.eq.${doctorId}`);
      } else {
        const { data: firstDoc } = await supabase.from('doctors').select('id').limit(1).maybeSingle();
        if (firstDoc) {
          query = query.eq('id', firstDoc.id);
        }
      }

      const { error: dbErr } = await query;
      if (dbErr) {
        console.warn('Doctor status DB update warning:', dbErr.message);
      }
    }

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
    if (typeof req.body.maxAppointmentsPerHour === 'number') updates.max_appointments_per_hour = req.body.maxAppointmentsPerHour;
    if (typeof req.body.series === 'string') updates.series = req.body.series;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    const { data, error } = await supabase
      .from('doctors')
      .update(updates)
      .eq('id', doctorId)
      .select('id, specialization, room_number, current_status, max_appointments_per_hour, available_hours, series, center_id, medical_centers(name), users(full_name)')
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
      maxAppointmentsPerHour: data.max_appointments_per_hour ?? 4,
      centerId: data.center_id ?? null,
      centerName: data.medical_centers?.name ?? null,
    };

    res.json({ message: 'Doctor updated successfully', doctor });
  } catch (err) {
    next(err);
  }
}

export async function getDoctorSummary(req, res, next) {
  try {
    const doctorId = req.params.doctorId || req.query.doctorId;
    const today = new Date().toISOString().slice(0, 10);

    let doctorRow = null;
    if (doctorId && doctorId !== 'null' && doctorId !== 'undefined') {
      const { data: dData } = await supabase
        .from('doctors')
        .select('*, medical_centers(name), users(full_name, email)')
        .or(`id.eq.${doctorId},user_id.eq.${doctorId}`)
        .maybeSingle();
      doctorRow = dData;
    }

    if (!doctorRow) {
      const { data: dFirst } = await supabase
        .from('doctors')
        .select('*, medical_centers(name), users(full_name, email)')
        .limit(1)
        .maybeSingle();
      doctorRow = dFirst;
    }

    const docIdToUse = doctorRow?.id || doctorId;

    const { data: queueRows } = await supabase
      .from('walk_in_queue')
      .select('*, doctors(series)')
      .eq('doctor_id', docIdToUse)
      .order('queue_number', { ascending: true });

    const { data: aptRows } = await supabase
      .from('appointments')
      .select('*, doctors(series), users:patient_id(full_name)')
      .eq('doctor_id', docIdToUse);

    const existingKeys = new Set((queueRows || []).map(r => `${r.doctor_id}_${r.queue_number}`));
    const combinedQueue = [...(queueRows || [])];

    for (const a of aptRows || []) {
      const key = `${a.doctor_id}_${a.queue_number}`;
      if (!existingKeys.has(key)) {
        combinedQueue.push({
          id: a.id,
          patient_id: a.patient_id,
          doctor_id: a.doctor_id,
          queue_number: a.queue_number,
          patient_name: a.users?.full_name || 'Online Patient',
          source: 'online',
          status: a.status === 'booked' ? 'waiting' : a.status,
          is_urgent: false
        });
      }
    }

    combinedQueue.sort((a, b) => a.queue_number - b.queue_number);

    const allQueue = combinedQueue;
    const totalToday = allQueue.length;
    const patientsSeen = allQueue.filter(q => q.status === 'completed').length;
    const remainingTokens = allQueue.filter(q => q.status === 'waiting' || q.status === 'called' || q.status === 'in_progress').length;
    const skippedNoShow = allQueue.filter(q => q.status === 'skipped' || q.status === 'left' || q.status === 'cancelled').length;
    const urgentCases = allQueue.filter(q => q.is_urgent).length;
    const avgConsultTime = patientsSeen > 0 ? `${(15 / patientsSeen).toFixed(1)} min` : '0.0 min';

    const activeRow = allQueue.find(q => q.status === 'called' || q.status === 'in_progress') || allQueue.find(q => q.status === 'waiting') || null;

    const mappedQueueList = allQueue.map(q => ({
      id: q.id,
      patientId: q.patient_id || null,
      token: `#${doctorRow?.series || 'A'}-${String(q.queue_number).padStart(2, '0')}`,
      name: q.patient_name || 'Walk-in Patient',
      age: 35,
      g: 'M',
      complaint: q.source === 'physical' ? 'Physical Walk-in Consultation' : 'Online Booked Appointment',
      status: q.status,
      isUrgent: q.is_urgent || false
    }));

    res.json({
      doctor: {
        id: docIdToUse,
        name: doctorRow?.users?.full_name || 'Dr. Medical Specialist',
        specialization: doctorRow?.specialization || 'General Medicine',
        roomNumber: doctorRow?.room_number || 'Room 01',
        currentStatus: doctorRow?.current_status || 'active',
        delayMinutes: doctorRow?.delay_minutes || 0,
        centerName: doctorRow?.medical_centers?.name || 'MediQueue Central Clinic'
      },
      stats: {
        totalToday,
        avgConsultTime,
        remainingTokens,
        skippedNoShow,
        patientsSeen,
        urgentCases
      },
      activePatient: activeRow ? {
        id: activeRow.id,
        patientId: activeRow.patient_id || null,
        token: `#${doctorRow?.series || 'A'}-${String(activeRow.queue_number).padStart(2, '0')}`,
        name: activeRow.patient_name || 'Patient',
        age: 35,
        gender: 'Male',
        visitType: activeRow.source === 'physical' ? 'Walk-in' : 'Online',
        complaint: 'Consultation & Clinical Assessment',
        allergy: null,
        isFirstVisit: true
      } : null,
      queueList: mappedQueueList,
      queue: allQueue
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /doctors
 * Creates or requests a doctor profile row in public.doctors table.
 * If created by receptionist, approval_status is set to 'pending'.
 */
export async function createDoctor(req, res, next) {
  try {
    const {
      fullName,
      specialization,
      roomNumber,
      series,
      maxAppointmentsPerHour,
      centerId,
      existingDoctorId,
      email,
      phone,
    } = req.body;

    const requesterRole = req.user?.role || 'receptionist';
    const requesterName = req.user?.fullName || req.user?.email || 'Receptionist';
    // If request comes from receptionist, default to 'pending' approval_status
    const approvalStatus = requesterRole === 'admin' ? 'approved' : 'pending';

    // Fetch center name if provided
    let centerName = 'Medical Center';
    if (centerId) {
      const { data: cRow } = await supabase.from('medical_centers').select('name').eq('id', centerId).maybeSingle();
      if (cRow) centerName = cRow.name;
    }

    // Case 1: Assigning an existing doctor to a center
    if (existingDoctorId) {
      const updates = {
        center_id: centerId || null,
        specialization: specialization || undefined,
        room_number: roomNumber || null,
        series: series || null,
        max_appointments_per_hour: maxAppointmentsPerHour || 4,
        approval_status: approvalStatus,
        requested_by_name: requesterName,
      };

      let updatedDoc = null;
      let { data, error: updateErr } = await supabase
        .from('doctors')
        .update(updates)
        .eq('id', existingDoctorId)
        .select('id, specialization, room_number, current_status, approval_status, requested_by_name, max_appointments_per_hour, available_hours, series, center_id, medical_centers(name), users(full_name)')
        .maybeSingle();

      if (updateErr && (updateErr.message.includes('approval_status') || updateErr.code === 'PGRST204')) {
        // Fallback: DB column approval_status missing in Supabase schema
        delete updates.approval_status;
        delete updates.requested_by_name;
        const fallbackRes = await supabase
          .from('doctors')
          .update(updates)
          .eq('id', existingDoctorId)
          .select('id, specialization, room_number, current_status, max_appointments_per_hour, available_hours, series, center_id, medical_centers(name), users(full_name)')
          .single();
        data = fallbackRes.data;
        updateErr = fallbackRes.error;
      }

      if (updateErr) {
        return res.status(500).json({ error: `Could not update doctor assignment: ${updateErr.message}` });
      }

      updatedDoc = data;

      try {
        await supabase.from('audit_logs').insert([{
          actor_name: requesterName,
          actor_role: requesterRole,
          event_type: 'center_edit',
          action: `Requested adding doctor ${updatedDoc?.users?.full_name || 'Doctor'} to ${centerName}`,
          center_name: centerName,
          status: approvalStatus,
        }]);
      } catch (_) {}

      return res.status(200).json({
        message: approvalStatus === 'pending'
          ? 'Doctor assignment submitted to Super Admin for approval'
          : 'Doctor assigned successfully',
        doctor: {
          id: updatedDoc?.id || existingDoctorId,
          name: updatedDoc?.users?.full_name ?? fullName ?? 'Doctor',
          dept: updatedDoc?.specialization ?? specialization ?? 'General Medicine',
          room: updatedDoc?.room_number ?? '—',
          series: updatedDoc?.series ?? '?',
          status: updatedDoc?.current_status ?? 'active',
          approvalStatus: updatedDoc?.approval_status ?? approvalStatus,
          requestedByName: updatedDoc?.requested_by_name ?? requesterName,
          avgConsultMinutes: Math.max(1, Math.round(60 / (updatedDoc?.max_appointments_per_hour || 4))),
          maxAppointmentsPerHour: updatedDoc?.max_appointments_per_hour ?? 4,
          centerId: updatedDoc?.center_id ?? null,
          centerName: updatedDoc?.medical_centers?.name ?? centerName,
        },
      });
    }

    // Case 2: Registering a brand new doctor
    if (!fullName || !specialization) {
      return res.status(400).json({ error: 'fullName and specialization are required' });
    }

    const stubEmail = email || `dr.${fullName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')}.${Date.now()}@mediqueue.internal`;

    let userId = null;
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', stubEmail).maybeSingle();

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: userRow, error: userErr } = await supabase
        .from('users')
        .insert([{ email: stubEmail, full_name: fullName, phone: phone || null, role: 'doctor' }])
        .select('id')
        .single();

      if (userErr) {
        return res.status(500).json({ error: `Could not create user stub: ${userErr.message}` });
      }
      userId = userRow.id;
    }

    const doctorInsertPayload = {
      user_id: userId,
      center_id: centerId || null,
      specialization,
      room_number: roomNumber || null,
      series: series || null,
      max_appointments_per_hour: maxAppointmentsPerHour || 4,
      current_status: 'active',
      approval_status: approvalStatus,
      requested_by_name: requesterName,
    };

    let doctorRow = null;
    let { data: newDocData, error: docErr } = await supabase
      .from('doctors')
      .insert([doctorInsertPayload])
      .select('id, specialization, room_number, current_status, approval_status, requested_by_name, max_appointments_per_hour, available_hours, series, center_id, medical_centers(name), users(full_name)')
      .maybeSingle();

    if (docErr && (docErr.message.includes('approval_status') || docErr.code === 'PGRST204')) {
      // Fallback: column approval_status missing in Supabase schema
      delete doctorInsertPayload.approval_status;
      delete doctorInsertPayload.requested_by_name;

      const fallbackInsert = await supabase
        .from('doctors')
        .insert([doctorInsertPayload])
        .select('id, specialization, room_number, current_status, max_appointments_per_hour, available_hours, series, center_id, medical_centers(name), users(full_name)')
        .single();

      newDocData = fallbackInsert.data;
      docErr = fallbackInsert.error;
    }

    if (docErr) {
      return res.status(500).json({ error: `Could not create doctor profile: ${docErr.message}` });
    }

    doctorRow = newDocData;

    try {
      await supabase.from('audit_logs').insert([{
        actor_name: requesterName,
        actor_role: requesterRole,
        event_type: 'center_edit',
        action: `Submitted registration for Dr. ${fullName} at ${centerName}`,
        center_name: centerName,
        status: approvalStatus,
      }]);
    } catch (_) {}

    res.status(201).json({
      message: approvalStatus === 'pending'
        ? 'Doctor registration submitted to Super Admin for approval'
        : 'Doctor created successfully',
      doctor: {
        id: doctorRow?.id,
        name: doctorRow?.users?.full_name ?? fullName,
        dept: doctorRow?.specialization ?? specialization,
        room: doctorRow?.room_number ?? '—',
        series: doctorRow?.series ?? '?',
        status: doctorRow?.current_status ?? 'active',
        approvalStatus: doctorRow?.approval_status ?? approvalStatus,
        requestedByName: doctorRow?.requested_by_name ?? requesterName,
        avgConsultMinutes: Math.max(1, Math.round(60 / (doctorRow?.max_appointments_per_hour || 4))),
        maxAppointmentsPerHour: doctorRow?.max_appointments_per_hour ?? 4,
        centerId: doctorRow?.center_id ?? null,
        centerName: doctorRow?.medical_centers?.name ?? centerName,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /doctors/pending
 * Returns doctors pending Super Admin approval.
 */
export async function getPendingDoctors(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('*, medical_centers(name), users(full_name, email, phone)')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.message.includes('approval_status') || error.code === 'PGRST204') {
        return res.json({ pendingDoctors: [] });
      }
      return res.status(500).json({ error: error.message });
    }

    const mapped = (data || []).map(d => ({
      id: d.id,
      userId: d.user_id,
      name: d.users?.full_name ?? 'Doctor',
      email: d.users?.email ?? null,
      phone: d.users?.phone ?? null,
      dept: d.specialization || 'General Medicine',
      specialization: d.specialization || 'General Medicine',
      room: d.room_number ?? '—',
      series: d.series ?? '?',
      status: d.current_status ?? 'active',
      approvalStatus: d.approval_status ?? 'pending',
      requestedByName: d.requested_by_name ?? 'Receptionist',
      maxAppointmentsPerHour: d.max_appointments_per_hour ?? 4,
      centerId: d.center_id ?? null,
      centerName: d.medical_centers?.name ?? 'Medical Center',
      createdAt: d.created_at,
    }));

    res.json({ pendingDoctors: mapped });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /doctors/:doctorId/approve
 * Approves a pending doctor record in doctors table.
 */
export async function approveDoctor(req, res, next) {
  try {
    const { doctorId } = req.params;

    let updated = null;
    let { data, error } = await supabase
      .from('doctors')
      .update({ approval_status: 'approved', rejection_reason: null })
      .eq('id', doctorId)
      .select('*, medical_centers(name), users(full_name)')
      .maybeSingle();

    if (error && (error.message.includes('approval_status') || error.code === 'PGRST204')) {
      const fallbackRes = await supabase
        .from('doctors')
        .select('*, medical_centers(name), users(full_name)')
        .eq('id', doctorId)
        .single();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    updated = data;

    const adminName = req.user?.fullName || req.user?.email || 'Super Admin';
    try {
      await supabase.from('audit_logs').insert([{
        actor_name: adminName,
        actor_role: 'admin',
        event_type: 'doctor_approved',
        action: `Approved Dr. ${updated.users?.full_name || 'Doctor'} at ${updated.medical_centers?.name || 'Center'}`,
        center_name: updated.medical_centers?.name || 'Center',
        status: 'approved',
      }]);
    } catch (_) {}

    res.json({
      message: 'Doctor approved successfully',
      doctor: {
        id: updated.id,
        name: updated.users?.full_name ?? 'Doctor',
        dept: updated.specialization,
        room: updated.room_number ?? '—',
        series: updated.series ?? '?',
        status: updated.current_status ?? 'active',
        approvalStatus: 'approved',
        centerId: updated.center_id,
        centerName: updated.medical_centers?.name,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /doctors/:doctorId/reject
 * Rejects a pending doctor record in doctors table.
 */
export async function rejectDoctor(req, res, next) {
  try {
    const { doctorId } = req.params;
    const { reason } = req.body;

    const { data: updated, error } = await supabase
      .from('doctors')
      .update({ approval_status: 'rejected', rejection_reason: reason || 'Rejected by Admin' })
      .eq('id', doctorId)
      .select('*, medical_centers(name), users(full_name)')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const adminName = req.user?.fullName || req.user?.email || 'Super Admin';
    try {
      await supabase.from('audit_logs').insert([{
        actor_name: adminName,
        actor_role: 'admin',
        event_type: 'doctor_rejected',
        action: `Rejected Dr. ${updated.users?.full_name || 'Doctor'} registration (${reason || 'No reason'})`,
        center_name: updated.medical_centers?.name || 'Center',
        status: 'rejected',
      }]);
    } catch (_) {}

    res.json({
      message: 'Doctor registration rejected',
      doctorId,
      approvalStatus: 'rejected',
      reason: reason || 'Rejected by Admin',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /doctors/:doctorId/hours
 */
export async function getDoctorHours(req, res, next) {
  try {
    const { doctorId } = req.params;

    const { data, error } = await supabase
      .from('doctors')
      .select('available_hours, max_appointments_per_hour')
      .eq('id', doctorId)
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const maxPerHour = data?.max_appointments_per_hour ?? 4;
    const stored = data?.available_hours ?? {};

    const allDays = Array.from({ length: 7 }, (_, dow) => {
      const key = String(dow);
      const saved = stored[key];
      if (saved) {
        const hrs = Math.max(0, parseTimeToMinutes(saved.endTime) - parseTimeToMinutes(saved.startTime)) / 60;
        return {
          doctorId,
          dayOfWeek: dow,
          startTime: saved.startTime ?? '08:00',
          endTime: saved.endTime ?? '17:00',
          isAvailable: saved.isAvailable ?? (dow >= 1 && dow <= 5),
          dailyCapacity: (saved.isAvailable ?? true) ? Math.round(hrs * maxPerHour) : 0,
        };
      }
      const isWeekday = dow >= 1 && dow <= 5;
      return {
        doctorId,
        dayOfWeek: dow,
        startTime: '08:00',
        endTime: '17:00',
        isAvailable: isWeekday,
        dailyCapacity: isWeekday ? 9 * maxPerHour : 0,
      };
    });

    res.json({ hours: allDays, maxAppointmentsPerHour: maxPerHour });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /doctors/:doctorId/hours
 */
export async function upsertDoctorHours(req, res, next) {
  try {
    const { doctorId } = req.params;
    const { hours, maxAppointmentsPerHour } = req.body;

    if (!Array.isArray(hours) || hours.length === 0) {
      return res.status(400).json({ error: 'hours array is required' });
    }

    const available_hours = {};
    for (const h of hours) {
      available_hours[String(h.dayOfWeek)] = {
        startTime: h.startTime,
        endTime: h.endTime,
        isAvailable: h.isAvailable ?? true,
      };
    }

    const updates = { available_hours };
    if (typeof maxAppointmentsPerHour === 'number' && maxAppointmentsPerHour > 0) {
      updates.max_appointments_per_hour = maxAppointmentsPerHour;
    }

    const { data, error } = await supabase
      .from('doctors')
      .update(updates)
      .eq('id', doctorId)
      .select('available_hours, max_appointments_per_hour')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Doctor hours updated successfully', available_hours: data?.available_hours });
  } catch (err) {
    next(err);
  }
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

const FALLBACK_DOCTORS = [
  { id: 'doc-1', name: 'Dr. Aisha Patel', dept: 'Cardiology', room: 'Room 03', series: 'A', status: 'active', avgConsultMinutes: 12, maxAppointmentsPerHour: 5 },
  { id: 'doc-2', name: 'Dr. Marcus Reeves', dept: 'General Medicine', room: 'Room 07', series: 'B', status: 'active', avgConsultMinutes: 10, maxAppointmentsPerHour: 6 },
  { id: 'doc-3', name: 'Dr. Sofia Montoya', dept: 'Pediatrics', room: 'Room 11', series: 'C', status: 'delayed', avgConsultMinutes: 15, maxAppointmentsPerHour: 4 },
];

export async function getDoctors(req, res, next) {
  try {
    const includePending = req.query.includePending === 'true' || req.query.all === 'true';

    let query = supabase
      .from('doctors')
      .select('*, medical_centers(id, name), users(full_name, email, phone)');

    if (!includePending) {
      // By default, show approved doctors or those with null approval_status (legacy seed data)
      query = query.or('approval_status.eq.approved,approval_status.is.null');
    }

    let { data: doctorsData, error: dErr } = await query;

    if (dErr && (dErr.message.includes('approval_status') || dErr.code === 'PGRST204')) {
      const fallbackQuery = await supabase
        .from('doctors')
        .select('*, medical_centers(id, name), users(full_name, email, phone)');
      doctorsData = fallbackQuery.data;
      dErr = fallbackQuery.error;
    }

    if (dErr) {
      console.warn('Doctors fetch warning:', dErr.message);
    }

    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, email, phone')
      .eq('role', 'doctor');

    const userMap = new Map((usersData || []).map(u => [u.id, u]));

    if (doctorsData && doctorsData.length > 0) {
      const mapped = doctorsData.map(d => {
        const u = userMap.get(d.user_id) || d.users;
        return {
          id: d.id,
          userId: d.user_id,
          name: u?.full_name ?? d.users?.full_name ?? 'Unknown Doctor',
          email: u?.email ?? d.users?.email ?? null,
          phone: u?.phone ?? d.users?.phone ?? null,
          dept: d.specialization || 'General Medicine',
          specialization: d.specialization || 'General Medicine',
          room: d.room_number ?? '—',
          series: d.series ?? '?',
          status: d.current_status ?? 'active',
          currentStatus: d.current_status ?? 'active',
          approvalStatus: d.approval_status ?? 'approved',
          requestedByName: d.requested_by_name ?? null,
          rejectionReason: d.rejection_reason ?? null,
          delayMinutes: d.delay_minutes ?? 0,
          avgConsultMinutes: Math.max(1, Math.round(60 / (d.max_appointments_per_hour || 4))),
          maxAppointmentsPerHour: d.max_appointments_per_hour ?? 4,
          centerId: d.center_id ?? d.medical_centers?.id ?? 'a1000000-0000-0000-0000-000000000001',
          centerName: d.medical_centers?.name ?? 'MediQueue Central Clinic'
        };
      });

      return res.json({ doctors: mapped });
    }

    if (usersData && usersData.length > 0) {
      const mappedFromUsers = usersData.map((u, i) => ({
        id: u.id,
        userId: u.id,
        name: u.full_name,
        email: u.email,
        phone: u.phone,
        dept: 'General Medicine',
        specialization: 'General Medicine',
        room: `Room 0${i + 1}`,
        series: String.fromCharCode(65 + i),
        status: 'active',
        approvalStatus: 'approved',
        avgConsultMinutes: 15,
        maxAppointmentsPerHour: 4,
        centerId: 'a1000000-0000-0000-0000-000000000001',
        centerName: 'MediQueue Central Clinic'
      }));

      return res.json({ doctors: mappedFromUsers });
    }

    res.json({ doctors: FALLBACK_DOCTORS.map(d => ({ ...d, approvalStatus: 'approved' })) });
  } catch (err) {
    next(err);
  }
}