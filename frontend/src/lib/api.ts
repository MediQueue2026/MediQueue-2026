/**
 * Thin client for the MediQueue backend (Express + Supabase, see /backend).
 * Same base URL convention as the existing DB-check call in DevNavbar.tsx.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export class ApiError extends Error {
  /** HTTP status, so callers can tell "wrong password" (401) from "server down". */
  status: number
  /** Backend hint — e.g. `token_expired` vs `token_invalid`. */
  code?: string
  constructor(message: string, status = 0, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** Thrown when the backend can't be reached at all (not a 4xx/5xx). */
export class ApiOfflineError extends ApiError {
  constructor() {
    super('Cannot reach the MediQueue server.', 0)
  }
}

/**
 * The access token lives in memory only — never localStorage. A token sitting
 * in storage is readable by any script on the page, and it survives long after
 * the tab is closed. The long-lived half of the session is the httpOnly refresh
 * cookie, which JavaScript cannot read at all; on reload we trade it for a
 * fresh access token via `refresh()`.
 */
let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

/** Called when a refresh fails, so the app can drop the user back to sign-in. */
let onSessionExpired: (() => void) | null = null
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn
}

async function rawRequest<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      // Sends and accepts the refresh cookie; the backend allowlists this origin.
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options?.headers,
      },
    })
  } catch {
    // fetch only rejects on network-level failure — server down, DNS, CORS.
    throw new ApiOfflineError()
  }

  const body = await res.json().catch(() => ({} as Record<string, unknown>))
  if (!res.ok) {
    throw new ApiError(
      (body as { error?: string })?.error || `Request failed (${res.status})`,
      res.status,
      (body as { code?: string })?.code,
    )
  }
  return body as T
}

/**
 * Like rawRequest but deliberately omits the Authorization header.
 * Used for public-facing submissions (e.g. clinic registration from the
 * Login Page) where the caller might be logged in as an admin but we
 * want the backend to treat the request as an unauthenticated public form.
 */
async function requestAnonymous<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        // Explicitly NO Authorization header — backend will see req.user = undefined
        ...options?.headers,
      },
    })
  } catch {
    throw new ApiOfflineError()
  }

  const body = await res.json().catch(() => ({} as Record<string, unknown>))
  if (!res.ok) {
    throw new ApiError(
      (body as { error?: string })?.error || `Request failed (${res.status})`,
      res.status,
      (body as { code?: string })?.code,
    )
  }
  return body as T
}

/**
 * Same as `rawRequest`, but on an expired access token it silently refreshes
 * once and replays the call. Concurrent 401s share a single refresh so a page
 * with four parallel requests doesn't rotate the refresh token four times —
 * which, with rotation, would invalidate the session.
 */
