import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Building2, CloudOff, Eye, EyeOff, Lock, Mail, ShieldCheck, Stethoscope } from 'lucide-react'
import { ApiError, ApiOfflineError } from '../../lib/api'
import { HOME_PATH, useAuth } from '../../context/AuthContext'
import type { UserRole } from '../../context/AuthContext'
import ForgotPasswordModal from '../../components/ForgotPasswordModal'

type StaffRole = 'doctor' | 'receptionist'

const STAFF_PORTALS: Array<{ role: StaffRole; label: string; title: string; blurb: string; accent: string; icon: any }> = [
  {
    role: 'doctor',
    label: 'Doctor Console',
    title: 'Doctor Consultation Console',
    blurb: 'Manage patient queues, conduct consultations, issue digital prescriptions, and publish delay notices.',
    accent: '#0D9488', // Teal
    icon: Stethoscope,
  },
  {
    role: 'receptionist',
    label: 'Reception Desk',
    title: 'Reception Desk & Queue Control',
    blurb: 'Issue walk-in tokens, manage clinic counter queues, coordinate doctor schedules, and send SMS alerts.',
    accent: '#4F46E5', // Indigo
    icon: Building2,
  },
]

export default function StaffLoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, backendOffline } = useAuth()

  const [activeTab, setActiveTab] = useState<StaffRole>(
    location.pathname.includes('receptionist') ? 'receptionist' : 'doctor'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [notice] = useState((location.state as { message?: string } | null)?.message ?? '')
  const [offline, setOffline] = useState(backendOffline)
  const [showForgotModal, setShowForgotModal] = useState(false)

  const portal = STAFF_PORTALS.find(p => p.role === activeTab)!

  const destinationFor = (signedInRole: Exclude<UserRole, null>) =>
    (location.state as { from?: string } | null)?.from ?? HOME_PATH[signedInRole]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = await login(email.trim(), password)
      navigate(destinationFor((user.role ?? activeTab) as Exclude<UserRole, null>), { replace: true })
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setOffline(true)
        setError('Cannot reach MediQueue server. Check your connection or start the backend.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Sign-in failed. Please verify your staff credentials.')
      }
    } finally {
      setSubmitting(false)
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
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>MediQueue Staff</span>
          </div>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 32 }} />

          <div className="auth-aside-badge" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#6ee7b7',
            width: 'fit-content', marginBottom: 14
          }}>
            <ShieldCheck size={13} /> Clinical Staff Access
          </div>

          <h1 style={{
            fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2,
            marginLeft: 'auto', marginRight: 'auto', width: '100%',
          }}>
            {portal.title}
          </h1>
          <p className="auth-aside-desc" style={{
            fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)',
            marginTop: 12, maxWidth: '34ch',
          }}>
            {portal.blurb}
          </p>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 32 }} />

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
        </aside>

        {/* ── Form Pane ── */}
        <div className="auth-form-pane">
          {/* Tab Switcher */}
          <div style={{
            display: 'flex', gap: 6, background: 'rgba(30, 41, 59, 0.06)',
            padding: 4, borderRadius: 12, marginBottom: 20
          }}>
            {STAFF_PORTALS.map(p => {
              const Icon = p.icon
              const active = p.role === activeTab
              return (
                <button
                  key={p.role}
                  type="button"
                  onClick={() => { setActiveTab(p.role); setError('') }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    padding: '9px 12px', borderRadius: 9, fontSize: 13, fontWeight: 700,
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                    background: active ? '#ffffff' : 'transparent',
                    color: active ? 'var(--text-1)' : 'var(--text-4)',
                    boxShadow: active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  <Icon size={15} color={active ? p.accent : 'currentColor'} />
                  {p.label}
                </button>
              )
            })}
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            {activeTab === 'doctor' ? 'Doctor Sign-In' : 'Reception Desk Sign-In'}
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, lineHeight: 1.45 }}>
            {activeTab === 'doctor'
              ? 'Doctor accounts are provisioned via clinic request. Use your verified work credentials.'
              : 'Sign in to access your center queue desk, counter controls, and token calls.'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
            {notice && (
              <div role="status" style={{
                fontSize: 12.5, fontWeight: 600, color: '#047857',
                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
                borderRadius: 9, padding: '9px 11px',
              }}>
                {notice}
              </div>
            )}

            <div>
              <label className="auth-field-label" htmlFor="staff-email">Work Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="staff-email" className="input" type="email" required autoComplete="username"
                  placeholder={activeTab === 'doctor' ? 'dr.smith@mediqueue.lk' : 'receptionist@mediqueue.lk'}
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  style={{ ...inputStyle, paddingLeft: 38 }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="auth-field-label" htmlFor="staff-password" style={{ margin: 0 }}>Password</label>
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
                  id="staff-password"
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
              disabled={submitting}
              className="btn btn-primary"
              style={{
                width: '100%', height: 44, fontSize: 14.5, fontWeight: 700, borderRadius: 10,
                gap: 7, marginTop: 4, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
                justifyContent: 'center'
              }}
            >
              {submitting ? 'Authenticating…' : <><span>Sign In to {portal.label}</span> <ArrowRight size={15} /></>}
            </button>

            {offline && (
              <div style={{
                border: '1px dashed var(--amber-border)', background: 'var(--amber-dim)',
                borderRadius: 9, padding: '10px 12px', fontSize: 11.5, color: 'var(--text-3)',
              }}>
                <CloudOff size={13} style={{ marginBottom: 2, color: 'var(--amber)' }} /> Backend server is offline.
              </div>
            )}
          </form>

          {/* Medical Center Registration CTA */}
          <div style={{
            marginTop: 18, padding: '12px 14px',
            background: 'rgba(13, 148, 136, 0.08)',
            border: '1px solid rgba(13, 148, 136, 0.22)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--text-1)', display: 'block' }}>New Medical Center?</strong>
              Register your center & receptionist account.
            </div>
            <button
              type="button"
              onClick={() => navigate('/staff/register/medical-center')}
              className="btn btn-ghost btn-sm"
              style={{ gap: 5, flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#0D9488' }}
            >
              <Building2 size={13} /> Register Clinic
            </button>
          </div>

          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <Link to="/login" style={{ fontSize: 12.5, color: 'var(--text-4)', textDecoration: 'none' }}>
              Are you a Patient? <strong style={{ color: '#0D9488' }}>Go to Patient Login →</strong>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
