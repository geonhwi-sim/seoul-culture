// 수집 스크립트(scripts/)와 앱(src/)이 같이 쓰는 데이터 형식

export const CATEGORIES = ['전시', '뮤지컬', '연극', '콘서트', '클래식', '무용·국악'] as const
export type Category = (typeof CATEGORIES)[number]

export type Source = 'kopis' | 'seoul' | 'kcisa'

export interface BookingLink {
  name: string
  url: string
}

export interface CultureEvent {
  id: string
  sources: Source[]
  category: Category
  title: string
  venue: string
  /** 구 이름 (예: 종로구) */
  area?: string
  address?: string
  lat?: number
  lng?: number
  /** YYYY-MM-DD */
  start: string
  end: string
  /** 공연 시간 안내 문구 */
  time?: string
  runtime?: string
  age?: string
  price?: string
  isFree: boolean
  poster?: string
  /** 상세 소개 이미지 */
  images?: string[]
  cast?: string
  summary?: string
  booking: BookingLink[]
  /** 패키지로 묶인 회차 공연들 (날짜순) */
  program?: { date: string; title: string; time?: string }[]
  officialUrl?: string
  /** 처음 수집된 날 (YYYY-MM-DD) — '새로 등록됨' 판별용 */
  firstSeenAt: string
}

export interface EventsFile {
  updatedAt: string
  count: number
  events: CultureEvent[]
}
