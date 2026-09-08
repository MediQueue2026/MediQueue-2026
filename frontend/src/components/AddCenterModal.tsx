import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { X, Building2, Plus, CheckCircle2, ShieldAlert } from 'lucide-react'
import { api } from '../lib/api'
import type { ApiCenter } from '../lib/api'
import ServiceMultiSelect from './ServiceMultiSelect'

function LocationPickerMap({ lat, lng, onChange }: { lat: number; lng: number; onChange: (lat: number, lng: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    if (!mapRef.current) {
      const initialLat = lat || 6.9271
      const initialLng = lng || 79.8612

      const map = L.map(containerRef.current, {
        center: [initialLat, initialLng],
        zoom: 12,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)

      const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map)

      marker.on('dragend', () => {
        const p = marker.getLatLng()
        onChange(Number(p.lat.toFixed(4)), Number(p.lng.toFixed(4)))
      })

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng)
        onChange(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)))
      })

      mapRef.current = map
      markerRef.current = marker
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      const cur = markerRef.current.getLatLng()
      if (Math.abs(cur.lat - lat) > 0.0001 || Math.abs(cur.lng - lng) > 0.0001) {
        markerRef.current.setLatLng([lat, lng])
        mapRef.current.panTo([lat, lng])
      }
    }
  }, [lat, lng])

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-md)', marginTop: 8 }}>
      <div ref={containerRef} style={{ height: 160, width: '100%', zIndex: 1 }} />
      <div style={{ background: '#f8fafc', padding: '6px 12px', fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>📍 <strong>Click map or drag pin</strong> to pick clinic location</span>
        <span style={{ fontWeight: 700, color: '#0ea5e9' }}>{lat}, {lng}</span>
      </div>
    </div>
  )
}

