import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CaretRight, NavigationArrow } from '@phosphor-icons/react'
import type { CultureEvent } from '../types'
import { useEvents } from '../lib/data'
import { addDays, CULTURE_DAY_URL, daysBetween, formatLong, isPermanent, nextCultureDay, today } from '../lib/date'
import { eventDistance, requestLocation, useGeo } from '../lib/geo'
import { computeReminders } from '../lib/reminders'
import { usePlans, useSaved } from '../lib/saved'
import { CardSkeleton, EventCard } from '../components/EventCard'
import { HeroSlides } from '../components/HeroSlides'
import { ErrorState } from '../components/States'

const RAIL_MAX = 12

/** 포스터·예매 링크가 있는 것부터 */
const rank = (e: CultureEvent) => (e.poster ? 0 : 2) + (e.booking.length ? 0 : 1)
const byQuality = (a: CultureEvent, b: CultureEvent) => rank(a) - rank(b)

export default function Home() {
  const data = useEvents()
  const geo = useGeo()
  const saved = useSaved()
  const plans = usePlans()
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
    // 대표 슬라이드: 새로 시작한 전시 → 다른 분야 → 곧 개막 순으로 포스터 있는 것 5개
    const leads = [...started.filter((e) => e.category === '전시'), ...started.filter((e) => e.category !== '전시'), ...soon]
      .filter((e, i, arr) => e.poster && arr.indexOf(e) === i)
      .slice(0, 5)
    const now = all.filter((e) => e.start <= t)
    return {
      leads,
      counts: { exhibitions: now.filter((e) => e.category === '전시').length, shows: now.filter((e) => e.category !== '전시').length },
      rails: [
        { title: '새로 시작했어요', to: '/browse?when=new', items: started.filter((e) => !leads.includes(e)) },
        { title: '곧 개막해요', to: '/browse?when=soon', items: soon, wide: true },
        { title: '새로 올라왔어요', to: '/browse?when=registered', items: registered },
        { title: '이번 주에 끝나요', to: '/browse?when=ending', items: ending },
        { title: '무료로 볼 수 있어요', to: '/browse?free=1', items: free },
      ].filter((r) => r.items.length > 0),
    }
  }, [data, t])

  // 내 주변: 지금 볼 수 있는 것 중 3km 안, 가까운 순
  const nearby = useMemo(() => {
    if (data.status !== 'ready' || geo.status !== 'ok') return []
    return data.file.events
      .filter((e) => e.start <= t && e.end >= t)
      .map((e) => ({ e, km: eventDistance(geo, e) }))
      .filter((x): x is { e: CultureEvent; km: number } => x.km !== undefined && x.km <= 3)
      .sort((a, b) => a.km - b.km)
  }, [data, geo, t])

  const reminders = useMemo(() => {
    if (data.status !== 'ready') return []
    const mine = saved.map((id) => data.byId.get(id)).filter((e): e is CultureEvent => !!e)
    return computeReminders(mine, plans, t)
  }, [data, saved, plans, t])

  const cultureDay = nextCultureDay(t)

  return (
    <div className="page">
      <header className="masthead">
        <div className="wordmark">
          지금 서울<i>.</i>
        </div>
        <time dateTime={t}>{formatLong(t)}</time>
      </header>

      {reminders.length > 0 && (
        <ul className="reminders" aria-label="알림">
          {reminders.slice(0, 3).map((r) => (
            <li key={r.key}>
              <Link to={`/e/${r.event.id}`}>
                <b>{r.title}</b>
                <span>{r.event.title}</span>
                <CaretRight size={14} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data.status === 'error' && <ErrorState onRetry={data.retry} />}

      {data.status === 'loading' && (
        <div className="lead" aria-busy>
          <div className="poster loading" style={{ aspectRatio: '4 / 5' }} />
          <div className="skeleton-line" />
          <div className="skeleton-line short" />
        </div>
      )}

      {sections && sections.leads.length > 0 && <HeroSlides events={sections.leads} />}

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

      {data.status === 'ready' && (
        <a className="culture-day" href={CULTURE_DAY_URL} target="_blank" rel="noopener noreferrer">
          <div>
            <b>{cultureDay === t ? '오늘은 문화가 있는 날' : `${Number(cultureDay.slice(5, 7))}.${Number(cultureDay.slice(8))} 수요일은 문화가 있는 날`}</b>
            <span>매주 수요일, 국공립 미술관·박물관 무료·할인과 연장 개방, 공연 할인</span>
          </div>
          <span className="culture-day-link">
            참여 시설
            <ArrowUpRight size={14} />
          </span>
        </a>
      )}

      {data.status === 'ready' &&
        (geo.status === 'ok' ? (
          nearby.length > 0 && (
            <section className="section">
              <div className="section-head">
                <h2>내 주변에서 지금</h2>
                <Link to="/browse?when=now&sort=near">
                  전체
                  <CaretRight size={12} weight="bold" />
                </Link>
              </div>
              <div className="rail">
                {nearby.slice(0, RAIL_MAX).map(({ e, km }) => (
                  <EventCard key={e.id} event={e} distance={km} />
                ))}
              </div>
            </section>
          )
        ) : (
          <button className="near-prompt" onClick={requestLocation} disabled={geo.status === 'asking'}>
            <NavigationArrow size={18} />
            <span>
              <b>{geo.status === 'asking' ? '위치 확인 중' : geo.status === 'denied' ? '위치 권한이 꺼져 있어요' : '내 주변 전시·공연 보기'}</b>
              <small>{geo.status === 'denied' ? '브라우저 설정에서 위치 접근을 허용해 주세요.' : '지금 있는 곳에서 가까운 순으로 보여드려요.'}</small>
            </span>
          </button>
        ))}

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
