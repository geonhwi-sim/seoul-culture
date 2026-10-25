import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUpRight, CalendarBlank, CalendarPlus, Export, Heart, NavigationArrow, Ticket, X } from '@phosphor-icons/react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { BookingLink, CultureEvent } from '../types'
import { useEvents } from '../lib/data'
import { CULTURE_DAY_URL, formatLong, formatRange, isPermanent, isPublicVenue, nextCultureDay, today, weekday } from '../lib/date'
import { eventDistance, formatKm, useGeo } from '../lib/geo'
import { downloadIcs } from '../lib/ics'
import { directionLinks, hostOf, searchLinks } from '../lib/links'
import { setPlan, toggleSaved, usePlans, useSaved } from '../lib/saved'
import { CategoryLine } from '../components/EventCard'
import { Poster } from '../components/Poster'
import { Sheet } from '../components/Sheet'
import { ErrorState } from '../components/States'

const SOURCE_NAME = { kopis: 'KOPIS 공연예술통합전산망', seoul: '서울시 문화행사 정보', kcisa: '한국문화정보원' }

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

function MiniMap({ lat, lng }: { lat: number; lng: number }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const map = L.map(ref.current, { center: [lat, lng], zoom: 16, dragging: false, scrollWheelZoom: false, touchZoom: false, doubleClickZoom: false, keyboard: false, zoomControl: false })
    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, maxZoom: 19 }).addTo(map)
    L.marker([lat, lng], { icon: L.divIcon({ className: '', html: '<div class="pin selected"></div>', iconSize: [12, 12] }), interactive: false }).addTo(map)
    return () => {
      map.remove()
    }
  }, [lat, lng])
  return <div ref={ref} className="mini-map" aria-label="공연장 위치 지도" />
}

function LinkList({ links, sub }: { links: BookingLink[]; sub?: (l: BookingLink) => string }) {
  return (
    <ul className="sheet-list">
      {links.map((l) => (
        <li key={l.url}>
          <a href={l.url} target="_blank" rel="noopener noreferrer">
            <span>
              {l.name}
              {sub && <small>{sub(l)}</small>}
            </span>
            <ArrowUpRight size={18} />
          </a>
        </li>
      ))}
    </ul>
  )
}

const BOOKING_SHOWN = 6

function BookingSheet({ event, onClose }: { event: CultureEvent; onClose: () => void }) {
  const [all, setAll] = useState(false)
  const official = event.officialUrl ? [{ name: '공식 안내 페이지', url: event.officialUrl }] : []
  const hidden = event.booking.length - BOOKING_SHOWN
  return (
    <Sheet onClose={onClose} label="예매">
      <h2>{event.booking.length ? '어디서 예매할까요' : '예매 정보 찾기'}</h2>
      <p className="sub">{event.booking.length ? '예매처마다 좌석과 할인이 다를 수 있어요.' : '등록된 예매 링크가 없어요. 공식 페이지나 검색으로 확인해 보세요.'}</p>
      {event.booking.length > 0 && <LinkList links={all ? event.booking : event.booking.slice(0, BOOKING_SHOWN)} sub={(l) => hostOf(l.url)} />}
      {!all && hidden > 0 && (
        <button className="text-btn" onClick={() => setAll(true)}>
          예매처 {hidden}곳 더 보기
        </button>
      )}
      <div className="sheet-group">다른 방법</div>
      <LinkList links={[...official, ...searchLinks(event)]} />
    </Sheet>
  )
}

