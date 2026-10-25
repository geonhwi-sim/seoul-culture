import { useSyncExternalStore } from 'react'
import type { CultureEvent } from '../types'
import { addDays, daysBetween, isPermanent } from './date'
import { createStore, type Plans } from './saved'

// 찜·방문일에서 만드는 알림. 예매 오픈일은 공개 데이터에 없어 다루지 않음
export type ReminderKind = 'visit-today' | 'visit-tomorrow' | 'opening' | 'closing'

export interface Reminder {
  key: string
  kind: ReminderKind
  event: CultureEvent
  /** 알림이 가리키는 날 */
  date: string
  title: string
  body: string
}

const CLOSING_DAYS = 3

export function computeReminders(events: CultureEvent[], plans: Plans, t: string): Reminder[] {
  const out: Reminder[] = []
  for (const e of events) {
    const plan = plans[e.id]
    if (plan === t) out.push({ key: `${e.id}:visit:${plan}`, kind: 'visit-today', event: e, date: plan, title: '오늘 가기로 한 날이에요', body: `${e.title} · ${e.venue}` })
    else if (plan === addDays(t, 1))
      out.push({ key: `${e.id}:visit:${plan}`, kind: 'visit-tomorrow', event: e, date: plan, title: '내일 가기로 했어요', body: `${e.title} · ${e.venue}${e.time ? ` · ${e.time}` : ''}` })

    if (e.start === t || e.start === addDays(t, 1))
      out.push({ key: `${e.id}:open:${e.start}`, kind: 'opening', event: e, date: e.start, title: e.start === t ? '오늘 개막해요' : '내일 개막해요', body: e.title })

    const left = daysBetween(t, e.end)
    if (!plan && e.start < t && left >= 0 && left <= CLOSING_DAYS && !isPermanent(e))
      out.push({ key: `${e.id}:close:${e.end}`, kind: 'closing', event: e, date: e.end, title: left === 0 ? '오늘이 마지막 날이에요' : `${left}일 뒤 끝나요`, body: e.title })
  }
  const order: ReminderKind[] = ['visit-today', 'closing', 'visit-tomorrow', 'opening']
  return out.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.date.localeCompare(b.date))
}

// 폰 알림: 켰는지, 어떤 알림을 이미 띄웠는지
const notifyStore = createStore<{ on: boolean; sent: string[] }>(
  'jigeum-seoul:notify',
  { on: false, sent: [] },
  (v): v is { on: boolean; sent: string[] } => !!v && typeof v === 'object' && Array.isArray((v as { sent?: unknown }).sent),
)

export const useNotify = () => useSyncExternalStore(notifyStore.subscribe, notifyStore.get)

export const notifySupported = () => 'Notification' in window && 'serviceWorker' in navigator

export async function setNotify(on: boolean) {
  if (on && notifySupported() && Notification.permission !== 'granted') {
    const p = await Notification.requestPermission()
    if (p !== 'granted') return false
  }
  notifyStore.set({ ...notifyStore.get(), on })
  return true
}

/** 앱을 열었을 때 아직 안 띄운 알림을 폰 알림으로 보냄 (같은 알림은 한 번만) */
export async function deliverNotifications(reminders: Reminder[]) {
  const s = notifyStore.get()
  if (!s.on || !notifySupported() || Notification.permission !== 'granted') return
  const fresh = reminders.filter((r) => !s.sent.includes(r.key))
  if (!fresh.length) return
  const reg = await navigator.serviceWorker.ready
  for (const r of fresh.slice(0, 3)) {
    await reg.showNotification(r.title, {
      body: r.body,
      icon: './pwa-192x192.png',
      badge: './pwa-64x64.png',
      tag: r.key,
      data: { url: `${location.pathname}#/e/${r.event.id}` },
    })
  }
  notifyStore.set({ ...s, sent: [...s.sent, ...fresh.map((r) => r.key)].slice(-200) })
}
