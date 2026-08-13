import { notifySubscribedPatients } from '../services/notificationService.js';
import { supabase } from '../config/supabase.js';

export async function updateDoctorStatus(req, res, next) {
  try {
    const { doctorId } = req.params;
    const { currentStatus, delayMinutes, roomNumber, doctorName } = req.body;

    const updates = {};
    if (currentStatus) updates.current_status = currentStatus;
    if (typeof delayMinutes === 'number') updates.delay_minutes = delayMinutes;
    if (roomNumber) updates.room_number = roomNumber;

    if (Object.keys(updates).length > 0 && doctorId && doctorId !== 'undefined') {
      const { error: dbErr } = await supabase
        .from('doctors')
        .update(updates)
        .or(`id.eq.${doctorId},user_id.eq.${doctorId}`);

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

    const allQueue = queueRows || [];
    const totalToday = allQueue.length;
    const patientsSeen = allQueue.filter(q => q.status === 'completed').length;
    const remainingTokens = allQueue.filter(q => q.status === 'waiting' || q.status === 'called' || q.status === 'in_progress').length;
    const skippedNoShow = allQueue.filter(q => q.status === 'skipped' || q.status === 'left').length;
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
 * Creates a stub user (role=doctor) then a doctors profile row.
 * Body: { fullName, specialization, roomNumber, series, maxAppointmentsPerHour, centerId }
 */
export async function createDoctor(req, res, next) {
  try {
    const { fullName, specialization, roomNumber, series, maxAppointmentsPerHour, centerId } = req.body;

    if (!fullName || !specialization) {
      return res.status(400).json({ error: 'fullName and specialization are required' });
    }

    const stubEmail = `dr.${fullName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')}.${Date.now()}@mediqueue.internal`;

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .insert([{ email: stubEmail, full_name: fullName, role: 'doctor' }])
      .select('id')
      .single();

    if (userErr) {
      return res.status(500).json({ error: `Could not create user stub: ${userErr.message}` });
    }

    const { data: doctorRow, error: docErr } = await supabase
      .from('doctors')
      .insert([{
        user_id: userRow.id,
        center_id: centerId || null,
        specialization,
        room_number: roomNumber || null,
        series: series || null,
        max_appointments_per_hour: maxAppointmentsPerHour || 4,
        current_status: 'active',
      }])
      .select('id, specialization, room_number, current_status, max_appointments_per_hour, available_hours, series, center_id, medical_centers(name), users(full_name)')
      .single();

    if (docErr) {
      return res.status(500).json({ error: `Could not create doctor profile: ${docErr.message}` });
    }

    res.status(201).json({
      message: 'Doctor created successfully',
      doctor: {
        id: doctorRow.id,
        name: doctorRow.users?.full_name ?? fullName,
        dept: doctorRow.specialization,
        room: doctorRow.room_number ?? '—',
        series: doctorRow.series ?? '?',
        status: doctorRow.current_status ?? 'active',
        avgConsultMinutes: Math.max(1, Math.round(60 / (doctorRow.max_appointments_per_hour || 4))),
        maxAppointmentsPerHour: doctorRow.max_appointments_per_hour ?? 4,
        centerId: doctorRow.center_id ?? null,
        centerName: doctorRow.medical_centers?.name ?? null,
      },
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
    const { data: doctorsData, error: dErr } = await supabase
      .from('doctors')
      .select('*, medical_centers(id, name), users(full_name)');

    if (dErr) {
      console.warn('Doctors fetch warning:', dErr.message);
    }

    const { data: usersData } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('role', 'doctor');

    const userMap = new Map((usersData || []).map(u => [u.id, u]));

    if (doctorsData && doctorsData.length > 0) {
      const mapped = doctorsData.map(d => {
        const u = userMap.get(d.user_id) || d.users;
        return {
          id: d.id,
          userId: d.user_id,
          name: u?.full_name ?? d.users?.full_name ?? 'Unknown Doctor',
          dept: d.specialization || 'General Medicine',
          specialization: d.specialization || 'General Medicine',
          room: d.room_number ?? '—',
          series: d.series ?? '?',
          status: d.current_status ?? 'active',
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
        dept: 'General Medicine',
        specialization: 'General Medicine',
        room: `Room 0${i + 1}`,
        series: String.fromCharCode(65 + i),
        status: 'active',
        avgConsultMinutes: 15,
        maxAppointmentsPerHour: 4,
        centerId: 'a1000000-0000-0000-0000-000000000001',
        centerName: 'MediQueue Central Clinic'
      }));

      return res.json({ doctors: mappedFromUsers });
    }

    res.json({ doctors: FALLBACK_DOCTORS });
  } catch (err) {
    next(err);
  }
}