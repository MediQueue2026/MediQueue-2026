import { useEffect, useState } from 'react'
import { X, Stethoscope, CheckCircle2, Inbox, UserPlus, UserCheck, Clock, User, Award, Calendar, Building2 } from 'lucide-react'
import { api } from '../lib/api'
import type { ApiDoctor } from '../lib/api'
import CleanDatePicker from './CleanDatePicker'

const SPECIALISATIONS = [
  'General Medicine', 'Cardiology', 'Pediatrics', 'Orthopedics',
  'Dermatology', 'Neurology', 'Ophthalmology', 'ENT',
  'Gynecology', 'Psychiatry', 'Oncology', 'Radiology',
  'Gastroenterology', 'Urology', 'Endocrinology', 'Other',
]

const GENDER_OPTIONS = ['Male', 'Female', 'Other']

const MONTHS = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Feb' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Apr' },
  { value: '05', label: 'May' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Aug' },
  { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
]

function FlexibleDateInput({
  value,
  onChange,
  maxYear = new Date().getFullYear(),
  minYear = 1940,
  align = 'right',
}: {
  value: string
  onChange: (val: string) => void
  maxYear?: number
  minYear?: number
  align?: 'left' | 'right'
}) {
  const parts = (value || '').split('-')
  const yearVal = parts[0] || ''
  const monthVal = parts[1] || ''
  const dayVal = parts[2] || ''

  const handleYearChange = (newY: string) => {
    if (!newY && !monthVal && !dayVal) {
      onChange('')
      return
    }
    const yNum = parseInt(newY, 10)
    const yStr = isNaN(yNum) ? '' : String(yNum)
    onChange(`${yStr ? yStr.padStart(4, '0') : ''}-${monthVal || '01'}-${dayVal || '01'}`)
  }

  const handleMonthChange = (newM: string) => {
    const yStr = yearVal || String(maxYear - 30)
    onChange(`${yStr}-${newM || '01'}-${dayVal || '01'}`)
  }

  const handleDayChange = (newD: string) => {
    const yStr = yearVal || String(maxYear - 30)
    const dNum = Math.min(31, Math.max(1, parseInt(newD, 10) || 1))
    const dStr = String(dNum).padStart(2, '0')
    onChange(`${yStr}-${monthVal || '01'}-${dStr}`)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <input
        className="input"
        type="number"
        placeholder="YYYY"
        min={minYear}
        max={maxYear}
        value={yearVal ? parseInt(yearVal, 10) : ''}
        onChange={e => handleYearChange(e.target.value)}
        style={{ ...inputStyle, width: 70, padding: '0 6px', textAlign: 'center' }}
        title="Type birth year"
      />
      <select
        className="input"
        value={monthVal}
        onChange={e => handleMonthChange(e.target.value)}
        style={{ ...inputStyle, flex: 1, minWidth: 62, padding: '0 4px' }}
        title="Select birth month"
      >
        <option value="">Month</option>
        {MONTHS.map(m => (
          <option key={m.value} value={m.value}>{m.label}</option>
        ))}
      </select>
      <input
        className="input"
        type="number"
        placeholder="DD"
        min={1}
        max={31}
        value={dayVal ? parseInt(dayVal, 10) : ''}
        onChange={e => handleDayChange(e.target.value)}
        style={{ ...inputStyle, width: 50, padding: '0 4px', textAlign: 'center' }}
        title="Type birth day"
      />
      <div style={{ width: 85, flexShrink: 0 }}>
        <CleanDatePicker
          value={value}
          onChange={onChange}
          minYear={minYear}
          maxYear={maxYear}
          placeholder="Pick"
          align={align}
        />
      </div>
    </div>
  )
}

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
  const todayStr = new Date().toISOString().split('T')[0]

  // ── Tab state (only relevant when not in Edit mode) ──
  const [activeTab, setActiveTab] = useState<'invite' | 'create'>('invite')

  // ── Invite Existing Doctor state ──
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('')
  const [specialization, setSpecialization] = useState('General Medicine')
  const [customSpec, setCustomSpec] = useState('')
  const [roomNumber, setRoomNumber] = useState('')
  const [series, setSeries] = useState('')
  const [inviteJoinedDate, setInviteJoinedDate] = useState(todayStr)
  const [invitePhone, setInvitePhone] = useState('')
  const [maxPerHour, setMaxPerHour] = useState('4')
  const [systemDoctors, setSystemDoctors] = useState<ApiDoctor[]>([])

  // ── Create New Doctor state ──
  const [newDoctorName, setNewDoctorName] = useState('')
  const [newGender, setNewGender] = useState('Male')
  const [newDob, setNewDob] = useState('')
  const [newNic, setNewNic] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newSpecialization, setNewSpecialization] = useState('General Medicine')
  const [newCustomSpec, setNewCustomSpec] = useState('')
  const [newSlmcRegNo, setNewSlmcRegNo] = useState('')
  const [newQualifications, setNewQualifications] = useState('')
  const [newStartYear, setNewStartYear] = useState('')
  const [newRoomNumber, setNewRoomNumber] = useState('')
  const [newJoinedDate, setNewJoinedDate] = useState(todayStr)

  // ── Edit Doctor state ──
  const [editName, setEditName] = useState('')
  const [editGender, setEditGender] = useState('')
  const [editDob, setEditDob] = useState('')
  const [editNic, setEditNic] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editSlmc, setEditSlmc] = useState('')
  const [editQuals, setEditQuals] = useState('')
  const [editStartYear, setEditStartYear] = useState('')
  const [editJoinedDate, setEditJoinedDate] = useState(todayStr)

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
      setEditName(editDoctor.name || '')
      setEditGender(editDoctor.gender || 'Male')
      setEditDob(editDoctor.dateOfBirth ? editDoctor.dateOfBirth.split('T')[0] : '')
      setEditNic(editDoctor.nic || '')
      setEditPhone(editDoctor.phone || '')
      setEditEmail(editDoctor.email || '')
      setSpecialization(editDoctor.dept || editDoctor.specialization || 'General Medicine')
      setEditSlmc(editDoctor.slmcRegNo || '')
      setEditQuals(editDoctor.qualifications || '')
      setEditStartYear(editDoctor.experienceStartYear ? String(editDoctor.experienceStartYear) : '')
      setRoomNumber(editDoctor.room || '')
      setSeries(editDoctor.series || '')
      setEditJoinedDate(editDoctor.joinedDate ? editDoctor.joinedDate.split('T')[0] : todayStr)
      setMaxPerHour(String(editDoctor.maxAppointmentsPerHour || 4))
    }
  }, [editDoctor, todayStr])

  useEffect(() => {
    if (selectedDoctorId && systemDoctors.length > 0) {
      const doc = systemDoctors.find(d => d.id === selectedDoctorId)
      if (doc) {
        setInvitePhone(doc.phone || '')
      }
    }
  }, [selectedDoctorId, systemDoctors])

  const resetState = () => {
    setActiveTab('invite')
    setSelectedDoctorId('')
    setSpecialization('General Medicine')
    setCustomSpec('')
    setRoomNumber('')
    setSeries('')
    setInviteJoinedDate(todayStr)
    setInvitePhone('')
    setEditEmail('')
    setEditName('')
    setEditGender('Male')
    setEditDob('')
    setEditNic('')
    setEditPhone('')
    setEditSlmc('')
    setEditQuals('')
    setEditStartYear('')
    setEditJoinedDate(todayStr)
    setMaxPerHour('4')
    setNewDoctorName('')
    setNewGender('Male')
    setNewDob('')
    setNewNic('')
    setNewPhone('')
    setNewEmail('')
    setNewSpecialization('General Medicine')
    setNewCustomSpec('')
    setNewSlmcRegNo('')
    setNewQualifications('')
    setNewStartYear('')
    setNewRoomNumber('')
    setNewJoinedDate(todayStr)
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

  // Find currently selected existing doctor for auto-fill in Tab 1
  const selectedExistingDoc = systemDoctors.find(d => d.id === selectedDoctorId)

  const currentYear = new Date().getFullYear()

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
      if (!selectedExistingDoc) {
        setError('Please select an existing doctor from the list.')
        setSaving(false)
        return
      }
      await api.createDoctorRequest({
        requestType: 'ASSIGN_EXISTING',
        centerId: targetCenterId!,
        centerName: _centerName || undefined,
        doctorId: selectedExistingDoc.id,
        doctorName: selectedExistingDoc.name,
        specialization: selectedExistingDoc.dept || finalSpec || 'General Medicine',
        phone: invitePhone.trim() || undefined,
        roomNumber: roomNumber.trim() || undefined,
        joinedDate: inviteJoinedDate || undefined,
        maxAppointmentsPerHour: Number(maxPerHour) || 4,
      })
      setSuccessMsg(`Join request sent to ${selectedExistingDoc.name}! They will see it in their dashboard and can accept or decline.`)
      setDone(true)
      setTimeout(() => { resetState(); onClose() }, 2500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  // ── Edit Doctor submit ──
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      if (!editDoctor) return

      const cleanSeries = series.trim().toUpperCase()
      if (cleanSeries && (!/^[A-Z]$/.test(cleanSeries))) {
        setError('Token series must be a single letter from A to Z.')
        setSaving(false)
        return
      }

      const startYearNum = editStartYear ? parseInt(editStartYear, 10) : undefined
      const expYears = startYearNum ? Math.max(0, currentYear - startYearNum) : undefined

      const res = await api.updateDoctor(editDoctor.id, {
        centerId: centerId ?? editDoctor.centerId ?? undefined,
        fullName: editName.trim() || undefined,
        phone: editPhone.trim() || undefined,
        gender: editGender || undefined,
        dateOfBirth: editDob || undefined,
        nic: editNic.trim() || undefined,
        specialization: finalSpec,
        slmcRegNo: editSlmc.trim() || undefined,
        qualifications: editQuals.trim() || undefined,
        experienceStartYear: startYearNum,
        yearsOfExperience: expYears,
        roomNumber: roomNumber.trim() || undefined,
        series: cleanSeries || undefined,
        email: editEmail.trim() || undefined,
        joinedDate: editJoinedDate || undefined,
        maxAppointmentsPerHour: Number(maxPerHour) || 4,
      })
      setSuccessMsg('Doctor profile updated successfully.')
      setDone(true)
      onCreated?.(res.doctor)
      setTimeout(() => { resetState(); onClose() }, 2500)
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
      if (!newSlmcRegNo.trim()) {
        setError('SLMC Registration Number is required.')
        setSaving(false)
        return
      }
      if (!newQualifications.trim()) {
        setError('Doctor qualifications are required.')
        setSaving(false)
        return
      }
      if (!newStartYear.trim()) {
        setError('Career start year is required.')
        setSaving(false)
        return
      }
      if (!newPhone.trim()) {
        setError('Phone number is required to send login credentials via SMS.')
        setSaving(false)
        return
      }

      const startYearNum = newStartYear ? parseInt(newStartYear, 10) : undefined
      const expYears = startYearNum ? Math.max(0, currentYear - startYearNum) : undefined

      await api.createDoctorRequest({
        requestType: 'CREATE_NEW',
        centerId: targetCenterId!,
        centerName: _centerName || undefined,
        doctorName: newDoctorName.trim(),
        gender: newGender || undefined,
        dateOfBirth: newDob || undefined,
        nic: newNic.trim() || undefined,
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        specialization: finalNewSpec,
        slmcRegNo: newSlmcRegNo.trim() || undefined,
        qualifications: newQualifications.trim() || undefined,
        experienceStartYear: startYearNum,
        yearsOfExperience: expYears,
        roomNumber: newRoomNumber.trim() || undefined,
        joinedDate: newJoinedDate || undefined,
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
        width: '100%', maxWidth: 580, maxHeight: '92vh',
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(18, 198, 186, 0.28)',
        borderRadius: 20, padding: '32px 28px',
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
              {isEdit ? "Update doctor's personal, professional, and center assignment details." : 'Invite an existing doctor or register a new one.'}
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
          /* ── Edit Doctor Form ── */
          <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Section: Personal Information */}
            <div style={sectionHeaderStyle}>
              <User size={14} color="var(--blue)" /> Personal Information
            </div>

            <div>
              <label style={labelStyle}>Full Name</label>
              <input className="input" value={editName} onChange={e => setEditName(e.target.value)} required style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Gender</label>
                <select className="input" value={editGender} onChange={e => setEditGender(e.target.value)} style={inputStyle}>
                  {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date of Birth</label>
                <FlexibleDateInput value={editDob} onChange={setEditDob} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>NIC Number</label>
                <input className="input" placeholder="e.g. 198512345678" value={editNic} onChange={e => setEditNic(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input className="input" placeholder="e.g. 0771234567" value={editPhone} onChange={e => setEditPhone(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* Section: Professional Credentials */}
            <div style={sectionHeaderStyle}>
              <Award size={14} color="var(--blue)" /> Professional Credentials
            </div>

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

            <div>
              <label style={labelStyle}>SLMC Registration No.</label>
              <input className="input" placeholder="e.g. SLMC-12345" value={editSlmc} onChange={e => setEditSlmc(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Qualifications</label>
              <input className="input" placeholder="e.g. MBBS, MD (Medicine), FRCP" value={editQuals} onChange={e => setEditQuals(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>
                Career Start Year (Practicing Since)
                {editStartYear && !isNaN(Number(editStartYear)) && Number(editStartYear) > 1950 && (
                  <span style={{ marginLeft: 8, color: '#10B981', fontWeight: 600, textTransform: 'none' }}>
                    ({Math.max(0, currentYear - Number(editStartYear))} years of clinical experience)
                  </span>
                )}
              </label>
              <input
                className="input"
                type="number"
                min="1960"
                max={currentYear}
                placeholder={`e.g. 2012`}
                value={editStartYear}
                onChange={e => setEditStartYear(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Section: Center Assignment */}
            <div style={sectionHeaderStyle}>
              <Building2 size={14} color="var(--blue)" /> Center Assignment & Posting
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Consultation Room</label>
                <input className="input" placeholder="e.g. Room 04" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} style={inputStyle} />
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Center Joined Date</label>
                <CleanDatePicker
                  value={editJoinedDate}
                  onChange={setEditJoinedDate}
                  placeholder="Select Joined Date"
                />
              </div>
              <div>
                <label style={labelStyle}>Work Email</label>
                <input
                  className="input"
                  type="email"
                  placeholder="e.g. doctor@mediqueue.lk"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  style={inputStyle}
                />
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

            {/* Doctor Phone (Editable) and Work Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input
                  className="input"
                  placeholder="e.g. 0771234567"
                  value={invitePhone}
                  onChange={e => setInvitePhone(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Work Email</label>
                <input
                  className="input"
                  value={selectedExistingDoc?.email || '—'}
                  disabled
                  readOnly
                  style={{ ...inputStyle, background: 'rgba(241,245,249,0.7)', color: 'var(--text-2)', cursor: 'not-allowed' }}
                />
              </div>
            </div>

            {/* Room + Auto-generated Token Series */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Consultation Room Number</label>
                <input className="input" placeholder="e.g. Room 04" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Token Series Letter (A–Z)</label>
                <input
                  className="input"
                  value="Auto-generated"
                  disabled
                  readOnly
                  style={{ ...inputStyle, background: 'rgba(241,245,249,0.7)', color: 'var(--text-4)', cursor: 'not-allowed', fontStyle: 'italic' }}
                />
              </div>
            </div>

            {/* Center Joined Date */}
            <div>
              <label style={labelStyle}>Center Joined Date</label>
              <CleanDatePicker
                value={inviteJoinedDate}
                onChange={setInviteJoinedDate}
                placeholder="Select Joined Date"
              />
            </div>

            {error && <div style={{ background: '#fff1f1', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#dc2626' }}>{error}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={() => { resetState(); onClose() }} className="btn btn-ghost" style={{ height: 42 }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving || noCenter || systemDoctors.length === 0} style={{ gap: 8, height: 42, padding: '0 22px', fontSize: 14 }}>
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

            {/* Section: Personal Information */}
            <div style={sectionHeaderStyle}>
              <User size={14} color="var(--blue)" /> Personal Information
            </div>

            <div>
              <label style={labelStyle}>Full Name <span style={{ color: '#dc2626' }}>*</span></label>
              <input className="input" placeholder="e.g. Dr. Amila Perera" value={newDoctorName} onChange={e => setNewDoctorName(e.target.value)} required style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Gender</label>
                <select className="input" value={newGender} onChange={e => setNewGender(e.target.value)} style={inputStyle}>
                  {GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date of Birth</label>
                <FlexibleDateInput value={newDob} onChange={setNewDob} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>NIC Number</label>
                <input className="input" placeholder="e.g. 199012345678" value={newNic} onChange={e => setNewNic(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Phone Number <span style={{ color: '#dc2626' }}>*</span></label>
                <input className="input" placeholder="e.g. 0771234567" value={newPhone} onChange={e => setNewPhone(e.target.value)} required style={inputStyle} />
              </div>
            </div>

            {/* Section: Professional Credentials */}
            <div style={sectionHeaderStyle}>
              <Award size={14} color="var(--blue)" /> Professional Credentials
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
              <label style={labelStyle}>SLMC Register No. <span style={{ color: '#dc2626' }}>*</span></label>
              <input className="input" placeholder="e.g. SLMC-98765" value={newSlmcRegNo} onChange={e => setNewSlmcRegNo(e.target.value)} required style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Qualifications <span style={{ color: '#dc2626' }}>*</span></label>
              <input className="input" placeholder="e.g. MBBS, MD, FRCS" value={newQualifications} onChange={e => setNewQualifications(e.target.value)} required style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>
                Career Start Year (Practicing Since) <span style={{ color: '#dc2626' }}>*</span>
                {newStartYear && !isNaN(Number(newStartYear)) && Number(newStartYear) > 1950 && (
                  <span style={{ marginLeft: 8, color: '#10B981', fontWeight: 600, textTransform: 'none' }}>
                    ({Math.max(0, currentYear - Number(newStartYear))} years of clinical experience)
                  </span>
                )}
              </label>
              <input
                className="input"
                type="number"
                min="1960"
                max={currentYear}
                placeholder="e.g. 2015"
                value={newStartYear}
                onChange={e => setNewStartYear(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            {/* Section: Center Assignment */}
            <div style={sectionHeaderStyle}>
              <Building2 size={14} color="var(--blue)" /> Center Assignment
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Consultation Room</label>
                <input className="input" placeholder="e.g. Room 04" value={newRoomNumber} onChange={e => setNewRoomNumber(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Center Joined Date</label>
                <CleanDatePicker
                  value={newJoinedDate}
                  onChange={setNewJoinedDate}
                  placeholder="Select Joined Date"
                  align="right"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Token Series (A–Z)</label>
                <input
                  className="input"
                  value="Auto-generated"
                  disabled
                  readOnly
                  style={{ ...inputStyle, background: 'rgba(241,245,249,0.7)', color: 'var(--text-4)', cursor: 'not-allowed', fontStyle: 'italic' }}
                />
              </div>
              <div>
                <label style={labelStyle}>Work Email (optional)</label>
                <input
                  className="input"
                  type="email"
                  placeholder="Auto-generated if blank"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  style={inputStyle}
                />
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

const inputStyle: React.CSSProperties = {
  height: 42,
  fontSize: 13.5,
  colorScheme: 'light',
  background: '#ffffff',
  color: '#1e293b',
}

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  color: 'var(--text-2)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginTop: 4,
  marginBottom: -4,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  borderBottom: '1px solid rgba(18, 198, 186, 0.15)',
  paddingBottom: 4,
}
