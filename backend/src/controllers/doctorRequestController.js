import { supabase } from '../config/supabase.js';
import { notificationProvider } from '../config/notification.js';
import { nextSeriesLetterForCenter, formatDoctorFullName } from '../services/doctorLookup.js';

// RECEPTIONIST: Create a join request targeted at a specific registered doctor
export async function createDoctorRequest(req, res, next) {
  try {
    const { requestType, centerId, centerName, doctorId, doctorName, email, phone, specialization, roomNumber, series, maxAppointmentsPerHour } = req.body;

    if (!requestType || !centerId || !doctorName || !specialization) {
      return res.status(400).json({ error: 'requestType, centerId, doctorName, and specialization are required' });
    }

    if (requestType !== 'ASSIGN_EXISTING' || !doctorId) {
      return res.status(400).json({ error: 'Only existing registered doctors can be invited via this flow. Select a doctor from the list.' });
    }

    const receptionistName = req.user?.fullName || req.user?.email || 'Receptionist';
    const receptionistId = req.user?.id || null;

    let finalCenterName = centerName;
    if (!finalCenterName && centerId) {
      const { data: centerRow } = await supabase.from('medical_centers').select('name').eq('id', centerId).maybeSingle();
      if (centerRow) finalCenterName = centerRow.name;
    }

    const { data: doctorRow } = await supabase.from('doctors').select('id, user_id, users(full_name, email)').eq('id', doctorId).maybeSingle();
    if (!doctorRow) return res.status(404).json({ error: 'Doctor not found in the system.' });

    const { data: existing } = await supabase.from('doctor_requests').select('id, status').eq('doctor_id', doctorId).eq('center_id', centerId).eq('status', 'pending').maybeSingle();
    if (existing) return res.status(409).json({ error: 'A pending join request for this doctor at this center already exists.' });

    const newRequestData = {
      request_type: 'ASSIGN_EXISTING',
      receptionist_id: receptionistId,
      receptionist_name: receptionistName,
      center_id: centerId,
      center_name: finalCenterName || 'Medical Center',
      doctor_id: doctorId,
      doctor_name: formatDoctorFullName(doctorRow.users?.full_name || doctorName),
      email: doctorRow.users?.email || email || null,
      phone: phone || null,
      specialization,
      room_number: roomNumber || null,
      series: series || null,
      max_appointments_per_hour: maxAppointmentsPerHour || 4,
      status: 'pending'
    };

    const { data, error } = await supabase.from('doctor_requests').insert([newRequestData]).select().single();

    if (error) {
      console.error('DB insert error:', error.message);
      return res.status(500).json({ error: 'Failed to save request to the database. ' + error.message });
    }

    res.status(201).json({
      message: `Join request sent to ${formatDoctorFullName(doctorRow.users?.full_name || doctorName)}. They will see it in their dashboard.`,
      request: mapDbRequestToPublic(data),
    });
  } catch (err) { next(err); }
}

// DOCTOR: Get pending join requests sent to ME
export async function getMyDoctorRequests(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    // 1. Find the doctor row for this user
    const { data: doctorRow, error: doctorError } = await supabase.from('doctors').select('id').eq('user_id', userId).maybeSingle();
    if (doctorError) {
      console.warn('[getMyDoctorRequests] Doctor lookup error:', doctorError.message);
      return res.json({ requests: [] });
    }
    
    if (!doctorRow) {
      // User is not a registered doctor yet
      return res.json({ requests: [] });
    }

    // 2. Fetch requests targeting this doctor_id
    const { data, error } = await supabase.from('doctor_requests')
      .select('*')
      .eq('doctor_id', doctorRow.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[getMyDoctorRequests] DB error:', error.message);
      return res.json({ requests: [] });
    }

    res.json({ requests: (data || []).map(mapDbRequestToPublic) });
  } catch (err) { next(err); }
}

// ADMIN: Read-only audit view of all doctor requests
export async function getDoctorRequests(req, res, next) {
  try {
    const { status } = req.query;
    let query = supabase.from('doctor_requests').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error || !data) {
      return res.json({ requests: [] });
    }
    res.json({ requests: data.map(mapDbRequestToPublic) });
  } catch (err) { next(err); }
}

