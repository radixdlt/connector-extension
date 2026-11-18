import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import './menu.css'

export type MenuItem = {
  label: string
  onSelect: () => void
  icon?: ReactNode
  /** An action that cannot be undone, in the theme's warning colour. */
  tone?: 'danger'
}

/**
 * A button that opens a menu of actions below it, aligned to its right edge. The
 * menu is placed in the viewport (`position: fixed`), so that a scrolling list does
 * not clip it. Keyboard: the arrows, Home and End move between the items, Escape
 * closes it and gives the focus back to the button; Tab or a click elsewhere closes
 * it.
 */
export const MenuButton = ({
  label,
  title,
  className,
  children,
  items,
}: {
  /** The button's accessible name. */
  label: string
  title?: string
  className?: string
  /** The button's content, e.g. an icon. */
  children: ReactNode
  items: MenuItem[]
}) => {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; right: number }>()
  const button = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = (focusButton: boolean) => {
    setOpen(false)
    if (focusButton) button.current?.focus()
  }

  useLayoutEffect(() => {
    if (!open || !button.current) return
    const rect = button.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 8,
      right: document.documentElement.clientWidth - rect.right,
    })
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!menu.current?.contains(target) && !button.current?.contains(target))
        close(false)
    }
    // Placed once: it would drift away from its button.
    const onMove = () => close(false)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [open])

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const menuItems = Array.from(
      menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    )
    const index = menuItems.indexOf(document.activeElement as HTMLElement)
    const focus = (next: number) =>
      menuItems[(next + menuItems.length) % menuItems.length]?.focus()
    if (event.key === 'ArrowDown') focus(index + 1)
    else if (event.key === 'ArrowUp') focus(index - 1)
    else if (event.key === 'Home') focus(0)
    else if (event.key === 'End') focus(menuItems.length - 1)
    else if (event.key === 'Escape') close(true)
    else if (event.key === 'Tab') close(false)
    else return
    if (event.key !== 'Tab') event.preventDefault()
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className={className}
        aria-label={label}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen(!open)}
      >
        {children}
      </button>
      {open && (
        <div
          ref={menu}
          id={menuId}
          role="menu"
          aria-label={label}
          className="rdx-menu"
          style={position}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`rdx-menu__item${
                item.tone === 'danger' ? ' rdx-menu__item--danger' : ''
              }`}
              onClick={() => {
                close(true)
                item.onSelect()
              }}
            >
              {item.icon && (
                <span className="rdx-menu__icon" aria-hidden="true">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
