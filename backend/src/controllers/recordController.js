import { supabase } from '../config/supabase.js';

const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

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
    const nameFilter = req.query.patientName || req.query.name;
    let query = supabase.from('health_records').select('*, doctors(users(full_name))');

    if (patientId && patientId !== 'all') {
      if (isUuid(patientId)) {
        const { data: pUser } = await supabase.from('users').select('full_name').eq('id', patientId).maybeSingle();
        if (pUser?.full_name) {
          const firstName = pUser.full_name.trim().split(' ')[0];
          const { data: sameNameUsers } = await supabase.from('users').select('id').ilike('full_name', `%${firstName}%`);
          const userIds = (sameNameUsers || []).map(u => u.id);
          if (userIds.length > 0) {
            query = query.in('patient_id', userIds);
          } else {
            query = query.eq('patient_id', patientId);
          }
        } else if (nameFilter && nameFilter !== 'Patient' && nameFilter !== 'Walk-in Patient') {
          const cleanName = nameFilter.trim().split(' ')[0];
          const { data: pUsers } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'patient')
            .ilike('full_name', `%${cleanName}%`);

          const ids = (pUsers || []).map(u => u.id);
          if (ids.length > 0) {
            query = query.in('patient_id', ids);
          } else {
            query = query.eq('patient_id', patientId);
          }
        } else {
          query = query.eq('patient_id', patientId);
        }
      } else {
        const searchName = nameFilter || (patientId !== 'all' ? patientId : null);
        if (searchName) {
          const cleanName = searchName.replace(/^demo-/i, '').trim().split(' ')[0];
          const { data: pUsers } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'patient')
            .ilike('full_name', `%${cleanName}%`);

          const ids = (pUsers || []).map(u => u.id);
          if (ids.length > 0) {
            query = query.in('patient_id', ids);
          }
        }
      }
    } else if (nameFilter) {
      const cleanName = nameFilter.trim().split(' ')[0];
      const { data: pUsers } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'patient')
        .ilike('full_name', `%${cleanName}%`);

      const ids = (pUsers || []).map(u => u.id);
      if (ids.length > 0) {
        query = query.in('patient_id', ids);
      }
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    const mapped = (data || []).map(r => ({
      ...r,
      issuing_authority: r.issuing_authority || (r.doctors?.users?.full_name ? `Dr. ${r.doctors.users.full_name}` : 'MediQueue Doctor Console')
    }));

    res.json({ records: mapped });
  } catch (err) {
    next(err);
  }
}

export async function createPrescriptionRecord(req, res, next) {
  try {
    const { patientId, patientName, doctorId, doctorName, complaint, diagnosis, rxMedications, advice, followUpDate } = req.body;

    let validPatientId = null;
    if (isUuid(patientId)) {
      const { data: uCheck } = await supabase.from('users').select('id').eq('id', patientId).maybeSingle();
      if (uCheck) {
        validPatientId = uCheck.id;
      }
    }

    let validDoctorId = isUuid(doctorId) ? doctorId : null;

    // 1. Resolve Patient ID by searching users table if not a valid user UUID
    if (!validPatientId && patientName && patientName !== 'Patient' && patientName !== 'Walk-in Patient') {
      const cleanName = patientName.trim().split(' ')[0];
      const { data: matchedUsers } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'patient')
        .ilike('full_name', `%${cleanName}%`);

      if (matchedUsers && matchedUsers.length > 0) {
        const exact = matchedUsers.find(u => u.full_name.toLowerCase() === patientName.toLowerCase());
        validPatientId = exact ? exact.id : matchedUsers[0].id;
      }
    }

    if (!validPatientId) {
      const { data: pUser } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'patient')
        .limit(1)
        .maybeSingle();
      if (pUser) validPatientId = pUser.id;
    }

    // 2. Resolve Doctor ID (Map users.id -> doctors.id if needed)
    if (validDoctorId) {
      const { data: dRow } = await supabase.from('doctors').select('id').eq('id', validDoctorId).maybeSingle();
      if (!dRow) {
        const { data: dUserRow } = await supabase.from('doctors').select('id').eq('user_id', validDoctorId).maybeSingle();
        if (dUserRow) {
          validDoctorId = dUserRow.id;
        } else {
          validDoctorId = null;
        }
      }
    }

    // 2. Resolve Doctor ID if not UUID
    if (!validDoctorId && doctorName) {
      const cleanDoc = doctorName.replace(/^Dr\.\s*/i, '').trim().split(' ')[0];
      const { data: dUser } = await supabase
        .from('users')
        .select('id, doctors(id)')
        .eq('role', 'doctor')
        .ilike('full_name', `%${cleanDoc}%`)
        .limit(1)
        .maybeSingle();

      if (dUser?.doctors?.[0]?.id) {
        validDoctorId = dUser.doctors[0].id;
      }
    }

    if (!validDoctorId) {
      const { data: dUser } = await supabase
        .from('doctors')
        .select('id')
        .limit(1)
        .maybeSingle();
      if (dUser) validDoctorId = dUser.id;
    }

    const title = diagnosis ? `Prescription: ${diagnosis}` : 'Medical Prescription';
    let notesText = advice || '';
    if (complaint) {
      notesText = `Chief Complaint: ${complaint}. ${notesText}`;
    }
    if (followUpDate) {
      notesText += ` | Follow-up Recommended: ${followUpDate}`;
    }

    const doctorTitleName = doctorName ? (doctorName.toLowerCase().startsWith('dr') ? doctorName : `Dr. ${doctorName}`) : 'MediQueue Doctor Console';

    const { data, error } = await supabase
      .from('health_records')
      .insert([{
        patient_id: validPatientId,
        doctor_id: validDoctorId,
        title,
        record_type: 'prescription',
        issuing_authority: doctorTitleName,
        notes: notesText,
        rx_medications: Array.isArray(rxMedications) ? rxMedications : [],
      }])
      .select()
      .maybeSingle();

    if (error) {
      console.error('Prescription DB Insert Error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({
      message: 'Prescription saved to patient health records successfully',
      record: data
    });
  } catch (err) {
    next(err);
  }
}