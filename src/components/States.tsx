import { CardSkeleton } from './EventCard'

export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="empty">
      <h2>목록을 불러오지 못했어요</h2>
      <p>인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p>
      <button className="ghost-btn" onClick={onRetry}>
        다시 불러오기
      </button>
    </div>
  )
}
