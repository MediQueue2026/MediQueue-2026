import { supabase } from '../config/supabase.js';

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
      doctor_name: doctorName,
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

    let createdDoctor = null;

    if (reqRecord.request_type === 'ASSIGN_EXISTING' && reqRecord.doctor_id) {
      // Update existing doctor profile
      const updates = {
        center_id: reqRecord.center_id,
        room_number: reqRecord.room_number,
        series: reqRecord.series,
        specialization: reqRecord.specialization,
        max_appointments_per_hour: reqRecord.max_appointments_per_hour || 4,
        approval_status: 'approved',
      };

      let { data: updatedDoc, error: updateErr } = await supabase
        .from('doctors')
        .update(updates)
        .eq('id', reqRecord.doctor_id)
        .select('*, medical_centers(name), users(full_name)')
        .maybeSingle();

      if (updateErr && (updateErr.message.includes('approval_status') || updateErr.code === 'PGRST204')) {
        delete updates.approval_status;
        const fb = await supabase
          .from('doctors')
          .update(updates)
          .eq('id', reqRecord.doctor_id)
          .select('*, medical_centers(name), users(full_name)')
          .maybeSingle();
        updatedDoc = fb.data;
      }

      createdDoctor = updatedDoc;
    } else {
      // REGISTER_NEW doctor
      const emailToUse = reqRecord.email || `dr.${reqRecord.doctor_name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '')}.${Date.now()}@mediqueue.internal`;

      // 1. Create or find user stub
      let userId = null;
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', emailToUse)
        .maybeSingle();

      if (existingUser) {
        userId = existingUser.id;
      } else {
        const { data: newUser, error: userErr } = await supabase
          .from('users')
          .insert([{
            email: emailToUse,
            full_name: reqRecord.doctor_name,
            phone: reqRecord.phone || null,
            role: 'doctor',
          }])
          .select('id')
          .single();

        if (!userErr && newUser) {
          userId = newUser.id;
        }
      }

      if (userId) {
        const insertPayload = {
          user_id: userId,
          center_id: reqRecord.center_id,
          specialization: reqRecord.specialization,
          room_number: reqRecord.room_number || null,
          series: reqRecord.series || null,
          max_appointments_per_hour: reqRecord.max_appointments_per_hour || 4,
          current_status: 'active',
          approval_status: 'approved',
        };

        let { data: newDocProfile, error: docErr } = await supabase
          .from('doctors')
          .insert([insertPayload])
          .select('*, medical_centers(name), users(full_name)')
          .single();

        if (docErr && (docErr.message.includes('approval_status') || docErr.code === 'PGRST204')) {
          delete insertPayload.approval_status;
          const fb = await supabase
            .from('doctors')
            .insert([insertPayload])
            .select('*, medical_centers(name), users(full_name)')
            .single();
          newDocProfile = fb.data;
        }

        createdDoctor = newDocProfile;
      }
    }

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
        action: `Approved request: Added Dr. ${reqRecord.doctor_name} to ${reqRecord.center_name}`,
        center_name: reqRecord.center_name,
        status: 'approved',
      }]);
    } catch (_) {}

    res.json({
      message: 'Doctor request approved successfully',
      requestId: id,
      status: 'approved',
      doctor: createdDoctor ? {
        id: createdDoctor.id,
        name: createdDoctor.users?.full_name ?? reqRecord.doctor_name,
        dept: createdDoctor.specialization,
        room: createdDoctor.room_number ?? '—',
        series: createdDoctor.series ?? '?',
        status: createdDoctor.current_status ?? 'active',
        approvalStatus: 'approved',
        avgConsultMinutes: Math.max(1, Math.round(60 / (createdDoctor.max_appointments_per_hour || 4))),
        maxAppointmentsPerHour: createdDoctor.max_appointments_per_hour ?? 4,
        centerId: createdDoctor.center_id,
        centerName: createdDoctor.medical_centers?.name ?? reqRecord.center_name,
      } : null,
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
        action: `Rejected request for Dr. ${reqRecord.doctor_name} (${reason || 'No reason provided'})`,
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
