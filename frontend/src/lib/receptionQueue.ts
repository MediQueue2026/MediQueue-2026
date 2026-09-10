/**
 * Reception queue domain logic — types, formatting and selectors.
 *
 * This file used to double as a demo-data bundle: it exported a hardcoded
 * `RECEPTION_DOCTORS` roster and a 14-row `seedQueue()`, plus a full set of
 * pure reducers so the desk could run entirely offline. `useReceptionQueue`
 * seeded its state from those, which meant the Reception Desk painted four
 * fictional doctors and a dozen fictional patients on first render, then
 * swapped them for the real (usually empty) queue a moment later — the
 * "hardcoded data loads then disappears" behaviour.
 *
 * Everything here is now a pure function over data the caller supplies; the
 * queue's only source of truth is the backend (`walk_in_queue` + `appointments`
 * via backend/src/controllers/queueController.js).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** DB: walk_in_queue.source — how the token reached the queue. */
export type TokenSource = 'online' | 'physical'

/** DB: walk_in_queue.status */
export type QueueStatus = 'waiting' | 'called' | 'in_progress' | 'completed' | 'left' | 'cancelled'

export interface QueueEntry {
  id: string
  /** Token series letter, one per doctor per center — renders as #A-11. */
  series: string
  /** DB: walk_in_queue.queue_number */
  tokenNumber: number
  /** DB: walk_in_queue.patient_name */
  patientName: string
  /** DB: walk_in_queue.nic */
  nic?: string
  /** DB: walk_in_queue.sms_phone */
  phone: string
  /** DB: walk_in_queue.doctor_id */
  doctorId: string
  source: TokenSource
  status: QueueStatus
  /** DB: walk_in_queue.checked_in_at */
  issuedAt: Date
  /** DB: walk_in_queue.called_at */
  calledAt?: Date
}

export interface ReceptionDoctor {
  /** DB: doctors.id */
  id: string
  /** DB: users.full_name (JOIN doctors → users) */
  name: string
  /** DB: doctors.specialization */
  dept: string
  room: string
  /** Token series this doctor issues under at this center. */
  series: string
  status: 'active' | 'break' | 'delayed' | 'offline'
  /** Drives the estimated-wait projection. */
  avgConsultMinutes: number
  /** DB: doctor_center_assignments.max_appointments_per_hour */
  maxAppointmentsPerHour?: number
  /** DB: doctor_center_assignments.delay_minutes */
  delayMinutes?: number
  centerId?: string | null
  centerName?: string | null
}

export interface IssueTokenInput {
  patientName: string
  phone?: string
  nic?: string
  doctorId: string
  source: TokenSource
  /** Required for `physical` — the number pre-printed on the paper token. */
  tokenNumber?: number
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Renders a token in MediQueue's `#A-11` format. */
export function formatToken(series: string, tokenNumber: number): string {
  return `#${series}-${pad(tokenNumber)}`
}

export function entryToken(entry: QueueEntry): string {
  return formatToken(entry.series, entry.tokenNumber)
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** "12 min ago" / "just now" — for how long someone has been in the lobby. */
export function minutesSince(d: Date, now: Date = new Date()): number {
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / 60_000))
}

export const STATUS_LABEL: Record<QueueStatus, string> = {
  waiting: 'Waiting in Lobby',
  called: 'Called',
  in_progress: 'In Consultation',
  completed: 'Done',
  left: 'Left / No Show',
  cancelled: 'Cancelled',
}

/** Maps a status onto MediQueue's existing badge classes — no new colours. */
export const STATUS_BADGE: Record<QueueStatus, string> = {
  waiting: 'badge-amber',
  called: 'badge-emerald',
  in_progress: 'badge-emerald',
  completed: 'badge-ghost',
  left: 'badge-crimson',
  cancelled: 'badge-crimson',
}

