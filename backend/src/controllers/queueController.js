import { supabase } from '../config/supabase.js';
import { notificationProvider } from '../config/notification.js';

const TABLE_MISSING = 'PGRST205'; // PostgREST: table not found in schema cache
const UNIQUE_VIOLATION = '23505';

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Maps a `walk_in_queue` row onto the shape the Reception Desk expects.
 *  `seriesOverride` is the per-(doctor, center) token letter; falls back to the
 *  legacy `doctors.series` for rows/doctors created before the multi-center split. */
function mapEntry(row, seriesOverride) {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    centerId: row.center_id ?? undefined,
    series: seriesOverride ?? row.doctors?.series ?? '?',
    tokenNumber: row.queue_number,
    patientName: row.patient_name,
    nic: row.nic ?? undefined,
    phone: row.sms_phone ?? '',
    source: row.source,
    status: row.status,
    issuedAt: row.checked_in_at,
    calledAt: row.called_at ?? undefined,
  };
}

/** series letter for a (doctor, center) posting, or null. */
async function seriesForDoctorCenter(doctorId, centerId) {
  if (!doctorId || !centerId) return null;
  const { data } = await supabase
    .from('doctor_center_assignments')
    .select('series')
    .eq('doctor_id', doctorId).eq('center_id', centerId)
    .maybeSingle();
  return data?.series ?? null;
}

/** Map of `${doctorId}_${centerId}` → series, for a batch of queue rows. */
async function seriesMapFor(rows) {
  const pairs = [...new Set(
    (rows || [])
      .filter(r => r.doctor_id && r.center_id)
      .map(r => `${r.doctor_id}::${r.center_id}`),
  )];
  if (pairs.length === 0) return new Map();
  const doctorIds = [...new Set(pairs.map(p => p.split('::')[0]))];
  const { data } = await supabase
    .from('doctor_center_assignments')
    .select('doctor_id, center_id, series')
    .in('doctor_id', doctorIds);
  const m = new Map();
  for (const a of data || []) m.set(`${a.doctor_id}_${a.center_id}`, a.series);
  return m;
}

/**
 * GET /api/queue/board — overall public waiting-room board across centers, doctors, and tokens.
 */
