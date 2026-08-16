import { supabase } from '../config/supabase.js';

function mapDbCenterToPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    address: row.address,
    opening_hours: row.opening_hours ?? row.hours ?? '08:00 - 18:00',
    services: row.services ?? [],
    phone: row.phone ?? null,
    status: row.status ?? 'operational',
    created_at: row.created_at ?? null,
  };
}

const DEFAULT_CENTERS = [
  { id: 'a1000000-0000-0000-0000-000000000001', name: 'MediQueue Central Clinic', city: 'Colombo 07', address: '124 Medical Plaza', opening_hours: '08:00 - 20:00', services: ['Cardiology', 'General Medicine', 'Pediatrics'], phone: '0112345678', status: 'operational' },
  { id: 'a1000000-0000-0000-0000-000000000002', name: 'MediQueue North Branch', city: 'Kandy', address: '45 Station Road', opening_hours: '09:00 - 18:00', services: ['Orthopedics', 'General Medicine'], phone: '0812345678', status: 'operational' }
];

export async function getCenters(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('medical_centers')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase query error on medical_centers:', error.message);
      return res.json({ centers: DEFAULT_CENTERS });
    }

    if (!data || data.length === 0) {
      // Auto-seed default centers into Supabase medical_centers table
      let { data: seeded, error: seedErr } = await supabase
        .from('medical_centers')
        .insert(DEFAULT_CENTERS)
        .select();

      if (seedErr && (seedErr.message?.includes('status') || seedErr.code === 'PGRST204')) {
        const noStatusDefaults = DEFAULT_CENTERS.map(({ status, ...rest }) => rest);
        const retry = await supabase.from('medical_centers').insert(noStatusDefaults).select();
        seeded = retry.data;
        seedErr = retry.error;
      }

      if (!seedErr && seeded && seeded.length > 0) {
        return res.json({ centers: seeded.map(mapDbCenterToPublic) });
      }

      return res.json({ centers: DEFAULT_CENTERS });
    }

    res.json({ centers: data.map(mapDbCenterToPublic) });
  } catch (err) {
    next(err);
  }
}

export async function createCenter(req, res, next) {
  try {
    const { name, city, address, openingHours, services, phone, status } = req.body;

    if (!name || !city) {
      return res.status(400).json({ error: 'Facility Name and City are required.' });
    }

    const payload = {
      name,
      city,
      address: address || city,
      opening_hours: openingHours || '08:00 - 18:00',
      services: Array.isArray(services) ? services : (services ? [services] : []),
      phone: phone || null,
      status: status || 'operational',
    };

    let { data, error } = await supabase
      .from('medical_centers')
      .insert([payload])
      .select();

    if (error && (error.message?.includes('status') || error.code === 'PGRST204')) {
      const { status: _, ...payloadWithoutStatus } = payload;
      const retry = await supabase
        .from('medical_centers')
        .insert([payloadWithoutStatus])
        .select();

      data = retry.data;
      error = retry.error;
    }

    if (error) {
      console.error('Failed to insert center into medical_centers table:', error);
      return res.status(500).json({ error: error.message });
    }

    const createdCenter = data && data[0] ? mapDbCenterToPublic(data[0]) : payload;

    // Best-effort audit log recording
    try {
      await supabase.from('audit_logs').insert([{
        actor_name: req.user?.fullName || 'System Admin',
        actor_role: req.user?.role || 'admin',
        event_type: 'Center Created',
        action: `Created new medical center "${name}" in ${city}`,
        center_name: name,
        status: 'completed'
      }]);
    } catch (auditErr) {
      // ignore non-critical audit log failure
    }

    res.status(201).json({ message: 'Center created successfully', center: createdCenter });
  } catch (err) {
    next(err);
  }
}

export async function updateCenter(req, res, next) {
  try {
    const { id } = req.params;
    const updates = {};

    if (typeof req.body.name === 'string') updates.name = req.body.name;
    if (typeof req.body.city === 'string') updates.city = req.body.city;
    if (typeof req.body.address === 'string') updates.address = req.body.address;
    if (typeof req.body.openingHours === 'string') updates.opening_hours = req.body.openingHours;
    if (Array.isArray(req.body.services)) updates.services = req.body.services;
    if (typeof req.body.phone === 'string') updates.phone = req.body.phone;
    if (typeof req.body.status === 'string') updates.status = req.body.status;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    let { data, error } = await supabase
      .from('medical_centers')
      .update(updates)
      .eq('id', id)
      .select();

    if (error && (error.message?.includes('status') || error.code === 'PGRST204')) {
      const { status: _, ...updatesWithoutStatus } = updates;
      if (Object.keys(updatesWithoutStatus).length > 0) {
        const retry = await supabase
          .from('medical_centers')
          .update(updatesWithoutStatus)
          .eq('id', id)
          .select();
        data = retry.data;
        error = retry.error;
      } else {
        error = null;
      }
    }

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const updated = data && data[0] ? mapDbCenterToPublic(data[0]) : { id, ...updates };

    res.json({ message: 'Center updated successfully', center: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteCenter(req, res, next) {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('medical_centers').delete().eq('id', id);
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ message: 'Center deleted successfully' });
  } catch (err) {
    next(err);
  }
}


