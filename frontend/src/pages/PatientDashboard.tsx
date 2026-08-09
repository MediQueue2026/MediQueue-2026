import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Building2, ClipboardList, Download, FileText, Heart, Home, LogOut,
  Map, Menu, Search, Settings, Ticket, X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar, StatusBadge } from '../components/UIPrimitives'

const DOCTORS_PUBLIC = [
  { name: 'Dr. Aisha Patel',     spec: 'Cardiology',       room: 'Room 03', serving: '#A-14', wait: '8 min',  status: 'active'  as const },
  { name: 'Dr. Marcus Reeves',   spec: 'General Medicine',  room: 'Room 07', serving: '#B-22', wait: '12 min', status: 'active'  as const },
  { name: 'Dr. Sofia Montoya',   spec: 'Pediatrics',        room: 'Room 11', serving: '#C-09', wait: '~25 min',status: 'delayed' as const },
  { name: 'Dr. Kenji Nakamura',  spec: 'Orthopedics',       room: 'Room 02', serving: '—',     wait: '—',      status: 'break'   as const },
  { name: 'Dr. Priya Kumari',    spec: 'Neurology',         room: 'Room 15', serving: '#D-31', wait: '6 min',  status: 'active'  as const },
  { name: 'Dr. Ethan Carr',      spec: 'General Medicine',  room: 'Room 04', serving: '#A-07', wait: '18 min', status: 'active'  as const },
]

const NAV_PATIENT = [
  { id: 'overview',      icon: <Home size={15} />,         label: 'Overview' },
  { id: 'doctors',       icon: <Search size={15} />,       label: 'Browse Doctors' },
  { id: 'subscriptions', icon: <Heart size={15} />,        label: 'Subscribed Doctors' },
  { id: 'token',         icon: <Ticket size={15} />,       label: 'Live Token' },
  { id: 'reports',       icon: <FileText size={15} />,     label: 'Prescriptions & Reports' },
  { id: 'history',       icon: <ClipboardList size={15} />,label: 'Medical History' },
  { id: 'settings',      icon: <Settings size={15} />,     label: 'Settings' },
]

