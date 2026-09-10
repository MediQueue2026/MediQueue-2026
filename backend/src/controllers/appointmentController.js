import { supabase } from '../config/supabase.js';
import { checkSlotAvailability } from '../services/slotLimiterService.js';
import { evaluatePatientNoShowStatus } from '../services/noShowService.js';
import { notificationProvider } from '../config/notification.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function createAppointment(req, res, next) {
  try {
    const { doctorId, centerId, appointmentDate, slotHour, patientId } = req.body;

    // 1. Validate the ids up front.
    //
    // Each of these used to fall back to "the first row in the table" when the
    // id wasn't a UUID: an unrecognised patientId booked the appointment for
    // whichever patient happened to be first in `users`, and an unrecognised
    // doctorId or centerId booked against an arbitrary doctor or clinic. A bad
    // id must be an error, never a silent substitution.
    const missing = [];
    if (!UUID_RE.test(String(patientId ?? ''))) missing.push('patientId');
    if (!UUID_RE.test(String(doctorId ?? ''))) missing.push('doctorId');
    if (!UUID_RE.test(String(centerId ?? ''))) missing.push('centerId');
    if (missing.length > 0) {
      return res.status(400).json({
        error: `Cannot book this appointment — ${missing.join(', ')} must be a valid id.`,
        fields: missing,
      });
    }

    const targetPatientId = String(patientId);
    const targetDoctorId = String(doctorId);
    const targetCenterId = String(centerId);

    // 2. Check Slot Limit (BR-02, FR-03: Max 4 patients/hr)
    const availability = await checkSlotAvailability(targetDoctorId, appointmentDate, slotHour);
    if (!availability.available) {
      return res.status(400).json({
        error: 'Slot limit reached for this hour (Max 4 patients/hr). Please select another time slot.',
        availability
      });
    }

    // 3. Confirm the referenced rows exist, and gather what we need from them.
    const [patientRes, doctorRes, centerRes, postingRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, phone, role')
        .eq('id', targetPatientId)
        .maybeSingle(),
      supabase
        .from('doctors')
        .select('id, series, specialization, room_number, users(full_name)')
        .eq('id', targetDoctorId)
        .maybeSingle(),
      supabase
        .from('medical_centers')
        .select('id, name')
        .eq('id', targetCenterId)
        .maybeSingle(),
      // Series is per posting since migration 010; the doctors row is the
      // pre-migration fallback.
      supabase
        .from('doctor_center_assignments')
        .select('series, room_number')
        .eq('doctor_id', targetDoctorId)
        .eq('center_id', targetCenterId)
        .maybeSingle(),
    ]);

    if (!patientRes.data) return res.status(404).json({ error: 'That patient account no longer exists.' });
    if (!doctorRes.data) return res.status(404).json({ error: 'That doctor is no longer available.' });
    if (!centerRes.data) return res.status(404).json({ error: 'That medical center no longer exists.' });

    const { data: profileRow } = await supabase
      .from('patient_profiles')
      .select('nic, emergency_contact_phone')
      .eq('user_id', targetPatientId)
      .maybeSingle();

    const patientName = patientRes.data.full_name || 'Online Patient';
    const patientPhone = patientRes.data.phone || profileRow?.emergency_contact_phone || null;
    const patientNic = profileRow?.nic || null;
    const docSeries = postingRes.data?.series || doctorRes.data.series || 'A';

    // 4. Evaluate No-Show Penalty Status (BR-03, FR-04)
    const noShowStatus = await evaluatePatientNoShowStatus(targetPatientId);

    // 5. Next sequential token, counting both tables so an online booking and a
    //    printed slip never collide. Scoped to this center: a doctor working at
    //    two clinics runs an independent number series at each.
    const dateStr = appointmentDate || new Date().toISOString().split('T')[0];

    const [maxWalkinRes, maxApptRes] = await Promise.all([
      supabase
        .from('walk_in_queue')
        .select('queue_number')
        .eq('doctor_id', targetDoctorId)
        .eq('center_id', targetCenterId)
        .eq('queue_date', dateStr)
        .order('queue_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('appointments')
        .select('queue_number')
        .eq('doctor_id', targetDoctorId)
        .eq('center_id', targetCenterId)
        .eq('appointment_date', dateStr)
        .order('queue_number', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const wMax = maxWalkinRes.data?.queue_number || 0;
    const aMax = maxApptRes.data?.queue_number || 0;
    const nextTokenNum = Math.max(wMax, aMax) + 1;
    const queueTokenStr = `#${docSeries}-${String(nextTokenNum).padStart(2, '0')}`;

    // 6. Insert into `appointments`.
    const { data: apptData, error: apptErr } = await supabase
      .from('appointments')
      .insert([
        {
          patient_id: targetPatientId,
          doctor_id: targetDoctorId,
          center_id: targetCenterId,
          appointment_date: dateStr,
          slot_hour: slotHour || 10,
          queue_number: nextTokenNum,
          is_late_number: noShowStatus.shouldAssignLateNumber,
          status: 'booked'
        }
      ])
      .select()
      .maybeSingle();

    // A failed insert used to be logged as a "notice" and the handler carried
    // on to return 201 with `id: 'apt_<timestamp>'`. The patient got a booking
    // confirmation and a token for an appointment that existed nowhere, and it
    // disappeared on their next refresh.
    if (apptErr || !apptData) {
      return res.status(500).json({
        error: apptErr?.message
          ? `Could not save this appointment: ${apptErr.message}`
          : 'Could not save this appointment. Please try again.',
      });
    }

    // 7. Mirror into `walk_in_queue` so the Reception Desk and Doctor Console
    //    see online bookings in the same line as walk-ins. `center_id` matters:
    //    without it the desk's center-scoped query skipped online bookings
    //    entirely, so a patient who booked online never appeared in the queue.
    const { error: syncErr } = await supabase
      .from('walk_in_queue')
      .insert([
        {
          doctor_id: targetDoctorId,
          center_id: targetCenterId,
          patient_name: patientName,
          nic: patientNic,
          sms_phone: patientPhone,
          queue_date: dateStr,
          queue_number: nextTokenNum,
          source: 'online',
          status: 'waiting'
        }
      ]);

    if (syncErr) {
      // The appointment itself is saved, so this is recoverable — the merge in
      // getQueue still surfaces the booking from the appointments table.
      console.warn('walk_in_queue mirror sync notice:', syncErr.message);
    }

    if (patientPhone) {
      const h = slotHour || 10;
      const pmHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const slotStr = `${pmHour < 10 ? '0' + pmHour : pmHour}:00 ${ampm}`;
      
      const smsMsg = `MediQueue: Appointment booked successfully! Token: ${queueTokenStr} on ${dateStr} at ${slotStr}. Track status live in dashboard. Thank you!`;
      notificationProvider.sendSMS(patientPhone, smsMsg).catch(e => console.warn('[BOOKING SMS NOTICE]', e));
    }

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment: {
        id: apptData.id,
        doctorId: targetDoctorId,
        doctorName: doctorRes.data.users?.full_name || 'Doctor',
        specialization: doctorRes.data.specialization || null,
        patientId: targetPatientId,
        centerId: targetCenterId,
        centerName: centerRes.data.name || null,
        roomNumber: postingRes.data?.room_number || doctorRes.data.room_number || null,
        appointmentDate: dateStr,
        slotHour: slotHour || 10,
        queueToken: queueTokenStr,
        status: 'booked',
        isLateNumber: noShowStatus.shouldAssignLateNumber,
        queuePosition: noShowStatus.shouldAssignLateNumber ? 'Late Queue (End of Line)' : queueTokenStr
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getAppointments(req, res, next) {
  try {
    // The Reception Desk passes its center so the "all patients" directory is
    // scoped to patients who booked a doctor at that clinic.
    const centerFilter = req.query.centerId ? String(req.query.centerId) : null;

    let query = supabase
      .from('appointments')
      .select(
        '*, doctor:doctors(*, user:users(full_name)), center:medical_centers(name), patient:users!patient_id(full_name, phone)',
      )
      .order('created_at', { ascending: false });
    if (centerFilter) query = query.eq('center_id', centerFilter);

    const { data, error } = await query;

    if (error || !data) {
      if (error) console.warn('getAppointments query notice:', error.message);
      return res.json({ appointments: [] });
    }

    // Token series is per (doctor, center) posting since migration 010.
    const seriesByPair = new Map();
    const doctorIds = [...new Set(data.map(a => a.doctor_id).filter(Boolean))];
    if (doctorIds.length > 0) {
      const { data: postings } = await supabase
        .from('doctor_center_assignments')
        .select('doctor_id, center_id, series')
        .in('doctor_id', doctorIds);
      for (const p of postings || []) seriesByPair.set(`${p.doctor_id}_${p.center_id}`, p.series);
    }

    // NIC lives on patient_profiles, not users — batch it in.
    const nicByPatient = new Map();
    const patientIds = [...new Set(data.map(a => a.patient_id).filter(Boolean))];
    if (patientIds.length > 0) {
      const { data: profiles } = await supabase
        .from('patient_profiles')
        .select('user_id, nic')
        .in('user_id', patientIds);
      for (const p of profiles || []) if (p.nic) nicByPatient.set(p.user_id, p.nic);
    }

    const appointments = data.map(a => {
      const series = seriesByPair.get(`${a.doctor_id}_${a.center_id}`) || a.doctor?.series || '?';
      return {
        id: a.id,
        patientId: a.patient_id,
        patientName: a.patient?.full_name || 'Online Patient',
        nic: nicByPatient.get(a.patient_id) || null,
        phone: a.patient?.phone || '',
        doctorId: a.doctor_id,
        doctorName: a.doctor?.user?.full_name || 'Doctor',
        centerId: a.center_id ?? null,
        centerName: a.center?.name || null,
        queueToken: `#${series}-${String(a.queue_number).padStart(2, '0')}`,
        appointmentDate: a.appointment_date,
        status: a.status,
      };
    });

    res.json({ appointments });
  } catch (err) {
    next(err);
  }
}

export async function getPatientAppointments(req, res, next) {
  try {
    const { patientId } = req.params;

    const { data, error } = await supabase
      .from('appointments')
      .select('*, doctor:doctors(*, user:users(full_name)), center:medical_centers(name)')
      .eq('patient_id', patientId)
      .order('appointment_date', { ascending: true });

    if (error || !data) {
      return res.json({ appointments: [] });
    }

    // Token series is per posting since migration 010, so resolve the series
    // for each (doctor, center) pair rather than reading the legacy column.
    const seriesByPair = new Map();
    const doctorIds = [...new Set(data.map(a => a.doctor_id).filter(Boolean))];
    if (doctorIds.length > 0) {
      const { data: postings } = await supabase
        .from('doctor_center_assignments')
        .select('doctor_id, center_id, series, room_number')
        .in('doctor_id', doctorIds);
      for (const p of postings || []) {
        seriesByPair.set(`${p.doctor_id}_${p.center_id}`, p);
      }
    }

    const mapped = data.map(a => {
      const h = a.slot_hour ?? 10;
      const pmHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedTime = `${pmHour < 10 ? '0' + pmHour : pmHour}:00 ${ampm}`;
      const posting = seriesByPair.get(`${a.doctor_id}_${a.center_id}`);
      const docSeries = posting?.series || a.doctor?.series || '?';
      const numPadded = String(a.queue_number).padStart(2, '0');

      return {
        id: a.id,
        doctorId: a.doctor_id,
        doctorName: a.doctor?.user?.full_name || 'Doctor',
        // Null rather than an invented "General Medicine" / "MediQueue Clinic":
        // the dashboard renders a dash for a missing value, and a patient
        // reading their own appointment shouldn't be shown a specialisation or
        // a clinic name that nobody entered.
        specialization: a.doctor?.specialization || null,
        centerId: a.center_id ?? null,
        centerName: a.center?.name || null,
        roomNumber: posting?.room_number || a.doctor?.room_number || null,
        appointmentDate: a.appointment_date,
        slotHour: a.slot_hour,
        timeLabel: formattedTime,
        queueToken: `#${docSeries}-${numPadded}`,
        status: a.status,
        isLateNumber: a.is_late_number
      };
    });

    res.json({ appointments: mapped });
  } catch (err) {
    next(err);
  }
}

export async function cancelAppointment(req, res, next) {
  try {
    const { id } = req.params;

    // 1. Update status in appointments table to 'cancelled'
    const { data: apptData, error: apptErr } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .maybeSingle();

    // 2. Also update walk_in_queue by ID to 'left' (passes Postgres check constraint)
    const { data: queueData } = await supabase
      .from('walk_in_queue')
      .update({ status: 'left' })
      .eq('id', id)
      .select()
      .maybeSingle();

    // 3. If apptData was found, update mirrored walk_in_queue entry status to 'left'
    if (apptData) {
      await supabase
        .from('walk_in_queue')
        .update({ status: 'left' })
        .eq('doctor_id', apptData.doctor_id)
        .eq('queue_number', apptData.queue_number);
    }

    // 4. If queueData was found, update matching appointments table to 'cancelled'
    if (queueData) {
      await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('doctor_id', queueData.doctor_id)
        .eq('queue_number', queueData.queue_number);
    }

    if (apptErr) {
      console.error('Cancel appointment notice:', apptErr.message);
    }

    // 5. Send Cancellation SMS Notification to Patient
    const targetPatientId = apptData?.patient_id;
    let cancelPhone = queueData?.sms_phone;
    if (!cancelPhone && targetPatientId) {
      const { data: pUser } = await supabase.from('users').select('phone').eq('id', targetPatientId).maybeSingle();
      cancelPhone = pUser?.phone;
    }

    if (cancelPhone) {
      const tokenNum = apptData?.queue_number || queueData?.queue_number || '';
      const cancelMsg = `MediQueue Notice: Your booking (Token #${tokenNum}) has been CANCELLED. If this was a mistake, please book again online.`;
      notificationProvider.sendSMS(cancelPhone, cancelMsg).catch(e => console.warn('[CANCEL SMS NOTICE]', e));
    }

    res.json({ message: 'Appointment cancelled successfully', appointment: apptData || queueData });
  } catch (err) {
    next(err);
  }
}
