import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Database, Home, MonitorPlay, ShieldCheck, Stethoscope, Ticket, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import type { UserRole } from '../context/AuthContext'
import { ApiOfflineError } from '../lib/api'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../lib/demoAccounts'

/**
 * `role` is the account a page needs. Clicking the tab signs in as that role's
 * demo account first, so jumping straight to a console never lands on the login
 * screen. `null` means the page is public.
 */
const PAGES: Array<{ path: string; label: string; icon: typeof Home; role: Exclude<UserRole, null> | null }> = [
  { path: '/',             label: 'Public Landing',    icon: Home,        role: null },
  { path: '/patient',      label: 'Patient Dashboard', icon: User,        role: 'patient' },
  { path: '/doctor',       label: 'Doctor Panel',      icon: Stethoscope, role: 'doctor' },
  { path: '/receptionist', label: 'Receptionist Desk', icon: Ticket,      role: 'receptionist' },
  { path: '/admin',        label: 'System Admin',      icon: ShieldCheck, role: 'admin' },
  { path: '/tv-display',   label: 'Queue TV',          icon: MonitorPlay, role: null },
]

/**
 * Development-only page switcher.
 *
 * ⚠️  This bar signs itself in as any role on a single click, including admin.
 *     It exists to make building the four consoles quick and must not ship to
 *     real users — drop <DevNavbar /> from App.tsx before this goes live.
 */
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
      setDbStatus(`⚠️ Connection Failed: Make sure backend server is running on port 5000 (run "npm run dev" inside backend/ folder)`)
    } finally {
      setLoading(false)
    }
  }

  /**
   * An admin already passes every guard, so switching accounts under them would
   * throw away a session they chose deliberately. Anyone else needs the exact
   * role — a receptionist clicking "Doctor Panel" gets signed in as the doctor.
   */
  const needsSwitch = (role: Exclude<UserRole, null> | null) => {
    if (!role) return false
    if (!user) return true
    return user.role !== role && user.role !== 'admin'
  }

  const handleNavigate = async (
    e: React.MouseEvent,
    path: string,
    role: Exclude<UserRole, null> | null,
  ) => {
    // Let the browser handle ⌘/ctrl-click and middle-click as a new tab.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return

    e.preventDefault()
    if (switchingTo) return

    if (!needsSwitch(role)) {
      navigate(path)
      return
    }

    const account = DEMO_ACCOUNTS[role!]
    setSwitchingTo(path)
    try {
      await login(account.email, DEMO_PASSWORD)
      navigate(path)
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        // No backend in this preview — fall back to the local demo session so
        // the page is still reachable.
        loginAsDemo(role!)
        navigate(path)
      } else {
        setDbStatus(
          `⚠️ Could not sign in as ${account.email}. Run backend/src/db/migrations/003_auth.sql, ` +
          `or sign in manually from the login page.`,
        )
      }
    } finally {
      setSwitchingTo(null)
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
        const isSwitching = switchingTo === p.path
        return (
          <Link
            key={p.path}
            to={p.path}
            onClick={e => handleNavigate(e, p.path, p.role)}
            className={`page-tab ${isActive ? 'active' : ''}`}
            style={{ textDecoration: 'none', opacity: isSwitching ? 0.6 : 1 }}
            title={p.role ? `Opens as ${DEMO_ACCOUNTS[p.role].name} (${p.role})` : undefined}
          >
            <Icon size={13} strokeWidth={isActive ? 2.5 : 2} />
            <span className="desktop-only">{isSwitching ? 'Signing in…' : p.label}</span>
          </Link>
        )
      })}

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Who the dev bar has you signed in as — otherwise it's easy to test a
            console while unknowingly carrying another role's session. */}
        <span
          className="desktop-only"
          style={{
            fontSize: 10.5, fontWeight: 700,
            color: user ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 999, padding: '4px 10px', letterSpacing: '0.03em',
            whiteSpace: 'nowrap',
          }}
          title={user?.email}
        >
          {user ? `${user.name} · ${user.role}` : 'Signed out'}
        </span>

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
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)', maxWidth: 460, display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <div style={{ flex: 1, lineHeight: 1.5 }}>{dbStatus}</div>
          <button onClick={() => setDbStatus(null)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}
    </div>
  )
}
