import { useSyncExternalStore } from 'react'

// 찜 목록과 방문 예정일: 이 기기 브라우저에만 저장
export function createStore<T>(key: string, fallback: T, valid: (v: unknown) => v is T) {
  const listeners = new Set<() => void>()
  let value: T = fallback
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (valid(v)) value = v
  } catch {
    /* 저장소 접근 불가 */
  }
  return {
    get: () => value,
    set(next: T) {
      value = next
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* 저장 불가(사생활 보호 모드 등)면 이번 세션에서만 유지 */
      }
      listeners.forEach((l) => l())
    },
    subscribe(cb: () => void) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
  }
}

const savedStore = createStore<string[]>('jigeum-seoul:saved', [], (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string'))

/** 행사 id → 방문 예정일(YYYY-MM-DD) */
export type Plans = Record<string, string>
const planStore = createStore<Plans>(
  'jigeum-seoul:plans',
  {},
  (v): v is Plans => !!v && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every((d) => typeof d === 'string'),
)

export function toggleSaved(id: string) {
  const ids = savedStore.get()
  if (ids.includes(id)) {
    savedStore.set(ids.filter((x) => x !== id))
    setPlan(id, null) // 찜을 풀면 방문일도 같이 지움
  } else savedStore.set([id, ...ids])
}

/** 방문일 지정 (찜도 같이 됨). null 이면 해제 */
export function setPlan(id: string, date: string | null) {
  const { [id]: _, ...rest } = planStore.get()
  planStore.set(date ? { ...rest, [id]: date } : rest)
  if (date && !savedStore.get().includes(id)) savedStore.set([id, ...savedStore.get()])
}

export function useSaved() {
  return useSyncExternalStore(savedStore.subscribe, savedStore.get)
}

export function usePlans() {
  return useSyncExternalStore(planStore.subscribe, planStore.get)
}
