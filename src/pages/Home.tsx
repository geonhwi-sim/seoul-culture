import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CaretRight } from '@phosphor-icons/react'
import type { CultureEvent } from '../types'
import { useEvents } from '../lib/data'
import { addDays, daysBetween, formatLong, formatRange, isPermanent, today } from '../lib/date'
import { CardSkeleton, CategoryLine, EventCard } from '../components/EventCard'
import { Poster } from '../components/Poster'
import { ErrorState } from '../components/States'

const RAIL_MAX = 12

/** 포스터·예매 링크가 있는 것부터 */
const rank = (e: CultureEvent) => (e.poster ? 0 : 2) + (e.booking.length ? 0 : 1)
const byQuality = (a: CultureEvent, b: CultureEvent) => rank(a) - rank(b)

export default function Home() {
  const data = useEvents()
  const t = today()

  const sections = useMemo(() => {
    if (data.status !== 'ready') return undefined
    const all = data.file.events.filter((e) => e.end >= t)
    const started = all.filter((e) => e.start <= t && e.start >= addDays(t, -7)).sort((a, b) => b.start.localeCompare(a.start)).sort(byQuality)
    const soon = all.filter((e) => e.start > t && e.start <= addDays(t, 14)).sort((a, b) => a.start.localeCompare(b.start)).sort(byQuality)
    const registered = all.filter((e) => daysBetween(e.firstSeenAt, t) <= 7).sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt)).sort(byQuality)
    const ending = all.filter((e) => e.start < t && e.end <= addDays(t, 7) && daysBetween(e.start, e.end) >= 7).sort((a, b) => a.end.localeCompare(b.end)).sort(byQuality)
    // 상설 전시는 뒤로: 기간이 짧은(놓치기 쉬운) 것부터
    const free = all
      .filter((e) => e.isFree && e.start <= addDays(t, 7))
      .sort((a, b) => a.end.localeCompare(b.end))
      .sort((a, b) => Number(isPermanent(a)) - Number(isPermanent(b)) || byQuality(a, b))
    const lead = started.find((e) => e.category === '전시' && e.poster) ?? started.find((e) => e.poster) ?? soon.find((e) => e.poster)
    const now = all.filter((e) => e.start <= t)
    return {
      lead,
      counts: { exhibitions: now.filter((e) => e.category === '전시').length, shows: now.filter((e) => e.category !== '전시').length },
      rails: [
        { title: '새로 시작했어요', to: '/browse?when=new', items: started.filter((e) => e !== lead) },
        { title: '곧 개막해요', to: '/browse?when=soon', items: soon, wide: true },
        { title: '새로 올라왔어요', to: '/browse?when=registered', items: registered },
        { title: '이번 주에 끝나요', to: '/browse?when=ending', items: ending },
        { title: '무료로 볼 수 있어요', to: '/browse?free=1', items: free },
      ].filter((r) => r.items.length > 0),
    }
  }, [data, t])

  return (
    <div className="page">
      <header className="masthead">
        <div className="wordmark">
          지금 서울<i>.</i>
        </div>
        <time dateTime={t}>{formatLong(t)}</time>
      </header>

      {data.status === 'error' && <ErrorState onRetry={data.retry} />}

      {data.status === 'loading' && (
        <div className="lead" aria-busy>
          <div className="poster loading" style={{ aspectRatio: '4 / 5' }} />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      )}

      {sections?.lead && (
        <Link to={`/e/${sections.lead.id}`} className="lead card">
          <Poster event={sections.lead} eager />
          <div>
            <CategoryLine event={sections.lead} />
            <h2>{sections.lead.title}</h2>
            <div className="meta">
              <span>{sections.lead.venue}</span>
              <span className="num">{formatRange(sections.lead.start, sections.lead.end)}</span>
            </div>
          </div>
        </Link>
      )}

      {sections && (
        <div className="summary-line num">
          <span>오늘 열리는</span>
          <span>
            전시 <b>{sections.counts.exhibitions.toLocaleString()}</b>
          </span>
          <span>
            공연 <b>{sections.counts.shows.toLocaleString()}</b>
          </span>
        </div>
      )}

      {data.status === 'loading' && (
        <section className="section">
          <div className="rail">
            {[0, 1, 2].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </section>
      )}

      {sections?.rails.map((r) => (
        <section className="section" key={r.title}>
          <div className="section-head">
            <h2>{r.title}</h2>
            <Link to={r.to}>
              전체 {r.items.length}
              <CaretRight size={12} weight="bold" />
            </Link>
          </div>
          <div className={`rail ${r.wide ? 'wide' : ''}`}>
            {r.items.slice(0, RAIL_MAX).map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      ))}

      {data.status === 'ready' && (
        <p className="footer-note">
          KOPIS 공연예술통합전산망, 서울시 문화행사 정보 제공 · {new Date(data.file.updatedAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })} 업데이트
        </p>
      )}
    </div>
  )
}
