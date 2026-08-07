import React from 'react'

export function Avatar({ name, size = 32, color = '#e2f9f7', text = '#0d968d' }: {
  name: string; size?: number; color?: string; text?: string
}) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
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

export function StatusBadge({ status }: { status: 'active' | 'break' | 'delayed' | 'offline' | 'online' | 'healthy' | 'degraded' | 'down' | 'operational' | 'maintenance' | 'completed' | 'waiting' | 'next' | 'urgent' }) {
  const map: Record<string, [string, string]> = {
    active:      ['badge-emerald', 'Active'],
    online:      ['badge-emerald', 'Online'],
    operational: ['badge-emerald', 'Operational'],
    healthy:     ['badge-emerald', 'Healthy'],
    completed:   ['badge-emerald', 'Completed'],
    next:        ['badge-blue',    'Next In Line'],
    waiting:     ['badge-ghost',   'Waiting'],
    break:       ['badge-amber',   'On Break'],
    delayed:     ['badge-amber',   'Delayed'],
    degraded:    ['badge-amber',   'Degraded'],
    maintenance: ['badge-amber',   'Maintenance'],
    offline:     ['badge-crimson', 'Offline'],
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
