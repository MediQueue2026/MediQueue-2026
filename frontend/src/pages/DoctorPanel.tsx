import { useState, useEffect, useRef } from 'react'
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

type Shift = 'online' | 'break' | 'offline'

interface QueueItem {
  id: string
  patientId?: string | null
  token: string
  name: string
  age: number
  g: string
  complaint: string
  status: 'active' | 'next' | 'waiting' | 'completed' | 'skipped' | 'called' | 'in_progress' | 'left'
  allergy?: string | null
  apptOffset?: number
  isUrgent?: boolean
  isLateNumber?: boolean
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

export default function DoctorPanel() {
  const { user } = useAuth()
  const [shift, setShift] = useState<Shift>('online')
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false)
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
  const [showDelayModal, setShowDelayModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Dynamic Doctor Profile & Center Info
  const [doctorInfo, setDoctorInfo] = useState({
    id: user?.id || '',
    name: (user as any)?.full_name || user?.name || 'Dr. Medical Specialist',
    dept: 'General Medicine',
    room: 'Room 01',
    centerName: 'MediQueue Healthcare Network'
  })

  // Dynamic Backend Queue Statistics
  const [stats, setStats] = useState({
    totalToday: 0,
    avgConsultTime: '0.0 min',
    remainingTokens: 0,
    skippedNoShow: 0,
    patientsSeen: 0,
    urgentCases: 0
  })

  // Dynamic Currently Active Patient
  const [activePatient, setActivePatient] = useState<any | null>(null)

  // Dynamic Queue List (Starts Empty, Loaded 100% from Database)
  const [queueList, setQueueList] = useState<QueueItem[]>([])

  // Live Clock
  const mountTimeRef = useRef(Date.now())
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Fetch summary data from Backend API
  const fetchDoctorSummary = async () => {
    try {
      const docId = user?.id || doctorInfo.id || 'c1000000-0000-0000-0000-000000000001'
      const res = await fetch(`${API_BASE}/doctors/${docId}/summary`)
      if (res.ok) {
        const data = await res.json()
        if (data.doctor) {
          setDoctorInfo({
            id: data.doctor.id,
            name: data.doctor.name || (user as any)?.full_name || user?.name || 'Dr. Medical Specialist',
            dept: data.doctor.specialization || 'General Medicine',
            room: data.doctor.roomNumber || 'Room 01',
            centerName: data.doctor.centerName || 'MediQueue Central Clinic'
          })
          if (data.doctor.currentStatus) {
            setShift(data.doctor.currentStatus as Shift)
          }
        }
        if (data.stats) {
          setStats(data.stats)
        }
        setActivePatient(data.activePatient || null)
        if (Array.isArray(data.queueList)) {
          setQueueList(data.queueList)
        }
      }
    } catch (err) {
      console.warn('Doctor Panel API load warning:', err)
    }
  }

  useEffect(() => {
    fetchDoctorSummary()
  }, [user?.id])

  // Update doctor status in Database
  const handleShiftChange = async (newShift: Shift) => {
    setShift(newShift)
    const docId = doctorInfo.id || user?.id
    if (!docId) return
    try {
      await fetch(`${API_BASE}/doctors/${docId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStatus: newShift,
          doctorName: doctorInfo.name,
          roomNumber: doctorInfo.room
        })
      })
      fetchDoctorSummary()
    } catch (e) {
      console.warn('Status update API call:', e)
    }
  }

  // Handle Delay Alert Modal submit
  const handleSendDelayAlert = async (delayMinutes: number, reason: string) => {
    const docId = doctorInfo.id || user?.id
    if (!docId) return
    try {
      await fetch(`${API_BASE}/doctors/${docId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStatus: 'delayed',
          delayMinutes,
          doctorName: doctorInfo.name,
          reason
        })
      })
      setShift('offline')
      fetchDoctorSummary()
    } catch (e) {
      console.warn('Delay alert API call:', e)
    }
  }

  // Queue actions (Calls Real Backend API & Re-fetches DB State)
  const handleCallNext = async () => {
    try {
      await fetch(`${API_BASE}/queue/call-next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: doctorInfo.id })
      })
      fetchDoctorSummary()
    } catch (e) {
      console.warn('Call next patient notice:', e)
    }
  }

  const handleMarkComplete = async () => {
    if (!activePatient?.id) return
    try {
      await fetch(`${API_BASE}/queue/${activePatient.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      })
    } catch (e) {
      console.warn('Mark complete API notice:', e)
    } finally {
      fetchDoctorSummary()
    }
  }

  const handleSkipNoShow = async () => {
    if (!activePatient?.id) return
    try {
      await fetch(`${API_BASE}/queue/${activePatient.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'left' })
      })
    } catch (e) {
      console.warn('Skip no-show API notice:', e)
    } finally {
      fetchDoctorSummary()
    }
  }

  const handleToggleUrgent = (itemToken: string) => {
    setQueueList(prev => prev.map(p => p.token === itemToken ? { ...p, isUrgent: !p.isUrgent } : p))
  }

  const filteredQueue = queueList.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.token.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const shiftOpts: { v: Shift; label: string; color: string }[] = [
    { v: 'online', label: 'Online',    color: '#10B981' },
    { v: 'break',  label: 'On Break',  color: '#F59E0B' },
    { v: 'offline',label: 'Offline',   color: '#EF4444' },
  ]

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Modals */}
      <PatientHistoryDrawer
        isOpen={showHistoryDrawer}
        onClose={() => setShowHistoryDrawer(false)}
        patientId={activePatient?.patientId || activePatient?.userId || activePatient?.id}
        patientName={activePatient?.name || 'Patient'}
        patientToken={activePatient?.token || '#A-00'}
      />
      <PrescriptionModal
        isOpen={showPrescriptionModal}
        onClose={() => setShowPrescriptionModal(false)}
        patientId={activePatient?.patientId || activePatient?.userId || activePatient?.id}
        doctorId={doctorInfo.id}
        patientName={activePatient?.name || 'Patient'}
        patientToken={activePatient?.token || '#A-00'}
        doctorName={doctorInfo.name}
        doctorDept={doctorInfo.dept}
        centerName={doctorInfo.centerName}
      />
      <DelayAlertModal
        isOpen={showDelayModal}
        onClose={() => setShowDelayModal(false)}
        onSend={handleSendDelayAlert}
        doctorName={doctorInfo.name}
        roomNumber={doctorInfo.room}
        dept={doctorInfo.dept}
      />

      {/* ── TOP BAR ── */}
      <div className="topbar" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
              Doctor Console — {doctorInfo.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-4)', whiteSpace: 'nowrap' }} className="desktop-only">
              {doctorInfo.dept} · {doctorInfo.room} ({doctorInfo.centerName})
            </div>
          </div>
        </div>
        <div style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 2px' }} className="desktop-only" />

        {/* Shift toggle */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {shiftOpts.map(o => (
            <button key={o.v} onClick={() => handleShiftChange(o.v)} className="btn btn-sm" style={{
              gap: 4, padding: '4px 8px', fontSize: 11,
              borderWidth: 1, borderStyle: 'solid',
              borderColor: shift === o.v ? o.color : 'var(--border-md)',
              background: shift === o.v ? `${o.color}15` : 'rgba(255,255,255,0.04)',
              color: shift === o.v ? o.color : 'var(--text-3)',
              transition: 'all 0.13s'
            }}>
              <Dot color={shift === o.v ? o.color : '#334155'} />
              <span className={o.v === shift ? '' : 'desktop-only'}>{o.label}</span>
            </button>
          ))}
        </div>

        {/* Delay alert trigger */}
        <button onClick={() => setShowDelayModal(true)} className="btn btn-amber btn-sm" style={{ gap: 5, padding: '4px 9px', fontSize: 11, flexShrink: 0 }}>
          <Clock size={12} /> <span className="desktop-only">Delay Alert / </span>Late Notice
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ position: 'relative', cursor: 'pointer' }}><Bell size={16} color="var(--text-3)" /><span style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, background: 'var(--crimson)', borderRadius: '50%', border: '2px solid var(--bg)' }} /></div>
          <button className="btn btn-danger desktop-only" style={{ gap: 6, padding: '4px 10px', fontSize: 11 }}><AlertTriangle size={13} />Emergency Alert</button>
          <AccountMenu />
        </div>
      </div>

      {/* ── STATS STRIP (COMPACT INLINE GLASSMORPHISM BAR) ── */}
      <div style={{
        margin: '14px 24px 0', padding: '10px 22px',
        background: 'rgba(160, 236, 205, 0.65)', backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-md)', borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'nowrap', overflowX: 'auto', gap: 12
      }}>
        {[
          { label: 'Total Today',         val: String(stats.totalToday),       icon: <Users size={14} />,        color: 'var(--text-1)' },
          { label: 'Avg. Consult Time',   val: stats.avgConsultTime,           icon: <Timer size={14} />,        color: 'var(--blue)'   },
          { label: 'Remaining Tokens',     val: String(stats.remainingTokens),  icon: <Ticket size={14} />,       color: '#F59E0B'       },
          { label: 'Skipped / No-Show',    val: String(stats.skippedNoShow),    icon: <SkipForward size={14} />,  color: '#EF4444'       },
          { label: 'Patients Seen',        val: String(stats.patientsSeen),     icon: <CheckCheck size={14} />,   color: '#10B981'       },
          { label: 'Urgent Cases',         val: String(stats.urgentCases),      icon: <ShieldAlert size={14} />,  color: '#e11d48'       },
        ].map((s, i, arr) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
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
            borderRadius: 18, padding: '26px 28px'
          }}>
            {activePatient ? (
              <>
                {/* Serving header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="pulse-live" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#10B981', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Currently Serving</span>
                  </div>
                  <button onClick={() => setShowHistoryDrawer(true)} className="btn btn-sm" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)', gap: 5 }}>
                    <Eye size={13} /> View Patient History & Reports
                  </button>
                </div>

                {/* Token + patient */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 22, flexWrap: 'wrap' }}>
                  <div style={{
                    minWidth: 110, height: 110,
                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.18)',
                    borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexDirection: 'column'
                  }}>
                    <div style={{ fontSize: 42, fontWeight: 900, color: '#10B981', letterSpacing: '-0.04em', fontFamily: 'monospace', lineHeight: 1 }}>
                      {activePatient.token}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'rgba(16,185,129,0.6)', marginTop: 4, fontWeight: 600 }}>TOKEN</div>
                  </div>
                  <div style={{ paddingTop: 8 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff' }}>{activePatient.name}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 3, marginBottom: 10 }}>
                      Age {activePatient.age || 35} · {activePatient.gender || 'Male'} · {activePatient.visitType || 'Walk-in'}
                    </div>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      {activePatient.allergy && <Badge cls="badge-amber">Allergy: {activePatient.allergy}</Badge>}
                      {activePatient.isFirstVisit && <Badge cls="badge-blue">First Consultation</Badge>}
                      {activePatient.isLateNumber && <Badge cls="badge-crimson">🚨 Late Number (Prior No-Show)</Badge>}
                    </div>
                  </div>
                </div>

                {/* Info cards */}
                <div className="form-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
                  <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Chief Complaint</div>
                    <div style={{ fontSize: 13, color: '#ffffff', lineHeight: 1.5 }}>{activePatient.complaint || 'General Consultation'}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 700, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Vitals Snapshot</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {[
                        ['BP', activePatient.vitals?.bp || '120/80'],
                        ['HR', activePatient.vitals?.hr || '72 bpm'],
                        ['Temp', activePatient.vitals?.temp || '36.8°C'],
                        ['SpO₂', activePatient.vitals?.spo2 || '99%']
                      ].map(([k, v]) => (
                        <div key={k}><div style={{ fontSize: 9.5, color: 'var(--text-4)' }}>{k}</div><div style={{ fontSize: 12.5, fontWeight: 700, color: '#ffffff' }}>{v}</div></div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="form-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                  <button onClick={handleCallNext} className="btn btn-ghost" style={{ height: 42 }}><Phone size={14} />Call / Ring Bell</button>
                  <button onClick={handleMarkComplete} className="btn btn-emerald" style={{ height: 42 }}><Check size={14} />Mark Complete & Next</button>
                  <button onClick={handleSkipNoShow} className="btn btn-ghost" style={{ height: 42 }}><SkipForward size={14} />Skip / No Show</button>
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
                  There are no patients currently called in consultation. Click below to call the next patient in queue.
                </p>
                <button onClick={handleCallNext} className="btn btn-emerald" style={{ gap: 8, padding: '0 24px', height: 44, fontSize: 14, fontWeight: 700 }}>
                  <Phone size={16} /> Call Next Patient in Queue
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Dynamic Upcoming Queue list */}
        <div className="card glass-form-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', flex: 1 }}>Upcoming Queue (Database)</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{filteredQueue.filter(q => q.status !== 'completed' && q.status !== 'left').length} waiting</span>
            <div style={{ position: 'relative' }}>
              <Search size={13} color="var(--text-4)" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="input"
                placeholder="Search token..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 30, width: 140, fontSize: 12 }}
              />
            </div>
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredQueue.length > 0 ? (
              filteredQueue.map((p, i) => {
                const offsetMins = p.apptOffset ?? 0
                const appt = new Date(mountTimeRef.current + offsetMins * 60_000)
                const apptStr = fmtTime(appt)
                const diffMins = Math.round((now.getTime() - appt.getTime()) / 60_000)

                const waitColor =
                  diffMins <= 0   ? 'var(--blue)'
                  : diffMins < 10 ? '#10B981'
                  : diffMins < 20 ? '#F59E0B'
                                  : '#EF4444'
                const waitLabel =
                  diffMins <= 0
                    ? `In ${Math.abs(diffMins)} min`
                    : `${diffMins} min waiting`

                return (
                  <div key={p.id || i} style={{
                    padding: '14px 18px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    opacity: p.status === 'completed' || p.status === 'left' ? 0.5 : 1,
                    background: p.status === 'next' || p.status === 'called' ? 'rgba(59,130,246,0.06)' : 'transparent',
                    transition: 'background 0.1s'
                  }}>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 15, fontWeight: 800, lineHeight: 1,
                      color: p.status === 'next' || p.status === 'called' ? 'var(--blue)' : p.status === 'completed' ? 'var(--text-4)' : 'var(--text-3)',
                      minWidth: 54, paddingTop: 2
                    }}>{p.token}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>
                        {p.name}
                        {p.isUrgent && <span style={{ color: '#e11d48', fontSize: 11, fontWeight: 800, marginLeft: 6 }}>🚨 URGENT</span>}
                        {p.isLateNumber && <span style={{ color: '#ef4444', fontSize: 10.5, fontWeight: 800, marginLeft: 6 }}>🚨 LATE NUMBER</span>}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginBottom: 3 }}>{p.age}y · {p.g} · {p.complaint}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginBottom: p.allergy ? 5 : 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} style={{ flexShrink: 0, opacity: 0.7 }} />
                        <span>Appt: <strong style={{ color: 'var(--text-2)', fontWeight: 700 }}>{apptStr}</strong></span>
                      </div>
                      {p.allergy && <Badge cls="badge-amber"><AlertCircle size={9} />{p.allergy} allergy</Badge>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', flexShrink: 0 }}>
                      <StatusBadge status={p.status} />
                      {p.status !== 'completed' && p.status !== 'left' && (
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: waitColor,
                          display: 'flex', alignItems: 'center', gap: 3,
                          whiteSpace: 'nowrap', padding: '2px 7px', borderRadius: 6,
                          background: `${waitColor}18`, border: `1px solid ${waitColor}35`
                        }}>
                          <Timer size={9} />
                          {waitLabel}
                        </div>
                      )}
                      {p.status !== 'completed' && p.status !== 'left' && (
                        <button
                          onClick={() => handleToggleUrgent(p.token)}
                          className="btn btn-sm"
                          style={{
                            fontSize: 10.5, padding: '3px 8px',
                            background: p.isUrgent ? '#e11d48' : 'var(--crimson-dim)',
                            color: p.isUrgent ? '#ffffff' : 'var(--crimson)',
                            border: '1px solid var(--crimson-border)'
                          }}
                        >
                          {p.isUrgent ? 'Urgent Set' : 'Mark Urgent'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-4)' }}>
                <UserCheck size={36} color="var(--text-4)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-2)' }}>No Patients Currently in Queue</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>When physical walk-in patients or online bookings are issued, they will appear here live.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}