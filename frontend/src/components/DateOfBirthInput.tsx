import React, { useState, useEffect, useMemo } from 'react'
import { Calendar, Edit3, Check } from 'lucide-react'

interface DateOfBirthInputProps {
  value: string // Format: YYYY-MM-DD
  onChange: (value: string) => void
  disabled?: boolean
  idPrefix?: string
}

const MONTHS = [
  { value: '01', label: '01 - January' },
  { value: '02', label: '02 - February' },
  { value: '03', label: '03 - March' },
  { value: '04', label: '04 - April' },
  { value: '05', label: '05 - May' },
  { value: '06', label: '06 - June' },
  { value: '07', label: '07 - July' },
  { value: '08', label: '08 - August' },
  { value: '09', label: '09 - September' },
  { value: '10', label: '10 - October' },
  { value: '11', label: '11 - November' },
  { value: '12', label: '12 - December' },
]

export default function DateOfBirthInput({
  value,
  onChange,
  disabled = false,
  idPrefix = 'dob'
}: DateOfBirthInputProps) {
  const [inputMode, setInputMode] = useState<'select' | 'type'>('select')
  const [typeValue, setTypeValue] = useState(value || '')

  // Current year for upper bound (e.g. 2026)
  const currentYear = new Date().getFullYear()

  // Parse YYYY-MM-DD from value
  const parsed = useMemo(() => {
    if (!value || typeof value !== 'string') {
      return { year: '', month: '', day: '' }
    }
    const parts = value.split('-')
    return {
      year: parts[0] || '',
      month: parts[1] || '',
      day: parts[2] || '',
    }
  }, [value])

  // Keep manual text input in sync when value changes from outside
  useEffect(() => {
    setTypeValue(value || '')
  }, [value])

  // Generate years descending from currentYear down to 1910
  const yearOptions = useMemo(() => {
    const years: number[] = []
    for (let y = currentYear; y >= 1910; y--) {
      years.push(y)
    }
    return years
  }, [currentYear])

  // Calculate days in selected month and year
  const daysInMonth = useMemo(() => {
    const y = parseInt(parsed.year, 10)
    const m = parseInt(parsed.month, 10)
    if (!m) return 31
    if (m === 2) {
      if (!y) return 29
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
      return isLeap ? 29 : 28
    }
    if ([4, 6, 9, 11].includes(m)) return 30
    return 31
  }, [parsed.year, parsed.month])

  const handleYearChange = (newYear: string) => {
    const newMonth = parsed.month
    let newDay = parsed.day
    if (newYear && newMonth && newDay) {
      const maxDays = getDays(parseInt(newYear, 10), parseInt(newMonth, 10))
      if (parseInt(newDay, 10) > maxDays) {
        newDay = String(maxDays).padStart(2, '0')
      }
      onChange(`${newYear}-${newMonth}-${newDay}`)
    } else if (newYear) {
      onChange(newMonth && newDay ? `${newYear}-${newMonth}-${newDay}` : `${newYear}-${newMonth || ''}-${newDay || ''}`)
    } else {
      onChange('')
    }
  }

  const handleMonthChange = (newMonth: string) => {
    const currentY = parsed.year
    let newDay = parsed.day
    if (currentY && newMonth && newDay) {
      const maxDays = getDays(parseInt(currentY, 10), parseInt(newMonth, 10))
      if (parseInt(newDay, 10) > maxDays) {
        newDay = String(maxDays).padStart(2, '0')
      }
      onChange(`${currentY}-${newMonth}-${newDay}`)
    } else if (newMonth) {
      onChange(currentY ? `${currentY}-${newMonth}-${newDay || ''}` : `-${newMonth}-${newDay || ''}`)
    } else {
      onChange('')
    }
  }

  const handleDayChange = (newDay: string) => {
    const currentY = parsed.year
    const currentM = parsed.month
    if (currentY && currentM && newDay) {
      onChange(`${currentY}-${currentM}-${newDay}`)
    } else if (newDay) {
      onChange(`${currentY || ''}-${currentM || ''}-${newDay}`)
    }
  }

  const handleTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const typed = e.target.value
    setTypeValue(typed)
    // Validate or pass format YYYY-MM-DD
    onChange(typed)
  }

  function getDays(y: number, m: number): number {
    if (m === 2) {
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
      return isLeap ? 29 : 28
    }
    if ([4, 6, 9, 11].includes(m)) return 30
    return 31
  }

  const selectStyle: React.CSSProperties = {
    height: 42,
    fontSize: 13,
    padding: '0 8px',
    borderRadius: 8,
    border: '1px solid var(--border-md, #e2e8f0)',
    background: '#ffffff',
    color: 'var(--text-1, #1e293b)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    width: '100%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Header with Mode Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4, #64748b)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Date of Birth
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setInputMode(inputMode === 'select' ? 'type' : 'select')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'transparent',
            border: 'none',
            fontSize: 11.5,
            fontWeight: 600,
            color: 'var(--blue, #2563eb)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '2px 4px',
            textDecoration: 'underline',
          }}
        >
          {inputMode === 'select' ? (
            <>
              <Edit3 size={11} /> Type directly
            </>
          ) : (
            <>
              <Calendar size={11} /> Select Year/Month/Day
            </>
          )}
        </button>
      </div>

      {inputMode === 'select' ? (
        /* Year -> Month -> Day 3-step Selection */
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr', gap: 8 }}>
          {/* 1. Year Selection */}
          <div>
            <label
              htmlFor={`${idPrefix}-year`}
              style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3, #475569)', display: 'block', marginBottom: 3 }}
            >
              1. Year
            </label>
            <select
              id={`${idPrefix}-year`}
              disabled={disabled}
              value={parsed.year}
              onChange={e => handleYearChange(e.target.value)}
              style={selectStyle}
            >
              <option value="">Year</option>
              {yearOptions.map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </div>

          {/* 2. Month Selection */}
          <div>
            <label
              htmlFor={`${idPrefix}-month`}
              style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3, #475569)', display: 'block', marginBottom: 3 }}
            >
              2. Month
            </label>
            <select
              id={`${idPrefix}-month`}
              disabled={disabled}
              value={parsed.month}
              onChange={e => handleMonthChange(e.target.value)}
              style={selectStyle}
            >
              <option value="">Month</option>
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* 3. Day Selection */}
          <div>
            <label
              htmlFor={`${idPrefix}-day`}
              style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-3, #475569)', display: 'block', marginBottom: 3 }}
            >
              3. Day
            </label>
            <select
              id={`${idPrefix}-day`}
              disabled={disabled}
              value={parsed.day}
              onChange={e => handleDayChange(e.target.value)}
              style={selectStyle}
            >
              <option value="">Day</option>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const dayNum = String(i + 1).padStart(2, '0')
                return <option key={dayNum} value={dayNum}>{dayNum}</option>
              })}
            </select>
          </div>
        </div>
      ) : (
        /* Direct Typing / HTML5 Date Input */
        <div style={{ position: 'relative' }}>
          <input
            id={`${idPrefix}-typed`}
            type="date"
            max={`${currentYear}-12-31`}
            min="1910-01-01"
            disabled={disabled}
            value={typeValue}
            onChange={handleTypeChange}
            className="input"
            style={{
              height: 42,
              fontSize: 13.5,
              width: '100%',
              borderRadius: 8,
              padding: '0 12px',
            }}
          />
        </div>
      )}

      {/* Helper text showing formatted selected date */}
      {parsed.year && parsed.month && parsed.day && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#10b981', marginTop: 1 }}>
          <Check size={12} />
          <span>Selected Birth Date: <strong>{parsed.year}-{parsed.month}-{parsed.day}</strong></span>
        </div>
      )}
    </div>
  )
}
