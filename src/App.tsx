import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { CalendarBlank, Heart, House, MapTrifold, SquaresFour } from '@phosphor-icons/react'
import Calendar from './pages/Calendar'
import Home from './pages/Home'
import Browse from './pages/Browse'
import Detail from './pages/Detail'
import MapPage from './pages/MapPage'
import Saved from './pages/Saved'

const TABS = [
  { to: '/', label: '홈', Icon: House, end: true },
  { to: '/browse', label: '둘러보기', Icon: SquaresFour },
  { to: '/map', label: '지도', Icon: MapTrifold },
  { to: '/calendar', label: '달력', Icon: CalendarBlank },
  { to: '/saved', label: '찜', Icon: Heart },
]

export default function App() {
  // 상세 화면은 하단 예매 바가 탭바 자리를 씀
  const detail = useLocation().pathname.startsWith('/e/')
  return (
    <div className={`app ${detail ? 'no-tabs' : ''}`}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/e/:id" element={<Detail />} />
        <Route path="*" element={<Home />} />
      </Routes>
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
