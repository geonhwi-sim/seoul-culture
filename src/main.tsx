import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import Home from './pages/Home'
import Browse from './pages/Browse'
import Detail from './pages/Detail'
import MapPage from './pages/MapPage'
import Saved from './pages/Saved'
import Calendar from './pages/Calendar'
import './styles.css'

registerSW({ immediate: true })

// 화면 목록을 데이터 라우터에 직접 등록해야 링크의 viewTransition(포스터가 상세로 이어지는 전환)이 동작함
// (App 안에서 <Routes>로 나누면 그 옵션이 전달되지 않음)
const router = createHashRouter([
  {
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'browse', element: <Browse /> },
      { path: 'map', element: <MapPage /> },
      { path: 'calendar', element: <Calendar /> },
      { path: 'saved', element: <Saved /> },
      { path: 'e/:id', element: <Detail /> },
      { path: '*', element: <Home /> },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
