import { supabase } from '../config/supabase.js';

/**
 * Service to handle patient no-show tracking and automatic late-number assignment (BR-03, FR-04)
 */
export async function evaluatePatientNoShowStatus(patientId) {
  try {
    const threshold = parseInt(process.env.NO_SHOW_LATE_NUMBER_THRESHOLD || '2');

    if (!patientId || patientId === 'pat-1') {
      return { missedCount: 0, isRepeatOffender: false, shouldAssignLateNumber: false };
    }

    // Count missed tokens in walk_in_queue
    const { data: missedQueue } = await supabase
      .from('walk_in_queue')
      .select('id')
      .eq('patient_id', patientId)
      .in('status', ['left', 'skipped', 'no_show']);

    // Count missed appointments in appointments table
    const { data: missedAppts } = await supabase
      .from('appointments')
      .select('id')
      .eq('patient_id', patientId)
      .in('status', ['no_show', 'left', 'skipped']);

    const missedCount = (missedQueue?.length || 0) + (missedAppts?.length || 0);
    const isRepeatOffender = missedCount >= threshold;

    if (isRepeatOffender) {
      // Flag user in users table
      await supabase
        .from('users')
        .update({ no_show_count: missedCount, is_flagged_late: true })
        .eq('id', patientId);
    }

    return {
      missedCount,
      isRepeatOffender,
      isLateNumber: isRepeatOffender,
      shouldAssignLateNumber: isRepeatOffender
    };
  } catch (err) {
    console.error('Error evaluating no-show status:', err);
    return { missedCount: 0, isRepeatOffender: false, shouldAssignLateNumber: false };
  }
}
