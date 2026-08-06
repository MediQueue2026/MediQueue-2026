import { useState } from 'react'
import { X, Building2, Plus, CheckCircle2 } from 'lucide-react'

export default function AddCenterModal({ isOpen, onClose, onAdd }: {
  isOpen: boolean
  onClose: () => void
  onAdd?: (centerData: { name: string; city: string; docs: number; rooms: number }) => void
}) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [docs, setDocs] = useState(5)
  const [rooms, setRooms] = useState(8)
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => {
      onAdd?.({ name, city, docs, rooms })
      setSubmitted(false)
      setName('')
      setCity('')
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
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Add New Medical Center</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>Register a new clinic or hospital branch in the system</div>
          </div>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <CheckCircle2 size={52} color="#10B981" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)' }}>Medical Center Registered!</h4>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
              <strong>{name}</strong> ({city}) added to MediQueue network.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Facility Name
              </label>
              <input
                required
                className="input"
                placeholder="e.g. MediQueue West Medical Center"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ height: 44, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                City / Location
              </label>
              <input
                required
                className="input"
                placeholder="e.g. Negombo or Kurunegala"
                value={city}
                onChange={e => setCity(e.target.value)}
                style={{ height: 44, fontSize: 14 }}
              />
            </div>

            <div className="form-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Doctors Capacity
                </label>
                <input
                  type="number"
                  className="input"
                  value={docs}
                  onChange={e => setDocs(Number(e.target.value))}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Consultation Rooms
                </label>
                <input
                  type="number"
                  className="input"
                  value={rooms}
                  onChange={e => setRooms(Number(e.target.value))}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" onClick={onClose} className="btn btn-ghost" style={{ height: 42 }}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ gap: 8, height: 42, padding: '0 20px', fontSize: 14 }}>
                <Plus size={16} /> Add Medical Center
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
