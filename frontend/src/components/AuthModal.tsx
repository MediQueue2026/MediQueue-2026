import { useState } from 'react'
import { X, Shield, Lock, User, Phone, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function AuthModal({ isOpen, onClose, defaultTab = 'signin', onSuccess }: {
  isOpen: boolean
  onClose: () => void
  defaultTab?: 'signin' | 'signup'
  onSuccess?: (userData: { name: string; role: string }) => void
}) {
  const [tab, setTab] = useState<'signin' | 'signup'>(defaultTab)
  const [nic, setNic] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => {
      onSuccess?.({ name: name || 'Rajan Mehta', role: 'Patient' })
      setSubmitted(false)
      onClose()
    }, 1000)
  }

  return (
    /* ── Full-screen overlay — scrollable so card is always reachable ── */
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(4, 24, 22, 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        /* Scroll the overlay itself so the card never hides behind the top bar */
        overflowY: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        /* Top padding = page-switcher (42px) + some breathing room */
        padding: '52px 16px 32px',
      }}
    >
      {/* ── Auth card ── */}
      <div
        className="fade-in modal-card"
        style={{
          width: '100%',
          maxWidth: 480,
          /* Premium deep-glass look */
          background: 'rgba(255, 255, 255, 0.60)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: '1px solid rgba(255, 255, 255, 0.55)',
          outline: '1px solid rgba(18, 198, 186, 0.22)',
          borderRadius: 24,
          padding: '32px 28px 28px',
          boxShadow: [
            '0 32px 80px rgba(6, 35, 33, 0.22)',
            '0 8px 24px rgba(18, 198, 186, 0.12)',
            'inset 0 1px 0 rgba(255, 255, 255, 0.80)',
            'inset 0 -1px 0 rgba(18, 198, 186, 0.10)',
          ].join(', '),
          position: 'relative',
          /* Card itself does NOT scroll — overlay does */
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 18, right: 18,
            background: 'rgba(18, 198, 186, 0.12)',
            border: '1px solid rgba(18, 198, 186, 0.28)',
            borderRadius: '50%', width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-2)', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <X size={16} />
        </button>

        {/* Brand badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #12c6ba, #0d968d)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(18,198,186,0.35)',
          }}>
            <Shield size={19} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--blue-dark)', letterSpacing: '-0.01em' }}>MediQueue</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Secure Patient Portal</div>
          </div>
        </div>

        {/* Title */}
        <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-1)', marginBottom: 4, letterSpacing: '-0.03em' }}>
          {tab === 'signin' ? 'Welcome Back 👋' : 'Create Your Account'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20, lineHeight: 1.5 }}>
          {tab === 'signin'
            ? 'Sign in to track tokens, view reports & manage appointments'
            : 'Register to book doctors, track queues & access your health records'}
        </p>

        {/* Tab switcher */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
          background: 'rgba(18, 198, 186, 0.10)',
          border: '1px solid rgba(18, 198, 186, 0.18)',
          padding: 4, borderRadius: 12, marginBottom: 22,
        }}>
          {(['signin', 'signup'] as const).map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '9px 10px', borderRadius: 9, border: 'none',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: tab === t ? 'rgba(255,255,255,0.92)' : 'transparent',
                color: tab === t ? 'var(--blue-dark)' : 'var(--text-3)',
                boxShadow: tab === t ? '0 2px 12px rgba(6,35,33,0.10)' : 'none',
                transition: 'all 0.18s',
              }}
            >
              {i === 0 ? 'Patient Login' : 'Sign Up Free'}
            </button>
          ))}
        </div>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '28px 0' }}>
            <CheckCircle2 size={48} color="#10B981" style={{ margin: '0 auto 12px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)' }}>
              {tab === 'signin' ? 'Authenticated!' : 'Account Created!'}
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 5 }}>
              Redirecting to your Patient Dashboard…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {tab === 'signup' && (
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-4)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Full Name
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={15} color="var(--text-4)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  <input
                    required
                    className="input"
                    placeholder="e.g. Rajan Mehta"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    style={{ paddingLeft: 36, height: 42, fontSize: 13.5 }}
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-4)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                NIC Number / Email
              </label>
              <div style={{ position: 'relative' }}>
                <Shield size={15} color="var(--text-4)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  required
                  className="input"
                  placeholder="198845210082 or you@email.com"
                  value={nic}
                  onChange={e => setNic(e.target.value)}
                  style={{ paddingLeft: 36, height: 42, fontSize: 13.5 }}
                />
              </div>
            </div>

            {tab === 'signup' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-4)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Mobile
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Phone size={14} color="var(--text-4)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      required
                      className="input"
                      placeholder="0771234567"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      style={{ paddingLeft: 32, height: 42, fontSize: 13 }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-4)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Date of Birth
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Calendar size={14} color="var(--text-4)" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    <input
                      required type="date"
                      className="input"
                      value={dob}
                      onChange={e => setDob(e.target.value)}
                      style={{ paddingLeft: 32, height: 42, fontSize: 13 }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-4)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} color="var(--text-4)" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  required type="password"
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ paddingLeft: 36, height: 42, fontSize: 14 }}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: 6, width: '100%', height: 44, borderRadius: 12, fontSize: 14, fontWeight: 700, gap: 8 }}
            >
              {tab === 'signin' ? 'Sign In to Account' : 'Create Patient Account'}
              <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* Footer note */}
        <div style={{
          marginTop: 18, paddingTop: 14,
          borderTop: '1px solid rgba(18, 198, 186, 0.15)',
          textAlign: 'center', fontSize: 11, color: 'var(--text-4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <Shield size={11} />
          HIPAA Compliant · 256-bit AES Encryption
        </div>
      </div>
    </div>
  )
}
