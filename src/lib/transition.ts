import { useLayoutEffect, useRef } from 'react'

// 카드 포스터 ↔ 상세 포스터로 이어지는 화면 전환 (View Transitions API)
// 같은 행사가 홈의 여러 칸에 있을 수 있어서, 누른 카드의 포스터에만 이름을 붙임
export const POSTER_NAME = 'poster'

/** 마지막으로 눌러 들어간 행사 (뒤로 갈 때 포스터가 돌아갈 자리) */
export let lastPosterId: string | undefined

function clearNames() {
  document.querySelectorAll<HTMLElement>('[data-vt-poster]').forEach((p) => {
    p.style.viewTransitionName = ''
    delete p.dataset.vtPoster
  })
}

function name(poster: HTMLElement) {
  poster.style.viewTransitionName = POSTER_NAME
  poster.dataset.vtPoster = ''
}

/** 카드를 누를 때: 그 카드의 포스터에 전환 이름을 붙임 */
export function markPoster(el: Element | null | undefined, id?: string) {
  if (!el || !('startViewTransition' in document)) return
  clearNames()
  const poster = (el.matches('.poster') ? el : el.querySelector('.poster')) as HTMLElement | null
  if (!poster) return
  name(poster)
  lastPosterId = id
}

/**
 * 뒤로 돌아왔을 때: 방금 보던 행사의 카드가 그려지면 포스터에 이름을 붙여
 * 상세 포스터가 이 자리로 줄어들며 돌아오게 함. 같은 행사 카드가 여럿이면 첫 번째만.
 */
export function useReturnTarget<T extends HTMLElement>(id: string, enabled = true) {
  const ref = useRef<T>(null)
  useLayoutEffect(() => {
    if (!enabled || id !== lastPosterId || !('startViewTransition' in document)) return
    if (document.querySelector('[data-vt-poster]:not(.detail-poster)')) return
    const poster = ref.current?.querySelector<HTMLElement>('.poster')
    if (!poster) return
    name(poster)
    const t = setTimeout(() => {
      if (poster.dataset.vtPoster !== undefined) {
        poster.style.viewTransitionName = ''
        delete poster.dataset.vtPoster
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [id, enabled])
  return ref
}
