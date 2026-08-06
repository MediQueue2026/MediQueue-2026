import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Activity, Database } from 'lucide-react'

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

      {/* DB Connection Test Button */}
      <button
        onClick={checkDatabaseConnection}
        disabled={loading}
        className="page-tab"
        style={{
          marginLeft: 10, background: 'rgba(16, 185, 129, 0.15)', color: '#10B981',
          border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 700, gap: 5,
          display: 'inline-flex', alignItems: 'center'
        }}
      >
        <Database size={11} /> {loading ? 'Testing...' : '⚡ Test Supabase DB'}
      </button>

      {dbStatus && (
        <div style={{
          position: 'fixed', top: 48, right: 20, zIndex: 99999,
          background: '#0d2623', color: '#ffffff', border: '1px solid #10B981',
          padding: '12px 18px', borderRadius: 10, fontSize: 12.5, fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)', maxWidth: 460, display: 'flex', alignItems: 'flex-start', gap: 12
        }}>
          <div style={{ flex: 1, lineHeight: 1.5 }}>{dbStatus}</div>
          <button onClick={() => setDbStatus(null)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-4)', fontWeight: 500 }} className="desktop-only">
        Modular Router Mode · Member Task Split Ready
      </div>
    </div>
  )
}
