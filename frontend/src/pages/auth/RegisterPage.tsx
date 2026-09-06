import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, AlertCircle, ArrowLeft, ArrowRight, CloudOff } from 'lucide-react'
import { ApiError, ApiOfflineError } from '../../lib/api'
import { HOME_PATH, useAuth } from '../../context/AuthContext'

/**
 * Patient self-registration — the missing half of the auth flow.
 *
 * `POST /api/auth/register` and `AuthContext.register()` have both existed since
 * the auth port; nothing in the UI called them, so a new patient had no way to
 * create an account and the login page's only sign-up CTA was the clinic
 * request. This is that front door.
 *
 * Patients only, deliberately. The backend still accepts a staff `role` while
 * ALLOW_STAFF_SELF_REGISTER is on (a prototype convenience), but a public form
 * that hands out `admin` accounts is not something to build a UI for — staff are
 * created by an admin through POST /api/auth/staff. Omitting `role` here means
 * this form keeps working unchanged once that flag is turned off.
 *
 * On success the backend returns a live session (access token + refresh cookie)
 * and auto-creates the `patient_profiles` row the dashboard reads, so we land
 * the user straight on /patient rather than bouncing them back to sign in.
 */

/** The Patient portal's accent, since this is that portal's front door. */
const ACCENT = '#4F46E5'

/** Mirrors the server-side rule in authService.register — fail before the round trip. */
const MIN_PASSWORD_LENGTH = 8

/** Forgiving on purpose: local `0771234567` and `+94 77 123 4567` both pass. */
const PHONE_PATTERN = /^\+?[\d\s-]{9,15}$/

export default function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { register, backendOffline } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  /** 409 from the backend — the error box then offers a way forward, not just a refusal. */
  const [emailTaken, setEmailTaken] = useState(false)
  const [offline, setOffline] = useState(backendOffline)

  /** Everything the server would reject, checked here first so the form answers instantly. */
  const validate = (): string => {
    if (!fullName.trim()) return 'Please enter your full name.'
    if (!email.trim()) return 'Please enter your email address.'
    if (phone.trim() && !PHONE_PATTERN.test(phone.trim())) {
      return 'Enter a valid phone number, e.g. 0771234567.'
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (password !== confirm) return 'The two passwords do not match.'
    return ''
  }

  const clearError = () => { setError(''); setEmailTaken(false) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    const problem = validate()
    if (problem) { setError(problem); return }

    setSubmitting(true)
    try {
      const user = await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
        // `role` omitted — the backend defaults to 'patient'.
      })
      // Registration signs them in, so honour the page they were originally after.
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? HOME_PATH[(user.role ?? 'patient') as 'patient'], { replace: true })
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setOffline(true)
        setError('Cannot reach the MediQueue server. Start the backend and try again.')
      } else if (err instanceof ApiError) {
        setEmailTaken(err.status === 409)
        setError(err.message)
      } else {
        setError('Could not create your account. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = { height: 42, fontSize: 14 } as const

  return (
    <div className="auth-screen">
      <div className="auth-card">

        {/* ── Context ── */}
        <aside className="auth-aside">
          <div
            className="auth-aside-glow"
            style={{ background: `radial-gradient(circle, ${ACCENT}55, transparent 70%)` }}
          />

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
            Create your account
          </h1>
          <p className="auth-aside-desc" style={{
            fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)',
            marginTop: 10, maxWidth: '34ch',
          }}>
            Book appointments, track your token live, and get SMS alerts when the
            queue moves.
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
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Patient sign-up
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 6, lineHeight: 1.5 }}>
            Staff accounts are created by an administrator — this form is for patients.
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
            <div>
              <label className="auth-field-label" htmlFor="reg-name">Full name</label>
              <input
                id="reg-name" className="input" type="text" required autoComplete="name"
                placeholder="Rajan Mehta"
                value={fullName}
                onChange={e => { setFullName(e.target.value); clearError() }}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="auth-field-label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email" className="input" type="email" required autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => { setEmail(e.target.value); clearError() }}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="auth-field-label" htmlFor="reg-phone">
                Mobile <span style={{ fontWeight: 500, color: 'var(--text-4)' }}>· optional, for SMS queue alerts</span>
              </label>
              <input
                id="reg-phone" className="input" type="tel" autoComplete="tel"
                placeholder="0771234567"
                value={phone}
                onChange={e => { setPhone(e.target.value); clearError() }}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="auth-field-label" htmlFor="reg-password">Password</label>
              <input
                id="reg-password" className="input" type="password" required autoComplete="new-password"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                minLength={MIN_PASSWORD_LENGTH}
                value={password}
                onChange={e => { setPassword(e.target.value); clearError() }}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="auth-field-label" htmlFor="reg-confirm">Confirm password</label>
              <input
                id="reg-confirm" className="input" type="password" required autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={e => { setConfirm(e.target.value); clearError() }}
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
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  {error}
                  {emailTaken && (
                    <>
                      {' '}
                      <Link to="/login" style={{ color: ACCENT, fontWeight: 700 }}>Sign in instead</Link>.
                    </>
                  )}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn"
              style={{
                width: '100%', height: 44, fontSize: 14.5, fontWeight: 700, borderRadius: 9,
                background: ACCENT, color: '#fff', gap: 7, marginTop: 3,
                opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
              }}
            >
              {submitting ? 'Creating account…' : <><span>Create account</span> <ArrowRight size={15} /></>}
            </button>

            {offline && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 7,
                border: '1px dashed var(--amber-border)', background: 'var(--amber-dim)',
                borderRadius: 9, padding: '11px 12px',
                fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.5,
              }}>
                <CloudOff size={13} style={{ flexShrink: 0, marginTop: 2, color: 'var(--amber)' }} />
                <span>
                  An account can only be created while the backend is running — demo
                  mode has no database to save it to.
                </span>
              </div>
            )}
          </form>

          <div className="auth-demo" style={{ justifyContent: 'space-between' }}>
            <span>Already registered?</span>
            <Link to="/login" className="btn btn-ghost btn-sm" style={{ gap: 5, flexShrink: 0, textDecoration: 'none' }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
