import { supabase } from '../config/supabase.js';
import { notificationProvider, formatSriLankanPhone } from '../config/notification.js';

/**
 * Recipients of a doctor's delay notice (BR-05, FR-07).
 *
 * Three groups get told, because all three are people who would otherwise
 * travel to the clinic for nothing:
 *   1. patients subscribed to the doctor (doctor_subscriptions)
 *   2. patients with an active appointment today
 *   3. walk-in tokens still in the queue today (phone captured at the counter)
 *
 * A registered patient who has switched off `delay_alerts_enabled` in their
 * profile is skipped and counted in `skipped`. Walk-in tokens have no profile
 * to opt out with, so those always send — the number was given at the counter
 * for exactly this purpose.
 *
 * `centerId`, when given, scopes groups 2 and 3 to that center: a doctor
 * running late at one branch shouldn't SMS the patients waiting at another.
 */
async function collectRecipients(doctorId, centerId) {
  const today = new Date().toISOString().slice(0, 10);

  const [subsRes, aptsRes, queueRes] = await Promise.all([
    supabase
      .from('doctor_subscriptions')
      .select('patient_id, users:patient_id(full_name, phone)')
      .eq('doctor_id', doctorId),
    (() => {
      let q = supabase
        .from('appointments')
        .select('patient_id, users:patient_id(full_name, phone)')
        .eq('doctor_id', doctorId)
        .eq('appointment_date', today)
        .in('status', ['booked', 'waiting', 'in_consultation']);
      if (centerId) q = q.eq('center_id', centerId);
      return q;
    })(),
    (() => {
      let q = supabase
        .from('walk_in_queue')
        .select('sms_phone, patient_name')
        .eq('doctor_id', doctorId)
        .eq('queue_date', today)
        .in('status', ['waiting', 'called', 'in_progress']);
      if (centerId) q = q.eq('center_id', centerId);
      return q;
    })(),
  ]);

  // Registered patients, keyed by user id so one person appearing as both a
  // subscriber and today's appointment is a single recipient.
  const registered = new Map();
  for (const s of subsRes.data || []) {
    if (s.patient_id && s.users?.phone) {
      registered.set(s.patient_id, { name: s.users.full_name, phone: s.users.phone, via: 'subscription' });
    }
  }
  for (const a of aptsRes.data || []) {
    if (a.patient_id && a.users?.phone && !registered.has(a.patient_id)) {
      registered.set(a.patient_id, { name: a.users.full_name, phone: a.users.phone, via: 'appointment' });
    }
  }

  // One query for the opt-out flags rather than one per patient.
  const optedOut = new Set();
  if (registered.size > 0) {
    const { data: profiles } = await supabase
      .from('patient_profiles')
      .select('user_id, delay_alerts_enabled')
      .in('user_id', [...registered.keys()]);
    for (const p of profiles || []) {
      // Only an explicit `false` opts out — a missing profile row means default-on.
      if (p.delay_alerts_enabled === false) optedOut.add(p.user_id);
    }
  }

  // Dedupe on the *formatted* number: '0771234567' and '+94771234567' are the
  // same handset, and the old raw-string Set would have texted it twice.
  const byPhone = new Map();
  let skipped = 0;

  for (const [userId, r] of registered) {
    if (optedOut.has(userId)) { skipped += 1; continue; }
    const key = formatSriLankanPhone(r.phone);
    if (key && !byPhone.has(key)) byPhone.set(key, r);
  }

  for (const q of queueRes.data || []) {
    if (!q.sms_phone) continue;
    const key = formatSriLankanPhone(q.sms_phone);
    if (key && !byPhone.has(key)) {
      byPhone.set(key, { name: q.patient_name, phone: q.sms_phone, via: 'walkin' });
    }
  }

  return { recipients: [...byPhone.values()], skipped };
}

/**
 * Dispatches a delay/status notice to everyone affected by `doctorId` running
 * late. Never throws — a failing SMS gateway must not roll back the delay alert
 * itself, which is the record patients see in their dashboard.
 */
export async function notifySubscribedPatients(doctorId, statusUpdate) {
  try {
    const { doctorName, delayMinutes, reason, roomNumber, centerId, message } = statusUpdate || {};

    const { recipients, skipped } = await collectRecipients(doctorId, centerId || null);

    const alertMessage = message || buildDelayMessage({ doctorName, delayMinutes, reason, roomNumber });

    if (recipients.length === 0) {
      console.log(`[SMS NOTICE] No delay-alert recipients for doctor ${doctorId} (${skipped} opted out)`);
      return { notifiedCount: 0, skippedCount: skipped, message: alertMessage, details: [] };
    }

    // Sequential on purpose: Text.lk rate-limits, and a burst of parallel posts
    // gets throttled into failures that the audit fallback then has to absorb.
    const details = [];
    for (const r of recipients) {
      const res = await notificationProvider.sendSMS(r.phone, alertMessage);
      details.push({ to: r.phone, name: r.name, via: r.via, ...res });
    }

    return {
      notifiedCount: details.filter(d => d.success).length,
      skippedCount: skipped,
      message: alertMessage,
      details,
    };
  } catch (err) {
    console.error('Error dispatching delay notifications:', err);
    return { notifiedCount: 0, skippedCount: 0, error: err.message, details: [] };
  }
}

/** The exact SMS body patients receive; also stored on the delay_alerts row. */
export function buildDelayMessage({ doctorName, delayMinutes, reason, roomNumber }) {
  const who = doctorName || 'Your doctor';
  const mins = delayMinutes || 15;
  const where = roomNumber ? ` (${roomNumber})` : '';
  const why = reason ? ` Reason: ${reason}.` : '';
  return `MediQueue Alert: ${who}${where} is running approx. ${mins} mins behind schedule.${why} Please adjust your arrival time. Thank you for your patience.`;
}

/** Tells subscribers and today's patients that the doctor is back on schedule. */
export async function notifyDelayCleared(doctorId, { doctorName, centerId } = {}) {
  try {
    const { recipients } = await collectRecipients(doctorId, centerId || null);
    if (recipients.length === 0) return { notifiedCount: 0 };

    const msg = `MediQueue Update: ${doctorName || 'Your doctor'} is back on schedule. Consultations are running normally again.`;
    let notifiedCount = 0;
    for (const r of recipients) {
      const res = await notificationProvider.sendSMS(r.phone, msg);
      if (res.success) notifiedCount += 1;
    }
    return { notifiedCount, message: msg };
  } catch (err) {
    console.error('Error dispatching delay-cleared notifications:', err);
    return { notifiedCount: 0, error: err.message };
  }
}
