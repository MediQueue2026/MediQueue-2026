import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react'
import { ApiError, ApiOfflineError } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'

const MIN_PASSWORD_LENGTH = 8

export default function MedicalCenterSignupPage() {
  const navigate = useNavigate()
  const { register, logout } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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
      await logout()
      navigate('/staff/login/receptionist', {
        replace: true,
        state: { message: 'Account created. Sign in to complete your medical center registration.' },
      })
    } catch (err) {
      if (err instanceof ApiOfflineError) setError('Cannot reach the MediQueue server. Start the backend and try again.')
      else setError(err instanceof ApiError ? err.message : 'Could not create your account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <aside className="auth-aside">
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg, var(--teal), var(--blue))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={16} color="#fff" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 800 }}>MediQueue</span>
          </div>
          <div style={{ flex: 1 }} />
          <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15 }}>Register a medical center</h1>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)', marginTop: 10 }}>
            Create receptionist credentials first. After sign-in, complete the official center details for Super Admin approval.
          </p>
          <div style={{ flex: 1 }} />
          <Link to="/staff/login/receptionist" className="auth-aside-back" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>
            <ArrowLeft size={13} /> Back to staff login
          </Link>
        </aside>

        <div className="auth-form-pane">
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)' }}>Medical Center Sign-up</h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, lineHeight: 1.5 }}>
            Email and password are required. Center details are collected after login.
          </p>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
            <div>
              <label className="auth-field-label" htmlFor="center-signup-email">Email Address</label>
              <input id="center-signup-email" className="input" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} style={{ height: 44 }} />
            </div>
            <div>
              <label className="auth-field-label" htmlFor="center-signup-password">Password</label>
              <input id="center-signup-password" className="input" type="password" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} style={{ height: 44 }} />
            </div>
            <div>
              <label className="auth-field-label" htmlFor="center-signup-confirm">Confirm Password</label>
              <input id="center-signup-confirm" className="input" type="password" required autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} style={{ height: 44 }} />
            </div>
            {error && <div role="alert" style={{ display: 'flex', gap: 8, color: 'var(--crimson)', background: 'var(--crimson-dim)', border: '1px solid var(--crimson-border)', borderRadius: 9, padding: '9px 11px', fontSize: 12.5, fontWeight: 600 }}><AlertCircle size={14} /> {error}</div>}
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ height: 44, justifyContent: 'center', opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Creating account…' : <>Create Account <ArrowRight size={15} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
