import { useState, useEffect } from 'react'
import { Calendar, Clock, X, Check, Stethoscope, AlertCircle, Building2, Loader2 } from 'lucide-react'
import { bookAppointment, fetchCentersList, fetchDoctorsList, fetchDoctorHours, fetchAllAppointments } from '../services/patientService'
import { AppointmentItem } from '../types/patient'

interface BookAppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  preselectedDoctor?: string
  preselectedCenter?: string
  onBookingSuccess: (newApt: AppointmentItem) => void
}

interface SlotItem {
  hour: number
  label: string
  rem: number
  maxLimit: number
}

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
  const [appointmentDate, setAppointmentDate] = useState(() => new Date().toISOString().split('T')[0])
  const [slotHour, setSlotHour] = useState(10)

  const [dynamicSlots, setDynamicSlots] = useState<SlotItem[]>([])
  const [maxCapacity, setMaxCapacity] = useState(4)
  const [doctorOffDuty, setDoctorOffDuty] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)

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

  // Fetch real-time Doctor Hours & live slot availability whenever doctor or date changes
  useEffect(() => {
    async function loadDynamicSlots() {
      if (!selectedDoctorId || !appointmentDate) return
      setLoadingSlots(true)
      try {
        const [hoursRes, apptsRes] = await Promise.all([
          fetchDoctorHours(selectedDoctorId),
          fetchAllAppointments()
        ])

        const limitPerHour = hoursRes.maxAppointmentsPerHour || 4
        setMaxCapacity(limitPerHour)

        // Parse selected date to find Day of Week (0 = Sun, 1 = Mon, ..., 6 = Sat)
        const parts = appointmentDate.split('-').map(Number)
        const dateObj = new Date(parts[0], parts[1] - 1, parts[2])
        const dow = dateObj.getDay()

        // Find doctor's configured hours for this day of week
        const dayHours = (hoursRes.hours || []).find((h: any) => h.dayOfWeek === dow)
        const isAvailable = dayHours ? dayHours.isAvailable : (dow >= 1 && dow <= 5)

        if (!isAvailable) {
          setDoctorOffDuty(true)
          setDynamicSlots([])
          setLoadingSlots(false)
          return
        }

        setDoctorOffDuty(false)

        // Parse start and end hours
        const startH = dayHours?.startTime ? parseInt(dayHours.startTime.split(':')[0], 10) : 8
        const endH = dayHours?.endTime ? parseInt(dayHours.endTime.split(':')[0], 10) : 17

        // Filter active booked appointments for this doctor & date
        const bookedForDocAndDate = (apptsRes || []).filter((a: any) => {
          const aDocId = a.doctorId || a.doctor_id
          const aDate = (a.appointmentDate || a.appointment_date || '').slice(0, 10)
          const aStatus = a.status
          return (aDocId === selectedDoctorId) && (aDate === appointmentDate) && (aStatus !== 'cancelled')
        })

        // Generate hourly slots
        const slots: SlotItem[] = []
        for (let h = startH; h < endH; h++) {
          const bookedCount = bookedForDocAndDate.filter((a: any) => (a.slotHour ?? a.slot_hour) === h).length
          const rem = Math.max(0, limitPerHour - bookedCount)

          const formatH = (hourNum: number) => {
            const pm = hourNum >= 12
            const h12 = hourNum % 12 === 0 ? 12 : hourNum % 12
            const padded = h12 < 10 ? `0${h12}` : `${h12}`
            return `${padded}:00 ${pm ? 'PM' : 'AM'}`
          }

          slots.push({
            hour: h,
            label: `${formatH(h)} - ${formatH(h + 1)}`,
            rem,
            maxLimit: limitPerHour
          })
        }

        setDynamicSlots(slots)

        // Auto select first available slot
        if (slots.length > 0) {
          const validSelected = slots.find(s => s.hour === slotHour && s.rem > 0)
          if (!validSelected) {
            const firstAvailable = slots.find(s => s.rem > 0) || slots[0]
            setSlotHour(firstAvailable.hour)
          }
        }
      } catch (e) {
        console.warn('Error loading dynamic slots:', e)
      } finally {
        setLoadingSlots(false)
      }
    }

    if (isOpen && selectedDoctorId) {
      loadDynamicSlots()
    }
  }, [isOpen, selectedDoctorId, appointmentDate])

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
    if (doctorOffDuty) {
      setError('Doctor is off-duty on the selected date. Please select another date.')
      return
    }

    const slotInfo = dynamicSlots.find(s => s.hour === slotHour)
    if (slotInfo && slotInfo.rem === 0) {
      setError(`This hourly slot has reached its maximum capacity (${maxCapacity} patients/hr). Please pick another slot.`)
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

          {/* Dynamic Hourly Slot Selector */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase' }}>
                Hourly Slot Availability (Max {maxCapacity} patients/hr)
              </label>
              {loadingSlots && (
                <span style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Loader2 size={12} className="spin" /> Checking live capacity...
                </span>
              )}
            </div>

            {doctorOffDuty ? (
              <div style={{ padding: 16, borderRadius: 10, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#D97706', fontSize: 12.5, textAlign: 'center', fontWeight: 600 }}>
                🚨 Doctor is Off-Duty / Not Available on this day of the week. Please select another date above.
              </div>
            ) : dynamicSlots.length === 0 && !loadingSlots ? (
              <div style={{ padding: 16, borderRadius: 10, background: '#f8fafc', border: '1px solid var(--border-md)', color: 'var(--text-4)', fontSize: 12, textAlign: 'center' }}>
                No hours configured for this doctor on this day.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {dynamicSlots.map(s => {
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
                        {isFull ? `❌ Slot Full (${s.maxLimit}/${s.maxLimit} booked)` : `● ${s.rem} of ${s.maxLimit} slots available`}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={booking || !selectedDoc.id || doctorOffDuty}
              className="btn btn-primary"
              style={{ gap: 6 }}
            >
              <Check size={14} /> {booking ? 'Booking...' : 'Confirm Appointment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
