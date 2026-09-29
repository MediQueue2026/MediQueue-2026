import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, ShieldAlert, ShieldCheck } from 'lucide-react'
import { ApiError, ApiOfflineError } from '../../lib/api'
import { HOME_PATH, useAuth } from '../../context/AuthContext'
import ForgotPasswordModal from '../../components/ForgotPasswordModal'

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showForgotModal, setShowForgotModal] = useState(false)

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
    height: 44,
    fontSize: 14,
    background: '#1e293b',
    borderColor: '#334155',
    color: '#f8fafc',
  } as const

  return (
    <div className="auth-screen" style={{
      background: 'radial-gradient(circle at 15% 15%, rgba(220, 38, 38, 0.15), transparent 45%), radial-gradient(circle at 85% 85%, rgba(15, 23, 42, 0.8), transparent 45%), linear-gradient(145deg, #020617 0%, #0f172a 50%, #020617 100%)'
    }}>
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        initialEmail={email}
      />

      <div className="auth-card" style={{
        background: '#0f172a', borderColor: '#334155',
        boxShadow: '0 30px 80px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(239, 68, 68, 0.2)'
      }}>

        {/* ── Context Side Panel ── */}
        <aside className="auth-aside" style={{ background: 'linear-gradient(155deg, #020617 0%, #1e1b4b 50%, #0f172a 100%)', borderColor: '#1e293b' }}>
          <div className="auth-aside-glow" style={{ background: 'radial-gradient(circle, rgba(220, 38, 38, 0.35), transparent 70%)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img src="/logo.png" alt="MediQueue" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em', color: '#f8fafc' }}>
              MediQueue Admin
            </span>
          </div>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 32 }} />

          <div className="auth-aside-badge" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(220, 38, 38, 0.2)', border: '1px solid rgba(220, 38, 38, 0.4)',
            borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#fca5a5',
            width: 'fit-content', marginBottom: 14
          }}>
            <ShieldAlert size={13} /> Restricted Security Zone
          </div>

          <h1 style={{
            fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2,
            marginLeft: 'auto', marginRight: 'auto', width: '100%', color: '#f8fafc',
          }}>
            System Administrator Console
          </h1>
          <p className="auth-aside-desc" style={{
            fontSize: 13, lineHeight: 1.6, color: '#94a3b8',
            marginTop: 12, maxWidth: '34ch',
          }}>
            Platform control center for approving medical center registrations, managing staff access, and auditing system logs.
          </p>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 32 }} />

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

        {/* ── Form Pane ── */}
        <div className="auth-form-pane" style={{ background: '#0f172a' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            background: 'rgba(220, 38, 38, 0.15)', border: '1px solid rgba(220, 38, 38, 0.3)',
            borderRadius: 8, width: 'fit-content', marginBottom: 14,
          }}>
            <Lock size={12} color="#ef4444" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Authorized Personnel Only
            </span>
          </div>

          <h2 style={{ fontSize: 21, fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
            System Admin Sign-In
          </h2>
          <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 4, lineHeight: 1.45 }}>
            All administrative access and authentication attempts are logged for security auditing.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
            <div>
              <label className="auth-field-label" htmlFor="admin-email" style={{ color: '#cbd5e1' }}>Admin Username / Email</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="#64748b" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="admin-email" className="input" type="email" required autoComplete="username"
                  placeholder="admin@mediqueue.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  style={{ ...inputStyle, paddingLeft: 38 }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="auth-field-label" htmlFor="admin-password" style={{ color: '#cbd5e1', margin: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  style={{
                    background: 'transparent', border: 'none', color: '#fca5a5',
                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0
                  }}
                >
                  Forgot Password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="#64748b" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="admin-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  style={{ ...inputStyle, paddingLeft: 38, paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer',
                    padding: 4, display: 'grid', placeItems: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
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
                width: '100%', height: 44, fontSize: 14.5, fontWeight: 700, borderRadius: 10,
                background: '#DC2626', color: '#fff', gap: 7, marginTop: 4,
                opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
                justifyContent: 'center'
              }}
            >
              {submitting ? 'Authenticating Admin…' : <><span>Authenticate & Access Console</span> <ArrowRight size={15} /></>}
            </button>
          </form>

          <div style={{
            marginTop: 20, paddingTop: 14, borderTop: '1px solid #334155',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8',
          }}>
            <span>Demo Admin Credentials:</span>
            <button
              type="button"
              onClick={() => { setEmail('admin@mediqueue.com'); setPassword('admin123'); setError('') }}
              style={{
                background: 'rgba(220, 38, 38, 0.15)', color: '#fca5a5', border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: 8, padding: '5px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Autofill Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
