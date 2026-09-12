import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { X, Building2, Plus, CheckCircle2, ShieldAlert, LocateFixed } from 'lucide-react'
import { api } from '../lib/api'
import type { ApiCenter } from '../lib/api'
import ServiceMultiSelect from './ServiceMultiSelect'

const SRI_LANKAN_PROVINCES: Record<string, string[]> = {
  'Western Province': ['Colombo', 'Gampaha', 'Kalutara'],
  'Central Province': ['Kandy', 'Matale', 'Nuwara Eliya'],
  'Southern Province': ['Galle', 'Matara', 'Hambantota'],
  'Northern Province': ['Jaffna', 'Kilinochchi', 'Mannar', 'Mullaitivu', 'Vavuniya'],
  'Eastern Province': ['Ampara', 'Batticaloa', 'Trincomalee'],
  'North Western Province': ['Kurunegala', 'Puttalam'],
  'North Central Province': ['Anuradhapura', 'Polonnaruwa'],
  'Uva Province': ['Badulla', 'Monaragala'],
  'Sabaragamuwa Province': ['Kegalle', 'Ratnapura'],
}

function LocationPickerMap({
  lat,
  lng,
  onChange,
  onTrackLocation,
  trackingLocation,
}: {
  lat: number
  lng: number
  onChange: (lat: number, lng: number) => void
  onTrackLocation: () => void
  trackingLocation: boolean
}) {
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
      <div style={{ background: '#f8fafc', padding: '7px 12px', fontSize: 11, color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span>📍 <strong>Click map or drag pin</strong> to pick clinic location</span>
        <button
          type="button"
          onClick={onTrackLocation}
          disabled={trackingLocation}
          className="btn btn-ghost btn-sm"
          style={{ gap: 5, padding: '5px 8px', whiteSpace: 'nowrap', opacity: trackingLocation ? 0.65 : 1 }}
        >
          <LocateFixed size={13} />
          {trackingLocation ? 'Locating…' : 'Use my location'}
        </button>
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
    registrationNumber?: string
    licenseStatus?: 'active' | 'pending' | 'expired' | 'suspended'
    city: string
    province?: string
    address?: string
    openingHours?: string
    services?: string[]
    phone?: string
    email?: string
    website?: string
    status?: ApiCenter['status']
    latitude?: number
    longitude?: number
    requestComment?: string
    registrationDocument?: { fileUrl: string; fileName: string; fileType: string }
  }) => void
}) {
  const isRequest = mode === 'request'
  const [name, setName] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [licenseStatus, setLicenseStatus] = useState<'active' | 'pending' | 'expired' | 'suspended'>('active')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [address, setAddress] = useState('')
  const [openingHours, setOpeningHours] = useState('08:00 - 18:00')
  /** Chosen from a list rather than typed as comma-separated text — see ServiceMultiSelect. */
  const [services, setServices] = useState<string[]>(['General Medicine'])
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState<ApiCenter['status']>('operational')
  const [latitude, setLatitude] = useState<string>('6.9271')
  const [longitude, setLongitude] = useState<string>('79.8612')
  const [requestComment, setRequestComment] = useState('')
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [trackingLocation, setTrackingLocation] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cityCoordsMap: Record<string, { lat: number; lng: number }> = {
    'colombo': { lat: 6.9271, lng: 79.8612 },
    'kalutara': { lat: 6.5854, lng: 79.9607 },
    'kandy': { lat: 7.2906, lng: 80.6337 },
    'matale': { lat: 7.4675, lng: 80.6234 },
    'nuwara eliya': { lat: 6.9497, lng: 80.7891 },
    'galle': { lat: 6.0535, lng: 80.2210 },
    'hambantota': { lat: 6.1429, lng: 81.1212 },
    'jaffna': { lat: 9.6615, lng: 80.0255 },
    'kilinochchi': { lat: 9.3803, lng: 80.3770 },
    'mannar': { lat: 8.9810, lng: 79.9044 },
    'mullaitivu': { lat: 9.2671, lng: 80.8128 },
    'vavuniya': { lat: 8.7514, lng: 80.4971 },
    'ampara': { lat: 7.2965, lng: 81.6820 },
    'negombo': { lat: 7.2008, lng: 79.8737 },
    'kurunegala': { lat: 7.4863, lng: 80.3647 },
    'puttalam': { lat: 8.0362, lng: 79.8283 },
    'matara': { lat: 5.9549, lng: 80.5550 },
    'gampaha': { lat: 7.0840, lng: 79.9925 },
    'batticaloa': { lat: 7.7310, lng: 81.6747 },
    'trincomalee': { lat: 8.5874, lng: 81.2152 },
    'anuradhapura': { lat: 8.3114, lng: 80.4037 },
    'polonnaruwa': { lat: 7.9403, lng: 81.0188 },
    'badulla': { lat: 6.9934, lng: 81.0550 },
    'monaragala': { lat: 6.8728, lng: 81.3507 },
    'kegalle': { lat: 7.2513, lng: 80.3464 },
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

  const handleProvinceChange = (val: string) => {
    setProvince(val)
    setCity('')
  }

  const handleTrackLocation = () => {
    if (!navigator.geolocation) {
      setError('Location tracking is not supported by this browser.')
      return
    }

    setError(null)
    setTrackingLocation(true)
    navigator.geolocation.getCurrentPosition(
      async position => {
        const nextLat = Number(position.coords.latitude.toFixed(4))
        const nextLng = Number(position.coords.longitude.toFixed(4))
        setLatitude(nextLat.toString())
        setLongitude(nextLng.toString())

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${nextLat}&lon=${nextLng}&zoom=10&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } },
          )
          if (!response.ok) throw new Error('Location details could not be loaded.')

          const data = await response.json() as {
            address?: {
              state?: string
              province?: string
              city?: string
              city_district?: string
              state_district?: string
              district?: string
              town?: string
              village?: string
              suburb?: string
              municipality?: string
              county?: string
            }
          }
          const location = data.address
          const addressText = Object.values(location ?? {}).join(' ').toLowerCase()
          const provinceName = Object.keys(SRI_LANKAN_PROVINCES).find(name => {
            const provinceKey = name.toLowerCase().replace(' province', '')
            return addressText.includes(name.toLowerCase()) || addressText.includes(provinceKey)
          })
          const selectedProvince = provinceName ?? (province && SRI_LANKAN_PROVINCES[province] ? province : undefined)
          const citySources = [
            location?.city,
            location?.city_district,
            location?.state_district,
            location?.district,
            location?.town,
            location?.municipality,
            location?.village,
            location?.county,
            location?.suburb,
          ].filter(Boolean).map(value => value!.toLowerCase())
          const matchingCity = selectedProvince
            ? SRI_LANKAN_PROVINCES[selectedProvince].find(name => {
              const cityKey = name.toLowerCase()
              return citySources.some(source => source.includes(cityKey) || cityKey.includes(source.replace(/\s+district$/i, '')))
            })
            : undefined

          // GPS often resolves to a municipality or suburb rather than the
          // district name used by the form, so use the nearest district center.
          const nearestCity = selectedProvince && !matchingCity
            ? SRI_LANKAN_PROVINCES[selectedProvince]
              .map(name => {
                const coords = cityCoordsMap[name.toLowerCase()]
                if (!coords) return null
                return { name, distance: Math.hypot(coords.lat - nextLat, coords.lng - nextLng) }
              })
              .filter((candidate): candidate is { name: string; distance: number } => candidate !== null)
              .sort((a, b) => a.distance - b.distance)[0]
            : undefined

          if (selectedProvince) setProvince(selectedProvince)
          if (matchingCity) setCity(matchingCity)
          else if (nearestCity && nearestCity.distance < 0.75) setCity(nearestCity.name)
          else if (selectedProvince) setCity('')
          if (!selectedProvince || (!matchingCity && (!nearestCity || nearestCity.distance >= 0.75))) {
            setError('Location found, but the province or city could not be matched. Please select them manually.')
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Location found, but address details could not be loaded.')
        } finally {
          setTrackingLocation(false)
        }
      },
      geolocationError => {
        setTrackingLocation(false)
        const message = geolocationError.code === geolocationError.PERMISSION_DENIED
          ? 'Location permission was denied. Allow access and try again.'
          : 'Could not determine your current location. Please try again.'
        setError(message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
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
      if (isRequest && (!name.trim() || !registrationNumber.trim() || !licenseStatus || !address.trim() || !city.trim() || !province.trim() || !phone.trim())) {
        setError('Complete the official registration, license, address, province, and phone details before submitting.')
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
        registrationNumber: registrationNumber.trim() || undefined,
        licenseStatus: isRequest ? licenseStatus : undefined,
        city,
        province: province.trim() || undefined,
        address: address || city,
        openingHours,
        services,
        phone: phone || undefined,
        email: email || undefined,
        website: website.trim() || undefined,
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
        setRegistrationNumber('')
        setLicenseStatus('active')
        setCity('')
        setProvince('')
        setAddress('')
        setOpeningHours('08:00 - 18:00')
        setServices(['General Medicine'])
        setPhone('')
        setEmail('')
        setWebsite('')
        setStatus('operational')
        setRequestComment('')
        setDocumentFile(null)
        setTrackingLocation(false)
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
            <span>This request will be sent to the <strong>Super Admin</strong>. It is saved as pending and becomes visible only after approval.</span>
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
                {isRequest ? 'Official Registered Name' : 'Facility Name'}
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

            {isRequest && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                      Registration / License Number
                    </label>
                    <input
                      required
                      className="input"
                      placeholder="Government-issued number"
                      value={registrationNumber}
                      onChange={e => setRegistrationNumber(e.target.value)}
                      style={{ height: 44, fontSize: 14 }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                      License Status
                    </label>
                    <select
                      required
                      className="input"
                      value={licenseStatus}
                      onChange={e => setLicenseStatus(e.target.value as typeof licenseStatus)}
                      style={{ height: 44, fontSize: 14, borderRadius: 12, border: '1px solid var(--border-md)', background: '#fff' }}
                    >
                      <option value="active">Active</option>
                      <option value="pending">Pending</option>
                      <option value="expired">Expired</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>

                <LocationPickerMap
                  lat={Number(latitude) || 6.9271}
                  lng={Number(longitude) || 79.8612}
                  trackingLocation={trackingLocation}
                  onTrackLocation={handleTrackLocation}
                  onChange={(nLat, nLng) => {
                    setLatitude(nLat.toString())
                    setLongitude(nLng.toString())
                  }}
                />

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                    Province
                  </label>
                  <select
                    required
                    className="input"
                    value={province}
                    onChange={e => handleProvinceChange(e.target.value)}
                    style={{ height: 44, fontSize: 14, borderRadius: 12, border: '1px solid var(--border-md)', background: '#fff' }}
                  >
                    <option value="">Select province</option>
                    {Object.keys(SRI_LANKAN_PROVINCES).map(provinceName => (
                      <option key={provinceName} value={provinceName}>{provinceName}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  City / District
                </label>
                {isRequest ? (
                  <select
                    required
                    className="input"
                    value={city}
                    disabled={!province}
                    onChange={e => handleCityChange(e.target.value)}
                    style={{ height: 44, fontSize: 14, borderRadius: 12, border: '1px solid var(--border-md)', background: '#fff', opacity: province ? 1 : 0.65 }}
                  >
                    <option value="">{province ? 'Select city / district' : 'Select a province first'}</option>
                    {(SRI_LANKAN_PROVINCES[province] ?? []).map(cityName => (
                      <option key={cityName} value={cityName}>{cityName}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    required
                    className="input"
                    placeholder="e.g. Colombo 07"
                    value={city}
                    onChange={e => handleCityChange(e.target.value)}
                    style={{ height: 44, fontSize: 14 }}
                  />
                )}
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
                  {isRequest ? 'Official Phone Number' : 'Phone'}
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
                {isRequest ? 'Official Email (Optional)' : 'Email'}
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

            {isRequest && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Website (Optional)
                </label>
                <input
                  className="input"
                  type="url"
                  placeholder="https://example.org"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
            )}

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
