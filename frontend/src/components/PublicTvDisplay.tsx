import { useState, useEffect } from 'react'
import { X, Volume2, Bell, Clock, ShieldCheck, Stethoscope, Users, Wifi, Building2 } from 'lucide-react'
import { entryToken } from '../lib/receptionQueue'
import type { QueueEntry, ReceptionDoctor } from '../lib/receptionQueue'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

interface DoctorBoard {
  doctorId: string
  doctorName: string
  specialization: string
  roomNumber: string
  centerName: string
  series: string
  nowServing: { token: string; patientName: string } | null
  waitingQueue: { token: string; patientName: string; queue_number: number }[]
}

export default function PublicTvDisplay({
  isOpen, onClose, doctor, current, waiting, estimateWait, onCallNext,
}: {
  isOpen: boolean
  onClose: () => void
  doctor?: ReceptionDoctor
  current?: QueueEntry
  waiting?: QueueEntry[]
  estimateWait?: (entry: QueueEntry) => number
  onCallNext?: () => void
}) {
  const [flash, setFlash] = useState(false)
  const [selectedDocIndex, setSelectedDocIndex] = useState(0)

  // Live DB Board State for Overall Queue across all doctors & centers
  const [dbDoctors, setDbDoctors] = useState<DoctorBoard[]>([])

  // 3-second live polling loop from Supabase Board API
  useEffect(() => {
    if (!isOpen) return

    const fetchBoard = async () => {
      try {
        const res = await fetch(`${API_BASE}/queue/board`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.doctors) && data.doctors.length > 0) {
            setDbDoctors(data.doctors)
          }
        }
      } catch (e) {
        console.warn('Lobby TV Board API poll warning:', e)
      }
    }

    fetchBoard()
    const timer = setInterval(fetchBoard, 3000)
    return () => clearInterval(timer)
  }, [isOpen])

  if (!isOpen) return null

  const handleCallNext = () => {
    setFlash(true)
    setTimeout(() => setFlash(false), 2500)
    onCallNext?.()
  }

  // Active doctor board object from DB stream
  const activeDocBoard = dbDoctors[selectedDocIndex] || dbDoctors[0] || null

  const currentServing = activeDocBoard?.nowServing?.token
    || (current ? entryToken(current) : '—')
  
  const patientName = activeDocBoard?.nowServing?.patientName
    || (current?.patientName ?? 'Waiting for next patient')

  const waitingQueue = activeDocBoard && Array.isArray(activeDocBoard.waitingQueue) && activeDocBoard.waitingQueue.length > 0
    ? activeDocBoard.waitingQueue.map((entry: any, i: number) => ({
        token: entry.token || `#${activeDocBoard.series}-${String(entry.queue_number || i + 1).padStart(2, '0')}`,
        name: entry.patientName || entry.patient_name || 'Patient',
        est: `${(i + 1) * 10} min`,
        status: i === 0 ? 'Next In Line' : 'Waiting',
      }))
    : (waiting ? waiting.map((entry, i) => ({
        token: entryToken(entry),
        name: entry.patientName,
        est: `${estimateWait ? estimateWait(entry) : (i + 1) * 10} min`,
        status: i === 0 ? 'Next In Line' : 'Waiting',
      })) : [])

  const doctorLine = activeDocBoard
    ? { name: `${activeDocBoard.doctorName} · ${activeDocBoard.specialization}`, room: activeDocBoard.roomNumber, center: activeDocBoard.centerName }
    : (doctor ? { name: `${doctor.name} · ${doctor.dept}`, room: doctor.room, center: 'MediQueue Central Clinic' }
               : { name: 'Dr. Medical Specialist · General Practice', room: 'Room 01', center: 'MediQueue Central Clinic' })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'linear-gradient(135deg, #021412 0%, #041e1b 50%, #031110 100%)',
      color: '#ffffff',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* ── HEADER BAR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10,
        background: 'rgba(255, 255, 255, 0.04)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(18, 198, 186, 0.18)',
        padding: '12px 20px',
        flexShrink: 0,
      }}>
        {/* Brand + Doctor info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: 'linear-gradient(135deg, #10b3a8, #0d968d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 20px rgba(16, 179, 168, 0.4)',
          }}>
            <Stethoscope size={22} color="#fff" />
          </div>
          <div>
            <h1 className="tv-title" style={{
              fontSize: 'clamp(14px, 2.5vw, 22px)',
              fontWeight: 900, letterSpacing: '-0.02em', color: '#ffffff', lineHeight: 1.1,
            }}>
              MediQueue — Live Consultation & Lobby Board
            </h1>
            <div style={{ fontSize: 'clamp(11px, 1.5vw, 13px)', color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
              <span style={{ color: '#F59E0B', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Building2 size={12} /> {doctorLine.center}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
              <span style={{ color: '#ffffff', fontWeight: 700 }}>{doctorLine.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
              <span style={{ color: '#10B981', fontWeight: 800 }}>{doctorLine.room}</span>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
              <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Wifi size={11} /> Live DB Polling Active (3s)
              </span>
            </div>
          </div>
        </div>

        {/* Doctor selector tabs for multi-room lobby view */}
        {dbDoctors.length > 1 && (
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {dbDoctors.map((d, idx) => (
              <button
                key={d.doctorId}
                onClick={() => setSelectedDocIndex(idx)}
                style={{
                  background: selectedDocIndex === idx ? '#10B981' : 'rgba(255,255,255,0.08)',
                  color: '#ffffff', border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                  cursor: 'pointer', whiteSpace: 'nowrap'
                }}
              >
                {d.roomNumber}: {d.doctorName.split(' ')[0]} ({d.nowServing ? d.nowServing.token : 'Idle'})
              </button>
            ))}
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            onClick={handleCallNext}
            className="btn btn-emerald"
            style={{ gap: 7, fontSize: 'clamp(11px, 1.5vw, 14px)', padding: 'clamp(8px, 1.5vh, 12px) clamp(12px, 2vw, 20px)', borderRadius: 10 }}
          >
            <Bell size={16} /> Chime / Call Next
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.18)',
              color: '#fff', borderRadius: '50%', width: 38, height: 38, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="tv-main-grid" style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: 16,
        flex: 1,
        minHeight: 0,
        padding: 16,
        overflow: 'hidden',
      }}>

        {/* LEFT — NOW SERVING CARD */}
        <div style={{
          background: flash
            ? 'linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(18,198,186,0.15) 100%)'
            : 'rgba(255, 255, 255, 0.03)',
          border: flash ? '2px solid rgba(16, 185, 129, 0.8)' : '1px solid rgba(18, 198, 186, 0.18)',
          borderRadius: 20,
          padding: 'clamp(16px, 3vh, 36px)',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          position: 'relative', overflow: 'hidden',
          transition: 'all 0.4s ease',
          boxShadow: flash ? '0 0 60px rgba(16, 185, 129, 0.4)' : 'none',
          minHeight: 0,
        }}>
          {/* Glow orb */}
          <div style={{
            position: 'absolute', top: -60, right: -60,
            width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(16,179,168,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'clamp(10px, 2.5vh, 24px)' }}>
              <span className="pulse-live" style={{ width: 10, height: 10 }} />
              <span style={{
                fontSize: 'clamp(11px, 1.5vw, 15px)',
                fontWeight: 900, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#10B981',
              }}>
                Now Serving · {doctorLine.room} ({doctorLine.center})
              </span>
            </div>

            <div style={{ textAlign: 'center', margin: 'clamp(8px, 2vh, 20px) 0' }}>
              <div style={{ fontSize: 'clamp(11px, 1.6vw, 14px)', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 8 }}>
                Current Patient Token
              </div>
              <div style={{
                fontSize: 'clamp(56px, 12vw, 130px)',
                fontWeight: 900, color: flash ? '#10B981' : '#12c6ba',
                lineHeight: 1, letterSpacing: '-0.04em', fontFamily: 'monospace',
                textShadow: `0 0 ${flash ? '60px' : '30px'} rgba(18, 198, 186, 0.6)`,
                transition: 'all 0.4s ease',
              }}>
                {currentServing}
              </div>
              <div style={{
                fontSize: 'clamp(16px, 3vw, 28px)',
                fontWeight: 800, color: '#ffffff', marginTop: 'clamp(8px, 1.5vh, 16px)',
                textShadow: '0 2px 12px rgba(0,0,0,0.4)',
              }}>
                {patientName}
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(0, 0, 0, 0.28)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 12, padding: 'clamp(10px, 1.8vh, 18px)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Volume2 size={18} color="#10B981" />
              <span style={{ fontSize: 'clamp(10px, 1.3vw, 13px)', color: 'rgba(255,255,255,0.75)' }}>
                Please proceed to {doctorLine.room} at {doctorLine.center} when your token flashes
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 'clamp(10px, 1.2vw, 13px)', fontWeight: 700, color: '#10b3a8', flexShrink: 0 }}>
              <ShieldCheck size={14} />
              MediQueue Verified
            </div>
          </div>
        </div>

        {/* RIGHT — UPCOMING QUEUE */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(18, 198, 186, 0.18)',
          borderRadius: 20,
          padding: 'clamp(14px, 2.5vh, 24px)',
          display: 'flex', flexDirection: 'column',
          minHeight: 0, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 'clamp(10px, 2vh, 18px)',
            paddingBottom: 12,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} color="#10b3a8" />
              <span style={{ fontSize: 'clamp(13px, 2vw, 18px)', fontWeight: 800, color: '#ffffff' }}>
                Upcoming Patient Queue — {doctorLine.name}
              </span>
            </div>
            <span style={{ fontSize: 'clamp(10px, 1.3vw, 12px)', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {waitingQueue.length} waiting
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 }}>
            {waitingQueue.length === 0 ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(255,255,255,0.4)', fontSize: 'clamp(12px, 1.6vw, 15px)', textAlign: 'center'
              }}>
                <Users size={40} color="rgba(255,255,255,0.3)" style={{ marginBottom: 10 }} />
                No patients currently waiting in queue for {doctorLine.room}
              </div>
            ) : (
              waitingQueue.map((item, i) => (
                <div
                  key={i}
                  style={{
                    background: i === 0 ? 'rgba(16, 179, 168, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                    border: i === 0 ? '1px solid rgba(16, 179, 168, 0.38)' : '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: 14,
                    padding: 'clamp(10px, 1.8vh, 16px) clamp(12px, 2vw, 18px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: 'clamp(16px, 2.5vw, 26px)',
                      fontWeight: 900,
                      color: i === 0 ? '#10B981' : '#12c6ba',
                      minWidth: 'clamp(52px, 8vw, 72px)',
                    }}>
                      {item.token}
                    </div>
                    <div>
                      <div style={{ fontSize: 'clamp(12px, 1.6vw, 15px)', fontWeight: 700, color: '#ffffff' }}>{item.name}</div>
                      <div style={{ fontSize: 'clamp(10px, 1.2vw, 12px)', color: i === 0 ? '#10B981' : 'rgba(255,255,255,0.5)' }}>
                        {item.status}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                      fontSize: 'clamp(11px, 1.5vw, 14px)',
                      fontWeight: 800, color: '#F59E0B',
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <Clock size={13} /> ~{item.est}
                    </div>
                    <div style={{ fontSize: 'clamp(9px, 1vw, 11px)', color: 'rgba(255,255,255,0.4)' }}>Est. Wait</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── FOOTER TICKER ── */}
      <div style={{
        background: 'rgba(18, 198, 186, 0.08)',
        borderTop: '1px solid rgba(18, 198, 186, 0.15)',
        padding: '8px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 'clamp(10px, 1.3vw, 12px)', color: 'rgba(255,255,255,0.55)',
        flexShrink: 0, flexWrap: 'wrap', gap: 8,
      }}>
        <span>MediQueue · {doctorLine.center} · Multi-Room Consultation Stream</span>
        <span style={{ color: '#10B981', fontWeight: 700 }}>● Supabase Live Database Sync</span>
      </div>
    </div>
  )
}
