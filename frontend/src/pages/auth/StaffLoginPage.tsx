import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Activity, AlertCircle, ArrowLeft, ArrowRight, Building2, CloudOff, Stethoscope } from 'lucide-react'
import AddCenterModal from '../../components/AddCenterModal'
import { api, ApiError, ApiOfflineError } from '../../lib/api'
import { HOME_PATH, useAuth } from '../../context/AuthContext'
import type { UserRole } from '../../context/AuthContext'

type StaffRole = 'doctor' | 'receptionist'

const STAFF_PORTALS: Array<{ role: StaffRole; label: string; title: string; blurb: string; accent: string; icon: any }> = [
  {
    role: 'doctor',
    label: 'Doctor',
    title: 'Doctor Consultation Console',
    blurb: 'Manage patient queues, conduct consultations, issue prescriptions, and update delay notices.',
    accent: '#047857', // Emerald
    icon: Stethoscope,
  },
  {
    role: 'receptionist',
    label: 'Receptionist',
    title: 'Reception Desk & Center Portal',
    blurb: 'Issue walk-in tokens, manage clinic queues, coordinate doctor schedules, and send SMS alerts.',
    accent: '#B45309', // Amber / Warm Orange
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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(backendOffline)
  const [showRequestCenter, setShowRequestCenter] = useState(false)

  const portal = STAFF_PORTALS.find(p => p.role === activeTab)!

  const destinationFor = (signedInRole: Exclude<UserRole, null>) =>
    (location.state as { from?: string } | null)?.from ?? HOME_PATH[signedInRole]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const user = await login(email.trim(), password)
      // Check if user role matches active staff portal expected role, or allow redirect to correct role dashboard
      navigate(destinationFor((user.role ?? activeTab) as Exclude<UserRole, null>), { replace: true })
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setOffline(true)
        setError('Cannot reach the MediQueue server. Start backend service.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Sign-in failed. Please verify your staff credentials.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = { height: 42, fontSize: 14 } as const

  return (
    <div className="auth-screen">
      <AddCenterModal
        isOpen={showRequestCenter}
        onClose={() => setShowRequestCenter(false)}
        mode="request"
        onAdd={async (centerData) => { await api.registerCenterPublic(centerData) }}
      />

      <div className="auth-card">
        {/* ── Context ── */}
        <aside className="auth-aside">
          <div className="auth-aside-glow" style={{ background: `radial-gradient(circle, ${portal.accent}55, transparent 70%)` }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #047857, #0d9488)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={16} color="#fff" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.02em' }}>MediQueue Staff</span>
          </div>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 28 }} />

          <h1 style={{
            fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2,
            marginLeft: 'auto', marginRight: 'auto', width: '100%',
          }}>
            {portal.title}
          </h1>
          <p className="auth-aside-desc" style={{
            fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.65)',
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

        {/* ── Task Pane ── */}
        <div className="auth-form-pane">
          {/* Tab Switcher */}
          <div style={{
            display: 'flex', gap: 4, background: 'var(--bg-subtle, #f3f4f6)',
            padding: 4, borderRadius: 10, marginBottom: 18
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
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    border: 'none', cursor: 'pointer', transition: 'all 0.15s ease',
                    background: active ? '#fff' : 'transparent',
                    color: active ? p.accent : 'var(--text-4)',
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  }}
                >
                  <Icon size={14} />
                  {p.label}
                </button>
              )
            })}
          </div>

          <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            {activeTab === 'doctor' ? 'Doctor Sign-In' : 'Receptionist Sign-In'}
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, lineHeight: 1.45 }}>
            {activeTab === 'doctor'
              ? 'Doctor accounts are provisioned via clinic request. Credentials are provided via SMS.'
              : 'Sign in to access your clinic queue desk and counter controls.'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 18 }}>
            <div>
              <label className="auth-field-label" htmlFor="staff-email">Work Email</label>
              <input
                id="staff-email" className="input" type="email" required autoComplete="username"
                placeholder={activeTab === 'doctor' ? 'dr.smith@mediqueue.lk' : 'receptionist@mediqueue.lk'}
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="auth-field-label" htmlFor="staff-password">Password</label>
              <input
                id="staff-password" className="input" type="password" required autoComplete="current-password"
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
                background: portal.accent, color: '#fff', gap: 7, marginTop: 4,
                opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {submitting ? 'Authenticating…' : <><span>Sign In to {portal.label} Portal</span> <ArrowRight size={15} /></>}
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

          {/* Medical Center Registration CTA (For Receptionists / Clinics) */}
          <div style={{
            marginTop: 20, padding: '12px 14px',
            background: 'rgba(18, 198, 186, 0.07)',
            border: '1px solid rgba(18, 198, 186, 0.25)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
              <strong style={{ color: 'var(--text-2)', display: 'block' }}>New Clinic or Medical Center?</strong>
              Submit a request to register your medical center & receptionist account.
            </div>
            <button
              type="button"
              onClick={() => setShowRequestCenter(true)}
              className="btn btn-ghost btn-sm"
              style={{ gap: 5, flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#0d9488' }}
            >
              <Building2 size={13} /> Register Clinic
            </button>
          </div>

          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <Link to="/login" style={{ fontSize: 12.5, color: 'var(--text-4)', textDecoration: 'none' }}>
              Are you a Patient? Go to Patient Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
