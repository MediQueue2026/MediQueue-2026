import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity } from 'lucide-react'

const PAGES = [
  { path: '/',             label: '① Public Landing' },
  { path: '/patient',      label: '② Patient Dashboard' },
  { path: '/doctor',       label: '③ Doctor Panel' },
  { path: '/receptionist', label: '④ Receptionist Desk' },
  { path: '/admin',        label: '⑤ System Admin' },
  { path: '/tv-display',   label: '📺 Queue TV' },
]

export function DevNavbar() {
  const location = useLocation()

  return (
    <div className="page-switcher" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 20, flexShrink: 0 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 5,
          background: 'linear-gradient(135deg,#12c6ba,#0d968d)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Activity size={11} color="#fff" />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>MediQueue</span>
      </div>
      {PAGES.map(p => (
        <Link
          key={p.path}
          to={p.path}
          className={`page-tab ${location.pathname === p.path ? 'active' : ''}`}
          style={{ textDecoration: 'none' }}
        >
          {p.label}
        </Link>
      ))}
      <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-4)', fontWeight: 500 }} className="desktop-only">
        Modular Router Mode · Member Task Split Ready
      </div>
    </div>
  )
}
