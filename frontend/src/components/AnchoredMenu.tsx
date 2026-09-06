import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  /** The button the menu hangs from. */
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  width?: number
  children: ReactNode
}

/**
 * A dropdown that can't be clipped by its surroundings.
 *
 * The app's `.topbar` is `overflow-x: auto; overflow-y: hidden` so the header
 * can scroll sideways on narrow screens. Any absolutely-positioned menu inside
 * it gets cut off at the header's bottom edge — which is what happened to the
 * staff sign-in and account menus: only the top few pixels were visible.
 *
 * Rendering into `document.body` escapes both that clip and any ancestor
 * stacking context. The trade-off is that a fixed-position menu no longer
 * follows its anchor automatically, so it re-measures on scroll and resize.
 */
export default function AnchoredMenu({ anchorRef, open, onClose, width = 280, children }: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  // Position before paint, so the menu never flashes in the wrong place.
  useLayoutEffect(() => {
    if (!open) return

    const place = () => {
      const anchor = anchorRef.current
      if (!anchor) return
      const r = anchor.getBoundingClientRect()
      const gutter = 8
      // Right-aligned to the anchor, then clamped so it can't hang off-screen
      // on a narrow viewport.
      const left = Math.min(
        Math.max(gutter, r.right - width),
        Math.max(gutter, window.innerWidth - width - gutter),
      )
      setPos({ top: r.bottom + 8, left })
    }

    place()
    // `true` catches scrolls in any scrolling ancestor, not just the window.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, width, anchorRef])

  // Click-away and Escape. The anchor is excluded so its own click can toggle
  // the menu shut instead of closing and immediately reopening.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose, anchorRef])

  if (!open || !pos) return null

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="card glass-form-card fade-in"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width,
        // Above the page, below the dev navbar (9999).
        zIndex: 9998,
        padding: 8,
        background: 'rgba(255,255,255,0.97)',
      }}
    >
      {children}
    </div>,
    document.body,
  )
}
