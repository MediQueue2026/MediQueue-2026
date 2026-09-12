import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity, AlertCircle, Bell, BellRing, Building2, CheckCircle2, Clock, Hash, Plus, Radio,
  Search, Stethoscope, Ticket, UserX, Users, Wifi, CalendarClock, CalendarOff, Pencil, Menu, X,
  ChevronDown, ChevronRight, PhoneCall, RefreshCw, Timer, TriangleAlert
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AccountMenu from '../components/AccountMenu'
import PublicTvDisplay from '../components/PublicTvDisplay'
import AddDoctorModal from '../components/AddDoctorModal'
import AddCenterModal from '../components/AddCenterModal'
import DoctorHoursModal from '../components/DoctorHoursModal'
import DelayAlertModal from '../components/DelayAlertModal'
import { Avatar, Badge, StatusBadge } from '../components/UIPrimitives'
import { useReceptionQueue } from '../hooks/useReceptionQueue'
import {
  STATUS_BADGE, STATUS_LABEL, currentFor, entryToken, fmtTime, formatToken,
  averageWaitMinutes, minutesSince, validateNic, validatePhone, waitingFor
} from '../lib/receptionQueue'
import type { QueueEntry, TokenSource } from '../lib/receptionQueue'
import { api, type ApiAppointmentRow, type ApiCenterClosure, type ApiCenterDateHours, type ApiDoctorDateHours, type ApiDoctor } from '../lib/api'

/**
 * Identity key for a patient — their name plus phone number. Used to collapse
 * repeat rows in the All Patients table so one person booking several times
 * shows once.
 *
 * Both halves are normalised so trivial differences don't defeat the match:
 *  - name: trimmed, lower-cased, internal whitespace flattened
 *  - phone: digits only, reduced to the last 9 (the subscriber number), so
 *    `0771234567`, `94771234567` and `+94 77 123 4567` all key the same.
 */
function patientKey(name: string, phone: string): string {
  const n = (name || '').trim().toLowerCase().replace(/\s+/g, ' ')
  const p = (phone || '').replace(/\D/g, '').slice(-9)
  return `${n}|${p}`
}

/** Badge class + label for an appointment's status (`booked`, `cancelled`, …). */
function apptStatusBadge(status: string): { cls: string; label: string } {
  const s = (status || '').toLowerCase()
  if (s === 'cancelled') return { cls: 'badge-crimson', label: 'Cancelled' }
  if (s === 'completed') return { cls: 'badge-ghost', label: 'Completed' }
  if (s === 'booked') return { cls: 'badge-amber', label: 'Booked' }
  return { cls: 'badge-ghost', label: status ? status[0].toUpperCase() + status.slice(1) : '—' }
}


/** Compact metric — one line, no card chrome, so the strip stays out of the receptionist's way. */
function StatPill({ icon, label, value, accent = 'var(--text-2)' }: {
  icon: ReactNode; label: string; value: string; accent?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border-md)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1.15 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</div>
      </div>
    </div>
  )
}

/**
 * Wait-time colour bands. A receptionist scanning the queue needs to spot the
 * person who has been sitting there 40 minutes without reading every number,
 * so the figure is colour-coded rather than plain grey text.
 */
function waitTone(minutes: number): { fg: string; bg: string; border: string } {
  if (minutes < 15) return { fg: '#047857', bg: 'var(--emerald-dim)', border: 'var(--emerald-border)' }
  if (minutes < 30) return { fg: '#B45309', bg: 'var(--amber-dim)', border: 'var(--amber-border)' }
  return { fg: '#B91C1C', bg: 'var(--crimson-dim)', border: 'var(--crimson-border)' }
}

/** Small pill used for the segment counts in the Active Queue header. */
function CountChip({ label, value, tone }: { label: string; value: number; tone: 'amber' | 'emerald' | 'ghost' | 'crimson' }) {
  const tones = {
    amber:   { fg: '#B45309', bg: 'var(--amber-dim)', border: 'var(--amber-border)' },
    emerald: { fg: '#047857', bg: 'var(--emerald-dim)', border: 'var(--emerald-border)' },
    crimson: { fg: '#B91C1C', bg: 'var(--crimson-dim)', border: 'var(--crimson-border)' },
    ghost:   { fg: 'var(--text-3)', bg: 'rgba(30,41,59,0.05)', border: 'var(--border-md)' },
  }[tone]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
      color: tones.fg, background: tones.bg, border: `1px solid ${tones.border}`,
      whiteSpace: 'nowrap',
    }}>
      <strong style={{ fontSize: 13, fontWeight: 800 }}>{value}</strong> {label}
    </span>
  )
}

/**
 * One token in the Active Queue.
 *
 * Replaces the eight-column table row. That table needed 780px before it
 * started scrolling horizontally, which on the desk's own screen meant the
 * Actions column — the only interactive part — was the bit that got cut off.
 * This is a flex row that reflows instead, and it leads with the two things
 * that matter at a counter: place in line and token number.
 */
function QueueRow({
  entry, tone, position, estWait, now, onCall, onDone, onNoShow,
}: {
  entry: QueueEntry
  tone: 'live' | 'waiting' | 'closed'
  position?: number
  estWait?: number
  now: Date
  onCall?: () => void
  onDone?: () => void
  onNoShow?: () => void
}) {
  const waited = minutesSince(entry.issuedAt, now)
  const accent =
    tone === 'live' ? 'var(--emerald)'
    : tone === 'waiting' ? 'var(--amber)'
    : entry.status === 'completed' ? 'var(--border-lg)'
    : 'var(--crimson-border)'

  const wait = estWait != null ? waitTone(estWait) : null

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        padding: '12px 14px', borderRadius: 10,
        borderLeft: `3px solid ${accent}`,
        border: '1px solid var(--border)',
        borderLeftWidth: 3, borderLeftColor: accent,
        background: tone === 'live' ? 'var(--emerald-dim)' : tone === 'closed' ? 'rgba(30,41,59,0.02)' : '#ffffff',
        opacity: tone === 'closed' ? 0.72 : 1,
      }}
    >
      {/* Place in line — the answer to "how many before me?" */}
      {position != null && (
        <div
          title={`${position === 1 ? 'Next to be called' : `${position} in line`}`}
          style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12.5, fontWeight: 800,
            background: position === 1 ? 'var(--blue)' : 'rgba(30,41,59,0.06)',
            color: position === 1 ? '#fff' : 'var(--text-3)',
            border: position === 1 ? 'none' : '1px solid var(--border-md)',
          }}
        >
          {position}
        </div>
      )}

      {/* Token */}
      <div style={{
        fontFamily: 'monospace', fontSize: 17, fontWeight: 800, minWidth: 68, flexShrink: 0,
        color: tone === 'live' ? '#047857' : tone === 'closed' ? 'var(--text-4)' : 'var(--blue)',
      }}>
        {entryToken(entry)}
      </div>

      {/* Identity */}
      <div style={{ flex: 1, minWidth: 150 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>{entry.patientName}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-4)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Clock size={10} /> in at {fmtTime(entry.issuedAt)}
          </span>
          {entry.phone && <span>· {entry.phone}</span>}
          {entry.nic && <span>· {entry.nic}</span>}
        </div>
      </div>

      {/* Source */}
      <div style={{ flexShrink: 0 }}>
        {entry.source === 'online'
          ? <Badge cls="badge-blue"><Wifi size={10} /> Online</Badge>
          : <Badge cls="badge-amber"><Hash size={10} /> Physical</Badge>}
      </div>

      {/* How long they've actually been sitting there, plus the projection */}
      {tone !== 'closed' && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          <span
            title="Time since check-in"
            style={{
              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
              color: waitTone(waited).fg, background: waitTone(waited).bg,
              border: `1px solid ${waitTone(waited).border}`,
              display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
            }}
          >
            <Timer size={10} /> {waited} min here
          </span>
          {wait && (
            <span
              title="Projected wait from this doctor's average consult time"
              style={{
                fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                color: wait.fg, background: wait.bg, border: `1px solid ${wait.border}`,
                whiteSpace: 'nowrap',
              }}
            >
              ~{estWait} min to go
            </span>
          )}
        </div>
      )}

      {/* Status */}
      <div style={{ flexShrink: 0 }}>
        <Badge cls={STATUS_BADGE[entry.status] || 'badge-crimson'}>
          {STATUS_LABEL[entry.status] || 'Cancelled'}
        </Badge>
      </div>

      {/* Actions */}
      {tone !== 'closed' && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {onCall && (
            <button
              onClick={onCall}
              className="btn btn-ghost btn-sm"
              style={{ gap: 4, color: 'var(--blue)', border: '1px solid var(--blue-border)' }}
              title={position === 1 ? 'Call this token' : 'Call out of order'}
            >
              <PhoneCall size={12} /> Call
            </button>
          )}
          {onDone && (
            <button onClick={onDone} className="btn btn-ghost btn-sm" style={{ gap: 4, color: '#047857' }}>
              <CheckCircle2 size={12} /> Done
            </button>
          )}
          {onNoShow && (
            <button onClick={onNoShow} className="btn btn-ghost btn-sm" style={{ gap: 4, color: 'var(--crimson)' }}>
              <UserX size={12} /> No-Show
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** Grey placeholder rows, so the first paint isn't an empty table that then fills in. */
function QueueSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            height: 62, borderRadius: 10, background: 'rgba(30,41,59,0.045)',
            border: '1px solid var(--border)', opacity: 1 - i * 0.25,
          }}
        />
      ))}
    </div>
  )
}

