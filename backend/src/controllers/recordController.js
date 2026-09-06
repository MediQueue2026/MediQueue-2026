import { supabase } from '../config/supabase.js';

const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

/**
 * Attachment rules, enforced here as well as in the browser. The client check in
 * lib/api.ts (`validateHealthRecordFile`) is a convenience — this is the gate,
 * since anything can POST to this endpoint directly.
 */
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'];
const ALLOWED_RECORD_TYPES = ['prescription', 'lab_report', 'ecg', 'xray', 'general'];

/**
 * The bytes go to Supabase Storage via POST /api/uploads, so what reaches this
 * endpoint is the resulting URL. Checking its extension is what stops a row
 * pointing at something that isn't a report — and it is what rejects the old
 * placeholder `/files/<name>` strings the modal used to invent.
 */
function fileUrlProblem(fileUrl) {
  let parsed;
  try {
    parsed = new URL(fileUrl);
  } catch {
    // Not absolute. uploadFileToStorage always returns an absolute URL — for the
    // Supabase bucket and for the local-disk fallback alike — so a bare path can
    // only be a value that never went through storage, which is exactly what the
    // old modal invented (`/files/<name>`).
    return 'Attachment must be uploaded to storage first.';
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return 'Attachment URL is not valid.';
  }

  const extension = parsed.pathname.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return 'Only PDF, PNG and JPG files can be attached.';
  }
  return null;
}

export async function uploadHealthRecord(req, res, next) {
  try {
    const { patientId, title, notes, fileUrl, recordType, issuingAuthority, mimeType, fileSize } = req.body;

    if (!patientId || !isUuid(patientId)) {
      return res.status(400).json({ error: 'A valid patientId is required.' });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'A report title is required.' });
    }

    // Attachment checks. A record may legitimately carry no file (a doctor's
    // note-only entry), but one that claims a file must claim a valid one.
    if (fileUrl) {
      const problem = fileUrlProblem(String(fileUrl));
      if (problem) return res.status(400).json({ error: problem });

      if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
        return res.status(400).json({ error: 'Only PDF, PNG and JPG files can be attached.' });
      }
      if (Number(fileSize) > MAX_FILE_BYTES) {
        return res.status(400).json({ error: 'File size exceeds maximum limit of 10MB.' });
      }
    }

    const type = ALLOWED_RECORD_TYPES.includes(recordType) ? recordType : 'lab_report';

    const { data, error } = await supabase
      .from('health_records')
      .insert([{
        patient_id: patientId,
        title: String(title).trim(),
        notes: notes ? String(notes).trim() : null,
        file_url: fileUrl || null,
        // Previously dropped on the floor: the modal collected both of these and
        // neither was ever written, so every uploaded row read back as a
        // 'lab_report' from 'MediQueue EHR'.
        record_type: type,
        issuing_authority: issuingAuthority ? String(issuingAuthority).trim() : null,
      }])
      .select()
      .maybeSingle();

    // The insert error used to be destructured and then ignored, so a failed
    // write still returned 201 with an echo of the request body — the row was
    // absent from the database but present in the UI until the next refresh.
    if (error) {
      console.error('Health record insert error:', error.message);
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ message: 'Health record saved successfully', record: data });
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