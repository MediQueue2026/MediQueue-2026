import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity, Database, Home, MonitorPlay, ShieldCheck, Stethoscope, Ticket, User } from 'lucide-react'

const PAGES = [
  { path: '/',             label: 'Public Landing',    icon: Home },
  { path: '/patient',      label: 'Patient Dashboard', icon: User },
  { path: '/doctor',       label: 'Doctor Panel',      icon: Stethoscope },
  { path: '/receptionist', label: 'Receptionist Desk', icon: Ticket },
  { path: '/admin',        label: 'System Admin',      icon: ShieldCheck },
  { path: '/tv-display',   label: 'Queue TV',          icon: MonitorPlay },
]

export function DevNavbar() {
  const location = useLocation()
  const [dbStatus, setDbStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const checkDatabaseConnection = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:5000/api/db-check')
      const data = await res.json()
      if (data.status === 'connected') {
        setDbStatus(`✅ Connected to Supabase! Found ${data.database?.medicalCentersCount || 0} centers & ${data.database?.usersCount || 0} users.`)
      } else {
        setDbStatus(`❌ ${data.message || data.error}`)
      }
    } catch (err: any) {
      setDbStatus(`⚠️ Connection Failed: Make sure backend server is running on port 5000 (run "npm run dev" inside backend/ folder)`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-switcher" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 18, flexShrink: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8,
          background: 'linear-gradient(135deg, var(--teal), var(--blue))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
        }}>
          <Activity size={14} color="#fff" strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>MediQueue</span>
      </div>

      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.12)', marginRight: 4 }} className="desktop-only" />

      {PAGES.map(p => {
        const Icon = p.icon
        const isActive = location.pathname === p.path
        return (
          <Link
            key={p.path}
            to={p.path}
            className={`page-tab ${isActive ? 'active' : ''}`}
            style={{ textDecoration: 'none' }}
          >
            <Icon size={13} strokeWidth={isActive ? 2.5 : 2} />
            <span className="desktop-only">{p.label}</span>
          </Link>
        )
      })}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <span
          className="desktop-only"
          style={{
            fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.55)',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 999, padding: '4px 10px', letterSpacing: '0.03em',
          }}
        >
          Dev Preview
        </span>

        {/* DB Connection Test Button */}
        <button
          onClick={checkDatabaseConnection}
          disabled={loading}
          className="page-tab"
          style={{
            background: 'rgba(16, 185, 129, 0.14)', color: '#34D399',
            border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 700,
          }}
        >
          <Database size={12} /> <span className="desktop-only">{loading ? 'Testing…' : 'Test Supabase DB'}</span>
        </button>
      </div>

      {dbStatus && (
        <div style={{
          position: 'fixed', top: 58, right: 20, zIndex: 99999,
          background: 'var(--overlay)', color: '#ffffff', border: '1px solid var(--emerald)',
          padding: '12px 18px', borderRadius: 10, fontSize: 12.5, fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)', maxWidth: 460, display: 'flex', alignItems: 'flex-start', gap: 12
        }}>
          <div style={{ flex: 1, lineHeight: 1.5 }}>{dbStatus}</div>
          <button onClick={() => setDbStatus(null)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}
    </div>
  )
}