let refreshInFlight: Promise<string> | null = null

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  try {
    return await rawRequest<T>(path, options)
  } catch (err) {
    const isExpired = err instanceof ApiError && err.status === 401 && err.code === 'token_expired'
    if (!isExpired || path.startsWith('/auth/')) throw err

    try {
      refreshInFlight ??= rawRequest<AuthSessionResponse>('/auth/refresh', { method: 'POST' })
        .then(r => {
          setAccessToken(r.accessToken)
          return r.accessToken
        })
        .finally(() => { refreshInFlight = null })
      await refreshInFlight
    } catch (refreshErr) {
      setAccessToken(null)
      onSessionExpired?.()
      throw refreshErr
    }

    return await rawRequest<T>(path, options)
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/** Matches the `role` CHECK constraint on public.users. */
export type ApiUserRole = 'patient' | 'doctor' | 'receptionist' | 'admin'

export interface ApiUser {
  id: string
  email: string
  fullName: string
  phone: string | null
  role: ApiUserRole
  avatarUrl: string | null
  isActive: boolean
  createdAt?: string | null
  /** The medical center this receptionist manages — null until they've requested/been assigned one. */
  centerId?: string | null
}

export interface AuthSessionResponse {
  user: ApiUser
  accessToken: string
  expiresIn: number
}

/** One posting of a doctor at a medical center (see doctor_center_assignments). */
export interface ApiDoctorCenter {
  assignmentId?: string
  centerId: string
  centerName: string | null
  room: string
  series: string
  status: 'active' | 'delayed' | 'break' | 'offline'
  delayMinutes?: number
  maxAppointmentsPerHour?: number
  approvalStatus?: 'pending' | 'approved' | 'rejected'
}

export interface ApiDoctor {
  id: string
  name: string
  dept: string
  room: string
  series: string
  status: 'active' | 'delayed' | 'break' | 'offline'
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  requestedByName?: string | null
  rejectionReason?: string | null
  email?: string | null
  phone?: string | null
  avgConsultMinutes: number
  maxAppointmentsPerHour?: number
  /** Flattened from the posting for the scoped center, or the first posting. */
  centerId?: string | null
  centerName?: string | null
  /** Every center this doctor is posted to. */
  centers?: ApiDoctorCenter[]
}

export interface ApiDoctorHour {
  id: string | null
  doctorId: string
  dayOfWeek: number      // 0=Sun … 6=Sat
  startTime: string      // "HH:MM"
  endTime: string        // "HH:MM"
  isAvailable: boolean
  dailyCapacity: number  // derived: hours × maxAppointmentsPerHour
}

export interface ApiQueueEntry {
  id: string
  doctorId: string
  series: string
  tokenNumber: number
  patientName: string
  nic?: string
  phone: string
  source: 'online' | 'physical'
  /** `cancelled` only ever arrives from a merged online appointment the patient cancelled — never settable via `setQueueEntryStatus`. */
  status: 'waiting' | 'called' | 'in_progress' | 'completed' | 'left' | 'cancelled'
  /** ISO timestamp strings — the caller converts to `Date`. */
  issuedAt: string
  calledAt?: string
}

/** Statuses the Reception Desk may actively set — matches the backend's `allowed` list in updateQueueEntryStatus. */
export type SettableQueueStatus = 'waiting' | 'called' | 'in_progress' | 'completed' | 'left'

/** One doctor's public standing on the lobby board. */
export interface ApiBoardEntry {
  doctorId: string
  series: string
  /** Token number currently called, or null when the room is between patients. */
  nowServing: number | null
  waiting: number
}

export interface IssueWalkinInput {
  doctorId: string
  /** The medical center the token is issued at (scopes numbering + series). */
  centerId?: string | null
  patientName: string
  nic?: string
  phone?: string
  source: 'online' | 'physical'
  tokenNumber?: number
}

export interface ApiCenterDocument {
  id: string
  title: string
  type: string
  fileUrl: string
  createdAt: string
}

export interface ApiCenter {
  id: string
  name: string
  address: string
  city: string
  opening_hours: string
  services: string[]
  phone?: string
  email?: string
  status?: 'operational' | 'maintenance' | 'closed'
  /** Super Admin approval state — a receptionist-requested center starts 'pending'. */
  approvalStatus?: 'pending' | 'approved' | 'rejected'
  requestedByName?: string | null
  rejectionReason?: string | null
  requestComment?: string | null
  created_at?: string
  documents?: ApiCenterDocument[]
}

export interface AuditLog {
  id: string
  time: string
  actor: string
  actor_role: 'receptionist' | 'patient' | 'doctor' | 'admin' | 'system'
  event_type: 'signup' | 'profile_updated' | 'user_suspended' | 'user_activated' | 'user_deleted' | 'doctor_approved' | 'doctor_rejected' | 'center_delete' | 'center_suspend' | 'center_edit' | 'system_warning'
  action: string
  center: string
  status: 'approved' | 'pending' | 'completed' | 'rejected'
}

export interface ApiDoctorRequest {
  id: string
  requestType: 'ASSIGN_EXISTING' | 'REGISTER_NEW'
  receptionistId?: string | null
  receptionistName: string
  centerId: string
  centerName: string
  doctorId?: string | null
  doctorName: string
  email?: string | null
  phone?: string | null
  specialization: string
  roomNumber?: string | null
  series?: string | null
  maxAppointmentsPerHour?: number
  status: 'pending' | 'approved' | 'rejected'
  rejectionReason?: string | null
  createdAt: string
}

/** A row of `health_records` as the API returns it (snake_case, straight from Postgres). */
export interface ApiHealthRecord {
  id: string
  patient_id: string
  doctor_id?: string | null
  title: string
  notes?: string | null
  /** Real Supabase Storage URL. Null/blank on legacy mock rows — callers must handle that. */
  file_url?: string | null
  record_type?: string | null
  issuing_authority?: string | null
  rx_medications?: unknown[]
  created_at?: string
}

/**
 * Attachment rules for health records. Kept here so the modal, the viewer and
 * the server-side check in recordController.js all state the same limits — the
 * server enforces them again, since a client check is a convenience, not a gate.
 */
export const HEALTH_RECORD_MAX_BYTES = 10 * 1024 * 1024

export const HEALTH_RECORD_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const

/** Accepts `.jpg` as well as `.jpeg`; matched case-insensitively. */
export const HEALTH_RECORD_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg'] as const

/** Returns an error message, or '' when the file is acceptable. */
export function validateHealthRecordFile(file: File): string {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  const typeOk =
    (HEALTH_RECORD_MIME_TYPES as readonly string[]).includes(file.type) ||
    // Some browsers report an empty type for a drag-dropped file; fall back to the extension.
    (!file.type && (HEALTH_RECORD_EXTENSIONS as readonly string[]).includes(extension))

  if (!typeOk) return 'Only PDF, PNG and JPG files can be attached.'
  if (file.size > HEALTH_RECORD_MAX_BYTES) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 10 MB.`
  }
  if (file.size === 0) return 'That file is empty.'
  return ''
}

export const api = {
  // ── Auth ──
  login: (email: string, password: string) =>
    rawRequest<AuthSessionResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (input: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role?: ApiUserRole;
    nic?: string;
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    bloodGroup?: string;
    allergies?: string;
  }) =>
    rawRequest<AuthSessionResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /** Trades the httpOnly refresh cookie for a new access token. */
  refreshSession: () => rawRequest<AuthSessionResponse>('/auth/refresh', { method: 'POST' }),

  logout: () => rawRequest<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => request<{ user: ApiUser }>('/auth/me'),

  /** Admin only. */
  createStaff: (input: {
    email: string; password: string; fullName: string; phone?: string; role: ApiUserRole
  }) => request<{ user: ApiUser }>('/auth/staff', { method: 'POST', body: JSON.stringify(input) }),

  getUsers: () => request<{ users: ApiUser[] }>('/users'),

  updateUser: (id: string, updates: Partial<ApiUser> & { isActive?: boolean; fullName?: string; email?: string; phone?: string | null; role?: ApiUserRole }) => request<{ user: ApiUser }>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      full_name: updates.fullName,
      email: updates.email,
      phone: updates.phone,
      role: updates.role,
      is_active: updates.isActive,
    }),
  }),

  deleteUser: (id: string) => request<{ message: string }>(`/users/${id}`, {
    method: 'DELETE',
  }),

  // ── Clinic data ──
  /**
   * No args → the full public roster (TV board, patient booking, admin).
   * `{ centerId }` → doctors posted to that center, flattened to that posting's
   *   room/series/status (Reception Desk roster).
   * `{ assignableFor: centerId }` → doctors NOT yet posted to that center
   *   (may work elsewhere) — the "Add Existing Doctor" pool.
   * `{ unassigned: true }` → doctors with no center posting anywhere.
   */
  getDoctors: (params?: { centerId?: string | null; unassigned?: boolean; assignableFor?: string | null }) => {
    const q = new URLSearchParams()
    if (params?.centerId) q.set('centerId', params.centerId)
    if (params?.assignableFor) q.set('assignableFor', params.assignableFor)
    if (params?.unassigned) q.set('unassigned', 'true')
    const qs = q.toString()
    return request<{ doctors: ApiDoctor[] }>(`/doctors${qs ? `?${qs}` : ''}`)
  },

  updateDoctor: (id: string, updates: Partial<{ centerId?: string | null; removeCenterId?: string; roomNumber?: string; specialization?: string; currentStatus?: string; maxAppointmentsPerHour?: number; series?: string }>) =>
    request<{ doctor?: ApiDoctor; message?: string }>(`/doctors/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        centerId: updates.centerId,
        removeCenterId: updates.removeCenterId,
        roomNumber: updates.roomNumber,
        specialization: updates.specialization,
        currentStatus: updates.currentStatus,
        maxAppointmentsPerHour: updates.maxAppointmentsPerHour,
        series: updates.series,
      }),
    }),

  createDoctor: (input: {
    fullName?: string
    specialization?: string
    roomNumber?: string
    series?: string
    maxAppointmentsPerHour?: number
    centerId?: string | null
    existingDoctorId?: string
    email?: string
    phone?: string
  }) =>
    request<{ message: string; doctor: ApiDoctor }>('/doctors', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // ── Doctor Requests (Receptionist -> Super Admin Approvals) ──
  getDoctorRequests: (params?: { status?: string }) => {
    const query = params?.status ? `?status=${encodeURIComponent(params.status)}` : ''
    return request<{ requests: ApiDoctorRequest[] }>(`/doctor-requests${query}`)
  },

  createDoctorRequest: (input: {
    requestType: 'ASSIGN_EXISTING' | 'REGISTER_NEW'
    centerId: string
    centerName?: string
    doctorId?: string | null
    doctorName: string
    email?: string
    phone?: string
    specialization: string
    roomNumber?: string
    series?: string
    maxAppointmentsPerHour?: number
  }) =>
    request<{ message: string; request: ApiDoctorRequest }>('/doctor-requests', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  approveDoctorRequest: (id: string) =>
    request<{ message: string; requestId: string; status: 'approved'; doctor?: ApiDoctor }>(`/doctor-requests/${id}/approve`, {
      method: 'PATCH',
    }),

  rejectDoctorRequest: (id: string, reason?: string) =>
    request<{ message: string; requestId: string; status: 'rejected'; reason?: string }>(`/doctor-requests/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  getPendingDoctors: () =>
    request<{ pendingDoctors: ApiDoctor[] }>('/doctors/pending'),

  approveDoctor: (id: string) =>
    request<{ message: string; doctor: ApiDoctor }>(`/doctors/${id}/approve`, {
      method: 'PATCH',
    }),

  rejectDoctor: (id: string, reason?: string) =>
    request<{ message: string; doctorId: string; approvalStatus: 'rejected'; reason?: string }>(`/doctors/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  getDoctorHours: (doctorId: string, centerId?: string | null) =>
    request<{ hours: ApiDoctorHour[]; maxAppointmentsPerHour: number }>(
      `/doctors/${doctorId}/hours${centerId ? `?centerId=${encodeURIComponent(centerId)}` : ''}`,
    ),

  upsertDoctorHours: (doctorId: string, hours: Pick<ApiDoctorHour, 'dayOfWeek' | 'startTime' | 'endTime' | 'isAvailable'>[], maxAppointmentsPerHour?: number, centerId?: string | null) =>
    request<{ message: string; hours: ApiDoctorHour[] }>(`/doctors/${doctorId}/hours`, {
      method: 'PUT',
      body: JSON.stringify({ hours, maxAppointmentsPerHour, centerId }),
    }),

  getCenters: () => request<{ centers: ApiCenter[] }>('/centers'),
  getPublicBoard: () =>
    rawRequest<{ board: ApiBoardEntry[]; migrationPending?: boolean }>('/queue/board'),

  createCenter: (input: { name: string; city: string; address?: string; openingHours?: string; services?: string[]; phone?: string; email?: string; status?: 'operational' | 'maintenance' | 'closed'; latitude?: number; longitude?: number; requestComment?: string; registrationDocument?: { fileUrl: string; fileName: string; fileType: string } }) =>
    request<{ message: string; center: ApiCenter }>('/centers', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /**
   * Public clinic registration — always creates a 'pending' center for Super
   * Admin approval regardless of the caller's login state. Uses an anonymous
   * (no-auth-header) request so the backend never mistakes an admin browsing
   * the login page for an admin directly creating a live center.
   */
  registerCenterPublic: (input: { name: string; city: string; address?: string; openingHours?: string; services?: string[]; phone?: string; email?: string; requestComment?: string; registrationDocument?: { fileUrl: string; fileName: string; fileType: string } }) =>
    requestAnonymous<{ message: string; center: ApiCenter }>('/centers', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateCenter: (id: string, updates: Partial<{ name: string; city: string; address: string; openingHours: string; services: string[]; phone: string; email: string; status: 'operational' | 'maintenance' | 'closed' }>) =>
    request<{ message: string; center: ApiCenter }>(`/centers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteCenter: (id: string) => request<{ message: string }>(`/centers/${id}`, {
    method: 'DELETE',
  }),

  // ── Medical Center Approvals (Receptionist request -> Super Admin) ──
  getPendingCenters: () => request<{ pendingCenters: ApiCenter[] }>('/centers/pending'),

  approveCenter: (id: string) =>
    request<{ message: string; center: ApiCenter }>(`/centers/${id}/approve`, {
      method: 'PATCH',
    }),

  rejectCenter: (id: string, reason?: string) =>
    request<{ message: string; centerId: string; approvalStatus: 'rejected'; reason?: string }>(`/centers/${id}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }),

  getAuditLogs: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams()
    if (params?.startDate) query.set('startDate', params.startDate)
    if (params?.endDate) query.set('endDate', params.endDate)
    const qs = query.toString()
    return request<{ logs: AuditLog[]; source: 'database' | 'dummy' }>(`/admin/audit-logs${qs ? `?${qs}` : ''}`)
  },

  updateAuditLogStatus: (id: string, status: AuditLog['status']) =>
    request<{ message: string; entry: AuditLog | null }>(`/admin/audit-logs/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  createAuditLog: (entry: Omit<AuditLog, 'id' | 'time'>) =>
    request<{ message: string; entry: AuditLog | null }>('/admin/audit-logs', {
      method: 'POST',
      body: JSON.stringify({
        actor_name: entry.actor,
        actor_role: entry.actor_role,
        event_type: entry.event_type,
        action: entry.action,
        center_name: entry.center,
        status: entry.status,
      }),
    }),


  getSystemStats: () =>
    request<{
      fetchedAt: string;
      users: { total: number; active: number; suspended: number; byRole: Record<string, number>; newThisWeek: number };
      centers: { total: number; operational: number; maintenance: number; closed: number };
      doctors: { total: number; active: number; approved: number; pending: number };
      queue: { tokensToday: number; completedToday: number; waitingNow: number; inProgressNow: number; totalAllTime: number };
      audit: { eventsToday: number; eventsByType: Record<string, number> };
    }>('/admin/system-stats'),

  getSettings: () => request<{ settings: { maintenance_mode: boolean } }>('/admin/settings'),
  getPublicSettings: () => rawRequest<{ settings: { maintenance_mode: boolean } }>('/settings/public'),
  setMaintenanceMode: (maintenanceMode: boolean) => request<{ settings: { maintenance_mode: boolean } }>('/admin/settings/maintenance', {
    method: 'PUT',
    body: JSON.stringify({ maintenanceMode })
  }),

  getQueue: (opts?: { date?: string; centerId?: string | null }) => {
    const q = new URLSearchParams()
    if (opts?.date) q.set('date', opts.date)
    if (opts?.centerId) q.set('centerId', opts.centerId)
    const qs = q.toString()
    return request<{ entries: ApiQueueEntry[]; migrationPending?: boolean }>(
      `/queue${qs ? `?${qs}` : ''}`,
    )
  },

  issueWalkinToken: (input: IssueWalkinInput) =>
    request<{ entry: ApiQueueEntry }>('/queue/walkin', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  callNext: (doctorId: string, centerId?: string | null) =>
    request<{ entries: ApiQueueEntry[] }>('/queue/call-next', {
      method: 'POST',
      body: JSON.stringify({ doctorId, centerId }),
    }),

  setQueueEntryStatus: (id: string, status: SettableQueueStatus) =>
    request<{ entry: ApiQueueEntry }>(`/queue/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  /**
   * Saves a health-record row. `fileUrl` must be a real storage URL returned by
   * `uploadFile` — the server rejects anything that isn't a PDF/PNG/JPG URL, so
   * the old placeholder `/files/<name>` strings can no longer be persisted.
   */
  createHealthRecord: (input: {
    patientId: string
    title: string
    recordType?: string
    issuingAuthority?: string
    notes?: string
    fileUrl?: string
    mimeType?: string
    fileSize?: number
  }) =>
    rawRequest<{ message: string; record: ApiHealthRecord }>('/records/upload', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  uploadFile: async (file: File, bucket = 'general'): Promise<{ fileUrl: string; fileName: string; storageProvider: string }> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('bucket', bucket)
    
    const token = getAccessToken()
    const res = await fetch(`${API_BASE}/uploads`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: formData
    })
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as Record<string, unknown>))
      throw new ApiError((err as { error?: string })?.error || 'File upload failed', res.status)
    }
    
    return res.json()
  },
}
