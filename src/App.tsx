import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router-dom'
import { CalendarBlank, Heart, House, MapTrifold, SquaresFour } from '@phosphor-icons/react'
import { useEffect } from 'react'
import { useEvents } from './lib/data'
import { today } from './lib/date'
import { computeReminders, deliverNotifications } from './lib/reminders'
import { usePlans, useSaved } from './lib/saved'

const TABS = [
  { to: '/', label: '홈', Icon: House, end: true },
  { to: '/browse', label: '둘러보기', Icon: SquaresFour },
  { to: '/map', label: '지도', Icon: MapTrifold },
  { to: '/calendar', label: '달력', Icon: CalendarBlank },
  { to: '/saved', label: '찜', Icon: Heart },
]

/** 앱을 열 때 오늘·내일 알림을 폰 알림으로 (알림을 켠 경우만) */
function NotificationRunner() {
  const data = useEvents()
  const saved = useSaved()
  const plans = usePlans()
  useEffect(() => {
    if (data.status !== 'ready') return
    const mine = saved.map((id) => data.byId.get(id)).filter((e) => !!e)
    deliverNotifications(computeReminders(mine, plans, today())).catch(() => {})
  }, [data, saved, plans])
  return null
}

export default function App() {
  // 상세 화면은 하단 예매 바가 탭바 자리를 씀
  const detail = useLocation().pathname.startsWith('/e/')
  return (
    <div className={`app ${detail ? 'no-tabs' : ''}`}>
      <NotificationRunner />
      {/* 화면 목록은 main.tsx 의 라우터에 있음 */}
      <Outlet />
      {/* 뒤로 가면 보던 위치로, 새 화면은 맨 위에서 (포스터가 원래 카드 자리로 돌아가려면 필요) */}
      <ScrollRestoration />
      <footer className="tabbar" hidden={detail}>
        <nav aria-label="주요 메뉴">
          {TABS.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              {({ isActive }) => (
                <>
                  <Icon size={22} weight={isActive ? 'fill' : 'light'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </footer>
    </div>
  )
}
