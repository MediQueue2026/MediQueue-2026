import { supabase } from '../config/supabase.js';

export async function getCenters(req, res, next) {
  try {
    const { data, error } = await supabase.from('medical_centers').select('*');
    if (error || !data || data.length === 0) {
      return res.json({
        centers: [
          { id: 'c1', name: 'MediQueue Central Clinic', city: 'Colombo 07', address: '124 Medical Plaza', hours: '08:00 - 20:00', services: ['Cardiology', 'General', 'Pediatrics'] },
          { id: 'c2', name: 'MediQueue North Branch', city: 'Kandy', address: '45 Station Road', hours: '09:00 - 18:00', services: ['Orthopedics', 'General'] }
        ]
      });
    }
    res.json({ centers: data });
  } catch (err) {
    next(err);
  }
}

export async function createCenter(req, res, next) {
  try {
    const { name, city, address, openingHours, services } = req.body;
    const { data, error } = await supabase.from('medical_centers').insert([
      { name, city, address: address || city, opening_hours: openingHours || '08:00 - 18:00', services: services || [] }
    ]).select();

    if (error) throw error;
    res.status(201).json({ message: 'Center created', center: data[0] });
  } catch (err) {
    next(err);
  }
}
