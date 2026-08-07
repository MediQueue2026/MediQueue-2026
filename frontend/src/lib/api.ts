/**
 * Thin client for the MediQueue backend (Express + Supabase, see /backend).
 * Same base URL convention as the existing DB-check call in DevNavbar.tsx.
 */
const API_BASE = 'http://localhost:5000/api'

export class ApiError extends Error {}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed (${res.status})`)
  }
  return body as T
}

export interface ApiDoctor {
  id: string
  name: string
  dept: string
  room: string
  series: string
  status: 'active' | 'delayed' | 'break' | 'offline'
  avgConsultMinutes: number
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

export interface IssueWalkinInput {
  doctorId: string
  patientName: string
  nic?: string
  phone?: string
  source: 'online' | 'physical'
  tokenNumber?: number
}

export const api = {
  getDoctors: () => request<{ doctors: ApiDoctor[] }>('/doctors'),

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
