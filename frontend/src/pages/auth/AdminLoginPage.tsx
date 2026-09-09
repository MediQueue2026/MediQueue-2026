import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { ShieldCheck, AlertCircle, ArrowLeft, ArrowRight, Lock } from 'lucide-react'
import { ApiError, ApiOfflineError } from '../../lib/api'
import { HOME_PATH, useAuth } from '../../context/AuthContext'

const ACCENT = '#DC2626' // Red / Dark Crimson for System Admin Security

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const destinationFor = () =>
    (location.state as { from?: string } | null)?.from ?? HOME_PATH.admin

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = await login(email.trim(), password)
      if (user.role !== 'admin') {
        setError('Access denied. Administrator privileges required.')
        return
      }
      navigate(destinationFor(), { replace: true })
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setError('Cannot reach MediQueue authentication server.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Invalid administrator credentials.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    height: 42,
    fontSize: 14,
    background: '#1e293b',
    borderColor: '#334155',
    color: '#f8fafc',
  } as const

  return (
    <div className="auth-screen" style={{ background: '#0f172a' }}>
      <div className="auth-card" style={{ background: '#1e293b', borderColor: '#334155', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>

        {/* ── Context ── */}
        <aside className="auth-aside" style={{ background: '#020617', borderColor: '#1e293b' }}>
          <div className="auth-aside-glow" style={{ background: `radial-gradient(circle, ${ACCENT}55, transparent 70%)` }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #dc2626, #991b1b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <ShieldCheck size={18} color="#fff" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em', color: '#f8fafc' }}>
              MediQueue Admin
            </span>
          </div>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 28 }} />

          <h1 style={{
            fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2,
            marginLeft: 'auto', marginRight: 'auto', width: '100%', color: '#f8fafc',
          }}>
            System Administrator Access
          </h1>
          <p className="auth-aside-desc" style={{
            fontSize: 13, lineHeight: 1.6, color: '#94a3b8',
            marginTop: 10, maxWidth: '34ch',
          }}>
            Platform control center for approving medical center registrations, managing staff accounts, and auditing system logs.
          </p>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 28 }} />

          <Link
            to="/"
            className="auth-aside-back"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
              fontSize: 12.5, color: '#64748b', width: 'fit-content',
            }}
          >
            <ArrowLeft size={13} /> Back to MediQueue
          </Link>
        </aside>

        {/* ── Task Pane ── */}
        <div className="auth-form-pane" style={{ background: '#0f172a' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
            background: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: 6, width: 'fit-content', marginBottom: 14,
          }}>
            <Lock size={12} color="#ef4444" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Restricted Security Zone
            </span>
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            System Admin Sign-In
          </h2>
          <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 4, lineHeight: 1.45 }}>
            Authorized Super Administrators only. All authentication attempts are logged for security auditing.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
            <div>
              <label className="auth-field-label" htmlFor="admin-email" style={{ color: '#cbd5e1' }}>Admin Username / Email</label>
              <input
                id="admin-email" className="input" type="email" required autoComplete="username"
                placeholder="admin@mediqueue.com"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="auth-field-label" htmlFor="admin-password" style={{ color: '#cbd5e1' }}>Password</label>
              <input
                id="admin-password" className="input" type="password" required autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                style={inputStyle}
              />
            </div>

            {error && (
              <div role="alert" style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5, fontWeight: 600,
                color: '#fca5a5', background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 9, padding: '9px 11px',
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
              {submitting ? 'Authenticating Admin…' : <><span>Authenticate & Access Console</span> <ArrowRight size={15} /></>}
            </button>
          </form>

          <div style={{
            marginTop: 18, paddingTop: 12, borderTop: '1px solid #334155',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8',
          }}>
            <span>Demo Admin Credentials:</span>
            <button
              type="button"
              onClick={() => { setEmail('admin@mediqueue.com'); setPassword('admin123'); setError('') }}
              style={{
                background: 'rgba(220, 38, 38, 0.15)', color: '#fca5a5', border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Autofill Credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
