import { useState, useEffect } from 'react'
import { Calendar, Clock, X, Check, Stethoscope, AlertCircle, Building2 } from 'lucide-react'
import { bookAppointment, fetchCentersList, fetchDoctorsList } from '../services/patientService'
import { AppointmentItem } from '../types/patient'

interface BookAppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  preselectedDoctor?: string
  preselectedCenter?: string
  onBookingSuccess: (newApt: AppointmentItem) => void
}

const HOURLY_SLOTS = [
  { hour: 8,  label: '08:00 AM - 09:00 AM', rem: 4 },
  { hour: 9,  label: '09:00 AM - 10:00 AM', rem: 2 },
  { hour: 10, label: '10:00 AM - 11:00 AM', rem: 1 },
  { hour: 11, label: '11:00 AM - 12:00 PM', rem: 3 },
  { hour: 12, label: '12:00 PM - 01:00 PM', rem: 4 },
  { hour: 14, label: '02:00 PM - 03:00 PM', rem: 4 },
  { hour: 15, label: '03:00 PM - 04:00 PM', rem: 0 },
  { hour: 16, label: '04:00 PM - 05:00 PM', rem: 2 },
]

export function BookAppointmentModal({
  isOpen,
  onClose,
  patientId,
  preselectedDoctor,
  preselectedCenter,
  onBookingSuccess
}: BookAppointmentModalProps) {
  const [centers, setCenters] = useState<any[]>([])
  const [allDoctors, setAllDoctors] = useState<any[]>([])
  
  const [selectedCenterId, setSelectedCenterId] = useState(preselectedCenter || '')
  const [selectedDoctorId, setSelectedDoctorId] = useState(preselectedDoctor || '')
  const [appointmentDate, setAppointmentDate] = useState('2026-08-15')
  const [slotHour, setSlotHour] = useState(10)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadOptions() {
      const cList = await fetchCentersList()
      setCenters(cList)
      const dList = await fetchDoctorsList()
      setAllDoctors(dList)

      const initialCenter = preselectedCenter || (cList[0] ? cList[0].id : '')
      setSelectedCenterId(initialCenter)
      
      const filtered = dList.filter((d: any) => !initialCenter || d.centerId === initialCenter || d.center_id === initialCenter)
      if (filtered.length > 0) {
        setSelectedDoctorId(preselectedDoctor || filtered[0].id)
      } else if (dList.length > 0) {
        setSelectedDoctorId(dList[0].id)
      }
    }
    if (isOpen) {
      loadOptions()
    }
  }, [isOpen, preselectedCenter, preselectedDoctor])

  if (!isOpen) return null

  // Filter doctors assigned to selected center
  const assignedDoctors = allDoctors.filter(d => 
    !selectedCenterId || d.centerId === selectedCenterId || d.center_id === selectedCenterId || allDoctors.length <= 2
  )

  const selectedCenter = centers.find(c => c.id === selectedCenterId) || centers[0] || { name: 'MediQueue Central Clinic', city: 'Colombo 07' }
  const selectedDoc = assignedDoctors.find(d => d.id === selectedDoctorId) || assignedDoctors[0] || { id: 'd1', name: 'Dr. Aisha Patel', spec: 'Cardiology', room: 'Room 03' }

  const handleCenterChange = (cId: string) => {
    setSelectedCenterId(cId)
    const filtered = allDoctors.filter(d => d.centerId === cId || d.center_id === cId)
    if (filtered.length > 0) {
      setSelectedDoctorId(filtered[0].id)
    }
  }

  const handleConfirm = async () => {
    const slotInfo = HOURLY_SLOTS.find(s => s.hour === slotHour)
    if (slotInfo && slotInfo.rem === 0) {
      setError('This hourly slot has reached its maximum limit (4 patients/hr). Please pick another slot.')
      return
    }

    setError('')
    setBooking(true)

    const result = await bookAppointment({
      doctorId: selectedDoc.id,
      doctorName: selectedDoc.name,
      centerId: selectedCenter.id,
      appointmentDate,
      slotHour,
      patientId,
    })

    setBooking(false)
    onBookingSuccess(result.appointment)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(7, 21, 20, 0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div className="card glass-form-card" style={{
        width: '100%', maxWidth: 540, maxHeight: '88vh', overflowY: 'auto',
        background: '#ffffff', borderRadius: 16,
        padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
              <Calendar size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>Book Doctor Appointment</h3>
              <p style={{ fontSize: 11.5, color: 'var(--text-4)', margin: 0 }}>Step 1: Select Medical Center → Step 2: Select Assigned Doctor & Time</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-4)' }}><X size={18} /></button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--crimson-dim)', border: '1px solid var(--crimson-border)', borderRadius: 8, color: 'var(--crimson)', fontSize: 12, marginBottom: 14 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* STEP 1: SELECT MEDICAL CENTER FIRST */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <Building2 size={13} color="var(--blue)" /> Step 1: Select Medical Center
            </label>
            <select
              className="input"
              value={selectedCenterId}
              onChange={e => handleCenterChange(e.target.value)}
              style={{ height: 42, fontSize: 13.5, fontWeight: 600 }}
            >
              {centers.map(c => (
                <option key={c.id} value={c.id}>
                  🏥 {c.name} — {c.city || c.address}
                </option>
              ))}
            </select>
          </div>

          {/* STEP 2: SELECT DOCTOR ASSIGNED TO THIS CENTER */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
              <Stethoscope size={13} color="var(--blue)" /> Step 2: Select Doctor (Assigned to {selectedCenter.name})
            </label>
            <select
              className="input"
              value={selectedDoctorId}
              onChange={e => setSelectedDoctorId(e.target.value)}
              style={{ height: 42, fontSize: 13.5 }}
            >
              {assignedDoctors.length > 0 ? (
                assignedDoctors.map(d => (
                  <option key={d.id} value={d.id}>
                    👨‍⚕️ {d.name} ({d.spec}) — {d.room || 'Consultation Room'}
                  </option>
                ))
              ) : (
                <option value="">No doctors assigned to this center yet</option>
              )}
            </select>
          </div>

          {/* Selected Doctor Summary Card */}
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--blue-dim)', border: '1px solid var(--blue-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Stethoscope size={20} color="var(--blue)" />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>{selectedDoc.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--blue-dark)' }}>{selectedDoc.spec} · {selectedDoc.room || 'Room 01'} · {selectedCenter.name}</div>
            </div>
          </div>

          {/* Appointment Date */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Appointment Date</label>
            <input
              type="date"
              className="input"
              value={appointmentDate}
              onChange={e => setAppointmentDate(e.target.value)}
              style={{ height: 42, fontSize: 13.5 }}
            />
          </div>

          {/* Hourly Slot Selector (AM/PM Formatted, BR-02 Enforced) */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Hourly Slot Availability (Max 4 patients/hr)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {HOURLY_SLOTS.map(s => {
                const isSelected = slotHour === s.hour
                const isFull = s.rem === 0
                return (
                  <button
                    key={s.hour}
                    type="button"
                    disabled={isFull}
                    onClick={() => setSlotHour(s.hour)}
                    style={{
                      padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                      background: isSelected ? 'var(--blue)' : isFull ? '#f5f5f5' : '#ffffff',
                      color: isSelected ? '#ffffff' : isFull ? '#a0a0a0' : 'var(--text-1)',
                      border: '1px solid', borderColor: isSelected ? 'var(--blue)' : 'var(--border-md)',
                      cursor: isFull ? 'not-allowed' : 'pointer', opacity: isFull ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Clock size={12} /> {s.label}
                    </div>
                    <div style={{ fontSize: 10.5, marginTop: 2, color: isSelected ? '#e0f7f5' : isFull ? 'var(--crimson)' : 'var(--blue-dark)' }}>
                      {isFull ? '❌ Slot Full (4/4 booked)' : `● ${s.rem} of 4 slots available`}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="button" onClick={handleConfirm} disabled={booking || !selectedDoc.id} className="btn btn-primary" style={{ gap: 6 }}>
              <Check size={14} /> {booking ? 'Booking...' : 'Confirm Appointment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
