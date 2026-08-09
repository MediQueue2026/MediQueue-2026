import React, { useState } from 'react'
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import {
  Activity, AlertCircle, ArrowLeft, ArrowRight, CloudOff, FlaskConical,
} from 'lucide-react'
import { HOME_PATH, useAuth } from '../../context/AuthContext'
import type { UserRole } from '../../context/AuthContext'
import { ApiError, ApiOfflineError } from '../../lib/api'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '../../lib/demoAccounts'

interface LoginPageProps {
  forcedRole?: UserRole
}

type Role = Exclude<UserRole, null>

/**
 * One sign-in screen, four portals.
 *
 * The layout is a split rather than a single column: the left panel carries the
 * portal's identity and the right carries the task. That's what keeps the card
 * short — the previous version stacked an icon tile, an eyebrow, a title, a
 * subtitle, the form, a create-account line, a demo block, a four-link portal
 * switcher and a back link on one vertical axis, and named the portal four
 * separate times on the way down.
 */

/**
 * `accent` doubles as button background behind white text and as link text on
 * white, so each one is the shade that clears 4.5:1 both ways. The lighter
 * emerald/amber/red these started from sat at 2.1-3.8:1 against white.
 */
const PORTALS: Array<{ role: Role; tab: string; name: string; blurb: string; accent: string }> = [
  {
    role: 'patient',
    tab: 'Patient',
    name: 'Patient Portal',
    blurb: 'Track your token, book appointments, and read your records.',
    accent: '#4F46E5',
  },
  {
    role: 'doctor',
    tab: 'Doctor',
    name: 'Doctor Console',
    blurb: 'Call patients, record consultations, and publish delay notices.',
    accent: '#047857',
  },
  {
    role: 'receptionist',
    tab: 'Reception',
    name: 'Reception Desk',
    blurb: 'Issue walk-in tokens, run the counter queue, and send SMS alerts.',
    accent: '#B45309',
  },
  {
    role: 'admin',
    tab: 'Admin',
    name: 'System Admin',
    blurb: 'Manage staff accounts, slot limits, centres, and audit logs.',
    accent: '#B91C1C',
  },
]

const PORTAL_PATH: Record<Role, string> = {
  patient: '/login',
  doctor: '/login/doctor',
  receptionist: '/login/receptionist',
  admin: '/login/admin',
}