/** Statuses that still occupy a place in line. */
export const ACTIVE_STATUSES: QueueStatus[] = ['waiting', 'called', 'in_progress']

export function isActive(entry: QueueEntry): boolean {
  return ACTIVE_STATUSES.includes(entry.status)
}

/** Statuses that are finished, one way or another. */
export function isClosed(entry: QueueEntry): boolean {
  return entry.status === 'completed' || entry.status === 'left' || entry.status === 'cancelled'
}

// ─── Selectors ───────────────────────────────────────────────────────────────

/**
 * A doctor's tokens, lowest number first.
 *
 * Matching is deliberately loose: a queue row may carry `doctors.id` or the
 * doctor's `users.id` depending on which screen created it, and legacy rows
 * only reliably carry the series letter.
 */
export function forDoctor(entries: QueueEntry[], doctorId: string, doctor?: ReceptionDoctor): QueueEntry[] {
  if (!doctorId) return []
  const docIdLower = doctorId.toLowerCase()
  const docSeriesLower = (doctor?.series ?? '').toLowerCase()
  const docUserIdLower = ((doctor as { userId?: string } | undefined)?.userId ?? '').toLowerCase()

  return entries
    .filter((e) => {
      const eDocId = (e.doctorId || '').toLowerCase()
      const eSeries = (e.series || '').toLowerCase()
      return (
        eDocId === docIdLower ||
        (docUserIdLower !== '' && eDocId === docUserIdLower) ||
        (docSeriesLower !== '' && eSeries !== '' && eSeries === docSeriesLower)
      )
    })
    .sort((a, b) => a.tokenNumber - b.tokenNumber)
}

export function waitingFor(entries: QueueEntry[], doctorId: string, doctor?: ReceptionDoctor): QueueEntry[] {
  return forDoctor(entries, doctorId, doctor).filter((e) => e.status === 'waiting')
}

export function currentFor(entries: QueueEntry[], doctorId: string, doctor?: ReceptionDoctor): QueueEntry | undefined {
  const queue = forDoctor(entries, doctorId, doctor)
  return queue.find((e) => e.status === 'called') ?? queue.find((e) => e.status === 'in_progress')
}

export function completedFor(entries: QueueEntry[], doctorId: string, doctor?: ReceptionDoctor): QueueEntry[] {
  return forDoctor(entries, doctorId, doctor).filter((e) => e.status === 'completed')
}

export function issuedNumbers(entries: QueueEntry[], doctorId: string, doctor?: ReceptionDoctor): number[] {
  return forDoctor(entries, doctorId, doctor).map((e) => e.tokenNumber)
}

export function nextTokenNumber(entries: QueueEntry[], doctorId: string, doctor?: ReceptionDoctor): number {
  const nums = issuedNumbers(entries, doctorId, doctor)
  return nums.length > 0 ? Math.max(...nums) + 1 : 1
}

/** Projected wait for the Nth patient in line, from the doctor's average consult time. */
export function estimateWaitMinutes(positionInLine: number, doctor?: ReceptionDoctor): number {
  const avg = doctor?.avgConsultMinutes ?? 10
  // A published delay pushes every projection out by however long the doctor
  // said they'd be, not by a flat one-consult penalty.
  const delay = doctor?.status === 'delayed' ? (doctor.delayMinutes ?? avg) : 0
  return positionInLine * avg + delay
}

/**
 * Mean projected wait across the given doctors.
 * `doctors` is required — it used to default to the hardcoded demo roster,
 * which silently averaged over four doctors who didn't exist.
 */
export function averageWaitMinutes(entries: QueueEntry[], doctors: ReceptionDoctor[]): number {
  const waits = doctors.flatMap((doc) =>
    waitingFor(entries, doc.id, doc).map((_, i) => estimateWaitMinutes(i + 1, doc)),
  )
  if (waits.length === 0) return 0
  return Math.round(waits.reduce((sum, w) => sum + w, 0) / waits.length)
}
