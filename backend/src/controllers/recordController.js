import { supabase } from '../config/supabase.js';

export async function uploadHealthRecord(req, res, next) {
  try {
    const { patientId, title, notes, fileUrl } = req.body;
    const { data, error } = await supabase.from('health_records').insert([
      { patient_id: patientId, title, notes, file_url: fileUrl }
    ]).select();

    res.status(201).json({ message: 'Health record saved successfully', record: data ? data[0] : { patientId, title, notes } });
  } catch (err) {
    next(err);
  }
}

export async function getPatientRecords(req, res, next) {
  try {
    const { patientId } = req.params;
    const { data, error } = await supabase.from('health_records').select('*').eq('patient_id', patientId);
    res.json({ records: data || [] });
  } catch (err) {
    next(err);
  }
}
