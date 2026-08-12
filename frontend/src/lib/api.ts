/**
 * Thin client for the MediQueue backend (Express + Supabase, see /backend).
 * Same base URL convention as the existing DB-check call in DevNavbar.tsx.
 */
const API_BASE = 'http://localhost:5000/api'

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
}

export interface AuthSessionResponse {
  user: ApiUser
  accessToken: string
  expiresIn: number
}

export interface ApiDoctor {
  id: string
  name: string
  dept: string
  room: string
  series: string
  status: 'active' | 'delayed' | 'break' | 'offline'
  avgConsultMinutes: number
  maxAppointmentsPerHour?: number
  centerId?: string | null
  centerName?: string | null
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
  status: 'waiting' | 'called' | 'in_progress' | 'completed' | 'left'
  /** ISO timestamp strings — the caller converts to `Date`. */
  issuedAt: string
  calledAt?: string
}

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
  patientName: string
  nic?: string
  phone?: string
  source: 'online' | 'physical'
  tokenNumber?: number
}

export interface ApiCenter {
  id: string
  name: string
  address: string
  city: string
  opening_hours: string
  services: string[]
  phone?: string
  status?: 'operational' | 'maintenance' | 'closed'
  created_at?: string
}

export interface AuditLog {
  id: string
  time: string
  actor: string
  actor_role: 'receptionist' | 'patient' | 'doctor' | 'admin' | 'system'
  event_type: 'approval' | 'request' | 'token_issued' | 'no_show' | 'prescription' | 'system'
  action: string
  center: string
  status: 'approved' | 'pending' | 'completed' | 'rejected'
}

export const api = {
  // ── Auth ──
  login: (email: string, password: string) =>
    rawRequest<AuthSessionResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (input: {
    email: string; password: string; fullName: string; phone?: string; role?: ApiUserRole
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
  getDoctors: () => request<{ doctors: ApiDoctor[] }>('/doctors'),

  updateDoctor: (id: string, updates: Partial<{ centerId?: string | null; roomNumber?: string; specialization?: string; currentStatus?: string; maxAppointmentsPerHour?: number; series?: string }>) =>
    request<{ doctor: ApiDoctor }>(`/doctors/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        centerId: updates.centerId,
        roomNumber: updates.roomNumber,
        specialization: updates.specialization,
        currentStatus: updates.currentStatus,
        maxAppointmentsPerHour: updates.maxAppointmentsPerHour,
        series: updates.series,
      }),
    }),

  createDoctor: (input: {
    fullName: string
    specialization: string
    roomNumber?: string
    series?: string
    maxAppointmentsPerHour?: number
    centerId?: string | null
  }) =>
    request<{ message: string; doctor: ApiDoctor }>('/doctors', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getDoctorHours: (doctorId: string) =>
    request<{ hours: ApiDoctorHour[]; maxAppointmentsPerHour: number }>(`/doctors/${doctorId}/hours`),

  upsertDoctorHours: (doctorId: string, hours: Pick<ApiDoctorHour, 'dayOfWeek' | 'startTime' | 'endTime' | 'isAvailable'>[], maxAppointmentsPerHour?: number) =>
    request<{ message: string; hours: ApiDoctorHour[] }>(`/doctors/${doctorId}/hours`, {
      method: 'PUT',
      body: JSON.stringify({ hours, maxAppointmentsPerHour }),
    }),

  getCenters: () => request<{ centers: ApiCenter[] }>('/centers'),
  getPublicBoard: () =>
    rawRequest<{ board: ApiBoardEntry[]; migrationPending?: boolean }>('/queue/board'),

  createCenter: (input: { name: string; city: string; address?: string; openingHours?: string; services?: string[]; phone?: string; status?: 'operational' | 'maintenance' | 'closed' }) =>
    request<{ message: string; center: ApiCenter }>('/centers', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateCenter: (id: string, updates: Partial<{ name: string; city: string; address: string; openingHours: string; services: string[]; phone: string; status: 'operational' | 'maintenance' | 'closed' }>) =>
    request<{ message: string; center: ApiCenter }>(`/centers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }),

  deleteCenter: (id: string) => request<{ message: string }>(`/centers/${id}`, {
    method: 'DELETE',
  }),

  getAuditLogs: () => request<{ logs: AuditLog[]; source: 'database' | 'dummy' }>('/admin/audit-logs'),

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


  getQueue: (date?: string) =>
    request<{ entries: ApiQueueEntry[]; migrationPending?: boolean }>(
      `/queue${date ? `?date=${date}` : ''}`,
    ),

  issueWalkinToken: (input: IssueWalkinInput) =>
    request<{ entry: ApiQueueEntry }>('/queue/walkin', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  callNext: (doctorId: string) =>
    request<{ entries: ApiQueueEntry[] }>('/queue/call-next', {
      method: 'POST',
      body: JSON.stringify({ doctorId }),
    }),

  setQueueEntryStatus: (id: string, status: ApiQueueEntry['status']) =>
    request<{ entry: ApiQueueEntry }>(`/queue/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
}
