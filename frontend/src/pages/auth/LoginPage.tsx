import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Activity, Shield, Lock, Stethoscope, User, Building2, Key, ArrowRight } from 'lucide-react'
import { useAuth, UserRole } from '../../context/AuthContext'

interface LoginPageProps {
  forcedRole?: UserRole
}

export default function LoginPage({ forcedRole }: LoginPageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  // Determine role based on props or query/pathname
  const getInitialRole = (): UserRole => {
    if (forcedRole) return forcedRole
    if (location.pathname.includes('doctor')) return 'doctor'
    if (location.pathname.includes('receptionist')) return 'receptionist'
    if (location.pathname.includes('admin')) return 'admin'
    return 'patient'
  }

  const role = getInitialRole()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)

  const roleConfigs = {
    patient: {
      title: 'Patient Portal Sign In',
      subtitle: 'Access your appointments, live token tracking, and medical records',
      badge: 'PATIENT ACCESS',
      accent: 'var(--blue)',
      icon: <User size={24} color="var(--blue)" />,
      targetPath: '/patient',
      defaultEmail: 'patient@mediqueue.io'
    },
    doctor: {
      title: 'Doctor Portal Sign In',
      subtitle: 'Manage your daily consultations, room assignment, and delay alerts',
      badge: 'DOCTOR CONSOLE',
      accent: '#10B981',
      icon: <Stethoscope size={24} color="#10B981" />,
      targetPath: '/doctor',
      defaultEmail: 'dr.carr@mediqueue.io'
    },
    receptionist: {
      title: 'Receptionist Desk Sign In',
      subtitle: 'Issue walk-in tokens, manage counter queue, and trigger SMS alerts',
      badge: 'RECEPTION DESK',
      accent: '#F59E0B',
      icon: <Building2 size={24} color="#F59E0B" />,
      targetPath: '/receptionist',
      defaultEmail: 'reception@mediqueue.io'
    },
    admin: {
      title: 'System Admin Console',
      subtitle: 'Manage doctor slot limits, staff roles, and platform metrics',
      badge: 'SYSTEM ADMIN',
      accent: '#EF4444',
      icon: <Shield size={24} color="#EF4444" />,
      targetPath: '/admin',
      defaultEmail: 'admin@mediqueue.io'
    }
  }

  const config = roleConfigs[role || 'patient']

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    login(email || config.defaultEmail, role)
    navigate(config.targetPath)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #071312 0%, #0d2623 50%, #061816 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative'
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: `radial-gradient(circle, ${config.accent}20 0%, transparent 70%)`,
        pointerEvents: 'none'
      }} />

      <div className="card glass-form-card" style={{
        maxWidth: 440, width: '100%', padding: 32,
        background: 'rgba(255, 255, 255, 0.94)', borderRadius: 20,
        boxShadow: '0 20px 50px rgba(0,0,0,0.3)', position: 'relative', zIndex: 2
      }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: '0 auto 12px',
            background: `linear-gradient(135deg, ${config.accent}, #0d968d)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 6px 20px ${config.accent}40`
          }}>
            <Activity size={24} color="#fff" />
          </div>
          <div style={{
            fontSize: 10.5, fontWeight: 800, color: config.accent,
            letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4
          }}>{config.badge}</div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            {config.title}
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 6, lineHeight: 1.5 }}>
            {config.subtitle}
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              User Email / ID
            </label>
            <div style={{ position: 'relative' }}>
              <User size={16} color="var(--text-4)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="input"
                type="email"
                required
                placeholder={config.defaultEmail}
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ paddingLeft: 40, height: 44, fontSize: 14 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-4)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="input"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: 40, height: 44, fontSize: 14 }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: 'var(--text-3)' }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember me
            </label>
            <span style={{ color: config.accent, fontWeight: 600, cursor: 'pointer' }}>Forgot Password?</span>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%', height: 46, fontSize: 14.5, fontWeight: 800,
              background: `linear-gradient(135deg, ${config.accent}, #0d968d)`,
              borderColor: 'transparent', borderRadius: 10, marginTop: 8, gap: 8
            }}
          >
            Sign In to {config.badge} <ArrowRight size={16} />
          </button>
        </form>

        {/* Portal Switcher Footer Links */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)', fontSize: 12, textAlign: 'center', color: 'var(--text-4)' }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>Switch Login Portal:</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/login" style={{ color: role === 'patient' ? config.accent : 'var(--text-3)', fontWeight: role === 'patient' ? 700 : 400, textDecoration: 'none' }}>Patient</Link>
            <span>•</span>
            <Link to="/login/doctor" style={{ color: role === 'doctor' ? config.accent : 'var(--text-3)', fontWeight: role === 'doctor' ? 700 : 400, textDecoration: 'none' }}>Doctor</Link>
            <span>•</span>
            <Link to="/login/receptionist" style={{ color: role === 'receptionist' ? config.accent : 'var(--text-3)', fontWeight: role === 'receptionist' ? 700 : 400, textDecoration: 'none' }}>Receptionist</Link>
            <span>•</span>
            <Link to="/login/admin" style={{ color: role === 'admin' ? config.accent : 'var(--text-3)', fontWeight: role === 'admin' ? 700 : 400, textDecoration: 'none' }}>Admin</Link>
          </div>
          <div style={{ marginTop: 14 }}>
            <Link to="/" style={{ color: 'var(--text-4)', textDecoration: 'none' }}>← Back to Public Landing</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
