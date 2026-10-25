import { useSyncExternalStore } from 'react'

// 내 위치: 사용자가 요청했을 때만 묻고, 이 화면을 쓰는 동안만 메모리에 둠
export type GeoState =
  | { status: 'idle' }
  | { status: 'asking' }
  | { status: 'ok'; lat: number; lng: number }
  | { status: 'denied' | 'error' }

let state: GeoState = { status: 'idle' }
const listeners = new Set<() => void>()
const set = (s: GeoState) => {
  state = s
  listeners.forEach((l) => l())
}

export function requestLocation() {
  if (!navigator.geolocation) return set({ status: 'error' })
  if (state.status === 'asking') return
  set({ status: 'asking' })
  navigator.geolocation.getCurrentPosition(
    (p) => set({ status: 'ok', lat: p.coords.latitude, lng: p.coords.longitude }),
    (e) => set({ status: e.code === e.PERMISSION_DENIED ? 'denied' : 'error' }),
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 },
  )
}

// 이미 허락한 사용자는 묻지 않고 바로 위치를 가져옴
navigator.permissions
  ?.query({ name: 'geolocation' })
  .then((p) => p.state === 'granted' && requestLocation())
  .catch(() => {})

export function useGeo() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

/** 두 좌표 사이 거리 (km) */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function formatKm(km: number) {
  return km < 1 ? `${Math.round(km * 1000 / 50) * 50}m` : `${km < 10 ? km.toFixed(1) : Math.round(km)}km`
}

/** 행사까지 거리 (좌표가 없으면 undefined) */
export function eventDistance(geo: GeoState, e: { lat?: number; lng?: number }) {
  return geo.status === 'ok' && e.lat && e.lng ? distanceKm(geo, { lat: e.lat, lng: e.lng }) : undefined
}
