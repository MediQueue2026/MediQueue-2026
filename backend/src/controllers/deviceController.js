import { supabase } from '../config/supabase.js';
import crypto from 'crypto';

/** Generate random 6-character pairing code: MQ-XXXX */
function generatePairingCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = 'MQ-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/** Check if user has permission to manage devices for this center */
function checkCenterAccess(req, centerId) {
  if (!req.user) return 'Authentication required';
  if (req.user.role === 'admin') return null;
  if (req.user.role === 'receptionist' && req.user.centerId === centerId) return null;
  return 'You can only manage devices for your own medical center.';
}

/**
 * POST /devices/generate-code
 * Staff/Admin generates a temporary 6-char pairing code to link a TV or Kiosk screen
 */
export async function generateDevicePairingCode(req, res, next) {
  try {
    const { centerId, deviceName, deviceRole = 'tv_display', metadata = {} } = req.body;

    if (!centerId) {
      return res.status(400).json({ error: 'centerId is required' });
    }

    const authError = checkCenterAccess(req, centerId);
    if (authError) {
      return res.status(403).json({ error: authError });
    }

    const name = String(deviceName || '').trim() || `${deviceRole === 'tv_display' ? 'TV Screen' : 'Clinic Device'} (${new Date().toLocaleTimeString()})`;
    const code = generatePairingCode();

    const { data, error } = await supabase
      .from('center_devices')
      .insert([{
        center_id: centerId,
        device_name: name,
        device_role: deviceRole,
        pairing_code: code,
        is_active: true,
        metadata: metadata || {}
      }])
      .select()
      .single();

    if (error) {
      console.error('Failed to generate device pairing code:', error.message);
      return res.status(500).json({ error: `Could not generate pairing code: ${error.message}` });
    }

    res.json({
      message: 'Pairing code generated successfully',
      pairingCode: code,
      device: data,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /devices/pair
 * Called by TV screen or Reception PC browser with pairing code to obtain long-lived device_token
 */
export async function pairDevice(req, res, next) {
  try {
    const { pairingCode, metadata = {} } = req.body;

    if (!pairingCode) {
      return res.status(400).json({ error: 'pairingCode is required' });
    }

    const cleanCode = String(pairingCode).trim().toUpperCase();

    // Find device with active pairing code
    const { data: device, error: findError } = await supabase
      .from('center_devices')
      .select('*')
      .eq('pairing_code', cleanCode)
      .eq('is_active', true)
      .maybeSingle();

    if (findError) {
      return res.status(500).json({ error: `Database error: ${findError.message}` });
    }

    if (!device) {
      return res.status(404).json({ error: 'Invalid or expired pairing code. Please generate a new code from the staff panel.' });
    }

    // Lookup center name safely
    let centerName = 'Medical Center';
    if (device.center_id) {
      try {
        const { data: center } = await supabase
          .from('medical_centers')
          .select('id, name, city')
          .eq('id', device.center_id)
          .maybeSingle();
        if (center?.name) {
          centerName = center.name;
        }
      } catch (_) {}
    }

    // Generate persistent secure device token
    const deviceToken = `mq_dev_${crypto.randomBytes(24).toString('hex')}`;

    const { data: updated, error: updateError } = await supabase
      .from('center_devices')
      .update({
        device_token: deviceToken,
        pairing_code: null, // consume code
        last_heartbeat: new Date().toISOString(),
        metadata: {
          ...(device.metadata || {}),
          ...metadata,
          pairedAt: new Date().toISOString()
        }
      })
      .eq('id', device.id)
      .select('*')
      .single();

    if (updateError) {
      return res.status(500).json({ error: `Failed to pair device: ${updateError.message}` });
    }

    res.json({
      message: 'Device paired successfully',
      deviceToken,
      centerId: updated.center_id,
      centerName,
      deviceName: updated.device_name,
      deviceRole: updated.device_role
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /devices/center/:centerId
 * List devices enrolled for a medical center
 */
export async function getCenterDevices(req, res, next) {
  try {
    const { centerId } = req.params;

    const authError = checkCenterAccess(req, centerId);
    if (authError) {
      return res.status(403).json({ error: authError });
    }

    const { data, error } = await supabase
      .from('center_devices')
      .select('*')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false });

    if (error) {
      // Gracefully handle if migration 025 not yet executed
      console.warn('getCenterDevices notice:', error.message);
      return res.json({ devices: [] });
    }

    res.json({ devices: data || [] });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /devices/heartbeat
 * TV display / Kiosk sends heartbeat every 30-60 seconds to report online health
 */
export async function recordDeviceHeartbeat(req, res, next) {
  try {
    const deviceToken = req.body?.deviceToken || req.headers['x-device-token'];

    if (!deviceToken) {
      return res.status(400).json({ error: 'Device token required' });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('center_devices')
      .update({ last_heartbeat: now })
      .eq('device_token', deviceToken)
      .eq('is_active', true)
      .select('id, center_id, device_name, is_active')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    if (!data) {
      return res.status(401).json({ error: 'Unknown or inactive device token' });
    }

    res.json({
      status: 'healthy',
      lastHeartbeat: now,
      centerId: data.center_id
    });
  } catch (err) {
    next(err);
  }
}
