import { supabase } from '../config/supabase.js';
import { notificationProvider } from '../config/notification.js';
import { nextSeriesLetterForCenter, formatDoctorFullName } from '../services/doctorLookup.js';
import bcrypt from 'bcryptjs';

export async function generateUniqueDoctorEmail(doctorName) {
  if (!doctorName) return `doctor@mediqueue.lk`;
  
  const clean = doctorName.trim().replace(/^dr\.?\s*/i, '').replace(/^prof\.?\s*/i, '');
  const parts = clean.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  
  let basePrefix = '';
  if (parts.length >= 2) {
    basePrefix = `${parts[0]}.${parts[parts.length - 1]}`;
  } else if (parts.length === 1) {
    basePrefix = parts[0];
  } else {
    basePrefix = 'doctor';
  }

  let candidate = `${basePrefix}@mediqueue.lk`;
  let suffix = 1;

  while (true) {
    const [userRes, reqRes] = await Promise.all([
      supabase.from('users').select('id').eq('email', candidate).maybeSingle(),
      supabase.from('doctor_requests').select('id').eq('email', candidate).eq('status', 'pending').maybeSingle()
    ]);

    if (!userRes.data && !reqRes.data) {
      return candidate;
    }

    suffix++;
    candidate = `${basePrefix}${suffix}@mediqueue.lk`;
  }
}

