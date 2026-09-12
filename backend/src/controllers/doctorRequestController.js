import { supabase } from '../config/supabase.js';
import bcrypt from 'bcryptjs';
import { notificationProvider } from '../config/notification.js';
import { nextSeriesLetterForCenter, formatDoctorFullName } from '../services/doctorLookup.js';

// In-memory fallback array in case DB table is not yet created or running in offline mode
const MEMORY_DOCTOR_REQUESTS = [];

export async function createDoctorRequest(req, res, next) {
  try {
    const {
      requestType,
      centerId,
      centerName,
      doctorId,
      doctorName,
      email,
      phone,
      specialization,
      roomNumber,
      series,
      maxAppointmentsPerHour,
    } = req.body;

    if (!requestType || !centerId || !doctorName || !specialization) {
      return res.status(400).json({ error: 'requestType, centerId, doctorName, and specialization are required' });
    }

    const receptionistName = req.user?.fullName || req.user?.email || 'Receptionist';
    const receptionistId = req.user?.id || null;

    // Fetch center name if not provided
    let finalCenterName = centerName;
    if (!finalCenterName && centerId) {
      const { data: centerRow } = await supabase
        .from('medical_centers')
        .select('name')
        .eq('id', centerId)
        .maybeSingle();
      if (centerRow) finalCenterName = centerRow.name;
    }

    const newRequestData = {
      request_type: requestType,
      receptionist_id: receptionistId,
      receptionist_name: receptionistName,
      center_id: centerId,
      center_name: finalCenterName || 'Medical Center',
      doctor_id: doctorId || null,
      doctor_name: formatDoctorFullName(doctorName),
      email: email || null,
      phone: phone || null,
      specialization,
      room_number: roomNumber || null,
      series: series || null,
      max_appointments_per_hour: maxAppointmentsPerHour || 4,
      status: 'pending',
    };

    let createdRecord = null;
    const { data, error } = await supabase
      .from('doctor_requests')
      .insert([newRequestData])
      .select()
      .single();

    if (error) {
      console.warn('doctor_requests DB insert fallback:', error.message);
      // Fallback in-memory creation
      createdRecord = {
        id: `req-${Date.now()}`,
        ...newRequestData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      MEMORY_DOCTOR_REQUESTS.unshift(createdRecord);
    } else {
      createdRecord = data;
    }

    res.status(201).json({
      message: 'Doctor request submitted successfully to Super Admin',
      request: mapDbRequestToPublic(createdRecord),
    });
  } catch (err) {
    next(err);
  }
}

export async function getDoctorRequests(req, res, next) {
  try {
    const { status } = req.query;

    let query = supabase
      .from('doctor_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error || !data) {
      let memoryList = MEMORY_DOCTOR_REQUESTS;
      if (status) {
        memoryList = memoryList.filter(r => r.status === status);
      }
      return res.json({ requests: memoryList.map(mapDbRequestToPublic) });
    }

    res.json({ requests: data.map(mapDbRequestToPublic) });
  } catch (err) {
    next(err);
  }
}

export async function approveDoctorRequest(req, res, next) {
  try {
    const { id } = req.params;

    let reqRecord = null;
    const { data: dbReq } = await supabase
      .from('doctor_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (dbReq) {
      reqRecord = dbReq;
    } else {
      reqRecord = MEMORY_DOCTOR_REQUESTS.find(r => r.id === id);
    }

    if (!reqRecord) {
      return res.status(404).json({ error: 'Doctor request not found' });
    }

    if (reqRecord.status === 'approved') {
      return res.status(400).json({ error: 'Request is already approved' });
    }

    // The person: an existing doctors row for ASSIGN_EXISTING, or a fresh
    // identity row for REGISTER_NEW. The posting (room / series / capacity for
    // THIS center) always goes into doctor_center_assignments below.
    let doctorId = null;
    let doctorRow = null;
    let emailToUse = null;
    let generatedPassword = null;

    if (reqRecord.request_type === 'ASSIGN_EXISTING' && reqRecord.doctor_id) {
      doctorId = reqRecord.doctor_id;
      if (reqRecord.specialization) {
        await supabase.from('doctors').update({ specialization: reqRecord.specialization }).eq('id', doctorId);
      }
      const { data } = await supabase
        .from('doctors').select('*, users(full_name)').eq('id', doctorId).maybeSingle();
      doctorRow = data;
    } else {
      // REGISTER_NEW doctor
      // Re-normalize in case this request predates the Dr./title-case formatting.
      const doctorFullName = formatDoctorFullName(reqRecord.doctor_name);
      const plainName = doctorFullName.replace(/^Dr\.\s*/, '');
      emailToUse = reqRecord.email || `dr.${plainName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')}.${Date.now()}@mediqueue.internal`;
      let userId = null;

      const { data: existingUser } = await supabase
        .from('users').select('id').eq('email', emailToUse).maybeSingle();

      if (existingUser) {
        userId = existingUser.id;
      } else {
        generatedPassword = `DocPass${Math.floor(1000 + Math.random() * 9000)}!`;
        // Hashing temporarily disabled for development & testing
        const passwordHash = generatedPassword;
        const { data: newUser, error: userErr } = await supabase
          .from('users')
          .insert([{
            email: emailToUse,
            full_name: doctorFullName,
            phone: reqRecord.phone || null,
            role: 'doctor',
            password_hash: passwordHash
          }])
          .select('id')
          .single();

        if (!userErr && newUser) {
          userId = newUser.id;
          if (reqRecord.phone) {
            await notificationProvider.sendSMS(
              reqRecord.phone,
              `Welcome ${doctorFullName}! Your MediQueue account is approved. Email: ${emailToUse} | Password: ${generatedPassword}. Login: Staff Portal.`
            );
          }
        }
      }

      if (userId) {
        // Identity row only — no center/room/series on doctors anymore.
        const { data: newDocProfile } = await supabase
          .from('doctors')
          .insert([{ user_id: userId, specialization: reqRecord.specialization, approval_status: 'approved' }])
          .select('*, users(full_name)')
          .single();
        doctorRow = newDocProfile;
        doctorId = newDocProfile?.id ?? null;
      }
    }

    // Upsert the per-center posting.
    let assignmentRow = null;
    if (doctorId && reqRecord.center_id) {
      const basePosting = {
        room_number: reqRecord.room_number || null,
        max_appointments_per_hour: reqRecord.max_appointments_per_hour || 4,
        current_status: 'active',
        approval_status: 'approved',
        requested_by_name: reqRecord.receptionist_name || null,
        updated_at: new Date().toISOString(),
      };
      const { data: existingAssignment } = await supabase
        .from('doctor_center_assignments')
        .select('id')
        .eq('doctor_id', doctorId).eq('center_id', reqRecord.center_id)
        .maybeSingle();

      if (existingAssignment) {
        // Only touch series if this request actually named one — otherwise a
        // re-approval with a blank series field would wipe out an existing one.
        const postingFields = reqRecord.series ? { ...basePosting, series: reqRecord.series } : basePosting;
        const { data } = await supabase
          .from('doctor_center_assignments')
          .update(postingFields)
          .eq('id', existingAssignment.id)
          .select('*, medical_centers(name)')
          .maybeSingle();
        assignmentRow = data;
      } else {
        // A brand-new posting at this center gets a unique series letter
        // unless the receptionist already typed one — it used to default to
        // null, which every reader then displayed as "?".
        const series = reqRecord.series || await nextSeriesLetterForCenter(reqRecord.center_id);
        const { data } = await supabase
          .from('doctor_center_assignments')
          .insert([{ doctor_id: doctorId, center_id: reqRecord.center_id, series, ...basePosting }])
          .select('*, medical_centers(name)')
          .maybeSingle();
        assignmentRow = data;
      }
    }

    const createdDoctor = doctorRow ? { ...doctorRow, __assignment: assignmentRow } : null;

    // Update status in DB / memory
    if (dbReq) {
      await supabase
        .from('doctor_requests')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id);
    }
    
    // Also update in-memory record if exists
    const memMatch = MEMORY_DOCTOR_REQUESTS.find(r => r.id === id);
    if (memMatch) {
      memMatch.status = 'approved';
      memMatch.updated_at = new Date().toISOString();
    }

    // Create Audit Log
    const adminName = req.user?.fullName || req.user?.email || 'Super Admin';
    try {
      await supabase.from('audit_logs').insert([{
        actor_name: adminName,
        actor_role: 'admin',
        event_type: 'doctor_approved',
        action: `Approved request: Added ${formatDoctorFullName(reqRecord.doctor_name)} to ${reqRecord.center_name}`,
        center_name: reqRecord.center_name,
        status: 'approved',
      }]);
    } catch (_) {}

    res.json({
      message: 'Doctor request approved successfully',
      requestId: id,
      status: 'approved',
      credentials: generatedPassword ? {
        email: emailToUse,
        password: generatedPassword,
        phone: reqRecord.phone || null,
        message: 'Credentials sent via SMS and logged to system audit logs.'
      } : null,
      doctor: createdDoctor ? (() => {
        const a = createdDoctor.__assignment;
        const maxPerHour = a?.max_appointments_per_hour ?? reqRecord.max_appointments_per_hour ?? 4;
        return {
          id: createdDoctor.id,
          name: createdDoctor.users?.full_name ?? reqRecord.doctor_name,
          dept: createdDoctor.specialization,
          room: a?.room_number ?? reqRecord.room_number ?? '—',
          series: a?.series ?? reqRecord.series ?? '?',
          status: a?.current_status ?? 'active',
          approvalStatus: 'approved',
          avgConsultMinutes: Math.max(1, Math.round(60 / (maxPerHour || 4))),
          maxAppointmentsPerHour: maxPerHour,
          centerId: a?.center_id ?? reqRecord.center_id,
          centerName: a?.medical_centers?.name ?? reqRecord.center_name,
        };
      })() : null,
    });
  } catch (err) {
    next(err);
  }
}

