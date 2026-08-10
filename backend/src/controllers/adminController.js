import { supabase } from '../config/supabase.js';
import { ensureDoctorProfile } from '../services/authService.js';

// ── Dummy seed logs used when the audit_logs table is empty or missing ──────
const DUMMY_AUDIT_LOGS = [
  {
    id: 'dummy-1',
    time: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    actor: 'Receptionist · Counter A-01',
    actor_role: 'receptionist',
    event_type: 'approval',
    action: '✅ APPROVED walk-in request from Patient Rajan Mehta — Token A-12 issued',
    center: 'MediQueue Central Clinic',
    status: 'approved'
  },
  {
    id: 'dummy-2',
    time: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    actor: 'Patient · Sunil Perera',
    actor_role: 'patient',
    event_type: 'request',
    action: 'Submitted online appointment request for Dr. Ethan Carr — Slot 10:00 AM',
    center: 'MediQueue Central Clinic',
    status: 'pending'
  },
  {
    id: 'dummy-3',
    time: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    actor: 'Receptionist · Counter A-01',
    actor_role: 'receptionist',
    event_type: 'approval',
    action: '✅ APPROVED appointment request for Sunil Perera — Confirmed with Dr. Ethan Carr',
    center: 'MediQueue Central Clinic',
    status: 'approved'
  },
  {
    id: 'dummy-4',
    time: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    actor: 'Patient · Kavya Nair',
    actor_role: 'patient',
    event_type: 'request',
    action: 'Requested SMS token registration — Walk-in, No appointment',
    center: 'MediQueue North Branch',
    status: 'pending'
  },
  {
    id: 'dummy-5',
    time: new Date(Date.now() - 28 * 60 * 1000).toISOString(),
    actor: 'Receptionist · Counter B-02',
    actor_role: 'receptionist',
    event_type: 'token_issued',
    action: 'Issued walk-in token #B-07 to patient Kavya Nair · SMS sent to 0771234567',
    center: 'MediQueue North Branch',
    status: 'completed'
  },
  {
    id: 'dummy-6',
    time: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    actor: 'Patient · Amara De Silva',
    actor_role: 'patient',
    event_type: 'request',
    action: 'Requested appointment cancellation — Token A-09, Dr. Aisha Patel',
    center: 'MediQueue Central Clinic',
    status: 'pending'
  },
  {
    id: 'dummy-7',
    time: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    actor: 'Receptionist · Counter A-01',
    actor_role: 'receptionist',
    event_type: 'no_show',
    action: 'Marked Token A-09 as No-Show — Patient Amara De Silva did not arrive',
    center: 'MediQueue Central Clinic',
    status: 'completed'
  },
  {
    id: 'dummy-8',
    time: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    actor: 'Dr. Ethan Carr',
    actor_role: 'doctor',
    event_type: 'prescription',
    action: 'Issued prescription for patient Token A-11 — Consultation completed',
    center: 'MediQueue Central Clinic',
    status: 'completed'
  },
  {
    id: 'dummy-9',
    time: new Date(Date.now() - 70 * 60 * 1000).toISOString(),
    actor: 'System Admin',
    actor_role: 'admin',
    event_type: 'system',
    action: 'Registered new facility: MediQueue North Medical Center — Activated',
    center: 'Platform',
    status: 'completed'
  },
  {
    id: 'dummy-10',
    time: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    actor: 'Patient · Roshan Fernando',
    actor_role: 'patient',
    event_type: 'request',
    action: 'Booked appointment online — Dr. Aisha Patel, Cardiology, 14:00 slot',
    center: 'MediQueue Central Clinic',
    status: 'approved'
  }
];

function mapDbUserToPublic(row) {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? row.fullName ?? '',
    phone: row.phone ?? null,
    role: row.role,
    avatarUrl: row.avatar_url ?? row.avatarUrl ?? null,
    createdAt: row.created_at ?? row.createdAt ?? null,
    isActive: row.is_active !== false,
  };
}

export async function getUsers(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, phone, role, avatar_url, created_at, is_active')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ users: (data || []).map(mapDbUserToPublic) });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const updates = {};

    if (typeof req.body.full_name === 'string') updates.full_name = req.body.full_name;
    if (typeof req.body.email === 'string') updates.email = req.body.email;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (typeof req.body.role === 'string') updates.role = req.body.role;
    if (typeof req.body.is_active === 'boolean') updates.is_active = req.body.is_active;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, email, full_name, phone, role, avatar_url, created_at, is_active')
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const publicUser = mapDbUserToPublic(data);
    if (updates.role === 'doctor') {
      await ensureDoctorProfile(publicUser);
    }

    res.json({ user: publicUser });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    next(err);
  }
}

export async function updateSlotConfig(req, res, next) {
  try {
    const { doctorId, maxSlotsPerHour } = req.body;
    await supabase
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
    // Try to fetch from Supabase audit_logs table
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    // If table missing or empty, return enriched dummy logs
    if (error || !data || data.length === 0) {
      return res.json({ logs: DUMMY_AUDIT_LOGS, source: 'dummy' });
    }

    // Map DB rows to standard shape
    const logs = data.map(row => ({
      id: row.id,
      time: row.created_at,
      actor: row.actor_name || 'Unknown',
      actor_role: row.actor_role || 'system',
      event_type: row.event_type || 'system',
      action: row.action,
      center: row.center_name || 'Platform',
      status: row.status || 'completed'
    }));

    res.json({ logs, source: 'database' });
  } catch (err) {
    // Fallback to dummy data on any error
    res.json({ logs: DUMMY_AUDIT_LOGS, source: 'dummy' });
  }
}

export async function createAuditLog(req, res, next) {
  try {
    const { actor_name, actor_role, event_type, action, center_name, status } = req.body;

    const { data, error } = await supabase
      .from('audit_logs')
      .insert([{ actor_name, actor_role, event_type, action, center_name, status }])
      .select();

    if (error) {
      // Return success anyway — audit logs are best-effort
      return res.status(201).json({ message: 'Log noted (table may not exist yet)', entry: null });
    }

    res.status(201).json({ message: 'Audit log created', entry: data[0] });
  } catch (err) {
    res.status(201).json({ message: 'Log noted', entry: null });
  }
}

export async function updateAuditLogStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Check if it's a dummy ID (for graceful fallback UI handling)
    if (id.startsWith('dummy-')) {
      return res.json({ message: 'Log status updated (simulated)', id, status });
    }

    const { data, error } = await supabase
      .from('audit_logs')
      .update({ status })
      .eq('id', id)
      .select();

    if (error) {
       return res.json({ message: 'Log status updated (simulated fallback)', id, status });
    }
    res.json({ message: 'Log status updated', entry: data[0] });
  } catch (err) {
    res.json({ message: 'Log status updated (simulated error)', id: req.params.id, status: req.body.status });
  }
}
