import { supabase } from '../config/supabase.js';
import { resolveDoctor } from '../services/doctorLookup.js';
import { publishDelayAlert } from '../services/delayAlertService.js';
import { genderInitial, parseNic } from '../services/nicService.js';

/**
 * PUT|PATCH /doctors/:doctorId/status
 *
 * Shift changes (active / break / offline) and room moves. Asking for
 * `delayed` (or any positive `delayMinutes`) routes through the same
 * publishDelayAlert path as POST /doctors/:id/delay-alerts, so a delay always
 * leaves a persisted alert for the dashboards — it used to fire SMS and record
 * nothing, which is why patients saw an alert that vanished on reload.
 */
export async function updateDoctorStatus(req, res, next) {
  try {
    const { doctorId } = req.params;
    const { currentStatus, delayMinutes, roomNumber, centerId } = req.body;

    const resolved = await resolveDoctor(doctorId, centerId);
    if (!resolved) {
      // Previously this fell back to "the first doctor in the table", so a bad
      // id silently changed an unrelated doctor's status.
      return res.status(404).json({ error: 'No doctor found for that id.' });
    }
    if (resolved.ambiguous) {
      return res.status(400).json({
        error: 'This doctor works at more than one center — send centerId so the status applies to the right posting.',
      });
    }

    const wantsDelay = currentStatus === 'delayed' || Number(delayMinutes) > 0;

    if (wantsDelay) {
      const minutes = Number.isFinite(Number(delayMinutes)) && Number(delayMinutes) > 0
        ? Math.min(Math.round(Number(delayMinutes)), 480)
        : 15;

      const result = await publishDelayAlert({
        resolved,
        centerId,
        minutes,
        reason: req.body.reason,
        actor: {
          name: req.user?.fullName || req.user?.email || resolved.name,
          role: req.user?.role || 'doctor',
        },
      });

      if (!result.ok) {
        return res.status(result.status).json({ error: result.error, code: result.code });
      }

      return res.json({
        message: 'Doctor marked as delayed and patients notified.',
        status: { doctorId: resolved.doctor.id, currentStatus: 'delayed', delayMinutes: minutes, roomNumber: resolved.roomNumber },
        alert: result.alert,
        alertsSent: { notifiedCount: result.notifiedCount, skippedCount: result.skippedCount },
      });
    }

    // Plain shift change — clearing the delay counter along with it.
    const updates = { delay_minutes: 0 };
    if (currentStatus) {
      // The Doctor Console calls the on-duty state 'online'; the DB CHECK
      // constraint calls it 'active'.
      updates.current_status = currentStatus === 'online' ? 'active' : currentStatus;
    }
    if (roomNumber) updates.room_number = roomNumber;

    if (resolved.posting) {
      const { error } = await supabase
        .from('doctor_center_assignments')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', resolved.posting.id);
      if (error) console.warn('Doctor status DB update warning:', error.message);
    } else {
      // Pre-migration-010 doctor: status still on the doctors row.
      const { error } = await supabase.from('doctors').update(updates).eq('id', resolved.doctor.id);
      if (error) console.warn('Doctor status DB update warning (legacy):', error.message);
    }

    res.json({
      message: 'Doctor status updated successfully',
      status: {
        doctorId: resolved.doctor.id,
        currentStatus: updates.current_status ?? null,
        delayMinutes: 0,
        roomNumber: updates.room_number ?? resolved.roomNumber,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /doctors/:doctorId
 * `specialization` is doctor-wide; room/series/capacity/status belong to the
 * doctor's posting at `centerId`, so those are upserted into
 * `doctor_center_assignments`. `centerId` is required whenever a posting field
 * is present.
 */
export async function updateDoctor(req, res, next) {
  try {
    const { doctorId } = req.params;
    const centerId = req.body.centerId ? String(req.body.centerId) : null;

    // Remove a doctor from one center = drop that posting.
    if (req.body.removeCenterId) {
      await supabase
        .from('doctor_center_assignments')
        .delete()
        .eq('doctor_id', doctorId).eq('center_id', String(req.body.removeCenterId));
      return res.json({ message: 'Doctor removed from center' });
    }

    // Doctor-wide field.
    if (typeof req.body.specialization === 'string') {
      await supabase.from('doctors').update({ specialization: req.body.specialization }).eq('id', doctorId);
    }

    // Per-center posting fields.
    const posting = {};
    if (typeof req.body.roomNumber === 'string') posting.room_number = req.body.roomNumber;
    if (typeof req.body.series === 'string') posting.series = req.body.series;
    if (typeof req.body.currentStatus === 'string') posting.current_status = req.body.currentStatus;
    if (typeof req.body.maxAppointmentsPerHour === 'number') posting.max_appointments_per_hour = req.body.maxAppointmentsPerHour;

    if (Object.keys(posting).length > 0) {
      if (!centerId) {
        return res.status(400).json({ error: 'centerId is required to update a doctor’s room, series, capacity or status.' });
      }
      const { data: existing } = await supabase
        .from('doctor_center_assignments')
        .select('id')
        .eq('doctor_id', doctorId).eq('center_id', centerId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('doctor_center_assignments')
          .update({ ...posting, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('doctor_center_assignments')
          .insert([{ doctor_id: doctorId, center_id: centerId, approval_status: 'approved', ...posting }]);
      }
    } else if (Object.keys(posting).length === 0 && typeof req.body.specialization !== 'string') {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    // Return the doctor flattened to the affected center (or first posting).
    const { data: d } = await supabase
      .from('doctors')
      .select('*, users(full_name, email, phone), doctor_center_assignments(*, medical_centers(id, name))')
      .eq('id', doctorId)
      .single();

    const assignments = Array.isArray(d?.doctor_center_assignments) ? d.doctor_center_assignments : [];
    const centersList = assignments.map(mapAssignment);
    const postingObj = centersList.find(c => c.centerId === centerId) ?? centersList[0] ?? null;

    res.json({ message: 'Doctor updated successfully', doctor: mapDoctor(d, postingObj, centersList) });
  } catch (err) {
    next(err);
  }
}

/**
 * Mean minutes between consecutive consultations actually starting, measured
 * from `called_at`. There is no `completed_at` column, so the gap between one
 * token being called and the next is the best real signal for how long a
 * consultation is taking. Falls back to the posting's scheduled rate
 * (60 / max_appointments_per_hour) until there are two data points.
 */
function averageConsultMinutes(rows, maxPerHour) {
  const calls = (rows || [])
    .filter(r => r.called_at)
    .map(r => new Date(r.called_at).getTime())
    .filter(t => Number.isFinite(t))
    .sort((a, b) => a - b);

  if (calls.length >= 2) {
    const gaps = [];
    for (let i = 1; i < calls.length; i++) {
      const mins = (calls[i] - calls[i - 1]) / 60_000;
      // Drop absurd gaps — an overnight break between sessions isn't a consult.
      if (mins > 0 && mins <= 180) gaps.push(mins);
    }
    if (gaps.length > 0) {
      return gaps.reduce((s, g) => s + g, 0) / gaps.length;
    }
  }

  return 60 / (maxPerHour || 4);
}

/**
 * GET /doctors/:doctorId/summary — everything the Doctor Console renders.
 *
 * Only today's rows are counted. The previous version queried the doctor's
 * entire history, so "Total Today" grew forever and never reset overnight.
 */
export async function getDoctorSummary(req, res, next) {
  try {
    const doctorId = req.params.doctorId || req.query.doctorId;
    const centerId = req.query.centerId ? String(req.query.centerId) : null;
    const today = new Date().toISOString().slice(0, 10);

    const resolved = await resolveDoctor(doctorId, centerId);
    if (!resolved) {
      // No "first doctor in the table" fallback: showing one doctor another
      // doctor's live queue is worse than an explicit 404.
      return res.status(404).json({ error: 'No doctor found for that id.' });
    }

    const doctorRow = resolved.doctor;
    const posting = resolved.posting;
    const docIdToUse = doctorRow.id;
    const series = posting?.series ?? doctorRow.series ?? '?';
    const maxPerHour = posting?.max_appointments_per_hour ?? doctorRow.max_appointments_per_hour ?? 4;
    const token = (n) => `#${series}-${String(n).padStart(2, '0')}`;

    let walkinQuery = supabase
      .from('walk_in_queue')
      .select('*')
      .eq('doctor_id', docIdToUse)
      .eq('queue_date', today)
      .order('queue_number', { ascending: true });
    if (centerId) walkinQuery = walkinQuery.eq('center_id', centerId);
    const { data: queueRows } = await walkinQuery;

    let aptQuery = supabase
      .from('appointments')
      .select('*, users:patient_id(full_name, phone)')
      .eq('doctor_id', docIdToUse)
      .eq('appointment_date', today);
    if (centerId) aptQuery = aptQuery.eq('center_id', centerId);
    const { data: aptRows } = await aptQuery;

    // patient_profiles has no FK from appointments (both point at users), so it
    // can't be embedded — one batched lookup keyed by user id instead.
    const profileByUser = new Map();
    const patientIds = [...new Set((aptRows || []).map(a => a.patient_id).filter(Boolean))];
    if (patientIds.length > 0) {
      const { data: profiles } = await supabase
        .from('patient_profiles')
        .select('user_id, nic, allergies')
        .in('user_id', patientIds);
      for (const p of profiles || []) profileByUser.set(p.user_id, p);
    }

    // Merge the two sources of a token. A walk-in row wins over an appointment
    // with the same number, because the walk-in row is what reception updates.
    const existingKeys = new Set((queueRows || []).map(r => `${r.doctor_id}_${r.queue_number}`));
    const combinedQueue = (queueRows || []).map(r => ({ ...r, _nic: r.nic, _allergies: null }));

    for (const a of aptRows || []) {
      if (existingKeys.has(`${a.doctor_id}_${a.queue_number}`)) continue;
      const profile = profileByUser.get(a.patient_id);
      combinedQueue.push({
        id: a.id,
        patient_id: a.patient_id,
        doctor_id: a.doctor_id,
        queue_number: a.queue_number,
        patient_name: a.users?.full_name || 'Online Patient',
        source: 'online',
        status: a.status === 'booked' ? 'waiting' : a.status,
        called_at: null,
        checked_in_at: a.created_at,
        _nic: profile?.nic ?? null,
        _allergies: profile?.allergies || null,
      });
    }

    combinedQueue.sort((a, b) => a.queue_number - b.queue_number);

    const allQueue = combinedQueue;
    const totalToday = allQueue.length;
    const patientsSeen = allQueue.filter(q => q.status === 'completed').length;
    const remainingTokens = allQueue.filter(q => ['waiting', 'called', 'in_progress'].includes(q.status)).length;
    const skippedNoShow = allQueue.filter(q => ['skipped', 'left', 'cancelled', 'no_show'].includes(q.status)).length;
    const avgMinutes = averageConsultMinutes(allQueue, maxPerHour);

    const activeRow =
      allQueue.find(q => q.status === 'called' || q.status === 'in_progress') ?? null;

    /** Age/gender come from the NIC when there is one; otherwise they stay null. */
    const identity = (row) => {
      const { age, gender } = parseNic(row._nic);
      return { age, gender, g: genderInitial(gender) };
    };

    const mappedQueueList = allQueue.map(q => {
      const { age, g } = identity(q);
      return {
        id: q.id,
        patientId: q.patient_id || null,
        token: token(q.queue_number),
        name: q.patient_name || 'Walk-in Patient',
        age,
        g,
        nic: q._nic || null,
        // No chief-complaint column exists yet, so this states how the patient
        // reached the queue and nothing more — it is not clinical information.
        visitType: q.source === 'physical' ? 'Walk-in' : 'Online',
        allergy: q._allergies || null,
        checkedInAt: q.checked_in_at || null,
        calledAt: q.called_at || null,
        status: q.status,
      };
    });

    const activeIdentity = activeRow ? identity(activeRow) : null;

    res.json({
      doctor: {
        id: docIdToUse,
        userId: doctorRow.user_id,
        name: resolved.name,
        specialization: resolved.specialization,
        roomNumber: resolved.roomNumber,
        currentStatus: posting?.current_status ?? doctorRow.current_status ?? 'active',
        delayMinutes: posting?.delay_minutes ?? doctorRow.delay_minutes ?? 0,
        series,
        centerId: resolved.centerId,
        centerName: resolved.centerName,
        maxAppointmentsPerHour: maxPerHour,
      },
      stats: {
        totalToday,
        avgConsultTime: `${avgMinutes.toFixed(1)} min`,
        avgConsultMinutes: Number(avgMinutes.toFixed(1)),
        /** True while avgConsultTime is the scheduled rate, not a measurement. */
        avgConsultIsEstimate: allQueue.filter(q => q.called_at).length < 2,
        remainingTokens,
        skippedNoShow,
        patientsSeen,
      },
      activePatient: activeRow ? {
        id: activeRow.id,
        patientId: activeRow.patient_id || null,
        token: token(activeRow.queue_number),
        name: activeRow.patient_name || 'Patient',
        nic: activeRow._nic || null,
        age: activeIdentity.age,
        gender: activeIdentity.gender,
        visitType: activeRow.source === 'physical' ? 'Walk-in' : 'Online',
        allergy: activeRow._allergies || null,
        checkedInAt: activeRow.checked_in_at || null,
        calledAt: activeRow.called_at || null,
      } : null,
      queueList: mappedQueueList,
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
/** Resolves the posting to read/write hours against: the one for `centerId`, or
 *  the doctor's sole assignment. Returns null when it can't be pinned down. */
async function resolveHoursAssignment(doctorId, centerId) {
  let q = supabase
    .from('doctor_center_assignments')
    .select('id, available_hours, max_appointments_per_hour, center_id')
    .eq('doctor_id', doctorId);
  if (centerId) q = q.eq('center_id', String(centerId));
  const { data } = await q;
  if (!data || data.length === 0) return null;
  if (data.length === 1) return data[0];
  return centerId ? data[0] : null;
}

export async function getDoctorHours(req, res, next) {
  try {
    const { doctorId } = req.params;
    const centerId = req.query.centerId ? String(req.query.centerId) : null;

    const assignment = await resolveHoursAssignment(doctorId, centerId);

    let maxPerHour = 4;
    let stored = {};
    if (assignment) {
      maxPerHour = assignment.max_appointments_per_hour ?? 4;
      stored = assignment.available_hours ?? {};
    } else {
      // Legacy fallback: hours still on the doctors row (pre multi-center split).
      const { data, error } = await supabase
        .from('doctors')
        .select('available_hours, max_appointments_per_hour')
        .eq('id', doctorId)
        .single();
      if (error) {
        return res.status(500).json({ error: error.message });
      }
      maxPerHour = data?.max_appointments_per_hour ?? 4;
      stored = data?.available_hours ?? {};
    }

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
    const { hours, maxAppointmentsPerHour, centerId } = req.body;

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

    const assignment = await resolveHoursAssignment(doctorId, centerId);

    if (assignment) {
      const { data, error } = await supabase
        .from('doctor_center_assignments')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', assignment.id)
        .select('available_hours, max_appointments_per_hour')
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ message: 'Doctor hours updated successfully', available_hours: data?.available_hours });
    }

    // Legacy fallback: write back to the doctors row.
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

/**
 * Shapes one `doctor_center_assignments` row into the per-center object the
 * frontend `ApiDoctor.centers[]` expects.
 */
function mapAssignment(a) {
  return {
    assignmentId: a.id,
    centerId: a.center_id,
    centerName: a.medical_centers?.name ?? null,
    room: a.room_number ?? '—',
    series: a.series ?? '?',
    status: a.current_status ?? 'active',
    delayMinutes: a.delay_minutes ?? 0,
    maxAppointmentsPerHour: a.max_appointments_per_hour ?? 4,
    approvalStatus: a.approval_status ?? 'approved',
  };
}

/**
 * Builds the flat `ApiDoctor` object. `posting` is the assignment whose
 * room/series/status get hoisted to the top level (the one for the center the
 * caller scoped to, or the doctor's first assignment). Legacy `doctors.*`
 * columns are the fallback for rows created before the multi-center split.
 */
function mapDoctor(d, posting, centersList) {
  const u = d.users;
  const maxPerHour = posting?.maxAppointmentsPerHour ?? d.max_appointments_per_hour ?? 4;
  return {
    id: d.id,
    userId: d.user_id,
    name: u?.full_name ?? 'Unknown Doctor',
    email: u?.email ?? null,
    phone: u?.phone ?? null,
    dept: d.specialization || 'General Medicine',
    specialization: d.specialization || 'General Medicine',
    room: posting?.room ?? d.room_number ?? '—',
    series: posting?.series ?? d.series ?? '?',
    status: posting?.status ?? d.current_status ?? 'active',
    currentStatus: posting?.status ?? d.current_status ?? 'active',
    approvalStatus: d.approval_status ?? 'approved',
    requestedByName: d.requested_by_name ?? null,
    rejectionReason: d.rejection_reason ?? null,
    delayMinutes: posting?.delayMinutes ?? d.delay_minutes ?? 0,
    avgConsultMinutes: Math.max(1, Math.round(60 / (maxPerHour || 4))),
    maxAppointmentsPerHour: maxPerHour,
    centerId: posting?.centerId ?? null,
    centerName: posting?.centerName ?? null,
    centers: centersList,
  };
}

export async function getDoctors(req, res, next) {
  try {
    const includePending = req.query.includePending === 'true' || req.query.all === 'true';

    // Reception Desk scoping (all optional; none = full public roster):
    //   ?centerId=<uuid>       → doctors with an assignment at that center,
    //                            flattened to THAT center's room/series/status.
    //   ?assignableFor=<uuid>  → doctors NOT yet assigned to that center
    //                            (may work elsewhere) — the "Add Existing" pool.
    //   ?unassigned=true       → doctors with no center assignment anywhere.
    const centerFilter = req.query.centerId ? String(req.query.centerId) : null;
    const assignableFor = req.query.assignableFor ? String(req.query.assignableFor) : null;
    const unassignedOnly = req.query.unassigned === 'true';

    let { data: doctorsData, error: dErr } = await supabase
      .from('doctors')
      .select('*, users(full_name, email, phone), medical_centers(id, name), doctor_center_assignments(*, medical_centers(id, name))');

    // Migration 010 not applied yet: retry without the assignments embed so the
    // roster still loads off the legacy `doctors.center_id` column.
    if (dErr) {
      console.warn('Doctors fetch warning:', dErr.message);
      const legacy = await supabase
        .from('doctors')
        .select('*, users(full_name, email, phone), medical_centers(id, name)');
      doctorsData = (legacy.data || []).map(d => ({ ...d, doctor_center_assignments: [] }));
    }

    // A doctor assigned the old way (doctors.center_id, no assignment row) is
    // treated as one implicit approved posting, so both models work at once.
    const legacyPosting = (d) => (d.center_id ? {
      assignmentId: null,
      centerId: d.center_id,
      centerName: d.medical_centers?.name ?? null,
      room: d.room_number ?? '—',
      series: d.series ?? '?',
      status: d.current_status ?? 'active',
      delayMinutes: d.delay_minutes ?? 0,
      maxAppointmentsPerHour: d.max_appointments_per_hour ?? 4,
      approvalStatus: d.approval_status ?? 'approved',
    } : null);

    if (doctorsData && doctorsData.length > 0) {
      const out = [];

      for (const d of doctorsData) {
        const doctorApproved = !d.approval_status || d.approval_status === 'approved';
        if (!includePending && !doctorApproved) continue;

        const allAssignments = Array.isArray(d.doctor_center_assignments) ? d.doctor_center_assignments : [];
        const visibleAssignments = includePending
          ? allAssignments
          : allAssignments.filter(a => !a.approval_status || a.approval_status === 'approved');
        let centersList = visibleAssignments.map(mapAssignment);
        if (centersList.length === 0 && legacyPosting(d)) centersList = [legacyPosting(d)];

        const postedCenterIds = new Set([
          ...allAssignments.map(a => a.center_id),
          ...(d.center_id ? [d.center_id] : []),
        ]);

        if (centerFilter) {
          const posting = centersList.find(c => c.centerId === centerFilter);
          if (!posting) continue;
          out.push(mapDoctor(d, posting, centersList));
        } else if (assignableFor) {
          if (postedCenterIds.has(assignableFor) || !doctorApproved) continue;
          out.push(mapDoctor(d, null, centersList));
        } else if (unassignedOnly) {
          if (postedCenterIds.size > 0) continue;
          out.push(mapDoctor(d, null, centersList));
        } else {
          out.push(mapDoctor(d, centersList[0] ?? null, centersList));
        }
      }

      return res.json({ doctors: out });
    }

    // An empty `doctors` table means no doctors — nothing else.
    //
    // This used to invent a roster: first by synthesising one from every user
    // with role='doctor' (handing each a made-up "Room 0N", series letter and
    // "General Medicine" specialisation), and failing that from a hardcoded
    // trio of fictional doctors. Both showed up on the patient booking screen
    // and the public TV board as though they were real staff, then disappeared
    // the moment an actual doctor was registered. Callers get an honest empty
    // list now and render their own empty state.
    res.json({ doctors: [] });
  } catch (err) {
    next(err);
  }
}