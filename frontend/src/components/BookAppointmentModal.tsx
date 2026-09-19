import { useState, useEffect, useMemo } from 'react'
import { Calendar, Clock, X, Check, Stethoscope, AlertCircle, Building2, Loader2, CalendarX } from 'lucide-react'
import { bookAppointment, fetchCentersList, fetchDoctorsList, fetchDoctorHours, fetchAllAppointments, fetchPatientAppointments, fetchCenterClosures, fetchCenterDayHours } from '../services/patientService'
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
  sessionLabel?: string
}

/** Local YYYY-MM-DD for a Date (not UTC — `toISOString` shifts the day near midnight). */
function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** `base` + `days`, as a local YYYY-MM-DD string. */
function addDaysIso(base: Date, days: number): string {
  return toLocalIso(new Date(base.getFullYear(), base.getMonth(), base.getDate() + days))
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
  const [appointmentDate, setAppointmentDate] = useState(() => toLocalIso(new Date()))
  const [slotHour, setSlotHour] = useState(10)

  const [dynamicSlots, setDynamicSlots] = useState<SlotItem[]>([])
  const [maxCapacity, setMaxCapacity] = useState(4)
  const [doctorOffDuty, setDoctorOffDuty] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)

  const [allApptsList, setAllApptsList] = useState<any[]>([])
  const [conflictModalData, setConflictModalData] = useState<{
    doctorName: string
    centerName: string
    date: string
    timeRange: string
  } | null>(null)

  // Ticks every minute while the modal is open so passed dates/slots drop off
  // on their own — no config, it just follows the clock.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!isOpen) return
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [isOpen])
  const todayIso = toLocalIso(now)

  // Dates this center has marked closed (public holidays etc.). The backend
  // rejects a booking on one of these regardless; this greys the day out first.
  const [centerClosedDates, setCenterClosedDates] = useState<string[]>([])
  const isSelectedDateClosed = centerClosedDates.includes(appointmentDate)

  // Date-specific hours (migration 014): per-doctor overrides drive slots below;
  // the centre label is informational only, shown as a caption under the date field.
  const [centerDayHours, setCenterDayHours] = useState<{
    centerHours: { openDate: string; hoursLabel: string; note: string }[]
    doctorHours: { doctorId: string; workDate: string; isWorking: boolean; startTime: string | null; endTime: string | null }[]
  }>({ centerHours: [], doctorHours: [] })
  const centerHoursForDate = centerDayHours.centerHours.find(c => c.openDate === appointmentDate)

  const [doctorWeeklyHours, setDoctorWeeklyHours] = useState<any[]>([])

  // How many days ahead this doctor accepts bookings (migration 013).
  const [advanceBookingDays, setAdvanceBookingDays] = useState(7)

  // Calculate upcoming specific dates for the doctor's weekly off days (set by receptionist)
  const upcomingOffDutyDates = useMemo(() => {
    if (!doctorWeeklyHours.length) return []
    const offDows = doctorWeeklyHours.filter((h: any) => h.isAvailable === false).map((h: any) => h.dayOfWeek)
    if (!offDows.length) return []

    const list: { dateStr: string; formatted: string }[] = []
    const today = new Date()
    const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    for (let i = 0; i < Math.min(advanceBookingDays || 7, 14); i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)
      const dow = d.getDay()
      if (offDows.includes(dow)) {
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        const dateStr = `${year}-${month}-${day}`
        const formatted = `${d.getDate()} ${monthNames[d.getMonth()]} (${dayNamesShort[dow]})`
        list.push({ dateStr, formatted })
      }
    }
    return list
  }, [doctorWeeklyHours, advanceBookingDays])
  const maxBookableDate = addDaysIso(now, advanceBookingDays)
  const isBeyondWindow = appointmentDate > maxBookableDate
  const isDateInPast = appointmentDate < todayIso
  /** An hour slot on today that has already started is gone. */
  const slotIsPast = (hour: number) => appointmentDate === todayIso && hour <= now.getHours()
  const selectedSlotIsPast = slotIsPast(slotHour)

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

  // Load this center's closed dates whenever the selected center changes.
  useEffect(() => {
    if (!isOpen || !selectedCenterId) { setCenterClosedDates([]); return }
    let cancelled = false
    fetchCenterClosures(selectedCenterId)
      .then(dates => { if (!cancelled) setCenterClosedDates(dates) })
      .catch(() => { if (!cancelled) setCenterClosedDates([]) })
    return () => { cancelled = true }
  }, [isOpen, selectedCenterId])

  // Load this center's date-specific hours (migration 014) alongside closures.
  useEffect(() => {
    if (!isOpen || !selectedCenterId) { setCenterDayHours({ centerHours: [], doctorHours: [] }); return }
    let cancelled = false
    fetchCenterDayHours(selectedCenterId)
      .then(res => { if (!cancelled) setCenterDayHours(res) })
      .catch(() => { if (!cancelled) setCenterDayHours({ centerHours: [], doctorHours: [] }) })
    return () => { cancelled = true }
  }, [isOpen, selectedCenterId])

  // Fetch real-time Doctor Hours & live slot availability whenever doctor or date changes
  useEffect(() => {
    async function loadDynamicSlots() {
      if (!selectedDoctorId || !appointmentDate) return
      // Center shut that day — no point pricing slots; the banner takes over.
      if (centerClosedDates.includes(appointmentDate)) {
        setDoctorOffDuty(false)
        setDynamicSlots([])
        setLoadingSlots(false)
        return
      }
      setLoadingSlots(true)
      try {
        const [hoursRes, apptsRes] = await Promise.all([
          fetchDoctorHours(selectedDoctorId),
          fetchAllAppointments()
        ])
        setAllApptsList(apptsRes || [])

        const limitPerHour = hoursRes.maxAppointmentsPerHour || 4
        setMaxCapacity(limitPerHour)
        setAdvanceBookingDays(hoursRes.advanceBookingDays || 7)
        setDoctorWeeklyHours(hoursRes.hours || [])

        // Parse selected date to find Day of Week (0 = Sun, 1 = Mon, ..., 6 = Sat)
        const parts = appointmentDate.split('-').map(Number)
        const dateObj = new Date(parts[0], parts[1] - 1, parts[2])
        const dow = dateObj.getDay()

        // A date-specific override (migration 014) replaces the weekly hours
        // entirely for this one date — it wins even over an otherwise-off weekday.
        const dateOverride = centerDayHours.doctorHours.find(
          h => h.doctorId === selectedDoctorId && h.workDate === appointmentDate,
        )

        let isAvailable: boolean
        let sessionsToGenerate: { startTime: string; endTime: string }[] = []

        if (dateOverride) {
          isAvailable = dateOverride.isWorking
          sessionsToGenerate = [{
            startTime: dateOverride.startTime || '08:00',
            endTime: dateOverride.endTime || '17:00'
          }]
        } else {
          // Find doctor's configured hours for this day of week
          const dayHours = (hoursRes.hours || []).find((h: any) => h.dayOfWeek === dow)
          isAvailable = dayHours ? dayHours.isAvailable : (dow >= 1 && dow <= 5)
          if (dayHours?.sessions && Array.isArray(dayHours.sessions) && dayHours.sessions.length > 0) {
            sessionsToGenerate = dayHours.sessions
          } else {
            sessionsToGenerate = [{
              startTime: dayHours?.startTime || '08:00',
              endTime: dayHours?.endTime || '17:00'
            }]
          }
        }

        if (!isAvailable) {
          setDoctorOffDuty(true)
          setDynamicSlots([])
          setLoadingSlots(false)
          return
        }

        setDoctorOffDuty(false)

        // Filter active booked appointments for this doctor & date
        const bookedForDocAndDate = (apptsRes || []).filter((a: any) => {
          const aDocId = a.doctorId || a.doctor_id
          const aDate = (a.appointmentDate || a.appointment_date || '').slice(0, 10)
          const aStatus = a.status
          return (aDocId === selectedDoctorId) && (aDate === appointmentDate) && (aStatus !== 'cancelled')
        })

        // Generate hourly slots across all sessions
        const slots: SlotItem[] = []
        const seenHours = new Set<number>()
        let sessionNum = 1

        for (const session of sessionsToGenerate) {
          const startH = session.startTime ? parseInt(session.startTime.split(':')[0], 10) : 8
          const endH = session.endTime ? parseInt(session.endTime.split(':')[0], 10) : 17

          const formatTime12 = (t: string) => {
            if (!t) return ''
            const [hStr, mStr] = t.split(':')
            const h = parseInt(hStr, 10)
            const pm = h >= 12
            const h12 = h % 12 === 0 ? 12 : h % 12
            return `${h12 < 10 ? '0' + h12 : h12}:${mStr || '00'} ${pm ? 'PM' : 'AM'}`
          }

          const sessionTimeRange = `${formatTime12(session.startTime)} - ${formatTime12(session.endTime)}`
          const sLabel = sessionsToGenerate.length > 1
            ? `Session ${sessionNum} (${sessionTimeRange})`
            : `Session (${sessionTimeRange})`

          let addedInSession = false
          for (let h = startH; h < endH; h++) {
            if (seenHours.has(h)) continue
            seenHours.add(h)
            addedInSession = true

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
              maxLimit: limitPerHour,
              sessionLabel: sLabel,
            })
          }
          if (addedInSession) sessionNum++
        }

        setDynamicSlots(slots)

        // Auto-select the first slot that's open AND not already in the past today.
        const nowLocal = new Date()
        const selIsToday = appointmentDate === `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`
        const notPast = (h: number) => !selIsToday || h > nowLocal.getHours()
        if (slots.length > 0) {
          const stillValid = slots.find(s => s.hour === slotHour && s.rem > 0 && notPast(s.hour))
          if (!stillValid) {
            const firstOk = slots.find(s => s.rem > 0 && notPast(s.hour))
              || slots.find(s => notPast(s.hour))
              || slots[0]
            setSlotHour(firstOk.hour)
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
  }, [isOpen, selectedDoctorId, appointmentDate, centerClosedDates, centerDayHours])

  if (!isOpen) return null

  // Filter doctors assigned to selected center
  const assignedDoctors = allDoctors.filter(d => 
    !selectedCenterId || d.centerId === selectedCenterId || d.center_id === selectedCenterId || allDoctors.length <= 2
  )

  // No placeholder objects here. These used to fall back to a fictional
  // "MediQueue Central Clinic" with no id and a fictional "Dr. Aisha Patel"
  // with id 'd1', so with an empty roster the form looked ready and Confirm
  // posted a booking for a doctor and center that don't exist. `null` instead,
  // and the Confirm button stays disabled until there is a real selection.
  const selectedCenter = centers.find(c => c.id === selectedCenterId) ?? centers[0] ?? null
  const selectedDoc = assignedDoctors.find(d => d.id === selectedDoctorId) ?? assignedDoctors[0] ?? null

  const handleCenterChange = (cId: string) => {
    setSelectedCenterId(cId)
    const filtered = allDoctors.filter(d => d.centerId === cId || d.center_id === cId)
    if (filtered.length > 0) {
      setSelectedDoctorId(filtered[0].id)
    }
  }

  const executeBooking = async () => {
    setError('')
    setBooking(true)
    try {
      const result = await bookAppointment({
        doctorId: selectedDoc!.id,
        doctorName: selectedDoc!.name,
        centerId: selectedCenter!.id,
        appointmentDate,
        slotHour,
        patientId,
      })
      onBookingSuccess(result.appointment)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not book this slot. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  const handleConfirm = async () => {
    if (!selectedDoc || !selectedCenter) {
      setError('Pick a medical center and a doctor before confirming.')
      return
    }
    if (doctorOffDuty) {
      setError('Doctor is off-duty on the selected date. Please select another date.')
      return
    }
    if (isSelectedDateClosed) {
      setError('This medical center is closed on the selected date. Please pick another day.')
      return
    }
    if (isDateInPast) {
      setError('That date is in the past. Please pick today or a later day.')
      return
    }
    if (isBeyondWindow) {
      setError(`This doctor is taking bookings up to ${advanceBookingDays} day${advanceBookingDays === 1 ? '' : 's'} ahead. Please pick an earlier date.`)
      return
    }
    if (selectedSlotIsPast) {
      setError('That time slot has already passed today. Please pick a later slot or another day.')
      return
    }

    const slotInfo = dynamicSlots.find(s => s.hour === slotHour)
    if (slotInfo && slotInfo.rem === 0) {
      setError(`This hourly slot has reached its maximum capacity (${maxCapacity} patients/hr). Please pick another slot.`)
      return
    }

    // Fetch patient's latest real-time appointments from backend to check for double-booking conflicts
    let patientAppts: any[] = []
    try {
      if (patientId) {
        patientAppts = await fetchPatientAppointments(patientId)
      }
    } catch (_) {}

    if (!patientAppts || patientAppts.length === 0) {
      patientAppts = allApptsList
    }

    const conflictingAppt = patientAppts.find((a: any) => {
      const aDate = (a.appointmentDate || a.appointment_date || '').slice(0, 10)
      const aSlotHour = Number(a.slotHour ?? a.slot_hour)
      const aStatus = (a.status || '').toLowerCase()
      return aDate === appointmentDate &&
             aSlotHour === Number(slotHour) &&
             aStatus !== 'cancelled'
    })

    if (conflictingAppt) {
      const confDocName = conflictingAppt.doctorName || conflictingAppt.doctor_name || conflictingAppt.doctor?.name || conflictingAppt.doctors?.users?.full_name || 'another doctor'
      const confCenterName = conflictingAppt.centerName || conflictingAppt.center_name || conflictingAppt.medical_centers?.name || 'a medical center'
      const formatH = (hourNum: number) => {
        const pm = hourNum >= 12
        const h12 = hourNum % 12 === 0 ? 12 : hourNum % 12
        const padded = h12 < 10 ? `0${h12}` : `${h12}`
        return `${padded}:00 ${pm ? 'PM' : 'AM'}`
      }
      const timeRange = `${formatH(slotHour)} - ${formatH(slotHour + 1)}`

      setConflictModalData({
        doctorName: confDocName,
        centerName: confCenterName,
        date: appointmentDate,
        timeRange,
      })
      return
    }

    executeBooking()
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
              <Stethoscope size={13} color="var(--blue)" /> Step 2: Select Doctor{selectedCenter ? ` (Assigned to ${selectedCenter.name})` : ''}
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

          {/* Selected Doctor Summary Card — only once there is a real doctor to
              summarise. Unknown room/specialisation shows a dash, not "Room 01". */}
          {selectedDoc ? (
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--blue-dim)', border: '1px solid var(--blue-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Stethoscope size={20} color="var(--blue)" />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>{selectedDoc.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--blue-dark)' }}>
                  {[selectedDoc.spec, selectedDoc.room, selectedCenter?.name].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--amber-dim)', border: '1px solid var(--amber-border)', fontSize: 12, color: 'var(--text-2)' }}>
              No doctors are assigned to this center yet, so there is nothing to book. Pick another center.
            </div>
          )}

          {/* Appointment Date */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Appointment Date</label>
            <input
              type="date"
              className="input"
              value={appointmentDate}
              min={todayIso}
              max={maxBookableDate}
              onChange={e => setAppointmentDate(e.target.value)}
              style={{ height: 42, fontSize: 13.5 }}
            />
            <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 4 }}>
              Bookings open through {maxBookableDate} ({advanceBookingDays} day{advanceBookingDays === 1 ? '' : 's'} ahead).
            </div>
            {centerHoursForDate?.hoursLabel && (
              <div style={{ fontSize: 10.5, color: 'var(--blue-dark)', marginTop: 2, fontWeight: 600 }}>
                🏥 {selectedCenter?.name || 'This centre'} is open {centerHoursForDate.hoursLabel} on this date
                {centerHoursForDate.note ? ` — ${centerHoursForDate.note}` : ''}.
              </div>
            )}

            {/* Red Doctor Off-Duty / Unavailable Dates Section */}
            {upcomingOffDutyDates.length > 0 && (
              <div style={{
                marginTop: 8, padding: '10px 14px', borderRadius: 10,
                background: 'rgba(225, 29, 72, 0.08)', border: '1px solid rgba(225, 29, 72, 0.25)',
                color: '#be123c', fontSize: 12
              }}>
                <div style={{ fontWeight: 800, color: '#e11d48', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <CalendarX size={14} /> 🚨 Doctor Off-Duty / Unavailable Dates:
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {upcomingOffDutyDates.map(item => (
                    <span key={item.dateStr} style={{
                      background: '#ffffff', border: '1px solid rgba(225, 29, 72, 0.3)',
                      borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 11
                    }}>
                      {item.formatted}
                    </span>
                  ))}
                </div>
              </div>
            )}
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

            {isDateInPast ? (
              <div style={{ padding: 16, borderRadius: 10, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#D97706', fontSize: 12.5, textAlign: 'center', fontWeight: 600 }}>
                🕓 That date has already passed. Please pick today or a later day.
              </div>
            ) : isBeyondWindow ? (
              <div style={{ padding: 16, borderRadius: 10, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#D97706', fontSize: 12.5, textAlign: 'center', fontWeight: 600 }}>
                📅 This doctor is taking bookings up to {advanceBookingDays} day{advanceBookingDays === 1 ? '' : 's'} ahead. Please pick an earlier date above.
              </div>
            ) : isSelectedDateClosed ? (
              <div style={{ padding: 16, borderRadius: 10, background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#D97706', fontSize: 12.5, textAlign: 'center', fontWeight: 600 }}>
                🚫 This medical center is closed on the selected date. Please pick another day above.
              </div>
            ) : doctorOffDuty ? (
              <div style={{ padding: 16, borderRadius: 10, background: 'rgba(225, 29, 72, 0.08)', border: '1px solid rgba(225, 29, 72, 0.25)', color: '#be123c', fontSize: 12.5, textAlign: 'center', fontWeight: 700 }}>
                🚨 Doctor is on holiday / off-duty on this date. Please select another available working date above.
              </div>
            ) : dynamicSlots.length === 0 && !loadingSlots ? (
              <div style={{ padding: 16, borderRadius: 10, background: '#f8fafc', border: '1px solid var(--border-md)', color: 'var(--text-4)', fontSize: 12, textAlign: 'center' }}>
                No hours configured for this doctor on this day.
              </div>
            ) : dynamicSlots.length > 0 && dynamicSlots.every(s => s.rem === 0 || slotIsPast(s.hour)) ? (
              <div style={{ padding: 16, borderRadius: 10, background: '#f8fafc', border: '1px solid var(--border-md)', color: 'var(--text-4)', fontSize: 12, textAlign: 'center' }}>
                No slots left for today — please pick another date above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Array.from(new Set(dynamicSlots.map(s => s.sessionLabel || 'Available Slots'))).map(sLabel => {
                  const sessionSlots = dynamicSlots.filter(s => (s.sessionLabel || 'Available Slots') === sLabel)
                  return (
                    <div key={sLabel} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{
                        fontSize: 11.5, fontWeight: 800, color: 'var(--blue-dark)',
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 10px', background: 'rgba(18,198,186,0.08)',
                        border: '1px solid rgba(18,198,186,0.2)', borderRadius: 6,
                        width: 'fit-content'
                      }}>
                        <Clock size={13} color="var(--blue-dark)" /> {sLabel}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {sessionSlots.map(s => {
                          const isSelected = slotHour === s.hour
                          const isFull = s.rem === 0
                          const isPast = slotIsPast(s.hour)
                          const disabled = isFull || isPast
                          return (
                            <button
                              key={s.hour}
                              type="button"
                              disabled={disabled}
                              onClick={() => setSlotHour(s.hour)}
                              style={{
                                padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                                background: isSelected ? 'var(--blue)' : disabled ? '#f5f5f5' : '#ffffff',
                                color: isSelected ? '#ffffff' : disabled ? '#a0a0a0' : 'var(--text-1)',
                                border: '1px solid', borderColor: isSelected ? 'var(--blue)' : 'var(--border-md)',
                                cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{ fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Clock size={12} /> {s.label}
                              </div>
                              <div style={{ fontSize: 10.5, marginTop: 2, color: isSelected ? '#e0f7f5' : isPast ? 'var(--text-4)' : isFull ? 'var(--crimson)' : 'var(--blue-dark)' }}>
                                {isPast ? '⌛ Passed' : isFull ? `❌ Slot Full (${s.maxLimit}/${s.maxLimit} booked)` : `● ${s.rem} of ${s.maxLimit} slots available`}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
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
              disabled={booking || !selectedDoc?.id || !selectedCenter?.id || doctorOffDuty || isSelectedDateClosed || isBeyondWindow || isDateInPast || selectedSlotIsPast}
              className="btn btn-primary"
              style={{ gap: 6 }}
            >
              <Check size={14} /> {booking ? 'Booking...' : 'Confirm Appointment'}
            </button>
          </div>
        </div>
      </div>

      {/* Time Slot Conflict Warning Confirmation Modal */}
      {conflictModalData && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100005,
          background: 'rgba(7, 21, 20, 0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div className="fade-in" style={{
            width: '100%', maxWidth: 460, background: '#ffffff',
            borderRadius: 16, padding: '24px 22px', boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid rgba(245, 158, 11, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D97706', flexShrink: 0
              }}>
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.01em' }}>
                  ⚠️ Appointment Already Scheduled
                </h3>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>Double-booking confirmation</div>
              </div>
            </div>

            <div style={{
              padding: '14px 16px', borderRadius: 10,
              background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)',
              fontSize: 13, color: 'var(--text-1)', lineHeight: 1.55
            }}>
              You already have an appointment with <strong>{conflictModalData.doctorName}</strong> on <strong>{conflictModalData.date}</strong> at <strong>{conflictModalData.timeRange}</strong>. Do you still want to book another appointment?
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setConflictModalData(null)}
                className="btn btn-ghost"
                style={{ height: 40, fontSize: 13 }}
              >
                No, Change Time
              </button>
              <button
                type="button"
                onClick={() => {
                  setConflictModalData(null)
                  executeBooking()
                }}
                className="btn btn-primary"
                style={{ height: 40, fontSize: 13, padding: '0 18px', background: '#D97706', borderColor: '#B45309' }}
              >
                Yes, Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