export default function ReceptionistDesk() {
  const queue = useReceptionQueue()
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<'checkin' | 'patients' | 'doctors' | 'schedule'>('checkin')

  const [showTvDisplay, setShowTvDisplay] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [showRequestCenter, setShowRequestCenter] = useState(false)
  const [centerRequestStatus, setCenterRequestStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [centerRequestMsg, setCenterRequestMsg] = useState('')
  const [patientSearch, setPatientSearch] = useState('')
  const [doctorSearch, setDoctorSearch] = useState('')

  // My Doctors tab
  const [showAddDoctor, setShowAddDoctor] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState<ApiDoctor | null>(null)
  const [hoursDoctor, setHoursDoctor] = useState<ApiDoctor | null>(null)

  // Delay alerts (BR-05 / FR-07) — reception is usually the first to know a
  // doctor is running late, so the desk can publish the notice too.
  const [showDelayModal, setShowDelayModal] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [delayToast, setDelayToast] = useState<string | null>(null)
  /** Closed tokens are collapsed by default — they're reference, not work. */
  const [showClosed, setShowClosed] = useState(false)

  // Counter form — patients book their own online tokens from the Patient app;
  // this desk only records walk-ins against a pre-printed physical slip.
  const tokenSource: TokenSource = 'physical'
  const [formName, setFormName] = useState('')
  const [formNic, setFormNic] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [physicalToken, setPhysicalToken] = useState('')
  const [issued, setIssued] = useState<string | null>(null)

  // Name-field autocomplete against patients already on record at this center,
  // so a returning walk-in's NIC and phone are filled from a past visit rather
  // than re-keyed (and re-mistyped) every time.
  const [nameMenuOpen, setNameMenuOpen] = useState(false)
  const [nameHighlight, setNameHighlight] = useState(-1)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const physicalInputRef = useRef<HTMLInputElement>(null)

  // A receptionist must submit their official center details before using the
  // desk. Other roles never enter this flow.
  useEffect(() => {
    if (user?.role === 'receptionist' && !user.centerId && !user.rejectionReason && !user.isDemo) {
      setShowRequestCenter(true)
    }
  }, [user?.role, user?.centerId, user?.rejectionReason, user?.isDemo])

  // Keeps the counter fast for back-to-back walk-ins: whichever field is
  // needed first is already focused after a source switch or a successful issue.
  useEffect(() => {
    if (activeTab !== 'checkin') return
    const target = tokenSource === 'physical' ? physicalInputRef.current : nameInputRef.current
    target?.focus()
  }, [tokenSource, activeTab])

  const { selectedDoctor, current, waiting, upNext, issuedNumbers } = queue
  const centerAccessApproved = user?.centerApprovalStatus === 'approved' || user?.isDemo || !user?.centerId

  // Quick-pick candidates for a printed slip number — the lowest numbers not
  // already recorded today, so the receptionist taps a number instead of typing it.
  const nextAvailableTokens = useMemo(() => {
    const taken = new Set(issuedNumbers)
    const candidates: number[] = []
    for (let n = 1; candidates.length < 8 && n < 1000; n++) {
      if (!taken.has(n)) candidates.push(n)
    }
    return candidates
  }, [issuedNumbers])

  // Clinic-wide numbers for the header strip.
  const issuedToday = queue.entries.length
  const waitingInLobby = useMemo(
    () => queue.entries.filter(e => e.status === 'waiting').length,
    [queue.entries],
  )
  const avgWait = useMemo(() => averageWaitMinutes(queue.entries, queue.doctors), [queue.entries, queue.doctors])
  const activeDoctors = useMemo(() => queue.doctors.filter(d => d.status === 'active').length, [queue.doctors])

  const resetForm = () => {
    setFormName(''); setFormNic(''); setFormPhone(''); setPhysicalToken('')
  }

  // Phone is required (the desk SMSes the token); NIC is optional but, when
  // given, must be a well-formed Sri Lankan NIC.
  const phoneCheck = validatePhone(formPhone)
  const nicCheck = validateNic(formNic)

  const handleIssueToken = async () => {
    if (!phoneCheck.ok || !nicCheck.ok) return
    const result = await queue.issue({
      patientName: formName,
      nic: formNic.trim(),
      phone: formPhone.trim(),
      source: tokenSource,
      tokenNumber: tokenSource === 'physical' ? Number(physicalToken) : undefined,
    })
    if (result.ok && result.entry) {
      setIssued(entryToken(result.entry))
      resetForm()
      nameInputRef.current?.focus()
      setTimeout(() => setIssued(null), 3000)
    }
  }

  /**
   * Every appointment booked for a doctor at this desk's center — the single
   * source for both Patients-tab tables. Re-fetched whenever the tab is opened
   * or the desk's center changes. When the account isn't linked to a center
   * (e.g. demo mode) it falls back to an unscoped list so the tab still shows
   * data instead of sitting empty.
   */
  const [allAppointments, setAllAppointments] = useState<ApiAppointmentRow[]>([])

  /** Center closures (migration 012) — drives the Schedule tab's CLOSED badges. */
  const [closures, setClosures] = useState<ApiCenterClosure[]>([])
  /** Bumped after a close/re-open so both lists refetch. */
  const [scheduleReloadKey, setScheduleReloadKey] = useState(0)

  useEffect(() => {
    // Loaded for the Patients tab's tables, the check-in tab's name
    // autocomplete, and the Schedule tab's day list — all read the same
    // center-scoped appointment list.
    if (activeTab !== 'patients' && activeTab !== 'checkin' && activeTab !== 'schedule') return
    let cancelled = false
    api.getAppointments(queue.centerId ? { centerId: queue.centerId } : undefined)
      .then(res => { if (!cancelled) setAllAppointments(res.appointments) })
      .catch(() => { if (!cancelled) setAllAppointments([]) })
    return () => { cancelled = true }
  }, [activeTab, queue.centerId, scheduleReloadKey])

  useEffect(() => {
    if (activeTab !== 'schedule' || !queue.centerId) { setClosures([]); return }
    let cancelled = false
    api.getCenterClosures(queue.centerId)
      .then(res => { if (!cancelled) setClosures(res.closures) })
      .catch(() => { if (!cancelled) setClosures([]) })
    return () => { cancelled = true }
  }, [activeTab, queue.centerId, scheduleReloadKey])

  /** Date-specific hours (migration 014) — per-doctor overrides + the centre's
   *  display-only label, both keyed by date on the Schedule tab. */
  const [centerDateHours, setCenterDateHours] = useState<ApiCenterDateHours[]>([])
  const [doctorDateHours, setDoctorDateHours] = useState<ApiDoctorDateHours[]>([])
  /** This centre's usual opening-hours string — the placeholder when no date override exists. */
  const [centerDefaultHours, setCenterDefaultHours] = useState('')

  useEffect(() => {
    if (activeTab !== 'schedule' || !queue.centerId) { setCenterDateHours([]); setDoctorDateHours([]); return }
    let cancelled = false
    api.getCenterDayHours(queue.centerId)
      .then(res => {
        if (cancelled) return
        setCenterDateHours(res.centerHours)
        setDoctorDateHours(res.doctorHours)
      })
      .catch(() => { if (!cancelled) { setCenterDateHours([]); setDoctorDateHours([]) } })
    return () => { cancelled = true }
  }, [activeTab, queue.centerId, scheduleReloadKey])

  useEffect(() => {
    if (activeTab !== 'schedule' || !queue.centerId) return
    let cancelled = false
    api.getCenters()
      .then(res => {
        if (cancelled) return
        const mine = res.centers.find(c => c.id === queue.centerId)
        setCenterDefaultHours(mine?.opening_hours ?? '')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [activeTab, queue.centerId])

  /** Local YYYY-MM-DD, recomputed each minute so the table rolls over at midnight. */
  const todayIso = useMemo(() => {
    const d = queue.now
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [queue.now])

  /** Apply the shared search box; optionally collapse to one row per patient. */
  const filterRows = (rows: ApiAppointmentRow[], opts: { dedupe: boolean }) => {
    const q = patientSearch.trim().toLowerCase()
    const seen = new Set<string>()
    const out: ApiAppointmentRow[] = []
    for (const a of rows) {
      if (opts.dedupe) {
        const key = patientKey(a.patientName, a.phone)
        if (seen.has(key)) continue
        seen.add(key)
      }
      if (
        !q ||
        a.patientName.toLowerCase().includes(q) ||
        (a.nic ?? '').toLowerCase().includes(q) ||
        a.queueToken.toLowerCase().includes(q)
      ) {
        out.push(a)
      }
    }
    return out
  }

  /** Table 1 — every appointment dated today, whatever its status; resets daily. */
  const todaysSession = useMemo(
    () => filterRows(allAppointments.filter(a => a.appointmentDate === todayIso), { dedupe: false }),
    [allAppointments, patientSearch, todayIso],
  )

  /** Table 2 — every patient who has ever booked at this center. */
  const allPatients = useMemo(
    () => filterRows(allAppointments, { dedupe: true }),
    [allAppointments, patientSearch],
  )

  /**
   * One row per known patient — name, NIC and phone — drawn from every
   * appointment at this center plus anyone already in today's walk-in queue.
   * Collapsed on {@link patientKey} so a repeat visitor appears once; the two
   * sources are merged field-by-field so a record missing a NIC on one side
   * can still be completed from the other.
   */
  const patientDirectory = useMemo(() => {
    const byKey = new Map<string, { name: string; nic: string; phone: string }>()
    const add = (rawName: string, rawNic: string, rawPhone: string) => {
      const name = (rawName || '').trim()
      if (!name) return
      const nic = (rawNic || '').trim()
      const phone = (rawPhone || '').trim()
      const key = patientKey(name, phone)
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, { name, nic, phone })
        return
      }
      if (!existing.nic && nic) existing.nic = nic
      if (!existing.phone && phone) existing.phone = phone
    }
    for (const a of allAppointments) add(a.patientName, a.nic ?? '', a.phone)
    for (const e of queue.entries) add(e.patientName, e.nic ?? '', e.phone)
    return [...byKey.values()]
  }, [allAppointments, queue.entries])

  /** Directory rows matching what's typed in the name field; prefix hits first. */
  const nameSuggestions = useMemo(() => {
    const q = formName.trim().toLowerCase()
    if (q.length < 2) return []
    const prefix: typeof patientDirectory = []
    const infix: typeof patientDirectory = []
    for (const p of patientDirectory) {
      const name = p.name.toLowerCase()
      if (name === q) continue
      if (name.startsWith(q)) prefix.push(p)
      else if (name.includes(q)) infix.push(p)
    }
    return [...prefix, ...infix].slice(0, 6)
  }, [patientDirectory, formName])

  const pickPatient = (p: { name: string; nic: string; phone: string }) => {
    setFormName(p.name)
    setFormNic(p.nic)
    setFormPhone(p.phone)
    setNameMenuOpen(false)
    setNameHighlight(-1)
    queue.clearError()
    physicalInputRef.current?.focus()
  }

  const canIssue =
    !queue.issuing &&
    formName.trim().length > 0 &&
    physicalToken.trim().length > 0 &&
    phoneCheck.ok &&
    nicCheck.ok

  /**
   * The selected doctor's line, split by what the receptionist can act on.
   *
   * The old table listed every token of the day in one flat run — completed,
   * no-shows and the people still waiting all interleaved by token number — so
   * finding who was actually next meant reading the Status column of every row.
   */
  const segments = useMemo(() => {
    const live = queue.doctorQueue.filter(e => e.status === 'called' || e.status === 'in_progress')
    const waitingRows = queue.doctorQueue.filter(e => e.status === 'waiting')
    const closed = queue.doctorQueue.filter(
      e => e.status === 'completed' || e.status === 'left' || e.status === 'cancelled',
    )
    return {
      live,
      waiting: waitingRows,
      closed,
      completed: closed.filter(e => e.status === 'completed').length,
      noShow: closed.filter(e => e.status === 'left' || e.status === 'cancelled').length,
    }
  }, [queue.doctorQueue])

  const activeAlerts = useMemo(() => queue.delayAlerts.filter(a => a.isActive), [queue.delayAlerts])

  /** Name of the center this desk is scoped to, taken from the roster it loaded. */
  const deskCenterName = useMemo(
    () => queue.doctors.find(d => d.centerName)?.centerName ?? null,
    [queue.doctors],
  )

  const showDelayToast = (msg: string) => {
    setDelayToast(msg)
    setTimeout(() => setDelayToast(null), 4000)
  }

  const handleRaiseDelay = async (delayMinutes: number, reason: string) => {
    const res = await queue.raiseDelay(delayMinutes, reason)
    // Throwing lets DelayAlertModal show the failure inline rather than
    // confirming a dispatch that didn't happen.
    if (!res.ok) throw new Error(res.message)
    showDelayToast(res.message)
  }

  const handleClearDelay = async (alertId: string) => {
    const res = await queue.clearDelay(alertId)
    showDelayToast(res.message)
  }

  // ── Schedule tab ─────────────────────────────────────────────────────────

  /** The 7 local ISO dates from today (inclusive). */
  const next7Days = useMemo(() => {
    const base = queue.now
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
  }, [queue.now])

  const closureByDate = useMemo(() => {
    const m = new Map<string, ApiCenterClosure>()
    for (const c of closures) m.set(c.closedDate, c)
    return m
  }, [closures])

  const apptsByDate = useMemo(() => {
    const m = new Map<string, ApiAppointmentRow[]>()
    for (const a of allAppointments) {
      const list = m.get(a.appointmentDate)
      if (list) list.push(a)
      else m.set(a.appointmentDate, [a])
    }
    return m
  }, [allAppointments])

  const centerHoursByDate = useMemo(() => {
    const m = new Map<string, ApiCenterDateHours>()
    for (const c of centerDateHours) m.set(c.openDate, c)
    return m
  }, [centerDateHours])

  /** date -> doctorId -> that doctor's override for that date. */
  const doctorHoursByDate = useMemo(() => {
    const m = new Map<string, Map<string, ApiDoctorDateHours>>()
    for (const d of doctorDateHours) {
      if (!m.has(d.workDate)) m.set(d.workDate, new Map())
      m.get(d.workDate)!.set(d.doctorId, d)
    }
    return m
  }, [doctorDateHours])

  /** Which day a closure is being confirmed for, plus the reason draft. */
  const [closingDate, setClosingDate] = useState<string | null>(null)
  const [closingReason, setClosingReason] = useState('')
  const [scheduleBusy, setScheduleBusy] = useState(false)

  const confirmCloseDay = async () => {
    if (!closingDate || !queue.centerId) return
    setScheduleBusy(true)
    try {
      const res = await api.createCenterClosure(queue.centerId, {
        date: closingDate,
        reason: closingReason.trim(),
      })
      showDelayToast(
        res.alreadyClosed
          ? `${closingDate} was already marked closed.`
          : `${closingDate} closed · ${res.cancelledCount} appointment${res.cancelledCount === 1 ? '' : 's'} cancelled · ${res.notifiedCount} patient${res.notifiedCount === 1 ? '' : 's'} notified`,
      )
      setClosingDate(null)
      setClosingReason('')
      setScheduleReloadKey(k => k + 1)
    } catch (err) {
      showDelayToast(err instanceof Error ? err.message : 'Could not close this day.')
    } finally {
      setScheduleBusy(false)
    }
  }

  const reopenDay = async (date: string) => {
    if (!queue.centerId) return
    setScheduleBusy(true)
    try {
      const res = await api.deleteCenterClosure(queue.centerId, date)
      showDelayToast(res.message)
      setScheduleReloadKey(k => k + 1)
    } catch (err) {
      showDelayToast(err instanceof Error ? err.message : 'Could not re-open this day.')
    } finally {
      setScheduleBusy(false)
    }
  }

  // ── Date-specific hours editor (migration 014) ──────────────────────────
  interface DoctorHoursDraft { isWorking: boolean; startTime: string; endTime: string }

  /** The day whose "Edit hours" panel is open, plus its working copies. */
  const [editingHoursDate, setEditingHoursDate] = useState<string | null>(null)
  const [centerLabelDraft, setCenterLabelDraft] = useState('')
  const [centerNoteDraft, setCenterNoteDraft] = useState('')
  const [doctorHoursDraft, setDoctorHoursDraft] = useState<Record<string, DoctorHoursDraft>>({})

  const openHoursEditor = (date: string) => {
    setEditingHoursDate(prev => (prev === date ? null : date))
    const ch = centerHoursByDate.get(date)
    setCenterLabelDraft(ch?.hoursLabel ?? '')
    setCenterNoteDraft(ch?.note ?? '')
    const perDoctor = doctorHoursByDate.get(date)
    const draft: Record<string, DoctorHoursDraft> = {}
    for (const d of queue.doctors) {
      const existing = perDoctor?.get(d.id)
      draft[d.id] = {
        isWorking: existing?.isWorking ?? true,
        startTime: existing?.startTime ?? '08:00',
        endTime: existing?.endTime ?? '17:00',
      }
    }
    setDoctorHoursDraft(draft)
  }

  const saveCenterHours = async (date: string) => {
    if (!queue.centerId) return
    setScheduleBusy(true)
    try {
      await api.putCenterDateHours(queue.centerId, {
        date, hoursLabel: centerLabelDraft.trim(), note: centerNoteDraft.trim(),
      })
      showDelayToast(`Centre hours for ${date} updated.`)
      setScheduleReloadKey(k => k + 1)
    } catch (err) {
      showDelayToast(err instanceof Error ? err.message : 'Could not save the centre hours.')
    } finally {
      setScheduleBusy(false)
    }
  }

  const resetCenterHours = async (date: string) => {
    if (!queue.centerId) return
    setScheduleBusy(true)
    try {
      await api.deleteCenterDateHours(queue.centerId, date)
      setCenterLabelDraft('')
      setCenterNoteDraft('')
      showDelayToast(`Centre hours for ${date} reverted to the default.`)
      setScheduleReloadKey(k => k + 1)
    } catch (err) {
      showDelayToast(err instanceof Error ? err.message : 'Could not reset the centre hours.')
    } finally {
      setScheduleBusy(false)
    }
  }

  const saveDoctorHours = async (date: string, doctorId: string) => {
    if (!queue.centerId) return
    const draft = doctorHoursDraft[doctorId]
    if (!draft) return
    if (draft.isWorking && draft.startTime >= draft.endTime) {
      showDelayToast('End time must be after start time.')
      return
    }
    setScheduleBusy(true)
    try {
      const res = await api.putDoctorDateHours(queue.centerId, {
        doctorId,
        date,
        isWorking: draft.isWorking,
        startTime: draft.isWorking ? draft.startTime : undefined,
        endTime: draft.isWorking ? draft.endTime : undefined,
      })
      const doctorName = queue.doctors.find(d => d.id === doctorId)?.name ?? 'This doctor'
      const newHours = draft.isWorking ? `${draft.startTime}–${draft.endTime}` : 'not working'
      // A widened or unchanged window cancels nothing — saying "0 cancelled ·
      // 0 notified" there reads like an error or a no-op instead of the
      // successful save it is, so that case gets its own, plainer sentence.
      showDelayToast(
        res.cancelledCount > 0
          ? `${doctorName}'s hours on ${date} set to ${newHours}: ${res.cancelledCount} appointment${res.cancelledCount === 1 ? '' : 's'} no longer fit and ${res.cancelledCount === 1 ? 'was' : 'were'} cancelled · ${res.notifiedCount} patient${res.notifiedCount === 1 ? '' : 's'} notified.`
          : `${doctorName}'s hours on ${date} set to ${newHours}. No existing appointments were affected.`,
      )
      setScheduleReloadKey(k => k + 1)
    } catch (err) {
      showDelayToast(err instanceof Error ? err.message : 'Could not save these hours.')
    } finally {
      setScheduleBusy(false)
    }
  }

  const resetDoctorHours = async (date: string, doctorId: string) => {
    if (!queue.centerId) return
    setScheduleBusy(true)
    try {
      const res = await api.deleteDoctorDateHours(queue.centerId, doctorId, date)
      showDelayToast(res.message)
      setScheduleReloadKey(k => k + 1)
    } catch (err) {
      showDelayToast(err instanceof Error ? err.message : 'Could not reset these hours.')
    } finally {
      setScheduleBusy(false)
    }
  }

  return (
    // App.tsx wraps every route in `paddingTop: 46` to clear the fixed
    // DevNavbar, so a bare `100vh` here made the desk 46px taller than the
    // viewport: the body grew its own scrollbar on top of the desk's internal
    // one, and the bottom of the queue sat below the fold with no way to reach
    // it except the outer scrollbar.
    <div style={{ height: 'calc(100vh - 46px)', overflow: 'hidden', background: 'var(--bg)', display: 'flex' }}>

      {/* Modals */}

      <PublicTvDisplay
        isOpen={showTvDisplay}
        onClose={() => setShowTvDisplay(false)}
        doctor={selectedDoctor}
        current={current}
        waiting={waiting}
        estimateWait={queue.waitFor}
        onCallNext={queue.callNext}
      />

      <AddCenterModal
        isOpen={showRequestCenter}
        onClose={() => { setShowRequestCenter(false); setCenterRequestStatus('idle'); setCenterRequestMsg('') }}
        mode="request"
        onAdd={async (centerData) => {
          const res = await api.createCenter(centerData)
          setCenterRequestStatus('success')
          setCenterRequestMsg(res?.message || 'Request submitted for Super Admin approval!')
        }}
      />

      <DelayAlertModal
        isOpen={showDelayModal}
        onClose={() => setShowDelayModal(false)}
        onSend={handleRaiseDelay}
        doctorName={selectedDoctor?.name ?? 'This doctor'}
        roomNumber={selectedDoctor?.room ?? undefined}
        dept={selectedDoctor?.dept ?? undefined}
      />

      {/* Result of publishing or clearing a delay — states how many patients
          were actually reached rather than assuming it worked. */}
      {delayToast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 99999, maxWidth: 380,
          background: '#0d2623', color: '#ffffff', border: '1px solid var(--emerald)',
          padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span>{delayToast}</span>
          <button
            onClick={() => setDelayToast(null)}
            aria-label="Dismiss"
            style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}
          >✕</button>
        </div>
      )}

      {/* ── MOBILE BACKDROP OVERLAY ── */}
      {showMobileSidebar && (
        <div
          className="mobile-only"
          onClick={() => setShowMobileSidebar(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
        />
      )}

      {/* ── SIDEBAR ── */}
      <div className={`reception-sidebar ${showMobileSidebar ? 'mobile-open' : ''}`} style={{
        width: 260, background: 'var(--surface)', borderRight: '1px solid var(--border-md)',
        display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%'
      }}>
        {/* Branding */}
        {/* The series badge and clinic name are read from the desk's actual
            center and selected doctor. They were hardcoded to "A-01" and
            "Central Clinic", so every receptionist at every branch saw the same
            two labels regardless of where they worked. */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
            borderRadius: 7, padding: '4px 10px', fontSize: 11.5, fontWeight: 700,
            color: 'var(--blue-dark)', flexShrink: 0,
          }}>
            {selectedDoctor?.series && selectedDoctor.series !== '?' ? `Series ${selectedDoctor.series}` : 'Desk'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1.1 }}>Reception Desk</div>
            <div style={{
              fontSize: 11, color: 'var(--text-4)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {deskCenterName ?? 'No center assigned'}
            </div>
          </div>
        </div>

        {/* Nav Tabs */}
        <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingLeft: 8 }}>Navigation</div>
          <button disabled={!centerAccessApproved} onClick={() => { setActiveTab('checkin'); setShowMobileSidebar(false) }} className={`btn ${activeTab === 'checkin' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start', padding: '12px 14px', opacity: centerAccessApproved ? 1 : 0.5 }}>
            <Ticket size={16} /> Issue Tokens & Queue
          </button>
          <button disabled={!centerAccessApproved} onClick={() => { setActiveTab('doctors'); setShowMobileSidebar(false) }} className={`btn ${activeTab === 'doctors' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start', padding: '12px 14px', opacity: centerAccessApproved ? 1 : 0.5 }}>
            <Stethoscope size={16} /> Doctors
          </button>
          <button disabled={!centerAccessApproved} onClick={() => { setActiveTab('patients'); setShowMobileSidebar(false) }} className={`btn ${activeTab === 'patients' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start', padding: '12px 14px', opacity: centerAccessApproved ? 1 : 0.5 }}>
            <Users size={16} /> Patients
          </button>
          <button onClick={() => { setActiveTab('schedule'); setShowMobileSidebar(false) }} className={`btn ${activeTab === 'schedule' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start', padding: '12px 14px' }}>
            <CalendarClock size={16} /> Schedule
          </button>
        </div>

        {/* Actions */}
        <div style={{ padding: '20px 16px', borderTop: '1px solid var(--border-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => { setShowTvDisplay(true); setShowMobileSidebar(false) }} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '12px 14px' }}>
            <Radio size={16} /> TV Display Board
          </button>

          {/* Center request — only if this receptionist has no center yet */}
          {!user?.centerId && (
            <button
              onClick={() => setShowRequestCenter(true)}
              className="btn btn-ghost"
              style={{ justifyContent: 'flex-start', padding: '12px 14px', color: 'var(--blue)' }}
            >
              <Building2 size={16} /> Request Medical Center
            </button>
          )}

          {centerRequestStatus === 'success' && (
            <div style={{
              fontSize: 11.5, color: '#10B981', background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '8px 12px',
            }}>
              ✓ {centerRequestMsg}
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TOPBAR */}
        <div className="topbar" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border-md)', background: 'rgba(255,255,255,0.7)', position: 'sticky', top: 0, zIndex: 30 }}>
          <button
            onClick={() => setShowMobileSidebar(o => !o)}
            className="btn btn-ghost btn-sm mobile-only"
            style={{ gap: 6, padding: '5px 9px', border: '1px solid var(--border-md)', background: '#ffffff' }}
          >
            {showMobileSidebar ? <X size={16} /> : <Menu size={16} />}
          </button>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginLeft: 'auto' }}>
            <button
              onClick={() => setShowTvDisplay(true)}
              className="btn btn-ghost btn-sm"
              style={{ gap: 6, fontSize: 11.5, color: 'var(--text-3)', padding: '5px 11px', border: '1px solid var(--border-md)', background: '#ffffff' }}
            >
              <Radio size={13} color="var(--blue)" /> Public TV Board
            </button>
            {/* Reflects the real connection state instead of always claiming
                the queue is live. */}
            <div className="desktop-only" style={{ alignItems: 'center', gap: 6 }}>
              <span className={queue.offline ? '' : 'pulse-live'} style={queue.offline ? {
                width: 7, height: 7, borderRadius: '50%', background: 'var(--crimson)', display: 'inline-block',
              } : undefined} />
              <span style={{ fontSize: 11, fontWeight: 700, color: queue.offline ? 'var(--crimson)' : 'var(--text-4)' }}>
                {queue.offline ? 'Reconnecting…' : 'Live queue'}
              </span>
            </div>

            {/* Notifications. This was a bare <div> with a permanent red dot —
                it looked like an unread badge, had no click handler and could
                not be reached by keyboard. It now opens the live delay feed,
                and the dot only appears when something is actually unread. */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowNotifications(o => !o)}
                className="btn btn-ghost btn-sm"
                aria-label={activeAlerts.length > 0 ? `Notifications: ${activeAlerts.length} active delay alerts` : 'Notifications: none'}
                aria-expanded={showNotifications}
                style={{ padding: '6px 8px', position: 'relative' }}
              >
                <Bell size={16} color={activeAlerts.length > 0 ? '#B45309' : 'var(--text-3)'} />
                {activeAlerts.length > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2, minWidth: 14, height: 14, padding: '0 3px',
                    background: 'var(--crimson)', color: '#fff', borderRadius: 8,
                    fontSize: 9, fontWeight: 800, lineHeight: '14px', textAlign: 'center',
                  }}>{activeAlerts.length}</span>
                )}
              </button>

              {showNotifications && (
                <>
                  <div
                    onClick={() => setShowNotifications(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  />
                  <div className="card" style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 41,
                    width: 320, maxHeight: 380, overflowY: 'auto', padding: 14,
                    background: '#ffffff', border: '1px solid var(--border-md)',
                    borderRadius: 12, boxShadow: '0 12px 32px rgba(15,23,42,0.16)',
                  }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-1)', marginBottom: 10 }}>
                      Delay alerts at this center
                    </div>
                    {activeAlerts.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-4)', padding: '10px 0' }}>
                        No doctors are running late right now.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {activeAlerts.map(a => (
                          <div key={a.id} style={{
                            padding: 10, borderRadius: 9, fontSize: 12,
                            background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
                          }}>
                            <div style={{ fontWeight: 800, color: '#B45309' }}>
                              {a.doctorName} · +{a.delayMinutes} min
                            </div>
                            <div style={{ color: 'var(--text-3)', marginTop: 2 }}>
                              {a.reason || 'No reason given'}
                            </div>
                            <div style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 4 }}>
                              {a.notifiedCount} notified by SMS
                            </div>
                            <button
                              onClick={() => { handleClearDelay(a.id); setShowNotifications(false) }}
                              className="btn btn-ghost btn-sm"
                              style={{ marginTop: 7, gap: 4, color: '#047857', fontSize: 11 }}
                            >
                              <CheckCircle2 size={11} /> Mark back on schedule
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <AccountMenu />
          </div>
        </div>

        {/* CONTENT SCROLL AREA */}
        <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>

          {/* CLINIC-WIDE STAT RIBBON — one line, so it never competes with the live queue below */}
          <div style={{ padding: '18px 24px 0', display: 'flex', gap: 34, flexWrap: 'wrap' }}>
            <StatPill icon={<Ticket size={15} />} label="Issued Today" value={String(issuedToday)} />
            <StatPill icon={<Users size={15} />} label="Waiting Clinic-wide" value={String(waitingInLobby)} accent="var(--amber)" />
            <StatPill icon={<Clock size={15} />} label="Avg. Wait" value={`${avgWait} min`} accent="var(--blue)" />
            <StatPill icon={<Activity size={15} />} label="Doctors On Duty" value={`${activeDoctors}/${queue.doctors.length}`} accent="#10B981" />
          </div>

          {(queue.offline || queue.migrationPending) && (
            <div style={{ padding: '14px 24px 0' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600,
                color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
                borderRadius: 9, padding: '9px 14px',
              }}>
                <AlertCircle size={14} />
                {queue.offline
                  ? "Backend not reachable — showing demo data. Start the backend (npm run dev in backend/) to use the live queue."
                  : "Connected to the backend, but the walk-in queue table doesn't exist yet — run backend/src/db/migrations/002_walk_in_queue.sql in the Supabase SQL Editor, then refresh."}
              </div>
            </div>
          )}

          {user?.centerApprovalStatus === 'pending' && (
            <div style={{ padding: '14px 24px 0' }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, fontWeight: 600,
                color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
                borderRadius: 9, padding: '12px 14px',
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Your medical center request is awaiting Super Admin approval. You can sign in and view this page, but queue, doctor, patient, and token actions will be available after approval.
                </span>
              </div>
            </div>
          )}

          {user?.centerApprovalStatus === 'pending' && (
            <div style={{
              position: 'absolute', inset: 0, top: 92, zIndex: 20,
              background: 'rgba(248, 250, 252, 0.62)', cursor: 'not-allowed',
            }} aria-label="Receptionist actions are disabled while approval is pending" />
          )}

          {!queue.offline && !queue.loading && !queue.centerId && (
            <div style={{ padding: '14px 24px 0' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600,
                color: user?.rejectionReason ? 'var(--amber)' : 'var(--crimson)',
                background: user?.rejectionReason ? 'var(--amber-dim)' : 'var(--crimson-dim)',
                border: user?.rejectionReason ? '1px solid var(--amber-border)' : '1px solid var(--crimson-border)',
                borderRadius: 9, padding: '9px 14px',
              }}>
                <AlertCircle size={14} />
                <span style={{ flex: 1 }}>
                  {user?.rejectionReason
                    ? <>Your previous medical center request was rejected: <strong>{user.rejectionReason}</strong>. Submit a new request with corrected details.</>
                    : "Your account isn't linked to a medical center yet, so no doctors are shown. Request a medical center to get started."}
                </span>
                <button
                  onClick={() => setShowRequestCenter(true)}
                  className="btn btn-primary btn-sm"
                  style={{ flexShrink: 0, gap: 6, whiteSpace: 'nowrap' }}
                >
                  <Building2 size={13} /> {user?.rejectionReason ? 'Resubmit Request' : 'Request Medical Center'}
                </button>
              </div>
            </div>
          )}

          {/* CHECK-IN & COUNTER QUEUE TAB — nothing to issue against until a
              doctor is assigned to this receptionist's medical center. */}
          {activeTab === 'checkin' && !queue.loading && queue.doctors.length === 0 && (
            <div style={{ padding: '24px 24px 36px' }}>
              <div style={{
                textAlign: 'center', padding: '64px 24px',
                background: 'rgba(255,255,255,0.5)', borderRadius: 16,
                border: '1.5px dashed var(--border-md)',
              }}>
                <Stethoscope size={40} style={{ margin: '0 auto 16px', color: 'var(--text-4)' }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)' }}>No doctors assigned to your center</div>
                <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 4, maxWidth: 380, marginInline: 'auto' }}>
                  Tokens are issued per doctor. Request a doctor from the Doctors tab and issue tokens once an admin approves the assignment.
                </div>
                <button
                  onClick={() => setActiveTab('doctors')}
                  className="btn btn-primary"
                  style={{ gap: 7, padding: '0 16px', height: 38, fontSize: 13, marginTop: 18 }}
                >
                  <Stethoscope size={14} /> Go to Doctors
                </button>
              </div>
            </div>
          )}

          {activeTab === 'checkin' && queue.doctors.length > 0 && (
            <>
              {/* QUEUE HEADER — switch doctors here without leaving the tab */}
              <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('doctors')} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13, gap: 6 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> Back to Roster
                </button>
                <div style={{ width: 1, height: 20, background: 'var(--border-md)' }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-4)' }}>Queue for</div>
                <select
                  className="input"
                  value={queue.selectedDoctorId}
                  onChange={e => { queue.setSelectedDoctorId(e.target.value); queue.clearError() }}
                  style={{ width: 'auto', height: 38, fontSize: 14.5, fontWeight: 800, padding: '0 12px', color: 'var(--text-1)' }}
                >
                  {queue.doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} — {d.dept}</option>
                  ))}
                </select>
              </div>

              {/* LIVE QUEUE HERO — the two things a receptionist needs at a glance, big enough to read from a step back */}
              <div style={{ padding: '14px 24px 0' }}>
                <div className="card glass-form-card reception-hero-grid">
                  <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, minWidth: 0 }}>
                    <span className="eyebrow">Now Serving · {selectedDoctor?.name}</span>
                    {current ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span style={{ fontSize: 56, fontWeight: 900, fontFamily: 'monospace', color: 'var(--emerald)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                            {entryToken(current)}
                          </span>
                          <span className="pulse-live" />
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{current.patientName}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <button
                            onClick={queue.completeCurrent}
                            disabled={queue.completing}
                            className="btn btn-ghost"
                            style={{ gap: 6, fontWeight: 700, color: 'var(--emerald)' }}
                          >
                            <CheckCircle2 size={15} /> Mark Complete
                          </button>
                          <button
                            onClick={() => queue.setStatus(current.id, 'left')}
                            className="btn btn-ghost"
                            style={{ gap: 6, fontWeight: 700, color: 'var(--crimson)' }}
                          >
                            <UserX size={15} /> No-Show
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 15, color: 'var(--text-4)', paddingTop: 8, paddingBottom: 8 }}>
                        Room is free — call the next token when ready.
                      </div>
                    )}
                  </div>

                  <div className="reception-hero-divider" />

                  <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, minWidth: 0 }}>
                    <span className="eyebrow">Up Next</span>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'monospace', color: upNext ? 'var(--blue)' : 'var(--text-4)', lineHeight: 1 }}>
                        {upNext ? entryToken(upNext) : '— queue empty —'}
                      </div>
                      {upNext && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 5 }}>{upNext.patientName}</div>}
                    </div>
                    <button
                      onClick={queue.callNext}
                      disabled={queue.calling || !upNext}
                      className={`btn btn-emerald ${upNext ? 'btn-attention' : ''}`}
                      style={{
                        gap: 8, fontWeight: 800, fontSize: 16, height: 54, borderRadius: 11,
                        opacity: upNext ? 1 : 0.5, cursor: upNext ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <BellRing size={19} /> Call Next Patient
                    </button>
                  </div>
                </div>
              </div>

              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, padding: '18px 24px 28px' }}>
                {/* Token issuance form card */}
                <div className="card glass-form-card" style={{ padding: 26 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Plus size={17} color="var(--blue)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>Issue Token — {selectedDoctor?.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>
                        <>Series <strong style={{ color: 'var(--blue)' }}>{selectedDoctor?.series}</strong> · pre-printed slip</>
                      </div>
                    </div>
                  </div>

                  <form
                    onSubmit={e => { e.preventDefault(); if (canIssue) handleIssueToken() }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                  >
                    {tokenSource === 'physical' && (
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Printed Token Number</label>

                        {/* Tap the next slip number instead of typing it — the nearest available one is highlighted. */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {nextAvailableTokens.map((n, i) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => { setPhysicalToken(String(n)); queue.clearError() }}
                              className={`btn btn-sm ${physicalToken === String(n) ? 'btn-primary' : i === 0 ? 'btn-amber' : 'btn-ghost'}`}
                              style={{ width: 44, height: 40, padding: 0, justifyContent: 'center', fontWeight: 800, fontFamily: 'monospace', fontSize: 13.5 }}
                              title={i === 0 ? 'Next available number' : undefined}
                            >
                              {n}
                            </button>
                          ))}
                        </div>

                        <input
                          ref={physicalInputRef}
                          className="input"
                          type="number"
                          min={1}
                          placeholder="Or type a different number"
                          value={physicalToken}
                          onChange={e => { setPhysicalToken(e.target.value); queue.clearError() }}
                          style={{ height: 42, fontSize: 14, borderColor: queue.error ? 'var(--crimson-border)' : undefined }}
                        />
                        {/* Numbers already handed out today — stops the same slip being recorded twice */}
                        {issuedNumbers.length > 0 && (
                          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 700, width: '100%', marginBottom: 3 }}>
                              Issued & Used Token Numbers (Series {selectedDoctor?.series}):
                            </span>
                            {issuedNumbers.map(n => {
                              const entry = queue.doctorQueue.find(e => e.tokenNumber === n)
                              const isCancelled = entry?.status === 'cancelled' || entry?.status === 'left'
                              const live = entry?.status === 'waiting' || entry?.status === 'called' || entry?.status === 'in_progress'

                              return (
                                <span
                                  key={n}
                                  title={isCancelled ? 'Booking Cancelled / No-Show' : live ? 'Active in Queue' : 'Completed'}
                                  style={{
                                    fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
                                    fontFamily: 'monospace',
                                    background: isCancelled ? 'rgba(239, 68, 68, 0.15)' : live ? 'var(--blue-dim)' : 'rgba(30, 41, 59, 0.06)',
                                    border: `1px solid ${isCancelled ? 'rgba(239, 68, 68, 0.4)' : live ? 'var(--blue-border)' : 'var(--border-md)'}`,
                                    color: isCancelled ? '#ef4444' : live ? 'var(--blue)' : 'var(--text-4)',
                                    textDecoration: isCancelled ? 'line-through' : 'none'
                                  }}
                                >
                                  {formatToken(selectedDoctor?.series || 'A', n)}
                                  {isCancelled ? ' (Cancelled)' : live ? ' (Active)' : ' (Done)'}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div style={{ position: 'relative' }}>
                      <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient Full Name</label>
                      <input
                        ref={nameInputRef}
                        autoFocus
                        className="input"
                        placeholder="e.g. Sunil Perera"
                        value={formName}
                        autoComplete="off"
                        role="combobox"
                        aria-expanded={nameMenuOpen && nameSuggestions.length > 0}
                        aria-autocomplete="list"
                        onChange={e => { setFormName(e.target.value); setNameMenuOpen(true); setNameHighlight(-1); queue.clearError() }}
                        onFocus={() => setNameMenuOpen(true)}
                        onBlur={() => setNameMenuOpen(false)}
                        onKeyDown={e => {
                          if (!nameMenuOpen || nameSuggestions.length === 0) return
                          if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            setNameHighlight(i => Math.min(i + 1, nameSuggestions.length - 1))
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            setNameHighlight(i => Math.max(i - 1, 0))
                          } else if (e.key === 'Enter' && nameHighlight >= 0) {
                            e.preventDefault()
                            pickPatient(nameSuggestions[nameHighlight])
                          } else if (e.key === 'Escape') {
                            setNameMenuOpen(false)
                            setNameHighlight(-1)
                          }
                        }}
                        style={{ height: 42, fontSize: 14 }}
                      />

                      {/* Existing-patient matches — pick one to fill NIC + phone
                          from that person's last visit. */}
                      {nameMenuOpen && nameSuggestions.length > 0 && (
                        <div
                          role="listbox"
                          style={{
                            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
                            background: '#ffffff', border: '1px solid var(--border-md)', borderRadius: 10,
                            boxShadow: '0 12px 32px rgba(15,23,42,0.16)', overflow: 'hidden auto', maxHeight: 264,
                          }}
                        >
                          {nameSuggestions.map((p, i) => (
                            <button
                              key={`${p.name}|${p.phone}`}
                              type="button"
                              role="option"
                              aria-selected={i === nameHighlight}
                              onMouseDown={e => e.preventDefault()}
                              onMouseEnter={() => setNameHighlight(i)}
                              onClick={() => pickPatient(p)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                                padding: '9px 12px', border: 'none', cursor: 'pointer',
                                background: i === nameHighlight ? 'var(--blue-dim)' : 'transparent',
                                borderBottom: i < nameSuggestions.length - 1 ? '1px solid var(--border)' : 'none',
                              }}
                            >
                              <Users size={13} color="var(--text-4)" style={{ flexShrink: 0 }} />
                              <span style={{ minWidth: 0 }}>
                                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {p.name}
                                </span>
                                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-4)' }}>
                                  {[p.phone, p.nic].filter(Boolean).join('  ·  ') || 'No contact on file'}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="form-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NIC <span style={{ color: 'var(--text-4)', fontWeight: 600 }}>(optional)</span></label>
                        <input
                          className="input"
                          placeholder="200012312345 or 891234567V"
                          value={formNic}
                          onChange={e => { setFormNic(e.target.value); queue.clearError() }}
                          aria-invalid={!nicCheck.ok}
                          style={{ height: 42, fontSize: 14, borderColor: !nicCheck.ok ? 'var(--crimson-border)' : undefined }}
                        />
                        {!nicCheck.ok && (
                          <div style={{ fontSize: 11, color: 'var(--crimson)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertCircle size={11} /> {nicCheck.message}
                          </div>
                        )}
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mobile (SMS) <span style={{ color: 'var(--crimson)', fontWeight: 700 }}>*</span></label>
                        <input
                          className="input"
                          placeholder="0771234567"
                          inputMode="tel"
                          value={formPhone}
                          onChange={e => { setFormPhone(e.target.value); queue.clearError() }}
                          aria-invalid={formPhone.trim().length > 0 && !phoneCheck.ok}
                          style={{ height: 42, fontSize: 14, borderColor: formPhone.trim().length > 0 && !phoneCheck.ok ? 'var(--crimson-border)' : undefined }}
                        />
                        {formPhone.trim().length > 0 && !phoneCheck.ok && (
                          <div style={{ fontSize: 11, color: 'var(--crimson)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertCircle size={11} /> {phoneCheck.message}
                          </div>
                        )}
                      </div>
                    </div>

                    {queue.error && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600,
                        color: 'var(--crimson)', background: 'var(--crimson-dim)',
                        border: '1px solid var(--crimson-border)', borderRadius: 9, padding: '9px 12px',
                      }}>
                        <AlertCircle size={14} /> {queue.error}
                      </div>
                    )}

                    {issued && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700,
                        color: 'var(--emerald)', background: 'var(--emerald-dim)',
                        border: '1px solid var(--emerald-border)', borderRadius: 9, padding: '9px 12px',
                      }}>
                        <CheckCircle2 size={14} /> Token {issued} issued · SMS dispatched
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!canIssue}
                      className={`btn ${tokenSource === 'physical' ? 'btn-amber' : 'btn-primary'}`}
                      style={{
                        width: '100%', marginTop: 2, height: 44, fontSize: 14.5, fontWeight: 700, borderRadius: 10,
                        opacity: canIssue ? 1 : 0.55, cursor: canIssue ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {tokenSource === 'physical'
                        ? <><Hash size={16} /> {queue.issuing ? 'Recording…' : 'Record Printed Token'}</>
                        : <><Ticket size={16} /> {queue.issuing ? 'Issuing…' : 'Issue Token & Send SMS'}</>}
                    </button>
                  </form>
                </div>

                {/* ACTIVE QUEUE — the selected doctor's live line, segmented so
                    the people still waiting are never buried among finished
                    tokens. Each waiting row leads with its place in line, which
                    is the one thing a patient at the counter actually asks. */}
                <div className="card glass-form-card" style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Header: identity, segment counts, delay control */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)' }}>
                        Active Queue — {selectedDoctor?.name ?? '—'}
                      </h3>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 7 }}>
                        <CountChip label="waiting" value={segments.waiting.length} tone="amber" />
                        <CountChip label="in consultation" value={segments.live.length} tone="emerald" />
                        <CountChip label="completed" value={segments.completed} tone="ghost" />
                        {segments.noShow > 0 && <CountChip label="no-show" value={segments.noShow} tone="crimson" />}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={queue.refresh}
                        className="btn btn-ghost btn-sm"
                        style={{ gap: 5, border: '1px solid var(--border-md)' }}
                        title="Refresh now (the queue also polls every few seconds)"
                      >
                        <RefreshCw size={12} /> Refresh
                      </button>
                      {queue.selectedDoctorDelay ? (
                        <button
                          onClick={() => handleClearDelay(queue.selectedDoctorDelay!.id)}
                          className="btn btn-ghost btn-sm"
                          style={{ gap: 5, color: '#047857', border: '1px solid var(--emerald-border)' }}
                        >
                          <CheckCircle2 size={12} /> Clear delay
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowDelayModal(true)}
                          disabled={!selectedDoctor}
                          className="btn btn-ghost btn-sm"
                          style={{ gap: 5, color: '#B45309', border: '1px solid var(--amber-border)', opacity: selectedDoctor ? 1 : 0.5 }}
                          title="Tell subscribed patients this doctor is running late"
                        >
                          <TriangleAlert size={12} /> Raise delay
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live delay notice for this doctor */}
                  {queue.selectedDoctorDelay && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                      background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
                      borderRadius: 10, padding: '10px 14px', fontSize: 12.5,
                    }}>
                      <TriangleAlert size={15} color="#B45309" style={{ flexShrink: 0 }} />
                      <span style={{ color: '#B45309', fontWeight: 800 }}>
                        Running {queue.selectedDoctorDelay.delayMinutes} min late
                      </span>
                      <span style={{ color: 'var(--text-3)' }}>
                        {queue.selectedDoctorDelay.reason || 'No reason given'}
                      </span>
                      <span style={{ color: 'var(--text-4)', fontSize: 11.5, marginLeft: 'auto' }}>
                        {queue.selectedDoctorDelay.notifiedCount} patient
                        {queue.selectedDoctorDelay.notifiedCount === 1 ? '' : 's'} notified by SMS
                      </span>
                    </div>
                  )}

                  {queue.loading ? (
                    <QueueSkeleton />
                  ) : queue.doctorQueue.length === 0 ? (
                    <div style={{
                      textAlign: 'center', padding: '48px 24px',
                      background: 'rgba(255,255,255,0.5)', borderRadius: 12,
                      border: '1.5px dashed var(--border-md)',
                    }}>
                      <Ticket size={32} style={{ margin: '0 auto 12px', color: 'var(--text-4)' }} />
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-2)' }}>No tokens issued today</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4 }}>
                        Record a printed slip on the left and it appears here immediately.
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* ── IN CONSULTATION ── */}
                      {segments.live.length > 0 && (
                        <section>
                          <div className="queue-section-label">In consultation</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {segments.live.map(entry => (
                              <QueueRow
                                key={entry.id}
                                entry={entry}
                                tone="live"
                                now={queue.now}
                                onDone={() => queue.setStatus(entry.id, 'completed')}
                                onNoShow={() => queue.setStatus(entry.id, 'left')}
                              />
                            ))}
                          </div>
                        </section>
                      )}

                      {/* ── WAITING, in call order ── */}
                      <section>
                        <div className="queue-section-label">
                          Waiting in lobby
                          {segments.waiting.length > 0 && <span> · next up is {entryToken(segments.waiting[0])}</span>}
                        </div>
                        {segments.waiting.length === 0 ? (
                          <div style={{
                            padding: '18px 16px', borderRadius: 10, fontSize: 12.5, color: 'var(--text-4)',
                            background: 'rgba(30,41,59,0.03)', border: '1px dashed var(--border-md)', textAlign: 'center',
                          }}>
                            Nobody waiting — the lobby is clear for this doctor.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {segments.waiting.map((entry, i) => (
                              <QueueRow
                                key={entry.id}
                                entry={entry}
                                tone="waiting"
                                position={i + 1}
                                estWait={queue.waitFor(entry)}
                                now={queue.now}
                                onCall={i === 0 ? queue.callNext : () => queue.setStatus(entry.id, 'called')}
                                onDone={() => queue.setStatus(entry.id, 'completed')}
                                onNoShow={() => queue.setStatus(entry.id, 'left')}
                              />
                            ))}
                          </div>
                        )}
                      </section>

                      {/* ── CLOSED — reference only, collapsed by default ── */}
                      {segments.closed.length > 0 && (
                        <section>
                          <button
                            onClick={() => setShowClosed(o => !o)}
                            className="btn btn-ghost btn-sm"
                            style={{ gap: 6, padding: '5px 10px', color: 'var(--text-3)' }}
                            aria-expanded={showClosed}
                          >
                            {showClosed ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                            Finished today ({segments.closed.length})
                          </button>
                          {showClosed && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                              {segments.closed.map(entry => (
                                <QueueRow key={entry.id} entry={entry} tone="closed" now={queue.now} />
                              ))}
                            </div>
                          )}
                        </section>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* PATIENTS TAB — two lists: everyone booked in for today, then the
              subset waiting on a doctor who is on duty, where the receptionist
              issues the walk-in token after verifying name + phone. */}
          {activeTab === 'patients' && (
            <div style={{ padding: '18px 24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

              {/* ── TABLE 1 — today's session, rolls over daily ── */}
              <div className="card glass-form-card" style={{ padding: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Today's Session</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-4)' }}>
                      Every appointment at {deskCenterName ?? 'this center'} dated today, whatever its status — this list resets each day.
                    </div>
                  </div>
                  <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
                    <Search size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      className="input"
                      placeholder="Search by Name, NIC, or Token..."
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                      style={{ paddingLeft: 36, height: 42, fontSize: 13 }}
                    />
                  </div>
                </div>

                <div className="table-responsive-wrapper">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 740 }}>
                    <thead>
                      <tr style={{ background: 'rgba(18, 198, 186, 0.08)', textAlign: 'left', color: 'var(--text-4)', textTransform: 'uppercase', fontSize: 11 }}>
                        <th style={{ padding: '13px 16px' }}>Name</th>
                        <th style={{ padding: '13px 16px' }}>NIC Number</th>
                        <th style={{ padding: '13px 16px' }}>Phone</th>
                        <th style={{ padding: '13px 16px' }}>Active Token</th>
                        <th style={{ padding: '13px 16px' }}>Assigned Doctor</th>
                        <th style={{ padding: '13px 16px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todaysSession.length === 0 && (
                        <tr>
                          <td colSpan={6} style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--text-4)' }}>
                            {patientSearch ? `No patients match "${patientSearch}".` : 'No appointments dated today.'}
                          </td>
                        </tr>
                      )}
                      {todaysSession.map(p => {
                        const b = apptStatusBadge(p.status)
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--text-1)' }}>{p.patientName}</td>
                            <td style={{ padding: '13px 16px', color: 'var(--text-3)' }}>{p.nic ?? '—'}</td>
                            <td style={{ padding: '13px 16px', color: 'var(--text-3)' }}>{p.phone || '—'}</td>
                            <td style={{ padding: '13px 16px', fontWeight: 800, color: 'var(--blue)', fontFamily: 'monospace' }}>{p.queueToken}</td>
                            <td style={{ padding: '13px 16px', color: 'var(--text-2)' }}>{p.doctorName || '—'}</td>
                            <td style={{ padding: '13px 16px' }}><Badge cls={b.cls}>{b.label}</Badge></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── TABLE 2 — every patient ever booked at this center ── */}
              <div className="card glass-form-card" style={{ padding: 26 }}>
                <div style={{ marginBottom: 18 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>All Patients</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', maxWidth: 620 }}>
                    Every patient who has booked an appointment with a doctor at {deskCenterName ?? 'this center'}, across all dates.
                  </div>
                </div>

                <div className="table-responsive-wrapper">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
                    <thead>
                      <tr style={{ background: 'rgba(18, 198, 186, 0.08)', textAlign: 'left', color: 'var(--text-4)', textTransform: 'uppercase', fontSize: 11 }}>
                        <th style={{ padding: '13px 16px' }}>Name</th>
                        <th style={{ padding: '13px 16px' }}>NIC Number</th>
                        <th style={{ padding: '13px 16px' }}>Phone</th>
                        <th style={{ padding: '13px 16px' }}>Active Token</th>
                        <th style={{ padding: '13px 16px' }}>Assigned Doctor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allPatients.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--text-4)' }}>
                            {patientSearch
                              ? `No patients match "${patientSearch}".`
                              : 'No patients have booked an appointment at this center yet.'}
                          </td>
                        </tr>
                      )}
                      {allPatients.map(p => (
                        <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--text-1)' }}>{p.patientName}</td>
                          <td style={{ padding: '13px 16px', color: 'var(--text-3)' }}>{p.nic ?? '—'}</td>
                          <td style={{ padding: '13px 16px', color: 'var(--text-3)' }}>{p.phone || '—'}</td>
                          <td style={{ padding: '13px 16px', fontWeight: 800, color: 'var(--blue)', fontFamily: 'monospace' }}>{p.queueToken}</td>
                          <td style={{ padding: '13px 16px', color: 'var(--text-2)' }}>{p.doctorName || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SCHEDULE TAB — the next 7 days for this center, and the control to
              mark a day closed (which cancels that day's appointments and SMSes
              the patients — see backend center_closures / migration 012). */}
          {activeTab === 'schedule' && (
            <div style={{ padding: '18px 24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!queue.centerId ? (
                <div className="card glass-form-card" style={{ padding: 26, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
                  Your account isn't linked to a medical center yet, so there's no schedule to manage.
                </div>
              ) : (
                <>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Schedule</h2>
                    <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 2 }}>
                      The next 7 days at {deskCenterName ?? 'this center'}. Mark a day closed to cancel its
                      appointments and text the affected patients.
                    </div>
                  </div>

                  {next7Days.map(date => {
                    const closure = closureByDate.get(date)
                    const dayAppts = (apptsByDate.get(date) ?? [])
                      .slice()
                      .sort((a, b) => a.queueToken.localeCompare(b.queueToken))
                    const activeAppts = dayAppts.filter(a => {
                      const s = (a.status || '').toLowerCase()
                      return s !== 'cancelled' && s !== 'completed' && s !== 'no_show'
                    })
                    const d = new Date(`${date}T00:00:00`)
                    const heading = d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
                    const isToday = date === todayIso
                    const confirming = closingDate === date
                    const editingHours = editingHoursDate === date
                    const dayCenterHours = centerHoursByDate.get(date)
                    const dayDoctorHours = doctorHoursByDate.get(date)
                    const hasHourOverrides = !!dayCenterHours?.hoursLabel || (dayDoctorHours?.size ?? 0) > 0

                    return (
                      <div key={date} className="card glass-form-card" style={{ padding: 20, opacity: closure ? 0.92 : 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{heading}</span>
                            {isToday && <Badge cls="badge-blue">Today</Badge>}
                            {closure ? (
                              <Badge cls="badge-crimson"><CalendarOff size={11} /> Closed</Badge>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-4)' }}>
                                {activeAppts.length} appointment{activeAppts.length === 1 ? '' : 's'}
                              </span>
                            )}
                            {closure?.reason && <span style={{ fontSize: 12, color: 'var(--text-4)' }}>· {closure.reason}</span>}
                          </div>

                          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                            {!closure && (
                              <button
                                onClick={() => openHoursEditor(date)}
                                disabled={scheduleBusy}
                                className={`btn btn-ghost btn-sm ${editingHours ? 'btn-primary' : ''}`}
                                style={editingHours ? { gap: 5 } : { gap: 5, color: 'var(--blue)', border: '1px solid var(--blue-border)' }}
                              >
                                <Clock size={12} /> Edit hours
                              </button>
                            )}
                            {closure ? (
                              <button
                                onClick={() => reopenDay(date)}
                                disabled={scheduleBusy}
                                className="btn btn-ghost btn-sm"
                                style={{ gap: 5, color: '#047857', border: '1px solid var(--emerald-border)' }}
                              >
                                <CheckCircle2 size={12} /> Re-open day
                              </button>
                            ) : !confirming ? (
                              <button
                                onClick={() => { setClosingDate(date); setClosingReason('') }}
                                disabled={scheduleBusy}
                                className="btn btn-ghost btn-sm"
                                style={{ gap: 5, color: 'var(--crimson)', border: '1px solid var(--crimson-border)' }}
                              >
                                <CalendarOff size={12} /> Close this day
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {/* Collapsed summary of any date-specific hours, so the
                            override is visible without opening the editor. */}
                        {!editingHours && hasHourOverrides && (
                          <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-4)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {dayCenterHours?.hoursLabel && (
                              <span>🏥 Centre {dayCenterHours.hoursLabel}</span>
                            )}
                            {queue.doctors.map(doc => {
                              const ov = dayDoctorHours?.get(doc.id)
                              if (!ov) return null
                              return (
                                <span key={doc.id}>
                                  · {doc.name} {ov.isWorking ? `${ov.startTime}–${ov.endTime}` : 'off'}
                                </span>
                              )
                            })}
                          </div>
                        )}

                        {editingHours && (
                          <div style={{
                            marginTop: 12, padding: 14, borderRadius: 10,
                            background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
                            display: 'flex', flexDirection: 'column', gap: 12,
                          }}>
                            {/* Centre hours — display-only label shown to patients */}
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                                Centre hours <span style={{ fontWeight: 500, textTransform: 'none' }}>(shown to patients only — doesn't restrict bookings)</span>
                              </div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                <input
                                  className="input"
                                  placeholder={centerDefaultHours || 'e.g. 10:00 - 14:00'}
                                  value={centerLabelDraft}
                                  onChange={e => setCenterLabelDraft(e.target.value)}
                                  style={{ height: 36, fontSize: 12.5, width: 180 }}
                                />
                                <input
                                  className="input"
                                  placeholder="Note (optional)"
                                  value={centerNoteDraft}
                                  onChange={e => setCenterNoteDraft(e.target.value)}
                                  style={{ height: 36, fontSize: 12.5, flex: 1, minWidth: 140 }}
                                />
                                <button onClick={() => saveCenterHours(date)} disabled={scheduleBusy} className="btn btn-primary btn-sm">Save</button>
                                {dayCenterHours && (
                                  <button onClick={() => resetCenterHours(date)} disabled={scheduleBusy} className="btn btn-ghost btn-sm">Reset</button>
                                )}
                              </div>
                            </div>

                            {/* Per-doctor working hours — this is what actually gates bookable slots */}
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>
                                Doctor hours for {heading}
                              </div>
                              {queue.doctors.length === 0 ? (
                                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>No doctors on this roster.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {queue.doctors.map(doc => {
                                    const draft = doctorHoursDraft[doc.id] ?? { isWorking: true, startTime: '08:00', endTime: '17:00' }
                                    const hasOverride = !!dayDoctorHours?.get(doc.id)
                                    return (
                                      <div key={doc.id} style={{
                                        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                                        padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid var(--border-md)',
                                      }}>
                                        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)', minWidth: 130 }}>{doc.name}</span>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-3)', cursor: 'pointer' }}>
                                          <input
                                            type="checkbox"
                                            checked={draft.isWorking}
                                            onChange={e => setDoctorHoursDraft(prev => ({ ...prev, [doc.id]: { ...draft, isWorking: e.target.checked } }))}
                                          />
                                          Working
                                        </label>
                                        {draft.isWorking && (
                                          <>
                                            <input
                                              type="time"
                                              value={draft.startTime}
                                              onChange={e => setDoctorHoursDraft(prev => ({ ...prev, [doc.id]: { ...draft, startTime: e.target.value } }))}
                                              style={{ height: 32, borderRadius: 6, border: '1px solid var(--border-md)', padding: '0 8px', fontSize: 12.5 }}
                                            />
                                            <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>to</span>
                                            <input
                                              type="time"
                                              value={draft.endTime}
                                              onChange={e => setDoctorHoursDraft(prev => ({ ...prev, [doc.id]: { ...draft, endTime: e.target.value } }))}
                                              style={{ height: 32, borderRadius: 6, border: '1px solid var(--border-md)', padding: '0 8px', fontSize: 12.5 }}
                                            />
                                          </>
                                        )}
                                        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
                                          <button onClick={() => saveDoctorHours(date, doc.id)} disabled={scheduleBusy} className="btn btn-primary btn-sm">Save</button>
                                          {hasOverride && (
                                            <button onClick={() => resetDoctorHours(date, doc.id)} disabled={scheduleBusy} className="btn btn-ghost btn-sm">Reset</button>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {confirming && (
                          <div style={{
                            marginTop: 12, padding: 14, borderRadius: 10,
                            background: 'var(--crimson-dim)', border: '1px solid var(--crimson-border)',
                            display: 'flex', flexDirection: 'column', gap: 10,
                          }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--crimson)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <TriangleAlert size={14} />
                              Close {heading}? {activeAppts.length} appointment{activeAppts.length === 1 ? '' : 's'} will be cancelled
                              and {activeAppts.length === 1 ? 'that patient' : 'those patients'} texted.
                            </div>
                            <input
                              className="input"
                              placeholder="Reason (optional) — e.g. Public holiday"
                              value={closingReason}
                              onChange={e => setClosingReason(e.target.value)}
                              style={{ height: 38, fontSize: 13 }}
                            />
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                onClick={confirmCloseDay}
                                disabled={scheduleBusy}
                                className="btn btn-sm"
                                style={{ background: 'var(--crimson)', color: '#fff', gap: 5 }}
                              >
                                <CalendarOff size={12} /> {scheduleBusy ? 'Closing…' : 'Confirm closure'}
                              </button>
                              <button
                                onClick={() => { setClosingDate(null); setClosingReason('') }}
                                disabled={scheduleBusy}
                                className="btn btn-ghost btn-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {dayAppts.length > 0 ? (
                          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {dayAppts.map(a => {
                              const b = apptStatusBadge(a.status)
                              return (
                                <div key={a.id} style={{
                                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                                  padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: '#fff',
                                }}>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--blue)', minWidth: 64 }}>{a.queueToken}</span>
                                  <span style={{ flex: 1, minWidth: 140, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{a.patientName}</span>
                                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{a.doctorName || '—'}</span>
                                  <Badge cls={b.cls}>{b.label}</Badge>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--text-4)' }}>No appointments.</div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* UNIFIED DOCTORS TAB — Roster + Management merged */}
          {activeTab === 'doctors' && (() => {
            const filteredDoctors = queue.doctors.filter(d => {
              const q = doctorSearch.trim().toLowerCase()
              return !q ||
                d.name.toLowerCase().includes(q) ||
                d.dept.toLowerCase().includes(q) ||
                (d.room ?? '').toLowerCase().includes(q)
            })
            return (
              <div style={{ padding: '18px 24px 36px' }}>

                {/* Modals */}
                <AddDoctorModal
                  isOpen={showAddDoctor || !!editingDoctor}
                  onClose={() => { setShowAddDoctor(false); setEditingDoctor(null) }}
                  centerId={queue.centerId}
                  centerName={queue.doctors[0]?.centerName ?? undefined}
                  editDoctor={editingDoctor}
                  onCreated={() => queue.refresh()}
                />
                <DoctorHoursModal
                  isOpen={!!hoursDoctor}
                  onClose={() => setHoursDoctor(null)}
                  doctor={hoursDoctor}
                  centerId={queue.centerId}
                  onSaved={() => queue.refresh()}
                />

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Doctors</h2>
                    <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 2 }}>
                      {filteredDoctors.length} of {queue.doctors.length} doctor{queue.doctors.length !== 1 ? 's' : ''} · manage queues, schedules &amp; info from one place
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    {/* Search */}
                    <div style={{ position: 'relative' }}>
                      <Search size={14} color="var(--text-4)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      <input
                        className="input"
                        placeholder="Search name, dept, room…"
                        value={doctorSearch}
                        onChange={e => setDoctorSearch(e.target.value)}
                        style={{ paddingLeft: 32, height: 38, fontSize: 13, width: 230 }}
                      />
                    </div>
                    <button
                      onClick={() => setShowAddDoctor(true)}
                      className="btn btn-primary"
                      style={{ gap: 7, padding: '0 16px', height: 38, fontSize: 13 }}
                    >
                      <Plus size={14} /> Add Doctor
                    </button>
                  </div>
                </div>

                {/* Empty states */}
                {queue.doctors.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '64px 24px',
                    background: 'rgba(255,255,255,0.5)', borderRadius: 16,
                    border: '1.5px dashed var(--border-md)',
                  }}>
                    <Stethoscope size={40} style={{ margin: '0 auto 16px', color: 'var(--text-4)' }} />
                    <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)' }}>No doctors yet</div>
                    <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 4 }}>Click "Add Doctor" to register the first one.</div>
                  </div>
                ) : filteredDoctors.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 24px', background: 'rgba(255,255,255,0.5)', borderRadius: 14, border: '1.5px dashed var(--border-md)', color: 'var(--text-4)' }}>
                    No doctors match "{doctorSearch}".
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
                    {filteredDoctors.map(d => {
                      const serving = currentFor(queue.entries, d.id)
                      const docWaiting = waitingFor(queue.entries, d.id)
                      const accentColor = d.status === 'active' ? '#10B981' : d.status === 'delayed' ? 'var(--amber, #f59e0b)' : d.status === 'break' ? 'var(--blue)' : '#94a3b8'
                      return (
                        <div key={d.id} className="card glass-form-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
                          {/* Status accent stripe */}
                          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '16px 16px 0 0', background: accentColor }} />

                          {/* Avatar + identity */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                            <Avatar name={d.name} size={46} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1.2 }}>{d.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--blue-dark)', marginTop: 2 }}>{d.dept}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 1 }}>
                                {d.room && d.room !== '—' ? d.room : 'No room'}
                                {d.series && d.series !== '?' ? ` · Series ${d.series}` : ''}
                              </div>
                            </div>
                            <StatusBadge status={d.status} />
                          </div>

                          {/* Live stats grid */}
                          <div style={{
                            background: 'rgba(18,198,186,0.05)', border: '1px solid rgba(18,198,186,0.15)',
                            borderRadius: 10, padding: '10px 14px',
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                          }}>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max / Hour</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>{d.maxAppointmentsPerHour ?? 4}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Now Serving</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: serving ? 'var(--emerald)' : 'var(--text-3)', fontFamily: 'monospace' }}>{serving ? entryToken(serving) : '—'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Waiting</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: docWaiting.length > 0 ? 'var(--amber, #f59e0b)' : 'var(--text-3)' }}>{docWaiting.length}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg. Consult</div>
                              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>{d.avgConsultMinutes} min</div>
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div style={{ display: 'flex', gap: 7 }}>
                            <button
                              onClick={() => { queue.setSelectedDoctorId(d.id); setActiveTab('checkin'); queue.clearError() }}
                              className="btn btn-primary btn-sm"
                              style={{ flex: 2, justifyContent: 'center', gap: 5, fontSize: 12 }}
                            >
                              <Ticket size={12} /> Queue
                            </button>
                            <button
                              onClick={() => setEditingDoctor(d)}
                              className="btn btn-ghost btn-sm"
                              style={{ flex: 1, justifyContent: 'center', gap: 5, fontSize: 12 }}
                            >
                              <Pencil size={12} /> Edit
                            </button>
                            <button
                              onClick={() => setHoursDoctor(d)}
                              className="btn btn-ghost btn-sm"
                              style={{ flex: 1, justifyContent: 'center', gap: 5, fontSize: 12, color: 'var(--amber, #f59e0b)', borderColor: 'rgba(245,158,11,0.3)' }}
                            >
                              <CalendarClock size={12} /> Hours
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}

        </div>
      </div>
    </div>
  )
}
