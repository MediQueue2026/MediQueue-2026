import { useEffect, useState } from 'react'
import { X, Stethoscope, CheckCircle2, Inbox, UserPlus } from 'lucide-react'
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
  centerName: _centerName,
  onCreated,
  editDoctor,
}: {
  isOpen: boolean
  onClose: () => void
  centerId?: string | null
  centerName?: string | null
  onCreated?: (doctor?: ApiDoctor) => void
  editDoctor?: ApiDoctor | null
}) {
  const isEdit = !!editDoctor

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('')
  const [specialization, setSpecialization] = useState(editDoctor?.dept ?? 'General Medicine')
  const [customSpec, setCustomSpec] = useState('')
  const [roomNumber, setRoomNumber] = useState(editDoctor?.room ?? '')
  const [series, setSeries] = useState(editDoctor?.series ?? '')
  const [maxPerHour, setMaxPerHour] = useState(String(editDoctor?.maxAppointmentsPerHour ?? 4))
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [systemDoctors, setSystemDoctors] = useState<ApiDoctor[]>([])

  useEffect(() => {
    if (isOpen && !isEdit && centerId) {
      api.getDoctors({ assignableFor: centerId })
        .then(res => {
          setSystemDoctors(res.doctors)
          setSelectedDoctorId(res.doctors[0]?.id || '')
        })
        .catch(() => {})
    }
  }, [isOpen, isEdit, centerId])

  useEffect(() => {
    if (editDoctor) {
      setSpecialization(editDoctor.dept || 'General Medicine')
      setRoomNumber(editDoctor.room || '')
      setSeries(editDoctor.series || '')
      setMaxPerHour(String(editDoctor.maxAppointmentsPerHour || 4))
    }
  }, [editDoctor])

  const resetState = () => {
    setSelectedDoctorId('')
    setSpecialization('General Medicine')
    setCustomSpec('')
    setRoomNumber('')
    setSeries('')
    setMaxPerHour('4')
    setSaving(false)
    setDone(false)
    setSuccessMsg('')
    setError(null)
  }

  if (!isOpen) return null

  const finalSpec = specialization === 'Other' ? customSpec.trim() : specialization
  const targetCenterId = centerId || null
  const noCenter = !isEdit && !targetCenterId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (!isEdit && !targetCenterId) {
        setError("Your account isn't linked to a medical center yet. Ask an admin to assign one before requesting doctors.")
        setSaving(false)
        return
      }
      if (isEdit && editDoctor) {
        const res = await api.updateDoctor(editDoctor.id, {
          centerId: centerId ?? editDoctor.centerId ?? undefined,
          specialization: finalSpec,
          roomNumber: roomNumber.trim() || undefined,
          series: series.trim().toUpperCase() || undefined,
          maxAppointmentsPerHour: Number(maxPerHour) || 4,
        })
        setSuccessMsg('Doctor profile updated successfully.')
        setDone(true)
        onCreated?.(res.doctor)
      } else {
        const selectedDoc = systemDoctors.find(d => d.id === selectedDoctorId)
        if (!selectedDoc) {
          setError('Please select an existing doctor from the list.')
          setSaving(false)
          return
        }
        await api.createDoctorRequest({
          requestType: 'ASSIGN_EXISTING',
          centerId: targetCenterId!,
          centerName: _centerName || undefined,
          doctorId: selectedDoc.id,
          doctorName: selectedDoc.name,
          specialization: selectedDoc.dept || finalSpec || 'General Medicine',
          roomNumber: roomNumber.trim() || undefined,
          series: series.trim().toUpperCase() || undefined,
          maxAppointmentsPerHour: Number(maxPerHour) || 4,
        })
        setSuccessMsg(`Join request sent to ${selectedDoc.name}! They will see it in their dashboard and can accept or decline.`)
        setDone(true)
      }
      setTimeout(() => { resetState(); onClose() }, 2500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.')
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
        width: '100%', maxWidth: 540, maxHeight: '92vh',
        background: 'rgba(255,255,255,0.95)',
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
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
              {isEdit ? 'Edit Doctor Profile' : 'Add Doctor to Center'}
            </h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>
              {isEdit ? "Update doctor's room and schedule parameters." : 'Select a registered doctor to send a join request.'}
            </div>
          </div>
        </div>

        {/* Info Banner */}
        {!isEdit && !done && !noCenter && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1e40af'
          }}>
            <Inbox size={18} style={{ flexShrink: 0 }} />
            <span>The request will be sent <strong>directly to the doctor's dashboard</strong>. They will see it when they log in and can accept or decline.</span>
          </div>
        )}

        {/* No center warning */}
        {!isEdit && !done && noCenter && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.22)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#b91c1c'
          }}>
            <Inbox size={18} style={{ flexShrink: 0 }} />
            <span>Your account isn't linked to a medical center yet. Ask an admin to assign one before requesting doctors.</span>
          </div>
        )}

        {/* Success state */}
        {done ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <CheckCircle2 size={52} color="#10B981" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)' }}>
              {isEdit ? 'Changes Saved!' : 'Request Sent!'}
            </h4>
            <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 8, maxWidth: 380, marginInline: 'auto' }}>
              {successMsg}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Select Existing Registered Doctor */}
            {!isEdit && (
              <div>
                <label style={labelStyle}>Select a Doctor to Add to This Center</label>
                {systemDoctors.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-4)', fontStyle: 'italic', padding: 8 }}>
                    Every registered doctor is already at this center. Contact admin to register a new doctor.
                  </div>
                ) : (
                  <select
                    className="input"
                    value={selectedDoctorId}
                    onChange={e => {
                      setSelectedDoctorId(e.target.value)
                      const d = systemDoctors.find(doc => doc.id === e.target.value)
                      if (d) setSpecialization(d.dept || 'General Medicine')
                    }}
                    style={inputStyle}
                  >
                    {systemDoctors.map(doc => {
                      const elsewhere = (doc.centers ?? [])
                        .map(c => c.centerName)
                        .filter(Boolean)
                        .join(', ')
                      return (
                        <option key={doc.id} value={doc.id}>
                          {doc.name} — {doc.dept}{elsewhere ? ` (also at ${elsewhere})` : ''}
                        </option>
                      )
                    })}
                  </select>
                )}
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

            {/* Room + Series */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Consultation Room Number</label>
                <input
                  className="input"
                  placeholder="e.g. Room 04"
                  value={roomNumber}
                  onChange={e => setRoomNumber(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Token Series Letter (A–Z)</label>
                <input
                  className="input"
                  placeholder="Auto-assigned if left blank"
                  value={series}
                  maxLength={1}
                  onChange={e => setSeries(e.target.value.toUpperCase())}
                  style={inputStyle}
                />
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
                disabled={saving || noCenter}
                style={{ gap: 8, height: 42, padding: '0 22px', fontSize: 14 }}
              >
                {saving
                  ? <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  : <UserPlus size={16} />
                }
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Send Join Request'}
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
