/**
 * Reception queue domain logic.
 *
 * Ported from the QueueManagementProto receptionist module — the *logic* only.
 * All presentation stays in MediQueue's own glass theme; nothing here knows
 * about colours or markup.
 *
 * DB tables this maps onto (connect when the backend is ready):
 *   walk_in_queue — id, patient_name, patient_id, doctor_id, clinic_id,
 *                   queue_date, queue_number, status, sms_phone, source,
 *                   estimated_wait_minutes, checked_in_at, called_at
 *   doctors       — id, user_id, specialization
 *   users         — id, full_name
 *
 * Every mutation below is a pure reducer over `QueueEntry[]`, so swapping the
 * in-memory store for API calls means replacing the caller (the hook), not this
 * file. The SQL each one stands in for is noted above the function.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** DB: walk_in_queue.source — how the token reached the queue. */
export type TokenSource = 'online' | 'physical'

/** DB: walk_in_queue.status */
export type QueueStatus = 'waiting' | 'called' | 'in_progress' | 'completed' | 'left'

export interface QueueEntry {
  id: string
  /** Token series letter, one per doctor — renders as #A-11. */
  series: string
  /** DB: walk_in_queue.queue_number */
  tokenNumber: number
  /** DB: walk_in_queue.patient_name */
  patientName: string
  /** NIC / passport captured at the counter (no DB column yet). */
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
  /** Token series this doctor issues under. */
  series: string
  status: 'active' | 'break' | 'delayed' | 'offline'
  /** Drives the estimated-wait projection. */
  avgConsultMinutes: number
  /** DB: doctors.max_appointments_per_hour */
  maxAppointmentsPerHour?: number
  /** DB: doctors.center_id */
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

// ─── Reference data (replace with GET /doctors when the API lands) ────────────

// DB: SELECT d.id, u.full_name, d.specialization FROM doctors d
//     JOIN users u ON u.id = d.user_id WHERE u.is_active = true ORDER BY u.full_name
export const RECEPTION_DOCTORS: ReceptionDoctor[] = [
  { id: 'dr-1', name: 'Dr. Ethan Carr', dept: 'General Medicine', room: 'Room 04', series: 'A', status: 'active', avgConsultMinutes: 8 },
  { id: 'dr-2', name: 'Dr. Aisha Patel', dept: 'Cardiology', room: 'Room 03', series: 'B', status: 'active', avgConsultMinutes: 12 },
  { id: 'dr-3', name: 'Dr. S. Montoya', dept: 'Pediatrics', room: 'Room 11', series: 'C', status: 'delayed', avgConsultMinutes: 15 },
  { id: 'dr-4', name: 'Dr. K. Nakamura', dept: 'Orthopedics', room: 'Room 02', series: 'D', status: 'break', avgConsultMinutes: 10 },
]

export function findDoctor(doctorId: string): ReceptionDoctor | undefined {
  return RECEPTION_DOCTORS.find((d) => d.id === doctorId)
}

// ─── Seed queue (DB: walk_in_queue rows for today) ───────────────────────────

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000)

let seq = 0
function entryId() {
  seq += 1
  return `q-${seq}`
}

