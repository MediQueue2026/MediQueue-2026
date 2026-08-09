import { supabase } from '../config/supabase.js';

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
 * GET /api/queue/board — public waiting-room board.
 *
 * Deliberately public, and deliberately thin: token numbers and counts only,
 * never a patient name, phone or NIC. This is what a screen in the lobby or the
 * public landing page may show, so it must be safe for anyone standing in the
 * room to read. Staff use GET /api/queue for the full rows.
 */
export async function getPublicBoard(req, res, next) {
  try {
    const date = todayDate();
    const { data, error } = await supabase
      .from('walk_in_queue')
      .select('doctor_id, queue_number, status, doctors(series)')
      .eq('queue_date', date)
      .in('status', ['waiting', 'called', 'in_progress'])
      .order('queue_number', { ascending: true });

    if (error) {
      if (error.code === TABLE_MISSING) return res.json({ board: [], migrationPending: true });
      throw error;
    }

    const byDoctor = new Map();
    for (const row of data || []) {
      const entry = byDoctor.get(row.doctor_id) ?? {
        doctorId: row.doctor_id,
        series: row.doctors?.series ?? '?',
        nowServing: null,
        waiting: 0,
      };
      // `called` outranks `in_progress` — the board announces the newest call.
      if (row.status === 'called' || (row.status === 'in_progress' && !entry.nowServing)) {
        entry.nowServing = row.queue_number;
      } else if (row.status === 'waiting') {
        entry.waiting += 1;
      }
      byDoctor.set(row.doctor_id, entry);
    }

    res.json({ board: [...byDoctor.values()] });
  } catch (err) {
    next(err);
  }
}

/** GET /api/queue?date=YYYY-MM-DD — every token for the clinic on that day (defaults to today). */
export async function getQueue(req, res, next) {
  try {
    const date = req.query.date || todayDate();
    const { data, error } = await supabase
      .from('walk_in_queue')
      .select('*, doctors(series)')
      .eq('queue_date', date)
      .order('queue_number', { ascending: true });

    if (error) {
      if (error.code === TABLE_MISSING) {
        // Migration 002 hasn't been run against this project yet.
        return res.json({ entries: [], migrationPending: true });
      }
      throw error;
    }

    res.json({ entries: (data || []).map(mapEntry) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/queue/walkin
 * `online` takes the next sequential number for that doctor today; `physical`
 * records the number already printed on the paper token and rejects a repeat.
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

    res.status(201).json({ entry: mapEntry(inserted) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/queue/call-next
 * A doctor has one room, so exactly one token is live at a time: announcing
 * the next one closes out whoever was live, then calls the lowest-numbered
 * waiting token. Returns the doctor's full updated queue for that day.
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
      await supabase.from('walk_in_queue')
        .update({ status: 'called', called_at: new Date().toISOString() })
        .eq('id', nextWaiting.id);
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
