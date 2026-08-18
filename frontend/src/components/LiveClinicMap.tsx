import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Navigation, Phone, Calendar, Compass } from 'lucide-react'

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
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;
  return d.toFixed(1) + ' km';
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

  const selectedCenter = centers.find(c => c.id === selectedCenterId) || centers[0]

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    if (!mapInstanceRef.current) {
      const initialLat = selectedCenter?.latitude || 6.9147
      const initialLng = selectedCenter?.longitude || 79.8732

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
    if (!map || !centers || centers.length === 0) return

    // Clear existing clinic markers
    Object.values(markersRef.current).forEach(m => m.remove())
    markersRef.current = {}

    centers.forEach(c => {
      const lat = Number(c.latitude) || 6.9147
      const lng = Number(c.longitude) || 79.8732

      const centerDocs = doctors.filter(d => !d.centerId || d.centerId === c.id || d.center_id === c.id || doctors.length <= 2)
      const docListHtml = centerDocs.map(d => `<li style="font-size:11px; margin-top:2px; color:#10b981; font-weight:700;">👨‍⚕️ ${d.name} (${d.spec})</li>`).join('')

      const popupHtml = `
        <div style="font-family: sans-serif; padding: 4px; min-width: 200px;">
          <strong style="font-size:13px; color:#0f172a; display:block; margin-bottom:2px;">🏥 ${c.name}</strong>
          <span style="font-size:11px; color:#64748b; display:block;">📍 ${c.address}, ${c.city}</span>
          <span style="font-size:11px; color:#64748b; display:block; margin-top:2px;">📞 ${c.phone || '0112345678'}</span>
          <hr style="margin: 6px 0; border: none; border-top: 1px solid #e2e8f0;" />
          <span style="font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase;">Consulting Doctors:</span>
          <ul style="margin:2px 0 8px 0; padding-left:14px;">${docListHtml || '<li style="font-size:11px; color:#64748b;">General Consultation Desk</li>'}</ul>
          <div style="display:flex; gap:6px; margin-top:6px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" rel="noreferrer" style="flex:1; background:#0ea5e9; color:#fff; text-decoration:none; padding:5px 8px; border-radius:6px; font-size:11px; font-weight:700; text-align:center;">
              🗺️ Route
            </a>
          </div>
        </div>
      `

      const marker = L.marker([lat, lng]).addTo(map).bindPopup(popupHtml)
      marker.on('click', () => onSelectCenter(c.id))
      markersRef.current[c.id] = marker
    })

    // Pan map to selected center
    if (selectedCenter) {
      const sLat = Number(selectedCenter.latitude) || 6.9147
      const sLng = Number(selectedCenter.longitude) || 79.8732
      map.setView([sLat, sLng], 13, { animate: true })
      if (markersRef.current[selectedCenter.id]) {
        markersRef.current[selectedCenter.id].openPopup()
      }
    }
  }, [centers, doctors, selectedCenterId])

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Map Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {centers.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectCenter(c.id)}
              className="btn btn-sm"
              style={{
                background: selectedCenterId === c.id ? 'var(--blue)' : '#ffffff',
                color: selectedCenterId === c.id ? '#ffffff' : 'var(--text-2)',
                border: '1px solid var(--border-md)', fontSize: 11.5, gap: 5
              }}
            >
              <MapPin size={12} /> {c.name} ({c.city || 'Branch'})
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleLocateUser}
          disabled={geoLocating}
          className="btn btn-ghost btn-sm"
          style={{ gap: 5, fontSize: 11.5, color: 'var(--blue)', fontWeight: 700 }}
        >
          <Compass size={14} /> {geoLocating ? 'Locating GPS...' : '📍 My Location'}
        </button>
      </div>

      {geoError && (
        <div style={{ fontSize: 11, color: 'var(--crimson)', padding: '4px 8px', background: 'var(--crimson-dim)', borderRadius: 6 }}>
          {geoError}
        </div>
      )}

      {/* Live Leaflet Map Container */}
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-md)' }}>
        <div ref={mapContainerRef} style={{ height: 260, width: '100%', zIndex: 1 }} />

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
