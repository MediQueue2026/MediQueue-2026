import { useEffect, useState } from 'react'
import { X, Stethoscope, CheckCircle2, Inbox, UserPlus, UserCheck, Clock } from 'lucide-react'
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

  // ── Tab state (only relevant when not in Edit mode) ──
  const [activeTab, setActiveTab] = useState<'invite' | 'create'>('invite')

  // ── Invite Existing Doctor state ──
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('')
  const [specialization, setSpecialization] = useState(editDoctor?.dept ?? 'General Medicine')
  const [customSpec, setCustomSpec] = useState('')
  const [roomNumber, setRoomNumber] = useState(editDoctor?.room ?? '')
  const [series, setSeries] = useState(editDoctor?.series ?? '')
  const [maxPerHour, setMaxPerHour] = useState(String(editDoctor?.maxAppointmentsPerHour ?? 4))
  const [systemDoctors, setSystemDoctors] = useState<ApiDoctor[]>([])

  // ── Create New Doctor state ──
  const [newDoctorName, setNewDoctorName] = useState('')
  const [newSpecialization, setNewSpecialization] = useState('General Medicine')
  const [newCustomSpec, setNewCustomSpec] = useState('')
  const [newSlmcRegNo, setNewSlmcRegNo] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRoomNumber, setNewRoomNumber] = useState('')
  const [newSeries, setNewSeries] = useState('')

  // ── Shared state ──
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [error, setError] = useState<string | null>(null)

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
    setActiveTab('invite')
    setSelectedDoctorId('')
    setSpecialization('General Medicine')
    setCustomSpec('')
    setRoomNumber('')
    setSeries('')
    setMaxPerHour('4')
    setNewDoctorName('')
    setNewSpecialization('General Medicine')
    setNewCustomSpec('')
    setNewSlmcRegNo('')
    setNewPhone('')
    setNewEmail('')
    setNewRoomNumber('')
    setNewSeries('')
    setSaving(false)
    setDone(false)
    setSuccessMsg('')
    setError(null)
  }

  if (!isOpen) return null

  const finalSpec = specialization === 'Other' ? customSpec.trim() : specialization
  const finalNewSpec = newSpecialization === 'Other' ? newCustomSpec.trim() : newSpecialization
  const targetCenterId = centerId || null
  const noCenter = !isEdit && !targetCenterId

  // ── Invite Existing Doctor submit ──
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (!targetCenterId) {
        setError("Your account isn't linked to a medical center yet. Ask an admin to assign one before requesting doctors.")
        setSaving(false)
        return
      }
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
      setTimeout(() => { resetState(); onClose() }, 2500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  // ── Edit Doctor submit (unchanged) ──
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (editDoctor) {
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
        setTimeout(() => { resetState(); onClose() }, 2500)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  // ── Create New Doctor submit ──
  const handleCreateNewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (!targetCenterId) {
        setError("Your account isn't linked to a medical center yet.")
        setSaving(false)
        return
      }
      if (!newDoctorName.trim()) {
        setError('Doctor full name is required.')
        setSaving(false)
        return
      }
      if (!finalNewSpec) {
        setError('Specialization is required.')
        setSaving(false)
        return
      }
      await api.createDoctorRequest({
        requestType: 'CREATE_NEW',
        centerId: targetCenterId!,
        centerName: _centerName || undefined,
        doctorName: newDoctorName.trim(),
        specialization: finalNewSpec,
        slmcRegNo: newSlmcRegNo.trim() || undefined,
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        roomNumber: newRoomNumber.trim() || undefined,
        series: newSeries.trim().toUpperCase() || undefined,
      })
      setSuccessMsg(`Doctor creation request for ${newDoctorName.trim()} submitted to System Admin for approval. The doctor will receive an SMS with login credentials once approved.`)
      setDone(true)
      setTimeout(() => { resetState(); onClose() }, 4000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not submit request. Please try again.')
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
              {isEdit ? "Update doctor's room and schedule parameters." : 'Invite an existing doctor or register a new one.'}
            </div>
          </div>
        </div>

        {/* Tab Toggle — only shown when NOT in edit mode */}
        {!isEdit && !done && !noCenter && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-md)' }}>
            <button
              type="button"
              onClick={() => { setActiveTab('invite'); setError(null) }}
              style={{
                flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: activeTab === 'invite' ? 'var(--blue)' : 'transparent',
                color: activeTab === 'invite' ? '#fff' : 'var(--text-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <UserCheck size={14} /> Invite Existing Doctor
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('create'); setError(null) }}
              style={{
                flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                background: activeTab === 'create' ? 'var(--blue)' : 'transparent',
                color: activeTab === 'create' ? '#fff' : 'var(--text-3)',
                borderLeft: '1px solid var(--border-md)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <UserPlus size={14} /> Create New Doctor
            </button>
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
              {isEdit ? 'Changes Saved!' : activeTab === 'create' ? 'Request Submitted!' : 'Request Sent!'}
            </h4>
            <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 8, maxWidth: 380, marginInline: 'auto' }}>
              {successMsg}
            </p>
            {activeTab === 'create' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--text-4)' }}>
                <Clock size={13} /> Awaiting System Admin approval
              </div>
            )}
          </div>
        ) : isEdit ? (
          /* ── Edit Doctor Form (unchanged) ── */
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Specialisation */}
            <div>
              <label style={labelStyle}>Specialisation</label>
              <select className="input" value={specialization} onChange={e => setSpecialization(e.target.value)} style={inputStyle}>
                {SPECIALISATIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {specialization === 'Other' && (
              <div>
                <label style={labelStyle}>Custom Specialisation</label>
                <input className="input" placeholder="e.g. Sports Medicine" value={customSpec} onChange={e => setCustomSpec(e.target.value)} required style={inputStyle} />
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Consultation Room Number</label>
                <input className="input" placeholder="e.g. Room 04" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Token Series Letter (A–Z)</label>
                <input className="input" placeholder="Auto-assigned if left blank" value={series} maxLength={1} onChange={e => setSeries(e.target.value.toUpperCase())} style={inputStyle} />
              </div>
            </div>
            {error && <div style={{ background: '#fff1f1', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#dc2626' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => { resetState(); onClose() }} className="btn btn-ghost" style={{ height: 42 }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ gap: 8, height: 42, padding: '0 22px', fontSize: 14 }}>
                {saving ? <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> : <UserPlus size={16} />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : activeTab === 'invite' ? (
          /* ── Tab 1: Invite Existing Doctor Form ── */
          <form onSubmit={handleInviteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#1e40af' }}>
              <Inbox size={18} style={{ flexShrink: 0 }} />
              <span>The request will be sent <strong>directly to the doctor's dashboard</strong>. They will see it when they log in and can accept or decline.</span>
            </div>
            <div>
              <label style={labelStyle}>Select a Doctor to Add to This Center</label>
              {systemDoctors.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-4)', fontStyle: 'italic', padding: 8 }}>
                  Every registered doctor is already at this center. Use the "Create New Doctor" tab to register a new one.
                </div>
              ) : (
                <select className="input" value={selectedDoctorId} onChange={e => {
                  setSelectedDoctorId(e.target.value)
                  const d = systemDoctors.find(doc => doc.id === e.target.value)
                  if (d) setSpecialization(d.dept || 'General Medicine')
                }} style={inputStyle}>
                  {systemDoctors.map(doc => {
                    const elsewhere = (doc.centers ?? []).map(c => c.centerName).filter(Boolean).join(', ')
                    return <option key={doc.id} value={doc.id}>{doc.name} — {doc.dept}{elsewhere ? ` (also at ${elsewhere})` : ''}</option>
                  })}
                </select>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Consultation Room Number</label>
                <input className="input" placeholder="e.g. Room 04" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Token Series Letter (A–Z)</label>
                <input className="input" placeholder="Auto-assigned if left blank" value={series} maxLength={1} onChange={e => setSeries(e.target.value.toUpperCase())} style={inputStyle} />
              </div>
            </div>
            {error && <div style={{ background: '#fff1f1', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#dc2626' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => { resetState(); onClose() }} className="btn btn-ghost" style={{ height: 42 }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || noCenter} style={{ gap: 8, height: 42, padding: '0 22px', fontSize: 14 }}>
                {saving ? <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> : <UserCheck size={16} />}
                {saving ? 'Sending…' : 'Send Join Request'}
              </button>
            </div>
          </form>
        ) : (
          /* ── Tab 2: Create New Doctor Form ── */
          <form onSubmit={handleCreateNewSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(245, 158, 11, 0.07)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#92400e' }}>
              <Clock size={18} style={{ flexShrink: 0 }} />
              <span>This request will be sent to the <strong>System Admin</strong> for approval. Once approved, the doctor will receive login credentials via SMS.</span>
            </div>
            <div>
              <label style={labelStyle}>Full Name <span style={{ color: '#dc2626' }}>*</span></label>
              <input className="input" placeholder="e.g. Dr. Amila Perera" value={newDoctorName} onChange={e => setNewDoctorName(e.target.value)} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Specialization <span style={{ color: '#dc2626' }}>*</span></label>
              <select className="input" value={newSpecialization} onChange={e => setNewSpecialization(e.target.value)} style={inputStyle}>
                {SPECIALISATIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {newSpecialization === 'Other' && (
              <div>
                <label style={labelStyle}>Custom Specialization</label>
                <input className="input" placeholder="e.g. Sports Medicine" value={newCustomSpec} onChange={e => setNewCustomSpec(e.target.value)} required style={inputStyle} />
              </div>
            )}
            <div>
              <label style={labelStyle}>SLMC Register No.</label>
              <input className="input" placeholder="e.g. SLMC-98765" value={newSlmcRegNo} onChange={e => setNewSlmcRegNo(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input className="input" placeholder="e.g. 0771234567" value={newPhone} onChange={e => setNewPhone(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Work Email (optional)</label>
                <input className="input" type="email" placeholder="Auto-generated if blank" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Consultation Room</label>
                <input className="input" placeholder="e.g. Room 04" value={newRoomNumber} onChange={e => setNewRoomNumber(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Token Series (A–Z)</label>
                <input className="input" placeholder="Auto-assigned" value={newSeries} maxLength={1} onChange={e => setNewSeries(e.target.value.toUpperCase())} style={inputStyle} />
              </div>
            </div>
            {error && <div style={{ background: '#fff1f1', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#dc2626' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => { resetState(); onClose() }} className="btn btn-ghost" style={{ height: 42 }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || noCenter} style={{ gap: 8, height: 42, padding: '0 22px', fontSize: 14 }}>
                {saving ? <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> : <UserPlus size={16} />}
                {saving ? 'Submitting…' : 'Submit for Admin Approval'}
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
