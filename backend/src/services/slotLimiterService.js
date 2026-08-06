import { supabase } from '../config/supabase.js';

/**
 * Service to enforce doctor hourly slot limits (BR-02, FR-03)
 */
export async function checkSlotAvailability(doctorId, appointmentDate, slotHour) {
  try {
    // 1. Fetch Doctor's configured limit
    const { data: doctor, error: docError } = await supabase
      .from('doctors')
      .select('max_appointments_per_hour')
      .eq('id', doctorId)
      .single();

    const maxLimit = doctor?.max_appointments_per_hour || parseInt(process.env.DEFAULT_MAX_SLOTS_PER_HOUR || '4');

    // 2. Count existing booked appointments for doctor in target hour
    const { count, error: countError } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('appointment_date', appointmentDate)
      .eq('slot_hour', slotHour)
      .in('status', ['booked', 'waiting', 'in_consultation']);

    const currentBookings = count || 0;
    const isAvailable = currentBookings < maxLimit;

    return {
      available: isAvailable,
      currentBookings,
      maxLimit,
      remainingSlots: Math.max(0, maxLimit - currentBookings)
    };
  } catch (err) {
    console.error('Error checking slot availability:', err);
    return { available: true, currentBookings: 0, maxLimit: 4, remainingSlots: 4 };
  }
}
