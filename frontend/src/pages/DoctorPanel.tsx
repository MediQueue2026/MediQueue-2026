import { useState, useEffect, useRef } from 'react'
import {
  AlertCircle, AlertTriangle, Bell, Check, CheckCheck, Clock, Eye, FileText, Phone,
  Repeat, Search, ShieldAlert, SkipForward, Ticket, Timer, Users
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
  token: string
  name: string
  age: number
  g: string
  complaint: string
  status: 'active' | 'next' | 'waiting' | 'completed' | 'skipped' | 'called'
  allergy?: string | null
  apptOffset?: number
  isUrgent?: boolean
}

export default function DoctorPanel() {
  const { user } = useAuth()
  const [shift, setShift] = useState<Shift>('online')
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false)
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false)
  const [showDelayModal, setShowDelayModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Dynamic backend stats
  const [doctorInfo, setDoctorInfo] = useState({
    id: 'c1000000-0000-0000-0000-000000000001',
    name: (user as any)?.full_name || user?.name || 'Dr. Ethan Carr',
    dept: 'General Medicine',
    room: 'Room 04',
    centerName: 'MediQueue Central Clinic'
  })

  const [stats, setStats] = useState({
    totalToday: 24,
    avgConsultTime: '4.8 min',
    remainingTokens: 7,
    skippedNoShow: 2,
    patientsSeen: 17,
    urgentCases: 3
  })

  const [activePatient, setActivePatient] = useState({
    id: 'pat-1',
    token: '#A-11',
    name: 'Nimal Silva',
    age: 47,
    gender: 'Male',
    visitType: 'Walk-in',
    complaint: 'Persistent cough, mild fever for 3 days, mild pharyngitis.',
    allergy: 'Penicillin',
    isFirstVisit: true,
    vitals: { bp: '128/82', hr: '78 bpm', temp: '37.8°C', spo2: '98%' }
  })

  const [queueList, setQueueList] = useState<QueueItem[]>([
    { id: 'q1', token: '#A-11', name: 'Nimal Silva',   age: 47, g: 'M', complaint: 'Cough & fever',           status: 'active',    allergy: 'Penicillin', apptOffset: -25 },
    { id: 'q2', token: '#A-12', name: 'Kasun Perera',  age: 32, g: 'M', complaint: 'Chest pain evaluation',   status: 'next',      allergy: null,          apptOffset: -15 },
    { id: 'q3', token: '#A-13', name: 'Dilini F.',     age: 28, g: 'F', complaint: 'Migraine / nausea',       status: 'waiting',   allergy: 'Sulfa',       apptOffset: -4, isUrgent: true },
    { id: 'q4', token: '#A-14', name: 'Rajan Mehta',   age: 51, g: 'M', complaint: 'Routine ECG follow-up',   status: 'waiting',   allergy: null,          apptOffset: 6 },
    { id: 'q5', token: '#A-15', name: 'A. Karimi',     age: 64, g: 'M', complaint: 'Hypertension check',      status: 'waiting',   allergy: null,          apptOffset: 17 },
    { id: 'q6', token: '#A-09', name: 'M. Bandara',    age: 39, g: 'F', complaint: 'Skin rash',               status: 'completed', allergy: null,          apptOffset: -55 },
    { id: 'q7', token: '#A-10', name: 'S. Kumari',     age: 22, g: 'F', complaint: 'Sore throat',             status: 'completed', allergy: null,          apptOffset: -40 },
  ])

  // Live timer for appointment waiting badges
  const mountTimeRef = useRef(Date.now())
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Fetch summary data from Backend API
  const fetchDoctorSummary = async () => {
    try {
      const docId = user?.id || 'c1000000-0000-0000-0000-000000000001'
      const res = await fetch(`http://localhost:5000/api/doctors/${docId}/summary`)
      if (res.ok) {
        const data = await res.json()
        if (data.doctor) {
          setDoctorInfo({
            id: data.doctor.id,
            name: data.doctor.name || (user as any)?.full_name || user?.name || 'Dr. Ethan Carr',
            dept: data.doctor.specialization || 'General Medicine',
            room: data.doctor.roomNumber || 'Room 04',
            centerName: data.doctor.centerName || 'MediQueue Central Clinic'
          })
          if (data.doctor.currentStatus) {
            setShift(data.doctor.currentStatus as Shift)
          }
        }
        if (data.stats) {
          setStats(data.stats)
        }
        if (data.activePatient) {
          setActivePatient(prev => ({ ...prev, ...data.activePatient }))
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
    try {
      await fetch(`http://localhost:5000/api/doctors/${doctorInfo.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStatus: newShift,
          doctorName: doctorInfo.name,
          roomNumber: doctorInfo.room
        })
      })
    } catch (e) {
      console.warn('Status update API call:', e)
    }
  }

  // Handle Delay Alert Modal submit
  const handleSendDelayAlert = async (delayMinutes: number, reason: string) => {
    try {
      await fetch(`http://localhost:5000/api/doctors/${doctorInfo.id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStatus: 'delayed',
          delayMinutes,
          doctorName: doctorInfo.name,
          reason
        })
      })
    } catch (e) {
      console.warn('Delay alert API call:', e)
    }
  }

  // Queue actions
  const handleCallNext = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/queue/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorId: doctorInfo.id })
      })
      if (res.ok) {
        fetchDoctorSummary()
      }
    } catch (e) {
      console.warn('Call next patient notice:', e)
    }
  }

  const handleMarkComplete = () => {
    setStats(prev => ({
      ...prev,
      patientsSeen: prev.patientsSeen + 1,
      remainingTokens: Math.max(0, prev.remainingTokens - 1)
    }))
    setQueueList(prev => prev.map(p => p.token === activePatient.token ? { ...p, status: 'completed' } : p))
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
      <PatientHistoryDrawer isOpen={showHistoryDrawer} onClose={() => setShowHistoryDrawer(false)} />
      <PrescriptionModal
        isOpen={showPrescriptionModal}
        onClose={() => setShowPrescriptionModal(false)}
        patientId={activePatient.id}
        doctorId={doctorInfo.id}
        patientName={activePatient.name}
        patientToken={activePatient.token}
      />
      <DelayAlertModal
        isOpen={showDelayModal}
        onClose={() => setShowDelayModal(false)}
        onSend={handleSendDelayAlert}
      />

      {/* ── TOP BAR ── */}
      <div className="topbar" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
              Doctor Console
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

      {/* ── STATS STRIP (6 CONTAINERS) ── */}
      <div className="doctor-stats-grid">
        {[
          { label: 'Total Patients Today',    val: String(stats.totalToday),       icon: <Users size={16} />,        color: 'var(--text-1)' },
          { label: 'Avg. Consultation Time',  val: stats.avgConsultTime,           icon: <Timer size={16} />,        color: 'var(--blue)'   },
          { label: 'Remaining Tokens',        val: String(stats.remainingTokens),  icon: <Ticket size={16} />,       color: '#F59E0B'       },
          { label: 'Skipped / No-Show',       val: String(stats.skippedNoShow),    icon: <SkipForward size={16} />,  color: '#EF4444'       },
          { label: 'Patients Seen',           val: String(stats.patientsSeen),     icon: <CheckCheck size={16} />,   color: '#10B981'       },
          { label: 'Urgent Cases Today',      val: String(stats.urgentCases),      icon: <ShieldAlert size={16} />,  color: '#e11d48'       },
        ].map((s, i) => (
          <div key={i} className="doctor-stat-card">
            <div style={{ width: 34, height: 34, borderRadius: 8, background: `${s.color}14`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 2, whiteSpace: 'nowrap' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── MAIN GRID ── */}
      <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: '22px 24px' }}>

        {/* LEFT — Active patient */}
        <div>
          <div className="glass-form-card" style={{
            background: 'linear-gradient(140deg, #0b2e2a 0%, #0d1e1d 70%)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 18, padding: '26px 28px'
          }}>
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
                <div style={{ fontSize: 46, fontWeight: 900, color: '#10B981', letterSpacing: '-0.04em', fontFamily: 'monospace', lineHeight: 1 }}>
                  {activePatient.token}
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(16,185,129,0.6)', marginTop: 4, fontWeight: 600 }}>TOKEN</div>
              </div>
              <div style={{ paddingTop: 8 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#ffffff' }}>{activePatient.name}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 3, marginBottom: 10 }}>
                  Age {activePatient.age} · {activePatient.gender} · {activePatient.visitType}
                </div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {activePatient.allergy && <Badge cls="badge-amber">Allergy: {activePatient.allergy}</Badge>}
                  {activePatient.isFirstVisit && <Badge cls="badge-blue">1st Visit</Badge>}
                </div>
              </div>
            </div>

            {/* Info cards */}
            <div className="form-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Chief Complaint</div>
                <div style={{ fontSize: 13, color: '#ffffff', lineHeight: 1.5 }}>{activePatient.complaint}</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 700, marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Vitals Snapshot</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {[
                    ['BP', activePatient.vitals.bp],
                    ['HR', activePatient.vitals.hr],
                    ['Temp', activePatient.vitals.temp],
                    ['SpO₂', activePatient.vitals.spo2]
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
              <button className="btn btn-ghost" style={{ height: 42 }}><SkipForward size={14} />Skip / No Show</button>
              <button className="btn btn-ghost" style={{ height: 42 }}><Repeat size={14} />Transfer Token</button>
            </div>
            <button onClick={() => setShowPrescriptionModal(true)} className="btn btn-primary" style={{ width: '100%', marginTop: 12, gap: 8, height: 44, fontSize: 14.5, fontWeight: 700 }}>
              <FileText size={16} /> Write Prescription & Print PDF
            </button>
          </div>
        </div>

        {/* RIGHT — Upcoming Queue list */}
        <div className="card glass-form-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', flex: 1 }}>Upcoming Queue</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{filteredQueue.filter(q => q.status !== 'completed').length} patients waiting</span>
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
            {filteredQueue.map((p, i) => {
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
                  opacity: p.status === 'completed' ? 0.5 : 1,
                  background: p.status === 'next' ? 'rgba(59,130,246,0.04)' : 'transparent',
                  transition: 'background 0.1s'
                }}>
                  <div style={{
                    fontFamily: 'monospace', fontSize: 15, fontWeight: 800, lineHeight: 1,
                    color: p.status === 'next' ? 'var(--blue)' : p.status === 'completed' ? 'var(--text-4)' : 'var(--text-3)',
                    minWidth: 54, paddingTop: 2
                  }}>{p.token}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>
                      {p.name} {p.isUrgent && <span style={{ color: '#e11d48', fontSize: 11, fontWeight: 800, marginLeft: 4 }}>🚨 URGENT</span>}
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
                    {p.status !== 'completed' && (
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
                    {p.status !== 'completed' && (
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
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
