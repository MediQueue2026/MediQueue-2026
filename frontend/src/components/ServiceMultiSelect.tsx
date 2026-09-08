import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Plus, Search, X } from 'lucide-react'
import { SERVICE_GROUPS, findKnownService } from '../lib/medicalServices'

interface ServiceMultiSelectProps {
  value: string[]
  onChange: (services: string[]) => void
  /** Rendered when nothing is selected. */
  placeholder?: string
  disabled?: boolean
  id?: string
}

/**
 * Dropdown for picking any number of services a center provides.
 *
 * Replaces a comma-separated text input. There is no selection limit — the
 * count in the trigger is informational, not a cap.
 *
 * Two decisions worth knowing:
 *
 *  - The panel stays open after each pick. Closing on select is right for a
 *    single-choice control and wrong here, where choosing eight services would
 *    mean reopening the panel eight times.
 *  - Anything not on the list can still be typed and added. The old field
 *    accepted arbitrary text, and centers offer things no fixed list covers, so
 *    removing that would lose real capability. Custom entries are matched
 *    case-insensitively against the known list first, so typing "cardiology"
 *    selects the listed `Cardiology` instead of creating a near-duplicate.
 */
/** Roughly the panel's full height (search + list + footer), used for flip detection. */
const PANEL_HEIGHT = 340

export default function ServiceMultiSelect({
  value,
  onChange,
  placeholder = 'Select the services this center provides',
  disabled = false,
  id,
}: ServiceMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  /**
   * This control sits near the bottom of a `max-height: 90vh; overflow-y: auto`
   * modal, so a panel that always opens downward lands off-screen and has to be
   * scrolled to. Opening upward when there isn't room below avoids that.
   */
  const [dropUp, setDropUp] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const openPanel = () => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      const spaceBelow = window.innerHeight - rect.bottom
      setDropUp(spaceBelow < PANEL_HEIGHT && rect.top > spaceBelow)
    }
    setOpen(true)
  }

  // Close on outside click and on Escape — a dropdown that can only be closed
  // by re-clicking the trigger traps people who click elsewhere to dismiss it.
  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()   // don't let the surrounding modal close too
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (open) searchRef.current?.focus()
    else setQuery('')
  }, [open])

  const selected = useMemo(() => new Set(value.map(v => v.toLowerCase())), [value])
  const isSelected = (service: string) => selected.has(service.toLowerCase())

  const toggle = (service: string) => {
    onChange(
      isSelected(service)
        ? value.filter(v => v.toLowerCase() !== service.toLowerCase())
        : [...value, service],
    )
  }

  /** Groups filtered by the search box; empty groups are dropped entirely. */
  const visibleGroups = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return SERVICE_GROUPS
    return SERVICE_GROUPS
      .map(group => ({
        ...group,
        services: group.services.filter(s => s.toLowerCase().includes(needle)),
      }))
      .filter(group => group.services.length > 0)
  }, [query])

  /** The typed text, when it is neither a known service nor already selected. */
  const customCandidate = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed) return null
    if (findKnownService(trimmed)) return null
    if (selected.has(trimmed.toLowerCase())) return null
    return trimmed
  }, [query, selected])

  /** Selected entries that aren't on the list, so they can be shown and removed. */
  const customSelected = value.filter(v => !findKnownService(v))

  const addCustom = () => {
    if (!customCandidate) return
    onChange([...value, customCandidate])
    setQuery('')
    searchRef.current?.focus()
  }

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()   // this control lives in a form; don't submit it
    const known = findKnownService(query)
    if (known) {
      toggle(known)
      setQuery('')
    } else if (customCandidate) {
      addCustom()
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* ── Trigger: shows the current selection as removable chips ── */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="input"
        style={{
          width: '100%', minHeight: 44, height: 'auto',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: value.length ? '7px 10px' : '0 10px',
          textAlign: 'left', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 0 }}>
          {value.length === 0 ? (
            <span style={{ fontSize: 14, color: 'var(--text-4)' }}>{placeholder}</span>
          ) : (
            value.map(service => (
              <span
                key={service}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
                  color: 'var(--blue-dark)', borderRadius: 999,
                  padding: '3px 6px 3px 10px', fontSize: 12, fontWeight: 650,
                }}
              >
                {service}
                {/* A nested <button> would be invalid inside the trigger button,
                    so this is a span that stops the click from toggling the panel. */}
                <span
                  role="button"
                  tabIndex={-1}
                  aria-label={`Remove ${service}`}
                  onClick={event => { event.stopPropagation(); toggle(service) }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, borderRadius: '50%', cursor: 'pointer',
                    background: 'rgba(79,70,229,0.14)',
                  }}
                >
                  <X size={10} />
                </span>
              </span>
            ))
          )}
        </span>
        <ChevronDown
          size={16}
          style={{ flexShrink: 0, color: 'var(--text-4)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }}
        />
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 5 }}>
        <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
          {value.length === 0
            ? 'Pick one or more — there is no limit.'
            : `${value.length} selected${customSelected.length ? ` · ${customSelected.length} custom` : ''}`}
        </span>
        {value.length > 0 && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={() => onChange([])}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onChange([]) } }}
            style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', cursor: 'pointer' }}
          >
            Clear all
          </span>
        )}
      </div>

      {/* ── Panel ── */}
      {open && (
        <div
          role="listbox"
          aria-multiselectable
          style={{
            position: 'absolute', left: 0, right: 0, zIndex: 50,
            ...(dropUp ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }),
            background: '#ffffff', border: '1px solid var(--border-md)', borderRadius: 12,
            boxShadow: '0 16px 40px rgba(8, 48, 45, 0.18)', overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
            <Search size={14} style={{ color: 'var(--text-4)', flexShrink: 0 }} />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search services, or type your own…"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent', color: 'var(--text-1)' }}
            />
          </div>

          <div style={{ maxHeight: 260, overflowY: 'auto', padding: 6 }}>
            {visibleGroups.length === 0 && !customCandidate && (
              <div style={{ padding: '14px 10px', fontSize: 12.5, color: 'var(--text-4)', textAlign: 'center' }}>
                No services match “{query}”.
              </div>
            )}

            {visibleGroups.map(group => (
              <div key={group.label} style={{ marginBottom: 4 }}>
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--text-4)', padding: '8px 10px 4px',
                }}>
                  {group.label}
                </div>
                {group.services.map(service => {
                  const active = isSelected(service)
                  return (
                    <div
                      key={service}
                      role="option"
                      aria-selected={active}
                      onClick={() => toggle(service)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        color: active ? 'var(--blue-dark)' : 'var(--text-2)',
                        background: active ? 'var(--blue-dim)' : 'transparent',
                      }}
                    >
                      <span style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        border: `1.5px solid ${active ? 'var(--blue)' : 'var(--border-md)'}`,
                        background: active ? 'var(--blue)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {active && <Check size={11} color="#fff" strokeWidth={3} />}
                      </span>
                      {service}
                    </div>
                  )
                })}
              </div>
            ))}

            {customCandidate && (
              <div
                role="option"
                aria-selected={false}
                onClick={addCustom}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 10px', margin: '4px 0 0', borderRadius: 8, cursor: 'pointer',
                  fontSize: 13, fontWeight: 650, color: 'var(--blue-dark)',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <Plus size={14} style={{ flexShrink: 0 }} />
                Add “{customCandidate}” as a custom service
              </div>
            )}
          </div>

          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-4)' }}>{value.length} selected</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn btn-ghost btn-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
