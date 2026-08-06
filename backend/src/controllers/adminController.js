import { supabase } from '../config/supabase.js';

export async function updateSlotConfig(req, res, next) {
  try {
    const { doctorId, maxSlotsPerHour } = req.body;
    const { data, error } = await supabase
      .from('doctors')
      .update({ max_appointments_per_hour: maxSlotsPerHour })
      .eq('id', doctorId)
      .select();

    res.json({ message: 'Slot configuration updated', doctorId, maxSlotsPerHour });
  } catch (err) {
    next(err);
  }
}

export async function getAuditLogs(req, res, next) {
  try {
    res.json({
      logs: [
        { time: '18:42:10', actor: 'Dr. Ethan Carr', action: 'Issued prescription for #A-11' },
        { time: '18:30:05', actor: 'Receptionist Counter A', action: 'Issued walk-in token #A-15' },
        { time: '18:15:22', actor: 'System Admin', action: 'Assigned Dr. Aisha Patel to Central Clinic Room 03' }
      ]
    });
  } catch (err) {
    next(err);
  }
}
