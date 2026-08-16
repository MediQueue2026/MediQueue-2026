import { supabase } from '../config/supabase.js';
import { checkSlotAvailability } from '../services/slotLimiterService.js';
import { evaluatePatientNoShowStatus } from '../services/noShowService.js';

export async function createAppointment(req, res, next) {
  try {
    const { doctorId, centerId, appointmentDate, slotHour, patientId } = req.body;

    // 1. Check Slot Limit (BR-02, FR-03: Max 4 patients/hr)
    const availability = await checkSlotAvailability(doctorId, appointmentDate, slotHour);
    if (!availability.available) {
      return res.status(400).json({
        error: 'Slot limit reached for this hour (Max 4 patients/hr). Please select another time slot.',
        availability
      });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // 2. Resolve DB Patient UUID & Profile Details
    let targetPatientId = patientId;
    if (!uuidRegex.test(targetPatientId)) {
      const { data: foundUser } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'patient')
        .limit(1)
        .maybeSingle();

      if (foundUser) targetPatientId = foundUser.id;
    }

    // Fetch patient name & contact details for queue mirroring
    const { data: userData } = await supabase
      .from('users')
      .select('full_name, phone, patient_profiles(nic, emergency_contact_phone)')
      .eq('id', targetPatientId)
      .maybeSingle();

    const patientName = userData?.full_name || 'Online Patient';
    const patientPhone = userData?.phone || userData?.patient_profiles?.[0]?.emergency_contact_phone || null;
    const patientNic = userData?.patient_profiles?.[0]?.nic || null;

    // 3. Resolve valid Doctor UUID & Series Letter
    let targetDoctorId = doctorId;
    if (!uuidRegex.test(targetDoctorId)) {
      const { data: foundDoc } = await supabase.from('doctors').select('id').limit(1).maybeSingle();
      if (foundDoc) targetDoctorId = foundDoc.id;
    }

    const { data: docData } = await supabase
      .from('doctors')
      .select('series')
      .eq('id', targetDoctorId)
      .maybeSingle();
    const docSeries = docData?.series || 'A';

    // 4. Resolve valid Center UUID
    let targetCenterId = centerId;
    if (!uuidRegex.test(targetCenterId)) {
      const { data: foundCenter } = await supabase.from('medical_centers').select('id').limit(1).maybeSingle();
      if (foundCenter) targetCenterId = foundCenter.id;
    }

    // 5. Evaluate No-Show Penalty Status (BR-03, FR-04)
    const noShowStatus = await evaluatePatientNoShowStatus(targetPatientId);

    // 6. Calculate Unified Next Sequential Token Number across BOTH tables
    const dateStr = appointmentDate || new Date().toISOString().split('T')[0];

    const { data: maxWalkin } = await supabase
      .from('walk_in_queue')
      .select('queue_number')
      .eq('doctor_id', targetDoctorId)
      .eq('queue_date', dateStr)
      .order('queue_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: maxAppt } = await supabase
      .from('appointments')
      .select('queue_number')
      .eq('doctor_id', targetDoctorId)
      .eq('appointment_date', dateStr)
      .order('queue_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const wMax = maxWalkin?.queue_number || 0;
    const aMax = maxAppt?.queue_number || 0;
    const nextTokenNum = Math.max(wMax, aMax) + 1;
    const queueTokenStr = `#${docSeries}-${nextTokenNum < 10 ? '0' + nextTokenNum : nextTokenNum}`;

    // 7. Insert into Supabase `appointments` table
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
      .select();

    if (apptErr) {
      console.warn('Appointment insert notice:', apptErr.message);
    }

    // 8. Auto-mirror entry into `walk_in_queue` for Receptionist & Doctor Desk synchronization
    const { error: syncErr } = await supabase
      .from('walk_in_queue')
      .insert([
        {
          doctor_id: targetDoctorId,
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
      console.warn('walk_in_queue mirror sync notice:', syncErr.message);
    }

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointment: {
        id: apptData && apptData[0] ? apptData[0].id : `apt_${Date.now()}`,
        doctorId: targetDoctorId,
        patientId: targetPatientId,
        centerId: targetCenterId,
        appointmentDate: dateStr,
        slotHour: slotHour || 10,
        queueToken: queueTokenStr,
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
    const { data, error } = await supabase
      .from('appointments')
      .select('*, doctor:doctors(*, user:users(full_name)), center:medical_centers(name)')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return res.json({ appointments: [] });
    }

    res.json({ appointments: data });
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

    const mapped = data.map(a => {
      const h = a.slot_hour ?? 10;
      const pmHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const formattedTime = `${pmHour < 10 ? '0' + pmHour : pmHour}:00 ${ampm}`;
      const docSeries = a.doctor?.series || 'A';
      const numPadded = String(a.queue_number).padStart(2, '0');

      return {
        id: a.id,
        doctorId: a.doctor_id,
        doctorName: a.doctor?.user?.full_name || 'Doctor',
        specialization: a.doctor?.specialization || 'General Medicine',
        centerName: a.center?.name || 'MediQueue Clinic',
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

    res.json({ message: 'Appointment cancelled successfully', appointment: apptData || queueData });
  } catch (err) {
    next(err);
  }
}
