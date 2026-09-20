import { useMemo, useState } from 'react'
import { Check, ClipboardList, Plus, Search, Sparkles, X } from 'lucide-react'
import { SERVICE_GROUPS, findKnownService } from '../lib/medicalServices'

interface ServiceChecklistProps {
  value: string[]
  onChange: (services: string[]) => void
  disabled?: boolean
  id?: string
}

/**
 * Every known service listed down as a checklist, grouped by category — the
 * receptionist scans and ticks services directly rather than opening a
 * dropdown. See ServiceMultiSelect for the compact chip-trigger version used
 * in tighter modal layouts.
 *
 * What's currently added is surfaced up top as its own chip panel — the
 * checklist below can scroll out of view, so "what did I actually save?"
 * needs an answer that doesn't depend on scroll position.
 */
export default function ServiceChecklist({ value, onChange, disabled = false, id }: ServiceChecklistProps) {
  const [query, setQuery] = useState('')
  const [customText, setCustomText] = useState('')

  const selected = useMemo(() => new Set(value.map(v => v.toLowerCase())), [value])
  const isSelected = (service: string) => selected.has(service.toLowerCase())
  const isCustom = (service: string) => !findKnownService(service)

  const toggle = (service: string) => {
    if (disabled) return
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
      .map(group => ({ ...group, services: group.services.filter(s => s.toLowerCase().includes(needle)) }))
      .filter(group => group.services.length > 0)
  }, [query])

  const addCustom = () => {
    const trimmed = customText.trim()
    if (!trimmed || disabled) return
    const finalValue = findKnownService(trimmed) ?? trimmed
    if (!selected.has(finalValue.toLowerCase())) onChange([...value, finalValue])
    setCustomText('')
  }

  return (
    <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── ADDED SERVICES — always visible, independent of scroll/filter state ── */}
      <div style={{
        borderRadius: 14, border: '1px solid var(--blue-border)', background: 'var(--blue-dim)',
        padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: value.length ? 10 : 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <ClipboardList size={15} color="var(--blue-dark)" />
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--blue-dark)' }}>
              Added Services
            </span>
            <span style={{
              fontSize: 11, fontWeight: 800, color: '#fff', background: 'var(--blue)',
              borderRadius: 999, padding: '1px 8px', minWidth: 20, textAlign: 'center',
            }}>
              {value.length}
            </span>
          </div>
          {value.length > 0 && !disabled && (
            <button type="button" onClick={() => onChange([])} className="btn btn-ghost btn-sm" style={{ fontSize: 11, height: 26, padding: '0 8px' }}>
              Clear all
            </button>
          )}
        </div>

        {value.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--blue-dark)', opacity: 0.75 }}>
            Nothing added yet — tick services below, or add your own.
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {value.map(service => (
              <span
                key={service}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#ffffff', border: '1px solid var(--blue-border)',
                  color: 'var(--blue-dark)', borderRadius: 999,
                  padding: '4px 7px 4px 12px', fontSize: 12.5, fontWeight: 650,
                  boxShadow: '0 1px 2px rgba(8,48,45,0.06)',
                }}
              >
                {isCustom(service) && <Sparkles size={11} style={{ flexShrink: 0, opacity: 0.7 }} />}
                {service}
                {!disabled && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Remove ${service}`}
                    onClick={() => toggle(service)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(service) } }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 17, height: 17, borderRadius: '50%', cursor: 'pointer',
                      background: 'var(--blue-dim)', color: 'var(--blue-dark)',
                    }}
                  >
                    <X size={10} />
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── FILTER ── */}
      <div style={{ position: 'relative' }}>
        <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', zIndex: 1, pointerEvents: 'none' }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter the service list…"
          aria-label="Filter the service list"
          className="input"
          disabled={disabled}
          style={{ height: 40, fontSize: 13, paddingLeft: 38, width: '100%' }}
        />
      </div>

      {/* ── CHECKLIST, grouped by category ── */}
      <div style={{
        border: '1px solid var(--border-md)', borderRadius: 14, maxHeight: 340, overflowY: 'auto',
        padding: 14, background: '#fff', opacity: disabled ? 0.7 : 1, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {visibleGroups.length === 0 && (
          <div style={{ padding: '18px 10px', fontSize: 12.5, color: 'var(--text-4)', textAlign: 'center' }}>
            No services match “{query}”.
          </div>
        )}

        {visibleGroups.map(group => {
          const selectedInGroup = group.services.filter(isSelected).length
          return (
            <div key={group.label}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>
                  {group.label}
                </span>
                {selectedInGroup > 0 && (
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--blue)' }}>
                    {selectedInGroup} added
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 4 }}>
                {group.services.map(service => {
                  const active = isSelected(service)
                  return (
                    <div
                      key={service}
                      role="checkbox"
                      aria-checked={active}
                      tabIndex={disabled ? -1 : 0}
                      onClick={() => toggle(service)}
                      onKeyDown={e => { if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(service) } }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 8px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
                        fontSize: 13, fontWeight: active ? 700 : 500,
                        color: active ? 'var(--blue-dark)' : 'var(--text-2)',
                        background: active ? 'var(--blue-dim)' : 'transparent',
                        transition: 'background 0.12s ease',
                      }}
                    >
                      <span style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                        border: `1.5px solid ${active ? 'var(--blue)' : 'var(--border-md)'}`,
                        background: active ? 'var(--blue)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {active && <Check size={10} color="#fff" strokeWidth={3} />}
                      </span>
                      <span style={{ minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.4 }}>{service}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── ANYTHING THE FIXED LIST DOESN'T COVER ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="input"
          placeholder="Not on the list? Add a service by name…"
          value={customText}
          onChange={e => setCustomText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
          disabled={disabled}
          style={{ height: 40, fontSize: 13, flex: 1 }}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={disabled || !customText.trim()}
          className="btn btn-primary btn-sm"
          style={{ gap: 5, flexShrink: 0, padding: '0 14px' }}
        >
          <Plus size={14} /> Add
        </button>
      </div>
    </div>
  )
}
