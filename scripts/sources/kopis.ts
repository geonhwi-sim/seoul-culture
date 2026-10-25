// KOPIS 공연예술통합전산망 Open API — 서울 공연 목록 + 상세(예매처) + 공연시설(좌표)
// https://www.kopis.or.kr/por/cs/openapi/openApiInfo.do
import fs from 'node:fs'
import { XMLParser } from 'fast-xml-parser'
import type { Category } from '../../src/types.ts'
import { bookingName, clean, fetchText, kstDate, mapLimit, seoulCoords, toHttps, toIsoDate, uniqueLinks, type RawEvent } from '../lib.ts'

const BASE = 'http://www.kopis.or.kr/openApi/restful'
const FACILITY_CACHE = new URL('../cache/kopis-facilities.json', import.meta.url)

const GENRES: [string, Category][] = [
  ['GGGA', '뮤지컬'],
  ['AAAA', '연극'],
  ['CCCD', '콘서트'],
  ['CCCA', '클래식'],
  ['CCCC', '무용·국악'],
  ['BBBC', '무용·국악'],
]

const xml = new XMLParser({ isArray: (name) => ['db', 'relate', 'styurl'].includes(name), parseTagValue: false })

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v]
}

async function get(path: string, key: string, params: Record<string, string> = {}, tries = 3) {
  const q = new URLSearchParams({ service: key, ...params })
  const parsed = xml.parse(await fetchText(`${BASE}/${path}?${q}`, tries))
  const dbs = asArray<Record<string, unknown>>(parsed?.dbs?.db)
  if (dbs[0]?.returncode && dbs[0].returncode !== '00') throw new Error('KOPIS: ' + dbs[0].errmsg)
  return dbs
}

const ymd = (iso: string) => iso.replace(/-/g, '')

interface Facility {
  address?: string
  lat?: number
  lng?: number
}

export async function fetchKopis(key: string, today: string, until: string): Promise<RawEvent[]> {
  // 1) 목록: 장르별 × 30일 구간 (기간 조회 범위 제한이 있어 나눠서 요청)
  const ids = new Map<string, Category>()
  const windows: [string, string][] = []
  for (let d = 0; ; d += 30) {
    const from = kstDate(d)
    if (from > until) break
    const to = kstDate(d + 29) < until ? kstDate(d + 29) : until
    windows.push([from, to])
  }
  for (const [code, category] of GENRES) {
    for (const [from, to] of windows) {
      for (let cpage = 1; cpage < 50; cpage++) {
        const rows = await get('pblprfr', key, {
          stdate: ymd(from),
          eddate: ymd(to),
          cpage: String(cpage),
          rows: '100',
          shcate: code,
          signgucode: '11',
        })
        for (const r of rows) if (r.mt20id && !ids.has(String(r.mt20id))) ids.set(String(r.mt20id), category)
        if (rows.length < 100) break
      }
    }
  }

  // 2) 상세 (예매처·출연·소개 이미지)
  const facilities: Record<string, Facility> = fs.existsSync(FACILITY_CACHE)
    ? JSON.parse(fs.readFileSync(FACILITY_CACHE, 'utf8'))
    : {}
  // 동시 요청이 많으면 KOPIS가 HTTP 400으로 거절함 → 3개씩, 재시도 넉넉히
  const details = await mapLimit([...ids], 3, async ([id, category]) => {
    try {
      const [d] = await get(`pblprfr/${id}`, key, {}, 5)
      return d ? { d, category } : undefined
    } catch (e) {
      console.warn('  KOPIS 상세 실패', id, String(e))
      return undefined
    }
  })

  // 3) 공연시설 좌표 (캐시)
  const missing = [...new Set(details.map((x) => x && String(x.d.mt10id ?? '')).filter((x): x is string => !!x && !(x in facilities)))]
  await mapLimit(missing, 3, async (fid) => {
    try {
      const [f] = await get(`prfplc/${fid}`, key)
      facilities[fid] = { address: clean(f?.adres) || undefined, ...seoulCoords(f?.la, f?.lo) }
    } catch {
      /* 좌표 없이 진행 */
    }
  })
  fs.mkdirSync(new URL('.', FACILITY_CACHE), { recursive: true })
  fs.writeFileSync(FACILITY_CACHE, JSON.stringify(facilities, null, 1) + '\n')

  const out: RawEvent[] = []
  for (const x of details) {
    if (!x) continue
    const { d, category } = x
    const start = toIsoDate(String(d.prfpdfrom))
    const end = toIsoDate(String(d.prfpdto)) || start
    if (!start || end < today) continue
    const relates = asArray((d.relates as { relate?: unknown })?.relate) as { relatenm?: string; relateurl?: string }[]
    const booking = uniqueLinks(
      relates.flatMap((r) => {
        const url = toHttps(r.relateurl)
        return url ? [{ name: bookingName(url, r.relatenm), url }] : []
      }),
    )
    const images = asArray((d.styurls as { styurl?: unknown })?.styurl)
      .map((u) => toHttps(String(u)))
      .filter((u): u is string => !!u)
      .slice(0, 4)
    const price = clean(d.pcseguidance)
    const fac = facilities[String(d.mt10id ?? '')] ?? {}
    const area = fac.address?.match(/서울(?:특별시)?\s+(\S+구)/)?.[1]
    out.push({
      id: 'kopis-' + d.mt20id,
      sources: ['kopis'],
      category,
      title: clean(d.prfnm),
      venue: clean(d.fcltynm),
      area,
      address: fac.address,
      lat: fac.lat,
      lng: fac.lng,
      start,
      end,
      time: clean(d.dtguidance) || undefined,
      runtime: clean(d.prfruntime) || undefined,
      age: clean(d.prfage) || undefined,
      price: price || undefined,
      isFree: /^무료|전석\s*무료/.test(price),
      poster: toHttps(String(d.poster ?? '')),
      images: images.length ? images : undefined,
      cast: clean(d.prfcast).replace(/\s*등$/, ' 등') || undefined,
      summary: clean(d.sty) || undefined,
      booking,
      officialUrl: `https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?menuId=MNU_00020&mt20Id=${d.mt20id}`,
      registeredAt: toIsoDate(String(d.frstregdt ?? '')) || undefined,
    })
  }
  return out
}
