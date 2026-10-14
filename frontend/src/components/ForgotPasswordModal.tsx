import React, { useState, useEffect } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  MessageSquare,
  Phone,
  RefreshCw,
  ShieldCheck,
  X
} from 'lucide-react'
import { api, ApiError, ApiOfflineError } from '../lib/api'

interface ForgotPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  initialIdentifier?: string
  initialEmail?: string
}

type ResetStep = 'IDENTIFIER' | 'OTP' | 'NEW_PASSWORD' | 'SUCCESS'

export default function ForgotPasswordModal({
  isOpen,
  onClose,
  initialIdentifier = '',
  initialEmail = ''
}: ForgotPasswordModalProps) {
  const initialVal = initialIdentifier || initialEmail || ''
  const [step, setStep] = useState<ResetStep>('IDENTIFIER')
  const [identifier, setIdentifier] = useState(initialVal)
  const [maskedPhone, setMaskedPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [resetToken, setResetToken] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendTimer, setResendTimer] = useState(60)
  const [canResend, setCanResend] = useState(false)

  // Sync initial identifier when opened
  useEffect(() => {
    if (isOpen) {
      const init = initialIdentifier || initialEmail || ''
      if (init && !identifier) {
        setIdentifier(init)
      }
      setError('')
    }
  }, [isOpen, initialIdentifier, initialEmail])

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (step === 'OTP' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => {
          if (prev <= 1) {
            setCanResend(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [step, resendTimer])

  if (!isOpen) return null

  const handleClose = () => {
    setStep('IDENTIFIER')
    setError('')
    setOtp('')
    setNewPassword('')
    setConfirmPassword('')
    setResetToken('')
    setMaskedPhone('')
    onClose()
  }

  // ── Step 1: Send SMS OTP ──
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanId = identifier.trim()
    if (!cleanId) {
      setError('Please enter your account email or registered mobile number.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const res = await api.forgotPassword(cleanId)
      setMaskedPhone(res.maskedPhone || 'your mobile phone')
      setStep('OTP')
      setResendTimer(60)
      setCanResend(false)
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setError('Cannot connect to MediQueue server. Please verify backend connection.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not send verification code. Please check your credentials.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Resend SMS OTP ──
  const handleResendOtp = async () => {
    if (!canResend || loading) return
    setError('')
    setLoading(true)
    try {
      const res = await api.forgotPassword(identifier.trim())
      setMaskedPhone(res.maskedPhone || 'your mobile phone')
      setResendTimer(60)
      setCanResend(false)
      setOtp('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resend verification code.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Verify SMS OTP ──
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanOtp = otp.trim()
    if (cleanOtp.length !== 6) {
      setError('Please enter the complete 6-digit verification code.')
      return
    }

    setError('')
    setLoading(true)
    try {
      const res = await api.verifyResetOtp(identifier.trim(), cleanOtp)
      setResetToken(res.resetToken)
      setStep('NEW_PASSWORD')
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setError('Cannot reach MediQueue server.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Invalid or expired verification code.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: Update Password ──
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match. Please re-enter carefully.')
      return
    }

    setError('')
    setLoading(true)
    try {
      await api.resetPassword(resetToken, newPassword)
      setStep('SUCCESS')
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setError('Cannot reach MediQueue server.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to update password. Session may have expired.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 12px',
      background: 'rgba(2, 6, 23, 0.78)', backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
    }}>
      <div
        className="modal-card glass-form-card"
        style={{
          width: '100%', maxWidth: 440, background: '#ffffff',
          borderRadius: 20, padding: '26px 22px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(13, 148, 136, 0.28)',
          position: 'relative', overflowY: 'auto', maxHeight: '92vh',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close modal"
          style={{
            position: 'absolute', top: 16, right: 16, background: 'rgba(0,0,0,0.05)',
            border: 'none', borderRadius: '50%', width: 30, height: 30,
            display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--text-3)',
            transition: 'background 0.15s ease'
          }}
        >
          <X size={16} />
        </button>

        {/* ── STEP 1: IDENTIFIER (EMAIL / PHONE) ── */}
        {step === 'IDENTIFIER' && (
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(13, 148, 136, 0.1)', border: '1px solid rgba(13, 148, 136, 0.25)',
              borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#0F766E',
              marginBottom: 12
            }}>
              <ShieldCheck size={13} /> SMS-Verified Reset
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
              Forgot Password?
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-4)', margin: '0 0 18px', lineHeight: 1.5 }}>
              Enter your registered email address or mobile phone number. We will send a secure 6-digit SMS verification code to your phone.
            </p>

            <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="auth-field-label" htmlFor="forgot-identifier">
                  Email or Mobile Number
                </label>
                <div style={{ position: 'relative' }}>
                  <Phone size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    id="forgot-identifier"
                    className="input"
                    type="text"
                    required
                    autoFocus
                    autoComplete="username"
                    placeholder="e.g. 0771234567 or user@example.com"
                    value={identifier}
                    onChange={e => { setIdentifier(e.target.value); setError('') }}
                    style={{ height: 44, paddingLeft: 38, fontSize: 13.5 }}
                  />
                </div>
              </div>

              {error && (
                <div role="alert" style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, fontWeight: 600,
                  color: 'var(--crimson)', background: 'var(--crimson-dim)',
                  border: '1px solid var(--crimson-border)', borderRadius: 8, padding: '9px 12px',
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{
                  width: '100%', height: 44, fontSize: 14, fontWeight: 700, borderRadius: 10,
                  gap: 8, marginTop: 4, justifyContent: 'center'
                }}
              >
                {loading ? 'Sending Verification SMS…' : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── STEP 2: 6-DIGIT SMS OTP VERIFICATION ── */}
        {step === 'OTP' && (
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#059669',
              marginBottom: 12
            }}>
              <MessageSquare size={13} /> SMS Verification Sent
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
              Verify Security Code
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-4)', margin: '0 0 18px', lineHeight: 1.5 }}>
              We sent a 6-digit verification code to <strong style={{ color: 'var(--text-1)' }}>{maskedPhone}</strong>. Enter the code below to verify your identity.
            </p>

            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="auth-field-label" htmlFor="reset-otp">
                  6-Digit SMS Verification Code
                </label>
                <input
                  id="reset-otp"
                  className="input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '')
                    setOtp(val)
                    setError('')
                  }}
                  style={{
                    height: 48, fontSize: 22, fontWeight: 800, letterSpacing: '0.35em',
                    textAlign: 'center', fontFamily: 'monospace'
                  }}
                />
              </div>

              {error && (
                <div role="alert" style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, fontWeight: 600,
                  color: 'var(--crimson)', background: 'var(--crimson-dim)',
                  border: '1px solid var(--crimson-border)', borderRadius: 8, padding: '9px 12px',
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="btn btn-primary"
                style={{
                  width: '100%', height: 44, fontSize: 14, fontWeight: 700, borderRadius: 10,
                  gap: 8, marginTop: 4, justifyContent: 'center'
                }}
              >
                {loading ? 'Verifying Code…' : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => { setStep('IDENTIFIER'); setError('') }}
                  style={{
                    background: 'transparent', border: 'none', color: 'var(--text-4)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <ArrowLeft size={13} /> Change Phone/Email
                </button>

                <button
                  type="button"
                  disabled={!canResend || loading}
                  onClick={handleResendOtp}
                  style={{
                    background: 'transparent', border: 'none',
                    color: canResend ? '#0D9488' : 'var(--text-4)',
                    fontSize: 12, fontWeight: 700, cursor: canResend ? 'pointer' : 'default', padding: 0,
                    display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <RefreshCw size={12} className={loading ? 'spin' : ''} />
                  {canResend ? 'Resend SMS Code' : `Resend in ${resendTimer}s`}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── STEP 3: CREATE NEW PASSWORD ── */}
        {step === 'NEW_PASSWORD' && (
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(13, 148, 136, 0.1)', border: '1px solid rgba(13, 148, 136, 0.25)',
              borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#0F766E',
              marginBottom: 12
            }}>
              <KeyRound size={13} /> Step 3: Set New Password
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
              Create New Password
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-4)', margin: '0 0 18px', lineHeight: 1.5 }}>
              Identity verified successfully! Enter a strong password for your account (minimum 8 characters).
            </p>

            <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="auth-field-label" htmlFor="new-password">New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    id="new-password"
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setError('') }}
                    style={{ height: 44, paddingLeft: 38, paddingRight: 38, fontSize: 13.5 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', padding: 4
                    }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="auth-field-label" htmlFor="confirm-new-password">Confirm New Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    id="confirm-new-password"
                    className="input"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                    style={{ height: 44, paddingLeft: 38, paddingRight: 38, fontSize: 13.5 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(p => !p)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', padding: 4
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, fontWeight: 600,
                  color: 'var(--crimson)', background: 'var(--crimson-dim)',
                  border: '1px solid var(--crimson-border)', borderRadius: 8, padding: '9px 12px',
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{
                  width: '100%', height: 44, fontSize: 14, fontWeight: 700, borderRadius: 10,
                  gap: 8, marginTop: 4, justifyContent: 'center'
                }}
              >
                {loading ? 'Updating Password…' : (
                  <>
                    <span>Update Password</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── STEP 4: SUCCESS CONFIRMATION ── */}
        {step === 'SUCCESS' && (
          <div style={{ textAlign: 'center', padding: '14px 6px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)',
              color: '#10B981', display: 'grid', placeItems: 'center', margin: '0 auto 16px',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <CheckCircle2 size={34} />
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: '0 0 8px' }}>
              Password Reset Complete!
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, margin: '0 0 20px' }}>
              Your account password has been safely updated with bcrypt encryption. You can now log in using your new credentials.
            </p>

            <button
              type="button"
              onClick={handleClose}
              className="btn btn-primary"
              style={{ width: '100%', height: 44, justifyContent: 'center', fontWeight: 700, borderRadius: 10 }}
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
