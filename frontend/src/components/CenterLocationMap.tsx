import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/** Patient-facing map with a fixed marker at the center's saved location. */
export default function CenterLocationMap({ latitude, longitude, name }: {
  latitude: number
  longitude: number
  name: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const map = L.map(containerRef.current, {
      center: [latitude, longitude], zoom: 15, scrollWheelZoom: false,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)
    const label = document.createElement('span')
    label.textContent = name
    L.circleMarker([latitude, longitude], {
      radius: 9, color: '#fff', weight: 3, fillColor: '#0d9488', fillOpacity: 1,
    }).addTo(map).bindTooltip(label, { permanent: true, direction: 'top' })
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(containerRef.current)
    return () => { observer.disconnect(); map.remove() }
  }, [latitude, longitude, name])

  return <div ref={containerRef} aria-label={`Map showing ${name}`} style={{ height: 160, width: '100%', borderRadius: 10, overflow: 'hidden', zIndex: 0 }} />
}
