import { useState } from 'react'
import { X, Building2, Plus, CheckCircle2 } from 'lucide-react'
import type { ApiCenter } from '../lib/api'

export default function AddCenterModal({ isOpen, onClose, onAdd }: {
  isOpen: boolean
  onClose: () => void
  onAdd?: (centerData: {
    name: string
    city: string
    address?: string
    openingHours?: string
    services?: string[]
    phone?: string
    status?: ApiCenter['status']
  }) => void
}) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [openingHours, setOpeningHours] = useState('08:00 - 18:00')
  const [services, setServices] = useState('General Medicine, Cardiology')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<ApiCenter['status']>('operational')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onAdd?.({
        name,
        city,
        address: address || city,
        openingHours,
        services: services.split(',').map(service => service.trim()).filter(Boolean),
        phone: phone || undefined,
        status,
      })
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        setName('')
        setCity('')
        setAddress('')
        setOpeningHours('08:00 - 18:00')
        setServices('General Medicine, Cardiology')
        setPhone('')
        setStatus('operational')
        onClose()
      }, 800)
    } catch (err) {
      console.error('Failed to add medical center', err)
    } finally {
      setSubmitting(false)
    }
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
        width: '100%', maxWidth: 600, maxHeight: '90vh',
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  City / Location
                </label>
                <input
                  required
                  className="input"
                  placeholder="e.g. Colombo 07"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Address
                </label>
                <input
                  required
                  className="input"
                  placeholder="e.g. 123 Medical Plaza"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Opening Hours
                </label>
                <input
                  className="input"
                  placeholder="e.g. 08:00 - 18:00"
                  value={openingHours}
                  onChange={e => setOpeningHours(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Phone
                </label>
                <input
                  className="input"
                  placeholder="e.g. 0112345678"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Services (comma separated)
              </label>
              <input
                className="input"
                value={services}
                onChange={e => setServices(e.target.value)}
                style={{ height: 44, fontSize: 14 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Initial Status
              </label>
              <select
                className="input"
                value={status}
                onChange={e => setStatus(e.target.value as ApiCenter['status'])}
                style={{ height: 44, fontSize: 14, borderRadius: 12, border: '1px solid var(--border-md)', background: '#fff' }}
              >
                <option value="operational">Operational</option>
                <option value="maintenance">Maintenance</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" onClick={onClose} disabled={submitting} className="btn btn-ghost" style={{ height: 42 }}>Cancel</button>
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ gap: 8, height: 42, padding: '0 20px', fontSize: 14 }}>
                <Plus size={16} /> {submitting ? 'Adding…' : 'Add Medical Center'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
