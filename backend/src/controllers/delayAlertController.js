import { supabase } from '../config/supabase.js';
import { resolveDoctor } from '../services/doctorLookup.js';
import { notifyDelayCleared } from '../services/notificationService.js';
import { isDelayTableMissing, mapAlert, publishDelayAlert } from '../services/delayAlertService.js';

/** Shared validation so both entry points reject the same bad input. */
export function parseDelayMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes) || minutes < 1 || minutes > 480) {
    return null;
  }
  return minutes;
}

/**
 * POST /api/doctors/:doctorId/delay-alerts
 * Publishes one delay notice for a doctor's posting and SMSes every affected
 * patient. See services/delayAlertService.js for the write + dispatch order.
 */
export async function createDelayAlert(req, res, next) {
  try {
    const { doctorId } = req.params;
    const { reason, centerId } = req.body;

    const minutes = parseDelayMinutes(req.body.delayMinutes);
    if (minutes === null) {
      return res.status(400).json({ error: 'delayMinutes must be a whole number between 1 and 480.' });
    }

    const resolved = await resolveDoctor(doctorId, centerId);
    if (!resolved) {
      return res.status(404).json({ error: 'No doctor found for that id.' });
    }
    if (resolved.ambiguous) {
      return res.status(400).json({
        error: 'This doctor works at more than one center — send centerId so the delay applies to the right one.',
      });
    }

    const result = await publishDelayAlert({
      resolved,
      centerId,
      minutes,
      reason,
      actor: {
        name: req.user?.fullName || req.user?.email || resolved.name,
        role: req.user?.role || 'doctor',
      },
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, code: result.code });
    }

    res.status(201).json({
      message: `Delay alert published — ${result.notifiedCount} patient(s) notified by SMS.`,
      alert: result.alert,
      notifiedCount: result.notifiedCount,
      skippedCount: result.skippedCount,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/delay-alerts
 *
 * Query params, all optional and combinable:
 *   ?patientId=<uuid>  only alerts for doctors this patient subscribes to
 *                      (the Patient Dashboard feed — BR-05)
 *   ?centerId=<uuid>   only alerts raised at that center (Reception Desk)
 *   ?doctorId=<uuid>   one doctor's own history (Doctor Console)
 *   ?activeOnly=true   drop alerts the doctor has already cleared
 *   ?limit=<n>         default 20, max 100
 *
 * A patient with no subscriptions gets an empty list rather than everyone's
 * alerts — the requirement is that *subscribed* patients are told.
 */
export async function getDelayAlerts(req, res, next) {
  try {
    const { patientId, centerId, doctorId, activeOnly } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);

    // Scope to the patient's subscriptions first; with none there is nothing to
    // fetch and we can skip the alerts query entirely.
    let subscribedDoctorIds = null;
    if (patientId) {
      const { data: subs, error: subErr } = await supabase
        .from('doctor_subscriptions')
        .select('doctor_id')
        .eq('patient_id', String(patientId));
      if (subErr) return res.json({ alerts: [] });
      subscribedDoctorIds = (subs || []).map(s => s.doctor_id).filter(Boolean);
      if (subscribedDoctorIds.length === 0) {
        return res.json({ alerts: [], subscribedDoctorIds: [] });
      }
    }

    let q = supabase
      .from('delay_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (subscribedDoctorIds) q = q.in('doctor_id', subscribedDoctorIds);
    if (centerId) q = q.eq('center_id', String(centerId));
    if (doctorId) q = q.eq('doctor_id', String(doctorId));
    if (activeOnly === 'true') q = q.is('cleared_at', null);

    const { data, error } = await q;

    if (error) {
      // The dashboards poll this; a missing table should degrade to "no alerts"
      // rather than painting an error banner every few seconds.
      if (isDelayTableMissing(error)) return res.json({ alerts: [], migrationPending: true });
      return res.status(500).json({ error: error.message });
    }

    res.json({
      alerts: (data || []).map(mapAlert),
      ...(subscribedDoctorIds ? { subscribedDoctorIds } : {}),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/delay-alerts/:id/clear
 * Doctor is back on schedule: stamp the alert, restore the posting to active
 * and tell the same recipients the wait is over.
 */
export async function clearDelayAlert(req, res, next) {
  try {
    const { id } = req.params;
    const notify = req.body?.notify !== false;

    const { data: alert, error: findErr } = await supabase
      .from('delay_alerts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (findErr && isDelayTableMissing(findErr)) {
      return res.status(503).json({ error: 'The delay_alerts table does not exist yet.', code: 'migration_pending' });
    }
    if (!alert) return res.status(404).json({ error: 'Delay alert not found.' });
    if (alert.cleared_at) {
      return res.json({ message: 'That delay alert was already cleared.', alert: mapAlert(alert), notifiedCount: 0 });
    }

    const { data: cleared, error: updErr } = await supabase
      .from('delay_alerts')
      .update({ cleared_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (updErr) return res.status(500).json({ error: updErr.message });

    // Put the posting back on duty. Only rows still marked delayed are touched:
    // the doctor may have moved themselves to 'break' or 'offline' since, and
    // clearing a delay shouldn't drag them back on duty.
    const backOnDuty = { current_status: 'active', delay_minutes: 0 };
    if (alert.center_id) {
      await supabase
        .from('doctor_center_assignments')
        .update({ ...backOnDuty, updated_at: new Date().toISOString() })
        .eq('doctor_id', alert.doctor_id).eq('center_id', alert.center_id)
        .eq('current_status', 'delayed');
    }
    await supabase
      .from('doctors')
      .update(backOnDuty)
      .eq('id', alert.doctor_id)
      .eq('current_status', 'delayed');

    let notifiedCount = 0;
    if (notify) {
      const result = await notifyDelayCleared(alert.doctor_id, {
        doctorName: alert.doctor_name,
        centerId: alert.center_id,
      });
      notifiedCount = result.notifiedCount || 0;
    }

    res.json({
      message: notify ? `Delay cleared — ${notifiedCount} patient(s) notified.` : 'Delay cleared.',
      alert: mapAlert(cleared),
      notifiedCount,
    });
  } catch (err) {
    next(err);
  }
}