// DB: SELECT * FROM walk_in_queue WHERE queue_date = CURRENT_DATE ORDER BY doctor_id, queue_number
export function seedQueue(): QueueEntry[] {
  const rows: Array<Omit<QueueEntry, 'id'>> = [
    // Dr. Ethan Carr — series A
    { series: 'A', tokenNumber: 9, patientName: 'Chamari Jayawardena', nic: '198512345671', phone: '0771000001', doctorId: 'dr-1', source: 'online', status: 'completed', issuedAt: minutesAgo(150), calledAt: minutesAgo(140) },
    { series: 'A', tokenNumber: 10, patientName: 'Mahesh Gunaratne', nic: '199012345672', phone: '', doctorId: 'dr-1', source: 'physical', status: 'completed', issuedAt: minutesAgo(120), calledAt: minutesAgo(105) },
    { series: 'A', tokenNumber: 11, patientName: 'Nimal Silva', nic: '197945210082', phone: '0771234567', doctorId: 'dr-1', source: 'online', status: 'in_progress', issuedAt: minutesAgo(90), calledAt: minutesAgo(12) },
    { series: 'A', tokenNumber: 12, patientName: 'Kasun Perera', nic: '199212004821', phone: '0719876543', doctorId: 'dr-1', source: 'online', status: 'waiting', issuedAt: minutesAgo(62) },
    { series: 'A', tokenNumber: 13, patientName: 'Dilini Fernando', nic: '199856210099', phone: '0754433221', doctorId: 'dr-1', source: 'physical', status: 'waiting', issuedAt: minutesAgo(48) },
    { series: 'A', tokenNumber: 14, patientName: 'Rajan Mehta', nic: '198845210082', phone: '0778899001', doctorId: 'dr-1', source: 'online', status: 'waiting', issuedAt: minutesAgo(30) },
    { series: 'A', tokenNumber: 15, patientName: 'Sunil Wickramasinghe', nic: '196512345678', phone: '0721122334', doctorId: 'dr-1', source: 'physical', status: 'waiting', issuedAt: minutesAgo(14) },

    // Dr. Aisha Patel — series B
    { series: 'B', tokenNumber: 6, patientName: 'Anura Kumara', nic: '197712345673', phone: '0765544332', doctorId: 'dr-2', source: 'online', status: 'in_progress', issuedAt: minutesAgo(70), calledAt: minutesAgo(9) },
    { series: 'B', tokenNumber: 7, patientName: 'Shanika Ratnayake', nic: '199412345674', phone: '0712233445', doctorId: 'dr-2', source: 'online', status: 'waiting', issuedAt: minutesAgo(40) },
    { series: 'B', tokenNumber: 8, patientName: 'Tharindu Bandara', nic: '198912345675', phone: '', doctorId: 'dr-2', source: 'physical', status: 'waiting', issuedAt: minutesAgo(22) },

    // Dr. S. Montoya — series C (running late)
    { series: 'C', tokenNumber: 9, patientName: 'Isuru Madushanka', nic: '200112345676', phone: '0703344556', doctorId: 'dr-3', source: 'online', status: 'in_progress', issuedAt: minutesAgo(95), calledAt: minutesAgo(28) },
    { series: 'C', tokenNumber: 10, patientName: 'Hasini Wijesinghe', nic: '200212345677', phone: '0774455667', doctorId: 'dr-3', source: 'online', status: 'waiting', issuedAt: minutesAgo(55) },
    { series: 'C', tokenNumber: 11, patientName: 'Nadeesha Alwis', nic: '199712345678', phone: '', doctorId: 'dr-3', source: 'physical', status: 'waiting', issuedAt: minutesAgo(35) },
    { series: 'C', tokenNumber: 12, patientName: 'Ruwan Dissanayake', nic: '198312345679', phone: '0756677889', doctorId: 'dr-3', source: 'online', status: 'waiting', issuedAt: minutesAgo(18) },
  ]
  return rows.map((r) => ({ ...r, id: entryId() }))
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

/** Statuses that still occupy a slot in the queue. */
export const ACTIVE_STATUSES: QueueStatus[] = ['waiting', 'called', 'in_progress']

export function isActive(entry: QueueEntry): boolean {
  return ACTIVE_STATUSES.includes(entry.status)
}

export const STATUS_LABEL: Record<QueueStatus, string> = {
  waiting: 'Waiting in Lobby',
  called: 'Called',
  in_progress: 'In Consultation',
  completed: 'Completed',
  left: 'No Show',
}

/** Maps a status onto MediQueue's existing badge classes — no new colours. */
export const STATUS_BADGE: Record<QueueStatus, string> = {
  waiting: 'badge-amber',
  called: 'badge-blue',
  in_progress: 'badge-blue',
  completed: 'badge-emerald',
  left: 'badge-ghost',
}

// ─── Selectors ───────────────────────────────────────────────────────────────

export function forDoctor(entries: QueueEntry[], doctorId: string, doctor?: ReceptionDoctor): QueueEntry[] {
  if (!doctorId) return entries
  const docIdLower = (doctorId || '').toLowerCase()
  const docSeriesLower = (doctor?.series || '').toLowerCase()
  const docUserIdLower = ((doctor as any)?.userId || '').toLowerCase()

  return entries.filter((e) => {
    const eDocId = (e.doctorId || '').toLowerCase()
    const eSeries = (e.series || '').toLowerCase()

    return (
      eDocId === docIdLower ||
      (docUserIdLower && eDocId === docUserIdLower) ||
      (docSeriesLower && eSeries && eSeries === docSeriesLower)
    )
  }).sort((a, b) => a.tokenNumber - b.tokenNumber)
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

/** A pre-printed number can only be recorded once per doctor per day. */
export function isTokenTaken(entries: QueueEntry[], doctorId: string, tokenNumber: number): boolean {
  return issuedNumbers(entries, doctorId).includes(tokenNumber)
}

/** Projected wait for the Nth patient in line, from the doctor's average consult time. */
export function estimateWaitMinutes(positionInLine: number, doctor?: ReceptionDoctor): number {
  const avg = doctor?.avgConsultMinutes ?? 10
  const penalty = doctor?.status === 'delayed' ? avg : 0
  return positionInLine * avg + penalty
}

export function averageWaitMinutes(entries: QueueEntry[]): number {
  const waits = RECEPTION_DOCTORS.flatMap((doc) =>
    waitingFor(entries, doc.id).map((_, i) => estimateWaitMinutes(i + 1, doc)),
  )
  if (waits.length === 0) return 0
  return Math.round(waits.reduce((sum, w) => sum + w, 0) / waits.length)
}

// ─── Mutations (pure reducers) ───────────────────────────────────────────────

export class QueueError extends Error {}

/**
 * DB: INSERT INTO walk_in_queue
 *       (patient_name, sms_phone, doctor_id, queue_number, source, status,
 *        queue_date, checked_in_at)
 *     VALUES ($1, $2, $3, $4, $5, 'waiting', CURRENT_DATE, NOW())
 *
 * `online` takes the next sequential number; `physical` records the number
 * already printed on the paper token and rejects a repeat.
 */
export function issueToken(entries: QueueEntry[], input: IssueTokenInput): QueueEntry[] {
  const name = input.patientName.trim()
  if (!name) throw new QueueError('Patient name is required.')

  const doctor = findDoctor(input.doctorId)
  if (!doctor) throw new QueueError('Select a doctor before issuing a token.')

  let tokenNumber: number
  if (input.source === 'physical') {
    tokenNumber = Number(input.tokenNumber)
    if (!Number.isInteger(tokenNumber) || tokenNumber < 1) {
      throw new QueueError('Enter the number printed on the paper token.')
    }
    if (isTokenTaken(entries, input.doctorId, tokenNumber)) {
      throw new QueueError(`Token ${formatToken(doctor.series, tokenNumber)} has already been issued today.`)
    }
  } else {
    tokenNumber = nextTokenNumber(entries, input.doctorId)
  }

  const entry: QueueEntry = {
    id: entryId(),
    series: doctor.series,
    tokenNumber,
    patientName: name,
    nic: input.nic?.trim() || undefined,
    phone: input.phone?.trim() ?? '',
    doctorId: input.doctorId,
    source: input.source,
    status: 'waiting',
    issuedAt: new Date(),
  }

  return [...entries, entry].sort((a, b) => a.tokenNumber - b.tokenNumber)
}

/**
 * DB: UPDATE walk_in_queue SET status='completed'
 *       WHERE doctor_id=$1 AND queue_date=CURRENT_DATE AND status IN ('called','in_progress');
 *     UPDATE walk_in_queue SET status='called', called_at=NOW()
 *       WHERE id=(lowest waiting queue_number for that doctor today);
 *
 * A doctor has one room, so exactly one token is live at a time: announcing the
 * next one closes out whoever was live. The prototype only promoted
 * `called` → `in_progress` and left the previous consultation open, which put
 * two tokens on the board at once and hid the patient who had just been called.
 * If someone left without being seen, mark them `left` from the row actions
 * before calling the next token.
 */
export function callNext(entries: QueueEntry[], doctorId: string): QueueEntry[] {
  const queue = forDoctor(entries, doctorId)
  const nextWaiting = queue.find((e) => e.status === 'waiting')
  if (!nextWaiting) return entries

  return entries.map((e) => {
    if (e.doctorId !== doctorId) return e
    if (e.status === 'called' || e.status === 'in_progress') {
      return { ...e, status: 'completed' as QueueStatus }
    }
    if (e.id === nextWaiting.id) {
      return { ...e, status: 'called' as QueueStatus, calledAt: new Date() }
    }
    return e
  })
}

/**
 * Closes the live token without calling anyone else.
 * DB: UPDATE walk_in_queue SET status='completed' WHERE id=$1
 */
export function completeCurrent(entries: QueueEntry[], doctorId: string): QueueEntry[] {
  const live = currentFor(entries, doctorId)
  if (!live) return entries
  return entries.map((e) => (e.id === live.id ? { ...e, status: 'completed' as QueueStatus } : e))
}

/** DB: UPDATE walk_in_queue SET status=$2 WHERE id=$1 */
export function setEntryStatus(entries: QueueEntry[], id: string, status: QueueStatus): QueueEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, status } : e))
}
