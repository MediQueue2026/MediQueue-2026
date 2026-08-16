import { useState } from 'react'
import { X, Stethoscope, CheckCircle2, UserPlus } from 'lucide-react'
import { api } from '../lib/api'
import type { ApiDoctor } from '../lib/api'

const SPECIALISATIONS = [
  'General Medicine', 'Cardiology', 'Pediatrics', 'Orthopedics',
  'Dermatology', 'Neurology', 'Ophthalmology', 'ENT',
  'Gynecology', 'Psychiatry', 'Oncology', 'Radiology',
  'Gastroenterology', 'Urology', 'Endocrinology', 'Other',
]

export default function AddDoctorModal({
  isOpen,
  onClose,
  centerId,
  onCreated,
  editDoctor,
}: {
  isOpen: boolean
  onClose: () => void
  centerId?: string | null
  onCreated?: (doctor: ApiDoctor) => void
  /** Pass an existing doctor to switch to edit mode */
  editDoctor?: ApiDoctor | null
}) {
  const isEdit = !!editDoctor

  const [fullName, setFullName] = useState(editDoctor?.name ?? '')
  const [specialization, setSpecialization] = useState(editDoctor?.dept ?? 'General Medicine')
  const [customSpec, setCustomSpec] = useState('')
  const [roomNumber, setRoomNumber] = useState(editDoctor?.room ?? '')
  const [series, setSeries] = useState(editDoctor?.series ?? '')
  const [maxPerHour, setMaxPerHour] = useState(String(editDoctor?.maxAppointmentsPerHour ?? 4))
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetState = () => {
    setFullName(''); setSpecialization('General Medicine'); setCustomSpec('')
    setRoomNumber(''); setSeries(''); setMaxPerHour('4')
    setSaving(false); setDone(false); setError(null)
  }

  if (!isOpen) return null

  const finalSpec = specialization === 'Other' ? customSpec.trim() : specialization

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !finalSpec) return
    setSaving(true)
    setError(null)
    try {
      let doctor: ApiDoctor
      if (isEdit && editDoctor) {
        const res = await api.updateDoctor(editDoctor.id, {
          specialization: finalSpec,
          roomNumber: roomNumber.trim() || undefined,
          series: series.trim().toUpperCase() || undefined,
          maxAppointmentsPerHour: Number(maxPerHour) || 4,
        })
        doctor = res.doctor
      } else {
        const res = await api.createDoctor({
          fullName: fullName.trim(),
          specialization: finalSpec,
          roomNumber: roomNumber.trim() || undefined,
          series: series.trim().toUpperCase() || undefined,
          maxAppointmentsPerHour: Number(maxPerHour) || 4,
          centerId: centerId ?? null,
        })
        doctor = res.doctor
      }
      setDone(true)
      onCreated?.(doctor)
      setTimeout(() => { resetState(); onClose() }, 1400)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save doctor. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(6, 35, 33, 0.65)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div className="fade-in modal-card" style={{
        width: '100%', maxWidth: 520, maxHeight: '92vh',
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(18, 198, 186, 0.28)',
        borderRadius: 20, padding: '36px 32px',
        boxShadow: '0 24px 64px rgba(8,48,45,0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
        position: 'relative', overflowY: 'auto',
      }}>
        <button onClick={() => { resetState(); onClose() }} style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(18,198,186,0.1)', border: '1px solid rgba(18,198,186,0.22)',
          borderRadius: '50%', width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)', cursor: 'pointer',
        }}>
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13,
            background: 'linear-gradient(135deg, rgba(18,198,186,0.12), rgba(59,130,246,0.12))',
            border: '1px solid var(--blue-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--blue)',
          }}>
            <Stethoscope size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              {isEdit ? 'Edit Doctor' : 'Add New Doctor'}
            </h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>
              {isEdit ? "Update this doctor's details." : 'Register a doctor at your medical center.'}
            </div>
          </div>
        </div>

        {/* Success state */}
        {done ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <CheckCircle2 size={52} color="#10B981" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)' }}>
              {isEdit ? 'Changes Saved!' : 'Doctor Added!'}
            </h4>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
              {isEdit ? 'Doctor profile has been updated.' : 'The new doctor is now on the roster.'}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Full Name — hidden in edit mode (user row name can't be changed here) */}
            {!isEdit && (
              <div>
                <label style={labelStyle}>Full Name</label>
                <input
                  className="input"
                  placeholder="e.g. Dr. Amara Nwosu"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            )}

            {/* Specialisation */}
            <div>
              <label style={labelStyle}>Specialisation</label>
              <select
                className="input"
                value={specialization}
                onChange={e => setSpecialization(e.target.value)}
                style={inputStyle}
              >
                {SPECIALISATIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {specialization === 'Other' && (
              <div>
                <label style={labelStyle}>Custom Specialisation</label>
                <input
                  className="input"
                  placeholder="e.g. Sports Medicine"
                  value={customSpec}
                  onChange={e => setCustomSpec(e.target.value)}
                  required
                  style={inputStyle}
                />
              </div>
            )}

            {/* Room + Series in a row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Room Number</label>
                <input
                  className="input"
                  placeholder="e.g. Room 04"
                  value={roomNumber}
                  onChange={e => setRoomNumber(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Token Series (A–Z)</label>
                <input
                  className="input"
                  placeholder="e.g. A"
                  value={series}
                  maxLength={1}
                  onChange={e => setSeries(e.target.value.toUpperCase())}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Max appointments per hour */}
            <div>
              <label style={labelStyle}>Max Appointments / Hour</label>
              <input
                className="input"
                type="number"
                min={1}
                max={30}
                value={maxPerHour}
                onChange={e => setMaxPerHour(e.target.value)}
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                Total daily capacity = available hours × this number
              </div>
            </div>

            {error && (
              <div style={{
                background: '#fff1f1', border: '1px solid #fca5a5',
                borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#dc2626',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => { resetState(); onClose() }}
                className="btn btn-ghost"
                style={{ height: 42 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving || (!isEdit && !fullName.trim()) || !finalSpec}
                style={{ gap: 8, height: 42, padding: '0 22px', fontSize: 14 }}
              >
                {saving
                  ? <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  : <UserPlus size={16} />
                }
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Doctor'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--text-4)',
  textTransform: 'uppercase', display: 'block',
  marginBottom: 6, letterSpacing: '0.05em',
}

const inputStyle: React.CSSProperties = { height: 44, fontSize: 14 }
