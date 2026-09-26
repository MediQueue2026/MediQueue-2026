import { useState, useRef, useEffect } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

interface CleanDatePickerProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  minYear?: number
  maxYear?: number
  style?: React.CSSProperties
  required?: boolean
  align?: 'left' | 'right'
}

export default function CleanDatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  minYear = 1940,
  maxYear = new Date().getFullYear() + 10,
  style,
  required,
  align,
}: CleanDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [dropdownAlign, setDropdownAlign] = useState<'left' | 'right'>(align || 'left')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (align) {
      setDropdownAlign(align)
    } else if (open && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const modalParent = containerRef.current.closest('.modal-card, dialog, [role="dialog"]')
      if (modalParent) {
        const modalRect = modalParent.getBoundingClientRect()
        if (modalRect.right - rect.left < 285) {
          setDropdownAlign('right')
          return
        }
      }
      if (window.innerWidth - rect.left < 285) {
        setDropdownAlign('right')
      } else {
        setDropdownAlign('left')
      }
    }
  }, [open, align])

  // Parse initial or fallback view year & month
  const today = new Date()
  const parsedDate = value ? new Date(value + 'T00:00:00') : null
  const initialYear = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.getFullYear() : today.getFullYear()
  const initialMonth = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.getMonth() : today.getMonth()

  const [viewYear, setViewYear] = useState<number>(initialYear)
  const [viewMonth, setViewMonth] = useState<number>(initialMonth)

  // Update view when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00')
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear())
        setViewMonth(d.getMonth())
      }
    }
  }, [value])

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Calculate calendar days
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(prev => prev - 1)
    } else {
      setViewMonth(prev => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(prev => prev + 1)
    } else {
      setViewMonth(prev => prev + 1)
    }
  }

  const handleSelectDay = (day: number) => {
    const mStr = String(viewMonth + 1).padStart(2, '0')
    const dStr = String(day).padStart(2, '0')
    onChange(`${viewYear}-${mStr}-${dStr}`)
    setOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
  }

  const handleToday = () => {
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    onChange(`${y}-${m}-${d}`)
    setViewYear(y)
    setViewMonth(today.getMonth())
    setOpen(false)
  }

  // Generate Year options
  const years: number[] = []
  for (let y = maxYear; y >= minYear; y--) {
    years.push(y)
  }

  // Selected date components
  const selectedY = parsedDate?.getFullYear()
  const selectedM = parsedDate?.getMonth()
  const selectedD = parsedDate?.getDate()

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {/* Input box */}
      <div
        onClick={() => setOpen(prev => !prev)}
        style={{
          width: '100%',
          height: 42,
          padding: '0 12px',
          background: '#ffffff',
          border: open ? '1.5px solid var(--blue, #3b82f6)' : '1px solid var(--border-md, #cbd5e1)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          boxShadow: open ? '0 0 0 3px rgba(59, 130, 246, 0.12)' : 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 13.5, color: value ? '#1e293b' : 'var(--text-4, #94a3b8)', fontWeight: value ? 600 : 400 }}>
          {value || placeholder}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {value && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear date"
              style={{
                background: 'transparent',
                border: 'none',
                padding: 2,
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={14} />
            </button>
          )}
          <CalendarIcon size={16} color="var(--blue, #3b82f6)" />
        </div>
      </div>

      {/* Hidden input for HTML form validation */}
      {required && (
        <input
          type="text"
          value={value}
          required
          onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', height: 0, width: 0 }}
        />
      )}

      {/* Calendar Dropdown Popup — Pure White, No Black, No Red */}
      {open && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: dropdownAlign === 'left' ? 0 : 'auto',
            right: dropdownAlign === 'right' ? 0 : 'auto',
            zIndex: 99999,
            width: 275,
            background: '#ffffff',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            borderRadius: 14,
            padding: '14px',
            boxShadow: '0 16px 40px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.06)',
            color: '#1e293b',
          }}
        >
          {/* Month & Year Select Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              aria-label="Previous month"
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: '1px solid #e2e8f0', background: '#f8fafc',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#334155',
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {/* Month Dropdown */}
              <select
                value={viewMonth}
                onChange={e => setViewMonth(parseInt(e.target.value, 10))}
                style={{
                  height: 28, padding: '0 6px', fontSize: 12.5, fontWeight: 700,
                  borderRadius: 6, border: '1px solid #e2e8f0', background: '#ffffff',
                  color: '#1e293b', cursor: 'pointer', outline: 'none',
                }}
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </select>

              {/* Year Dropdown */}
              <select
                value={viewYear}
                onChange={e => setViewYear(parseInt(e.target.value, 10))}
                style={{
                  height: 28, padding: '0 6px', fontSize: 12.5, fontWeight: 700,
                  borderRadius: 6, border: '1px solid #e2e8f0', background: '#ffffff',
                  color: '#1e293b', cursor: 'pointer', outline: 'none',
                }}
              >
                {years.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              aria-label="Next month"
              style={{
                width: 28, height: 28, borderRadius: 6,
                border: '1px solid #e2e8f0', background: '#f8fafc',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#334155',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Days of Week Row — Standard Clean Grey (NO RED) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 6, textAlign: 'center' }}>
            {WEEK_DAYS.map(day => (
              <div key={day} style={{ fontSize: 11, fontWeight: 700, color: '#64748b', padding: '3px 0' }}>
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, textAlign: 'center' }}>
            {/* Previous month filler days */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => {
              const dayNum = prevMonthDays - firstDayOfWeek + i + 1
              return (
                <div key={`prev-${i}`} style={{ fontSize: 12, color: '#cbd5e1', padding: '6px 0', userSelect: 'none' }}>
                  {dayNum}
                </div>
              )
            })}

            {/* Current month days — All dark slate, NO RED */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const isSelected = selectedY === viewYear && selectedM === viewMonth && selectedD === day
              const isToday = today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day

              return (
                <button
                  type="button"
                  key={`day-${day}`}
                  onClick={() => handleSelectDay(day)}
                  style={{
                    height: 30,
                    width: '100%',
                    borderRadius: 6,
                    border: isToday && !isSelected ? '1px solid var(--blue, #3b82f6)' : 'none',
                    background: isSelected ? 'var(--blue, #3b82f6)' : 'transparent',
                    color: isSelected ? '#ffffff' : '#1e293b',
                    fontSize: 12.5,
                    fontWeight: isSelected || isToday ? 800 : 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = '#f1f5f9'
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  }}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              style={{
                fontSize: 11.5, fontWeight: 700, color: '#64748b',
                background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px',
              }}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleToday}
              style={{
                fontSize: 11.5, fontWeight: 700, color: 'var(--blue, #3b82f6)',
                background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 6px',
              }}
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
