import { supabase } from '../config/supabase.js';
import { writeAuditLog } from '../services/auditService.js';
import bcrypt from 'bcryptjs';
import { notificationProvider } from '../config/notification.js';

/** Postgres/PostgREST codes meaning "that column doesn't exist on this DB yet". */
const MISSING_COLUMN_CODES = new Set(['PGRST204', '42703']);

function isMissingColumnError(error) {
  if (!error) return false;
  return MISSING_COLUMN_CODES.has(error.code) || /column/i.test(error.message || '');
}

function mapDbCenterToPublic(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    registrationNumber: row.registration_number ?? null,
    licenseStatus: row.license_status ?? null,
    city: row.city,
    province: row.province ?? null,
    address: row.address,
    latitude: row.latitude !== null && row.latitude !== undefined ? Number(row.latitude) : null,
    longitude: row.longitude !== null && row.longitude !== undefined ? Number(row.longitude) : null,
    opening_hours: row.opening_hours ?? row.hours ?? '08:00 - 18:00',
    services: row.services ?? [],
    phone: row.phone ?? null,
    email: row.email ?? null,
    website: row.website ?? null,
    imageUrl: row.image_url ?? null,
    status: row.status ?? 'operational',
    approvalStatus: row.approval_status ?? 'approved',
    requestedByName: row.requested_by_name ?? null,
    rejectionReason: row.rejection_reason ?? null,
    created_at: row.created_at ?? null,
    documents: Array.isArray(row.center_documents) ? row.center_documents.filter(d => d.document_type !== 'request_comment' && d.document_type !== 'admin_message').map(d => ({
      id: d.id,
      title: d.document_name,
      type: d.document_type,
      fileUrl: d.file_url,
      createdAt: d.created_at,
    })) : [],
    requestComment: Array.isArray(row.center_documents) ? row.center_documents.find(d => d.document_type === 'request_comment')?.document_name : null,
  };
}

/**
 * GET /centers
 * Public/receptionist-facing list — hides centers still pending (or rejected)
 * Super Admin approval so a newly requested facility can't be selected or
 * booked into before it's live. Pass ?includePending=true (Admin Panel) to see
 * everything, mirroring how GET /doctors exposes ?includePending.
 *
 * There is no fallback roster and no auto-seeding.
 *
 * This handler used to carry a `DEFAULT_CENTERS` pair — "MediQueue Central
 * Clinic, Colombo 07" and "MediQueue North Branch, Kandy", with plausible
 * addresses, phone numbers and coordinates. On any Supabase error it returned
 * them, and on an empty table it *inserted them into the live database* and
 * returned whatever came back; if that insert failed it returned them anyway,
 * unpersisted. So a fresh deployment silently acquired two clinics nobody
 * created, they showed as bookable pins on the patient map, and the
 * unpersisted variant appeared on first load and vanished on the next.
 * Creating a center is an admin action behind an approval flow — the read
 * endpoint must not invent one.
 */
