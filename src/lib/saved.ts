import { useSyncExternalStore } from 'react'

// 찜 목록: 이 기기 브라우저에만 저장
const KEY = 'jigeum-seoul:saved'
const listeners = new Set<() => void>()
let ids: string[] = read()

function read(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function write(next: string[]) {
  ids = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* 저장 불가(사생활 보호 모드 등)면 이번 세션에서만 유지 */
  }
  listeners.forEach((l) => l())
}

export function toggleSaved(id: string) {
  write(ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids])
}

export function useSaved() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => ids,
  )
}
