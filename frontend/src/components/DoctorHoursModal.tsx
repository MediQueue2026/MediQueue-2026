import { useEffect, useState } from 'react'
import { X, Clock, CheckCircle2, Save, Zap } from 'lucide-react'
import { api } from '../lib/api'
import type { ApiDoctor, ApiDoctorHour } from '../lib/api'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Returns hours between two "HH:MM" strings (can be negative if end < start). */
function hoursBetween(start: string, end: string): number {
  const toMins = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + (m || 0)
  }
  return (toMins(end) - toMins(start)) / 60
}

export default function DoctorHoursModal({
  isOpen,
  onClose,
  doctor,
  onSaved,
}: {
  isOpen: boolean
  onClose: () => void
  doctor: ApiDoctor | null
  onSaved?: () => void
}) {
  const [hours, setHours] = useState<ApiDoctorHour[]>([])
  const [maxPerHour, setMaxPerHour] = useState(4)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load hours whenever the modal opens for a doctor
  useEffect(() => {
    if (!isOpen || !doctor) return
    setLoading(true)
    setDone(false)
    setError(null)
    api.getDoctorHours(doctor.id)
      .then(res => {
        setHours(res.hours)
        setMaxPerHour(res.maxAppointmentsPerHour)
      })
      .catch(() => {
        // Fall back to 7 default rows
        const defaults: ApiDoctorHour[] = Array.from({ length: 7 }, (_, dow) => ({
          id: null, doctorId: doctor.id, dayOfWeek: dow,
          startTime: '08:00', endTime: '17:00',
          isAvailable: dow >= 1 && dow <= 5,
          dailyCapacity: dow >= 1 && dow <= 5 ? 9 * (doctor.maxAppointmentsPerHour ?? 4) : 0,
        }))
        setHours(defaults)
        setMaxPerHour(doctor.maxAppointmentsPerHour ?? 4)
      })
      .finally(() => setLoading(false))
  }, [isOpen, doctor])

  if (!isOpen || !doctor) return null

  const updateDay = (dow: number, patch: Partial<ApiDoctorHour>) => {
    setHours(prev => prev.map(h => {
      if (h.dayOfWeek !== dow) return h
      const updated = { ...h, ...patch }
      const hrs = Math.max(0, hoursBetween(updated.startTime, updated.endTime))
      updated.dailyCapacity = updated.isAvailable ? Math.round(hrs * maxPerHour) : 0
      return updated
    }))
  }

  const recomputeCapacities = (mph: number) => {
    setMaxPerHour(mph)
    setHours(prev => prev.map(h => {
      const hrs = Math.max(0, hoursBetween(h.startTime, h.endTime))
      return { ...h, dailyCapacity: h.isAvailable ? Math.round(hrs * mph) : 0 }
    }))
  }

  const totalWeeklyCapacity = hours.reduce((sum, h) => sum + h.dailyCapacity, 0)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await api.upsertDoctorHours(
        doctor.id,
        hours.map(h => ({
          dayOfWeek: h.dayOfWeek,
          startTime: h.startTime,
          endTime: h.endTime,
          isAvailable: h.isAvailable,
        })),
        maxPerHour,
      )
      setDone(true)
      onSaved?.()
      setTimeout(() => { setDone(false); onClose() }, 1400)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save hours. Please try again.')
    } finally {
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
        width: '100%', maxWidth: 640, maxHeight: '94vh',
        background: 'rgba(255,255,255,0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(18, 198, 186, 0.28)',
        borderRadius: 20, padding: '32px 28px',
        boxShadow: '0 24px 64px rgba(8,48,45,0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
        position: 'relative', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 20,
      }}>
        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(18,198,186,0.1)', border: '1px solid rgba(18,198,186,0.22)',
          borderRadius: '50%', width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)', cursor: 'pointer',
        }}>
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.14), rgba(251,191,36,0.08))',
            border: '1px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--amber, #f59e0b)',
          }}>
            <Clock size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              Available Hours
            </h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>
              {doctor.name} · {doctor.dept}
            </div>
          </div>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <CheckCircle2 size={52} color="#10B981" style={{ margin: '0 auto 12px' }} />
            <h4 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)' }}>Hours Saved!</h4>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
              Availability schedule has been updated.
            </p>
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-4)' }}>
            Loading schedule…
          </div>
        ) : (
          <>
            {/* Max per hour control + weekly summary */}
            <div style={{
              background: 'rgba(18,198,186,0.06)', border: '1px solid rgba(18,198,186,0.18)',
              borderRadius: 12, padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Zap size={15} color="var(--amber, #f59e0b)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
                  Max appointments / hour
                </span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={maxPerHour}
                  onChange={e => recomputeCapacities(Number(e.target.value) || 1)}
                  style={{
                    width: 64, height: 34, borderRadius: 8, border: '1px solid var(--border-md)',
                    padding: '0 10px', fontSize: 14, fontWeight: 700, textAlign: 'center',
                    background: 'rgba(255,255,255,0.8)',
                  }}
                />
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-3)' }}>
                Weekly capacity:&nbsp;
                <strong style={{ color: 'var(--text-1)', fontSize: 15 }}>{totalWeeklyCapacity}</strong>
                &nbsp;appointments
              </div>
            </div>

            {/* Day rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {hours.map(h => {
                const hrs = Math.max(0, hoursBetween(h.startTime, h.endTime))
                const invalid = h.isAvailable && hrs <= 0

                return (
                  <div key={h.dayOfWeek} style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 1fr auto',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: h.isAvailable
                      ? 'rgba(16, 185, 129, 0.05)'
                      : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${h.isAvailable ? 'rgba(16,185,129,0.18)' : 'var(--border)'}`,
                    transition: 'all 0.18s',
                  }}>
                    {/* Day toggle */}
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={h.isAvailable}
                        onChange={e => updateDay(h.dayOfWeek, { isAvailable: e.target.checked })}
                        style={{ width: 16, height: 16, accentColor: '#10B981', cursor: 'pointer' }}
                      />
                      <span style={{
                        fontSize: 13, fontWeight: 700,
                        color: h.isAvailable ? 'var(--text-1)' : 'var(--text-4)',
                        width: 36,
                      }}>
                        {DAY_SHORT[h.dayOfWeek]}
                      </span>
                    </label>

                    {/* Time inputs */}
                    {h.isAvailable ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="time"
                          value={h.startTime}
                          onChange={e => updateDay(h.dayOfWeek, { startTime: e.target.value })}
                          style={timeInputStyle(invalid)}
                        />
                        <span style={{ fontSize: 12, color: 'var(--text-4)', flexShrink: 0 }}>to</span>
                        <input
                          type="time"
                          value={h.endTime}
                          onChange={e => updateDay(h.dayOfWeek, { endTime: e.target.value })}
                          style={timeInputStyle(invalid)}
                        />
                        {invalid && (
                          <span style={{ fontSize: 11, color: '#dc2626', whiteSpace: 'nowrap' }}>
                            end must be after start
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12.5, color: 'var(--text-4)', fontStyle: 'italic' }}>
                        Not available
                      </span>
                    )}

                    {/* Capacity chip */}
                    <div style={{
                      minWidth: 72, textAlign: 'right',
                      fontSize: 12, fontWeight: 700,
                      color: h.isAvailable ? '#10B981' : 'var(--text-4)',
                    }}>
                      {h.isAvailable
                        ? `${h.dailyCapacity} slots`
                        : '—'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Full-day labels below grid */}
            <div style={{
              fontSize: 10.5, color: 'var(--text-4)', display: 'flex', gap: 6, flexWrap: 'wrap',
            }}>
              {hours.map(h => h.isAvailable && (
                <span key={h.dayOfWeek} style={{
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: 6, padding: '2px 8px', fontWeight: 600,
                }}>
                  {DAY_NAMES[h.dayOfWeek]}: {h.startTime} – {h.endTime} ({h.dailyCapacity} slots)
                </span>
              ))}
            </div>

            {error && (
              <div style={{
                background: '#fff1f1', border: '1px solid #fca5a5',
                borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#dc2626',
              }}>
                {error}
              </div>
            )}

            {/* Footer actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={onClose} className="btn btn-ghost" style={{ height: 42 }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn btn-primary"
                disabled={saving}
                style={{ gap: 8, height: 42, padding: '0 22px', fontSize: 14 }}
              >
                {saving
                  ? <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  : <Save size={16} />
                }
                {saving ? 'Saving…' : 'Save Hours'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function timeInputStyle(invalid: boolean): React.CSSProperties {
  return {
    height: 36, borderRadius: 8, border: `1px solid ${invalid ? '#fca5a5' : 'var(--border-md)'}`,
    padding: '0 10px', fontSize: 13, fontWeight: 600,
    background: 'rgba(255,255,255,0.85)',
    color: invalid ? '#dc2626' : 'var(--text-1)',
  }
}
