import type { BookingLink, CultureEvent } from '../src/types.ts'

/** 수집 단계에서 쓰는 형태 — firstSeenAt 은 병합할 때 정함 */
export type RawEvent = Omit<CultureEvent, 'firstSeenAt'> & { registeredAt?: string }

const KST = 9 * 60 * 60 * 1000

/** 한국 시간 기준 날짜 YYYY-MM-DD (offsetDays 만큼 이동) */
export function kstDate(offsetDays = 0) {
  return new Date(Date.now() + KST + offsetDays * 86400000).toISOString().slice(0, 10)
}

/** '2026.10.01', '20261001', '2026-10-01 00:00:00.0' → '2026-10-01' */
export function toIsoDate(s: string | undefined) {
  const d = (s ?? '').replace(/\D/g, '').slice(0, 8)
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : ''
}

export function clean(s: unknown) {
  if (typeof s !== 'string' && typeof s !== 'number') return ''
  return String(s)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

export function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max).replace(/\s+\S*$/, '') + '…' : s
}

export function toHttps(url: string | undefined) {
  const u = clean(url)
  if (!/^https?:\/\//i.test(u)) return undefined
  return u.replace(/^http:\/\//i, 'https://')
}

/** 서울 범위 안의 좌표만 인정 (위경도가 뒤바뀐 데이터도 바로잡음) */
export function seoulCoords(a: unknown, b: unknown): { lat: number; lng: number } | undefined {
  const x = Number(a)
  const y = Number(b)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined
  const inSeoul = (lat: number, lng: number) => lat > 37.4 && lat < 37.72 && lng > 126.75 && lng < 127.2
  if (inSeoul(x, y)) return { lat: x, lng: y }
  if (inSeoul(y, x)) return { lat: y, lng: x }
  return undefined
}

const BOOKING_HOSTS: [RegExp, string][] = [
  [/interpark\.com|nol\.co\.kr|nol-universe/, 'NOL 인터파크'],
  [/yes24\.com/, '예스24 티켓'],
  [/melon\.com/, '멜론티켓'],
  [/ticketlink\.co\.kr/, '티켓링크'],
  [/naver\.(com|me)/, '네이버 예약'],
  [/sac\.or\.kr/, '예술의전당'],
  [/sejongpac\.or\.kr/, '세종문화회관'],
  [/lotteconcerthall|lotteartcenter/, '롯데콘서트홀'],
  [/mmca\.go\.kr/, '국립현대미술관'],
  [/sema\.seoul\.go\.kr/, '서울시립미술관'],
  [/ntok\.go\.kr/, '국립극장'],
  [/kocca|ticket\.11st|11st\.co\.kr/, '11번가 티켓'],
  [/coupang/, '쿠팡'],
  [/timeticket/, '타임티켓'],
  [/kakao/, '카카오'],
]

export function bookingName(url: string, fallback?: string) {
  const host = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  })()
  for (const [re, name] of BOOKING_HOSTS) if (re.test(host)) return name
  return clean(fallback) || host.replace(/^www\./, '') || '예매하기'
}

// 많이 쓰는 예매처를 앞으로
const BOOKING_ORDER = ['NOL 인터파크', '예스24 티켓', '멜론티켓', '티켓링크', '네이버 예약']

/** 주소·이름이 같은 링크는 하나만, 주요 예매처 순으로 정렬 */
export function uniqueLinks(links: BookingLink[]) {
  const seen = new Set<string>()
  const rank = (l: BookingLink) => {
    const i = BOOKING_ORDER.indexOf(l.name)
    return i < 0 ? BOOKING_ORDER.length : i
  }
  return links
    .filter((l) => {
      const url = l.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
      if (seen.has(url) || seen.has('name:' + l.name)) return false
      seen.add(url)
      seen.add('name:' + l.name)
      return true
    })
    .sort((a, b) => rank(a) - rank(b))
}

/**
 * 같은 행사 판별용 제목 정규화.
 * 맨 앞 기관명 머리말([세종문화회관] 등)만 떼고, 괄호 기호·공백·문장부호는 지우되 괄호 안 내용은 남김
 * (출처마다 [제목], <제목>, 《제목》 으로 표기가 달라서)
 */
export function titleKey(title: string) {
  return title
    .toLowerCase()
    .replace(/^\s*\[[^\]]*\]\s*(?=\S)/, '')
    .replace(/[\s\p{P}\p{S}]/gu, '')
}

/** 장소 비교용: 괄호 속 부연·공백 제거 */
export function venueKey(venue: string) {
  return venue
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[\s\p{P}\p{S}]/gu, '')
}

/**
 * 장소 이름이 비슷한지: 4글자 이상 이어서 겹치는 부분이 있으면 같은 곳으로 봄
 * ('대학로 종로마루홀' ↔ '종로노인종합복지관 종로마루홀', '북서울꿈의숲' ↔ '북서울 꿈의숲')
 */
export function sameVenue(a: string, b: string) {
  const x = venueKey(a)
  const y = venueKey(b)
  if (!x || !y) return true
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  if (short.length < 4) return long.includes(short)
  for (let i = 0; i + 4 <= short.length; i++) if (long.includes(short.slice(i, i + 4))) return true
  return false
}

export async function fetchText(url: string, tries = 3): Promise<string> {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
    }
  }
  throw new Error(`${url.replace(/(service(Key)?=)[^&]+/i, '$1***').replace(/8088\/[^/]+/, '8088/***')} 실패: ${last}`)
}

/** 동시에 limit 개씩 실행 */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    }),
  )
  return out
}
