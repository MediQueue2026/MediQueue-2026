import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle, AlertTriangle, Bell, Check, CheckCheck, Clock, Eye, FileText, Phone,
  Repeat, Search, ShieldAlert, SkipForward, Ticket, Timer, Users, UserCheck, Inbox
} from 'lucide-react'
import AccountMenu from '../components/AccountMenu'
import PatientHistoryDrawer from '../components/PatientHistoryDrawer'
import PrescriptionModal from '../components/PrescriptionModal'
import DelayAlertModal from '../components/DelayAlertModal'
import { Badge, Dot, StatusBadge } from '../components/UIPrimitives'
import { useAuth } from '../context/AuthContext'
import { ApiError, api } from '../lib/api'
import type { ApiDelayAlert, ApiDoctorQueueItem, ApiDoctorSummary } from '../lib/api'

/** The three states a doctor can put themselves in from the top bar. */
type Shift = 'online' | 'break' | 'offline'

const POLL_MS = 5000

/** Minutes since an ISO timestamp, floored at zero. */
function minutesSince(iso: string | null, now: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.round((now - t) / 60_000))
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/** "35y · M" from whatever of the two we actually know; '—' when neither. */
function describePatient(age: number | null, g: string | null): string {
  const parts = [age != null ? `${age}y` : null, g].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

export default function DoctorPanel() {
  const { user } = useAuth()

  const [shift, setShift] = useState<Shift>('online')
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false)
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
  const [showDelayModal, setShowDelayModal] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  /**
   * The whole console is driven by one summary payload.
   *
   * `null` until it arrives, so the page shows a loading state instead of the
   * old behaviour: `doctorInfo` was seeded with "Dr. Medical Specialist",
   * "General Medicine", "Room 01" and "MediQueue Healthcare Network", all of
   * which rendered for a moment and were then replaced. `loadError` covers the
   * case where the id doesn't resolve — the backend used to fall back to the
   * first doctor in the table, quietly showing one doctor another's queue.
   */
  const [summary, setSummary] = useState<ApiDoctorSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  /** This doctor's own delay notices, newest first. */
  const [delayAlerts, setDelayAlerts] = useState<ApiDelayAlert[]>([])

  /**
   * Urgent flags are session-local: there is no column on `walk_in_queue` to
   * persist them, so they are cleared on reload and are not visible to
   * reception. Kept because triage order is still useful within a sitting, but
   * labelled in the UI so nobody assumes it was saved.
   */
  const [urgentTokens, setUrgentTokens] = useState<string[]>([])

  /** Ticks so "waiting 12 min" ages without refetching. */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

  const doctorKey = user?.id ?? null

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!doctorKey) {
      // No hardcoded demo UUID fallback here. The old code fell back to
      // 'c1000000-0000-0000-0000-000000000001', so a signed-out or
      // still-loading session pulled up a fixed doctor's real patient queue.
      setLoading(false)
      setLoadError('Sign in as a doctor to see your console.')
      return
    }
    if (!opts?.silent) setLoading(true)
    try {
      const data = await api.getDoctorSummary(doctorKey)
      setSummary(data)
      setLoadError(null)
      // Track the doctor's own status so the shift toggle reflects reality.
      const status = data.doctor.currentStatus
      setShift(status === 'active' || status === 'delayed' ? 'online' : (status as Shift))

      const alerts = await api.getDelayAlerts({ doctorId: data.doctor.id, limit: 10 })
      setDelayAlerts(alerts.alerts ?? [])
    } catch (err) {
      if (!opts?.silent) {
        setLoadError(
          err instanceof ApiError && err.status === 404
            ? 'No doctor profile is linked to your account yet. Ask an admin to register you as a doctor.'
            : err instanceof ApiError && err.status === 0
              ? 'Cannot reach the MediQueue server.'
              : 'Could not load your console.',
        )
      }
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [doctorKey])

  useEffect(() => { load() }, [load])

  // Live polling so tokens issued at the reception desk appear here.
  useEffect(() => {
    const t = setInterval(() => { load({ silent: true }) }, POLL_MS)
    return () => clearInterval(t)
  }, [load])

  const doctor = summary?.doctor ?? null
  const stats = summary?.stats ?? null
  const activePatient = summary?.activePatient ?? null
  const queueList = summary?.queueList ?? []

  const activeDelay = useMemo(() => delayAlerts.find(a => a.isActive) ?? null, [delayAlerts])

  /** Shift changes. A delay is published separately — see handleSendDelayAlert. */
  const handleShiftChange = async (newShift: Shift) => {
    if (!doctor) return
    const previous = shift
    setShift(newShift)
    try {
      await api.updateDoctorStatus(doctor.id, { currentStatus: newShift, centerId: doctor.centerId })
      await load({ silent: true })
    } catch (err) {
      setShift(previous) // Don't leave the toggle claiming a state the server rejected.
      showToast(err instanceof ApiError ? err.message : 'Could not update your status.')
    }
  }

  /**
   * Publishes a delay notice: subscribed patients, today's appointments and
   * anyone holding a walk-in token get an SMS, and the notice is recorded so it
   * shows on the patient and reception dashboards (BR-05 / FR-07).
   *
   * The old handler posted `currentStatus: 'delayed'` and then set the local
   * shift toggle to `'offline'`, so announcing a 15-minute delay made the
   * doctor's own console show them as Offline.
   */
  const handleSendDelayAlert = async (delayMinutes: number, reason: string) => {
    if (!doctor) throw new Error('Your doctor profile has not loaded yet.')
    // Deliberately not caught: DelayAlertModal awaits this and renders the
    // failure inline, instead of showing "Alert Dispatched" regardless.
    const res = await api.createDelayAlert(doctor.id, { delayMinutes, reason, centerId: doctor.centerId })
    setDelayAlerts(prev => [res.alert, ...prev.filter(a => a.id !== res.alert.id)])
    showToast(
      res.notifiedCount > 0
        ? `Delay alert sent to ${res.notifiedCount} patient${res.notifiedCount === 1 ? '' : 's'} by SMS.`
        : 'Delay alert published. No patients were waiting to notify.',
    )
    await load({ silent: true })
  }

  const handleClearDelay = async (alertId: string) => {
    try {
      const res = await api.clearDelayAlert(alertId)
      setDelayAlerts(prev => prev.map(a => (a.id === res.alert.id ? res.alert : a)))
      showToast(res.message)
      await load({ silent: true })
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not clear the delay alert.')
    }
  }

  const handleCallNext = async () => {
    if (!doctor) return
    try {
      await api.callNext(doctor.id, doctor.centerId)
      await load({ silent: true })
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not call the next patient.')
    }
  }

  const handleSetStatus = async (id: string, status: 'completed' | 'left') => {
    try {
      await api.setQueueEntryStatus(id, status)
      await load({ silent: true })
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not update that token.')
    }
  }

  const handleToggleUrgent = (token: string) => {
    setUrgentTokens(prev => (prev.includes(token) ? prev.filter(t => t !== token) : [...prev, token]))
  }

  const filteredQueue = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return queueList
    return queueList.filter(p =>
      p.name.toLowerCase().includes(q) || p.token.toLowerCase().includes(q),
    )
  }, [queueList, searchQuery])

  const openCount = filteredQueue.filter(
    q => q.status !== 'completed' && q.status !== 'left' && q.status !== 'cancelled',
  ).length

  const shiftOpts: { v: Shift; label: string; color: string }[] = [
    { v: 'online', label: 'Online',   color: '#10B981' },
    { v: 'break',  label: 'On Break', color: '#F59E0B' },
    { v: 'offline', label: 'Offline', color: '#EF4444' },
  ]

  // ── Loading / error gates ──────────────────────────────────────────────
  if (loading && !summary) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <Timer size={30} style={{ margin: '0 auto 12px', opacity: 0.6 }} />
          <div style={{ fontSize: 14, fontWeight: 700 }}>Loading your console…</div>
        </div>
      </div>
    )
  }

  if (loadError && !summary) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'grid', placeItems: 'center', padding: 24 }}>
        <div className="card glass-form-card" style={{ maxWidth: 420, padding: 28, textAlign: 'center' }}>
          <AlertCircle size={32} color="var(--crimson)" style={{ margin: '0 auto 14px' }} />
          <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)', marginBottom: 8 }}>
            Console unavailable
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.55, marginBottom: 18 }}>{loadError}</p>
          <button onClick={() => load()} className="btn btn-primary" style={{ margin: '0 auto', gap: 7 }}>
            <Repeat size={14} /> Try again
          </button>
        </div>
      </div>
    )
  }

  if (!doctor || !stats) return null

  const statTiles = [
    { label: 'Total Today',        val: String(stats.totalToday),      icon: <Users size={14} />,       color: 'var(--text-1)' },
    { label: stats.avgConsultIsEstimate ? 'Avg. Consult (sched.)' : 'Avg. Consult Time',
      val: stats.avgConsultTime,   icon: <Timer size={14} />,          color: 'var(--blue)' },
    { label: 'Remaining Tokens',   val: String(stats.remainingTokens), icon: <Ticket size={14} />,      color: '#B45309' },
    { label: 'Skipped / No-Show',  val: String(stats.skippedNoShow),   icon: <SkipForward size={14} />, color: '#B91C1C' },
    { label: 'Patients Seen',      val: String(stats.patientsSeen),    icon: <CheckCheck size={14} />,  color: '#047857' },
    { label: 'Flagged Urgent',     val: String(urgentTokens.length),   icon: <ShieldAlert size={14} />, color: '#e11d48' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Modals */}
      <PatientHistoryDrawer
        isOpen={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        patientId={activePatient?.patientId ?? activePatient?.id}
        patientName={activePatient?.name ?? 'Patient'}
        patientToken={activePatient?.token ?? '—'}
      />
      <PrescriptionModal
        isOpen={showPrescriptionModal}
        onClose={() => setShowPrescriptionModal(false)}
        patientId={activePatient?.patientId ?? activePatient?.id}
        doctorId={doctor.id}
        patientName={activePatient?.name ?? 'Patient'}
        patientToken={activePatient?.token ?? '—'}
        doctorName={doctor.name}
        doctorDept={doctor.specialization ?? undefined}
        centerName={doctor.centerName ?? undefined}
      />
      <DelayAlertModal
        isOpen={showDelayModal}
        onClose={() => setShowDelayModal(false)}
        onSend={handleSendDelayAlert}
        doctorName={doctor.name}
        roomNumber={doctor.roomNumber ?? undefined}
        dept={doctor.specialization ?? undefined}
      />

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 99999, maxWidth: 380,
          background: '#0d2623', color: '#ffffff', border: '1px solid var(--emerald)',
          padding: '12px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span>{toast}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss"
            style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div className="topbar" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
              Doctor Console — {doctor.name}
            </div>
            {/* Only the details actually on record. */}
            <div style={{ fontSize: 10, color: 'var(--text-4)', whiteSpace: 'nowrap' }} className="desktop-only">
              {[doctor.specialization, doctor.roomNumber, doctor.centerName].filter(Boolean).join(' · ') || 'Profile details not set'}
            </div>
          </div>
        </div>
        <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px' }} className="desktop-only" />

        {/* Shift toggle */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {shiftOpts.map(o => (
            <button key={o.v} onClick={() => handleShiftChange(o.v)} className="btn btn-sm"
              aria-pressed={shift === o.v}
              style={{
                gap: 4, padding: '4px 8px', fontSize: 11,
                borderWidth: 1, borderStyle: 'solid',
                borderColor: shift === o.v ? o.color : 'var(--border-md)',
                background: shift === o.v ? `${o.color}15` : 'rgba(255,255,255,0.04)',
                color: shift === o.v ? o.color : 'var(--text-3)',
                transition: 'all 0.13s',
              }}>
              <Dot color={shift === o.v ? o.color : '#334155'} />
              <span className={o.v === shift ? '' : 'desktop-only'}>{o.label}</span>
            </button>
          ))}
        </div>

        {/* Delay alert — raise, or clear once you're caught up */}
        {activeDelay ? (
          <button
            onClick={() => handleClearDelay(activeDelay.id)}
            className="btn btn-emerald btn-sm"
            style={{ gap: 5, padding: '4px 9px', fontSize: 11, flexShrink: 0 }}
          >
            <Check size={12} /> <span className="desktop-only">Back on schedule </span>({activeDelay.delayMinutes}m)
          </button>
        ) : (
          <button
            onClick={() => setShowDelayModal(true)}
            className="btn btn-amber btn-sm"
            style={{ gap: 5, padding: '4px 9px', fontSize: 11, flexShrink: 0 }}
          >
            <Clock size={12} /> <span className="desktop-only">Delay Alert / </span>Late Notice
          </button>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {/* Notifications. Was a decorative <div> with a permanent red dot and
              no handler; now it opens this doctor's own delay history and the
              badge count reflects real live alerts. */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowNotifications(o => !o)}
              className="btn btn-ghost btn-sm"
              aria-label={activeDelay ? 'Notifications: 1 active delay alert' : 'Notifications: none'}
              aria-expanded={showNotifications}
              style={{ padding: '5px 7px', position: 'relative' }}
            >
              <Bell size={16} color={activeDelay ? '#B45309' : 'var(--text-3)'} />
              {activeDelay && (
                <span style={{
                  position: 'absolute', top: 1, right: 1, width: 7, height: 7,
                  background: 'var(--crimson)', borderRadius: '50%',
                }} />
              )}
            </button>
            {showNotifications && (
              <>
                <div onClick={() => setShowNotifications(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                <div className="card" style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 41,
                  width: 300, maxHeight: 340, overflowY: 'auto', padding: 14,
                  background: '#fff', border: '1px solid var(--border-md)', borderRadius: 12,
                  boxShadow: '0 12px 32px rgba(15,23,42,0.16)',
                }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-1)', marginBottom: 10 }}>
                    Your delay notices
                  </div>
                  {delayAlerts.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-4)', padding: '8px 0' }}>
                      You haven't published any delay notices today.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {delayAlerts.map(a => (
                        <div key={a.id} style={{
                          padding: 10, borderRadius: 9, fontSize: 12,
                          background: a.isActive ? 'var(--amber-dim)' : 'rgba(30,41,59,0.03)',
                          border: `1px solid ${a.isActive ? 'var(--amber-border)' : 'var(--border-md)'}`,
                        }}>
                          <div style={{ fontWeight: 800, color: a.isActive ? '#B45309' : 'var(--text-3)' }}>
                            +{a.delayMinutes} min {a.isActive ? '· live' : '· cleared'}
                          </div>
                          <div style={{ color: 'var(--text-3)', marginTop: 2 }}>{a.reason || 'No reason given'}</div>
                          <div style={{ color: 'var(--text-4)', fontSize: 11, marginTop: 4 }}>
                            {fmtTime(a.createdAt)} · {a.notifiedCount} notified
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <AccountMenu specialization={doctor.specialization ?? undefined} series={doctor.series} />
        </div>
      </div>

      {/* Live delay banner, so the doctor can see what patients were told */}
      {activeDelay && (
        <div style={{ margin: '14px 24px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
            borderRadius: 12, padding: '10px 16px', fontSize: 12.5,
          }}>
            <AlertTriangle size={15} color="#B45309" style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 800, color: '#B45309' }}>
              Patients told you're {activeDelay.delayMinutes} min behind
            </span>
            <span style={{ color: 'var(--text-3)' }}>{activeDelay.reason || 'No reason given'}</span>
            <span style={{ color: 'var(--text-4)', marginLeft: 'auto', fontSize: 11.5 }}>
              {activeDelay.notifiedCount} SMS sent
              {activeDelay.skippedCount > 0 && ` · ${activeDelay.skippedCount} opted out`}
            </span>
          </div>
        </div>
      )}

      {/* ── STATS STRIP ── */}
      <div style={{
        margin: '14px 24px 0', padding: '10px 22px',
        background: 'rgba(160, 236, 205, 0.65)', backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-md)', borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'nowrap', overflowX: 'auto', gap: 12,
      }}>
        {statTiles.map((s, i, arr) => (
          <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: `${s.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                {s.icon}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: s.color, lineHeight: 1, letterSpacing: '-0.02em' }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'var(--text-4)', marginTop: 2, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.label}</div>
              </div>
            </div>
            {i < arr.length - 1 && <div style={{ width: 1, height: 22, background: 'var(--border-md)', marginLeft: 4 }} />}
          </div>
        ))}
      </div>

      {/* ── MAIN GRID ── */}
      <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: '16px 24px' }}>

        {/* LEFT — Active patient panel */}
        <div>
          <div className="glass-form-card" style={{
            background: 'linear-gradient(140deg, #0b2e2a 0%, #0d1e1d 70%)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 18, padding: '26px 28px',
          }}>
            {activePatient ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="pulse-live" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Currently Serving</span>
                  </div>
                  <button onClick={() => setShowHistoryDrawer(true)} className="btn btn-sm" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', gap: 5 }}>
                    <Eye size={13} /> View Patient History & Reports
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 22, flexWrap: 'wrap' }}>
                  <div style={{
                    minWidth: 110, height: 110,
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)',
                    borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column',
                  }}>
                    <div style={{ fontSize: 38, fontWeight: 900, color: '#10B981', letterSpacing: '-0.04em', fontFamily: 'monospace', lineHeight: 1 }}>
                      {activePatient.token}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'rgba(16,185,129,0.6)', marginTop: 4, fontWeight: 600 }}>TOKEN</div>
                  </div>
                  <div style={{ paddingTop: 8 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff' }}>{activePatient.name}</div>
                    {/* Age and gender are decoded from the patient's NIC. When
                        there isn't a usable NIC this reads "—" rather than the
                        old hardcoded "Age 35 · Male", which was shown for every
                        single patient. */}
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 3, marginBottom: 10 }}>
                      {describePatient(activePatient.age, activePatient.gender)} · {activePatient.visitType}
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {activePatient.allergy && <Badge cls="badge-amber">Allergy: {activePatient.allergy}</Badge>}
                      {activePatient.nic && <Badge cls="badge-ghost">NIC {activePatient.nic}</Badge>}
                    </div>
                  </div>
                </div>

                {/* Facts we actually hold about this visit. The second card here
                    used to be a "Vitals Snapshot" showing BP 120/80, HR 72 bpm,
                    Temp 36.8°C and SpO₂ 99% — none of it measured, none of it
                    stored anywhere, identical for every patient. Inventing
                    observations on a clinical screen is not acceptable, so it's
                    replaced with the visit timings, which are real. */}
                <div className="form-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                  <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Visit</div>
                    <div style={{ fontSize: 13, color: '#ffffff', lineHeight: 1.6 }}>
                      {activePatient.visitType === 'Walk-in' ? 'Physical walk-in' : 'Online booking'}
                      <br />
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                        Checked in {fmtTime(activePatient.checkedInAt)}
                      </span>
                    </div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>In Consultation</div>
                    <div style={{ fontSize: 13, color: '#ffffff', lineHeight: 1.6 }}>
                      {activePatient.calledAt ? `Called ${fmtTime(activePatient.calledAt)}` : 'Not called yet'}
                      <br />
                      <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12 }}>
                        {(() => {
                          const m = minutesSince(activePatient.calledAt, now)
                          return m == null ? '—' : `${m} min elapsed`
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="form-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  <button onClick={handleCallNext} className="btn btn-ghost" style={{ height: 42 }}><Phone size={14} />Call / Ring Bell</button>
                  <button onClick={() => handleSetStatus(activePatient.id, 'completed')} className="btn btn-emerald" style={{ height: 42 }}><Check size={14} />Mark Complete</button>
                  <button onClick={() => handleSetStatus(activePatient.id, 'left')} className="btn btn-ghost" style={{ height: 42 }}><SkipForward size={14} />Skip / No Show</button>
                  <button onClick={handleCallNext} className="btn btn-ghost" style={{ height: 42 }}><Repeat size={14} />Next Token</button>
                </div>
                <button onClick={() => setShowPrescriptionModal(true)} className="btn btn-primary" style={{ width: '100%', marginTop: 12, gap: 8, height: 44, fontSize: 14.5, fontWeight: 700 }}>
                  <FileText size={16} /> Write Prescription & Print PDF
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <Inbox size={48} color="#10B981" style={{ margin: '0 auto 16px', opacity: 0.6 }} />
                <h3 style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', marginBottom: 6 }}>No Active Patient Currently</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', maxWidth: 360, margin: '0 auto 20px' }}>
                  Nobody is in consultation. Call the next patient in the queue when you're ready.
                </p>
                <button onClick={handleCallNext} disabled={stats.remainingTokens === 0} className="btn btn-emerald"
                  style={{ gap: 8, padding: '0 24px', height: 44, fontSize: 14, fontWeight: 700, opacity: stats.remainingTokens === 0 ? 0.5 : 1 }}>
                  <Phone size={16} /> {stats.remainingTokens === 0 ? 'Queue is empty' : 'Call Next Patient in Queue'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Upcoming queue */}
        <div className="card glass-form-card" style={{ maxHeight: 560, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', flex: 1 }}>Today's Queue</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{openCount} open</span>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="var(--text-4)" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="input"
                placeholder="Search token or name…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 30, width: 170, fontSize: 12 }}
              />
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredQueue.length > 0 ? (
              filteredQueue.map((p: ApiDoctorQueueItem) => {
                const isClosed = p.status === 'completed' || p.status === 'left' || p.status === 'cancelled'
                const isLive = p.status === 'called' || p.status === 'in_progress'
                const isUrgent = urgentTokens.includes(p.token)
                // Real elapsed time since check-in. The old row showed an
                // "Appt:" time computed from `Date.now()` at mount plus an
                // `apptOffset` that no API ever returned — so every row claimed
                // an appointment at the moment the page happened to load, and
                // the "N min waiting" figure counted from page load, not from
                // when the patient arrived.
                const waited = minutesSince(p.checkedInAt, now)
                const waitColor =
                  waited == null ? 'var(--text-4)'
                  : waited < 15 ? '#047857'
                  : waited < 30 ? '#B45309'
                  : '#B91C1C'

                return (
                  <div key={p.id} style={{
                    padding: '13px 18px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    opacity: isClosed ? 0.55 : 1,
                    background: isLive ? 'var(--emerald-dim)' : 'transparent',
                  }}>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 15, fontWeight: 800, lineHeight: 1,
                      color: isLive ? '#047857' : isClosed ? 'var(--text-4)' : 'var(--blue)',
                      minWidth: 56, paddingTop: 2,
                    }}>{p.token}</div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>
                        {p.name}
                        {isUrgent && (
                          <span title="Flagged for this session only — not saved to the record"
                            style={{ color: '#e11d48', fontSize: 10.5, fontWeight: 800, marginLeft: 6 }}>
                            URGENT
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginBottom: 3 }}>
                        {describePatient(p.age, p.g)} · {p.visitType}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} style={{ flexShrink: 0, opacity: 0.7 }} />
                        <span>Checked in <strong style={{ color: 'var(--text-2)', fontWeight: 700 }}>{fmtTime(p.checkedInAt)}</strong></span>
                      </div>
                      {p.allergy && (
                        <div style={{ marginTop: 5 }}>
                          <Badge cls="badge-amber"><AlertCircle size={9} />{p.allergy}</Badge>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
                      <StatusBadge status={p.status as 'waiting' | 'called' | 'in_progress' | 'completed' | 'left' | 'cancelled'} />
                      {!isClosed && waited != null && (
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: waitColor,
                          display: 'flex', alignItems: 'center', gap: 3,
                          whiteSpace: 'nowrap', padding: '2px 7px', borderRadius: 6,
                          background: `${waitColor}18`, border: `1px solid ${waitColor}35`,
                        }}>
                          <Timer size={9} /> {waited} min waiting
                        </div>
                      )}
                      {!isClosed && (
                        <button
                          onClick={() => handleToggleUrgent(p.token)}
                          className="btn btn-sm"
                          title="Session-only triage flag — it is not saved and reception cannot see it"
                          style={{
                            fontSize: 10.5, padding: '3px 8px',
                            background: isUrgent ? '#e11d48' : 'var(--crimson-dim)',
                            color: isUrgent ? '#ffffff' : 'var(--crimson)',
                            border: '1px solid var(--crimson-border)',
                          }}
                        >
                          {isUrgent ? 'Urgent ✓' : 'Flag Urgent'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-4)' }}>
                <UserCheck size={36} color="var(--text-4)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>
                  {searchQuery ? `No tokens match "${searchQuery}"` : 'No patients in the queue yet'}
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {searchQuery
                    ? 'Clear the search to see the full queue.'
                    : 'Walk-in slips recorded at reception and online bookings appear here live.'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
