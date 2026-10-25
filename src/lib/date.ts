import type { CultureEvent } from '../types'

const pad = (n: number) => String(n).padStart(2, '0')
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}

export const today = () => isoDate(new Date())

function short(iso: string, withYear: boolean) {
  const [y, m, d] = iso.split('-')
  return withYear ? `${y}.${m}.${d}` : `${m}.${d}`
}

export function weekday(iso: string) {
  return WEEK[new Date(iso + 'T00:00:00').getDay()]
}

// 문화가 있는 날: 2026.4.1부터 매주 수요일 (그전엔 매달 마지막 수요일)
export const CULTURE_DAY_URL = 'https://www.culture.go.kr/local/wday/mnthCltrLctnYList.do'
export const isCultureDay = (iso: string) => iso >= '2026-04-01' && new Date(iso + 'T00:00:00').getDay() === 3

/** 오늘 포함 가장 가까운 문화가 있는 날 */
export function nextCultureDay(t = today()) {
  const day = new Date(t + 'T00:00:00').getDay()
  return addDays(t, (3 - day + 7) % 7)
}

/** 국공립·공공 문화시설로 보이는 장소 (문화가 있는 날 참여가 많음) */
export const isPublicVenue = (venue: string) => /국립|시립|구립|도립|공립|세종문화회관|예술의전당|문화재단|아트센터|문화회관|구민회관|박물관|도서관/.test(venue)

/** 상설 전시·오픈런: 종료일이 2년 넘게 남은 것 (오래 했어도 끝날 날이 가까우면 상설 아님) */
export const isPermanent = (e: { start: string; end: string }) => daysBetween(today(), e.end) > 365 * 2

/** '10.25 - 11.30', 하루짜리는 '12.24 목', 상설은 '2023.06.15 - 상시' */
export function formatRange(start: string, end: string) {
  const year = today().slice(0, 4)
  if (isPermanent({ start, end })) return `${short(start, start.slice(0, 4) !== year)} - 상시`
  const withYear = start.slice(0, 4) !== year || end.slice(0, 4) !== year
  if (start === end) return `${short(start, withYear)} ${weekday(start)}`
  return `${short(start, withYear)} - ${short(end, withYear)}`
}

export function formatLong(iso: string) {
  const [, m, d] = iso.split('-').map(Number)
  return `${m}월 ${d}일 ${weekday(iso)}요일`
}

/** 이번 주말 (토·일). 일요일이면 오늘 하루 */
export function weekend(t = today()) {
  const day = new Date(t + 'T00:00:00').getDay()
  const sat = day === 0 ? addDays(t, -1) : addDays(t, 6 - day)
  return [day === 0 ? t : sat, addDays(sat, 1)] as const
}

export const overlaps = (e: CultureEvent, from: string, to: string) => e.start <= to && e.end >= from

/** 카드에 붙는 짧은 상태 문구 하나 (가장 급한 것) */
export function statusLabel(e: CultureEvent, t = today()): { text: string; hot?: boolean } | undefined {
  if (e.start > t) {
    const d = daysBetween(t, e.start)
    return { text: d === 1 ? '내일 개막' : d <= 14 ? `개막 D-${d}` : `${short(e.start, false)} 개막` }
  }
  if (e.start === t && e.end !== t) return { text: '오늘 개막', hot: true }
  const left = daysBetween(t, e.end)
  if (left < 0) return { text: '종료' }
  if (left === 0) return { text: '오늘 마지막', hot: true }
  if (left <= 7) return { text: `종료 D-${left}`, hot: true }
  if (daysBetween(e.firstSeenAt, t) <= 3) return { text: 'NEW', hot: true }
  if (daysBetween(e.start, t) <= 7) return { text: '새로 시작' }
  return undefined
}