function Facts({ e }: { e: CultureEvent }) {
  const geo = useGeo()
  const km = eventDistance(geo, e)
  const t = today()
  // 국공립 시설이고 기간 안에 수요일이 있으면 문화가 있는 날 안내
  const wed = isPublicVenue(e.venue) && e.end >= t ? nextCultureDay(e.start > t ? e.start : t) : undefined
  const rows: [string, React.ReactNode][] = [
    [
      '기간',
      <span className="num">
        {e.start === e.end ? `${formatRange(e.start, e.end)}요일` : isPermanent(e) ? formatRange(e.start, e.end) : `${formatRange(e.start, e.end)} (${weekday(e.start)} - ${weekday(e.end)})`}
      </span>,
    ],
    ['시간', e.time],
    ['장소', [e.venue, e.area && e.area !== e.venue ? e.area : '', km !== undefined ? `여기서 ${formatKm(km)}` : ''].filter(Boolean).join(', ')],
    ['관람료', e.price],
    [
      '수요일',
      wed && wed <= e.end && (
        <span>
          문화가 있는 날이라 할인·무료·연장 개방이 있을 수 있어요.{' '}
          <a href={CULTURE_DAY_URL} target="_blank" rel="noopener noreferrer">
            참여 여부 확인
          </a>
        </span>
      ),
    ],
    ['관람 연령', e.age],
    ['러닝타임', e.runtime],
    ['출연', e.cast],
  ]
  return (
    <dl className="facts">
      {rows
        .filter(([, v]) => v)
        .map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
    </dl>
  )
}

export default function Detail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const data = useEvents()
  const saved = useSaved()
  const plans = usePlans()
  const [sheet, setSheet] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))

  if (data.status === 'error') return <ErrorState onRetry={data.retry} />
  if (data.status === 'loading')
    return (
      <div className="page">
        <div className="detail-bar" />
        <div className="detail-poster poster loading" />
      </div>
    )

  const e = data.byId.get(id)
  if (!e)
    return (
      <div className="page">
        <div className="empty">
          <h2>끝났거나 사라진 행사예요</h2>
          <p>목록이 매일 새로 갱신돼서, 종료된 행사는 빠져요.</p>
          <button className="ghost-btn" onClick={() => navigate('/browse')}>
            다른 행사 보기
          </button>
        </div>
      </div>
    )

  const isSaved = saved.includes(e.id)
  const plan = plans[e.id]
  const t = today()
  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: e.title, text: `${e.title} · ${e.venue}`, url })
      else await navigator.clipboard.writeText(url)
    } catch {
      /* 공유 취소 */
    }
  }
  const single = e.booking.length === 1 ? e.booking[0] : undefined
  const longText = (e.summary?.length ?? 0) > 220

  return (
    <div className="page">
      <div className="detail-bar">
        <button className="icon-btn" onClick={back} aria-label="뒤로">
          <ArrowLeft size={22} />
        </button>
        <button className="icon-btn" onClick={share} aria-label="공유">
          <Export size={21} />
        </button>
      </div>

      <Poster event={e} className="detail-poster" eager natural />

      <div className="detail-head">
        <CategoryLine event={e} />
        <h1>{e.title}</h1>
      </div>

      <Facts e={e} />

      {e.program && e.program.length > 0 && (
        <section className="block">
          <h2>회차 {e.program.length}개</h2>
          <ol className="upcoming program">
            {e.program.map((p) => (
              <li key={p.date + p.title} className={p.date < t ? 'past' : ''}>
                <span className="num">
                  {Number(p.date.slice(5, 7))}.{Number(p.date.slice(8))}
                  <small>{weekday(p.date)}</small>
                </span>
                <div>
                  <strong>{p.title}</strong>
                  {p.time && <span>{p.time}</span>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {e.end >= t && (
        <section className="block">
          <h2>언제 갈까요</h2>
          <div className="visit">
            <label className={`date-field ${plan ? 'set' : ''}`}>
              <CalendarBlank size={18} />
              {plan ? `${formatLong(plan).replace('요일', '')} 방문` : '방문일 정하기'}
              <input
                type="date"
                aria-label="방문일"
                min={e.start > t ? e.start : t}
                max={e.end}
                value={plan ?? ''}
                onChange={(ev) => setPlan(e.id, ev.target.value || null)}
                // PC 크롬은 달력 아이콘 자리만 눌러야 열려서, 어디를 눌러도 날짜 선택창을 직접 엶
                onClick={(ev) => {
                  try {
                    ev.currentTarget.showPicker()
                  } catch {
                    /* showPicker 미지원 브라우저는 기본 동작 */
                  }
                }}
              />
            </label>
            {plan && (
              <>
                <button className="ghost-btn" onClick={() => downloadIcs([{ event: e, date: plan, kind: 'visit' }], `${e.title.slice(0, 30)}.ics`)}>
                  <CalendarPlus size={16} />
                  캘린더에 추가
                </button>
                <button className="ghost-btn" onClick={() => setPlan(e.id, null)} aria-label="방문일 지우기">
                  <X size={16} />
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {e.summary && (
        <section className="block">
          <h2>소개</h2>
          <div className={`prose ${longText && !expanded ? 'clamped' : ''}`}>{e.summary}</div>
          {longText && (
            <button className="text-btn" onClick={() => setExpanded((v) => !v)}>
              {expanded ? '접기' : '더 보기'}
            </button>
          )}
        </section>
      )}

      {e.images && e.images.length > 0 && (
        <section className="block">
          <h2>상세 이미지</h2>
          <div className="stills">
            {e.images.map((src) => (
              <img key={src} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ))}
          </div>
        </section>
      )}

      <section className="block">
        <h2>오시는 길</h2>
        {e.lat && e.lng && <MiniMap lat={e.lat} lng={e.lng} />}
        <div className="dir-links">
          {directionLinks(e).map((l) => (
            <a key={l.name} className="ghost-btn" href={l.url} target="_blank" rel="noopener noreferrer">
              <NavigationArrow size={15} />
              {l.name}
            </a>
          ))}
        </div>
      </section>

      <p className="source-note">
        정보 출처: {e.sources.map((s) => SOURCE_NAME[s]).join(', ')}. 일정과 가격은 예매처에서 한 번 더 확인해 주세요.
      </p>
      <div className="detail-spacer" />

      <div className="action-bar">
        <div>
          <button className="save-btn" aria-pressed={isSaved} aria-label={isSaved ? '찜 해제' : '찜하기'} onClick={() => toggleSaved(e.id)}>
            <Heart size={22} weight={isSaved ? 'fill' : 'regular'} />
          </button>
          {single ? (
            <a className="primary-btn" href={single.url} target="_blank" rel="noopener noreferrer">
              <Ticket size={20} />
              {single.name === '공식 안내' ? '예매 페이지 열기' : `${single.name}에서 예매`}
            </a>
          ) : (
            <button className={`primary-btn ${e.booking.length ? '' : 'quiet'}`} onClick={() => setSheet(true)}>
              <Ticket size={20} />
              {e.booking.length ? `예매처 ${e.booking.length}곳 보기` : '예매 정보 찾기'}
            </button>
          )}
        </div>
      </div>

      {sheet && <BookingSheet event={e} onClose={() => setSheet(false)} />}
    </div>
  )
}
