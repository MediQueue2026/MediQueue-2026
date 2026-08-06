import { supabase } from '../config/supabase.js';
import { notificationProvider } from '../config/notification.js';

/**
 * Service to dispatch delay and location alerts to subscribed patients (BR-05, FR-07)
 */
export async function notifySubscribedPatients(doctorId, statusUpdate) {
  try {
    // 1. Get all subscribed patients for this doctor
    const { data: subs, error } = await supabase
      .from('doctor_subscriptions')
      .select('patient_id, users(full_name, phone)')
      .eq('doctor_id', doctorId);

    if (error || !subs || subs.length === 0) {
      console.log(`No subscribers found for doctor ID ${doctorId}`);
      return { notifiedCount: 0 };
    }

    const { doctorName, delayMinutes, message } = statusUpdate;
    const alertMessage = message || `MediQueue Alert: ${doctorName} is running ${delayMinutes} mins late. Please adjust your arrival time.`;

    const results = [];
    for (const sub of subs) {
      const phone = sub.users?.phone;
      if (phone) {
        const res = await notificationProvider.sendSMS(phone, alertMessage);
        results.push(res);
      }
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
