// 서울 열린데이터광장 — 서울시 문화행사 정보 (culturalEventInfo)
// https://data.seoul.go.kr/dataList/OA-15486/S/1/datasetView.do
import type { Category } from '../../src/types.ts'
import { bookingName, clean, fetchText, seoulCoords, toHttps, toIsoDate, truncate, uniqueLinks, type RawEvent } from '../lib.ts'

const CATEGORY: Record<string, Category> = {
  '전시/미술': '전시',
  '뮤지컬/오페라': '뮤지컬',
  연극: '연극',
  콘서트: '콘서트',
  클래식: '클래식',
  '독주/독창회': '클래식',
  무용: '무용·국악',
  국악: '무용·국악',
}

interface Row {
  CODENAME: string
  GUNAME: string
  TITLE: string
  PLACE: string
  USE_TRGT: string
  USE_FEE: string
  PLAYER: string
  PROGRAM: string
  ETC_DESC: string
  ORG_LINK: string
  MAIN_IMG: string
  RGSTDATE: string
  STRTDATE: string
  END_DATE: string
  LOT: string
  LAT: string
  IS_FREE: string
  HMPG_ADDR: string
  PRO_TIME: string
}

async function page(key: string, from: number, to: number) {
  const text = await fetchText(`http://openapi.seoul.go.kr:8088/${key}/json/culturalEventInfo/${from}/${to}/`)
  const body = JSON.parse(text).culturalEventInfo
  if (!body) throw new Error('서울시 API 응답 오류: ' + text.slice(0, 200))
  return { total: body.list_total_count as number, rows: (body.row ?? []) as Row[] }
}

export async function fetchSeoul(key: string, today: string, until: string): Promise<RawEvent[]> {
  // sample 키는 한 번에 5건까지만 허용
  const size = key === 'sample' ? 5 : 1000
  const first = await page(key, 1, size)
  const rows = [...first.rows]
  if (key !== 'sample') {
    for (let from = size + 1; from <= first.total; from += size) {
      rows.push(...(await page(key, from, from + size - 1)).rows)
    }
  }

  const out: RawEvent[] = []
  for (const r of rows) {
    const category = CATEGORY[r.CODENAME]
    if (!category) continue
    const start = toIsoDate(r.STRTDATE)
    const end = toIsoDate(r.END_DATE) || start
    if (!start || end < today || start > until) continue

    const portal = toHttps(r.HMPG_ADDR)
    const link = toHttps(r.ORG_LINK)
    const isFree = r.IS_FREE === '무료' || /^무료/.test(r.USE_FEE)
    out.push({
      id: 'seoul-' + (portal?.match(/cultcode=(\d+)/)?.[1] ?? Buffer.from(r.TITLE + start).toString('base64url').slice(0, 16)),
      sources: ['seoul'],
      category,
      title: clean(r.TITLE),
      venue: clean(r.PLACE),
      area: clean(r.GUNAME) || undefined,
      ...seoulCoords(r.LAT, r.LOT),
      start,
      end,
      time: clean(r.PRO_TIME) || undefined,
      age: clean(r.USE_TRGT) || undefined,
      price: clean(r.USE_FEE).replace(/^(관람료|이용요금|요금)\s*[:：]\s*/, '') || (isFree ? '무료' : undefined),
      isFree,
      poster: toHttps(r.MAIN_IMG)?.replace('&thumb=Y', ''),
      cast: clean(r.PLAYER) || undefined,
      summary: truncate([clean(r.PROGRAM), clean(r.ETC_DESC)].filter(Boolean).join('\n\n'), 600) || undefined,
      booking: link ? uniqueLinks([{ name: bookingName(link, '공식 안내'), url: link }]) : [],
      officialUrl: portal,
      registeredAt: toIsoDate(r.RGSTDATE) || undefined,
    })
  }
  return out
}
