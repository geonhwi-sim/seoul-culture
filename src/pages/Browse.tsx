import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, MagnifyingGlass, NavigationArrow, X } from '@phosphor-icons/react'
import { eventDistance, requestLocation, useGeo } from '../lib/geo'
import { CATEGORIES, type CultureEvent } from '../types'
import { useEvents } from '../lib/data'
import { addDays, daysBetween, overlaps, today, weekend } from '../lib/date'
import { EventCard } from '../components/EventCard'
import { ErrorState, LoadingGrid } from '../components/States'

const WHEN = [
  ['all', '전체'],
  ['now', '진행 중'],
  ['weekend', '이번 주말'],
  ['soon', '개막 예정'],
] as const
// 홈에서 '전체' 눌러 들어오는 묶음 (탭에는 안 보임)
const HOME_WHEN: Record<string, string> = { new: '새로 시작', registered: '새로 올라옴', ending: '이번 주 종료' }

const PAGE = 24

function matchWhen(e: CultureEvent, when: string, t: string) {
  switch (when) {
    case 'now':
      return e.start <= t
    case 'weekend': {
      const [sat, sun] = weekend(t)
      return overlaps(e, sat, sun)
    }
    case 'soon':
      return e.start > t
    case 'new':
      return e.start <= t && e.start >= addDays(t, -7)
    case 'registered':
      return daysBetween(e.firstSeenAt, t) <= 7
    case 'ending':
      return e.start < t && e.end <= addDays(t, 7)
    default:
      return true
  }
}

function sortFor(when: string) {
  if (when === 'soon') return (a: CultureEvent, b: CultureEvent) => a.start.localeCompare(b.start)
  if (when === 'ending') return (a: CultureEvent, b: CultureEvent) => a.end.localeCompare(b.end)
  if (when === 'registered') return (a: CultureEvent, b: CultureEvent) => b.firstSeenAt.localeCompare(a.firstSeenAt)
  // 기본: 진행 중인 것은 최근 개막순, 그다음 개막 예정은 가까운 순
  const t = today()
  return (a: CultureEvent, b: CultureEvent) => {
    const ao = a.start <= t
    const bo = b.start <= t
    if (ao !== bo) return ao ? -1 : 1
    return ao ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start)
  }
}

export default function Browse() {
  const data = useEvents()
  const [params, setParams] = useSearchParams()
  const cat = params.get('cat') ?? ''
  const when = params.get('when') ?? 'all'
  const free = params.get('free') === '1'
  const area = params.get('area') ?? ''
  const near = params.get('sort') === 'near'
  const geo = useGeo()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const q = useDeferredValue(query.trim().toLowerCase())
  const [limit, setLimit] = useState(PAGE)
  const sentinel = useRef<HTMLDivElement>(null)

  const set = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const areas = useMemo(
    () => (data.status === 'ready' ? [...new Set(data.file.events.map((e) => e.area).filter((a): a is string => !!a))].sort((a, b) => a.localeCompare(b, 'ko')) : []),
    [data],
  )

  const results = useMemo(() => {
    if (data.status !== 'ready') return []
    const t = today()
    return data.file.events
      .filter(
        (e) =>
          e.end >= t &&
          (!cat || e.category === cat) &&
          (!free || e.isFree) &&
          (!area || e.area === area) &&
          matchWhen(e, when, t) &&
          (!q || `${e.title} ${e.venue} ${e.cast ?? ''}`.toLowerCase().includes(q)),
      )
      .sort(sortFor(when))
      .map((e) => ({ e, km: near ? eventDistance(geo, e) : undefined }))
      // 가까운 순: 좌표 없는 행사는 맨 뒤
      .sort((a, b) => (near ? (a.km ?? Infinity) - (b.km ?? Infinity) : 0))
  }, [data, cat, free, area, when, q, near, geo])

  // 가까운 순을 켰는데 아직 위치를 모르면 물어봄
  useEffect(() => {
    if (near && geo.status === 'idle') requestLocation()
  }, [near, geo.status])

  useEffect(() => {
    setLimit(PAGE)
  }, [cat, free, area, when, q, near])

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && setLimit((n) => n + PAGE), { rootMargin: '800px' })
    io.observe(el)
    return () => io.disconnect()
  }, [results])

  return (
    <div className="page">
      <div className="browse-top">
        <label className="search">
          <MagnifyingGlass size={18} color="var(--muted)" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => set('q', query.trim() || null)}
            placeholder="제목, 장소, 출연자 검색"
            aria-label="검색"
            enterKeyHint="search"
          />
          {query && (
            <button
              aria-label="검색어 지우기"
              onClick={() => {
                setQuery('')
                set('q', null)
              }}
            >
              <X size={16} color="var(--muted)" />
            </button>
          )}
        </label>

        <div className="chips" role="group" aria-label="분야">
          <button className="chip" aria-pressed={!cat} onClick={() => set('cat', null)}>
            전체
          </button>
          {CATEGORIES.map((c) => (
            <button key={c} className="chip" aria-pressed={cat === c} onClick={() => set('cat', cat === c ? null : c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="filters">
          <div className="seg" role="group" aria-label="기간">
            {WHEN.map(([k, label]) => (
              <button key={k} aria-pressed={when === k} onClick={() => set('when', k === 'all' ? null : k)}>
                {label}
              </button>
            ))}
            {HOME_WHEN[when] && (
              <button aria-pressed onClick={() => set('when', null)}>
                {HOME_WHEN[when]}
              </button>
            )}
          </div>
          <span className="divider" />
          <button className="toggle" aria-pressed={free} onClick={() => set('free', free ? null : '1')}>
            <span className="box">{free && <Check size={10} weight="bold" />}</span>
            무료
          </button>
          <span className="divider" />
          <select className="select" value={area} onChange={(e) => set('area', e.target.value || null)} aria-label="지역">
            <option value="">서울 전체</option>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
      </div>

      {data.status === 'loading' && <LoadingGrid />}
      {data.status === 'error' && <ErrorState onRetry={data.retry} />}

      {data.status === 'ready' && (
        <>
          <div className="result-count num">
            <span>{results.length.toLocaleString()}개</span>
            <button className="sort-btn" aria-pressed={near} onClick={() => set('sort', near ? null : 'near')}>
              <NavigationArrow size={14} weight={near ? 'fill' : 'regular'} />
              {near && geo.status === 'asking' ? '위치 확인 중' : near && geo.status === 'denied' ? '위치 권한 필요' : '가까운 순'}
            </button>
          </div>
          {results.length === 0 ? (
            <div className="empty">
              <h2>조건에 맞는 행사가 없어요</h2>
              <p>기간이나 분야를 넓혀서 다시 찾아보세요.</p>
              <button className="ghost-btn" onClick={() => (setQuery(''), setParams(new URLSearchParams(), { replace: true }))}>
                필터 모두 지우기
              </button>
            </div>
          ) : (
            <div className="grid">
              {results.slice(0, limit).map(({ e, km }, i) => (
                <EventCard key={e.id} event={e} eager={i < 4} distance={km} />
              ))}
            </div>
          )}
          {limit < results.length && <div ref={sentinel} className="sentinel" />}
        </>
      )}
    </div>
  )
}
