import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  ArrowLeft, Building2, Calendar, Clock, Globe, Heart, MapPin, Megaphone, Navigation, Phone, Stethoscope, X, ChevronDown,
} from 'lucide-react'
import { api } from '../lib/api'
import type { ApiCenterNotice, ApiDoctor, ApiDoctorHour } from '../lib/api'
import { SERVICE_GROUPS } from '../lib/medicalServices'
import { Avatar, StatusBadge } from './UIPrimitives'
import CenterLocationMap from './CenterLocationMap'
import DoctorProfileModal from './DoctorProfileModal'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatSessionTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return time
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}

/** Parses center weekly opening hours formatted as 'Mon: 08:00 AM – 05:00 PM | ...' or single strings */
interface CenterDaySchedule {
  day: string
  isOpen: boolean
  openTime: string
  closeTime: string
}

function parseCenterSchedule(rawString?: string | null): CenterDaySchedule[] | null {
  if (!rawString || !rawString.trim()) return null
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  
  if (rawString.includes('|') || rawString.includes(':')) {
    const parts = rawString.split('|').map(s => s.trim())
    const map = new Map<string, { isOpen: boolean; openTime: string; closeTime: string }>()
    parts.forEach(p => {
      const match = p.match(/^([A-Za-z]+)\s*:\s*(.+)$/)
      if (match) {
        const prefix = match[1].toLowerCase()
        const timePart = match[2].trim()
        if (timePart.toLowerCase().includes('close')) {
          map.set(prefix, { isOpen: false, openTime: '', closeTime: '' })
        } else {
          const times = timePart.split(/[-–]/).map(t => t.trim())
          map.set(prefix, { isOpen: true, openTime: times[0] || '', closeTime: times[1] || '' })
        }
      }
    })
    if (map.size > 0) {
      return days.map(d => {
        const key = d.toLowerCase().slice(0, 3)
        const found = map.get(key) || map.get(d.toLowerCase())
        if (found) return { day: d, ...found }
        return { day: d, isOpen: d !== 'Sunday', openTime: '08:00 AM', closeTime: '05:00 PM' }
      })
    }
  }
  return null
}

