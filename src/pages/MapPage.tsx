import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CATEGORIES, type Category, type CultureEvent } from '../types'
import { useEvents } from '../lib/data'
import { addDays, formatRange, today } from '../lib/date'
import { CategoryLine } from '../components/EventCard'
import { Link } from 'react-router-dom'
import { Poster } from '../components/Poster'
import { Sheet } from '../components/Sheet'
import { ErrorState } from '../components/States'
import { TILE_ATTR, TILE_URL } from './Detail'

interface Venue {
  key: string
  name: string
  lat: number
  lng: number
  events: CultureEvent[]
}

export default function MapPage() {
  const data = useEvents()
  const [cat, setCat] = useState<Category | ''>('')
  const [pick, setPick] = useState<Venue | null>(null)
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  // 오늘부터 일주일 안에 볼 수 있는 행사를 장소별로 묶음
  const venues = useMemo(() => {
    if (data.status !== 'ready') return []
    const t = today()
    const groups = new Map<string, Venue>()
    for (const e of data.file.events) {
      if (!e.lat || !e.lng || e.end < t || e.start > addDays(t, 7) || (cat && e.category !== cat)) continue
      const key = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`
      const v = groups.get(key) ?? { key, name: e.venue, lat: e.lat, lng: e.lng, events: [] }
      v.events.push(e)
      groups.set(key, v)
    }
    return [...groups.values()]
  }, [data, cat])

  useEffect(() => {
    if (!el.current || map.current) return
    map.current = L.map(el.current, { center: [37.5530, 126.9870], zoom: 12, zoomControl: false, attributionControl: true })
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map.current)
    layer.current = L.layerGroup().addTo(map.current)
    // 멀리서 볼 땐 숫자 없는 작은 점으로
    const m = map.current
    const syncZoom = () => el.current?.classList.toggle('far', m.getZoom() < 14)
    m.on('zoomend', syncZoom)
    syncZoom()
    // 위치 권한이 이미 있으면 내 주변으로
    navigator.permissions?.query({ name: 'geolocation' }).then((p) => {
      if (p.state === 'granted') navigator.geolocation.getCurrentPosition((pos) => map.current?.setView([pos.coords.latitude, pos.coords.longitude], 14))
    })
    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const g = layer.current
    if (!g) return
    g.clearLayers()
    for (const v of venues) {
      const n = v.events.length
      const selected = pick?.key === v.key
      const size = n > 1 ? 22 : 12
      L.marker([v.lat, v.lng], {
        icon: L.divIcon({ className: '', html: `<div class="pin ${n > 1 ? 'many' : ''} ${selected ? 'selected' : ''}">${n > 1 ? n : ''}</div>`, iconSize: [size, size] }),
        title: v.name,
        keyboard: true,
      })
        .on('click', () => setPick(v))
        .addTo(g)
    }
  }, [venues, pick])

  return (
    <div className="map-page">
      <div ref={el} className="map" />
      <div className="map-overlay">
        <div className="chips" role="group" aria-label="분야">
          <button className="chip" aria-pressed={!cat} onClick={() => setCat('')}>
            전체
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} className="chip" aria-pressed={cat === c} onClick={() => setCat(cat === c ? '' : c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
      {data.status === 'error' && (
        <div className="map-overlay" style={{ top: 60, pointerEvents: 'auto', background: 'var(--bg)' }}>
          <ErrorState onRetry={data.retry} />
        </div>
      )}

      {pick && (
        <Sheet onClose={() => setPick(null)} label={pick.name}>
          <h2>{pick.name}</h2>
          <p className="sub">이번 주에 볼 수 있는 {pick.events.length}개</p>
          <div className="venue-list">
            {pick.events.map((e) => (
              <Link key={e.id} to={`/e/${e.id}`} className="venue-item card">
                <Poster event={e} />
                <div>
                  <CategoryLine event={e} />
                  <h3>{e.title}</h3>
                  <div className="meta num">{formatRange(e.start, e.end)}</div>
                </div>
              </Link>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  )
}