export default function LoginPage({ forcedRole }: LoginPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { login, register, loginAsDemo, backendOffline } = useAuth()

  const role: Role = forcedRole
    ?? (location.pathname.includes('doctor') ? 'doctor'
      : location.pathname.includes('receptionist') ? 'receptionist'
      : location.pathname.includes('admin') ? 'admin'
      : 'patient')

  const portal = PORTALS.find(p => p.role === role)!

  const [mode, setMode] = useState<'signin' | 'signup'>(
    searchParams.get('new') === '1' ? 'signup' : 'signin',
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(backendOffline)

  /** Back to where they were headed before the guard bounced them, else the role's home. */
  const destinationFor = (signedInRole: Role) =>
    (location.state as { from?: string } | null)?.from ?? HOME_PATH[signedInRole]

  const handleFailure = (err: unknown, fallback: string) => {
    if (err instanceof ApiOfflineError) {
      setOffline(true)
      setError('Cannot reach the MediQueue server. Start the backend, or continue in demo mode.')
    } else {
      setError(err instanceof ApiError ? err.message : fallback)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = mode === 'signup'
        ? await register({
            email: email.trim(),
            password,
            fullName: fullName.trim(),
            phone: phone.trim() || undefined,
            role, // the portal you signed up on decides the account's role
          })
        : await login(email.trim(), password)
      navigate(destinationFor(user.role as Role), { replace: true })
    } catch (err) {
      handleFailure(err, mode === 'signup' ? 'Could not create your account.' : 'Sign-in failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /** Signs in as this portal's seeded account through the ordinary login call. */
  const handleDemoAccount = async () => {
    setError('')
    setSubmitting(true)
    try {
      const user = await login(DEMO_ACCOUNTS[role].email, DEMO_PASSWORD)
      navigate(destinationFor(user.role as Role), { replace: true })
    } catch (err) {
      handleFailure(err, 'Demo sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  /** Offline escape hatch — a local session, only when the API is unreachable. */
  const handleOfflineDemo = () => {
    const user = loginAsDemo(role)
    navigate(destinationFor(user.role as Role), { replace: true })
  }

  const inputStyle = { height: 42, fontSize: 14 } as const

  return (
    <div className="auth-screen">
      <div className="auth-card">

        {/* ── Context ── */}
        <aside className="auth-aside">
          <div className="auth-aside-glow" style={{ background: `radial-gradient(circle, ${portal.accent}55, transparent 70%)` }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, var(--teal), var(--blue))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={16} color="#fff" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>MediQueue</span>
          </div>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 28 }} />

          <h1 style={{
            fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15,
            marginLeft: 'auto', marginRight: 'auto', width: '100%',
          }}>
            {portal.name}
          </h1>
          <p className="auth-aside-desc" style={{
            fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)',
            marginTop: 10, maxWidth: '34ch',
          }}>
            {portal.blurb}
          </p>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 28 }} />

          <Link
            to="/"
            className="auth-aside-back"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
              fontSize: 12.5, color: 'rgba(255,255,255,0.55)', width: 'fit-content',
            }}
          >
            <ArrowLeft size={13} /> Back to MediQueue
          </Link>
        </aside>

        {/* ── Task ── */}
        <div className="auth-form-pane">
          {/* Switching portal is navigation, so it sits above the form rather
              than in a link cluster underneath it. */}
          <nav className="auth-tabs" aria-label="Choose portal">
            {PORTALS.map(p => (
              <Link
                key={p.role}
                to={PORTAL_PATH[p.role]}
                className={`auth-tab ${p.role === role ? 'active' : ''}`}
                aria-current={p.role === role ? 'page' : undefined}
                style={p.role === role ? { color: p.accent } : undefined}
              >
                {p.tab}
              </Link>
            ))}
          </nav>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            {mode === 'signup' ? 'Create your account' : 'Sign in'}
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 18 }}>
            {mode === 'signup' && (
              <>
                <div>
                  <label className="auth-field-label" htmlFor="auth-name">Full name</label>
                  <input
                    id="auth-name" className="input" required autoComplete="name"
                    placeholder="Sunil Perera"
                    value={fullName}
                    onChange={e => { setFullName(e.target.value); setError('') }}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="auth-field-label" htmlFor="auth-phone">
                    Mobile <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>· for queue SMS</span>
                  </label>
                  <input
                    id="auth-phone" className="input" autoComplete="tel"
                    placeholder="0771234567"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </>
            )}

            <div>
              <label className="auth-field-label" htmlFor="auth-email">Email</label>
              <input
                id="auth-email" className="input" type="email" required autoComplete="username"
                placeholder={DEMO_ACCOUNTS[role].email}
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                style={inputStyle}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <label className="auth-field-label" htmlFor="auth-password">Password</label>
                {mode === 'signin' && (
                  <button type="button" style={{
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontSize: 11.5, color: 'var(--text-4)', marginBottom: 6,
                  }}>
                    Forgot?
                  </button>
                )}
              </div>
              <input
                id="auth-password" className="input" type="password" required
                minLength={mode === 'signup' ? 8 : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                style={inputStyle}
              />
            </div>

            {error && (
              <div role="alert" style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, fontWeight: 600,
                color: 'var(--crimson)', background: 'var(--crimson-dim)',
                border: '1px solid var(--crimson-border)', borderRadius: 9, padding: '9px 11px',
                lineHeight: 1.45,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn"
              style={{
                width: '100%', height: 44, fontSize: 14.5, fontWeight: 700, borderRadius: 9,
                background: portal.accent, color: '#fff', gap: 7, marginTop: 3,
                opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {submitting
                ? (mode === 'signup' ? 'Creating account…' : 'Signing in…')
                : <>{mode === 'signup' ? 'Create account' : 'Sign in'} <ArrowRight size={15} /></>}
            </button>

            <p style={{ fontSize: 12.5, color: 'var(--text-4)', textAlign: 'center', margin: '2px 0 0' }}>
              {mode === 'signin' ? "Don't have an account? " : 'Already registered? '}
              <button
                type="button"
                onClick={() => { setMode(m => (m === 'signin' ? 'signup' : 'signin')); setError('') }}
                style={{
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  color: portal.accent, fontWeight: 700, fontSize: 12.5,
                }}
              >
                {mode === 'signin' ? 'Create one' : 'Sign in'}
              </button>
            </p>

            {offline && (
              <div style={{
                border: '1px dashed var(--amber-border)', background: 'var(--amber-dim)',
                borderRadius: 9, padding: '11px 12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--amber)', marginBottom: 5 }}>
                  <CloudOff size={13} /> Backend offline
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 9 }}>
                  Explore with bundled sample data. Nothing will be saved.
                </div>
                <button type="button" onClick={handleOfflineDemo} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                  Continue in demo mode
                </button>
              </div>
            )}
          </form>

          {/* Testing shortcut — deliberately quieter than the primary action. */}
          <div className="auth-demo">
            <span style={{ minWidth: 0, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Demo · {DEMO_ACCOUNTS[role].email}
            </span>
            <button
              type="button"
              onClick={handleDemoAccount}
              disabled={submitting}
              className="btn btn-ghost btn-sm"
              style={{ gap: 5, flexShrink: 0 }}
            >
              <FlaskConical size={12} /> Use
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
