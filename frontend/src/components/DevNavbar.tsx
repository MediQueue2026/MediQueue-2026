import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Database, Home, MonitorPlay, ShieldCheck, Stethoscope, LogIn, UserPlus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../context/AuthContext'
import { ApiOfflineError } from '../lib/api'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../lib/demoAccounts'

interface DevPage {
  path: string
  label: string
  icon: any
  role: Exclude<UserRole, null> | null
  targetConsole?: string
}

const PAGES: DevPage[] = [
  { path: '/',             label: 'Landing',         icon: Home,        role: null },
  { path: '/login',        label: 'Patient Portal',  icon: LogIn,       role: 'patient',      targetConsole: '/patient' },
  { path: '/register',     label: 'Patient Sign-up', icon: UserPlus,    role: null },
  { path: '/staff/login',  label: 'Staff Portal',    icon: Stethoscope, role: 'receptionist', targetConsole: '/receptionist' },
  { path: '/admin/login',  label: 'Admin Portal',    icon: ShieldCheck, role: 'admin',        targetConsole: '/admin' },
  { path: '/tv-display',   label: 'Queue TV Board',  icon: MonitorPlay, role: null },
]

export function DevNavbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, login, loginAsDemo } = useAuth()

  const [dbStatus, setDbStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)

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
    } catch {
      setDbStatus(`⚠️ Connection Failed: Backend server on port 5000 is not reachable.`)
    } finally {
      setLoading(false)
    }
  }

  const handleNavigate = async (
    e: React.MouseEvent,
    path: string,
    role: Exclude<UserRole, null> | null,
    targetConsole?: string
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()

    // If already signed in as the required role and targetConsole is defined, go straight to console
    if (role && user?.role === role && targetConsole) {
      navigate(targetConsole)
      return
    }

    // Otherwise navigate to the requested portal path
    navigate(path)
  }

  const handleQuickDemo = async (role: Exclude<UserRole, null>, consolePath: string) => {
    if (switchingTo) return
    const account = DEMO_ACCOUNTS[role]
    setSwitchingTo(consolePath)
    try {
      await login(account.email, DEMO_PASSWORD)
      navigate(consolePath)
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        loginAsDemo(role)
        navigate(consolePath)
      } else {
        setDbStatus(`⚠️ Could not sign in as ${account.email}. Try manual login.`)
      }
    } finally {
      setSwitchingTo(null)
    }
  }

  return (
    <div className="page-switcher" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, height: 46, padding: '0 14px' }}>
      {/* App Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16, flexShrink: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: 'linear-gradient(135deg, var(--teal), var(--blue))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
        }}>
          <Activity size={14} color="#fff" strokeWidth={2.5} />
        </div>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>MediQueue</span>
      </div>

      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', marginRight: 8 }} className="desktop-only" />

      {/* Main Single-Set Navigation Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
        {PAGES.map(p => {
          const Icon = p.icon
          const isActive = location.pathname === p.path || (p.targetConsole && location.pathname.startsWith(p.targetConsole))
          return (
            <Link
              key={p.path}
              to={p.path}
              onClick={e => handleNavigate(e, p.path, p.role, p.targetConsole)}
              className={`page-tab ${isActive ? 'active' : ''}`}
              style={{
                textDecoration: 'none',
                padding: '5px 11px',
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                borderRadius: 7,
              }}
            >
              <Icon size={13} strokeWidth={isActive ? 2.5 : 2} />
              <span className="desktop-only">{p.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Quick Demo Shortcuts & DB Status */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }} className="desktop-only">
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, paddingRight: 4 }}>DEMO CONSOLES:</span>
          <button onClick={() => handleQuickDemo('patient', '/patient')} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '2px 4px' }}>Patient</button>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>|</span>
          <button onClick={() => handleQuickDemo('doctor', '/doctor')} style={{ background: 'none', border: 'none', color: '#34d399', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '2px 4px' }}>Doctor</button>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>|</span>
          <button onClick={() => handleQuickDemo('receptionist', '/receptionist')} style={{ background: 'none', border: 'none', color: '#fbbf24', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '2px 4px' }}>Reception</button>
          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>|</span>
          <button onClick={() => handleQuickDemo('admin', '/admin')} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '2px 4px' }}>Admin</button>
        </div>

        <button
          onClick={checkDatabaseConnection}
          disabled={loading}
          className="page-tab"
          style={{
            background: 'rgba(16, 185, 129, 0.14)', color: '#34D399',
            border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 700, padding: '4px 9px', fontSize: 11,
          }}
        >
          <Database size={11} /> <span className="desktop-only">{loading ? 'Testing…' : 'DB Check'}</span>
        </button>
      </div>

      {dbStatus && (
        <div style={{
          position: 'fixed', top: 52, right: 16, zIndex: 99999,
          background: 'var(--overlay)', color: '#ffffff', border: '1px solid var(--emerald)',
          padding: '10px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)', maxWidth: 420, display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <div style={{ flex: 1, lineHeight: 1.45 }}>{dbStatus}</div>
          <button onClick={() => setDbStatus(null)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 13 }}>✕</button>
        </div>
      )}
    </div>
  )
}