export async function createDoctorRequest(req, res, next) {
  try {
    const {
      requestType, centerId, centerName, doctorId, doctorName,
      email, phone, specialization, slmcRegNo, roomNumber, series,
      maxAppointmentsPerHour, joinedDate, gender, dateOfBirth,
      qualifications, experienceStartYear, yearsOfExperience, nic
    } = req.body;

    if (!requestType || !centerId || !doctorName || !specialization) {
      return res.status(400).json({ error: 'requestType, centerId, doctorName, and specialization are required' });
    }

    const receptionistName = req.user?.fullName || req.user?.email || 'Receptionist';
    const receptionistId = req.user?.id || null;

    let finalCenterName = centerName;
    if (!finalCenterName && centerId) {
      const { data: centerRow } = await supabase.from('medical_centers').select('name').eq('id', centerId).maybeSingle();
      if (centerRow) finalCenterName = centerRow.name;
    }

    // Auto-generate series for this medical center if not explicitly provided
    const autoSeries = (series && String(series).trim().toUpperCase()) || await nextSeriesLetterForCenter(centerId);
    const finalJoinedDate = joinedDate || new Date().toISOString().split('T')[0];

    if (requestType === 'ASSIGN_EXISTING') {
      if (!doctorId) {
        return res.status(400).json({ error: 'Select an existing doctor from the list.' });
      }

      const { data: doctorRow } = await supabase.from('doctors').select('id, user_id, users(full_name, email, phone)').eq('id', doctorId).maybeSingle();
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
        phone: (phone && String(phone).trim()) || doctorRow.users?.phone || null,
        specialization,
        slmc_reg_no: slmcRegNo || null,
        room_number: roomNumber || null,
        series: autoSeries,
        max_appointments_per_hour: maxAppointmentsPerHour || 4,
        joined_date: finalJoinedDate,
        status: 'pending'
      };

      if (phone && String(phone).trim() && doctorRow.user_id) {
        await supabase.from('users').update({ phone: String(phone).trim() }).eq('id', doctorRow.user_id);
      }

      const { data, error } = await supabase.from('doctor_requests').insert([newRequestData]).select().single();
      if (error) {
        console.error('DB insert error:', error.message);
        return res.status(500).json({ error: 'Failed to save request to the database. ' + error.message });
      }

      return res.status(201).json({
        message: `Join request sent to ${formatDoctorFullName(doctorRow.users?.full_name || doctorName)}. They will see it in their dashboard.`,
        request: mapDbRequestToPublic(data),
      });
    } else if (requestType === 'CREATE_NEW') {
      const generatedEmail = email?.trim() || await generateUniqueDoctorEmail(doctorName);

      const newRequestData = {
        request_type: 'CREATE_NEW',
        receptionist_id: receptionistId,
        receptionist_name: receptionistName,
        center_id: centerId,
        center_name: finalCenterName || 'Medical Center',
        doctor_id: null,
        doctor_name: formatDoctorFullName(doctorName),
        email: generatedEmail,
        phone: phone || null,
        specialization,
        slmc_reg_no: slmcRegNo || null,
        room_number: roomNumber || null,
        series: autoSeries,
        max_appointments_per_hour: maxAppointmentsPerHour || 4,
        gender: gender || null,
        date_of_birth: dateOfBirth || null,
        qualifications: qualifications?.trim() || null,
        experience_start_year: experienceStartYear ? Number(experienceStartYear) : null,
        years_of_experience: yearsOfExperience ? Number(yearsOfExperience) : null,
        nic: nic?.trim() || null,
        joined_date: finalJoinedDate,
        status: 'pending'
      };

      const { data, error } = await supabase.from('doctor_requests').insert([newRequestData]).select().single();
      if (error) {
        console.error('DB insert error:', error.message);
        return res.status(500).json({ error: 'Failed to save request to the database. ' + error.message });
      }

      return res.status(201).json({
        message: `Doctor creation request for ${formatDoctorFullName(doctorName)} submitted to System Admin for approval.`,
        request: mapDbRequestToPublic(data),
      });
    } else {
      return res.status(400).json({ error: 'Invalid requestType.' });
    }
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
      joined_date: dbReq.joined_date || new Date().toISOString().split('T')[0],
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

// ADMIN: Approve doctor creation or assignment request
export async function approveAdminDoctorRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { data: dbReq } = await supabase.from('doctor_requests').select('*').eq('id', id).maybeSingle();
    if (!dbReq) return res.status(404).json({ error: 'Doctor request not found' });
    if (dbReq.status === 'approved') return res.status(400).json({ error: 'Request is already approved' });

    let email = dbReq.email;
    if (!email) {
      email = await generateUniqueDoctorEmail(dbReq.doctor_name);
    }

    const { data: existingUser } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
    let userId;
    let tempPassword = '';

    if (existingUser) {
      userId = existingUser.id;
    } else {
      const randStr = Math.random().toString(36).substring(2, 8);
      tempPassword = `Doc#${randStr}`;
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const { data: newUser, error: userError } = await supabase.from('users').insert([{
        email,
        password_hash: passwordHash,
        full_name: dbReq.doctor_name,
        phone: dbReq.phone || null,
        role: 'doctor',
        is_active: true,
      }]).select('id').single();

      if (userError) {
        return res.status(500).json({ error: 'Failed to create user account: ' + userError.message });
      }
      userId = newUser.id;
    }

    let { data: doctorRow } = await supabase.from('doctors').select('id').eq('user_id', userId).maybeSingle();
    if (!doctorRow) {
      const { data: newDoc, error: docErr } = await supabase.from('doctors').insert([{
        user_id: userId,
        specialization: dbReq.specialization,
        slmc_reg_no: dbReq.slmc_reg_no || null,
        qualifications: dbReq.qualifications || null,
        experience_start_year: dbReq.experience_start_year || null,
        years_of_experience: dbReq.years_of_experience || null,
        gender: dbReq.gender || null,
        date_of_birth: dbReq.date_of_birth || null,
        nic: dbReq.nic || null,
      }]).select('id').single();
      if (docErr) {
        return res.status(500).json({ error: 'Failed to create doctor profile: ' + docErr.message });
      }
      doctorRow = newDoc;
    } else {
      const docUpdates = {};
      if (dbReq.slmc_reg_no) docUpdates.slmc_reg_no = dbReq.slmc_reg_no;
      if (dbReq.specialization) docUpdates.specialization = dbReq.specialization;
      if (dbReq.qualifications) docUpdates.qualifications = dbReq.qualifications;
      if (dbReq.experience_start_year) docUpdates.experience_start_year = dbReq.experience_start_year;
      if (dbReq.years_of_experience) docUpdates.years_of_experience = dbReq.years_of_experience;
      if (dbReq.gender) docUpdates.gender = dbReq.gender;
      if (dbReq.date_of_birth) docUpdates.date_of_birth = dbReq.date_of_birth;
      if (dbReq.nic) docUpdates.nic = dbReq.nic;
      if (Object.keys(docUpdates).length > 0) {
        await supabase.from('doctors').update(docUpdates).eq('id', doctorRow.id);
      }
    }

    const series = dbReq.series || await nextSeriesLetterForCenter(dbReq.center_id);
    const postingFields = {
      doctor_id: doctorRow.id,
      center_id: dbReq.center_id,
      room_number: dbReq.room_number || null,
      series,
      max_appointments_per_hour: dbReq.max_appointments_per_hour || 4,
      joined_date: dbReq.joined_date || new Date().toISOString().split('T')[0],
      current_status: 'active',
      approval_status: 'approved',
      requested_by_name: dbReq.receptionist_name || 'System Admin',
      updated_at: new Date().toISOString(),
    };

    const { data: existingAssignment } = await supabase.from('doctor_center_assignments').select('id').eq('doctor_id', doctorRow.id).eq('center_id', dbReq.center_id).maybeSingle();

    if (existingAssignment) {
      await supabase.from('doctor_center_assignments').update(postingFields).eq('id', existingAssignment.id);
    } else {
      await supabase.from('doctor_center_assignments').insert([postingFields]);
    }

    await supabase.from('doctor_requests').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', id);

    if (dbReq.phone) {
      const smsMsg = `Your MediQueue Doctor Account has been approved! Login Email: ${email}${tempPassword ? `, Password: ${tempPassword}` : ''}. Sign in at mediqueue.lk/login`;
      await notificationProvider.sendSMS(dbReq.phone, smsMsg);
    }

    try {
      await supabase.from('audit_logs').insert([{
        actor_name: req.user?.fullName || req.user?.email || 'System Admin',
        actor_role: 'admin',
        event_type: 'doctor_approved',
        action: `Approved new doctor ${dbReq.doctor_name} for ${dbReq.center_name}`,
        center_name: dbReq.center_name,
        status: 'approved',
      }]);
    } catch (_) {}

    res.json({
      message: `Doctor account for ${dbReq.doctor_name} approved successfully. Credentials sent via SMS.`,
      requestId: id,
      status: 'approved',
      generatedEmail: email,
      generatedPassword: tempPassword,
    });
  } catch (err) { next(err); }
}

// ADMIN: Reject doctor request
export async function rejectAdminDoctorRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { data: dbReq } = await supabase.from('doctor_requests').select('*').eq('id', id).maybeSingle();
    if (!dbReq) return res.status(404).json({ error: 'Doctor request not found' });

    await supabase.from('doctor_requests').update({ status: 'rejected', rejection_reason: reason || 'Rejected by System Admin', updated_at: new Date().toISOString() }).eq('id', id);

    res.json({ message: 'Doctor request rejected.', requestId: id, status: 'rejected' });
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
    slmcRegNo: row.slmc_reg_no || row.slmcRegNo || null,
    qualifications: row.qualifications || null,
    experienceStartYear: row.experience_start_year || null,
    yearsOfExperience: row.years_of_experience || null,
    gender: row.gender || null,
    dateOfBirth: row.date_of_birth || null,
    nic: row.nic || null,
    joinedDate: row.joined_date || row.joinedDate || null,
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