export async function getPublicBoard(req, res, next) {
  try {
    const date = todayDate();

    // 1. Query walk-in queue rows
    const { data: queueRows, error } = await supabase
      .from('walk_in_queue')
      .select('*, doctors(specialization, room_number, series, center_id, user_id, medical_centers(name), users(full_name))')
      .or(`queue_date.eq.${date},status.in.(waiting,called,in_progress)`)
      .order('queue_number', { ascending: true });

    if (error && error.code === TABLE_MISSING) {
      return res.json({ doctors: [], board: [], migrationPending: true });
    }

    // 2. Query online appointments
    const { data: aptRows } = await supabase
      .from('appointments')
      .select('*, doctors(specialization, room_number, series, center_id, user_id, medical_centers(name), users(full_name)), users:patient_id(full_name)')
      .or(`appointment_date.eq.${date},status.eq.booked`);

    // 3. Fetch all registered doctors
    const { data: doctorsData } = await supabase
      .from('doctors')
      .select('id, user_id, specialization, room_number, series, current_status, medical_centers(name), users(full_name)');

    const doctorMap = new Map();

    // Helper to find existing doctor object in doctorMap by ID, user_id, or series
    const findDocObj = (docId, series, userId) => {
      if (docId && doctorMap.has(docId)) return doctorMap.get(docId);
      for (const d of doctorMap.values()) {
        if ((d.doctorId && d.doctorId === docId) ||
            (d.userId && docId && d.userId === docId) ||
            (userId && d.userId === userId) ||
            (series && d.series && d.series.toLowerCase() === series.toLowerCase())) {
          return d;
        }
      }
      return null;
    };

    // Initialize doctor map
    for (const d of doctorsData || []) {
      const docObj = {
        doctorId: d.id,
        userId: d.user_id,
        doctorName: d.users?.full_name || 'Doctor',
        // Null, not an invented value. These defaulted to 'General Medicine',
        // 'Room 01' and 'MediQueue Central Clinic', which the public waiting
        // room TV then displayed as fact for any doctor whose posting was
        // incomplete — sending patients to a room that doesn't exist.
        specialization: d.specialization || null,
        roomNumber: d.room_number || null,
        centerName: d.medical_centers?.name || null,
        series: d.series || '?',
        nowServing: null,
        waitingQueue: []
      };
      doctorMap.set(d.id, docObj);
    }

    // Process walk-in queue rows
    for (const row of queueRows || []) {
      let docObj = findDocObj(row.doctor_id, row.doctors?.series, row.doctors?.user_id);
      if (!docObj) {
        docObj = {
          doctorId: row.doctor_id,
          userId: row.doctors?.user_id,
          doctorName: row.doctors?.users?.full_name || 'Doctor',
          specialization: row.doctors?.specialization || null,
          roomNumber: row.doctors?.room_number || null,
          centerName: row.doctors?.medical_centers?.name || null,
          series: row.doctors?.series || '?',
          nowServing: null,
          waitingQueue: []
        };
        doctorMap.set(row.doctor_id, docObj);
      }

      const tokenStr = `#${docObj.series}-${String(row.queue_number).padStart(2, '0')}`;
      const entryItem = {
        id: row.id,
        token: tokenStr,
        queue_number: row.queue_number,
        patientName: row.patient_name || 'Patient',
        status: row.status
      };

      if (row.status === 'called' || (row.status === 'in_progress' && !docObj.nowServing)) {
        docObj.nowServing = entryItem;
      } else if (row.status === 'waiting') {
        docObj.waitingQueue.push(entryItem);
      }
    }

    // Process online appointments
    const existingKeys = new Set((queueRows || []).map(r => `${r.doctor_id}_${r.queue_number}`));

    for (const a of aptRows || []) {
      const key = `${a.doctor_id}_${a.queue_number}`;
      if (!existingKeys.has(key)) {
        let docObj = findDocObj(a.doctor_id, a.doctors?.series, a.doctors?.user_id);
        if (!docObj) {
          docObj = {
            doctorId: a.doctor_id,
            userId: a.doctors?.user_id,
            doctorName: a.doctors?.users?.full_name || 'Doctor',
            specialization: a.doctors?.specialization || null,
            roomNumber: a.doctors?.room_number || null,
            centerName: a.doctors?.medical_centers?.name || null,
            series: a.doctors?.series || '?',
            nowServing: null,
            waitingQueue: []
          };
          doctorMap.set(a.doctor_id, docObj);
        }

        const tokenStr = `#${docObj.series}-${String(a.queue_number).padStart(2, '0')}`;
        const entryItem = {
          id: a.id,
          token: tokenStr,
          queue_number: a.queue_number,
          patientName: a.users?.full_name || 'Online Patient',
          status: 'waiting'
        };

        docObj.waitingQueue.push(entryItem);
      }
    }

    // Sort waiting queue per doctor by queue_number
    for (const d of doctorMap.values()) {
      d.waitingQueue.sort((a, b) => a.queue_number - b.queue_number);
    }

    const doctorsList = [...doctorMap.values()];

    const simpleBoard = doctorsList.map(d => ({
      doctorId: d.doctorId,
      series: d.series,
      nowServing: d.nowServing ? d.nowServing.queue_number : null,
      waiting: d.waitingQueue.length
    }));

    res.json({ doctors: doctorsList, board: simpleBoard });
  } catch (err) {
    next(err);
  }
}

