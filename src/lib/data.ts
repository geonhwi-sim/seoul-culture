import { useEffect, useState } from 'react'
import type { CultureEvent, EventsFile } from '../types'

type State = { status: 'loading' } | { status: 'error'; error: string } | { status: 'ready'; file: EventsFile; byId: Map<string, CultureEvent> }

let cache: Promise<EventsFile> | undefined

function load() {
  cache ??= fetch('./events.json', { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status)
    return r.json() as Promise<EventsFile>
  })
  cache.catch(() => (cache = undefined))
  return cache
}

/** events.json 을 한 번만 불러와 모든 화면이 같이 씀 */
export function useEvents(): State & { retry: () => void } {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let alive = true
    load().then(
      (file) => alive && setState({ status: 'ready', file, byId: new Map(file.events.map((e) => [e.id, e])) }),
      (e) => alive && setState({ status: 'error', error: String(e) }),
    )
    return () => {
      alive = false
    }
  }, [attempt])
  return { ...state, retry: () => setAttempt((n) => n + 1) }
}
