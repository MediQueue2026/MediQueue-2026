import { supabase } from '../config/supabase.js';

/**
 * Service to handle patient no-show tracking and automatic late-number assignment (BR-03, FR-04)
 */
export async function evaluatePatientNoShowStatus(patientId) {
  try {
    const threshold = parseInt(process.env.NO_SHOW_LATE_NUMBER_THRESHOLD || '2');

    // Count missed appointments
    const { count, error } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('patient_id', patientId)
      .eq('status', 'no_show');

    const missedCount = count || 0;
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
      shouldAssignLateNumber: isRepeatOffender
    };
  } catch (err) {
    console.error('Error evaluating no-show status:', err);
    return { missedCount: 0, isRepeatOffender: false, shouldAssignLateNumber: false };
  }
}
