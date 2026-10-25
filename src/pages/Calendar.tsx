import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, CaretLeft, CaretRight } from '@phosphor-icons/react'
import type { CultureEvent } from '../types'
import { useEvents } from '../lib/data'
import { addDays, formatLong, formatRange, isPermanent, isoDate, today } from '../lib/date'
import { downloadIcs } from '../lib/ics'
import { setPlan, usePlans, useSaved } from '../lib/saved'
import { CategoryLine } from '../components/EventCard'
import { Poster } from '../components/Poster'
import { ErrorState } from '../components/States'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** 해당 달을 덮는 일요일 시작 6주(또는 5주) 날짜들 */
function monthGrid(month: string) {
  const first = new Date(month + '-01T00:00:00')
  const start = addDays(isoDate(first), -first.getDay())
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
  const weeks = Math.ceil((first.getDay() + last.getDate()) / 7)
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i))
}

function shiftMonth(month: string, n: number) {
  const d = new Date(month + '-01T00:00:00')
  d.setMonth(d.getMonth() + n)
  return isoDate(d).slice(0, 7)
}

function Row({ e, action }: { e: CultureEvent; action?: React.ReactNode }) {
  return (
    <div className="plan-row">
      <Link to={`/e/${e.id}`} className="venue-item card">
        <Poster event={e} />
        <div>
          <CategoryLine event={e} />
          <h3>{e.title}</h3>
          <div className="meta">
            <span>{e.venue}</span>
            <span className="num">{formatRange(e.start, e.end)}</span>
          </div>
        </div>
      </Link>
      {action}
    </div>
  )
}

export default function Calendar() {
  const data = useEvents()
  const saved = useSaved()
  const plans = usePlans()
  const t = today()
  const [month, setMonth] = useState(t.slice(0, 7))
  const [day, setDay] = useState(t)

  const events = useMemo(() => (data.status === 'ready' ? saved.map((id) => data.byId.get(id)).filter((e): e is CultureEvent => !!e) : []), [data, saved])

  // 날짜별 표시: 방문 예정(주홍), 찜한 행사의 마지막 날(회색)
  const marks = useMemo(() => {
    const m = new Map<string, { plan: number; last: number }>()
    const bump = (d: string, k: 'plan' | 'last') => {
      const v = m.get(d) ?? { plan: 0, last: 0 }
      v[k]++
      m.set(d, v)
    }
    for (const e of events) {
      if (plans[e.id]) bump(plans[e.id], 'plan')
      if (!isPermanent(e)) bump(e.end, 'last')
    }
    return m
  }, [events, plans])

  const planned = events.filter((e) => plans[e.id] === day)
  const available = events.filter((e) => e.start <= day && e.end >= day && plans[e.id] !== day)
  const upcoming = events.filter((e) => plans[e.id] && plans[e.id] >= t).sort((a, b) => plans[a.id].localeCompare(plans[b.id]))

  const pickDay = (d: string) => {
    setDay(d)
    if (d.slice(0, 7) !== month) setMonth(d.slice(0, 7))
  }

  if (data.status === 'error') return <ErrorState onRetry={data.retry} />

  return (
    <div className="page">
      <div className="cal-head">
        <h1 className="page-title num">
          {Number(month.slice(5))}월<span className="cal-year">{month.slice(0, 4)}</span>
        </h1>
        <div className="cal-nav">
          {month !== t.slice(0, 7) && (
            <button className="text-btn" onClick={() => pickDay(t)}>
              오늘
            </button>
          )}
          <button className="icon-btn" aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))}>
            <CaretLeft size={20} />
          </button>
          <button className="icon-btn" aria-label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>
            <CaretRight size={20} />
          </button>
        </div>
      </div>

      <div className="cal" role="grid" aria-label={`${month} 달력`}>
        {WEEK.map((w, i) => (
          <div key={w} className={`cal-dow ${i === 0 ? 'sun' : ''}`}>
            {w}
          </div>
        ))}
        {monthGrid(month).map((d) => {
          const mk = marks.get(d)
          const cls = ['cal-day', d.slice(0, 7) !== month && 'out', d === t && 'today', d === day && 'selected', d < t && 'past', new Date(d + 'T00:00:00').getDay() === 0 && 'sun']
          return (
            <button key={d} className={cls.filter(Boolean).join(' ')} onClick={() => pickDay(d)} aria-pressed={d === day} aria-label={formatLong(d)}>
              <span className="num">{Number(d.slice(8))}</span>
              <span className="marks" aria-hidden>
                {mk?.plan ? <i className="plan" /> : null}
                {mk?.last ? <i className="last" /> : null}
              </span>
            </button>
          )
        })}
      </div>
      <div className="cal-legend">
        <span>
          <i className="plan" />
          방문 예정
        </span>
        <span>
          <i className="last" />
          찜한 행사 마지막 날
        </span>
      </div>

      {data.status === 'ready' && events.length === 0 ? (
        <div className="empty">
          <h2>찜한 행사가 없어요</h2>
          <p>보고 싶은 전시나 공연을 찜하거나 방문일을 정하면 달력에 표시돼요.</p>
          <Link className="ghost-btn" to="/browse">
            둘러보기
          </Link>
        </div>
      ) : (
        <>
          <section className="block">
            <h2>{formatLong(day)}</h2>
            {planned.length === 0 && available.length === 0 && <p className="meta">이날 볼 수 있는 찜한 행사가 없어요.</p>}
            <div className="plan-list">
              {planned.map((e) => (
                <Row
                  key={e.id}
                  e={e}
                  action={
                    <button className="plan-btn on" onClick={() => setPlan(e.id, null)}>
                      가는 날 취소
                    </button>
                  }
                />
              ))}
              {available.map((e) => (
                <Row
                  key={e.id}
                  e={e}
                  action={
                    day >= t && (
                      <button className="plan-btn" onClick={() => setPlan(e.id, day)}>
                        {plans[e.id] ? '이날로 옮기기' : '이날 가기'}
                      </button>
                    )
                  }
                />
              ))}
            </div>
          </section>

          {upcoming.length > 0 && (
            <section className="block">
              <div className="block-head">
                <h2>다가오는 방문</h2>
                <button className="text-btn" onClick={() => downloadIcs(upcoming.map((e) => ({ event: e, date: plans[e.id] })), '지금서울-방문일정.ics')}>
                  <CalendarPlus size={16} />
                  캘린더로 내보내기
                </button>
              </div>
              <ol className="upcoming">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <button className="num" onClick={() => pickDay(plans[e.id])}>
                      {Number(plans[e.id].slice(5, 7))}.{Number(plans[e.id].slice(8))}
                    </button>
                    <Link to={`/e/${e.id}`}>
                      <strong>{e.title}</strong>
                      <span>{e.venue}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <div className="footer-note" />
        </>
      )}
    </div>
  )
}
