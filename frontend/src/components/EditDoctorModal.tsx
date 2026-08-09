import { useState, useEffect } from 'react'
import { X, UserCog, CheckCircle2, Clock } from 'lucide-react'
import { api, WeeklyHours, ApiDoctor } from '../lib/api'

export default function EditDoctorModal({ isOpen, onClose, doctor, onUpdated }: {
  isOpen: boolean
  onClose: () => void
  doctor: ApiDoctor | null
  onUpdated?: () => void
}) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  
  const [hours, setHours] = useState<WeeklyHours>({
    mon: { available: true, start: '09:00', end: '17:00' },
    tue: { available: true, start: '09:00', end: '17:00' },
    wed: { available: true, start: '09:00', end: '17:00' },
    thu: { available: true, start: '09:00', end: '17:00' },
    fri: { available: true, start: '09:00', end: '17:00' },
    sat: { available: false, start: '09:00', end: '13:00' },
    sun: { available: false, start: '09:00', end: '13:00' },
  })

  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && doctor) {
      setFullName(doctor.name || '')
      setSpecialization(doctor.dept || '')
      setRoomNumber(doctor.room || '')
      setPhone('') // We don't have phone in ApiDoctor by default, so leave blank or fetch if needed
      
      if (doctor.availableHours) {
        setHours(doctor.availableHours)
      } else {
        setHours({
          mon: { available: true, start: '09:00', end: '17:00' },
          tue: { available: true, start: '09:00', end: '17:00' },
          wed: { available: true, start: '09:00', end: '17:00' },
          thu: { available: true, start: '09:00', end: '17:00' },
          fri: { available: true, start: '09:00', end: '17:00' },
          sat: { available: false, start: '09:00', end: '13:00' },
          sun: { available: false, start: '09:00', end: '13:00' },
        })
      }
    }
  }, [isOpen, doctor])

  if (!isOpen || !doctor) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await api.updateDoctor(doctor.id, {
        fullName, 
        phone: phone || undefined, 
        specialization, 
        roomNumber, 
        availableHours: hours
      })
      setSubmitted(true)
      setTimeout(() => {
        onUpdated?.()
        setSubmitted(false)
        onClose()
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to update doctor')
    } finally {
      setLoading(false)
    }
  }

  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  const dayNames = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

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
        width: '100%', maxWidth: 700, maxHeight: '90vh',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--blue)'
          }}>
            <UserCog size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Edit Doctor Profile</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>Update details and available hours for {doctor.name}</div>
          </div>
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <CheckCircle2 size={56} color="#10B981" style={{ margin: '0 auto 16px' }} />
            <h4 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)' }}>Profile Updated!</h4>
            <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 8 }}>
              <strong>{fullName}</strong>'s details have been saved.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {error && (
              <div style={{ color: 'var(--crimson)', background: 'var(--crimson-dim)', padding: 12, borderRadius: 8, fontSize: 13, border: '1px solid var(--crimson-border)' }}>
                {error}
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Doctor Full Name
                </label>
                <input required className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Dr. John Doe" style={{ height: 44, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Specialization / Department
                </label>
                <input required className="input" value={specialization} onChange={e => setSpecialization(e.target.value)} placeholder="e.g. Cardiology" style={{ height: 44, fontSize: 14 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Consultation Room
                </label>
                <input required className="input" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="e.g. Room 01" style={{ height: 44, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Update Phone Number (Optional)
                </label>
                <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Leave blank to keep unchanged" style={{ height: 44, fontSize: 14 }} />
              </div>
            </div>

            <div style={{ marginTop: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <Clock size={16} color="var(--blue)"/> Doctor Available Hours (Weekly Schedule)
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(30, 41, 59, 0.03)', padding: 16, borderRadius: 12 }}>
                {days.map(day => (
                  <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>{dayNames[day]}</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, width: 90, cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={hours[day].available} 
                        onChange={e => setHours({ ...hours, [day]: { ...hours[day], available: e.target.checked } })}
                      />
                      Available
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: hours[day].available ? 1 : 0.4, pointerEvents: hours[day].available ? 'auto' : 'none' }}>
                      <input 
                        type="time" 
                        className="input" 
                        style={{ height: 32, fontSize: 12, padding: '0 8px' }}
                        value={hours[day].start}
                        onChange={e => setHours({ ...hours, [day]: { ...hours[day], start: e.target.value } })}
                      />
                      <span style={{ color: 'var(--text-4)', fontSize: 12 }}>to</span>
                      <input 
                        type="time" 
                        className="input" 
                        style={{ height: 32, fontSize: 12, padding: '0 8px' }}
                        value={hours[day].end}
                        onChange={e => setHours({ ...hours, [day]: { ...hours[day], end: e.target.value } })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <button type="button" onClick={onClose} className="btn btn-ghost" style={{ height: 44 }}>Cancel</button>
              <button disabled={loading} type="submit" className="btn btn-primary" style={{ gap: 8, height: 44, padding: '0 24px', fontSize: 14 }}>
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
