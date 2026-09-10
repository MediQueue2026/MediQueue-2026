import { supabase } from '../config/supabase.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(str) {
  return typeof str === 'string' && UUID_RE.test(str);
}

/**
 * Resolves whatever the frontend called a "doctor id" into the real
 * `doctors` row plus the posting the caller means.
 *
 * The panels are inconsistent about which id they hold: the Doctor Console
 * knows the logged-in user's `users.id`, while the Reception Desk holds
 * `doctors.id`. Both are accepted here.
 *
 * Returns `null` when nothing matches, so callers can 404 rather than silently
 * acting on some other doctor — the previous inline version fell back to
 * "the first doctor in the table", which meant a bad id quietly published a
 * delay notice for an unrelated doctor.
 */
export async function resolveDoctor(doctorId, centerId = null) {
  if (!doctorId || doctorId === 'undefined' || doctorId === 'null' || !isUuid(doctorId)) {
    return null;
  }

  const { data: doctor } = await supabase
    .from('doctors')
    .select('id, user_id, specialization, room_number, series, current_status, delay_minutes, center_id, users(full_name, email), medical_centers(id, name)')
    .or(`id.eq.${doctorId},user_id.eq.${doctorId}`)
    .maybeSingle();

  if (!doctor) return null;

  // Postings live in doctor_center_assignments since migration 010. A doctor
  // created before it has none, and their room/series/status is still on the
  // doctors row — `posting` stays null and callers use the legacy columns.
  let assignments = [];
  {
    let q = supabase
      .from('doctor_center_assignments')
      .select('id, center_id, room_number, series, current_status, delay_minutes, medical_centers(id, name)')
      .eq('doctor_id', doctor.id);
    if (centerId) q = q.eq('center_id', String(centerId));
    const { data } = await q;
    assignments = data || [];
  }

  // With no centerId we can only pin a posting down when there's exactly one;
  // guessing between several would put the delay on the wrong branch.
  const posting = centerId
    ? assignments[0] ?? null
    : assignments.length === 1 ? assignments[0] : null;

  return {
    doctor,
    posting,
    assignments,
    /** True when this doctor works at several centers and the caller didn't say which. */
    ambiguous: !centerId && assignments.length > 1,
    name: doctor.users?.full_name ?? 'Doctor',
    specialization: doctor.specialization ?? null,
    roomNumber: posting?.room_number ?? doctor.room_number ?? null,
    centerId: posting?.center_id ?? doctor.center_id ?? null,
    centerName: posting?.medical_centers?.name ?? doctor.medical_centers?.name ?? null,
  };
}
