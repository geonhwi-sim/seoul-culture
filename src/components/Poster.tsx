import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type { CultureEvent } from '../types'

/** 포스터 이미지. 불러오는 동안 스켈레톤, 없거나 깨지면 제목으로 만든 타이포 포스터 */
export function Poster({
  event,
  className = '',
  eager = false,
  natural = false,
  style,
}: {
  event: CultureEvent
  className?: string
  eager?: boolean
  natural?: boolean
  style?: CSSProperties
}) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(event.poster ? 'loading' : 'error')
  const img = useRef<HTMLImageElement>(null)

  // 이미 캐시에 있는 이미지는 그리기 전에 바로 보이게 (화면 전환 때 빈 포스터가 찍히지 않도록)
  useLayoutEffect(() => {
    if (img.current?.complete && img.current.naturalWidth > 0) setState('loaded')
  }, [])

  return (
    <div className={`poster ${className} ${state === 'loading' ? 'loading' : ''} ${natural && state === 'loaded' ? 'natural' : ''}`} style={style}>
      {state !== 'error' && (
        <img
          ref={img}
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
