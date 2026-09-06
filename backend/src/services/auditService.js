import { supabase } from '../config/supabase.js';

const VALID_EVENT_TYPES = new Set([
  'signup',
  'profile_updated',
  'user_suspended',
  'user_activated',
  'user_deleted',
  'doctor_approved',
  'doctor_rejected',
  'center_delete',
  'center_suspend',
  'center_edit',
  'system_warning',
]);
const VALID_STATUSES = new Set(['approved', 'pending', 'completed', 'rejected']);
const LEGACY_EVENT_TYPE_MAP = {
  system: 'system_warning',
  request: 'signup',
  approval: 'doctor_approved',
  approved: 'doctor_approved',
  rejected: 'doctor_rejected',
  delete: 'center_delete',
  suspend: 'user_suspended',
  edit: 'center_edit',
};

export function normalizeAuditEventType(eventType) {
  const normalized = String(eventType ?? '').trim().toLowerCase();
  if (!normalized) return 'system_warning';
  if (VALID_EVENT_TYPES.has(normalized)) return normalized;
  return LEGACY_EVENT_TYPE_MAP[normalized] ?? 'system_warning';
}

export async function writeAuditLog({
  actorName,
  actorRole,
  eventType,
  action,
  centerName,
  status = 'completed',
}) {
  if (!actorName || !action) return null;

  const safeEventType = normalizeAuditEventType(eventType);
  const safeStatus = VALID_STATUSES.has(status) ? status : 'completed';

  try {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert([{ 
        actor_name: actorName,
        actor_role: actorRole || 'system',
        event_type: safeEventType,
        action,
        center_name: centerName || 'Platform',
        status: safeStatus,
      }])
      .select()
      .single();

    if (error) {
      console.warn(`[audit] insert failed: ${error.message}`);
      return null;
    }

    return data;
  } catch (err) {
    console.warn(`[audit] insert exception: ${err?.message || err}`);
    return null;
  }
}
