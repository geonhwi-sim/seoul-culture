import type { CultureEvent } from '../types'
import { addDays } from './date'

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c)
const ymd = (iso: string) => iso.replace(/-/g, '')

/** 방문일을 하루 종일 일정으로 담은 .ics 파일을 내려받게 함 (아이폰·구글 캘린더에서 열림) */
export function downloadIcs(items: { event: CultureEvent; date: string }[], filename: string) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//jigeum-seoul//KO', 'CALSCALE:GREGORIAN']
  for (const { event: e, date } of items) {
    const link = `${location.origin}${location.pathname}#/e/${e.id}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}-${ymd(date)}@jigeum-seoul`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(date)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(date, 1))}`,
      `SUMMARY:${esc(`[${e.category}] ${e.title}`)}`,
      `LOCATION:${esc(e.address ?? e.venue)}`,
      `DESCRIPTION:${esc([e.time && `시간: ${e.time}`, e.price && `관람료: ${e.price}`, link].filter(Boolean).join('\n'))}`,
      `URL:${link}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
