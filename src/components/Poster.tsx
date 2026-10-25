import { useState } from 'react'
import type { CultureEvent } from '../types'

/** 포스터 이미지. 불러오는 동안 스켈레톤, 없거나 깨지면 제목으로 만든 타이포 포스터 */
export function Poster({ event, className = '', eager = false, natural = false }: { event: CultureEvent; className?: string; eager?: boolean; natural?: boolean }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(event.poster ? 'loading' : 'error')
  return (
    <div className={`poster ${className} ${state === 'loading' ? 'loading' : ''} ${natural && state === 'loaded' ? 'natural' : ''}`}>
      {state !== 'error' && (
        <img
          src={event.poster}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          className={state === 'loaded' ? 'loaded' : ''}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      )}
      {state === 'error' && (
        <div className="typo" aria-hidden>
          <small>{event.category}</small>
          <strong>{event.title}</strong>
          <small>{event.venue}</small>
        </div>
      )}
    </div>
  )
}
