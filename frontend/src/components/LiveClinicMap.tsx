import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Map, MapPin, Navigation, Phone, Calendar, Compass, Search, X, Megaphone } from 'lucide-react'
import { api } from '../lib/api'
import type { ApiCenterNotice } from '../lib/api'

// Fix default Leaflet icon paths in React Vite
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})
L.Marker.prototype.options.icon = defaultIcon

interface LiveClinicMapProps {
  centers: any[]
  doctors: any[]
  selectedCenterId: string
  onSelectCenter: (centerId: string) => void
  onBookCenter: (centerId: string) => void
}

function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): string {
  return calculateHaversineDistance(lat1, lon1, lat2, lon2).toFixed(1) + ' km'
}

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c
}

export function LiveClinicMap({
  centers,
  doctors,
  selectedCenterId,
  onSelectCenter,
  onBookCenter
}: LiveClinicMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markersRef = useRef<{ [key: string]: L.Marker }>({})
  const userMarkerRef = useRef<L.Marker | null>(null)

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [geoLocating, setGeoLocating] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [notices, setNotices] = useState<ApiCenterNotice[]>([])

  // `mapDbCenterToPublic` (backend) returns this field as `approvalStatus`
  // (camelCase) — filtering on `approval_status` here always fell through to
  // "approved" and never actually excluded a pending/rejected center.
  const [centerSearch, setCenterSearch] = useState('')

  const approvedCenters = (centers || []).filter(c => (c.approvalStatus ?? c.approval_status ?? 'approved') === 'approved')
  const selectedCenter = approvedCenters.find(c => c.id === selectedCenterId)
  const referenceLocation = userLocation || { lat: 6.9271, lng: 79.8612 }
  const cityFallbacks: Record<string, { lat: number; lng: number }> = {
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
    'colombo': { lat: 6.9271, lng: 79.8612 }
  }
  const centersByDistance = approvedCenters
    .map(center => {
      const cityKey = Object.keys(cityFallbacks).find(key => (center.city || center.name || '').toLowerCase().includes(key)) || 'colombo'
      const fallback = cityFallbacks[cityKey]
      const lat = center.latitude !== null && center.latitude !== undefined && !isNaN(Number(center.latitude))
        ? Number(center.latitude)
        : fallback.lat
      const lng = center.longitude !== null && center.longitude !== undefined && !isNaN(Number(center.longitude))
        ? Number(center.longitude)
        : fallback.lng
      return { center, lat, lng, distance: calculateHaversineDistance(referenceLocation.lat, referenceLocation.lng, lat, lng) }
    })
    .sort((a, b) => a.distance - b.distance)
  const nearestCenters = centersByDistance.slice(0, 5)
  const centersToDisplay = centersByDistance
  const matchingCenters = centerSearch.trim()
    ? centersByDistance.filter(({ center }) => `${center.name || ''} ${center.city || ''} ${center.address || ''}`.toLowerCase().includes(centerSearch.trim().toLowerCase())).slice(0, 6)
    : []

  // Notices/promotions the selected center's receptionist has posted.
  useEffect(() => {
    if (!selectedCenter?.id) { setNotices([]); return }
    let cancelled = false
    api.getCenterNotices(selectedCenter.id)
      .then(res => { if (!cancelled) setNotices(res.notices) })
      .catch(() => { if (!cancelled) setNotices([]) })
    return () => { cancelled = true }
  }, [selectedCenter?.id])

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    if (!mapInstanceRef.current) {
      const initialLat = Number(selectedCenter?.latitude) || 6.9147
      const initialLng = Number(selectedCenter?.longitude) || 79.8732

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 12,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Sync Markers & Center View
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !approvedCenters || approvedCenters.length === 0) return

    // Clear existing clinic markers
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    centersToDisplay.forEach(({ center: c, lat, lng }) => {
      const centerDocs = doctors.filter(d => !d.centerId || d.centerId === c.id || d.center_id === c.id || doctors.length <= 2)
      const docListHtml = centerDocs.map(d => `<li style="font-size:11px; margin-top:2px; color:#10b981; font-weight:700;">👨‍⚕️ ${d.name} (${d.spec})</li>`).join('')

      const statusBadge = c.status === 'maintenance'
        ? '<span style="font-size:10px; font-weight:700; background:#fef3c7; color:#d97706; padding:2px 6px; border-radius:4px;">🟡 Maintenance</span>'
        : c.status === 'closed'
          ? '<span style="font-size:10px; font-weight:700; background:#fee2e2; color:#dc2626; padding:2px 6px; border-radius:4px;">🔴 Closed</span>'
          : '<span style="font-size:10px; font-weight:700; background:#dcfce7; color:#16a34a; padding:2px 6px; border-radius:4px;">🟢 Operational</span>';

      const popupHtml = `
        <div style="font-family: sans-serif; padding: 4px; min-width: 220px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
            <strong style="font-size:13px; color:#0f172a;">🏥 ${c.name}</strong>
            ${statusBadge}
          </div>
          <span style="font-size:11px; color:#64748b; display:block;">📍 ${c.address}, ${c.city}</span>
          <span style="font-size:11px; color:#64748b; display:block; margin-top:2px;">📞 ${c.phone || '0112345678'}</span>
          <hr style="margin: 6px 0; border: none; border-top: 1px solid #e2e8f0;" />
          <span style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Consulting Doctors:</span>
          <ul style="margin:2px 0 8px 0; padding-left:14px;">${docListHtml || '<li style="font-size:11px; color:#64748b;">General Consultation Desk</li>'}</ul>
          <div style="display:flex; gap:6px; margin-top:6px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noreferrer" style="flex:1; background:#0ea5e9; color:#fff; text-decoration:none; padding:6px 8px; border-radius:6px; font-size:11px; font-weight:700; text-align:center;">
              🗺️ Route
            </a>
            <button id="book-btn-${c.id}" style="flex:1; background:#10b981; color:#fff; border:none; padding:6px 8px; border-radius:6px; font-size:11px; font-weight:700; cursor:pointer;">
              📅 Book Here
            </button>
          </div>
        </div>
      `

      const marker = L.marker([lat, lng]).addTo(map).bindPopup(popupHtml)
      marker.on('click', () => onSelectCenter(c.id))
      marker.on('popupopen', () => {
        const btn = document.getElementById(`book-btn-${c.id}`)
        if (btn) {
          btn.onclick = () => onBookCenter(c.id)
        }
      })
      markersRef.current[c.id] = marker
    })


    const markerPoints = nearestCenters
      .map(({ center }) => markersRef.current[center.id]?.getLatLng())
      .filter((point): point is L.LatLng => Boolean(point))

    if (markerPoints.length > 1) {
      map.fitBounds(L.latLngBounds(markerPoints), { padding: [28, 28], maxZoom: 13, animate: false })
    } else if (markerPoints.length === 1) {
      map.setView(markerPoints[0], 13, { animate: false })
    }
  }, [centers, doctors, userLocation])

  // GPS Geolocation Handler
  const handleLocateUser = () => {
    setGeoLocating(true)
    setGeoError(null)

    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.')
      setGeoLocating(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        setGeoLocating(false)
        const userLat = pos.coords.latitude
        const userLng = pos.coords.longitude
        setUserLocation({ lat: userLat, lng: userLng })

        const map = mapInstanceRef.current
        if (map) {
          if (userMarkerRef.current) userMarkerRef.current.remove()

          const userIcon = L.divIcon({
            className: 'custom-user-pin',
            html: `<div style="width:20px; height:20px; background:#10B981; border:3px solid #ffffff; borderRadius:50%; box-shadow:0 0 15px rgba(16,185,129,0.8);"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })

          userMarkerRef.current = L.marker([userLat, userLng], { icon: userIcon })
            .addTo(map)
            .bindPopup(`<strong style="font-size:12px;">📍 Your Current Location</strong>`)
            .openPopup()

          map.setView([userLat, userLng], 13, { animate: true })
        }
      },
      _err => {
        setGeoLocating(false)
        setGeoError('Could not retrieve your GPS location. Please check browser permissions.')
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  // Calculate distance from user to selected center if user location is active
  const distanceText = userLocation && selectedCenter
    ? calculateHaversineKm(userLocation.lat, userLocation.lng, Number(selectedCenter.latitude) || 6.9147, Number(selectedCenter.longitude) || 79.8732)
    : null

  const handleCenterSearchSelect = (centerId: string) => {
    const result = centersByDistance.find(({ center }) => center.id === centerId)
    const map = mapInstanceRef.current
    const marker = markersRef.current[centerId]

    onSelectCenter(centerId)
    setCenterSearch(result?.center.name || '')

    if (map && result && marker) {
      map.setView([result.lat, result.lng], 14, { animate: true })
      marker.openPopup()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Map Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Map size={16} color="var(--blue)" />
          <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Interactive Live Clinic Navigator &amp; Locator
          </span>
        </div>
        <button
          type="button"
          onClick={handleLocateUser}
          disabled={geoLocating}
          className="btn btn-ghost btn-sm"
          style={{ gap: 5, fontSize: 11.5, color: 'var(--blue)', fontWeight: 700 }}
        >
          <Compass size={14} /> {geoLocating ? 'Locating GPS...' : 'Track my location'}
        </button>
      </div>

      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 11px', background: '#fff', border: '1px solid var(--border-md)', borderRadius: 9 }}>
          <Search size={15} color="var(--text-4)" />
          <input
            type="search"
            value={centerSearch}
            onChange={event => setCenterSearch(event.target.value)}
            placeholder="Search medical centers by name or city"
            aria-label="Search medical centers by name or city"
            style={{ width: '100%', border: 0, outline: 0, background: 'transparent', color: 'var(--text-1)', fontSize: 12 }}
          />
          {centerSearch && (
            <button type="button" onClick={() => setCenterSearch('')} aria-label="Clear center search" style={{ display: 'grid', placeItems: 'center', padding: 0, border: 0, background: 'transparent', color: 'var(--text-4)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          )}
        </div>
        {matchingCenters.length > 0 && (
          <div style={{ position: 'absolute', top: 42, left: 0, right: 0, zIndex: 20, padding: 5, background: '#fff', border: '1px solid var(--border-md)', borderRadius: 9, boxShadow: '0 10px 24px rgba(15, 23, 42, .14)' }}>
            {matchingCenters.map(({ center, distance }) => (
              <button
                key={center.id}
                type="button"
                onClick={() => handleCenterSearchSelect(center.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 9px', border: 0, borderRadius: 6, background: 'transparent', color: 'var(--text-1)', textAlign: 'left', cursor: 'pointer' }}
              >
                <span>
                  <strong style={{ display: 'block', fontSize: 12 }}>{center.name}</strong>
                  <small style={{ color: 'var(--text-4)', fontSize: 10 }}>{center.city || center.address || 'Medical center'}</small>
                </span>
                <small style={{ color: 'var(--blue)', fontSize: 10, fontWeight: 700 }}>{distance.toFixed(1)} km</small>
              </button>
            ))}
          </div>
        )}
        {centerSearch.trim() && matchingCenters.length === 0 && (
          <div style={{ position: 'absolute', top: 42, left: 0, right: 0, zIndex: 20, padding: '10px 12px', background: '#fff', border: '1px solid var(--border-md)', borderRadius: 9, color: 'var(--text-4)', fontSize: 11, boxShadow: '0 10px 24px rgba(15, 23, 42, .14)' }}>
            No medical centers found.
          </div>
        )}
      </div>

      {geoError && (
        <div style={{ fontSize: 11, color: 'var(--crimson)', padding: '4px 8px', background: 'var(--crimson-dim)', borderRadius: 6 }}>
          {geoError}
        </div>
      )}

      {/* Live Leaflet Map Container */}
      <div className="patient-clinic-map" style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-md)' }}>
        <div ref={mapContainerRef} style={{ height: 340, width: '100%', zIndex: 1 }} />

        {distanceText && (
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 10,
            background: 'rgba(7, 21, 20, 0.9)', color: '#ffffff',
            border: '1px solid var(--blue)', borderRadius: 8, padding: '6px 12px',
            fontSize: 11.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
          }}>
            <Navigation size={13} color="var(--blue)" /> {distanceText} to {selectedCenter?.name}
          </div>
        )}
      </div>

      {/* Center Detail Info Bar */}
      {selectedCenter && (
        <div style={{ padding: 12, borderRadius: 10, background: '#ffffff', border: '1px solid var(--border-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>{selectedCenter.name}</div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${selectedCenter.latitude || 6.9147},${selectedCenter.longitude || 79.8732}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm"
              style={{ gap: 4, fontSize: 11, color: 'var(--blue)', fontWeight: 700 }}
            >
              <Navigation size={12} /> Get Directions
            </a>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={12} color="var(--blue)" /> {selectedCenter.address} · {selectedCenter.city}
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Phone size={12} color="var(--blue)" /> Hotline: {selectedCenter.phone || '0112345678'} · Hours: {selectedCenter.opening_hours || '08:00 - 20:00'}
          </div>

          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4 }}>Consulting Doctors at this Location:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {doctors.filter(d => !d.centerId || d.centerId === selectedCenter.id || d.center_id === selectedCenter.id || doctors.length <= 2).map(d => (
                <span key={d.id} style={{ fontSize: 11, background: 'var(--blue-dim)', color: 'var(--blue-dark)', border: '1px solid var(--blue-border)', borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
                  👨‍⚕️ {d.name} ({d.spec})
                </span>
              ))}
            </div>
          </div>

          {notices.length > 0 && (
            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Megaphone size={12} color="var(--blue)" /> Notices &amp; Promotions
              </div>
              {notices.map(notice => (
                <div key={notice.id} style={{
                  display: 'flex', gap: 10, padding: 10, borderRadius: 10,
                  background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
                }}>
                  {notice.imageUrl && (
                    <img
                      src={notice.imageUrl}
                      alt=""
                      style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue-dark)' }}>{notice.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.45 }}>{notice.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => onBookCenter(selectedCenter.id)}
            className="btn btn-primary btn-sm"
            style={{ marginTop: 6, justifyContent: 'center', gap: 6 }}
          >
            <Calendar size={13} /> Book Appointment at {selectedCenter.name}
          </button>
        </div>
      )}
    </div>
  )
}