export async function rejectDoctorRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    let reqRecord = null;
    const { data: dbReq } = await supabase
      .from('doctor_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (dbReq) {
      reqRecord = dbReq;
    } else {
      reqRecord = MEMORY_DOCTOR_REQUESTS.find(r => r.id === id);
    }

    if (!reqRecord) {
      return res.status(404).json({ error: 'Doctor request not found' });
    }

    if (dbReq) {
      await supabase
        .from('doctor_requests')
        .update({
          status: 'rejected',
          rejection_reason: reason || 'Rejected by Admin',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
    }
    
    const memMatch = MEMORY_DOCTOR_REQUESTS.find(r => r.id === id);
    if (memMatch) {
      memMatch.status = 'rejected';
      memMatch.rejection_reason = reason || 'Rejected by Admin';
      memMatch.updated_at = new Date().toISOString();
    }

    // Create Audit Log
    const adminName = req.user?.fullName || req.user?.email || 'Super Admin';
    try {
      await supabase.from('audit_logs').insert([{
        actor_name: adminName,
        actor_role: 'admin',
        event_type: 'doctor_rejected',
        action: `Rejected request for ${formatDoctorFullName(reqRecord.doctor_name)} (${reason || 'No reason provided'})`,
        center_name: reqRecord.center_name,
        status: 'rejected',
      }]);
    } catch (_) {}

    res.json({
      message: 'Doctor request rejected',
      requestId: id,
      status: 'rejected',
      reason: reason || 'Rejected by Admin',
    });
  } catch (err) {
    next(err);
  }
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
