import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { CultureEvent } from '../types'
import { formatRange } from '../lib/date'
import { lastPosterId, markPoster, useReturnTarget } from '../lib/transition'
import { CategoryLine } from './EventCard'
import { Poster } from './Poster'

const DURATION = 5500
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** 홈 대표 포스터: 몇 초마다 천천히 넘어가는 슬라이드 (좌우로 밀어서 넘기기 가능) */
export function HeroSlides({ events }: { events: CultureEvent[] }) {
  // 상세에서 돌아왔으면 보던 포스터부터
  const [index, setIndex] = useState(() => Math.max(0, events.findIndex((e) => e.id === lastPosterId)))
  const activeRef = useReturnTarget<HTMLAnchorElement>(events[index]?.id ?? '')
  const [paused, setPaused] = useState(false)
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)
  const n = events.length
  const go = (d: number) => setIndex((i) => (i + d + n) % n)

  // 자동 넘김: 화면이 안 보이거나, 동작 줄이기 설정이면 멈춤
  useEffect(() => {
    if (n < 2 || paused || reduceMotion()) return
    const t = setTimeout(() => go(1), DURATION)
    return () => clearTimeout(t)
  }, [index, n, paused])

  useEffect(() => {
    const onVis = () => setPaused(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const e = events[index]
  if (!e) return null

  return (
    <section className="hero" aria-roledescription="carousel" aria-label="새로 시작한 행사">
      <div
        className="hero-stage"
        onPointerDown={(ev) => {
          start.current = { x: ev.clientX, y: ev.clientY }
          swiped.current = false
        }}
        onPointerUp={(ev) => {
          const s = start.current
          start.current = null
          if (!s) return
          const dx = ev.clientX - s.x
          if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(ev.clientY - s.y)) {
            swiped.current = true
            go(dx < 0 ? 1 : -1)
          }
        }}
      >
        {events.map((ev, i) => (
          <Link
            key={ev.id}
            ref={i === index ? activeRef : undefined}
            to={`/e/${ev.id}`}
            viewTransition
            className={`hero-slide ${i === index ? 'active' : ''}`}
            aria-hidden={i !== index}
            tabIndex={i === index ? 0 : -1}
            draggable={false}
            onClick={(click) => {
              // 밀어서 넘긴 동작은 클릭으로 보지 않음
              if (swiped.current) {
                click.preventDefault()
                swiped.current = false
                return
              }
              markPoster(click.currentTarget, ev.id)
            }}
          >
            <Poster event={ev} eager={i <= 1} />
          </Link>
        ))}
        {n > 1 && (
          <div className="hero-progress" aria-hidden>
            {events.map((ev, i) => (
              <span key={ev.id} className={i < index ? 'done' : i === index ? (paused ? 'now paused' : 'now') : ''}>
                <i key={i === index ? `${index}-${paused}` : undefined} style={{ animationDuration: `${DURATION}ms` }} />
              </span>
            ))}
          </div>
        )}
      </div>

      <Link to={`/e/${e.id}`} viewTransition className="hero-caption" key={e.id} onClick={(c) => markPoster(c.currentTarget.previousElementSibling?.querySelector('.hero-slide.active') ?? c.currentTarget, e.id)}>
        <CategoryLine event={e} />
        <h2>{e.title}</h2>
        <div className="meta">
          <span>{e.venue}</span>
          <span className="num">{formatRange(e.start, e.end)}</span>
        </div>
      </Link>
    </section>
  )
}
