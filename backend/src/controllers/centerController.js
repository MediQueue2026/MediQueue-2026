import { supabase } from '../config/supabase.js';

function mapDbCenterToPublic(row) {
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

export async function getCenters(req, res, next) {
  try {
    const { data, error } = await supabase.from('medical_centers').select('*');
    if (error || !data || data.length === 0) {
      return res.json({
        centers: [
          { id: 'c1', name: 'MediQueue Central Clinic', city: 'Colombo 07', address: '124 Medical Plaza', opening_hours: '08:00 - 20:00', services: ['Cardiology', 'General Medicine', 'Pediatrics'], phone: '0112345678', status: 'operational' },
          { id: 'c2', name: 'MediQueue North Branch', city: 'Kandy', address: '45 Station Road', opening_hours: '09:00 - 18:00', services: ['Orthopedics', 'General Medicine'], phone: '0812345678', status: 'operational' }
        ]
      });
    }
    res.json({ centers: data.map(mapDbCenterToPublic) });
  } catch (err) {
    next(err);
  }
}

export async function createCenter(req, res, next) {
  try {
    const { name, city, address, openingHours, services, phone, status } = req.body;
    const { data, error } = await supabase.from('medical_centers').insert([
      {
        name,
        city,
        address: address || city,
        opening_hours: openingHours || '08:00 - 18:00',
        services: services || [],
        phone: phone || null,
        status: status || 'operational',
      }
    ]).select();

    if (error) throw error;
    res.status(201).json({ message: 'Center created', center: mapDbCenterToPublic(data[0]) });
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

    const { data, error } = await supabase.from('medical_centers')
      .update(updates)
      .eq('id', id)
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ message: 'Center updated', center: mapDbCenterToPublic(data[0]) });
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
