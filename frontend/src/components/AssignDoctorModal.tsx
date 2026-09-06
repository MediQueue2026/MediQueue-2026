import { useEffect, useState } from 'react'
import { X, Building2, UserPlus, CheckCircle2 } from 'lucide-react'
import type { ApiCenter, ApiDoctor } from '../lib/api'

export default function AssignDoctorModal({
  isOpen,
  onClose,
  doctors,
  centers,
  selectedCenter,
  onAssign,
}: {
  isOpen: boolean
  onClose: () => void
  doctors: ApiDoctor[]
  centers: ApiCenter[]
  selectedCenter?: ApiCenter
  onAssign?: (data: { doctorId: string; centerId: string; room: string; specialty: string }) => void
}) {
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? '')
  const [centerId, setCenterId] = useState(selectedCenter?.id ?? centers[0]?.id ?? '')
  const [room, setRoom] = useState('Room 01')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setDoctorId(doctors[0]?.id ?? '')
    setCenterId(selectedCenter?.id ?? centers[0]?.id ?? '')
    setRoom('Room 01')
  }, [isOpen, doctors, centers, selectedCenter])

  if (!isOpen) return null

  const selectedDoctor = doctors.find(doc => doc.id === doctorId)
  const selectedCenterName = centers.find(center => center.id === centerId)?.name ?? 'Selected Center'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!doctorId || !centerId) return

    setSubmitted(true)
    setTimeout(() => {
      onAssign?.({
        doctorId,
        centerId,
        room,
        specialty: selectedDoctor?.dept ?? 'General Medicine',
      })
      setSubmitted(false)
      onClose()
    }, 300)
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
        background: 'rgba(255, 255, 255, 0.92)',
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
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Assign or Reassign Doctor</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>Choose a doctor and connect them with a facility.</div>
          </div>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <CheckCircle2 size={52} color="#10B981" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)' }}>Assignment Updated</h4>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
              <strong>{selectedDoctor?.name ?? 'Doctor'}</strong> assigned to {selectedCenterName}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Doctor
              </label>
              <select className="input" value={doctorId} onChange={e => setDoctorId(e.target.value)} style={{ height: 44, fontSize: 14 }}>
                {doctors.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.name} ({doc.dept})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Medical Center
              </label>
              <select className="input" value={centerId} onChange={e => setCenterId(e.target.value)} style={{ height: 44, fontSize: 14 }}>
                {centers.map(center => (
                  <option key={center.id} value={center.id}>{center.name} ({center.city})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Consultation Room
              </label>
              <input className="input" value={room} onChange={e => setRoom(e.target.value)} placeholder="e.g. Room 03" style={{ height: 44, fontSize: 14 }} />
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
