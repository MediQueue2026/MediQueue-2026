import React, { useState } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, Mail, X } from 'lucide-react'
import { api, ApiError, ApiOfflineError } from '../lib/api'

interface ForgotPasswordModalProps {
  isOpen: boolean
  onClose: () => void
  initialEmail?: string
}

export default function ForgotPasswordModal({ isOpen, onClose, initialEmail = '' }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState(initialEmail)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await api.forgotPassword(email.trim())
      setSuccess(true)
      if (res.devResetUrl) {
        setDevResetUrl(res.devResetUrl)
      }
    } catch (err) {
      if (err instanceof ApiOfflineError) {
        setError('Cannot reach MediQueue server. Please start the backend service.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not request password reset. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetState = () => {
    setError('')
    setSuccess(false)
    setDevResetUrl(null)
    onClose()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      background: 'rgba(2, 6, 23, 0.75)', backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
    }}>
      <div style={{
        width: '100%', maxWidth: 440, background: '#ffffff',
        borderRadius: 18, padding: '28px 24px',
        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Glow Header Accents */}
        <div style={{
          position: 'absolute', top: -50, right: -50, width: 140, height: 140,
          background: 'radial-gradient(circle, rgba(79, 70, 229, 0.25), transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', top: -50, left: -50, width: 140, height: 140,
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.25), transparent 70%)',
          borderRadius: '50%', pointerEvents: 'none'
        }} />

        <button
          type="button"
          onClick={handleResetState}
          aria-label="Close modal"
          style={{
            position: 'absolute', top: 18, right: 18, background: 'rgba(0,0,0,0.05)',
            border: 'none', borderRadius: '50%', width: 30, height: 30,
            display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'var(--text-3)'
          }}
        >
          <X size={16} />
        </button>

        {success ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)',
              color: '#10B981', display: 'grid', placeItems: 'center', margin: '0 auto 14px',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}>
              <CheckCircle2 size={30} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Check Your Email</h3>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.5 }}>
              If an account is associated with <strong>{email}</strong>, a password reset link has been dispatched.
            </p>

            {devResetUrl && (
              <div style={{
                marginTop: 16, padding: '10px 12px', background: 'rgba(79, 70, 229, 0.08)',
                border: '1px dashed rgba(79, 70, 229, 0.3)', borderRadius: 10, textAlign: 'left',
                fontSize: 12, color: '#4338CA'
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <KeyRound size={13} /> Local Dev Quick Link:
                </div>
                <a
                  href={devResetUrl}
                  style={{ wordBreak: 'break-all', color: '#4F46E5', fontWeight: 600 }}
                  onClick={() => onClose()}
                >
                  Click here to open Reset Password page
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={handleResetState}
              className="btn btn-primary"
              style={{ width: '100%', height: 42, marginTop: 20, justifyContent: 'center', fontWeight: 700 }}
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(79, 70, 229, 0.08)', border: '1px solid rgba(79, 70, 229, 0.2)',
              borderRadius: 8, padding: '4px 10px', fontSize: 11.5, fontWeight: 700, color: '#4F46E5',
              marginBottom: 12
            }}>
              <KeyRound size={13} /> Reset Password
            </div>

            <h3 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              Forgot your password?
            </h3>
            <p style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 4, lineHeight: 1.5 }}>
              Enter your registered email address and we'll send you a secure link to reset your credentials.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>
              <div>
                <label className="auth-field-label" htmlFor="forgot-email">Account Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    id="forgot-email"
                    className="input"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    style={{ height: 44, paddingLeft: 38, fontSize: 14 }}
                  />
                </div>
              </div>

              {error && (
                <div role="alert" style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, fontWeight: 600,
                  color: 'var(--crimson)', background: 'var(--crimson-dim)',
                  border: '1px solid var(--crimson-border)', borderRadius: 8, padding: '8px 10px',
                }}>
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{
                  width: '100%', height: 44, fontSize: 14, fontWeight: 700, borderRadius: 10,
                  gap: 7, marginTop: 4, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer',
                  justifyContent: 'center'
                }}
              >
                {submitting ? 'Sending Reset Link…' : <><span>Send Reset Link</span> <ArrowRight size={15} /></>}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
