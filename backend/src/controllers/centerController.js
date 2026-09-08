import { supabase } from '../config/supabase.js';
import { writeAuditLog } from '../services/auditService.js';

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
    city: row.city,
    address: row.address,
    opening_hours: row.opening_hours ?? row.hours ?? '08:00 - 18:00',
    services: row.services ?? [],
    phone: row.phone ?? null,
    email: row.email ?? null,
    status: row.status ?? 'operational',
    approvalStatus: row.approval_status ?? 'approved',
    requestedByName: row.requested_by_name ?? null,
    rejectionReason: row.rejection_reason ?? null,
    created_at: row.created_at ?? null,
    documents: Array.isArray(row.center_documents) ? row.center_documents.filter(d => d.document_type !== 'request_comment').map(d => ({
      id: d.id,
      title: d.document_name,
      type: d.document_type,
      fileUrl: d.file_url,
      createdAt: d.created_at,
    })) : [],
    requestComment: Array.isArray(row.center_documents) ? row.center_documents.find(d => d.document_type === 'request_comment')?.document_name : null,
  };
}

const DEFAULT_CENTERS = [
  { id: 'a1000000-0000-0000-0000-000000000001', name: 'MediQueue Central Clinic', city: 'Colombo 07', address: '124 Medical Plaza', opening_hours: '08:00 - 20:00', services: ['Cardiology', 'General Medicine', 'Pediatrics'], phone: '0112345678', email: 'central@mediqueue.io', status: 'operational', approval_status: 'approved' },
  { id: 'a1000000-0000-0000-0000-000000000002', name: 'MediQueue North Branch', city: 'Kandy', address: '45 Station Road', opening_hours: '09:00 - 18:00', services: ['Orthopedics', 'General Medicine'], phone: '0812345678', email: 'north@mediqueue.io', status: 'operational', approval_status: 'approved' }
];

/**
 * GET /centers
 * Public/receptionist-facing list — hides centers still pending (or rejected)
 * Super Admin approval so a newly requested facility can't be selected or
 * booked into before it's live. Pass ?includePending=true (Admin Panel) to see
 * everything, mirroring how GET /doctors exposes ?includePending.
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
      return res.json({ centers: DEFAULT_CENTERS.map(mapDbCenterToPublic) });
    }

    if (!data || data.length === 0) {
      // Auto-seed default centers into Supabase medical_centers table
      let { data: seeded, error: seedErr } = await supabase
        .from('medical_centers')
        .insert(DEFAULT_CENTERS)
        .select();

      if (seedErr && isMissingColumnError(seedErr)) {
        const noExtraDefaults = DEFAULT_CENTERS.map(({ status, approval_status, email, ...r }) => r);
        const retry = await supabase.from('medical_centers').insert(noExtraDefaults).select();
        seeded = retry.data;
        seedErr = retry.error;
      }

      if (!seedErr && seeded && seeded.length > 0) {
        return res.json({ centers: seeded.map(mapDbCenterToPublic) });
      }

      return res.json({ centers: DEFAULT_CENTERS.map(mapDbCenterToPublic) });
    }

    // IMPORTANT: Only show 'approved' centers (not pending/rejected).
    // We check c.approval_status explicitly — if the column doesn't exist
    // on the DB yet, c.approval_status will be undefined, which we treat as
    // NOT approved (rather than assuming approved) to prevent pending centers
    // from leaking into the public/operational list.
    console.log('[getCenters] All centers approval_status values:', data.map(c => ({ name: c.name, approval_status: c.approval_status })));

    const visible = includePending
      ? data
      : data.filter(c => c.approval_status === 'approved');

    console.log('[getCenters] Visible (approved only) count:', visible.length);

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
    const { name, city, address, openingHours, services, phone, email, status, requestComment, registrationDocument } = req.body;

    if (!name || !city) {
      return res.status(400).json({ error: 'Facility Name and City are required.' });
    }

    const requesterRole = req.user?.role || 'receptionist';
    const requesterName = req.user?.fullName || req.user?.email || 'Receptionist';
    const isAdmin = requesterRole === 'admin';
    const approvalStatus = isAdmin ? 'approved' : 'pending';

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

    const payload = {
      name,
      city,
      address: address || city,
      opening_hours: openingHours || '08:00 - 18:00',
      services: Array.isArray(services) ? services : (services ? [services] : []),
      phone: phone || null,
      email: email || null,
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
    // its manager (already confirmed above that they don't manage one yet).
    if (!isAdmin && req.user?.id && createdCenter?.id) {
      try {
        await supabase.from('users').update({ center_id: createdCenter.id }).eq('id', req.user.id);
      } catch (_) {
        // Non-critical — worst case the receptionist links manually via re-request.
      }
    }

    await writeAuditLog({
      actorName: requesterName,
      actorRole: requesterRole,
      eventType: 'center_edit',
      action: isAdmin
        ? `Created new medical center "${name}" in ${city}`
        : `Submitted request to add medical center "${name}" (${city})`,
      centerName: name,
      status: approvalStatus,
    });

    res.status(201).json({
      message: isAdmin
        ? 'Center created successfully'
        : 'Medical center request submitted to Super Admin for approval',
      center: finalCenter,
    });
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
    if (typeof req.body.email === 'string') updates.email = req.body.email;
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

    if (typeof req.body.status === 'string') {
      await writeAuditLog({
        actorName: req.user?.fullName || req.user?.email || 'System Admin',
        actorRole: req.user?.role || 'admin',
        eventType: req.body.status === 'maintenance' ? 'center_suspend' : 'center_edit',
        action: `Medical center ${req.body.status === 'maintenance' ? 'suspended' : 'updated'}: ${updated.name || 'Center'}`,
        centerName: updated.name || 'Center',
        status: 'completed',
      });
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
    if (!updated) {
      return res.status(404).json({ error: 'Medical center not found' });
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

    res.json({ message: 'Medical center approved successfully', center: mapDbCenterToPublic(updated) });
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

    const { data: updated, error } = await supabase
      .from('medical_centers')
      .update({ approval_status: 'rejected', rejection_reason: reason || 'Rejected by Admin' })
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    if (!updated) {
      return res.status(404).json({ error: 'Medical center not found' });
    }

    const adminName = req.user?.fullName || req.user?.email || 'Super Admin';
    try {
      await supabase.from('audit_logs').insert([{
        actor_name: adminName,
        actor_role: 'admin',
        event_type: 'center_edit',
        action: `Rejected medical center "${updated.name}" (${reason || 'No reason provided'})`,
        center_name: updated.name,
        status: 'rejected',
      }]);
    } catch (_) {}

    res.json({
      message: 'Medical center request rejected',
      centerId: id,
      approvalStatus: 'rejected',
      reason: reason || 'Rejected by Admin',
    });
  } catch (err) {
    next(err);
  }
}
