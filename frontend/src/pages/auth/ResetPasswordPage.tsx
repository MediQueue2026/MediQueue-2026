import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, Lock } from 'lucide-react'
import { api, ApiError, ApiOfflineError } from '../../lib/api'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Missing reset token. Please request a new password reset link.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      await api.resetPassword(token, newPassword)
      setSuccess(true)
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setError('Cannot reach MediQueue server. Please verify your connection.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to reset password. The link may have expired.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">

        {/* ── Context Side Panel ── */}
        <aside className="auth-aside">
          <div className="auth-aside-glow" />

          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img src="/logo.png" alt="MediQueue" style={{ height: 28, width: 'auto', objectFit: 'contain' }} />
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>MediQueue</span>
          </div>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 28 }} />

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#6ee7b7',
            width: 'fit-content', marginBottom: 14
          }}>
            <KeyRound size={13} /> Account Security
          </div>

          <h1 style={{
            fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2,
            marginLeft: 'auto', marginRight: 'auto', width: '100%',
          }}>
            Create New Password
          </h1>
          <p className="auth-aside-desc" style={{
            fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.65)',
            marginTop: 10, maxWidth: '34ch',
          }}>
            Choose a strong, unique password with at least 8 characters to protect your account.
          </p>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 28 }} />

          <Link
            to="/login"
            className="auth-aside-back"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
              fontSize: 12.5, color: 'rgba(255,255,255,0.55)', width: 'fit-content',
            }}
          >
            <ArrowLeft size={13} /> Return to Sign In
          </Link>
        </aside>

        {/* ── Form Pane ── */}
        <div className="auth-form-pane">
          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981', display: 'grid', placeItems: 'center', margin: '0 auto 16px',
                border: '1px solid rgba(16, 185, 129, 0.3)'
              }}>
                <CheckCircle2 size={32} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
                Password Reset Successfully!
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
                Your account password has been updated. You can now sign in with your new credentials.
              </p>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="btn btn-primary"
                style={{ width: '100%', height: 44, marginTop: 24, justifyContent: 'center', fontWeight: 700 }}
              >
                Sign In to Your Account <ArrowRight size={15} />
              </button>
            </div>
          ) : !token ? (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444', display: 'grid', placeItems: 'center', margin: '0 auto 16px',
                border: '1px solid rgba(239, 68, 68, 0.25)'
              }}>
                <AlertCircle size={30} />
              </div>
              <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-1)' }}>Invalid Reset Link</h2>
              <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
                This password reset link is missing a security token or is invalid. Please request a new link from the login page.
              </p>
              <Link
                to="/login"
                className="btn btn-primary"
                style={{ width: '100%', height: 44, marginTop: 24, justifyContent: 'center', fontWeight: 700, textDecoration: 'none' }}
              >
                Go to Sign In
              </Link>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Lock size={15} color="#4F46E5" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#4F46E5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Secure Reset
                </span>
              </div>

              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
                Set Your New Password
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 4 }}>
                Enter your new password below. Must be at least 8 characters.
              </p>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
                <div>
                  <label className="auth-field-label" htmlFor="new-password">New Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="new-password"
                      className="input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setError('') }}
                      style={{ height: 44, paddingRight: 40, fontSize: 14 }}
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

                <div>
                  <label className="auth-field-label" htmlFor="confirm-password">Confirm New Password</label>
                  <input
                    id="confirm-password"
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                    style={{ height: 44, fontSize: 14 }}
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
                  className="btn btn-primary"
                  style={{
                    width: '100%', height: 44, fontSize: 14.5, fontWeight: 700, borderRadius: 10,
                    gap: 7, marginTop: 6, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
                    justifyContent: 'center'
                  }}
                >
                  {submitting ? 'Updating Password…' : <><span>Save New Password</span> <ArrowRight size={15} /></>}
                </button>
              </form>

              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <Link to="/login" style={{ fontSize: 12.5, color: 'var(--text-4)', textDecoration: 'none' }}>
                  Remembered your password? <strong style={{ color: '#4F46E5' }}>Sign in</strong>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
