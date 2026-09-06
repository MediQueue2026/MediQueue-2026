import { useEffect, useState } from 'react'
import { X, Stethoscope, CheckCircle2, UserPlus, ShieldAlert, Building2 } from 'lucide-react'
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
  allDoctors = [],
}: {
  isOpen: boolean
  onClose: () => void
  centerId?: string | null
  centerName?: string | null
  onCreated?: (doctor?: ApiDoctor) => void
  /** Pass an existing doctor to switch to edit mode */
  editDoctor?: ApiDoctor | null
  /** Pass list of all doctors in the system to choose from in "Assign Existing" mode */
  allDoctors?: ApiDoctor[]
}) {
  const isEdit = !!editDoctor

  // Mode: 'existing' vs 'new' for adding doctors
  const [mode, setMode] = useState<'existing' | 'new'>('existing')

  // Selected existing doctor ID
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('')

  // New Doctor form fields
  const [fullName, setFullName] = useState(editDoctor?.name ?? '')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [specialization, setSpecialization] = useState(editDoctor?.dept ?? 'General Medicine')
  const [customSpec, setCustomSpec] = useState('')
  const [roomNumber, setRoomNumber] = useState(editDoctor?.room ?? '')
  const [series, setSeries] = useState(editDoctor?.series ?? '')
  const [maxPerHour, setMaxPerHour] = useState(String(editDoctor?.maxAppointmentsPerHour ?? 4))
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [error, setError] = useState<string | null>(null)

  // System doctors list (fetched if not provided)
  const [systemDoctors, setSystemDoctors] = useState<ApiDoctor[]>(allDoctors)

  useEffect(() => {
    if (isOpen && !isEdit) {
      if (allDoctors.length > 0) {
        setSystemDoctors(allDoctors)
        setSelectedDoctorId(allDoctors[0]?.id || '')
      } else {
        api.getDoctors()
          .then(res => {
            setSystemDoctors(res.doctors)
            if (res.doctors.length > 0) setSelectedDoctorId(res.doctors[0].id)
          })
          .catch(() => {})
      }
    }
  }, [isOpen, isEdit, allDoctors])

  useEffect(() => {
    if (editDoctor) {
      setFullName(editDoctor.name)
      setSpecialization(editDoctor.dept || 'General Medicine')
      setRoomNumber(editDoctor.room || '')
      setSeries(editDoctor.series || '')
      setMaxPerHour(String(editDoctor.maxAppointmentsPerHour || 4))
    }
  }, [editDoctor])

  const resetState = () => {
    setMode('existing')
    setSelectedDoctorId('')
    setFullName('')
    setEmail('')
    setPhone('')
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
  const targetCenterId = centerId || 'a1000000-0000-0000-0000-000000000001'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (isEdit && editDoctor) {
        const res = await api.updateDoctor(editDoctor.id, {
          specialization: finalSpec,
          roomNumber: roomNumber.trim() || undefined,
          series: series.trim().toUpperCase() || undefined,
          maxAppointmentsPerHour: Number(maxPerHour) || 4,
        })
        setSuccessMsg('Doctor profile updated successfully.')
        setDone(true)
        onCreated?.(res.doctor)
      } else if (mode === 'existing') {
        const selectedDoc = systemDoctors.find(d => d.id === selectedDoctorId)
        if (!selectedDoc) {
          setError('Please select an existing doctor from the list.')
          setSaving(false)
          return
        }

        await api.createDoctorRequest({
          requestType: 'ASSIGN_EXISTING',
          centerId: targetCenterId,
          centerName: _centerName || undefined,
          doctorId: selectedDoc.id,
          doctorName: selectedDoc.name,
          specialization: selectedDoc.dept || finalSpec || 'General Medicine',
          roomNumber: roomNumber.trim() || undefined,
          series: series.trim().toUpperCase() || undefined,
          maxAppointmentsPerHour: Number(maxPerHour) || 4,
        })

        setSuccessMsg(`Request sent! Assignment request for ${selectedDoc.name} has been submitted for Super Admin approval.`)
        setDone(true)
      } else {
        // Mode: 'new'
        if (!fullName.trim() || !finalSpec) {
          setError('Please fill in doctor name and specialization.')
          setSaving(false)
          return
        }

        await api.createDoctorRequest({
          requestType: 'REGISTER_NEW',
          centerId: targetCenterId,
          centerName: _centerName || undefined,
          doctorName: fullName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          specialization: finalSpec,
          roomNumber: roomNumber.trim() || undefined,
          series: series.trim().toUpperCase() || undefined,
          maxAppointmentsPerHour: Number(maxPerHour) || 4,
        })

        setSuccessMsg(`Request sent! Registration for Dr. ${fullName.trim()} has been submitted for Super Admin approval.`)
        setDone(true)
      }

      setTimeout(() => { resetState(); onClose() }, 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save doctor profile. Please try again.')
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
              {isEdit ? 'Edit Doctor Profile' : 'Add / Register Doctor for Center'}
            </h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>
              {isEdit ? "Update doctor's room and schedule parameters." : 'Assign an existing doctor or enter details for a new doctor.'}
            </div>
          </div>
        </div>

        {/* Mode Switcher for Non-edit mode */}
        {!isEdit && !done && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
            background: 'rgba(18, 198, 186, 0.07)', padding: 4,
            borderRadius: 12, border: '1px solid rgba(18, 198, 186, 0.18)',
            marginBottom: 20
          }}>
            <button
              type="button"
              onClick={() => setMode('existing')}
              style={{
                padding: '9px 12px', borderRadius: 9, border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: mode === 'existing' ? '#ffffff' : 'transparent',
                color: mode === 'existing' ? 'var(--blue)' : 'var(--text-3)',
                boxShadow: mode === 'existing' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              <Building2 size={14} /> Add Existing Doctor
            </button>
            <button
              type="button"
              onClick={() => setMode('new')}
              style={{
                padding: '9px 12px', borderRadius: 9, border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: mode === 'new' ? '#ffffff' : 'transparent',
                color: mode === 'new' ? 'var(--blue)' : 'var(--text-3)',
                boxShadow: mode === 'new' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
              }}
            >
              <UserPlus size={14} /> Register New Doctor
            </button>
          </div>
        )}

        {/* Super Admin Approval Info Banner */}
        {!isEdit && !done && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1e40af'
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>Doctor data will be saved in DB with <strong>Pending Approval</strong> status until approved by the <strong>Super Admin</strong>.</span>
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

            {/* Mode A: Select Existing Registered Doctor */}
            {!isEdit && mode === 'existing' && (
              <div>
                <label style={labelStyle}>Select Existing Registered Doctor</label>
                {systemDoctors.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text-4)', fontStyle: 'italic', padding: 8 }}>
                    No existing registered doctors found. Switch to "Register New Doctor".
                  </div>
                ) : (
                  <select
                    className="input"
                    value={selectedDoctorId}
                    onChange={e => {
                      setSelectedDoctorId(e.target.value)
                      const d = systemDoctors.find(doc => doc.id === e.target.value)
                      if (d) {
                        setSpecialization(d.dept || 'General Medicine')
                        if (d.room && d.room !== '—') setRoomNumber(d.room)
                        if (d.series && d.series !== '?') setSeries(d.series)
                      }
                    }}
                    style={inputStyle}
                  >
                    {systemDoctors.map(doc => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} — {doc.dept} ({doc.centerName || 'Unassigned'})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Mode B: Register New Doctor (or Edit mode) */}
            {(!isEdit && mode === 'new') && (
              <>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input
                    className="input"
                    placeholder="e.g. Dr. Amara Perera"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={labelStyle}>Email (Optional)</label>
                    <input
                      className="input"
                      type="email"
                      placeholder="dr.amara@mediqueue.io"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone (Optional)</label>
                    <input
                      className="input"
                      placeholder="0771234567"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Specialisation (Shown for new registration or existing selection refinement) */}
            {(isEdit || mode === 'new' || mode === 'existing') && (
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
            )}
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
                Total daily capacity = available hours × max per hour
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
                disabled={saving || (!isEdit && mode === 'new' && !fullName.trim())}
                style={{ gap: 8, height: 42, padding: '0 22px', fontSize: 14 }}
              >
                {saving
                  ? <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  : <UserPlus size={16} />
                }
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Save & Submit Request'}
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
