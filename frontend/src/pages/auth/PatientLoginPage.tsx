import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, CloudOff, Eye, EyeOff, HeartPulse, Lock, Mail, ShieldCheck } from 'lucide-react'
import { ApiError, ApiOfflineError } from '../../lib/api'
import { HOME_PATH, useAuth } from '../../context/AuthContext'
import type { UserRole } from '../../context/AuthContext'
import GoogleAuthButton from '../../components/GoogleAuthButton'
import ForgotPasswordModal from '../../components/ForgotPasswordModal'

export default function PatientLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, loginWithGoogle, backendOffline } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(backendOffline)
  const [showForgotModal, setShowForgotModal] = useState(false)

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

  const handleGoogleSuccess = async (credentialOrToken: string, isAccessToken?: boolean) => {
    setError('')
    setGoogleSubmitting(true)
    try {
      const user = await loginWithGoogle(credentialOrToken, isAccessToken)
      navigate(destinationFor((user.role ?? 'patient') as Exclude<UserRole, null>), { replace: true })
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setOffline(true)
        setError('Cannot reach the MediQueue server. Please start the backend service.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.')
      }
    } finally {
      setGoogleSubmitting(false)
    }
  }

  const inputStyle = { height: 44, fontSize: 14 } as const

  return (
    <div className="auth-screen">
      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        initialEmail={email}
      />

      <div className="auth-card">
        {/* ── Context Side Panel ── */}
        <aside className="auth-aside">
          <div className="auth-aside-glow" />

          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img src="/logo.png" alt="MediQueue" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>MediQueue</span>
          </div>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 32 }} />

          <div className="auth-aside-badge" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#6ee7b7',
            width: 'fit-content', marginBottom: 14
          }}>
            <HeartPulse size={13} /> Patient Portal
          </div>

          <h1 style={{
            fontSize: 27, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15,
            marginLeft: 'auto', marginRight: 'auto', width: '100%',
          }}>
            Your Health, Scheduled & Streamlined.
          </h1>
          <p className="auth-aside-desc" style={{
            fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)',
            marginTop: 12, maxWidth: '34ch',
          }}>
            Book top doctor appointments, track live queue positions in real-time, and access your digital medical records.
          </p>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 32 }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link
              to="/"
              className="auth-aside-back"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                fontSize: 12.5, color: 'rgba(255,255,255,0.65)', width: 'fit-content',
              }}
            >
              <ArrowLeft size={13} /> Back to MediQueue
            </Link>
            <div className="auth-aside-badge" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>
              <ShieldCheck size={14} color="#10B981" /> 256-Bit Encrypted
            </div>
          </div>
        </aside>

        {/* ── Form Pane ── */}
        <div className="auth-form-pane">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{
              fontSize: 11.5, fontWeight: 800, color: '#0D9488', textTransform: 'uppercase',
              letterSpacing: '0.06em', background: 'rgba(13, 148, 136, 0.1)', padding: '3px 8px', borderRadius: 6
            }}>
              Patient Sign-In
            </span>
            <Link to="/staff/login" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-4)', textDecoration: 'none' }}>
              Healthcare Staff?
            </Link>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Welcome Back
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 4 }}>
            Sign in to track your queue tokens and appointments.
          </p>

          {/* ── Google 1-Click Login (Patients Only) ── */}
          <div style={{ marginTop: 20 }}>
            <GoogleAuthButton
              onSuccess={handleGoogleSuccess}
              onError={msg => setError(msg)}
              text="Sign in with Google"
              disabled={submitting || googleSubmitting}
            />
          </div>

          <div className="auth-divider">
            <span>Or continue with email</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label className="auth-field-label" htmlFor="patient-email">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="patient-email" className="input" type="email" required autoComplete="username"
                  placeholder="patient@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  style={{ ...inputStyle, paddingLeft: 38 }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="auth-field-label" htmlFor="patient-password" style={{ margin: 0 }}>Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  style={{
                    background: 'transparent', border: 'none', color: '#4F46E5',
                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer', padding: 0
                  }}
                >
                  Forgot Password?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="patient-password"
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
                    background: 'transparent', border: 'none', color: 'var(--text-4)', cursor: 'pointer',
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
                color: 'var(--crimson)', background: 'var(--crimson-dim)',
                border: '1px solid var(--crimson-border)', borderRadius: 9, padding: '9px 11px',
                lineHeight: 1.45,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || googleSubmitting}
              className="btn btn-primary"
              style={{
                width: '100%', height: 44, fontSize: 14.5, fontWeight: 700, borderRadius: 10,
                gap: 7, marginTop: 4, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
                justifyContent: 'center'
              }}
            >
              {submitting ? 'Signing in…' : <><span>Sign In to Patient Portal</span> <ArrowRight size={15} /></>}
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
            marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(30, 41, 59, 0.08)',
            textAlign: 'center', fontSize: 13, color: 'var(--text-3)',
          }}>
            New to MediQueue?{' '}
            <Link
              to="/register"
              state={(location.state as { from?: string } | null) ?? undefined}
              style={{ color: '#0D9488', fontWeight: 700, textDecoration: 'none' }}
            >
              Create a Patient Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