export async function getQueue(req, res, next) {
  try {
    const date = req.query.date || todayDate();
    // Reception Desk passes its center so a doctor working at several centers
    // shows an independent queue per desk.
    const centerFilter = req.query.centerId ? String(req.query.centerId) : null;

    // Query walk-in tokens for today OR active/cancelled/left tokens
    let walkinQuery = supabase
      .from('walk_in_queue')
      .select('*, doctors(series, user_id)')
      .or(`queue_date.eq.${date},status.in.(waiting,called,in_progress,cancelled,left)`)
      .order('queue_number', { ascending: true });
    if (centerFilter) walkinQuery = walkinQuery.eq('center_id', centerFilter);
    const { data: queueData, error } = await walkinQuery;

    if (error && error.code === TABLE_MISSING) {
      return res.json({ entries: [], migrationPending: true });
    }

    // Online appointments for this date only. A `booked` row carries no
    // date-independent "still active" meaning the way an in-progress walk-in
    // token does — every un-consumed future/past booking is still `booked` —
    // so scoping to the date is what keeps the desk queue to today's session.
    // NIC is on patient_profiles, not users — referencing users.nic here made
    // the whole select error, so online bookings only ever reached the desk via
    // the walk_in_queue mirror written at booking time.
    let aptQuery = supabase
      .from('appointments')
      .select('*, doctors(series, user_id), users:patient_id(full_name, phone)')
      .eq('appointment_date', date);
    if (centerFilter) aptQuery = aptQuery.eq('center_id', centerFilter);
    const { data: aptData, error: aptError } = await aptQuery;
    if (aptError) console.warn('getQueue appointments query notice:', aptError.message);

    const nicByPatient = new Map();
    const aptPatientIds = [...new Set((aptData || []).map(a => a.patient_id).filter(Boolean))];
    if (aptPatientIds.length > 0) {
      const { data: profiles } = await supabase
        .from('patient_profiles')
        .select('user_id, nic')
        .in('user_id', aptPatientIds);
      for (const p of profiles || []) if (p.nic) nicByPatient.set(p.user_id, p.nic);
    }

    const seriesMap = await seriesMapFor([...(queueData || []), ...(aptData || [])]);
    const seriesFor = (row) => seriesMap.get(`${row.doctor_id}_${row.center_id}`) ?? row.doctors?.series ?? '?';

    const combinedMap = new Map();
    (queueData || []).forEach(r => {
      const entry = mapEntry(r, seriesFor(r));
      if (entry.status === 'left') {
        entry.status = 'cancelled';
      }
      combinedMap.set(`${r.doctor_id}_${r.queue_number}`, entry);
    });

    for (const a of aptData || []) {
      const key = `${a.doctor_id}_${a.queue_number}`;
      const existing = combinedMap.get(key);
      const apptStatus = a.status === 'booked' ? 'waiting' : a.status;

      if (existing) {
        if (a.status === 'cancelled') {
          existing.status = 'cancelled';
        }
      } else {
        combinedMap.set(key, {
          id: a.id,
          doctorId: a.doctor_id,
          centerId: a.center_id ?? undefined,
          series: seriesFor(a),
          tokenNumber: a.queue_number,
          patientName: a.users?.full_name || 'Online Patient',
          nic: nicByPatient.get(a.patient_id) || undefined,
          phone: a.users?.phone || '',
          source: 'online',
          status: apptStatus,
          issuedAt: a.created_at,
          calledAt: undefined
        });
      }
    }

    const combined = Array.from(combinedMap.values());
    combined.sort((a, b) => a.tokenNumber - b.tokenNumber);

    res.json({ entries: combined });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/queue/walkin
 */
export async function issueWalkinToken(req, res, next) {
  try {
    const { doctorId, centerId, patientName, nic, phone, source, tokenNumber } = req.body;
    const name = (patientName || '').trim();

    if (!name) { res.status(400); throw new Error('Patient name is required.'); }
    if (!doctorId) { res.status(400); throw new Error('Select a doctor before issuing a token.'); }

    // Phone is required — the desk SMSes the token to it. NIC stays optional,
    // but a value that's given must be a well-formed Sri Lankan NIC (12 digits,
    // or 9 digits + V/X). Mirrors validateNic/validatePhone on the frontend.
    const cleanPhone = (phone || '').replace(/[\s-]/g, '');
    if (!/^(?:\+?94|0)7\d{8}$/.test(cleanPhone)) {
      res.status(400); throw new Error('A valid mobile number is required to issue a token.');
    }
    const trimmedNic = (nic || '').trim();
    if (trimmedNic && !/^(?:\d{12}|\d{9}[VXvx])$/.test(trimmedNic.replace(/\s/g, ''))) {
      res.status(400); throw new Error('NIC must be 12 digits, or 9 digits followed by V or X.');
    }

    const today = todayDate();
    const isPhysical = source === 'physical';
    // A doctor can work at several centers with independent number runs; scope
    // dup-check and auto-numbering to this center when one is given.
    const centerScope = centerId ? String(centerId) : null;
    let queueNumber;

    if (isPhysical) {
      queueNumber = Number(tokenNumber);
      if (!Number.isInteger(queueNumber) || queueNumber < 1) {
        res.status(400); throw new Error('Enter the number printed on the paper token.');
      }
      let existingQuery = supabase
        .from('walk_in_queue')
        .select('id')
        .eq('doctor_id', doctorId).eq('queue_date', today).eq('queue_number', queueNumber);
      if (centerScope) existingQuery = existingQuery.eq('center_id', centerScope);
      const { data: existing } = await existingQuery.maybeSingle();
      if (existing) {
        res.status(409); throw new Error(`Token number ${queueNumber} has already been issued today.`);
      }
    } else {
      let maxQuery = supabase
        .from('walk_in_queue')
        .select('queue_number')
        .eq('doctor_id', doctorId).eq('queue_date', today);
      if (centerScope) maxQuery = maxQuery.eq('center_id', centerScope);
      const { data: maxRow } = await maxQuery
        .order('queue_number', { ascending: false })
        .limit(1).maybeSingle();
      queueNumber = (maxRow?.queue_number ?? 0) + 1;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('walk_in_queue')
      .insert([{
        doctor_id: doctorId,
        center_id: centerScope,
        patient_name: name,
        nic: trimmedNic || null,
        sms_phone: (phone || '').trim() || null,
        queue_date: today,
        queue_number: queueNumber,
        source: isPhysical ? 'physical' : 'online',
        status: 'waiting',
      }])
      .select('*, doctors(series)')
      .single();

    if (insertErr) {
      if (insertErr.code === UNIQUE_VIOLATION) {
        res.status(409); throw new Error(`Token number ${queueNumber} has already been issued today.`);
      }
      throw insertErr;
    }

    const seriesLetter = (await seriesForDoctorCenter(doctorId, centerScope)) || inserted?.doctors?.series || 'A';

    const targetPhone = phone?.trim() || null;
    if (targetPhone) {
      const formattedToken = `#${seriesLetter}-${String(queueNumber).padStart(2, '0')}`;
      const smsMessage = `MediQueue: Token ${formattedToken} issued for ${name}. Track live queue status in your dashboard. Thank you!`;

      // Send Text.lk SMS non-blocking
      notificationProvider.sendSMS(targetPhone, smsMessage).catch(e => {
        console.warn('[TOKEN SMS DISPATCH ERROR]', e);
      });
    }

    res.status(201).json({ entry: mapEntry(inserted, seriesLetter) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/queue/call-next
 */
export async function callNextPatient(req, res, next) {
  try {
    const { doctorId, centerId } = req.body;
    if (!doctorId) { res.status(400); throw new Error('doctorId is required.'); }
    const today = todayDate();
    const centerScope = centerId ? String(centerId) : null;
    const scoped = (q) => (centerScope ? q.eq('center_id', centerScope) : q);

    const { data: live } = await scoped(supabase
      .from('walk_in_queue').select('id')
      .eq('doctor_id', doctorId).eq('queue_date', today)
      .in('status', ['called', 'in_progress']));

    if (live && live.length > 0) {
      await supabase.from('walk_in_queue').update({ status: 'completed' }).in('id', live.map(r => r.id));
    }

    const { data: nextWaiting } = await scoped(supabase
      .from('walk_in_queue').select('id')
      .eq('doctor_id', doctorId).eq('queue_date', today).eq('status', 'waiting'))
      .order('queue_number', { ascending: true })
      .limit(1).maybeSingle();

    if (nextWaiting) {
      const { data: calledRow } = await supabase.from('walk_in_queue')
        .update({ status: 'called', called_at: new Date().toISOString() })
        .eq('id', nextWaiting.id)
        .select('*, doctors(series, room_number, users(full_name))')
        .maybeSingle();

      if (calledRow && calledRow.sms_phone) {
        const docName = calledRow.doctors?.users?.full_name || 'your doctor';
        const postingCenter = calledRow.center_id || centerScope || null;
        let posting = { data: null };
        if (postingCenter) {
          posting = await supabase
            .from('doctor_center_assignments')
            .select('series, room_number')
            .eq('doctor_id', doctorId).eq('center_id', postingCenter)
            .maybeSingle();
        }
        const roomStr = (posting.data?.room_number ?? calledRow.doctors?.room_number)
          ? ` (Room ${posting.data?.room_number ?? calledRow.doctors.room_number})` : '';
        const seriesLetter = posting.data?.series || calledRow.doctors?.series || 'A';
        const tokenStr = `#${seriesLetter}-${String(calledRow.queue_number).padStart(2, '0')}`;

        const callMsg = `MediQueue Alert: Token ${tokenStr} is NOW CALLED for ${docName}${roomStr}. Please proceed to consultation room immediately.`;
        notificationProvider.sendSMS(calledRow.sms_phone, callMsg).catch(e => console.warn('[CALL NEXT SMS NOTICE]', e));
      }
    }

    const { data: updated, error } = await scoped(supabase
      .from('walk_in_queue').select('*, doctors(series)')
      .eq('doctor_id', doctorId).eq('queue_date', today))
      .order('queue_number', { ascending: true });
    if (error) throw error;

    const seriesMap = await seriesMapFor(updated || []);
    res.json({
      entries: (updated || []).map(r =>
        mapEntry(r, seriesMap.get(`${r.doctor_id}_${r.center_id}`) ?? r.doctors?.series ?? '?')),
    });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/queue/:id/status — used for "Done" / "No-Show" / "Mark Complete". */
export async function updateQueueEntryStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowed = ['waiting', 'called', 'in_progress', 'completed', 'left'];
    if (!allowed.includes(status)) {
      res.status(400); throw new Error('Invalid status.');
    }

    const { data, error } = await supabase
      .from('walk_in_queue')
      .update({ status })
      .eq('id', id)
      .select('*, doctors(series)')
      .single();
    if (error) throw error;

    res.json({ entry: mapEntry(data) });
  } catch (err) {
    next(err);
  }
}
