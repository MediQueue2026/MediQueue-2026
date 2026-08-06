import { useState } from 'react'
import { X, Building2, UserPlus, CheckCircle2 } from 'lucide-react'

export default function AssignDoctorModal({ isOpen, onClose, onAssign }: {
  isOpen: boolean
  onClose: () => void
  onAssign?: (data: { doctor: string; center: string; room: string; specialty: string }) => void
}) {
  const [doctor, setDoctor] = useState('Dr. Aisha Patel')
  const [center, setCenter] = useState('MediQueue Central Clinic')
  const [room, setRoom] = useState('Room 03 (Cardiology)')
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => {
      onAssign?.({ doctor, center, room, specialty: 'Cardiology' })
      setSubmitted(false)
      onClose()
    }, 1000)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(6, 35, 33, 0.65)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16
    }}>
      <div className="fade-in modal-card" style={{
        width: '100%', maxWidth: 540, maxHeight: '90vh',
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(18, 198, 186, 0.28)',
        borderRadius: 20, padding: '36px 32px',
        boxShadow: '0 20px 60px rgba(8, 48, 45, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        position: 'relative', overflowY: 'auto'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(18, 198, 186, 0.1)', border: '1px solid rgba(18, 198, 186, 0.22)',
          borderRadius: '50%', width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)', cursor: 'pointer'
        }}>
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--blue)'
          }}>
            <Building2 size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Assign Doctor to Medical Center</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>System Admin Doctor & Room Allocation</div>
          </div>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <CheckCircle2 size={52} color="#10B981" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)' }}>Assignment Saved!</h4>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
              <strong>{doctor}</strong> assigned to {center} ({room}).
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Select Doctor
              </label>
              <select className="input" value={doctor} onChange={e => setDoctor(e.target.value)} style={{ height: 44, fontSize: 14 }}>
                <option value="Dr. Aisha Patel">Dr. Aisha Patel (Cardiology)</option>
                <option value="Dr. Marcus Reeves">Dr. Marcus Reeves (General Practice)</option>
                <option value="Dr. Sofia Montoya">Dr. Sofia Montoya (Pediatrics)</option>
                <option value="Dr. Kenji Nakamura">Dr. Kenji Nakamura (Orthopedics)</option>
                <option value="Dr. Priya Kumari">Dr. Priya Kumari (Neurology)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Target Medical Center / Facility
              </label>
              <select className="input" value={center} onChange={e => setCenter(e.target.value)} style={{ height: 44, fontSize: 14 }}>
                <option value="MediQueue Central Clinic">MediQueue Central Clinic (Colombo 07)</option>
                <option value="MediQueue North Medical Center">MediQueue North Medical Center (Kandy)</option>
                <option value="MediQueue Emergency & Urgent Care">MediQueue Emergency & Urgent Care (Galle)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Assigned Consultation Room
              </label>
              <input className="input" value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Room 03 (Cardiology)" style={{ height: 44, fontSize: 14 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" onClick={onClose} className="btn btn-ghost" style={{ height: 42 }}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ gap: 8, height: 42, padding: '0 20px', fontSize: 14 }}>
                <UserPlus size={16} /> Confirm Assignment
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
