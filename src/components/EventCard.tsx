import { Link } from 'react-router-dom'
import type { CultureEvent } from '../types'
import { formatRange, statusLabel } from '../lib/date'
import { formatKm } from '../lib/geo'
import { markPoster, useReturnTarget } from '../lib/transition'
import { Poster } from './Poster'

export function CategoryLine({ event }: { event: CultureEvent }) {
  const status = statusLabel(event)
  return (
    <div className="cat">
      <span>{event.category}</span>
      {status && <span className={status.hot ? 'flag' : ''}>{status.text}</span>}
      {event.isFree && <span>무료</span>}
    </div>
  )
}

export function EventCard({ event, eager, distance }: { event: CultureEvent; eager?: boolean; distance?: number }) {
  const ref = useReturnTarget<HTMLAnchorElement>(event.id)
  return (
    <Link ref={ref} to={`/e/${event.id}`} className="card" viewTransition onClick={(e) => markPoster(e.currentTarget, event.id)}>
      <Poster event={event} eager={eager} />
      <CategoryLine event={event} />
      <h3>{event.title}</h3>
      <div className="meta">
        <span>
          {distance !== undefined && <b className="dist num">{formatKm(distance)}</b>}
          {event.venue}
        </span>
        <span className="num">{formatRange(event.start, event.end)}</span>
      </div>
    </Link>
  )
}

export function CardSkeleton() {
  return (
    <div className="card" aria-hidden>
      <div className="poster loading" />
      <div className="skeleton-line" />
      <div className="skeleton-line short" />
    </div>
  )
}
