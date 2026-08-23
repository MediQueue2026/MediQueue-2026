import { supabase } from '../config/supabase.js';
import { ensureDoctorProfile } from '../services/authService.js';
import { writeAuditLog, normalizeAuditEventType } from '../services/auditService.js';

function mapAuditLogRow(row) {
  return {
    id: row.id,
    time: row.created_at ?? row.time ?? new Date().toISOString(),
    actor: row.actor_name || 'System',
    actor_role: row.actor_role || 'system',
    event_type: normalizeAuditEventType(row.event_type || 'system'),
    action: row.action || 'System event',
    center: row.center_name || 'Platform',
    status: row.status || 'completed',
  };
}

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

    if (typeof req.body.is_active === 'boolean') {
      await writeAuditLog({
        actorName: req.user?.fullName || req.user?.email || 'System Admin',
        actorRole: req.user?.role || 'admin',
        eventType: updates.is_active ? 'user_activated' : 'user_suspended',
        action: `${updates.is_active ? 'User activated' : 'User suspended'}: ${publicUser.fullName || publicUser.email}`,
        centerName: 'Platform',
        status: 'completed',
      });
    } else if (Object.keys(updates).length > 0) {
      await writeAuditLog({
        actorName: req.user?.fullName || req.user?.email || 'System Admin',
        actorRole: req.user?.role || 'admin',
        eventType: 'profile_updated',
        action: `Profile updated: ${publicUser.fullName || publicUser.email}`,
        centerName: 'Platform',
        status: 'completed',
      });
    }

    res.json({ user: publicUser });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const { id } = req.params;
    const { data: userRow } = await supabase
      .from('users')
      .select('full_name, email, role')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    await writeAuditLog({
      actorName: req.user?.fullName || req.user?.email || 'System Admin',
      actorRole: req.user?.role || 'admin',
      eventType: 'user_deleted',
      action: `User deleted: ${userRow?.full_name || userRow?.email || 'Unknown user'}`,
      centerName: 'Platform',
      status: 'completed',
    });

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
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : '';
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : '';

    if (startDate && endDate && startDate > endDate) {
      return res.status(400).json({ error: 'Start date cannot be later than end date.', logs: [], source: 'database' });
    }

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (startDate) {
      const startIso = new Date(`${startDate}T00:00:00.000Z`).toISOString();
      query = query.gte('created_at', startIso);
    }

    if (endDate) {
      const endIso = new Date(`${endDate}T23:59:59.999Z`).toISOString();
      query = query.lte('created_at', endIso);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message, logs: [], source: 'database' });
    }

    const logs = (data || []).map(mapAuditLogRow);
    return res.json({ logs, source: 'database' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unable to read audit logs', logs: [], source: 'database' });
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
      return res.status(500).json({ error: error.message, entry: null });
    }

    res.status(201).json({ message: 'Audit log created', entry: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to create audit log', entry: null });
  }
}

export async function updateAuditLogStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabase
      .from('audit_logs')
      .update({ status })
      .eq('id', id)
      .select();

    if (error) {
      return res.status(500).json({ error: error.message, entry: null });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Audit log not found', entry: null });
    }

    res.json({ message: 'Log status updated', entry: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to update audit log status', entry: null });
  }
}
