import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Building2, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react'
import { ApiError, ApiOfflineError } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

const MIN_PASSWORD_LENGTH = 8

export default function MedicalCenterSignupPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const name = email.trim().split('@')[0] || 'Medical Center Receptionist'
      await register({ email: email.trim(), password, fullName: name, role: 'receptionist' })
      navigate('/receptionist', { replace: true })
    } catch (err) {
      if (err instanceof ApiOfflineError) setError('Cannot reach the MediQueue server. Start the backend and try again.')
      else setError(err instanceof ApiError ? err.message : 'Could not create your account.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = { height: 44, fontSize: 14 } as const

  return (
    <div className="auth-screen">
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
            <Building2 size={13} /> Clinic Registration
          </div>

          <h1 style={{
            fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2,
            marginLeft: 'auto', marginRight: 'auto', width: '100%',
          }}>
            Register Your Medical Center
          </h1>
          <p className="auth-aside-desc" style={{
            fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)',
            marginTop: 12, maxWidth: '34ch',
          }}>
            Create receptionist credentials first. After sign-in, you can submit your medical center's official profile, services, and doctor schedules for approval.
          </p>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 32 }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link
              to="/staff/login/receptionist"
              className="auth-aside-back"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
                fontSize: 12.5, color: 'rgba(255,255,255,0.65)', width: 'fit-content',
              }}
            >
              <ArrowLeft size={13} /> Back to Staff Login
            </Link>
            <div className="auth-aside-badge" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'rgba(255,255,255,0.6)' }}>
              <ShieldCheck size={14} color="#10B981" /> Verified Partner
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
              Step 1: Admin Credentials
            </span>
          </div>

          <h2 style={{ fontSize: 21, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Medical Center Sign-Up
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, lineHeight: 1.5 }}>
            Create your clinic administrator login. Clinic branch and facility information will be submitted on your dashboard.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
            <div>
              <label className="auth-field-label" htmlFor="center-signup-email">Official Clinic Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="center-signup-email" className="input" type="email" required autoComplete="email"
                  placeholder="contact@citycareclinic.lk"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  style={{ ...inputStyle, paddingLeft: 38 }}
                />
              </div>
            </div>

            <div>
              <label className="auth-field-label" htmlFor="center-signup-password">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="center-signup-password"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
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

            <div>
              <label className="auth-field-label" htmlFor="center-signup-confirm">Confirm Password</label>
              <input
                id="center-signup-confirm"
                className="input"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError('') }}
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
              className="btn btn-primary"
              style={{
                width: '100%', height: 44, fontSize: 14.5, fontWeight: 700, borderRadius: 10,
                gap: 7, marginTop: 4, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
                justifyContent: 'center'
              }}
            >
              {submitting ? 'Creating Clinic Account…' : <><span>Create Clinic Account</span> <ArrowRight size={15} /></>}
            </button>
          </form>

          <div style={{ marginTop: 18, textAlign: 'center' }}>
            <Link to="/staff/login" style={{ fontSize: 12.5, color: 'var(--text-4)', textDecoration: 'none' }}>
              Already registered? <strong style={{ color: '#0D9488' }}>Sign in to Staff Portal →</strong>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