export default function PatientDashboard() {
  const [nav, setNav] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const [selectedSpec, setSelectedSpec] = useState('All')
  const [subscribedIds, setSubscribedIds] = useState<string[]>(['Dr. Aisha Patel', 'Dr. Ethan Carr'])
  const [signingOut, setSigningOut] = useState(false)

  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const displayName = user?.name ?? 'Patient'
  const firstName = displayName.split(' ')[0]

  const handleSignOut = async () => {
    setSigningOut(true)
    // Navigate away first — clearing the session while still on /patient lets
    // the route guard redirect to the login screen instead of the landing page,
    // which reads as a failed sign-out.
    navigate('/', { replace: true })
    await logout()
  }

  const toggleSubscribe = (docName: string) => {
    if (subscribedIds.includes(docName)) {
      setSubscribedIds(subscribedIds.filter(id => id !== docName))
    } else {
      setSubscribedIds([...subscribedIds, docName])
    }
  }

  const upcoming = [
    { date: 'Jul 28, 2026', time: '10:30 AM', doc: 'Dr. Aisha Patel',    spec: 'Cardiology',      clinic: 'MediQueue Central' },
    { date: 'Aug 04, 2026', time: '02:00 PM', doc: 'Dr. Marcus Reeves', spec: 'General Medicine', clinic: 'MediQueue North' },
  ]

  const history = [
    { date: 'Jul 12, 2026', doc: 'Dr. Ethan Carr',    spec: 'General',    dx: 'Upper respiratory infection', token: '#A-07', rx: true },
    { date: 'Jun 18, 2026', doc: 'Dr. S. Montoya',    spec: 'Pediatrics', dx: 'Annual checkup',              token: '#C-14', rx: false },
    { date: 'May 30, 2026', doc: 'Dr. Aisha Patel',   spec: 'Cardiology', dx: 'ECG & follow-up',             token: '#A-22', rx: true },
    { date: 'Apr 02, 2026', doc: 'Dr. Priya Kumari',  spec: 'Neurology',  dx: 'Migraine evaluation',         token: '#D-08', rx: true },
  ]

  const filteredDoctors = DOCTORS_PUBLIC.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(docSearch.toLowerCase()) || d.spec.toLowerCase().includes(docSearch.toLowerCase())
    const matchesSpec = selectedSpec === 'All' || d.spec.includes(selectedSpec)
    return matchesSearch && matchesSpec
  })

  return (
    <div className="mobile-layout-flex" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── SIDEBAR ── */}
      <aside className={`mobile-sidebar ${sidebarOpen ? 'open' : ''}`} style={{
        width: 224,
        background: 'rgba(255, 255, 255, 0.75)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        borderRight: '1px solid rgba(18, 198, 186, 0.20)',
        position: 'fixed', top: 42, bottom: 0, left: 0,
        display: 'flex', flexDirection: 'column', padding: '18px 10px', zIndex: 30,
        boxShadow: '4px 0 24px rgba(8, 48, 45, 0.10)',
      }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Sidebar header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-4)', paddingLeft: 4 }}>Navigation</div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="hamburger-btn"
              style={{ width: 28, height: 28, borderRadius: 6 }}
              title="Close menu"
            >
              <X size={14} />
            </button>
          </div>
          {NAV_PATIENT.map(item => (
            <button
              key={item.id}
              className={`nav-link ${nav === item.id ? 'active' : ''}`}
              onClick={() => { setNav(item.id); setSidebarOpen(false) }}
            >
              <span style={{ color: nav === item.id ? 'var(--blue)' : 'var(--text-4)' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
        <hr className="divider" style={{ margin: '12px 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 10px' }}>
          <Avatar name={displayName} size={32} />
          <div style={{ overflow: 'hidden', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.email ?? 'Patient'}
            </div>
          </div>
        </div>
        <button
          className="nav-link"
          onClick={handleSignOut}
          disabled={signingOut}
          style={{ marginTop: 4, color: 'var(--crimson)' }}
        >
          <LogOut size={14} />{signingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </aside>

      {/* ── MAIN CONTENT AREA ── */}
      <div className="mobile-main-content" style={{ marginLeft: 224, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top bar */}
        <div className="topbar">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} title="Open menu">
            <Menu size={18} />
          </button>

          {/* Live token alert banner */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
            borderRadius: 8, padding: '7px 12px', flex: 1, minWidth: 0,
          }}>
            <Bell size={13} color="var(--blue)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong style={{ color: 'var(--blue)' }}>3rd in line</strong> for Dr. Ethan Carr — Est. <strong style={{ color: 'var(--blue)' }}>15 min</strong> wait
            </span>
            <button onClick={() => { setNav('token'); setSidebarOpen(false) }} className="btn btn-sm" style={{ marginLeft: 'auto', flexShrink: 0, background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--blue-border)', fontWeight: 600, fontSize: 11, padding: '4px 10px' }}>View</button>
          </div>

          {/* Right icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <div style={{ position: 'relative', cursor: 'pointer', color: 'var(--text-3)' }}>
              <Bell size={17} />
              <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, background: 'var(--crimson)', borderRadius: '50%', border: '2px solid white' }} />
            </div>
            <Avatar name={displayName} size={30} />
          </div>
        </div>

        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* OVERVIEW TAB */}
          {(nav === 'overview' || nav === 'token') && (
            <>
              {/* Personalized Welcoming Card */}
              <div className="card glass-form-card" style={{ padding: 24, background: 'linear-gradient(135deg, rgba(255,255,255,0.85) 0%, rgba(226,249,247,0.9) 100%)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-1)', marginBottom: 4 }}>
                      Welcome back, {firstName}! 🌿
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                      You have 1 active queue token for today and 2 subscribed doctor updates.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setNav('doctors')} className="btn btn-primary" style={{ height: 40 }}>
                      <Search size={14} /> Find a Doctor
                    </button>
                  </div>
                </div>
              </div>

              {/* ── ACTIVE TOKEN HERO ── */}
              <div style={{
                background: 'linear-gradient(135deg, #0a2523 0%, #0d1e1d 60%, #071312 100%)',
                border: '1px solid rgba(18, 198, 186, 0.25)',
                borderRadius: 18, padding: 26, position: 'relative', overflow: 'hidden'
              }}>
                <div style={{ position: 'absolute', top: -40, right: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16, 179, 168, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
                  <span className="pulse-blue" />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--blue)' }}>Active Queue Token</span>
                </div>
                <div className="responsive-hero-active-token" style={{ display: 'grid', gridTemplateColumns: 'auto 1px 1fr 1px 1fr', gap: 0, alignItems: 'center' }}>
                  {/* Token */}
                  <div style={{ textAlign: 'center', paddingRight: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Your Token</div>
                    <div style={{ fontSize: 60, fontWeight: 900, color: 'var(--blue)', lineHeight: 1, letterSpacing: '-0.04em', fontFamily: 'monospace' }}>#A-14</div>
                    <StatusBadge status="active" />
                  </div>
                  <div className="responsive-divider-line" style={{ width: 1, height: 80, background: 'var(--border)', margin: '0 24px' }} />
                  {/* Serving */}
                  <div style={{ paddingRight: 24 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Now Serving</div>
                    <div style={{ fontSize: 36, fontWeight: 900, color: '#10B981', letterSpacing: '-0.03em', fontFamily: 'monospace' }}>#A-11</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>3 tokens ahead of you</div>
                  </div>
                  <div className="responsive-divider-line" style={{ width: 1, height: 80, background: 'var(--border)', margin: '0 24px' }} />
                  {/* Doctor + progress */}
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Doctor & Room</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>Dr. Ethan Carr</div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>Room 04 · General Medicine</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginBottom: 5 }}>Queue progress</div>
                    <div className="prog"><div className="prog-fill" style={{ width: '73%', background: 'linear-gradient(90deg, var(--blue), var(--blue-dark))' }} /></div>
                    <div style={{ fontSize: 10.5, color: 'var(--blue-dark)', marginTop: 4, fontWeight: 600 }}>11 of 15 tokens completed</div>
                  </div>
                </div>
              </div>

              {/* MAP + UPCOMING */}
              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>
                <div className="card glass-form-card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Map size={15} color="var(--blue)" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Clinic Navigator</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <StatusBadge status="active" />
                      <button className="btn btn-ghost btn-sm">Full Map</button>
                    </div>
                  </div>
                  <div style={{ height: 228, background: '#061a18', position: 'relative', overflow: 'hidden' }}>
                    <svg width="100%" height="228" style={{ position: 'absolute', inset: 0, opacity: 0.18 }}>
                      {Array.from({ length: 10 }).map((_, i) => (
                        <line key={`h${i}`} x1="0" y1={`${i * 12}%`} x2="100%" y2={`${i * 12}%`} stroke="var(--blue)" strokeWidth="0.6" />
                      ))}
                      {Array.from({ length: 16 }).map((_, i) => (
                        <line key={`v${i}`} x1={`${i * 7}%`} y1="0" x2={`${i * 7}%`} y2="100%" stroke="var(--blue)" strokeWidth="0.6" />
                      ))}
                      <rect x="20%" y="30%" width="60%" height="40%" fill="rgba(18,179,168,0.15)" rx="4" />
                      <rect x="35%" y="20%" width="30%" height="60%" fill="rgba(18,179,168,0.15)" rx="4" />
                    </svg>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', zIndex: 2 }}>
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(16,179,168,0.2)', border: '2px solid var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', boxShadow: '0 0 20px rgba(16,179,168,0.3)' }}>
                        <Building2 size={22} color="var(--blue)" />
                      </div>
                      <div style={{ background: 'rgba(7, 21, 20, 0.95)', border: '1px solid var(--border-md)', borderRadius: 6, padding: '4px 10px' }}>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-1)' }}>MediQueue Clinic</div>
                        <div style={{ fontSize: 10, color: 'var(--text-4)' }}>Room 04 · Floor 1</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card glass-form-card" style={{ padding: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 14 }}>Upcoming Appointments</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {upcoming.map((u, i) => (
                      <div key={i} style={{ padding: 12, background: '#ffffff', borderRadius: 10, border: '1px solid var(--border-md)' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{u.doc}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--blue-dark)' }}>{u.spec} · {u.clinic}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{u.date} at {u.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* DOCTOR BROWSING & SEARCH TAB */}
          {nav === 'doctors' && (
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Find & Browse Doctors</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Search by doctor name, specialty, or clinic location</div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {['All', 'Cardiology', 'General', 'Pediatrics'].map(s => (
                    <button key={s} onClick={() => setSelectedSpec(s)} className="btn btn-sm" style={{
                      background: selectedSpec === s ? 'var(--blue)' : '#fff',
                      color: selectedSpec === s ? '#fff' : 'var(--text-2)',
                      border: '1px solid var(--border-md)'
                    }}>{s}</button>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div style={{ position: 'relative', marginBottom: 20 }}>
                <Search size={16} color="var(--text-4)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  className="input"
                  placeholder="Search doctor by name (e.g. Dr. Aisha Patel) or specialty..."
                  value={docSearch}
                  onChange={e => setDocSearch(e.target.value)}
                  style={{ paddingLeft: 40, height: 44, fontSize: 14 }}
                />
              </div>

              {/* Doctors Cards Grid */}
              <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {filteredDoctors.map(doc => (
                  <div key={doc.name} style={{ background: '#ffffff', borderRadius: 14, padding: 18, border: '1px solid var(--border-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                      <Avatar name={doc.name} size={42} />
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{doc.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--blue-dark)' }}>{doc.spec}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-4)' }}>{doc.room}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                      <button onClick={() => toggleSubscribe(doc.name)} className="btn btn-sm btn-ghost" style={{ gap: 4 }}>
                        <Heart size={13} color={subscribedIds.includes(doc.name) ? 'var(--crimson)' : 'var(--text-4)'} fill={subscribedIds.includes(doc.name) ? 'var(--crimson)' : 'none'} />
                        {subscribedIds.includes(doc.name) ? 'Subscribed' : 'Subscribe'}
                      </button>
                      <button className="btn btn-sm btn-primary">Book Token</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBSCRIBED DOCTORS TAB */}
          {nav === 'subscriptions' && (
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginBottom: 6 }}>Subscribed Doctors & Clinic Updates</h3>
              <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 20 }}>Receive real-time delay alerts, available slots & clinic announcements</p>

              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
                {/* Subscribed Doctor Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {subscribedIds.map(docName => (
                    <div key={docName} style={{ padding: 14, background: '#ffffff', borderRadius: 12, border: '1px solid var(--border-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={docName} size={36} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{docName}</div>
                          <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>● Notifications Active</div>
                        </div>
                      </div>
                      <button onClick={() => toggleSubscribe(docName)} className="btn btn-ghost btn-sm">Unsubscribe</button>
                    </div>
                  ))}
                </div>

                {/* Activity Feed */}
                <div style={{ background: '#ffffff', borderRadius: 12, padding: 18, border: '1px solid var(--border-md)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>Live Activity & Delay Feed</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { time: '10 min ago', doc: 'Dr. Aisha Patel', msg: 'Started morning consultations at Room 03. Current wait approx. 8 mins.' },
                      { time: '1 hour ago', doc: 'Dr. Ethan Carr', msg: 'Queue is moving smoothly. 3 tokens ahead of your current appointment.' },
                      { time: 'Yesterday', doc: 'Dr. Aisha Patel', msg: 'New weekend consultation slots opened for Friday.' }
                    ].map((item, i) => (
                      <div key={i} style={{ padding: 12, borderRadius: 10, background: 'var(--blue-dim)', border: '1px solid var(--blue-border)', fontSize: 12.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--blue-dark)', fontWeight: 700, marginBottom: 2 }}>
                          <span>{item.doc}</span>
                          <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>{item.time}</span>
                        </div>
                        <div style={{ color: 'var(--text-2)' }}>{item.msg}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PRESCRIPTIONS & REPORTS TAB */}
          {nav === 'reports' && (
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginBottom: 16 }}>Prescriptions & Diagnostic Reports</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { title: 'Prescription — Upper Respiratory Infection', doc: 'Dr. Ethan Carr', date: 'Jul 12, 2026', type: 'Prescription' },
                  { title: 'Complete Blood Count (CBC) Report', doc: 'Central Diagnostics', date: 'Jul 12, 2026', type: 'Lab Report' },
                  { title: 'Resting Electrocardiogram (ECG)', doc: 'Dr. Aisha Patel', date: 'May 30, 2026', type: 'ECG Report' }
                ].map((r, i) => (
                  <div key={i} style={{ padding: 16, background: '#ffffff', borderRadius: 12, border: '1px solid var(--border-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <FileText size={22} color="var(--blue)" />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{r.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>Issued by {r.doc} on {r.date}</div>
                      </div>
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ gap: 5 }}>
                      <Download size={14} /> Download PDF
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MEDICAL HISTORY TAB */}
          {nav === 'history' && (
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginBottom: 16 }}>Medical History Archive</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {history.map((h, i) => (
                  <div key={i} style={{ padding: 16, background: '#ffffff', borderRadius: 12, border: '1px solid var(--border-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{h.dx}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{h.date}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--blue-dark)' }}>Doctor: {h.doc} ({h.spec}) · Token {h.token}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {nav === 'settings' && (
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginBottom: 16 }}>Patient Profile & Notification Preferences</h3>
              <div style={{ maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Full Name</label>
                  {/* `key` forces a remount when the signed-in user changes —
                      an uncontrolled input ignores a new defaultValue. */}
                  <input key={user?.id} className="input" defaultValue={displayName} style={{ height: 44, fontSize: 14 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Mobile (for SMS Token Alerts)</label>
                  <input className="input" defaultValue="0771234567" style={{ height: 44, fontSize: 14 }} />
                </div>
                <button className="btn btn-primary" style={{ width: 160, height: 42, fontSize: 14 }}>Save Changes</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