// DOCTOR: Accept a join request
export async function acceptDoctorRequest(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // 1. Check if it exists
    const { data: dbReq } = await supabase.from('doctor_requests').select('*').eq('id', id).maybeSingle();
    if (!dbReq) return res.status(404).json({ error: 'Doctor request not found' });
    
    // 2. Verify ownership (the doctor_id must belong to this user)
    const doctorId = dbReq.doctor_id;
    if (!doctorId) return res.status(400).json({ error: 'Invalid request: missing doctor reference.' });
    
    const { data: myDoctor } = await supabase.from('doctors').select('id').eq('user_id', userId).maybeSingle();
    if (!myDoctor || myDoctor.id !== doctorId) {
      return res.status(403).json({ error: 'This request was not sent to you.' });
    }

    if (dbReq.status === 'approved') return res.status(400).json({ error: 'Request is already accepted' });

    if (dbReq.specialization) {
      await supabase.from('doctors').update({ specialization: dbReq.specialization }).eq('id', doctorId);
    }

    let assignmentRow = null;
    const basePosting = {
      room_number: dbReq.room_number || null,
      max_appointments_per_hour: dbReq.max_appointments_per_hour || 4,
      current_status: 'active',
      approval_status: 'approved',
      requested_by_name: dbReq.receptionist_name || null,
      updated_at: new Date().toISOString(),
    };

    const { data: existingAssignment } = await supabase.from('doctor_center_assignments').select('id').eq('doctor_id', doctorId).eq('center_id', dbReq.center_id).maybeSingle();

    if (existingAssignment) {
      const postingFields = dbReq.series ? { ...basePosting, series: dbReq.series } : basePosting;
      const { data } = await supabase.from('doctor_center_assignments').update(postingFields).eq('id', existingAssignment.id).select('*, medical_centers(name)').maybeSingle();
      assignmentRow = data;
    } else {
      const series = dbReq.series || await nextSeriesLetterForCenter(dbReq.center_id);
      const { data } = await supabase.from('doctor_center_assignments').insert([{ doctor_id: doctorId, center_id: dbReq.center_id, series, ...basePosting }]).select('*, medical_centers(name)').maybeSingle();
      assignmentRow = data;
    }

    await supabase.from('doctor_requests').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', id);

    const doctorName = req.user?.fullName || req.user?.email || 'Doctor';
    try {
      await supabase.from('audit_logs').insert([{
        actor_name: doctorName, actor_role: 'doctor', event_type: 'doctor_approved',
        action: `Dr. ${doctorName} accepted join request for ${dbReq.center_name}`,
        center_name: dbReq.center_name, status: 'approved',
      }]);
    } catch (_) {}

    res.json({
      message: `You have joined ${dbReq.center_name}. Your dashboard will update shortly.`,
      requestId: id, status: 'approved',
      assignment: assignmentRow ? {
        centerId: assignmentRow.center_id,
        centerName: assignmentRow.medical_centers?.name ?? dbReq.center_name,
        roomNumber: assignmentRow.room_number,
        series: assignmentRow.series,
      } : null,
    });
  } catch (err) { next(err); }
}

// DOCTOR: Decline a join request
export async function declineDoctorRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id;

    const { data: dbReq } = await supabase.from('doctor_requests').select('*').eq('id', id).maybeSingle();
    if (!dbReq) return res.status(404).json({ error: 'Doctor request not found' });
    
    // Verify ownership
    const doctorId = dbReq.doctor_id;
    if (doctorId) {
       const { data: myDoctor } = await supabase.from('doctors').select('id').eq('user_id', userId).maybeSingle();
       if (!myDoctor || myDoctor.id !== doctorId) {
         return res.status(403).json({ error: 'This request was not sent to you.' });
       }
    }

    await supabase.from('doctor_requests').update({ status: 'rejected', rejection_reason: reason || 'Declined by doctor', updated_at: new Date().toISOString() }).eq('id', id);

    const doctorName = req.user?.fullName || req.user?.email || 'Doctor';
    try {
      await supabase.from('audit_logs').insert([{
        actor_name: doctorName, actor_role: 'doctor', event_type: 'doctor_rejected',
        action: `Dr. ${doctorName} declined join request for ${dbReq.center_name}`,
        center_name: dbReq.center_name, status: 'rejected',
      }]);
    } catch (_) {}

    res.json({ message: 'Join request declined.', requestId: id, status: 'rejected', reason: reason || 'Declined by doctor' });
  } catch (err) { next(err); }
}

function mapDbRequestToPublic(row) {
  return {
    id: row.id,
    requestType: row.request_type || row.requestType,
    receptionistId: row.receptionist_id || row.receptionistId,
    receptionistName: row.receptionist_name || row.receptionistName || 'Receptionist',
    centerId: row.center_id || row.centerId,
    centerName: row.center_name || row.centerName || 'Medical Center',
    doctorId: row.doctor_id || row.doctorId || null,
    doctorName: row.doctor_name || row.doctorName,
    email: row.email || null,
    phone: row.phone || null,
    specialization: row.specialization,
    roomNumber: row.room_number || row.roomNumber || null,
    series: row.series || null,
    maxAppointmentsPerHour: row.max_appointments_per_hour || row.maxAppointmentsPerHour || 4,
    status: row.status || 'pending',
    rejectionReason: row.rejection_reason || row.rejectionReason || null,
    createdAt: row.created_at || row.createdAt,
  };
}
