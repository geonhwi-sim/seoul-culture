import { Link } from 'react-router-dom'
import { useEvents } from '../lib/data'
import { useSaved } from '../lib/saved'
import { EventCard } from '../components/EventCard'
import { ErrorState, LoadingGrid } from '../components/States'

export default function Saved() {
  const data = useEvents()
  const saved = useSaved()
  const events = data.status === 'ready' ? saved.map((id) => data.byId.get(id)).filter((e) => !!e) : []

  return (
    <div className="page">
      <h1 className="page-title">찜한 행사</h1>
      {data.status === 'loading' && <LoadingGrid count={2} />}
      {data.status === 'error' && <ErrorState onRetry={data.retry} />}
      {data.status === 'ready' && events.length === 0 && (
        <div className="empty">
          <h2>아직 찜한 행사가 없어요</h2>
          <p>보고 싶은 전시나 공연의 하트를 누르면 여기에 모여요. 이 기기에만 저장돼요.</p>
          <Link className="ghost-btn" to="/browse">
            둘러보기
          </Link>
        </div>
      )}
      {events.length > 0 && (
        <>
          <div className="result-count num">{events.length}개</div>
          <div className="grid">
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
