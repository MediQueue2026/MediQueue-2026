import { supabase } from '../config/supabase.js';
import { notificationProvider } from '../config/notification.js';

/**
 * Service to dispatch delay and location alerts to subscribed patients & today's patients (BR-05, FR-07)
 */
export async function notifySubscribedPatients(doctorId, statusUpdate) {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // 1. Get all subscribed patients for this doctor
    const { data: subs } = await supabase
      .from('doctor_subscriptions')
      .select('patient_id, users(full_name, phone)')
      .eq('doctor_id', doctorId);

    // 2. Get today's active appointments for this doctor
    const { data: apts } = await supabase
      .from('appointments')
      .select('users:patient_id(full_name, phone)')
      .eq('doctor_id', doctorId)
      .eq('appointment_date', today)
      .in('status', ['booked', 'waiting', 'in_consultation']);

    // 3. Get today's active walk-in queue tokens for this doctor
    const { data: queueTokens } = await supabase
      .from('walk_in_queue')
      .select('sms_phone')
      .eq('doctor_id', doctorId)
      .eq('queue_date', today)
      .in('status', ['waiting', 'called', 'in_progress']);

    const phoneSet = new Set();

    (subs || []).forEach(s => {
      if (s.users?.phone) phoneSet.add(s.users.phone);
    });

    (apts || []).forEach(a => {
      if (a.users?.phone) phoneSet.add(a.users.phone);
    });

    (queueTokens || []).forEach(q => {
      if (q.sms_phone) phoneSet.add(q.sms_phone);
    });

    if (phoneSet.size === 0) {
      console.log(`[SMS NOTICE] No target patient phone numbers found for doctor ID ${doctorId}`);
      return { notifiedCount: 0 };
    }

    const { doctorName, delayMinutes, message } = statusUpdate;
    const alertMessage = message || `MediQueue Alert: ${doctorName || 'Your doctor'} is running ${delayMinutes || 15} mins late. Please adjust your travel arrival time.`;

    const results = [];
    for (const phone of phoneSet) {
      const res = await notificationProvider.sendSMS(phone, alertMessage);
      results.push(res);
    }

    return {
      notifiedCount: results.length,
      details: results
    };
  } catch (err) {
    console.error('Error dispatching delay notifications:', err);
    return { notifiedCount: 0, error: err.message };
  }
}
