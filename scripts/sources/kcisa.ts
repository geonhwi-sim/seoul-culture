// 공공데이터포털 — 한국문화정보원_한눈에보는문화정보조회서비스 (전시 보강용, 선택)
// https://www.data.go.kr/data/15138937/openapi.do
// 인증키가 승인된 뒤 실제 응답으로 필드명을 확인할 것 (KCISA_BASE 로 주소 변경 가능)
import { XMLParser } from 'fast-xml-parser'
import { clean, fetchText, mapLimit, seoulCoords, toHttps, toIsoDate, truncate, type RawEvent } from '../lib.ts'

const BASE = process.env.KCISA_BASE ?? 'https://apis.data.go.kr/B553457/cultureinfo'
const xml = new XMLParser({ isArray: (name) => name === 'item', parseTagValue: false })

type Item = Record<string, string | undefined>

const SEOUL_GU = new Set(
  '종로구 중구 용산구 성동구 광진구 동대문구 중랑구 성북구 강북구 도봉구 노원구 은평구 서대문구 마포구 양천구 강서구 구로구 금천구 영등포구 동작구 관악구 서초구 강남구 송파구 강동구'.split(' '),
)

async function get(op: string, params: Record<string, string>) {
  const q = new URLSearchParams(params)
  const parsed = xml.parse(await fetchText(`${BASE}/${op}?${q}`))
  const body = parsed?.response?.body
  if (!body) throw new Error('KCISA 응답 오류: ' + JSON.stringify(parsed).slice(0, 200))
  return { total: Number(body.totalCount ?? 0), items: (body.items?.item ?? []) as Item[] }
}

export async function fetchKcisa(key: string, today: string, until: string): Promise<RawEvent[]> {
  const items: Item[] = []
  for (let page = 1; page < 30; page++) {
    const r = await get('period2', {
      serviceKey: key,
      from: today.replace(/-/g, ''),
      to: until.replace(/-/g, ''),
      sido: '서울',
      PageNo: String(page),
      numOfrows: '100',
    })
    items.push(...r.items)
    if (r.items.length < 100 || items.length >= r.total) break
  }
  // sido 파라미터가 무시되는 경우가 있어 서울 여부를 직접 확인
  // 좌표 범위로는 과천·광명 같은 근교가 섞이므로 지역명으로만 판단
  const inSeoul = (i: Item) => /^서울/.test(clean(i.area)) && SEOUL_GU.has(clean(i.sigungu))
  const exhibitions = items.filter((i) => /전시|미술/.test(i.realmName ?? '') && inSeoul(i))

  const out = await mapLimit(exhibitions, 5, async (i): Promise<RawEvent | undefined> => {
    const start = toIsoDate(i.startDate)
    const end = toIsoDate(i.endDate) || start
    if (!start || end < today) return undefined
    let d: Item = {}
    try {
      d = (await get('detail2', { serviceKey: key, seq: String(i.seq) })).items[0] ?? {}
    } catch {
      /* 목록 정보만 사용 */
    }
    const price = clean(d.price)
    const url = toHttps(d.url) ?? toHttps(d.placeUrl)
    return {
      id: 'kcisa-' + i.seq,
      sources: ['kcisa'],
      category: '전시',
      title: clean(i.title),
      venue: clean(i.place),
      area: clean(i.sigungu) || undefined,
      address: clean(d.placeAddr) || undefined,
      ...seoulCoords(i.gpsY, i.gpsX),
      start,
      end,
      price: price || undefined,
      isFree: /^무료/.test(price),
      poster: toHttps(d.imgUrl) ?? toHttps(i.thumbnail),
      summary: truncate(clean(d.contents1), 600) || undefined,
      booking: [],
      officialUrl: url,
    }
  })
  return out.filter((x): x is RawEvent => !!x)
}
