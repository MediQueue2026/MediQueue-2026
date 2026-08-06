import { useState } from 'react'
import {
  Activity, ArrowRight, BookOpen, Calendar, FileText, Phone, Radio,
  Search, Shield, Stethoscope, Ticket, Zap
} from 'lucide-react'
import bgLobby from '../imports/mediqueue_bg_lobby.png'
import MolecularParticles from '../components/MolecularParticles'
import AuthModal from '../components/AuthModal'
import { Avatar, StatusBadge } from '../components/UIPrimitives'

const DOCTORS_PUBLIC = [
  { name: 'Dr. Aisha Patel',     spec: 'Cardiology',       room: 'Room 03', serving: '#A-14', wait: '8 min',  status: 'active'  as const },
  { name: 'Dr. Marcus Reeves',   spec: 'General Medicine',  room: 'Room 07', serving: '#B-22', wait: '12 min', status: 'active'  as const },
  { name: 'Dr. Sofia Montoya',   spec: 'Pediatrics',        room: 'Room 11', serving: '#C-09', wait: '~25 min',status: 'delayed' as const },
  { name: 'Dr. Kenji Nakamura',  spec: 'Orthopedics',       room: 'Room 02', serving: '—',     wait: '—',      status: 'break'   as const },
  { name: 'Dr. Priya Kumari',    spec: 'Neurology',         room: 'Room 15', serving: '#D-31', wait: '6 min',  status: 'active'  as const },
  { name: 'Dr. Ethan Carr',      spec: 'General Medicine',  room: 'Room 04', serving: '#A-07', wait: '18 min', status: 'active'  as const },
]

const QUICK_ACTIONS = [
  { icon: <Calendar size={20} />, label: 'Book Appointment',     desc: 'Schedule with any available doctor',      color: '#10b3a8' },
  { icon: <Ticket size={20} />,   label: 'Check Queue Status',   desc: 'Track your live token position in real-time', color: '#10B981' },
  { icon: <FileText size={20} />, label: 'Medical Reports',      desc: 'Access lab results & prescriptions',      color: '#8B5CF6' },
  { icon: <Zap size={20} />,      label: 'AI Symptom Checker',   desc: 'Get instant AI-powered triage guidance',  color: '#F59E0B' },
]

