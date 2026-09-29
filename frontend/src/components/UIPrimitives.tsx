import React from 'react'

export function Avatar({ name, size = 32, color = '#e2f9f7', text = '#0d968d', src }: {
  name: string; size?: number; color?: string; text?: string; src?: string | null
}) {
  const [imgError, setImgError] = React.useState(false)

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name || 'Avatar'}
        onError={() => setImgError(true)}
        style={{
          width: size, height: size, borderRadius: '50%',
          objectFit: 'cover', flexShrink: 0,
          border: '1.5px solid rgba(16, 185, 129, 0.35)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
        }}
      />
    )
  }

  const initials = (name || '').replace(/^Dr\.?\s+/i, '').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, color: text,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700, flexShrink: 0, letterSpacing: '-0.03em'
    }}>{initials}</div>
  )
}

export function Dot({ color }: { color: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
}

export function Badge({ children, cls }: { children: React.ReactNode; cls: string }) {
  return <span className={`badge ${cls}`}>{children}</span>
}

export function StatusBadge({ status }: { status: 'active' | 'break' | 'delayed' | 'offline' | 'online' | 'healthy' | 'degraded' | 'down' | 'operational' | 'maintenance' | 'completed' | 'waiting' | 'next' | 'urgent' | 'skipped' | 'called' | 'left' | 'in_progress' | 'cancelled' }) {
  const map: Record<string, [string, string]> = {
    active:      ['badge-emerald', 'Active'],
    online:      ['badge-emerald', 'Online'],
    operational: ['badge-emerald', 'Operational'],
    healthy:     ['badge-emerald', 'Healthy'],
    completed:   ['badge-emerald', 'Completed'],
    next:        ['badge-blue',    'Next In Line'],
    called:      ['badge-blue',    'Called'],
    in_progress: ['badge-blue',    'In Progress'],
    waiting:     ['badge-ghost',   'Waiting'],
    break:       ['badge-amber',   'On Break'],
    delayed:     ['badge-amber',   'Delayed'],
    degraded:    ['badge-amber',   'Degraded'],
    maintenance: ['badge-amber',   'Maintenance'],
    offline:     ['badge-crimson', 'Offline'],
    skipped:     ['badge-crimson', 'Skipped'],
    left:        ['badge-crimson', 'Left / No Show'],
    cancelled:   ['badge-crimson', 'Cancelled'],
    down:        ['badge-crimson', 'Down'],
    urgent:      ['badge-crimson', 'Urgent'],
  }
  const [cls, label] = map[status] ?? ['badge-ghost', status]
  const dotColor = cls === 'badge-emerald' ? '#10B981' : cls === 'badge-blue' ? '#4F46E5' : cls === 'badge-amber' ? '#F59E0B' : cls === 'badge-crimson' ? '#EF4444' : '#64748B'
  return <Badge cls={cls}><Dot color={dotColor} />{label}</Badge>
}

export function StatCard({ icon, label, value, sub, accent = 'var(--text-1)' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent?: string
}) {
  return (
    <div className="card glass-form-card" style={{ padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-4)' }}>{label}</span>
        <div style={{ color: accent, opacity: 0.8 }}>{icon}</div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 7 }}>{sub}</div>}
    </div>
  )
}