import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, CloudOff, Eye, EyeOff, HeartPulse, Lock, Mail, Phone, ShieldCheck, User as UserIcon } from 'lucide-react'
import { ApiError, ApiOfflineError } from '../../lib/api'
import { HOME_PATH, useAuth } from '../../context/AuthContext'
import GoogleAuthButton from '../../components/GoogleAuthButton'

const MIN_PASSWORD_LENGTH = 8
const PHONE_PATTERN = /^\+?[\d\s-]{9,15}$/

export default function RegisterPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { register, loginWithGoogle, backendOffline } = useAuth()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [googleSubmitting, setGoogleSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [emailTaken, setEmailTaken] = useState(false)
  const [offline, setOffline] = useState(backendOffline)

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
      })
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

  const handleGoogleSuccess = async (credentialOrToken: string, isAccessToken?: boolean) => {
    clearError()
    setGoogleSubmitting(true)
    try {
      const user = await loginWithGoogle(credentialOrToken, isAccessToken)
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? HOME_PATH[(user.role ?? 'patient') as 'patient'], { replace: true })
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setOffline(true)
        setError('Cannot reach the MediQueue server. Please start the backend service.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Google sign-up failed. Please try again.')
      }
    } finally {
      setGoogleSubmitting(false)
    }
  }

  const inputStyle = { height: 42, fontSize: 13.5 } as const

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

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 28 }} />

          <div className="auth-aside-badge" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#6ee7b7',
            width: 'fit-content', marginBottom: 14
          }}>
            <HeartPulse size={13} /> Patient Registration
          </div>

          <h1 style={{
            fontSize: 27, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15,
            marginLeft: 'auto', marginRight: 'auto', width: '100%',
          }}>
            Join Thousands of Healthy Patients
          </h1>
          <p className="auth-aside-desc" style={{
            fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.72)',
            marginTop: 12, maxWidth: '34ch',
          }}>
            Book doctor consultations in seconds, skip the waiting room with live token alerts, and keep all your prescriptions in one place.
          </p>

          <div className="auth-aside-spacer" style={{ flex: 1, minHeight: 28 }} />

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
              <ShieldCheck size={14} color="#10B981" /> Free & Secure
            </div>
          </div>
        </aside>

        {/* ── Form Pane ── */}
        <div className="auth-form-pane">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{
              fontSize: 11.5, fontWeight: 800, color: '#0D9488', textTransform: 'uppercase',
              letterSpacing: '0.06em', background: 'rgba(13, 148, 136, 0.1)', padding: '3px 8px', borderRadius: 6
            }}>
              New Patient Account
            </span>
          </div>

          <h2 style={{ fontSize: 21, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Create Your Account
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 2 }}>
            Sign up in seconds to schedule appointments and join live queues.
          </p>

          {/* ── Google 1-Click Signup (Patients Only) ── */}
          <div style={{ marginTop: 14 }}>
            <GoogleAuthButton
              onSuccess={handleGoogleSuccess}
              onError={msg => setError(msg)}
              text="Sign up with Google"
              disabled={submitting || googleSubmitting}
            />
          </div>

          <div className="auth-divider">
            <span>Or register with email</span>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label className="auth-field-label" htmlFor="reg-name">Full Name</label>
              <div style={{ position: 'relative' }}>
                <UserIcon size={14} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="reg-name" className="input" type="text" required autoComplete="name"
                  placeholder="Rajan Mehta"
                  value={fullName}
                  onChange={e => { setFullName(e.target.value); clearError() }}
                  style={{ ...inputStyle, paddingLeft: 36 }}
                />
              </div>
            </div>

            <div>
              <label className="auth-field-label" htmlFor="reg-email">Email Address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="reg-email" className="input" type="email" required autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearError() }}
                  style={{ ...inputStyle, paddingLeft: 36 }}
                />
              </div>
            </div>

            <div>
              <label className="auth-field-label" htmlFor="reg-phone">
                Mobile Number <span style={{ fontWeight: 400, color: 'var(--text-4)' }}>(for SMS queue notifications)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={14} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  id="reg-phone" className="input" type="tel" autoComplete="tel"
                  placeholder="0771234567"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); clearError() }}
                  style={{ ...inputStyle, paddingLeft: 36 }}
                />
              </div>
            </div>

            <div className="auth-password-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div>
                <label className="auth-field-label" htmlFor="reg-password">Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reg-password"
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Min 8 chars"
                    minLength={MIN_PASSWORD_LENGTH}
                    value={password}
                    onChange={e => { setPassword(e.target.value); clearError() }}
                    style={{ ...inputStyle, paddingRight: 34 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'transparent', border: 'none', color: 'var(--text-4)', cursor: 'pointer',
                      padding: 2, display: 'grid', placeItems: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="auth-field-label" htmlFor="reg-confirm">Confirm Password</label>
                <input
                  id="reg-confirm"
                  className="input"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); clearError() }}
                  style={inputStyle}
                />
              </div>
            </div>

            {error && (
              <div role="alert" style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, fontWeight: 600,
                color: 'var(--crimson)', background: 'var(--crimson-dim)',
                border: '1px solid var(--crimson-border)', borderRadius: 8, padding: '8px 10px',
                lineHeight: 1.4,
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  {error}
                  {emailTaken && (
                    <>
                      {' '}
                      <Link to="/login" style={{ color: '#0D9488', fontWeight: 700 }}>Sign in instead</Link>.
                    </>
                  )}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || googleSubmitting}
              className="btn btn-primary"
              style={{
                width: '100%', height: 42, fontSize: 14, fontWeight: 700, borderRadius: 10,
                gap: 7, marginTop: 4, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
                justifyContent: 'center'
              }}
            >
              {submitting ? 'Creating account…' : <><span>Create Patient Account</span> <ArrowRight size={15} /></>}
            </button>

            {offline && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 7,
                border: '1px dashed var(--amber-border)', background: 'var(--amber-dim)',
                borderRadius: 8, padding: '9px 10px', fontSize: 11.5, color: 'var(--text-3)',
              }}>
                <CloudOff size={13} style={{ flexShrink: 0, marginTop: 2, color: 'var(--amber)' }} />
                <span>Backend server is offline. Please start Node server to register.</span>
              </div>
            )}
          </form>

          <div style={{
            marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(30, 41, 59, 0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-3)'
          }}>
            <span>Already registered?</span>
            <Link to="/login" style={{ color: '#0D9488', fontWeight: 700, textDecoration: 'none' }}>
              Sign in to Patient Portal →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