export default function AddCenterModal({ isOpen, onClose, onAdd, mode = 'create' }: {
  isOpen: boolean
  onClose: () => void
  /** 'request' submits for Super Admin approval instead of creating the center immediately. */
  mode?: 'create' | 'request'
  onAdd?: (centerData: {
    name: string
    city: string
    address?: string
    openingHours?: string
    services?: string[]
    phone?: string
    email?: string
    status?: ApiCenter['status']
    latitude?: number
    longitude?: number
    requestComment?: string
    registrationDocument?: { fileUrl: string; fileName: string; fileType: string }
  }) => void
}) {
  const isRequest = mode === 'request'
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [openingHours, setOpeningHours] = useState('08:00 - 18:00')
  /** Chosen from a list rather than typed as comma-separated text — see ServiceMultiSelect. */
  const [services, setServices] = useState<string[]>(['General Medicine'])
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<ApiCenter['status']>('operational')
  const [latitude, setLatitude] = useState<string>('6.9271')
  const [longitude, setLongitude] = useState<string>('79.8612')
  const [requestComment, setRequestComment] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cityCoordsMap: Record<string, { lat: number; lng: number }> = {
    'colombo': { lat: 6.9271, lng: 79.8612 },
    'kandy': { lat: 7.2906, lng: 80.6337 },
    'galle': { lat: 6.0535, lng: 80.2210 },
    'jaffna': { lat: 9.6615, lng: 80.0255 },
    'negombo': { lat: 7.2008, lng: 79.8737 },
    'kurunegala': { lat: 7.4863, lng: 80.3647 },
    'matara': { lat: 5.9549, lng: 80.5550 },
    'gampaha': { lat: 7.0840, lng: 79.9925 },
    'batticaloa': { lat: 7.7310, lng: 81.6747 },
    'trincomalee': { lat: 8.5874, lng: 81.2152 },
    'anuradhapura': { lat: 8.3114, lng: 80.4037 },
    'ratnapura': { lat: 6.6828, lng: 80.4016 },
  }

  const handleCityChange = (val: string) => {
    setCity(val)
    const matchedKey = Object.keys(cityCoordsMap).find(k => val.toLowerCase().includes(k))
    if (matchedKey) {
      setLatitude(cityCoordsMap[matchedKey].lat.toString())
      setLongitude(cityCoordsMap[matchedKey].lng.toString())
    }
  }

  if (!isOpen) return null

  const handleClose = () => {
    setError(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      let registrationDocument = undefined
      if (isRequest && !documentFile) {
        setError('Please attach a registration document before submitting.')
        setSubmitting(false)
        return
      }
      if (documentFile) {
        const uploaded = await api.uploadFile(documentFile, 'center-documents')
        registrationDocument = {
          fileUrl: uploaded.fileUrl,
          fileName: documentFile.name,
          fileType: documentFile.type || 'application/pdf',
        }
      }

      await onAdd?.({
        name,
        city,
        address: address || city,
        openingHours,
        services,
        phone: phone || undefined,
        email: email || undefined,
        status,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        requestComment: requestComment || undefined,
        registrationDocument,
      })
      setSubmitted(true)
      setSubmitting(false)
      setTimeout(() => {
        setSubmitted(false)
        setName('')
        setCity('')
        setAddress('')
        setOpeningHours('08:00 - 18:00')
        setServices(['General Medicine'])
        setPhone('')
        setEmail('')
        setStatus('operational')
        setRequestComment('')
        setDocumentFile(null)
        onClose()
      }, 800)
    } catch (err) {
      console.error('Failed to add medical center', err)
      setError(err instanceof Error ? err.message : 'Could not save the medical center. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(6, 35, 33, 0.65)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16
    }}>
      <div className="fade-in modal-card" style={{
        width: '100%', maxWidth: 600, maxHeight: '90vh',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(18, 198, 186, 0.28)',
        borderRadius: 20, padding: '36px 32px',
        boxShadow: '0 20px 60px rgba(8, 48, 45, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        position: 'relative', overflowY: 'auto'
      }}>
        <button onClick={handleClose} style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(18, 198, 186, 0.1)', border: '1px solid rgba(18, 198, 186, 0.22)',
          borderRadius: '50%', width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)', cursor: 'pointer'
        }}>
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--blue)'
          }}>
            <Building2 size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              {isRequest ? 'Request New Medical Center' : 'Add New Medical Center'}
            </h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>
              {isRequest ? 'Submit a new clinic or hospital branch for Super Admin approval' : 'Register a new clinic or hospital branch in the system'}
            </div>
          </div>
        </div>

        {isRequest && !submitted && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#1e40af'
          }}>
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>This request will be sent to the <strong>Super Admin</strong>. The center profile is only created once it's approved.</span>
          </div>
        )}

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <CheckCircle2 size={52} color="#10B981" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)' }}>
              {isRequest ? 'Request Sent!' : 'Medical Center Registered!'}
            </h4>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
              {isRequest
                ? <>Request to add <strong>{name}</strong> ({city}) has been submitted for Super Admin approval.</>
                : <><strong>{name}</strong> ({city}) added to MediQueue network.</>}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Facility Name
              </label>
              <input
                required
                className="input"
                placeholder="e.g. MediQueue West Medical Center"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ height: 44, fontSize: 14 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  City / Location
                </label>
                <input
                  required
                  className="input"
                  placeholder="e.g. Colombo 07"
                  value={city}
                  onChange={e => handleCityChange(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Address
                </label>
                <input
                  required
                  className="input"
                  placeholder="e.g. 123 Medical Plaza"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Latitude (GPS)
                </label>
                <input
                  type="number"
                  step="any"
                  className="input"
                  placeholder="e.g. 6.9271"
                  value={latitude}
                  onChange={e => setLatitude(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Longitude (GPS)
                </label>
                <input
                  type="number"
                  step="any"
                  className="input"
                  placeholder="e.g. 79.8612"
                  value={longitude}
                  onChange={e => setLongitude(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
            </div>

            <LocationPickerMap
              lat={Number(latitude) || 6.9271}
              lng={Number(longitude) || 79.8612}
              onChange={(nLat, nLng) => {
                setLatitude(nLat.toString())
                setLongitude(nLng.toString())
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Opening Hours
                </label>
                <input
                  className="input"
                  placeholder="e.g. 08:00 - 18:00"
                  value={openingHours}
                  onChange={e => setOpeningHours(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Phone
                </label>
                <input
                  className="input"
                  placeholder="e.g. 0112345678"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Email
              </label>
              <input
                className="input"
                type="email"
                placeholder="e.g. contact@medicalcenter.io"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ height: 44, fontSize: 14 }}
              />
            </div>

            <div>
              <label
                htmlFor="center-services"
                style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}
              >
                Services Provided
              </label>
              <ServiceMultiSelect
                id="center-services"
                value={services}
                onChange={setServices}
                disabled={submitting}
              />
            </div>

            {!isRequest && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Initial Status
                </label>
                <select
                  className="input"
                  value={status}
                  onChange={e => setStatus(e.target.value as ApiCenter['status'])}
                  style={{ height: 44, fontSize: 14, borderRadius: 12, border: '1px solid var(--border-md)', background: '#fff' }}
                >
                  <option value="operational">Operational</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            )}

            {isRequest && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                    Registration Document (Required)
                  </label>
                  <input
                    required
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="input"
                    onChange={e => setDocumentFile(e.target.files?.[0] || null)}
                    style={{ fontSize: 14, paddingTop: 10, paddingBottom: 10 }}
                  />
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                    Please attach proof of clinic registration or licensing.
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                    Special Request Comment
                  </label>
                  <textarea
                    className="input"
                    placeholder="Any notes for the Super Admin..."
                    value={requestComment}
                    onChange={e => setRequestComment(e.target.value)}
                    style={{ height: 80, fontSize: 14, padding: 12, resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div style={{
                background: '#fff1f1', border: '1px solid #fca5a5',
                borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#dc2626',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" onClick={handleClose} disabled={submitting} className="btn btn-ghost" style={{ height: 42 }}>Cancel</button>
              <button type="submit" disabled={submitting} className="btn btn-primary" style={{ gap: 8, height: 42, padding: '0 20px', fontSize: 14 }}>
                <Plus size={16} /> {submitting ? (isRequest ? 'Submitting…' : 'Adding…') : (isRequest ? 'Submit for Approval' : 'Add Medical Center')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
