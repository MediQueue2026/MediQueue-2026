import React, { useState, useEffect } from 'react'
import { X, Building2, Plus, CheckCircle2, ShieldAlert, Key, Phone, Mail, FileText, Save } from 'lucide-react'
import { api } from '../lib/api'
import type { ApiCenter } from '../lib/api'
import ServiceMultiSelect from './ServiceMultiSelect'
import LocationPickerMap from './LocationPickerMap'

const SRI_LANKAN_PROVINCES: Record<string, string[]> = {
  'Western Province': ['Colombo', 'Gampaha', 'Kalutara'],
  'Central Province': ['Kandy', 'Matale', 'Nuwara Eliya'],
  'Southern Province': ['Galle', 'Matara', 'Hambantota'],
  'Northern Province': ['Jaffna', 'Kilinochchi', 'Mannar', 'Mullaitivu', 'Vavuniya'],
  'Eastern Province': ['Batticaloa', 'Ampara', 'Trincomalee'],
  'North Western Province': ['Kurunegala', 'Puttalam'],
  'North Central Province': ['Anuradhapura', 'Polonnaruwa'],
  'Uva Province': ['Badulla', 'Monaragala'],
  'Sabaragamuwa Province': ['Ratnapura', 'Kegalle'],
}

export default function AddCenterModal({
  isOpen,
  onClose,
  onAdd,
  onUpdated,
  mode = 'create',
  isAdmin = false,
  editCenter = null,
}: {
  isOpen: boolean
  onClose: () => void
  /** 'create' | 'request' | 'edit' */
  mode?: 'create' | 'request' | 'edit'
  isAdmin?: boolean
  editCenter?: ApiCenter | null
  onAdd?: (centerData: any) => Promise<any> | void
  onUpdated?: (centerData: any) => Promise<any> | void
}) {
  const isEdit = Boolean(editCenter) || mode === 'edit'
  const isRequest = !isAdmin && (mode === 'request')

  const [name, setName] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [licenseStatus, setLicenseStatus] = useState<'active' | 'pending' | 'expired' | 'suspended'>('active')
  const [city, setCity] = useState('')
  const [province, setProvince] = useState('')
  const [address, setAddress] = useState('')
  const [openingHours, setOpeningHours] = useState('08:00 - 18:00')
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
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [geocodedMatch, setGeocodedMatch] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [createdCredentials, setCreatedCredentials] = useState<{
    email: string
    password: string
    phone?: string | null
  } | null>(null)

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

  useEffect(() => {
    if (editCenter && isOpen) {
      setName(editCenter.name || '')
      setRegistrationNumber(editCenter.registrationNumber || '')
      setLicenseStatus(editCenter.licenseStatus || 'active')
      setProvince(editCenter.province || '')
      setCity(editCenter.city || '')
      setAddress(editCenter.address || '')
      setOpeningHours(editCenter.opening_hours || '08:00 - 18:00')
      setServices(editCenter.services && editCenter.services.length > 0 ? editCenter.services : ['General Medicine'])
      setPhone(editCenter.phone || '')
      setEmail(editCenter.email || '')
      setWebsite(editCenter.website || '')
      setStatus(editCenter.status || 'operational')
      setLatitude(editCenter.latitude ? String(editCenter.latitude) : '6.9271')
      setLongitude(editCenter.longitude ? String(editCenter.longitude) : '79.8612')
      setRequestComment(editCenter.requestComment || '')
      setDocumentFile(null)
      setCreatedCredentials(null)
      setError(null)
      setSubmitted(false)
      setIsGeocoding(false)
      setGeocodedMatch(null)
    } else if (isOpen) {
      setName('')
      setRegistrationNumber('')
      setLicenseStatus('active')
      setProvince('')
      setCity('')
      setAddress('')
      setOpeningHours('08:00 - 18:00')
      setServices(['General Medicine'])
      setPhone('')
      setEmail('')
      setWebsite('')
      setStatus('operational')
      setLatitude('6.9271')
      setLongitude('79.8612')
      setRequestComment('')
      setDocumentFile(null)
      setCreatedCredentials(null)
      setError(null)
      setSubmitted(false)
      setIsGeocoding(false)
      setGeocodedMatch(null)
    }
  }, [editCenter, isOpen])

  // Debounced address forward-geocoding to auto-locate pin on map while typing
  useEffect(() => {
    if (!isOpen) return
    const trimmed = address.trim()
    if (trimmed.length < 4) {
      setGeocodedMatch(null)
      return
    }

    const timer = setTimeout(async () => {
      try {
        setIsGeocoding(true)
        const parts = [trimmed]
        if (city) parts.push(city)
        if (province) parts.push(province)
        parts.push('Sri Lanka')
        const query = parts.join(', ')

        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
          { headers: { 'Accept-Language': 'en' } }
        )
        if (!res.ok) return
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          const found = data[0]
          const nextLat = Number(parseFloat(found.lat).toFixed(4))
          const nextLng = Number(parseFloat(found.lon).toFixed(4))
          if (!isNaN(nextLat) && !isNaN(nextLng)) {
            setLatitude(nextLat.toString())
            setLongitude(nextLng.toString())
            const label = found.display_name ? found.display_name.split(',').slice(0, 2).join(',') : 'Location pinned'
            setGeocodedMatch(label)
          }
        }
      } catch {
        // silent fallback - user can still pick pin manually or track GPS
      } finally {
        setIsGeocoding(false)
      }
    }, 850)

    return () => clearTimeout(timer)
  }, [address, city, province, isOpen])

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
            return addressText.includes(provinceKey)
          })

          const availableCities = provinceName ? (SRI_LANKAN_PROVINCES[provinceName] ?? []) : []
          const matchingCity = availableCities.find(cityName => addressText.includes(cityName.toLowerCase()))

          if (provinceName) setProvince(provinceName)
          if (matchingCity) setCity(matchingCity)
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
    setCreatedCredentials(null)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // Validation for new creation (Admin and Receptionist)
      if (!isEdit) {
        if (!name.trim()) throw new Error('Official Registered Name is required.')
        if (!registrationNumber.trim()) throw new Error('Registration / License Number is required.')
        if (!licenseStatus) throw new Error('License Status is required.')
        if (!province.trim()) throw new Error('Province is required.')
        if (!city.trim()) throw new Error('City / District is required.')
        if (!address.trim()) throw new Error('Official Address is required.')
        if (!openingHours.trim()) throw new Error('Opening Hours are required.')
        if (!phone.trim()) throw new Error('Official Phone Number is required to receive login credentials.')
        if (!services || services.length === 0) throw new Error('Please select at least one service provided.')
        if (!documentFile && !isEdit) {
          throw new Error('Registration Document (Proof of registration/licensing) is required.')
        }
      }

      let registrationDocument = undefined
      if (documentFile) {
        const uploaded = await api.uploadFile(documentFile, 'center-documents')
        registrationDocument = {
          fileUrl: uploaded.fileUrl,
          fileName: documentFile.name,
          fileType: documentFile.type || 'application/pdf',
        }
      }

      const payload = {
        name: name.trim(),
        registrationNumber: registrationNumber.trim() || undefined,
        licenseStatus: licenseStatus || 'active',
        city: city.trim(),
        province: province.trim() || undefined,
        address: address.trim() || city.trim(),
        openingHours: openingHours.trim(),
        services,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        website: website.trim() || undefined,
        status,
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        requestComment: requestComment.trim() || undefined,
        registrationDocument,
      }

      if (isEdit && editCenter) {
        // Update existing center
        const res = await api.updateCenter(editCenter.id, payload)
        if (onUpdated) await onUpdated(res.center)
        setSubmitted(true)
        setSubmitting(false)
        setTimeout(() => {
          setSubmitted(false)
          handleClose()
        }, 900)
      } else {
        // Create new center (Admin direct creation or receptionist request)
        const res = await api.createCenter(payload)
        if (onAdd) await onAdd(res.center || payload)
        setSubmitted(true)
        setSubmitting(false)
        setTimeout(() => {
          setSubmitted(false)
          handleClose()
        }, 900)
      }
    } catch (err) {
      console.error('Failed to save medical center', err)
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
        width: '100%', maxWidth: 660, maxHeight: '92vh',
        background: 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(139, 92, 246, 0.25)',
        borderRadius: 20, padding: '32px 30px',
        boxShadow: '0 20px 60px rgba(8, 48, 45, 0.16)',
        position: 'relative', overflowY: 'auto'
      }}>
        <button onClick={handleClose} style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)',
          borderRadius: '50%', width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)', cursor: 'pointer'
        }}>
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: 'rgba(139, 92, 246, 0.12)', border: '1.5px solid rgba(139, 92, 246, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#7C3AED'
          }}>
            <Building2 size={24} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0 }}>
              {isEdit ? 'Edit Medical Center' : isAdmin ? 'Add New Medical Center' : 'Register Medical Center'}
            </h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 2 }}>
              {isEdit
                ? 'Update official facility identity, licensing, and services'
                : isAdmin
                  ? 'Register an official medical center and dispatch receptionist credentials via SMS'
                  : 'Submit a new clinic or hospital branch for Super Admin review'}
            </div>
          </div>
        </div>

        {/* Admin Credential Dispatch Notice or Receptionist Review Notice */}
        {isAdmin && !isEdit && !createdCredentials && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: 'rgba(139, 92, 246, 0.07)', border: '1px solid rgba(139, 92, 246, 0.25)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 18, fontSize: 12.5, color: '#6D28D9'
          }}>
            <Key size={18} style={{ flexShrink: 0, marginTop: 2, color: '#7C3AED' }} />
            <div>
              <strong>Instant Receptionist Credentials:</strong> Upon saving, MediQueue will automatically generate receptionist credentials and send them via SMS to the official phone number entered below.
            </div>
          </div>
        )}

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

        {/* Success View with Credentials (if Admin created) */}
        {createdCredentials ? (
          <div style={{ padding: '24px 16px', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.14)',
              color: '#10B981', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <CheckCircle2 size={36} />
            </div>
            <h4 style={{ fontSize: 19, fontWeight: 900, color: 'var(--text-1)', marginBottom: 6 }}>
              Medical Center Created Successfully!
            </h4>
            <p style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 460, margin: '0 auto 20px' }}>
              <strong>{name}</strong> is now live. Receptionist login credentials have been dispatched via SMS.
            </p>

            <div style={{
              background: '#f8fafc', border: '1px solid var(--border-md)',
              borderRadius: 14, padding: 18, textAlign: 'left', maxWidth: 480, margin: '0 auto 24px'
            }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', color: '#7C3AED', letterSpacing: '0.05em', marginBottom: 12 }}>
                Dispatched Receptionist Credentials
              </div>
              <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={15} color="var(--text-4)" />
                  <span style={{ color: 'var(--text-3)' }}>Login Email:</span>
                  <strong style={{ color: 'var(--text-1)' }}>{createdCredentials.email}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Key size={15} color="var(--text-4)" />
                  <span style={{ color: 'var(--text-3)' }}>Temp Password:</span>
                  <code style={{ background: '#fff', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', fontWeight: 700, color: '#6D28D9' }}>
                    {createdCredentials.password}
                  </code>
                </div>
                {createdCredentials.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Phone size={15} color="var(--text-4)" />
                    <span style={{ color: 'var(--text-3)' }}>SMS Sent To:</span>
                    <strong style={{ color: 'var(--text-1)' }}>{createdCredentials.phone}</strong>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="btn btn-primary"
              style={{
                background: '#8B5CF6',
                borderColor: '#7C3AED',
                padding: '0 28px',
                height: 44,
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 12
              }}
            >
              Done & Close
            </button>
          </div>
        ) : submitted && !createdCredentials ? (
          <div style={{ textAlign: 'center', padding: '36px 0' }}>
            <CheckCircle2 size={52} color="#10B981" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ fontSize: 19, fontWeight: 900, color: 'var(--text-1)' }}>
              {isEdit ? 'Changes Saved!' : 'Request Submitted!'}
            </h4>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
              {isEdit
                ? <>Medical center <strong>{name}</strong> profile has been updated successfully.</>
                : <>Request to add <strong>{name}</strong> has been submitted for Super Admin review.</>}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Facility Official Name */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Official Registered Name <span style={{ color: '#ef4444' }}>*</span>
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

            {/* Registration Number & License Status */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Registration / License Number {!isEdit && <span style={{ color: '#ef4444' }}>*</span>}
                </label>
                <input
                  required={!isEdit}
                  className="input"
                  placeholder="Government / MOH number"
                  value={registrationNumber}
                  onChange={e => setRegistrationNumber(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  License Status <span style={{ color: '#ef4444' }}>*</span>
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

            {/* Province & City / District */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Province <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  required
                  className="input"
                  value={province}
                  onChange={e => handleProvinceChange(e.target.value)}
                  style={{ height: 44, fontSize: 14, borderRadius: 12, border: '1px solid var(--border-md)', background: '#fff' }}
                >
                  <option value="">Select Province</option>
                  {Object.keys(SRI_LANKAN_PROVINCES).map(provName => (
                    <option key={provName} value={provName}>{provName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  City / District <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  required
                  className="input"
                  value={city}
                  disabled={!province}
                  onChange={e => handleCityChange(e.target.value)}
                  style={{ height: 44, fontSize: 14, borderRadius: 12, border: '1px solid var(--border-md)', background: '#fff', opacity: province ? 1 : 0.65 }}
                >
                  <option value="">{province ? 'Select City / District' : 'Select a province first'}</option>
                  {(SRI_LANKAN_PROVINCES[province] ?? []).map(cityName => (
                    <option key={cityName} value={cityName}>{cityName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Physical Address */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Official Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                {isGeocoding && (
                  <span style={{ fontSize: 11, color: '#0D9488', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> Auto-finding on map…
                  </span>
                )}
                {!isGeocoding && geocodedMatch && (
                  <span style={{ fontSize: 11, color: '#0F766E', fontWeight: 600 }}>
                    📍 Map aligned: {geocodedMatch}
                  </span>
                )}
              </div>
              <input
                required
                className="input"
                placeholder="e.g. 120/A Galle Road, Colombo 03"
                value={address}
                onChange={e => setAddress(e.target.value)}
                style={{ height: 44, fontSize: 14 }}
              />
            </div>

            {/* Interactive Map Picker */}
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

            {/* Opening Hours & Official Phone Number */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Opening Hours <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  required
                  className="input"
                  placeholder="e.g. 08:00 - 18:00"
                  value={openingHours}
                  onChange={e => setOpeningHours(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Official Phone Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  required
                  className="input"
                  placeholder="e.g. 0771234567 / 0112345678"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
            </div>

            {/* Official Email & Website */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Official Clinic Email
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="e.g. contact@cityclinic.lk"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ height: 44, fontSize: 14 }}
                />
              </div>
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
            </div>

            {/* Services Provided (Categorized Multi-Select) */}
            <div>
              <label
                htmlFor="center-services"
                style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}
              >
                Services Provided <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <ServiceMultiSelect
                id="center-services"
                value={services}
                onChange={setServices}
                disabled={submitting}
              />
            </div>

            {/* Operational Status (for Admin or Edit) */}
            {(isAdmin || isEdit) && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                  Operational Status
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

            {/* Registration Document Upload */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Registration Document {!isEdit && <span style={{ color: '#ef4444' }}>* (Required)</span>}
              </label>
              <input
                required={!isEdit}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="input"
                onChange={e => setDocumentFile(e.target.files?.[0] || null)}
                style={{ fontSize: 13, paddingTop: 10, paddingBottom: 10 }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>
                Attach official government MOH or Private Health Services Regulatory Council (PHSRC) registration certificate.
              </div>
              {isEdit && editCenter?.documents && editCenter.documents.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#1D4ED8', background: 'rgba(37, 99, 235, 0.08)', padding: '6px 12px', borderRadius: 8 }}>
                  <FileText size={14} /> Current on file: {editCenter.documents[0].title || 'Registration Document'}
                </div>
              )}
            </div>

            {/* Special Request Comment (Optional) */}
            {isRequest && (
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
            )}

            {error && (
              <div style={{
                background: '#fff1f1', border: '1px solid #fca5a5',
                borderRadius: 8, padding: '10px 14px', fontSize: 12.5, color: '#dc2626',
              }}>
                {error}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="btn btn-ghost"
                style={{ height: 44, padding: '0 18px', fontWeight: 600 }}
              >
                Discard Changes
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{
                  background: isAdmin ? '#8B5CF6' : undefined,
                  borderColor: isAdmin ? '#7C3AED' : undefined,
                  gap: 8, height: 44, padding: '0 24px', fontSize: 14, fontWeight: 700,
                  boxShadow: isAdmin ? '0 4px 14px rgba(139, 92, 246, 0.35)' : undefined
                }}
              >
                {submitting ? (
                  isEdit ? 'Saving…' : 'Creating…'
                ) : isEdit ? (
                  <>
                    <Save size={16} /> Save Changes
                  </>
                ) : isAdmin ? (
                  <>
                    <Plus size={16} /> Save & Create Medical Center
                  </>
                ) : (
                  <>
                    <Plus size={16} /> Submit for Admin Approval
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
