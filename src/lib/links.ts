import type { BookingLink, CultureEvent } from '../types'

const q = encodeURIComponent

/** 예매 링크가 없을 때 쓰는 검색 링크 (크롤링이 아니라 검색 페이지로 이동만 함) */
export function searchLinks(e: CultureEvent): BookingLink[] {
  return [
    { name: '네이버에서 찾기', url: `https://search.naver.com/search.naver?query=${q(e.title)}` },
    { name: 'NOL 인터파크에서 찾기', url: `https://tickets.interpark.com/search?keyword=${q(e.title)}` },
  ]
}

export function directionLinks(e: CultureEvent): BookingLink[] {
  const place = e.venue || e.address || e.title
  return [
    { name: '네이버 지도', url: `https://map.naver.com/p/search/${q(place)}` },
    {
      name: '카카오맵',
      url: e.lat && e.lng ? `https://map.kakao.com/link/map/${q(place)},${e.lat},${e.lng}` : `https://map.kakao.com/?q=${q(place)}`,
    },
  ]
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