function CenterHoursDisplay({ rawHours }: { rawHours?: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const schedule = parseCenterSchedule(rawHours)

  if (!schedule) {
    return (
      <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
        <Clock size={15} color="var(--blue)" style={{ flexShrink: 0 }} />
        <span>{rawHours || 'Hours not set'}</span>
      </div>
    )
  }

  // Determine today's schedule
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
  const todaySchedule = schedule.find(s => s.day === todayName) || schedule[0]

  return (
    <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 7,
          cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        }}
        title="Click to view weekly opening hours"
      >
        <Clock size={15} color="var(--blue)" style={{ flexShrink: 0 }} />
        <span>
          <strong style={{ color: 'var(--text-1)' }}>Today ({todayName}):</strong>{' '}
          {todaySchedule.isOpen ? `${todaySchedule.openTime} – ${todaySchedule.closeTime}` : <span style={{ color: '#ef4444', fontWeight: 600 }}>Closed</span>}
        </span>
        <button
          type="button"
          style={{
            marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 3, color: 'var(--blue)', fontSize: 11.5, fontWeight: 700, padding: 0,
          }}
        >
          {expanded ? 'Hide' : 'View weekly'}
          <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>
      </div>

      {expanded && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 100, minWidth: 260,
          background: '#ffffff', border: '1px solid var(--border-md)',
          borderRadius: 10, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 2, letterSpacing: '0.04em' }}>
            Weekly Opening Hours
          </div>
          {schedule.map(item => {
            const isToday = item.day === todayName
            return (
              <div
                key={item.day}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: 12, padding: '3px 0',
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'var(--blue-dark)' : 'var(--text-2)',
                  borderBottom: '1px solid #f8fafc',
                }}
              >
                <span>{item.day} {isToday && '(Today)'}</span>
                <span>
                  {item.isOpen ? `${item.openTime} – ${item.closeTime}` : <span style={{ color: '#94a3b8' }}>Closed</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DoctorSchedule({ hours, loading }: { hours: ApiDoctorHour[]; loading: boolean }) {
  const available = hours.filter(h => h.isAvailable)
    .sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7))

  return (
    <div className="center-doctor-schedule" aria-busy={loading}>
      <div className="center-doctor-schedule-title"><Clock size={14} /> Working hours</div>
      {loading ? (
        <p className="center-doctor-schedule-empty">Loading hours…</p>
      ) : available.length === 0 ? (
        <p className="center-doctor-schedule-empty">Working hours not set</p>
      ) : (
        <dl className="center-doctor-schedule-days">
          {available.map(day => (
            <div className="center-doctor-schedule-row" key={day.dayOfWeek}>
              <dt>{DAY_NAMES[day.dayOfWeek]}</dt>
              <dd>
                {(day.sessions?.length ? day.sessions : [{ startTime: day.startTime, endTime: day.endTime }]).map((session, index) => (
                  <span key={index}>{formatSessionTime(session.startTime)} – {formatSessionTime(session.endTime)}</span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

/** Buckets a center's flat services list by the same categories ServiceChecklist uses, so it reads as a menu rather than a pile of tags. */
function groupCenterServices(services: string[]): { label: string; services: string[] }[] {
  const remaining = new Set(services)
  const grouped = SERVICE_GROUPS.map(group => {
    const matched = group.services.filter(s => remaining.has(s))
    matched.forEach(s => remaining.delete(s))
    return { label: group.label, services: matched }
  }).filter(g => g.services.length > 0)
  if (remaining.size > 0) grouped.push({ label: 'Other Services', services: Array.from(remaining) })
  return grouped
}

/** A section wrapper shared by Services / Notices / Doctors, so the page reads as a set of scannable panels rather than one long list. */
function SectionCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border-md)', borderRadius: 14, padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon} {title}
      </div>
      {children}
    </div>
  )
}

/**
 * The patient-facing "detailed view" of a medical center's profile — photo,
 * location, contact, hours, services, notices/promotions and the doctors
 * posted there, with a straight line into booking. A routed page (not a
 * popup) so it has its own URL, back-button support, and doesn't cover the
 * rest of the dashboard. Also the only remaining place a patient can
 * subscribe to a doctor for delay alerts, since the standalone
 * doctor-browsing page was folded into this center-first view.
 */
export default function CenterProfilePage({
  center,
  loading,
  doctors,
  subscribedIds,
  onToggleSubscribe,
  onBook,
  onBack,
}: {
  center: any | null
  /** Whether the dashboard's initial center fetch is still in flight — distinguishes "still loading" from "not found / not approved". */
  loading: boolean
  /** Every doctor loaded on the dashboard — filtered here to this center. */
  doctors: any[]
  subscribedIds: string[]
  onToggleSubscribe: (doctorName: string, doctorId?: string) => void
  onBook: (centerId: string, doctorId?: string) => void
  onBack: () => void
}) {
  const [notices, setNotices] = useState<ApiCenterNotice[]>([])
  const [selectedNoticeImage, setSelectedNoticeImage] = useState<{ url: string; title: string } | null>(null)
  const [doctorHoursById, setDoctorHoursById] = useState<Record<string, ApiDoctorHour[]>>({})
  const [doctorHoursLoading, setDoctorHoursLoading] = useState(false)
  const [viewingDoctor, setViewingDoctor] = useState<ApiDoctor | null>(null)

  useEffect(() => {
    if (!center?.id) { setNotices([]); return }
    let cancelled = false
    api.getCenterNotices(center.id)
      .then(res => { if (!cancelled) setNotices(res.notices) })
      .catch(() => { if (!cancelled) setNotices([]) })
    return () => { cancelled = true }
  }, [center?.id])

  const centerDoctorIds = doctors
    .filter(d => d.centerId === center?.id || (Array.isArray(d.centers) && d.centers.some((c: any) => c.centerId === center?.id)))
    .map(d => d.id)
    .join(',')

  useEffect(() => {
    if (!center?.id || !centerDoctorIds) { setDoctorHoursById({}); return }
    let cancelled = false
    setDoctorHoursLoading(true)
    Promise.all(centerDoctorIds.split(',').map(doctorId =>
      api.getDoctorHours(doctorId, center.id).then(res => [doctorId, res.hours] as const).catch(() => [doctorId, []] as const),
    ))
      .then(pairs => { if (!cancelled) setDoctorHoursById(Object.fromEntries(pairs)) })
      .finally(() => { if (!cancelled) setDoctorHoursLoading(false) })
    return () => { cancelled = true }
  }, [center?.id, centerDoctorIds])

  const backButton = (
    <button type="button" onClick={onBack} className="btn btn-ghost btn-sm" style={{ gap: 6, alignSelf: 'flex-start' }}>
      <ArrowLeft size={14} /> Back to Medical Centers
    </button>
  )

  if (!center) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {backButton}
        <div className="card glass-form-card" style={{ padding: 40, textAlign: 'center' }}>
          {loading ? (
            <>
              <div style={{ width: 32, height: 32, margin: '0 auto 14px', borderRadius: '50%', border: '3px solid var(--blue-dim)', borderTopColor: 'var(--blue)', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ fontSize: 13.5, color: 'var(--text-4)' }}>Loading medical center profile…</p>
            </>
          ) : (
            <>
              <Building2 size={32} color="var(--text-4)" style={{ margin: '0 auto 10px', opacity: 0.6 }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>This medical center isn't available</p>
              <p style={{ fontSize: 12.5, color: 'var(--text-4)' }}>It may not exist, or is still awaiting approval.</p>
            </>
          )}
        </div>
      </div>
    )
  }

  const centerDoctors = doctors.filter(d =>
    d.centerId === center.id || (Array.isArray(d.centers) && d.centers.some((c: any) => c.centerId === center.id)),
  )

  const statusValue = center.status === 'closed' ? 'down' : (center.status ?? 'operational')
  const serviceGroups = Array.isArray(center.services) ? groupCenterServices(center.services) : []
  const latitude = Number(center.latitude)
  const longitude = Number(center.longitude)
  const hasLocation = center.latitude != null && center.latitude !== ''
    && center.longitude != null && center.longitude !== ''
    && Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180

  return (
    <div className="center-profile" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {backButton}

      <div className="center-profile-header">
        <div className="center-profile-photo">
          {center.imageUrl ? (
            <img src={center.imageUrl} alt={center.name} />
          ) : (
            <Building2 size={36} color="var(--blue)" />
          )}
        </div>
        <div className="center-profile-identity">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue-dark)', marginBottom: 4 }}>MEDICAL CENTER</div>
          <h2 style={{ fontSize: 24, lineHeight: 1.2, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0 }}>{center.name}</h2>
          <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={13} style={{ flexShrink: 0 }} /> {center.city}{center.province ? `, ${center.province}` : ''}
          </div>
        </div>
        <StatusBadge status={statusValue} />
      </div>

      {/* Compact overview followed by full-width notices and doctors. */}
      <div className="center-profile-layout">

        {/* Contact and services form the center overview. */}
        <div className="center-profile-details">
          <div style={{ background: '#fff', border: '1px solid var(--border-md)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
              Contact &amp; Hours
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
              paddingBottom: 4,
            }}>
              <div style={{ fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 auto', minWidth: 200 }}>
                <MapPin size={15} color="var(--blue)" style={{ flexShrink: 0 }} />
                <span>{center.address}</span>
              </div>

              {center.phone && (
                <a
                  href={`tel:${center.phone}`}
                  style={{
                    fontSize: 13, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8,
                    textDecoration: 'none', flexShrink: 0,
                  }}
                >
                  <Phone size={15} color="var(--blue)" style={{ flexShrink: 0 }} />
                  <span>{center.phone}</span>
                </a>
              )}

              <div style={{ flexShrink: 0 }}>
                <CenterHoursDisplay rawHours={center.opening_hours} />
              </div>

              {center.website && (
                <a
                  href={center.website}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 13, color: 'var(--blue)', display: 'flex', alignItems: 'center', gap: 8,
                    textDecoration: 'none', flexShrink: 0,
                  }}
                >
                  <Globe size={15} style={{ flexShrink: 0 }} />
                  <span>Website</span>
                </a>
              )}
            </div>

          {serviceGroups.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8 }}>
                <Stethoscope size={13} color="var(--blue)" /> Available Services
              </div>
              <div className="center-profile-service-groups">
                {serviceGroups.map(group => (
                  <div key={group.label}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 7 }}>
                      {group.label}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {group.services.map(s => (
                        <span key={s} style={{ fontSize: 12, background: 'var(--blue-dim)', color: 'var(--blue-dark)', border: '1px solid var(--blue-border)', borderRadius: 6, padding: '3px 8px', fontWeight: 600 }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>

          <SectionCard icon={<MapPin size={13} color="var(--blue)" />} title="Location on Map">
              {hasLocation ? (
                <CenterLocationMap latitude={latitude} longitude={longitude} name={center.name} />
              ) : (
                <p style={{ fontSize: 12.5, color: 'var(--text-4)', margin: 0 }}>Map location currently not available.</p>
              )}
              {hasLocation && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${center.latitude},${center.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost"
                  style={{ gap: 6, minHeight: 38, justifyContent: 'center' }}
                >
                  <Navigation size={14} /> Get Directions
                </a>
              )}
          </SectionCard>

        </div>

          <SectionCard icon={<Megaphone size={13} color="var(--blue)" />} title="Notices & Promotions">
            {notices.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
                {notices.map(notice => {
                  const isClosure = /clos(ed|ure)|holiday/i.test(notice.title) || /clos(ed|ure)/i.test(notice.message);
                  return (
                    <div key={notice.id} style={{
                      display: 'flex', flexDirection: 'column', gap: 12, padding: 16, borderRadius: 14,
                      background: isClosure ? '#FEF2F2' : 'var(--blue-dim)',
                      border: isClosure ? '1.5px solid #F87171' : '1px solid var(--blue-border)',
                      boxShadow: isClosure ? '0 4px 12px rgba(239, 68, 68, 0.08)' : '0 2px 8px rgba(0,0,0,0.04)',
                    }}>
                      {isClosure && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 800,
                            padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>
                            🚨 Important Notice — Center Closure
                          </span>
                        </div>
                      )}

                      {notice.imageUrl && (
                        <div
                          onClick={() => setSelectedNoticeImage({ url: notice.imageUrl!, title: notice.title })}
                          style={{
                            width: '100%', height: 180, borderRadius: 10, overflow: 'hidden',
                            cursor: 'pointer', position: 'relative', background: '#000',
                          }}
                          title="Click to view full image"
                        >
                          <img
                            src={notice.imageUrl}
                            alt={notice.title}
                            style={{
                              width: '100%', height: '100%', objectFit: 'cover',
                              transition: 'transform 0.25s ease',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.04)')}
                            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                          />
                          <div style={{
                            position: 'absolute', bottom: 8, right: 8,
                            background: 'rgba(0,0,0,0.65)', color: '#fff',
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            pointerEvents: 'none',
                          }}>
                            🔍 Click to enlarge
                          </div>
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 15, fontWeight: 700,
                          color: isClosure ? '#991B1B' : 'var(--blue-dark)',
                          lineHeight: 1.3,
                        }}>
                          {notice.title}
                        </div>
                        <div style={{
                          fontSize: 13,
                          color: isClosure ? '#7F1D1D' : 'var(--text-3)',
                          marginTop: 6, lineHeight: 1.5, whiteSpace: 'pre-line',
                        }}>
                          {notice.message}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>Currently not available.</div>
            )}
          </SectionCard>

        {/* Full-width doctor grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <SectionCard icon={<Stethoscope size={13} color="var(--blue)" />} title={`Available Doctors (${centerDoctors.length})`}>
            {centerDoctors.length > 0 ? (
              <div className="center-profile-doctors">
                {centerDoctors.map(d => {
                  const isSubscribed = subscribedIds.includes(d.name)
                  return (
                    <div key={d.id} style={{
                      display: 'flex', flexDirection: 'column', gap: 10,
                      padding: 12, borderRadius: 12, border: '1px solid var(--border-md)', background: 'var(--bg)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
                          <Avatar name={d.name} size={38} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>{d.name}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--blue-dark)', fontWeight: 600 }}>
                              {[d.spec, d.room].filter(Boolean).join(' · ') || 'Details not set'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggleSubscribe(d.name, d.id)}
                          aria-pressed={isSubscribed}
                          aria-label={isSubscribed ? `Unsubscribe from ${d.name}` : `Subscribe to ${d.name} for delay alerts`}
                          title={isSubscribed ? `Unsubscribe from ${d.name}` : `Subscribe to ${d.name} for delay alerts`}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                            background: isSubscribed ? 'var(--crimson-dim, #fee2e2)' : '#fff',
                            border: '1px solid var(--border-md)', cursor: 'pointer',
                          }}
                        >
                          <Heart size={13} color={isSubscribed ? 'var(--crimson)' : 'var(--text-4)'} fill={isSubscribed ? 'var(--crimson)' : 'none'} />
                        </button>
                      </div>

                      <DoctorSchedule hours={doctorHoursById[d.id] ?? []} loading={doctorHoursLoading} />

                      <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => setViewingDoctor(d as ApiDoctor)}
                          className="btn btn-sm"
                          style={{
                            flex: 1, minHeight: 36, justifyContent: 'center', gap: 6,
                            background: '#10B981', color: '#fff', border: '1px solid #10B981',
                            fontWeight: 700, borderRadius: 10,
                          }}
                        >
                          <Stethoscope size={13} /> View Profile
                        </button>
                        <button
                          type="button"
                          onClick={() => onBook(center.id, d.id)}
                          className="btn btn-primary btn-sm"
                          style={{ flex: 1, justifyContent: 'center', gap: 6, minHeight: 36, whiteSpace: 'normal', borderRadius: 10 }}
                        >
                          <Calendar size={13} /> Book with {d.name}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>No doctors listed for this center yet.</div>
            )}
          </SectionCard>
        </div>

      </div>

      <DoctorProfileModal
        isOpen={!!viewingDoctor}
        doctor={viewingDoctor}
        onClose={() => setViewingDoctor(null)}
      />

      {/* Lightbox Modal for Notice Flyers */}
      {selectedNoticeImage && (
        <div
          onClick={() => setSelectedNoticeImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(5px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'relative', maxWidth: '90vw', maxHeight: '90vh',
              background: '#1e293b', borderRadius: 16, overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px', background: '#0f172a', borderBottom: '1px solid #334155',
            }}>
              <span style={{ color: '#f8fafc', fontWeight: 700, fontSize: 14 }}>
                {selectedNoticeImage.title}
              </span>
              <button
                type="button"
                onClick={() => setSelectedNoticeImage(null)}
                style={{
                  background: 'transparent', border: 'none', color: '#94a3b8',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 4, borderRadius: 6,
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: 12, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: 'calc(90vh - 60px)' }}>
              <img
                src={selectedNoticeImage.url}
                alt={selectedNoticeImage.title}
                style={{ maxWidth: '100%', maxHeight: 'calc(90vh - 84px)', objectFit: 'contain', borderRadius: 8 }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