export default function LandingPage() {
  const [spec, setSpec] = useState('All')
  const [showAuth, setShowAuth] = useState(false)
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin')
  const specs = ['All', 'Cardiology', 'General', 'Orthopedics', 'Pediatrics', 'Neurology']

  const openAuth = (tab: 'signin' | 'signup') => {
    setAuthTab(tab)
    setShowAuth(true)
  }

  return (
    <div style={{ minHeight: '100vh' }}>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} defaultTab={authTab} />

      {/* ── HEADER ── */}
      <header className="topbar" style={{
        borderRadius: "0px",
        justifyContent: 'space-between',
        flexWrap: 'nowrap'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg,#12c6ba 0%,#97f0ef 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(18,198,186,0.35)', flexShrink: 0
          }}>
            <Activity size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>MediQueue</div>
            <div style={{ fontSize: 9, color: 'var(--text-4)', fontWeight: 600, letterSpacing: '0.05em' }} className="desktop-only">HEALTHCARE PLATFORM</div>
          </div>
        </div>

        {/* Live pill */}
        <div className="badge badge-emerald desktop-only" style={{ gap: 6, padding: '5px 11px', fontSize: 12 }}>
          <span className="pulse-live" />
          Live — 247 Active Tokens
        </div>

        {/* Search */}
        <div className="desktop-only" style={{ flex: 1, minWidth: 220, maxWidth: 440, position: 'relative' }}>
          <Search size={14} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input className="input" placeholder="Search clinics, doctors, or token ID..." style={{ paddingLeft: 36, height: 34 }} />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'nowrap' }}>
          <button onClick={() => openAuth('signin')} className="btn btn-ghost btn-sm" style={{ padding: '5px 10px', fontSize: 12 }}>Patient Login</button>
          <button onClick={() => openAuth('signup')} className="btn btn-primary btn-sm" style={{ padding: '5px 12px', fontSize: 12 }}>
            Sign Up Free
          </button>
          <button className="btn btn-danger btn-sm desktop-only" style={{ borderColor: 'var(--crimson-border)' }}>
            <Phone size={13} />Emergency Support
          </button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{
        background: 'linear-gradient(180deg, rgba(16, 179, 168, 0.08) 0%, rgba(255, 255, 255, 0.1) 100%)',
        padding: '48px 24px 44px',
        borderBottom: '1px solid var(--border)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Layer 1 — molecular particles */}
        <MolecularParticles />

        {/* Layer 2 — faded clinic lobby image */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '70%',
          height: '100%',
          backgroundImage: `url(${bgLobby})`,
          backgroundSize: 'cover',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center left',
          opacity: 0.11,
          pointerEvents: 'none',
          zIndex: 1,
          WebkitMaskImage: 'radial-gradient(ellipse 80% 90% at 40% 60%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 75%)',
          maskImage: 'radial-gradient(ellipse 80% 90% at 40% 60%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 75%)'
        }} />

        {/* Layer 3 — hero content */}
        <div className="responsive-hero-grid" style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 480px', gap: 48, alignItems: 'center', position: 'relative', zIndex: 2 }}>
          {/* Copy */}
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(59,130,246,0.09)', border: '1px solid rgba(59,130,246,0.18)',
              borderRadius: 20, padding: '5px 13px', marginBottom: 22
            }}>
              <Shield size={12} color="var(--blue)" />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}>HIPAA Compliant · ISO 27001 · HL7 FHIR</span>
            </div>
            <h1 style={{
              fontSize: 'clamp(32px, 5vw, 46px)', fontWeight: 900, color: '#0d9488',
              letterSpacing: '-0.04em', lineHeight: 1.08, marginBottom: 18,
              textShadow: '0 2px 24px rgba(255,255,255,0.7), 0 1px 4px rgba(255,255,255,0.5)'
            }}>
              Skip the Wait,<br />
              <span style={{
                background: 'linear-gradient(135deg,#0d9488,#0f9a8d)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 2px 8px rgba(255,255,255,0.6))'
              }}>Not the Care.</span>
            </h1>
            <p style={{ fontSize: 16, color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 520, marginBottom: 28, fontWeight: 500, textShadow: '0 1px 8px rgba(255,255,255,0.6)' }}>
              Real-time queue tracking, instant appointment booking, and AI-powered triage — all from one intelligent healthcare platform.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button onClick={() => openAuth('signup')} className="btn btn-primary btn-lg">
                <BookOpen size={16} />Book Appointment
              </button>
              <button onClick={() => openAuth('signin')} className="btn btn-ghost btn-lg">
                Track My Token <ArrowRight size={15} />
              </button>
            </div>
            {/* Trust strip */}
            <div style={{ display: 'flex', gap: 24, marginTop: 32, flexWrap: 'wrap' }}>
              {[['12+', 'Clinics'], ['50k+', 'Patients/mo'], ['< 2s', 'Queue updates'], ['99.9%', 'Uptime']].map(([v, l]) => (
                <div key={l}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', textShadow: '0 1px 6px rgba(255,255,255,0.5)' }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, fontWeight: 600 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Token tracker form card */}
          <div className="card glass-form-card" style={{ padding: 28, background: 'rgba(255, 255, 255, 0.88)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <Radio size={16} color="var(--blue)" />
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>Real-Time Token Tracker</span>
            </div>
            <div className="form-responsive-grid" style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>TOKEN ID</label>
                <input className="input" placeholder="e.g. A-14" style={{ height: 42, fontSize: 14 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', padding: '0 4px', color: 'var(--text-4)', fontSize: 12, paddingBottom: 10 }}>or</div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>NIC / PATIENT ID</label>
                <input className="input" placeholder="e.g. 198845210082" style={{ height: 42, fontSize: 14 }} />
              </div>
            </div>
            <button onClick={() => openAuth('signin')} className="btn btn-primary" style={{ width: '100%', padding: '12px', fontSize: 14, borderRadius: 10, height: 44, fontWeight: 700 }}>
              <Search size={15} /> Track Live Queue Status
            </button>

            {/* Result preview */}
            <div style={{ marginTop: 20, padding: 16, background: 'rgba(255, 255, 255, 0.75)', borderRadius: 12, border: '1px solid rgba(18,198,186,0.2)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-4)', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>Live Status Preview</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0, textAlign: 'center' }}>
                {[
                  { val: '#A-14', sub: 'Your Token',   color: 'var(--blue)' },
                  { val: '#A-11', sub: 'Now Serving',  color: 'var(--emerald)' },
                  { val: '~15m', sub: 'Est. Wait',     color: 'var(--amber)' },
                ].map((s, i) => (
                  <div key={i} style={{ borderRight: i < 2 ? '1px solid var(--border)' : 'none', padding: '0 8px' }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 5 }}>{s.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{
                marginTop: 14, padding: '9px 12px', borderRadius: 8,
                background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
                display: 'flex', alignItems: 'center', gap: 8
              }}>
                <Stethoscope size={14} color="var(--blue)" />
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Dr. Ethan Carr · Room 04 · General Medicine</span>
              </div>
              {/* Mini progress */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>Queue progress</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-2)', fontWeight: 600 }}>3 ahead of you</span>
                </div>
                <div className="prog"><div className="prog-fill" style={{ width: '72%', background: 'var(--blue)' }} /></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── QUICK ACTIONS ── */}
      <section style={{ padding: '36px 24px 0', maxWidth: 1360, margin: '0 auto' }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-4)', marginBottom: 14 }}>Quick Actions</div>
        <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {QUICK_ACTIONS.map(a => (
            <div key={a.label} onClick={() => openAuth('signup')} className="card glass-form-card" style={{ padding: '20px 22px', cursor: 'pointer', transition: 'all 0.2s ease' }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: `${a.color}15`, border: `1px solid ${a.color}28`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14, color: a.color
              }}>{a.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>{a.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.5 }}>{a.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── DOCTORS GRID ── */}
      <section style={{ padding: '40px 24px 48px', maxWidth: 1360, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Live Doctor Status & Queue Length</div>
            <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>Real-time availability across MediQueue partner clinics</div>
          </div>
          {/* Specialty filter pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {specs.map(s => (
              <button key={s} onClick={() => setSpec(s)} className="btn btn-sm" style={{
                background: spec === s ? 'var(--blue)' : 'rgba(255,255,255,0.6)',
                color: spec === s ? '#fff' : 'var(--text-3)',
                border: '1px solid', borderColor: spec === s ? 'var(--blue)' : 'var(--border-md)'
              }}>{s}</button>
            ))}
          </div>
        </div>

        <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {DOCTORS_PUBLIC.map(doc => (
            <div key={doc.name} className="card glass-form-card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
                <Avatar name={doc.name} size={46} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{doc.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--blue-dark)', fontWeight: 600 }}>{doc.spec} · {doc.room}</div>
                </div>
                <StatusBadge status={doc.status} />
              </div>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                padding: '10px 12px', background: 'rgba(255,255,255,0.6)',
                borderRadius: 10, border: '1px solid var(--border-md)', marginBottom: 14
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Serving Token</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', fontFamily: 'monospace' }}>{doc.serving}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Est. Wait Time</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--amber)' }}>{doc.wait}</div>
                </div>
              </div>
              <button onClick={() => openAuth('signup')} className="btn btn-primary" style={{ width: '100%', gap: 6, height: 40, borderRadius: 8 }}>
                <Ticket size={14} />Get Live Token
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(10px)', padding: '36px 24px 24px' }}>
        <div style={{ maxWidth: 1360, margin: '0 auto' }}>
          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 32, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', marginBottom: 8 }}>MediQueue Systems</div>
              <div style={{ fontSize: 12, color: 'var(--text-4)', lineHeight: 1.6, maxWidth: 300 }}>
                Intelligent outpatient queue management, real-time token tracking, and EHR integration for modern healthcare centers.
              </div>
            </div>
            {[
              ['For Patients', ['Find Doctor', 'Track Token', 'Medical Reports', 'Emergency Care']],
              ['For Clinics', ['Doctor Dashboard', 'Reception Desk', 'Kiosk Display', 'API FHIR Specs']],
              ['Compliance', ['HIPAA Certified', 'ISO 27001', 'Privacy Policy', 'Terms of Service']],
            ].map(([title, links]) => (
              <div key={title as string}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{title as string}</div>
                {(links as string[]).map(l => (
                  <div key={l} style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 7, cursor: 'pointer' }} onClick={() => openAuth('signin')}>{l}</div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>© 2026 MediQueue Systems Pvt. Ltd. All rights reserved.</span>
            <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>Platform v3.2.1 · Production Environment</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
