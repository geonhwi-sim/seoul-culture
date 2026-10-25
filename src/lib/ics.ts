import type { CultureEvent } from '../types'
import { addDays, daysBetween, isPermanent } from './date'
import type { Plans } from './saved'

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c)
const ymd = (iso: string) => iso.replace(/-/g, '')

export interface IcsItem {
  event: CultureEvent
  /** 하루 종일 일정으로 넣을 날 */
  date: string
  kind: 'visit' | 'opening' | 'closing'
}

// 하루 종일 일정은 그날 0시 기준이라, -PT15H = 전날 오전 9시
const ALARM: Record<IcsItem['kind'], { trigger: string; prefix: string; note: string }> = {
  visit: { trigger: '-PT15H', prefix: '', note: '내일 방문' },
  opening: { trigger: '-PT15H', prefix: '개막 · ', note: '내일 개막' },
  closing: { trigger: '-P2DT15H', prefix: '마지막 날 · ', note: '3일 뒤 종료' },
}

/** 일정과 미리 알림(VALARM)을 담은 .ics 파일을 내려받게 함 (아이폰·구글 캘린더에서 열림) */
export function downloadIcs(items: IcsItem[], filename: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//jigeum-seoul//KO', 'CALSCALE:GREGORIAN']
  for (const { event: e, date, kind } of items) {
    const link = `${location.origin}${location.pathname}#/e/${e.id}`
    const a = ALARM[kind]
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}-${kind}-${ymd(date)}@jigeum-seoul`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(date)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(date, 1))}`,
      `SUMMARY:${esc(`${a.prefix}${e.title}`)}`,
      `LOCATION:${esc(e.address ?? e.venue)}`,
      `DESCRIPTION:${esc([e.time && `시간: ${e.time}`, e.price && `관람료: ${e.price}`, link].filter(Boolean).join('\n'))}`,
      `URL:${link}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`${a.note}: ${e.title}`)}`,
      `TRIGGER:${a.trigger}`,
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

/** 찜한 행사 전체에서 앞으로의 방문·개막·종료 일정 */
export function savedIcsItems(events: CultureEvent[], plans: Plans, t: string): IcsItem[] {
  const out: IcsItem[] = []
  for (const e of events) {
    if (plans[e.id] && plans[e.id] >= t) out.push({ event: e, date: plans[e.id], kind: 'visit' })
    if (e.start > t) out.push({ event: e, date: e.start, kind: 'opening' })
    else if (!plans[e.id] && e.end >= t && !isPermanent(e) && daysBetween(e.start, e.end) > 0) out.push({ event: e, date: e.end, kind: 'closing' })
  }
  return out
}
