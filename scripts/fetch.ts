// 전시·공연 수집 → public/events.json
//   npm run fetch   (.env 또는 환경변수: SEOUL_API_KEY, KOPIS_API_KEY, KCISA_API_KEY)
import fs from 'node:fs'
import type { CultureEvent, EventsFile, Source } from '../src/types.ts'
import { displayTitle, infoScore, kstDate, likelySame, sameVenue, titleKey, uniqueLinks, type RawEvent } from './lib.ts'
import { fetchKcisa } from './sources/kcisa.ts'
import { fetchKopis } from './sources/kopis.ts'
import { fetchSeoul } from './sources/seoul.ts'

const OUT = new URL('../public/events.json', import.meta.url)
const SEEN = new URL('./cache/seen.json', import.meta.url)

if (fs.existsSync(new URL('../.env', import.meta.url))) process.loadEnvFile(new URL('../.env', import.meta.url))

const today = kstDate()
const until = kstDate(90)
const env = (k: string) => process.env[k]?.trim() || undefined

const prev: CultureEvent[] = fs.existsSync(OUT) ? (JSON.parse(fs.readFileSync(OUT, 'utf8')) as EventsFile).events : []
const seen: Record<string, string> = fs.existsSync(SEEN) ? JSON.parse(fs.readFileSync(SEEN, 'utf8')) : {}
const firstRun = Object.keys(seen).length === 0

const jobs: [Source, string | undefined, (key: string) => Promise<RawEvent[]>][] = [
  ['kopis', env('KOPIS_API_KEY'), (k) => fetchKopis(k, today, until)],
  ['seoul', env('SEOUL_API_KEY') ?? 'sample', (k) => fetchSeoul(k, today, until)],
  ['kcisa', env('KCISA_API_KEY'), (k) => fetchKcisa(k, today, until)],
]

const raw: RawEvent[] = []
let failed = 0
for (const [source, key, run] of jobs) {
  if (!key) {
    console.log(`- ${source}: 인증키 없음, 건너뜀`)
    continue
  }
  const t = Date.now()
  try {
    const list = await run(key)
    raw.push(...list)
    const withBooking = list.filter((e) => e.booking.length).length
    console.log(`✓ ${source}: ${list.length}건 (예매 링크 ${withBooking}건) ${((Date.now() - t) / 1000).toFixed(0)}s`)
  } catch (e) {
    failed++
    // 일시 장애로 목록이 통째로 사라지지 않도록 지난 결과 유지
    const kept = prev.filter((p) => p.sources.length === 1 && p.sources[0] === source && p.end >= today)
    raw.push(...kept.map(({ firstSeenAt: _, ...rest }) => rest))
    console.error(`✗ ${source}: ${e instanceof Error ? e.message : e} — 지난 결과 ${kept.length}건 유지`)
  }
}

// 처음 본 날 기록 (첫 실행이면 기존 행사를 '새로 등록'으로 몰아 표시하지 않도록 30일 전으로)
const baseline = firstRun ? kstDate(-30) : today
for (const e of raw) seen[e.id] ??= e.registeredAt && e.registeredAt < today ? e.registeredAt : baseline

// 같은 행사 병합: 제목이 같고 기간이 겹치며 장소가 비슷하면 하나로.
// (같은 공연의 다른 극장 투어는 장소가 달라 따로 남음) 정보는 kopis > seoul > kcisa 순으로 우선
const PRIORITY: Source[] = ['kopis', 'seoul', 'kcisa']
const byTitle = new Map<string, RawEvent[]>()
for (const e of raw) {
  const k = titleKey(e.title)
  byTitle.set(k, [...(byTitle.get(k) ?? []), e])
}
const groups: RawEvent[][] = []
for (const list of byTitle.values()) {
  const clusters: RawEvent[][] = []
  for (const e of list) {
    const c = clusters.find((g) => g.some((o) => o.start <= e.end && e.start <= o.end && sameVenue(o.venue, e.venue)))
    if (c) c.push(e)
    else clusters.push([e])
  }
  groups.push(...clusters)
}

// 2차 병합: 기간이 완전히 같은데 출처마다 제목을 다르게 붙인 경우 (lib.ts likelySame 참고)
const parent = groups.map((_, i) => i)
const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
const byDates = new Map<string, number[]>()
groups.forEach((g, i) => {
  for (const e of g) byDates.set(`${e.start}|${e.end}`, [...(byDates.get(`${e.start}|${e.end}`) ?? []), i])
})
for (const ids of byDates.values()) {
  const uniq = [...new Set(ids)]
  for (let x = 0; x < uniq.length; x++)
    for (let y = x + 1; y < uniq.length; y++) {
      const [i, j] = [uniq[x], uniq[y]]
      if (find(i) !== find(j) && groups[i].some((a) => groups[j].some((b) => likelySame(a, b)))) parent[find(j)] = find(i)
    }
}
const mergedGroups = new Map<number, RawEvent[]>()
groups.forEach((g, i) => mergedGroups.set(find(i), [...(mergedGroups.get(find(i)) ?? []), ...g]))

const events: CultureEvent[] = [...mergedGroups.values()].map((g) => {
  // 정보가 가장 많은 쪽을 기준으로, 같으면 출처 우선순위
  g.sort((a, b) => infoScore(b) - infoScore(a) || PRIORITY.indexOf(a.sources[0]) - PRIORITY.indexOf(b.sources[0]))
  const merged = { ...g[0] } as RawEvent
  for (const other of g.slice(1)) {
    for (const [k, v] of Object.entries(other)) {
      if (v !== undefined && (merged as Record<string, unknown>)[k] === undefined) (merged as Record<string, unknown>)[k] = v
    }
  }
  merged.sources = [...new Set(g.flatMap((e) => e.sources))]
  merged.booking = uniqueLinks(g.flatMap((e) => e.booking))
  merged.isFree = g.some((e) => e.isFree)
  const { registeredAt: _, ...rest } = merged
  return { ...rest, title: displayTitle(rest.title), firstSeenAt: g.map((e) => seen[e.id]).sort()[0] }
})

events.sort((a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'ko'))

if (events.length === 0 && prev.length > 0) {
  console.error('수집 결과가 0건 — 기존 파일을 덮어쓰지 않음')
  process.exit(1)
}

// 끝난 행사 기록은 정리
for (const id of Object.keys(seen)) if (!raw.some((e) => e.id === id) && seen[id] < kstDate(-180)) delete seen[id]

const file: EventsFile = { updatedAt: new Date().toISOString(), count: events.length, events }
fs.writeFileSync(OUT, JSON.stringify(file) + '\n')
fs.mkdirSync(new URL('.', SEEN), { recursive: true })
fs.writeFileSync(SEEN, JSON.stringify(seen, null, 1) + '\n')

const byCat = Object.entries(Object.groupBy(events, (e) => e.category)).map(([c, l]) => `${c} ${l?.length}`)
console.log(`\n총 ${events.length}건 (${byCat.join(' · ')}) · 예매 링크 ${events.filter((e) => e.booking.length).length}건`)
console.log(`→ public/events.json ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`)
if (failed) process.exitCode = 1
