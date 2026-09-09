import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Activity, AlertCircle, ArrowLeft, ArrowRight, CloudOff } from 'lucide-react'
import { ApiError, ApiOfflineError } from '../../lib/api'
import { HOME_PATH, useAuth } from '../../context/AuthContext'
import type { UserRole } from '../../context/AuthContext'

const ACCENT = '#4F46E5' // Indigo

export default function PatientLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, backendOffline } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(backendOffline)

  const destinationFor = (signedInRole: Exclude<UserRole, null>) =>
    (location.state as { from?: string } | null)?.from ?? HOME_PATH[signedInRole]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = await login(email.trim(), password)
      navigate(destinationFor((user.role ?? 'patient') as Exclude<UserRole, null>), { replace: true })
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setOffline(true)
        setError('Cannot reach the MediQueue server. Check your connection or start the backend.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Sign-in failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = { height: 42, fontSize: 14 } as const

  return (
    <div className="auth-screen">
      <div className="auth-card">

        {/* ── Context Panel ── */}
        <aside className="auth-aside">
          <div className="auth-aside-glow" style={{ background: `radial-gradient(circle, ${ACCENT}55, transparent 70%)` }} />

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
            Patient Portal
          </h1>
          <p className="auth-aside-desc" style={{
            fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)',
            marginTop: 10, maxWidth: '34ch',
          }}>
            Book doctor appointments, track live queue positions, and view your prescription history.
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

        {/* ── Form Pane ── */}
        <div className="auth-form-pane">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Patient Sign-In
            </span>
            <Link to="/staff/login" style={{ fontSize: 12, color: 'var(--text-4)', textDecoration: 'none' }}>
              Healthcare Staff?
            </Link>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Welcome Back
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 4 }}>
            Sign in to access your personal dashboard and appointment tokens.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
            <div>
              <label className="auth-field-label" htmlFor="patient-email">Email Address</label>
              <input
                id="patient-email" className="input" type="email" required autoComplete="username"
                placeholder="patient@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                style={inputStyle}
              />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <label className="auth-field-label" htmlFor="patient-password">Password</label>
              </div>
              <input
                id="patient-password" className="input" type="password" required
                autoComplete="current-password"
                placeholder="••••••••"
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
                background: ACCENT, color: '#fff', gap: 7, marginTop: 4,
                opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {submitting ? 'Signing in…' : <><span>Sign In</span> <ArrowRight size={15} /></>}
            </button>

            {offline && (
              <div style={{
                border: '1px dashed var(--amber-border)', background: 'var(--amber-dim)',
                borderRadius: 9, padding: '11px 12px', fontSize: 12, color: 'var(--text-3)',
              }}>
                <CloudOff size={13} style={{ marginBottom: 4, color: 'var(--amber)' }} /> Backend offline. Please start Node backend server.
              </div>
            )}
          </form>

          {/* Registration link */}
          <div style={{
            marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle, #f3f4f6)',
            textAlign: 'center', fontSize: 13, color: 'var(--text-3)',
          }}>
            New to MediQueue?{' '}
            <Link
              to="/register"
              state={(location.state as { from?: string } | null) ?? undefined}
              style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}
            >
              Create a Patient Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
