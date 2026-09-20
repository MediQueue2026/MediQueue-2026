import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LocateFixed } from 'lucide-react'

/** Draggable-pin OpenStreetMap picker — click or drag to set a lat/lng. */
export default function LocationPickerMap({
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
