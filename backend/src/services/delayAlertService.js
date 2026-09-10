import { supabase } from '../config/supabase.js';
import { buildDelayMessage, notifySubscribedPatients } from './notificationService.js';

const TABLE_MISSING = new Set(['PGRST205', '42P01']);

export function isDelayTableMissing(error) {
  return !!error && (TABLE_MISSING.has(error.code) || /delay_alerts/.test(error.message || ''));
}

/** delay_alerts row → the shape both dashboards render. */
export function mapAlert(row) {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    centerId: row.center_id,
    doctorName: row.doctor_name,
    specialization: row.specialization,
    roomNumber: row.room_number,
    centerName: row.center_name,
    delayMinutes: row.delay_minutes,
    reason: row.reason,
    message: row.message,
    notifiedCount: row.notified_count,
    skippedCount: row.skipped_count,
    raisedByName: row.raised_by_name,
    raisedByRole: row.raised_by_role,
    clearedAt: row.cleared_at,
    isActive: !row.cleared_at,
    createdAt: row.created_at,
  };
}

/** audit_logs.actor_role is a CHECK constraint — map anything unexpected to 'system'. */
function auditRole(role) {
  return ['receptionist', 'patient', 'doctor', 'admin', 'system'].includes(role) ? role : 'system';
}

/**
 * The single path by which a delay notice comes into being, shared by
 * `POST /doctors/:id/delay-alerts` and a `delayed` write to
 * `PUT /doctors/:id/status`, so both produce the same persisted row and the
 * same SMS. Having two half-implementations of this was how the old code ended
 * up texting patients without leaving anything for their dashboard to show.
 *
 * `resolved` comes from services/doctorLookup.js#resolveDoctor.
 * Returns `{ ok: false, status, error }` on failure — never throws.
 */
export async function publishDelayAlert({ resolved, centerId, minutes, reason, actor }) {
  const scopedCenterId = centerId ? String(centerId) : resolved.centerId;

  const message = buildDelayMessage({
    doctorName: resolved.name,
    delayMinutes: minutes,
    reason,
    roomNumber: resolved.roomNumber,
  });

  // 1. Persist the notice FIRST.
  //
  // Two reasons for this order. It has to land before the SMS run, so a dead
  // gateway still leaves patients something to see in their dashboard. And it
  // has to land before the status change, or a failure here (most likely the
  // delay_alerts table not existing yet) leaves the doctor flipped to
  // 'delayed' on every live board with no alert behind it and nothing in the
  // UI able to clear it.
  const { data: inserted, error: insertErr } = await supabase
    .from('delay_alerts')
    .insert([{
      doctor_id: resolved.doctor.id,
      center_id: scopedCenterId,
      doctor_name: resolved.name,
      specialization: resolved.specialization,
      room_number: resolved.roomNumber,
      center_name: resolved.centerName,
      delay_minutes: minutes,
      reason: reason || '',
      message,
      raised_by_name: actor?.name || resolved.name,
      raised_by_role: ['doctor', 'receptionist', 'admin', 'system'].includes(actor?.role) ? actor.role : 'doctor',
    }])
    .select('*')
    .single();

  if (insertErr) {
    if (isDelayTableMissing(insertErr)) {
      return {
        ok: false,
        status: 503,
        code: 'migration_pending',
        error: 'The delay_alerts table does not exist yet. Run backend/src/db/migrations/011_delay_alerts.sql in the Supabase SQL Editor.',
      };
    }
    return { ok: false, status: 500, error: insertErr.message };
  }

  // 2. Now flip the doctor to delayed, so every live board reflects it.
  const statusPatch = { current_status: 'delayed', delay_minutes: minutes };
  if (resolved.posting) {
    await supabase
      .from('doctor_center_assignments')
      .update({ ...statusPatch, updated_at: new Date().toISOString() })
      .eq('id', resolved.posting.id);
  } else {
    // Pre-migration-010 doctor: status still lives on the doctors row.
    await supabase.from('doctors').update(statusPatch).eq('id', resolved.doctor.id);
  }

  // 3. Dispatch, then record how many actually went out.
  const dispatch = await notifySubscribedPatients(resolved.doctor.id, {
    doctorName: resolved.name,
    delayMinutes: minutes,
    reason,
    roomNumber: resolved.roomNumber,
    centerId: scopedCenterId,
    message,
  });

  const { data: updated } = await supabase
    .from('delay_alerts')
    .update({
      notified_count: dispatch.notifiedCount || 0,
      skipped_count: dispatch.skippedCount || 0,
    })
    .eq('id', inserted.id)
    .select('*')
    .single();

  try {
    await supabase.from('audit_logs').insert([{
      actor_name: actor?.name || resolved.name,
      actor_role: auditRole(actor?.role || 'doctor'),
      event_type: 'system_warning',
      action: `Published a ${minutes} min delay alert for ${resolved.name}${reason ? ` (${reason})` : ''} — ${dispatch.notifiedCount || 0} patient(s) notified`,
      center_name: resolved.centerName || 'MediQueue Platform',
      status: 'completed',
    }]);
  } catch { /* audit is best-effort */ }

  return {
    ok: true,
    alert: mapAlert(updated || inserted),
    notifiedCount: dispatch.notifiedCount || 0,
    skippedCount: dispatch.skippedCount || 0,
  };
}
