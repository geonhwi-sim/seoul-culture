// 전시·공연 수집 → public/events.json
//   npm run fetch   (.env 또는 환경변수: SEOUL_API_KEY, KOPIS_API_KEY, KCISA_API_KEY)
import fs from 'node:fs'
import type { CultureEvent, EventsFile, Source } from '../src/types.ts'
import { afterSeries, displayTitle, infoScore, kstDate, likelySame, packageSeries, sameVenue, titleKey, uniqueLinks, type RawEvent } from './lib.ts'
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
const collected: Source[] = []
const failed: { source: Source; reason: string; kept: number }[] = []
for (const [source, key, run] of jobs) {
  if (!key) {
    console.log(`- ${source}: 인증키 없음, 건너뜀`)
    continue
  }
  const t = Date.now()
  try {
    const list = await run(key)
    raw.push(...list)
    collected.push(source)
    const withBooking = list.filter((e) => e.booking.length).length
    console.log(`✓ ${source}: ${list.length}건 (예매 링크 ${withBooking}건) ${((Date.now() - t) / 1000).toFixed(0)}s`)
  } catch (e) {
    // 일시 장애로 목록이 통째로 사라지지 않도록 지난 결과 유지
    const kept = prev.filter((p) => p.sources.length === 1 && p.sources[0] === source && p.end >= today)
    raw.push(...kept.map(({ firstSeenAt: _, ...rest }) => rest))
    const reason = e instanceof Error ? e.message : String(e)
    failed.push({ source, reason, kept: kept.length })
    console.error(`✗ ${source}: ${reason} — 지난 결과 ${kept.length}건 유지`)
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

let events: CultureEvent[] = [...mergedGroups.values()].map((g) => {
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

// 패키지 통합: '[패키지] 서리풀 서초9 시리즈 (11월)'이 있으면 그 기간·장소 안의 같은 시리즈 회차들을
// 패키지 하나로 묶고 회차 목록(program)으로 보여줌
const absorbed = new Set<CultureEvent>()
for (const p of events) {
  const series = packageSeries(p.title)
  if (!series || absorbed.has(p)) continue
  const sk = titleKey(series)
  const members = events.filter(
    (e) =>
      e !== p &&
      !absorbed.has(e) &&
      !packageSeries(e.title) &&
      e.start >= p.start &&
      e.end <= p.end &&
      sameVenue(e.venue, p.venue) &&
      titleKey(e.title).startsWith(sk),
  )
  if (!members.length) continue
  members.sort((a, b) => a.start.localeCompare(b.start))
  members.forEach((m) => absorbed.add(m))
  const month = p.title.match(/\(\s*\d{1,2}\s*월\s*\)/)?.[0]
  p.title = month ? `${series} ${month}` : series
  p.program = members.map((m) => ({ date: m.start, title: afterSeries(m.title, series), time: m.time }))
  p.booking = uniqueLinks([...p.booking, ...members.flatMap((m) => m.booking)])
  p.sources = [...new Set([...p.sources, ...members.flatMap((m) => m.sources)])]
  p.poster ??= members.find((m) => m.poster)?.poster
  p.summary ??= members.find((m) => m.summary)?.summary
  p.firstSeenAt = [p.firstSeenAt, ...members.map((m) => m.firstSeenAt)].sort()[0]
}
if (absorbed.size) console.log(`패키지로 묶은 회차 ${absorbed.size}건`)
events = events.filter((e) => !absorbed.has(e))

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

// 일부 소스가 잠시 실패해도, 지난 결과로 매운 데이터는 그대로 두고 나머지로 만든 결과를 배포한다.
// (여기서 exit 1을 내면 뒤의 커밋·빌드·Pages 배포가 통째로 건너뛰여 사이트가 전날 데이터에 멈췄음)
// 실패는 경고로 남겨 액션 화면·실행 요약에서 바로 보이게 하고, 모든 소스가 실패했을 때만 job을 실패로 둔다.
if (failed.length) {
  for (const f of failed)
    console.warn(`::warning title=수집 실패 (${f.source})::${f.source} 수집 실패 — ${f.reason} (지난 결과 ${f.kept}건 유지)`.replace(/\n/g, ' '))
  const summary = [
    '### 수집 일부 실패',
    '',
    '| 소스 | 오류 | 유지한 지난 결과 |',
    '|---|---|---|',
    ...failed.map((f) => `| ${f.source} | ${f.reason.replace(/\|/g, '\\|')} | ${f.kept}건 |`),
    '',
    `정상 수집: ${collected.join(', ') || '없음'} · 총 ${events.length}건으로 배포를 계속합니다.`,
  ].join('\n')
  console.log('\n' + summary)
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n')
}

if (!collected.length) {
  console.error('모든 소스 수집 실패 — 새 데이터가 없어 실패로 종료합니다.')
  process.exitCode = 1
}