export async function getCenters(req, res, next) {
  try {
    const includePending = req.query.includePending === 'true' || req.query.all === 'true';

    const { data, error } = await supabase
      .from('medical_centers')
      .select('*, center_documents(*)')
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Supabase query error on medical_centers:', error.message);
      return res.status(500).json({
        error: `Could not load medical centers: ${error.message}`,
        centers: [],
      });
    }

    // Only 'approved' centers are public. `approval_status` is checked
    // explicitly: on a database that predates the column it reads as
    // undefined, which is treated as NOT approved rather than assumed
    // approved, so a pending center can't leak into the bookable list.
    const visible = includePending
      ? (data ?? [])
      : (data ?? []).filter(c => c.approval_status === 'approved');

    res.json({ centers: visible.map(mapDbCenterToPublic) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /centers
 * A Super Admin creates a center directly (already approved). A receptionist
 * requesting a new center gets a 'pending' row instead — the facility only
 * becomes selectable/bookable once an admin approves it — and is linked to it
 * as the center's manager so their next login is gated on that approval.
 */
export async function createCenter(req, res, next) {
  try {
    const {
      name, registrationNumber, licenseStatus, city, province, address, openingHours,
      services, phone, email, website, status, latitude, longitude, requestComment,
      registrationDocument,
    } = req.body;

    if (!name || !city) {
      return res.status(400).json({ error: 'Facility Name and City are required.' });
    }

    const requesterRole = req.user?.role || 'receptionist';
    const requesterName = req.user?.fullName || req.user?.email || 'Receptionist';
    const isAdmin = requesterRole === 'admin';
    const approvalStatus = isAdmin ? 'approved' : 'pending';

    if (!isAdmin && (!registrationNumber || !licenseStatus || !address || !province || !phone)) {
      return res.status(400).json({
        error: 'Official name, registration number, license status, address, province, and official phone are required.',
      });
    }

    // A receptionist manages exactly one medical center. Check this up front
    // so a second request doesn't create an orphaned, unlinked 'pending' row.
    if (!isAdmin && req.user?.id) {
      const { data: existingUser, error: existingUserErr } = await supabase
        .from('users')
        .select('center_id, medical_centers(name, approval_status)')
        .eq('id', req.user.id)
        .maybeSingle();

      // If center_id (migration 005) isn't on this DB yet, there's nothing to
      // check against — fall through and let the request go ahead.
      if (existingUserErr && !isMissingColumnError(existingUserErr)) {
        return res.status(500).json({ error: existingUserErr.message });
      }

      if (existingUser?.center_id) {
        const existingCenter = existingUser.medical_centers;
        const statusNote = existingCenter?.approval_status === 'pending'
          ? ' (still awaiting Super Admin approval)'
          : existingCenter?.approval_status === 'rejected'
            ? ' (that request was rejected — contact your administrator)'
            : '';
        return res.status(409).json({
          error: `You already manage "${existingCenter?.name ?? 'a medical center'}"${statusNote}. A receptionist can only manage one medical center.`,
        });
      }
    }

    const cityCoordsMap = {
      'colombo': { lat: 6.9271, lng: 79.8612 },
      'kandy': { lat: 7.2906, lng: 80.6337 },
      'galle': { lat: 6.0535, lng: 80.2210 },
      'jaffna': { lat: 9.6615, lng: 80.0255 },
      'negombo': { lat: 7.2008, lng: 79.8737 },
      'kurunegala': { lat: 7.4863, lng: 80.3647 },
      'matara': { lat: 5.9549, lng: 80.5550 },
      'gampaha': { lat: 7.0840, lng: 79.9925 },
      'batticaloa': { lat: 7.7310, lng: 81.6747 },
      'trincomalee': { lat: 8.5874, lng: 81.2152 },
      'anuradhapura': { lat: 8.3114, lng: 80.4037 },
      'ratnapura': { lat: 6.6828, lng: 80.4016 },
    };
    const matchedCityKey = Object.keys(cityCoordsMap).find(k => (city || '').toLowerCase().includes(k));
    const fallbackCoords = matchedCityKey ? cityCoordsMap[matchedCityKey] : { lat: 6.9271, lng: 79.8612 };

    const parsedLat = latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : fallbackCoords.lat;
    const parsedLng = longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : fallbackCoords.lng;

    const payload = {
      name,
      registration_number: registrationNumber || null,
      license_status: licenseStatus || null,
      city,
      province: province || null,
      address: address || city,
      latitude: parsedLat,
      longitude: parsedLng,
      opening_hours: openingHours || '08:00 - 18:00',
      services: Array.isArray(services) ? services : (services ? [services] : []),
      phone: phone || null,
      email: email || null,
      website: website || null,
      status: status || 'operational',
      approval_status: approvalStatus,
      requested_by_name: requesterName,
    };

    console.log('[createCenter] Inserting with approval_status:', approvalStatus, '| user role:', requesterRole, '| user:', req.user?.email ?? 'unauthenticated');

    let { data, error } = await supabase
      .from('medical_centers')
      .insert([payload])
      .select();

    if (error && isMissingColumnError(error)) {
      // Retry dropping only `email` first — approval_status must survive this
      // fallback, or a receptionist-requested center would silently insert
      // with the DB's 'approved' default and skip moderation entirely.
      const { email: _e, ...withoutEmail } = payload;
      const emailRetry = await supabase.from('medical_centers').insert([withoutEmail]).select();
      data = emailRetry.data;
      error = emailRetry.error;

      if (error && isMissingColumnError(error)) {
        const { status: _s, requested_by_name: _r, ...minimalPayload } = withoutEmail;
        const retry = await supabase.from('medical_centers').insert([minimalPayload]).select();
        data = retry.data;
        error = retry.error;
        if (error && isMissingColumnError(error)) {
          return res.status(500).json({ error: "Missing 'approval_status' column in 'medical_centers'. Please run backend/src/db/patch_missing_migrations.sql in Supabase SQL Editor." });
        }
      }
    }

    if (error) {
      console.error('Failed to insert center into medical_centers table:', error);
      return res.status(500).json({ error: error.message });
    }

    const createdCenter = data && data[0] ? data[0] : null;

    if (registrationDocument && createdCenter?.id) {
      await supabase.from('center_documents').insert({
        center_id: createdCenter.id,
        document_type: registrationDocument.fileType || 'Registration Form',
        document_name: registrationDocument.fileName,
        file_url: registrationDocument.fileUrl
      });
    }

    if (requestComment && createdCenter?.id) {
      await supabase.from('center_documents').insert({
        center_id: createdCenter.id,
        document_type: 'request_comment',
        document_name: requestComment,
        file_url: 'none'
      });
    }

    const finalCenter = createdCenter ? mapDbCenterToPublic({ ...createdCenter }) : { ...payload, approvalStatus };

    // Link the requesting receptionist to the center they're setting up, as
    // its manager and sync the phone number to their user record.
    if (!isAdmin && req.user?.id && createdCenter?.id) {
      try {
        const updatePayload = {
          center_id: createdCenter.id,
          rejection_reason: null,
        };
        if (phone) {
          updatePayload.phone = String(phone).trim();
        }
        await supabase.from('users').update(updatePayload).eq('id', req.user.id);
      } catch (_) {
        // Non-critical — worst case the receptionist links manually via re-request.
      }
    }

    // When Admin creates the medical center directly:
    // Automatically create a receptionist account and dispatch SMS credentials
    let generatedCredentials = null;
    if (isAdmin && createdCenter?.id) {
      const plainPhone = phone ? String(phone).trim() : null;
      const cleanCenterName = (name || 'Medical Center').trim();
      const slug = cleanCenterName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
      const receptionistEmail = (email && email.includes('@'))
        ? email.trim()
        : `reception.${slug}.${Math.floor(100 + Math.random() * 900)}@mediqueue.lk`;
      const tempPassword = `MQ-Clinic#${Math.floor(1000 + Math.random() * 9000)}`;

      try {
        const { data: existingUser } = await supabase.from('users').select('id, password_hash').eq('email', receptionistEmail).maybeSingle();
        if (existingUser) {
          await supabase.from('users').update({
            password_hash: tempPassword,
            center_id: createdCenter.id,
            role: 'receptionist',
            phone: plainPhone || undefined,
          }).eq('id', existingUser.id);
        } else {
          await supabase.from('users').insert([{
            email: receptionistEmail,
            full_name: `${cleanCenterName} Receptionist`,
            phone: plainPhone,
            role: 'receptionist',
            password_hash: tempPassword,
            center_id: createdCenter.id,
          }]);
        }

        generatedCredentials = {
          email: receptionistEmail,
          password: tempPassword,
          phone: plainPhone,
        };

        if (plainPhone) {
          try {
            const smsText = `Welcome to MediQueue! ${cleanCenterName} has been created by System Admin. Receptionist Login Email: ${receptionistEmail} | Temporary Password: ${tempPassword}. Sign in at mediqueue.lk/login`;
            await notificationProvider.sendSMS(plainPhone, smsText);
          } catch (smsErr) {
            console.warn('[createCenter] Failed to dispatch receptionist SMS:', smsErr?.message);
          }
        }
      } catch (credErr) {
        console.warn('[createCenter] Error generating receptionist credentials:', credErr?.message);
      }
    }

    await writeAuditLog({
      actorName: requesterName,
      actorRole: requesterRole,
      eventType: 'center_edit',
      action: isAdmin
        ? `Created new medical center "${name}" in ${city} (credentials SMS dispatched)`
        : `Submitted request to add medical center "${name}" (${city})`,
      centerName: name,
      status: approvalStatus,
    });

    res.status(201).json({
      message: isAdmin
        ? 'Medical center created successfully and receptionist credentials generated'
        : 'Medical center request submitted to Super Admin for approval',
      center: finalCenter,
      credentials: generatedCredentials,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /centers/:id
 * A receptionist maintains their own center's public profile (photo,
 * location, contact number, opening hours, services); a Super Admin can
 * additionally change identity/compliance fields (city) and operational
 * status.
 */
export async function updateCenter(req, res, next) {
  try {
    const { id } = req.params;
    const isAdmin = req.user?.role === 'admin';

    // A receptionist may only maintain the one center they manage — without
    // this, guessing another center's id would let them overwrite its profile.
    if (req.user?.role === 'receptionist' && req.user?.centerId !== id) {
      return res.status(403).json({ error: 'You can only edit your own medical center profile.' });
    }

    const updates = {};

    if (typeof req.body.name === 'string') updates.name = req.body.name;
    if (typeof req.body.registrationNumber === 'string') updates.registration_number = req.body.registrationNumber;
    if (typeof req.body.licenseStatus === 'string') updates.license_status = req.body.licenseStatus;
    if (typeof req.body.province === 'string') updates.province = req.body.province;
    if (typeof req.body.city === 'string') updates.city = req.body.city;
    if (typeof req.body.address === 'string') updates.address = req.body.address;
    if (typeof req.body.openingHours === 'string') updates.opening_hours = req.body.openingHours;
    if (Array.isArray(req.body.services)) updates.services = req.body.services;
    if (typeof req.body.phone === 'string') updates.phone = req.body.phone;
    if (typeof req.body.email === 'string') updates.email = req.body.email;
    if (typeof req.body.website === 'string') updates.website = req.body.website;
    if (typeof req.body.imageUrl === 'string' || req.body.imageUrl === null) updates.image_url = req.body.imageUrl;
    if (req.body.latitude !== undefined && req.body.latitude !== null && Number.isFinite(Number(req.body.latitude))) {
      updates.latitude = Number(req.body.latitude);
    }
    if (req.body.longitude !== undefined && req.body.longitude !== null && Number.isFinite(Number(req.body.longitude))) {
      updates.longitude = Number(req.body.longitude);
    }
    if (typeof req.body.status === 'string') updates.status = req.body.status;

    if (Object.keys(updates).length === 0 && !req.body.registrationDocument) {
      return res.status(400).json({ error: 'No valid fields provided for update' });
    }

    let { data, error } = await supabase
      .from('medical_centers')
      .update(updates)
      .eq('id', id)
      .select();

    // Older databases predating a given migration (e.g. `image_url`, before
    // 015) reject the whole update on the missing column — drop columns one
    // at a time and retry so the fields that DO exist still get saved.
    while (error && isMissingColumnError(error) && Object.keys(updates).length > 0) {
      const missingKey = Object.keys(updates).find(k => (error.message || '').includes(k))
        ?? Object.keys(updates)[Object.keys(updates).length - 1];
      delete updates[missingKey];

      if (Object.keys(updates).length === 0) {
        error = null;
        data = [];
        break;
      }

      const retry = await supabase
        .from('medical_centers')
        .update(updates)
        .eq('id', id)
        .select();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const updated = data && data[0] ? mapDbCenterToPublic(data[0]) : { id, ...updates };

    if (isAdmin && typeof req.body.status === 'string' && req.body.status === 'maintenance') {
      await writeAuditLog({
        actorName: req.user?.fullName || req.user?.email || 'System Admin',
        actorRole: req.user?.role || 'admin',
        eventType: 'center_suspend',
        action: `Medical center suspended: ${updated.name || 'Center'}`,
        centerName: updated.name || 'Center',
        status: 'completed',
      });
    } else {
      await writeAuditLog({
        actorName: req.user?.fullName || req.user?.email || (isAdmin ? 'System Administrator' : 'Receptionist'),
        actorRole: req.user?.role || (isAdmin ? 'admin' : 'receptionist'),
        eventType: 'profile_updated',
        action: `Medical center profile updated: ${updated.name || 'Center'}`,
        centerName: updated.name || 'Center',
        status: 'completed',
      });
    }

    if (req.body.registrationDocument && req.body.registrationDocument.fileUrl) {
      try {
        await supabase.from('center_documents').insert([{
          center_id: id,
          document_type: req.body.registrationDocument.fileType || 'Registration Form',
          document_name: req.body.registrationDocument.fileName || 'Registration Document',
          file_url: req.body.registrationDocument.fileUrl
        }]);
      } catch (docErr) {
        console.warn('[updateCenter] Failed to save document:', docErr?.message);
      }
    }

    if (req.body.phone) {
      try {
        const cleanPhone = String(req.body.phone).trim();
        await supabase
          .from('users')
          .update({ phone: cleanPhone })
          .eq('center_id', id);
      } catch (phoneErr) {
        console.warn('[updateCenter] Failed to sync phone to user:', phoneErr?.message);
      }
    }

    res.json({ message: 'Center updated successfully', center: updated });
  } catch (err) {
    next(err);
  }
}

export async function deleteCenter(req, res, next) {
  try {
    const { id } = req.params;
    const { data: centerRow } = await supabase
      .from('medical_centers')
      .select('name')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase.from('medical_centers').delete().eq('id', id);
    if (error) {
      return res.status(500).json({ error: error.message });
    }

    await writeAuditLog({
      actorName: req.user?.fullName || req.user?.email || 'System Admin',
      actorRole: req.user?.role || 'admin',
      eventType: 'center_delete',
      action: `Medical center deleted: ${centerRow?.name || 'Unknown center'}`,
      centerName: centerRow?.name || 'Center',
      status: 'completed',
    });

    res.json({ message: 'Center deleted successfully' });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /centers/pending
 * Medical centers requested by receptionists, awaiting Super Admin approval.
 */
export async function getPendingCenters(req, res, next) {
  try {
    console.log('[getPendingCenters] Called by user:', req.user?.email, 'role:', req.user?.role);

    const { data, error } = await supabase
      .from('medical_centers')
      .select('*, center_documents(*)')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    console.log('[getPendingCenters] Query result — count:', data?.length ?? 0, 'error:', error?.message ?? 'none');
    if (data && data.length > 0) {
      console.log('[getPendingCenters] Rows:', data.map(c => ({ id: c.id, name: c.name, approval_status: c.approval_status })));
    }

    if (error) {
      if (isMissingColumnError(error)) {
        console.warn('[getPendingCenters] approval_status column MISSING — run patch_missing_migrations.sql!');
        return res.json({ pendingCenters: [] });
      }
      return res.status(500).json({ error: error.message });
    }

    res.json({ pendingCenters: (data || []).map(mapDbCenterToPublic) });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /centers/:id/approve
 * The center becomes visible/bookable, and the receptionist who requested it
 * can now sign in (see authService.login's receptionist center-approval gate).
 */
export async function approveCenter(req, res, next) {
  try {
    const { id } = req.params;

    const { data: updated, error } = await supabase
      .from('medical_centers')
      .update({ approval_status: 'approved' })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    let provisionedCredentials = null;
    // Auto-provision Receptionist User account for this center if email is provided
    if (updated.email) {
      try {
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, role')
          .eq('email', updated.email)
          .maybeSingle();

        if (!existingUser) {
          const initialPassword = `ClinicPass${Math.floor(1000 + Math.random() * 9000)}!`;
          // Hashing temporarily disabled for development & testing
          const passwordHash = initialPassword;
          const { data: newUser } = await supabase
            .from('users')
            .insert([{
              email: updated.email,
              full_name: updated.requested_by_name || `${updated.name} Receptionist`,
              phone: updated.phone || null,
              role: 'receptionist',
              center_id: updated.id,
              password_hash: passwordHash
            }])
            .select('id')
            .single();

          if (newUser) {
            provisionedCredentials = {
              email: updated.email,
              password: initialPassword,
              phone: updated.phone || null,
            };
            if (updated.phone) {
              await notificationProvider.sendSMS(
                updated.phone,
                `Medical Center "${updated.name}" approved! Receptionist Login Email: ${updated.email} | Password: ${initialPassword}. Sign in at Staff Portal.`
              );
            }
          }
        } else if (existingUser.role === 'receptionist') {
          await supabase.from('users').update({ center_id: updated.id }).eq('id', existingUser.id);
        }
      } catch (userProvisionErr) {
        console.warn('Receptionist provisioning notice:', userProvisionErr.message);
      }
    }

    const adminName = req.user?.fullName || req.user?.email || 'Super Admin';
    try {
      await supabase.from('audit_logs').insert([{
        actor_name: adminName,
        actor_role: 'admin',
        event_type: 'center_edit',
        action: `Approved medical center "${updated.name}" in ${updated.city}`,
        center_name: updated.name,
        status: 'approved',
      }]);
    } catch (_) {}

    res.json({
      message: 'Medical center approved successfully',
      center: mapDbCenterToPublic(updated),
      credentials: provisionedCredentials || null,
    });
  } catch (err) {
    next(err);
  }
}

// ── Per-date Center Closures (migration 012) ────────────────────────────────

const CLOSURE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date as YYYY-MM-DD (not UTC — `toISOString` would roll a
 *  late-evening request onto tomorrow). */
function localIsoDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mapClosure(row) {
  return {
    id: row.id,
    centerId: row.center_id,
    closedDate: row.closed_date,
    reason: row.reason ?? '',
    cancelledCount: row.cancelled_count ?? 0,
    notifiedCount: row.notified_count ?? 0,
    createdAt: row.created_at ?? null,
  };
}

/** A receptionist may only touch their own center's schedule; an admin, any. */
function closureAuthError(req, centerId) {
  if (req.user?.role === 'receptionist' && req.user?.centerId && req.user.centerId !== centerId) {
    return 'You can only change the schedule for your own medical center.';
  }
  return null;
}

/**
 * Cancel a set of already-fetched appointment rows and SMS each patient.
 * Mirrors the single-row logic in appointmentController.cancelAppointment
 * (status flip on both tables + a notification), batched.
 *
 * `appts` rows must carry `id, doctor_id, queue_number, patient_id,
 * patient:users!patient_id(full_name, phone)`. `buildMsg(row)` returns the SMS
 * body for that appointment.
 */
async function flipAndNotify(appts, centerId, date, buildMsg) {
  if (!appts || appts.length === 0) return { cancelledCount: 0, notifiedCount: 0 };

  const ids = appts.map(a => a.id);
  await supabase.from('appointments').update({ status: 'cancelled' }).in('id', ids);

  // Online bookings are mirrored into walk_in_queue by (doctor_id, queue_number).
  await Promise.all(appts.map(a =>
    supabase
      .from('walk_in_queue')
      .update({ status: 'left' })
      .eq('center_id', centerId)
      .eq('doctor_id', a.doctor_id)
      .eq('queue_number', a.queue_number)
      .eq('queue_date', date),
  ));

  // Patients with no phone on their user row: fall back to the emergency
  // contact on their profile (same precedence as createAppointment).
  const needProfile = [...new Set(appts.filter(a => !a.patient?.phone && a.patient_id).map(a => a.patient_id))];
  const profilePhone = new Map();
  if (needProfile.length > 0) {
    const { data: profs } = await supabase
      .from('patient_profiles')
      .select('user_id, emergency_contact_phone')
      .in('user_id', needProfile);
    for (const p of profs || []) {
      if (p.emergency_contact_phone) profilePhone.set(p.user_id, p.emergency_contact_phone);
    }
  }

  let notifiedCount = 0;
  for (const a of appts) {
    const phone = a.patient?.phone || profilePhone.get(a.patient_id) || null;
    if (!phone) continue;
    notifiedCount++;
    try {
      await notificationProvider.sendSMS(phone, buildMsg(a));
    } catch (e) {
      console.warn('[SCHEDULE SMS NOTICE]', e);
    }
  }

  return { cancelledCount: ids.length, notifiedCount };
}

const APPT_SELECT = 'id, doctor_id, queue_number, slot_hour, patient_id, patient:users!patient_id(full_name, phone)';
const ACTIVE_APPT_STATUSES = ['booked', 'waiting', 'in_consultation'];

/** Whole-day cancel for a center closure (migration 012). */
async function cancelAppointmentsForClosure(centerId, date, centerName, reason) {
  const { data: appts, error } = await supabase
    .from('appointments')
    .select(APPT_SELECT)
    .eq('center_id', centerId)
    .eq('appointment_date', date)
    .in('status', ACTIVE_APPT_STATUSES);
  if (error) return { cancelledCount: 0, notifiedCount: 0 };

  return flipAndNotify(appts, centerId, date, a =>
    `MediQueue: ${centerName || 'Medical Center'} is CLOSED on ${date}${reason ? ` due to ${reason}` : ''}. Your appointment (Token #${a.queue_number}) is cancelled. Please re-book at mediqueue.lk.`,
  );
}

/**
 * Cancel a doctor's appointments on `date` that no longer fit a date-specific
 * hours override (migration 014). Off that day ⇒ all of them; otherwise only
 * those whose slot_hour is outside [startHour, endHour).
 */
async function cancelDoctorAppointmentsForOverride(centerId, doctorId, date, centerName, { isWorking, startHour, endHour }) {
  const { data: appts, error } = await supabase
    .from('appointments')
    .select(APPT_SELECT)
    .eq('center_id', centerId)
    .eq('doctor_id', doctorId)
    .eq('appointment_date', date)
    .in('status', ACTIVE_APPT_STATUSES);
  if (error || !appts) return { cancelledCount: 0, notifiedCount: 0 };

  const doomed = isWorking === false
    ? appts
    : appts.filter(a => Number(a.slot_hour) < startHour || Number(a.slot_hour) >= endHour);

  return flipAndNotify(doomed, centerId, date, a =>
    isWorking === false
      ? `MediQueue Notice: Your doctor at ${centerName || 'the medical center'} is not working on ${date}. Your appointment (Token #${a.queue_number}) has been cancelled — please re-book another day.`
      : `MediQueue Notice: Your doctor's hours at ${centerName || 'the medical center'} on ${date} changed to ${pad2(startHour)}:00–${pad2(endHour)}:00. Your appointment (Token #${a.queue_number}) fell outside them and has been cancelled — please re-book.`,
  );
}

/** '9' -> '09'. */
function pad2(n) { return String(n).padStart(2, '0'); }

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const hourOf = (hhmm) => parseInt(String(hhmm || '').slice(0, 2), 10);

function mapCenterDateHours(row) {
  return {
    id: row.id,
    centerId: row.center_id,
    openDate: row.open_date,
    hoursLabel: row.hours_label ?? '',
    note: row.note ?? '',
  };
}
function mapDoctorDateHours(row) {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    centerId: row.center_id,
    workDate: row.work_date,
    isWorking: row.is_working !== false,
    startTime: row.start_time ?? null,
    endTime: row.end_time ?? null,
    cancelledCount: row.cancelled_count ?? 0,
    notifiedCount: row.notified_count ?? 0,
  };
}

/**
 * GET /centers/:centerId/closures
 * Upcoming closed dates for one center. Unauthenticated, like GET /centers —
 * the patient booking modal reads this to grey out closed days.
 * `?all=true` includes past closures too (unused by the UI, handy for support).
 */
export async function getCenterClosures(req, res, next) {
  try {
    const { centerId } = req.params;
    const from = req.query.all === 'true' ? '1900-01-01' : localIsoDate();

    const { data, error } = await supabase
      .from('center_closures')
      .select('*')
      .eq('center_id', centerId)
      .gte('closed_date', from)
      .order('closed_date', { ascending: true });

    if (error) {
      // Table not migrated yet, etc. — degrade to "no closures" rather than 500,
      // matching how the other reads here handle a missing column/table.
      console.warn('getCenterClosures notice:', error.message);
      return res.json({ closures: [] });
    }

    res.json({ closures: (data || []).map(mapClosure) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /centers/:centerId/closures  { date, reason }
 * Marks a calendar day closed. Auto-cancels that day's still-active
 * appointments and SMSes the patients. Idempotent — a repeat call for a day
 * that's already closed returns the existing row and cancels nothing more.
 */
export async function createCenterClosure(req, res, next) {
  try {
    const { centerId } = req.params;
    const { date, reason } = req.body;

    if (!CLOSURE_DATE_RE.test(String(date || ''))) {
      return res.status(400).json({ error: 'A closure date (YYYY-MM-DD) is required.' });
    }
    if (String(date) < localIsoDate()) {
      return res.status(400).json({ error: 'You can only close today or a future date.' });
    }

    const authErr = closureAuthError(req, centerId);
    if (authErr) return res.status(403).json({ error: authErr });

    const { data: center } = await supabase
      .from('medical_centers')
      .select('id, name')
      .eq('id', centerId)
      .maybeSingle();
    if (!center) return res.status(404).json({ error: 'That medical center no longer exists.' });

    const cleanReason = String(reason || '').trim().slice(0, 200);

    const { data: existing } = await supabase
      .from('center_closures')
      .select('*')
      .eq('center_id', centerId)
      .eq('closed_date', date)
      .maybeSingle();
    if (existing) {
      return res.json({
        closure: mapClosure(existing),
        cancelledCount: existing.cancelled_count ?? 0,
        notifiedCount: existing.notified_count ?? 0,
        alreadyClosed: true,
      });
    }

    const { cancelledCount, notifiedCount } =
      await cancelAppointmentsForClosure(centerId, date, center.name, cleanReason);

    const { data: inserted, error: insErr } = await supabase
      .from('center_closures')
      .insert([{
        center_id: centerId,
        closed_date: date,
        reason: cleanReason,
        cancelled_count: cancelledCount,
        notified_count: notifiedCount,
        created_by_name: req.user?.fullName || req.user?.email || 'Receptionist',
        created_by_role: req.user?.role === 'admin' ? 'admin' : 'receptionist',
      }])
      .select()
      .maybeSingle();

    if (insErr || !inserted) {
      return res.status(500).json({ error: insErr?.message || 'Could not save this closure.' });
    }

    await writeAuditLog({
      actorName: req.user?.fullName || req.user?.email || 'Receptionist',
      actorRole: req.user?.role || 'receptionist',
      eventType: 'center_edit',
      action: `Marked "${center.name}" closed on ${date}${cleanReason ? ` (${cleanReason})` : ''} — ${cancelledCount} appointment(s) cancelled, ${notifiedCount} patient(s) notified`,
      centerName: center.name,
      status: 'completed',
    });

    // Send SMS notice to doctors registered/assigned to this medical center
    try {
      const { data: assignments } = await supabase
        .from('doctor_center_assignments')
        .select('doctor_id, doctor:doctors(id, user_id, user:users(phone, full_name))')
        .eq('center_id', centerId);

      // Also directly lookup any doctors associated with the center if user_id links directly
      const { data: centerDocs } = await supabase
        .from('doctors')
        .select('id, user_id, user:users(phone, full_name)')
        .eq('center_id', centerId);
      
      const docMsg = `MediQueue: ${center.name} is CLOSED on ${date}${cleanReason ? ` due to ${cleanReason}` : ''}. No clinic sessions on this date. Details at mediqueue.lk.`;
      const sentDocPhones = new Set();
      const allDoctors = [...(assignments?.map(a => a.doctor) || []), ...(centerDocs || [])];

      for (const doc of allDoctors) {
        if (!doc) continue;
        const docPhone = doc.phone || doc.user?.phone;
        if (docPhone && !sentDocPhones.has(docPhone)) {
          sentDocPhones.add(docPhone);
          try {
            await notificationProvider.sendSMS(docPhone, docMsg);
          } catch (smsErr) {
            console.warn('[DOCTOR CLOSURE SMS NOTICE ERROR]', smsErr);
          }
        }
      }
    } catch (docNotifyErr) {
      console.warn('[DOCTOR CLOSURE NOTIFY ERROR]', docNotifyErr);
    }

    // Optionally post to center_notices if requested so it appears on Patient Portal
    if (req.body.postToNotices) {
      try {
        await supabase.from('center_notices').insert([{
          center_id: centerId,
          title: `Center Closed on ${date}`,
          message: cleanReason
            ? `Please note that our medical center will be closed on ${date} (${cleanReason}). Appointments cannot be booked on this date.`
            : `Please note that our medical center will be closed on ${date}. Appointments cannot be booked on this date.`,
          created_by: req.user?.id || null,
        }]);
      } catch (noticeInsertErr) {
        console.warn('[CENTER NOTICE AUTO-POST ERROR]', noticeInsertErr);
      }
    }

    res.status(201).json({ closure: mapClosure(inserted), cancelledCount, notifiedCount });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /centers/:centerId/closures/:date
 * Re-opens a closed day for new bookings. Does NOT restore appointments that
 * were cancelled when the day was closed — those patients must re-book.
 */
export async function deleteCenterClosure(req, res, next) {
  try {
    const { centerId, date } = req.params;

    const authErr = closureAuthError(req, centerId);
    if (authErr) return res.status(403).json({ error: authErr });

    const { data: center } = await supabase
      .from('medical_centers')
      .select('name')
      .eq('id', centerId)
      .maybeSingle();

    const { error } = await supabase
      .from('center_closures')
      .delete()
      .eq('center_id', centerId)
      .eq('closed_date', date);
    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog({
      actorName: req.user?.fullName || req.user?.email || 'Receptionist',
      actorRole: req.user?.role || 'receptionist',
      eventType: 'center_edit',
      action: `Re-opened "${center?.name || 'medical center'}" on ${date} for new bookings`,
      centerName: center?.name || 'Center',
      status: 'completed',
    });

    res.json({
      message: `${date} re-opened for new bookings. Appointments already cancelled were not restored.`,
    });
  } catch (err) {
    next(err);
  }
}

// ── Notices & Promotions (migration 016) ────────────────────────────────────

function mapNotice(row) {
  return {
    id: row.id,
    centerId: row.center_id,
    title: row.title,
    message: row.message,
    imageUrl: row.image_url ?? null,
    createdAt: row.created_at,
  };
}

/**
 * GET /centers/:centerId/notices
 * Public, like getCenterClosures — patients read a center's notices without
 * being signed in. Degrades to an empty list rather than 500 on a database
 * that predates migration 016.
 */
export async function getCenterNotices(req, res, next) {
  try {
    const { centerId } = req.params;
    const { data, error } = await supabase
      .from('center_notices')
      .select('*')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('getCenterNotices notice:', error.message);
      return res.json({ notices: [] });
    }

    res.json({ notices: (data || []).map(mapNotice) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /centers/:centerId/notices  { title, message, imageUrl? }
 * A receptionist posts a notice/promotion for their own center; an admin may
 * post to any center. The image is optional — upload it first via /uploads
 * and pass the resulting URL.
 */
export async function createCenterNotice(req, res, next) {
  try {
    const { centerId } = req.params;
    const authErr = closureAuthError(req, centerId);
    if (authErr) return res.status(403).json({ error: authErr });

    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    if (!title || !message) {
      return res.status(400).json({ error: 'A title and message are required.' });
    }

    const { data: center } = await supabase
      .from('medical_centers')
      .select('id, name')
      .eq('id', centerId)
      .maybeSingle();
    if (!center) return res.status(404).json({ error: 'That medical center no longer exists.' });

    const { data, error } = await supabase
      .from('center_notices')
      .insert([{
        center_id: centerId,
        title,
        message,
        image_url: req.body.imageUrl || null,
        created_by: req.user?.id || null,
      }])
      .select();
    if (error) return res.status(500).json({ error: error.message });

    await writeAuditLog({
      actorName: req.user?.fullName || req.user?.email || 'Receptionist',
      actorRole: req.user?.role || 'receptionist',
      eventType: 'center_edit',
      action: `Posted notice "${title}" for ${center.name}`,
      centerName: center.name,
      status: 'completed',
    });

    res.status(201).json({ message: 'Notice posted', notice: mapNotice(data[0]) });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /centers/:centerId/notices/:noticeId
 * Receptionist may only remove notices from their own center.
 */
export async function deleteCenterNotice(req, res, next) {
  try {
    const { centerId, noticeId } = req.params;
    const authErr = closureAuthError(req, centerId);
    if (authErr) return res.status(403).json({ error: authErr });

    const { error } = await supabase
      .from('center_notices')
      .delete()
      .eq('id', noticeId)
      .eq('center_id', centerId);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: 'Notice removed' });
  } catch (err) {
    next(err);
  }
}

// ── Date-specific hours (migration 014) ─────────────────────────────────────

/**
 * GET /centers/:centerId/day-hours
 * Upcoming per-date overrides for one center: `{ centerHours, doctorHours }`.
 * Unauthenticated like getCenterClosures — the booking modal reads doctorHours
 * to shape slots and centerHours to show the label. Degrades to empty arrays.
 */
export async function getCenterDayHours(req, res, next) {
  try {
    const { centerId } = req.params;
    const from = req.query.all === 'true' ? '1900-01-01' : localIsoDate();

    const [ch, dh] = await Promise.all([
      supabase.from('center_date_hours').select('*').eq('center_id', centerId).gte('open_date', from).order('open_date', { ascending: true }),
      supabase.from('doctor_date_hours').select('*').eq('center_id', centerId).gte('work_date', from).order('work_date', { ascending: true }),
    ]);
    if (ch.error) console.warn('getCenterDayHours center notice:', ch.error.message);
    if (dh.error) console.warn('getCenterDayHours doctor notice:', dh.error.message);

    res.json({
      centerHours: (ch.data || []).map(mapCenterDateHours),
      doctorHours: (dh.data || []).map(mapDoctorDateHours),
    });
  } catch (err) {
    next(err);
  }
}

/** PUT /centers/:centerId/center-hours  { date, hoursLabel, note } — display-only label. */
export async function putCenterDateHours(req, res, next) {
  try {
    const { centerId } = req.params;
    const { date, hoursLabel, note } = req.body;

    if (!CLOSURE_DATE_RE.test(String(date || ''))) {
      return res.status(400).json({ error: 'A date (YYYY-MM-DD) is required.' });
    }
    if (String(date) < localIsoDate()) {
      return res.status(400).json({ error: 'You can only set hours for today or a future date.' });
    }
    const authErr = closureAuthError(req, centerId);
    if (authErr) return res.status(403).json({ error: authErr });

    const row = {
      center_id: centerId,
      open_date: date,
      hours_label: String(hoursLabel || '').trim().slice(0, 60),
      note: String(note || '').trim().slice(0, 200),
      created_by_name: req.user?.fullName || req.user?.email || 'Receptionist',
    };
    const { data, error } = await supabase
      .from('center_date_hours')
      .upsert(row, { onConflict: 'center_id,open_date' })
      .select()
      .maybeSingle();
    if (error || !data) return res.status(500).json({ error: error?.message || 'Could not save these hours.' });

    res.json({ centerHours: mapCenterDateHours(data) });
  } catch (err) {
    next(err);
  }
}

/** DELETE /centers/:centerId/center-hours/:date — revert to the center default. */
export async function deleteCenterDateHours(req, res, next) {
  try {
    const { centerId, date } = req.params;
    const authErr = closureAuthError(req, centerId);
    if (authErr) return res.status(403).json({ error: authErr });

    const { error } = await supabase
      .from('center_date_hours')
      .delete()
      .eq('center_id', centerId)
      .eq('open_date', date);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: `${date} reverted to the center's usual opening hours.` });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /centers/:centerId/doctor-hours
 * body { doctorId, date, isWorking, startTime, endTime }
 * Overrides one doctor's hours for one date. Cancels + SMSes that doctor's
 * appointments on that date that no longer fit.
 */
export async function putDoctorDateHours(req, res, next) {
  try {
    const { centerId } = req.params;
    const { doctorId, date, isWorking, startTime, endTime } = req.body;

    if (!doctorId || !CLOSURE_DATE_RE.test(String(date || ''))) {
      return res.status(400).json({ error: 'doctorId and a date (YYYY-MM-DD) are required.' });
    }
    if (String(date) < localIsoDate()) {
      return res.status(400).json({ error: 'You can only set hours for today or a future date.' });
    }
    const authErr = closureAuthError(req, centerId);
    if (authErr) return res.status(403).json({ error: authErr });

    const working = isWorking !== false;
    let start = null;
    let end = null;
    if (working) {
      if (!HHMM_RE.test(String(startTime || '')) || !HHMM_RE.test(String(endTime || ''))) {
        return res.status(400).json({ error: 'Start and end must be HH:MM times.' });
      }
      if (String(startTime) >= String(endTime)) {
        return res.status(400).json({ error: 'End time must be after start time.' });
      }
      start = startTime;
      end = endTime;
    }

    const { data: center } = await supabase
      .from('medical_centers').select('name').eq('id', centerId).maybeSingle();

    const { cancelledCount, notifiedCount } = await cancelDoctorAppointmentsForOverride(
      centerId, doctorId, date, center?.name,
      { isWorking: working, startHour: hourOf(start), endHour: hourOf(end) },
    );

    const row = {
      doctor_id: doctorId,
      center_id: centerId,
      work_date: date,
      is_working: working,
      start_time: start,
      end_time: end,
      cancelled_count: cancelledCount,
      notified_count: notifiedCount,
      created_by_name: req.user?.fullName || req.user?.email || 'Receptionist',
    };
    const { data, error } = await supabase
      .from('doctor_date_hours')
      .upsert(row, { onConflict: 'doctor_id,center_id,work_date' })
      .select()
      .maybeSingle();
    if (error || !data) return res.status(500).json({ error: error?.message || 'Could not save these hours.' });

    await writeAuditLog({
      actorName: req.user?.fullName || req.user?.email || 'Receptionist',
      actorRole: req.user?.role || 'receptionist',
      eventType: 'center_edit',
      action: `Set date-specific hours for a doctor at "${center?.name || 'center'}" on ${date}: ${working ? `${start}–${end}` : 'not working'} — ${cancelledCount} cancelled, ${notifiedCount} notified`,
      centerName: center?.name || 'Center',
      status: 'completed',
    });

    res.json({ doctorHours: mapDoctorDateHours(data), cancelledCount, notifiedCount });
  } catch (err) {
    next(err);
  }
}

/** DELETE /centers/:centerId/doctor-hours/:doctorId/:date — revert to weekly hours. */
export async function deleteDoctorDateHours(req, res, next) {
  try {
    const { centerId, doctorId, date } = req.params;
    const authErr = closureAuthError(req, centerId);
    if (authErr) return res.status(403).json({ error: authErr });

    const { error } = await supabase
      .from('doctor_date_hours')
      .delete()
      .eq('center_id', centerId)
      .eq('doctor_id', doctorId)
      .eq('work_date', date);
    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: `${date} reverted to the doctor's usual weekly hours.` });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /centers/:id/reject
 */
export async function rejectCenter(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Rejection is destructive for an unapproved request: remove the center
    // row, and let center_documents' ON DELETE CASCADE remove its uploads.
    // Never allow this endpoint to delete an already-approved center.
    const { data: pendingCenter, error: lookupError } = await supabase
      .from('medical_centers')
      .select('id, name, city, approval_status')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      return res.status(500).json({ error: lookupError.message });
    }
    if (!pendingCenter) {
      return res.status(404).json({ error: 'Medical center not found' });
    }
    if (pendingCenter.approval_status !== 'pending') {
      return res.status(409).json({ error: 'Only pending medical center requests can be rejected.' });
    }

    const adminName = req.user?.fullName || req.user?.email || 'Super Admin';
    try {
      await supabase.from('audit_logs').insert([{
        actor_name: adminName,
        actor_role: 'admin',
        event_type: 'center_edit',
        action: `Rejected and deleted medical center "${pendingCenter.name}" (${reason || 'No reason provided'})`,
        center_name: pendingCenter.name,
        status: 'rejected',
      }]);
    } catch (_) {}

    // Keep the receptionist account so they can see the rejection reason and
    // submit corrected center details without registering again.
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({
        center_id: null,
        rejection_reason: reason || 'Rejected by Admin',
      })
      .eq('center_id', id)
      .eq('role', 'receptionist');

    if (userUpdateError) {
      return res.status(500).json({ error: userUpdateError.message });
    }

    const { error: deleteError } = await supabase
      .from('medical_centers')
      .delete()
      .eq('id', id)
      .eq('approval_status', 'pending');

    if (deleteError) {
      return res.status(500).json({ error: deleteError.message });
    }

    res.json({
      message: 'Medical center request rejected and deleted',
      centerId: id,
      approvalStatus: 'deleted',
      reason: reason || 'Rejected by Admin',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /centers/:centerId/messages
 * A medical center / receptionist sends an inquiry/payment message, OR a System Admin replies.
 */
export async function createCenterMessage(req, res, next) {
  try {
    const { centerId } = req.params;
    const { title, message, attachmentUrl, attachmentName, category = 'general', parentId = null } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message content is required.' });
    }

    const { data: center, error: centerErr } = await supabase
      .from('medical_centers')
      .select('id, name')
      .eq('id', centerId)
      .maybeSingle();

    if (centerErr || !center) {
      return res.status(404).json({ error: 'Medical center not found.' });
    }

    const senderRole = req.user?.role === 'admin' ? 'admin' : 'receptionist';
    const senderName = req.user?.fullName || req.user?.email || (senderRole === 'admin' ? 'System Admin' : 'Receptionist');
    const msgCategory = category === 'payment' ? 'payment' : 'general';

    // 1. Try inserting into dedicated center_admin_messages table
    const { data: msgData, error: msgErr } = await supabase
      .from('center_admin_messages')
      .insert([{
        center_id: centerId,
        center_name: center.name,
        sender_role: senderRole,
        category: msgCategory,
        title: title ? String(title).trim() : (senderRole === 'admin' ? 'Admin Reply' : 'Inquiry'),
        message: String(message).trim(),
        attachment_url: attachmentUrl || null,
        attachment_name: attachmentName || null,
        parent_id: parentId || null,
        is_read: false,
      }])
      .select();

    if (!msgErr && msgData && msgData.length > 0) {
      await writeAuditLog({
        actorName: senderName,
        actorRole: senderRole,
        eventType: 'center_edit',
        action: senderRole === 'admin' ? `Admin replied to center: "${center.name}"` : `Sent message to System Admin: "${title || 'Inquiry'}"`,
        centerName: center.name,
        status: 'completed',
      });

      return res.status(201).json({
        message: 'Message sent successfully.',
        data: msgData[0],
      });
    }

    // 2. Fallback to center_documents if migration has not been applied yet
    console.warn('[createCenterMessage] center_admin_messages unavailable, using fallback:', msgErr?.message);
    const payloadName = JSON.stringify({
      title: title ? String(title).trim() : (senderRole === 'admin' ? 'Admin Reply' : 'Inquiry'),
      message: String(message).trim(),
      attachmentName: attachmentName || null,
      senderName,
      senderRole,
      category: msgCategory,
      parentId: parentId || null,
      isRead: false,
    });

    const { data: docData, error: docErr } = await supabase
      .from('center_documents')
      .insert([{
        center_id: centerId,
        document_type: 'admin_message',
        document_name: payloadName,
        file_url: attachmentUrl || 'none',
      }])
      .select();

    if (docErr) return res.status(500).json({ error: docErr.message });

    res.status(201).json({
      message: 'Message sent successfully.',
      data: docData[0],
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Backward compatibility alias for POST /centers/:centerId/messages-to-admin
 */
export const createCenterMessageToAdmin = createCenterMessage;

/**
 * GET /centers/:centerId/messages
 * Receptionist / Admin fetches the conversation history for a specific center.
 */
export async function getCenterConversation(req, res, next) {
  try {
    const { centerId } = req.params;
    const { category } = req.query;

    // 1. Try center_admin_messages table first
    let query = supabase
      .from('center_admin_messages')
      .select('*')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (!error && data) {
      const repliesMap = new Map();
      const topLevel = [];

      data.forEach(row => {
        const item = {
          id: row.id,
          centerId: row.center_id,
          senderRole: row.sender_role,
          senderName: row.sender_name || (row.sender_role === 'admin' ? 'System Admin' : 'Receptionist'),
          category: row.category,
          title: row.title,
          message: row.message,
          attachmentUrl: row.attachment_url,
          attachmentName: row.attachment_name,
          parentId: row.parent_id,
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
          replies: [],
        };

        if (row.parent_id) {
          if (!repliesMap.has(row.parent_id)) {
            repliesMap.set(row.parent_id, []);
          }
          repliesMap.get(row.parent_id).push(item);
        } else {
          topLevel.push(item);
        }
      });

      topLevel.forEach(item => {
        item.replies = (repliesMap.get(item.id) || []).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      return res.json({ messages: topLevel });
    }

    // 2. Fallback to center_documents
    const { data: docData, error: docErr } = await supabase
      .from('center_documents')
      .select('id, center_id, document_type, document_name, file_url, created_at')
      .eq('center_id', centerId)
      .eq('document_type', 'admin_message')
      .order('created_at', { ascending: false });

    if (docErr) return res.status(500).json({ error: docErr.message });

    const repliesMap = new Map();
    const topLevel = [];

    (docData || []).forEach(row => {
      let parsed = { title: 'Inquiry', message: '', attachmentName: null, senderName: 'Receptionist', senderRole: 'receptionist', isRead: true };
      try {
        parsed = JSON.parse(row.document_name);
      } catch (_) {
        parsed.title = row.document_name;
      }
      const item = {
        id: row.id,
        centerId: row.center_id,
        senderRole: parsed.senderRole || 'receptionist',
        senderName: parsed.senderName || 'Receptionist',
        category: parsed.category || 'general',
        title: parsed.title || 'Inquiry',
        message: parsed.message || row.document_name,
        attachmentName: parsed.attachmentName,
        attachmentUrl: row.file_url !== 'none' ? row.file_url : null,
        parentId: parsed.parentId || null,
        isRead: Boolean(parsed.isRead),
        createdAt: row.created_at,
        replies: [],
      };

      if (item.parentId) {
        if (!repliesMap.has(item.parentId)) {
          repliesMap.set(item.parentId, []);
        }
        repliesMap.get(item.parentId).push(item);
      } else {
        topLevel.push(item);
      }
    });

    topLevel.forEach(item => {
      item.replies = (repliesMap.get(item.id) || []).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    });

    res.json({ messages: topLevel });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /centers/admin-messages
 * System Admin fetches all incoming inquiries and uploads sent by medical centers.
 */
export async function getCenterMessagesToAdmin(req, res, next) {
  try {
    // 1. Try center_admin_messages first
    let { data, error } = await supabase
      .from('center_admin_messages')
      .select('*, medical_centers(name, city, email, phone)')
      .order('created_at', { ascending: false });

    // If relation join failed in PostgREST, fallback to plain select('*')
    if (error) {
      const fallbackQuery = await supabase
        .from('center_admin_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (!fallbackQuery.error && fallbackQuery.data) {
        data = fallbackQuery.data;
        error = null;
      }
    }

    if (!error && data) {
      // Separate top-level messages from replies
      const topLevel = [];
      const repliesMap = new Map();

      data.forEach(row => {
        const item = {
          id: row.id,
          centerId: row.center_id,
          centerName: row.center_name || row.medical_centers?.name || 'Medical Center',
          centerCity: row.medical_centers?.city,
          centerEmail: row.medical_centers?.email,
          centerPhone: row.medical_centers?.phone,
          senderRole: row.sender_role,
          senderName: row.sender_name || (row.sender_role === 'admin' ? 'System Admin' : 'Receptionist'),
          category: row.category,
          title: row.title,
          message: row.message,
          attachmentName: row.attachment_name,
          attachmentUrl: row.attachment_url,
          parentId: row.parent_id,
          isRead: Boolean(row.is_read),
          createdAt: row.created_at,
          replies: [],
        };

        if (row.parent_id) {
          if (!repliesMap.has(row.parent_id)) {
            repliesMap.set(row.parent_id, []);
          }
          repliesMap.get(row.parent_id).push(item);
        } else {
          topLevel.push(item);
        }
      });

      // Attach replies to their parent inquiry
      topLevel.forEach(item => {
        item.replies = (repliesMap.get(item.id) || []).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });

      return res.json({ messages: topLevel });
    }

    // 2. Fallback to center_documents
    const { data: docData, error: docErr } = await supabase
      .from('center_documents')
      .select('id, center_id, document_type, document_name, file_url, created_at, medical_centers(name, city, email, phone)')
      .eq('document_type', 'admin_message')
      .order('created_at', { ascending: false });

    if (docErr) return res.status(500).json({ error: docErr.message });

    const messages = (docData || []).map(row => {
      let parsed = { title: 'Inquiry', message: '', attachmentName: null, senderName: 'Receptionist', senderRole: 'receptionist', isRead: false };
      try {
        parsed = JSON.parse(row.document_name);
      } catch (_) {
        parsed.title = row.document_name;
      }
      return {
        id: row.id,
        centerId: row.center_id,
        centerName: row.medical_centers?.name || 'Medical Center',
        centerCity: row.medical_centers?.city,
        centerEmail: row.medical_centers?.email,
        centerPhone: row.medical_centers?.phone,
        senderRole: parsed.senderRole || 'receptionist',
        senderName: parsed.senderName || 'Receptionist',
        category: parsed.category || 'general',
        title: parsed.title || 'Inquiry',
        message: parsed.message || row.document_name,
        attachmentName: parsed.attachmentName,
        attachmentUrl: row.file_url !== 'none' ? row.file_url : null,
        parentId: parsed.parentId || null,
        isRead: Boolean(parsed.isRead),
        createdAt: row.created_at,
        replies: [],
      };
    });

    res.json({ messages });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /centers/messages/:messageId/read
 * Mark an inquiry or reply as read.
 */
export async function markCenterMessageRead(req, res, next) {
  try {
    const { messageId } = req.params;
    const isRead = req.body?.isRead !== undefined ? Boolean(req.body.isRead) : true;

    // 1. Try center_admin_messages
    const { data, error } = await supabase
      .from('center_admin_messages')
      .update({ is_read: isRead, read_at: isRead ? new Date().toISOString() : null })
      .eq('id', messageId)
      .select();

    if (!error && data && data.length > 0) {
      return res.json({ success: true, message: `Message marked as ${isRead ? 'read' : 'unread'}.`, data: data[0] });
    }

    // 2. Fallback to center_documents
    const { data: doc, error: docErr } = await supabase
      .from('center_documents')
      .select('id, document_name')
      .eq('id', messageId)
      .maybeSingle();

    if (docErr || !doc) {
      return res.json({ success: true, message: 'Message state updated.' });
    }

    try {
      const parsed = JSON.parse(doc.document_name);
      parsed.isRead = isRead;
      await supabase
        .from('center_documents')
        .update({ document_name: JSON.stringify(parsed) })
        .eq('id', messageId);
    } catch (_) {}

    res.json({ success: true, message: `Message marked as ${isRead ? 'read' : 'unread'}.` });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /centers/admin-messages/unread-count
 * Returns count of unread incoming inquiries for the System Admin sidebar badge.
 */
export async function getAdminMessagesUnreadCount(req, res, next) {
  try {
    // 1. Try center_admin_messages
    const { count, error } = await supabase
      .from('center_admin_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_role', 'receptionist')
      .eq('is_read', false);

    if (!error && count !== null && count !== undefined) {
      return res.json({ unreadCount: count });
    }

    // 2. Fallback: count unread from center_documents
    const { data } = await supabase
      .from('center_documents')
      .select('document_name')
      .eq('document_type', 'admin_message');

    let unreadCount = 0;
    (data || []).forEach(row => {
      try {
        const parsed = JSON.parse(row.document_name);
        if (parsed.isRead === false) unreadCount++;
      } catch (_) {}
    });

    res.json({ unreadCount });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /centers/:centerId/messages/unread-count
 * Returns count of unread admin replies for the Receptionist sidebar badge.
 */
export async function getCenterMessagesUnreadCount(req, res, next) {
  try {
    const { centerId } = req.params;

    // 1. Try center_admin_messages
    const { count, error } = await supabase
      .from('center_admin_messages')
      .select('*', { count: 'exact', head: true })
      .eq('center_id', centerId)
      .eq('sender_role', 'admin')
      .eq('is_read', false);

    if (!error && count !== null && count !== undefined) {
      return res.json({ unreadCount: count });
    }

    // Fallback: 0
    res.json({ unreadCount: 0 });
  } catch (err) {
    next(err);
  }
}

