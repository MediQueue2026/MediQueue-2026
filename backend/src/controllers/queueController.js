import { supabase } from '../config/supabase.js';
import { notificationProvider } from '../config/notification.js';

const TABLE_MISSING = 'PGRST205'; // PostgREST: table not found in schema cache
const UNIQUE_VIOLATION = '23505';

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Maps a `walk_in_queue` row (joined to its doctor's series letter) onto the shape the Reception Desk expects. */
function mapEntry(row) {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    series: row.doctors?.series ?? '?',
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
        doctorName: d.users?.full_name || 'Dr. Medical Specialist',
        specialization: d.specialization || 'General Medicine',
        roomNumber: d.room_number || 'Room 01',
        centerName: d.medical_centers?.name || 'MediQueue Central Clinic',
        series: d.series || 'A',
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
          doctorName: row.doctors?.users?.full_name || 'Dr. Medical Specialist',
          specialization: row.doctors?.specialization || 'General Medicine',
          roomNumber: row.doctors?.room_number || 'Room 01',
          centerName: row.doctors?.medical_centers?.name || 'MediQueue Central Clinic',
          series: row.doctors?.series || 'A',
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
            doctorName: a.doctors?.users?.full_name || 'Dr. Medical Specialist',
            specialization: a.doctors?.specialization || 'General Medicine',
            roomNumber: a.doctors?.room_number || 'Room 01',
            centerName: a.doctors?.medical_centers?.name || 'MediQueue Central Clinic',
            series: a.doctors?.series || 'A',
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

    // Query walk-in tokens for today OR active/cancelled/left tokens
    const { data: queueData, error } = await supabase
      .from('walk_in_queue')
      .select('*, doctors(series, user_id)')
      .or(`queue_date.eq.${date},status.in.(waiting,called,in_progress,cancelled,left)`)
      .order('queue_number', { ascending: true });

    if (error && error.code === TABLE_MISSING) {
      return res.json({ entries: [], migrationPending: true });
    }

    // Query online appointments for today OR active/cancelled appointments
    const { data: aptData } = await supabase
      .from('appointments')
      .select('*, doctors(series, user_id), users:patient_id(full_name, phone, nic)')
      .or(`appointment_date.eq.${date},status.in.(booked,cancelled)`);

    const combinedMap = new Map();
    (queueData || []).forEach(r => {
      const entry = mapEntry(r);
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
          series: a.doctors?.series ?? '?',
          tokenNumber: a.queue_number,
          patientName: a.users?.full_name || 'Online Patient',
          nic: a.users?.nic || undefined,
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
    const { doctorId, patientName, nic, phone, source, tokenNumber } = req.body;
    const name = (patientName || '').trim();

    if (!name) { res.status(400); throw new Error('Patient name is required.'); }
    if (!doctorId) { res.status(400); throw new Error('Select a doctor before issuing a token.'); }

    const today = todayDate();
    const isPhysical = source === 'physical';
    let queueNumber;

    if (isPhysical) {
      queueNumber = Number(tokenNumber);
      if (!Number.isInteger(queueNumber) || queueNumber < 1) {
        res.status(400); throw new Error('Enter the number printed on the paper token.');
      }
      const { data: existing } = await supabase
        .from('walk_in_queue')
        .select('id')
        .eq('doctor_id', doctorId).eq('queue_date', today).eq('queue_number', queueNumber)
        .maybeSingle();
      if (existing) {
        res.status(409); throw new Error(`Token number ${queueNumber} has already been issued today.`);
      }
    } else {
      const { data: maxRow } = await supabase
        .from('walk_in_queue')
        .select('queue_number')
        .eq('doctor_id', doctorId).eq('queue_date', today)
        .order('queue_number', { ascending: false })
        .limit(1).maybeSingle();
      queueNumber = (maxRow?.queue_number ?? 0) + 1;
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('walk_in_queue')
      .insert([{
        doctor_id: doctorId,
        patient_name: name,
        nic: nic?.trim() || null,
        sms_phone: phone?.trim() || null,
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

    const targetPhone = phone?.trim() || null;
    if (targetPhone) {
      const seriesLetter = inserted?.doctors?.series || 'A';
      const formattedToken = `#${seriesLetter}-${String(queueNumber).padStart(2, '0')}`;
      const smsMessage = `MediQueue: Token ${formattedToken} issued for ${name}. Track live queue status in your dashboard. Thank you!`;
      
      // Send Text.lk SMS non-blocking
      notificationProvider.sendSMS(targetPhone, smsMessage).catch(e => {
        console.warn('[TOKEN SMS DISPATCH ERROR]', e);
      });
    }

    res.status(201).json({ entry: mapEntry(inserted) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/queue/call-next
 */
export async function callNextPatient(req, res, next) {
  try {
    const { doctorId } = req.body;
    if (!doctorId) { res.status(400); throw new Error('doctorId is required.'); }
    const today = todayDate();

    const { data: live } = await supabase
      .from('walk_in_queue').select('id')
      .eq('doctor_id', doctorId).eq('queue_date', today)
      .in('status', ['called', 'in_progress']);

    if (live && live.length > 0) {
      await supabase.from('walk_in_queue').update({ status: 'completed' }).in('id', live.map(r => r.id));
    }

    const { data: nextWaiting } = await supabase
      .from('walk_in_queue').select('id')
      .eq('doctor_id', doctorId).eq('queue_date', today).eq('status', 'waiting')
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
        const roomStr = calledRow.doctors?.room_number ? ` (Room ${calledRow.doctors.room_number})` : '';
        const seriesLetter = calledRow.doctors?.series || 'A';
        const tokenStr = `#${seriesLetter}-${String(calledRow.queue_number).padStart(2, '0')}`;

        const callMsg = `MediQueue Alert: Token ${tokenStr} is NOW CALLED for ${docName}${roomStr}. Please proceed to consultation room immediately.`;
        notificationProvider.sendSMS(calledRow.sms_phone, callMsg).catch(e => console.warn('[CALL NEXT SMS NOTICE]', e));
      }
    }

    const { data: updated, error } = await supabase
      .from('walk_in_queue').select('*, doctors(series)')
      .eq('doctor_id', doctorId).eq('queue_date', today)
      .order('queue_number', { ascending: true });
    if (error) throw error;

    res.json({ entries: (updated || []).map(mapEntry) });
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
