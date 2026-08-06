import { useState } from 'react'
import {
  Activity, Building2, FileText, GitBranch, LogOut, Menu, Plus,
  Search, Settings, Ticket, UserCheck, Users, X
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import AssignDoctorModal from '../components/AssignDoctorModal'
import AddCenterModal from '../components/AddCenterModal'
import { Avatar, StatCard, StatusBadge } from '../components/UIPrimitives'

const NAV_ADMIN = [
  { id: 'health',  icon: <Activity size={15} />,    label: 'System Health' },
  { id: 'roles',   icon: <Users size={15} />,        label: 'Staff & Roles' },
  { id: 'clinics', icon: <Building2 size={15} />,    label: 'Medical Centers' },
  { id: 'api',     icon: <GitBranch size={15} />,    label: 'API & Services' },
  { id: 'logs',    icon: <FileText size={15} />,     label: 'Audit Logs' },
]

const STAFF_MEMBERS = [
  { id: '#ST-01', name: 'Dr. Ethan Carr', role: 'Medical Specialist', dept: 'General Medicine', email: 'ethan@mediqueue.io', status: 'active' },
  { id: '#ST-02', name: 'Dr. Aisha Patel', role: 'Senior Specialist', dept: 'Cardiology', email: 'aisha@mediqueue.io', status: 'active' },
  { id: '#ST-03', name: 'Chamari Silva', role: 'Receptionist Staff', dept: 'Front Counter A', email: 'chamari@mediqueue.io', status: 'active' },
  { id: '#ST-04', name: 'Dr. Sofia Montoya', role: 'Specialist', dept: 'Pediatrics', email: 'sofia@mediqueue.io', status: 'active' },
  { id: '#ST-05', name: 'Ruwan Fernando', role: 'Lab Technician', dept: 'Central Lab', email: 'ruwan@mediqueue.io', status: 'active' },
]

const CLINICS_ADMIN = [
  { name: 'MediQueue Central Clinic', city: 'Colombo 07', docs: 8, hours: '08:00–20:00', tokens: 412, status: 'operational' as const },
  { name: 'MediQueue North Branch', city: 'Kandy', docs: 5, hours: '09:00–18:00', tokens: 287, status: 'operational' as const },
  { name: 'MediQueue Emergency Center', city: 'Galle', docs: 6, hours: '00:00–24:00', tokens: 195, status: 'operational' as const },
  { name: 'MediQueue East Wing', city: 'Batticaloa', docs: 3, hours: '07:00–22:00', tokens: 0, status: 'maintenance' as const },
]

const SERVICES = [
  { name: 'PostgreSQL Primary DB',    latency: '2.3ms',  uptime: '99.98%', conns: 142, status: 'healthy'  as const },
  { name: 'Redis Cache Adapter',      latency: '0.8ms',  uptime: '100%',   conns: 0,   status: 'healthy'  as const },
  { name: 'WebSocket (Socket.IO)',    latency: '14ms',   uptime: '99.91%', conns: 1284,status: 'healthy'  as const },
  { name: 'HL7 FHIR Endpoint',       latency: '88ms',   uptime: '99.5%',  conns: 0,   status: 'degraded' as const },
  { name: 'SMS / OTP Gateway',       latency: '220ms',  uptime: '97.2%',  conns: 0,   status: 'degraded' as const },
  { name: 'Backup DB Replica',        latency: '5.1ms',  uptime: '99.95%', conns: 18,  status: 'healthy'  as const },
]

export default function AdminPanel() {
  const [nav, setNav] = useState('health')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [staffSearch, setStaffSearch] = useState('')
  const [chartRange, setChartRange] = useState('Today')
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showAddCenterModal, setShowAddCenterModal] = useState(false)

  const filteredStaff = STAFF_MEMBERS.filter(s =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.role.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.dept.toLowerCase().includes(staffSearch.toLowerCase())
  )

  return (
    <div className="mobile-layout-flex" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      <AssignDoctorModal isOpen={showAssignModal} onClose={() => setShowAssignModal(false)} />
      <AddCenterModal isOpen={showAddCenterModal} onClose={() => setShowAddCenterModal(false)} />

      {/* ── MOBILE SIDEBAR OVERLAY ── */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── SIDEBAR ── */}
      <aside className={`mobile-sidebar ${sidebarOpen ? 'open' : ''}`} style={{
        width: 210,
        background: 'rgba(255, 255, 255, 0.78)',
        backdropFilter: 'blur(28px) saturate(160%)',
        WebkitBackdropFilter: 'blur(28px) saturate(160%)',
        borderRight: '1px solid rgba(18, 198, 186, 0.18)',
        position: 'fixed', top: 42, bottom: 0, left: 0,
        display: 'flex', flexDirection: 'column', padding: '18px 10px', zIndex: 30,
        boxShadow: '4px 0 24px rgba(8, 48, 45, 0.10)',
      }}>
        <div style={{ marginBottom: 20, flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 4px 14px', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Avatar name="SY Admin" size={30} color="#0d968d" text="#ffffff" />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)' }}>System Admin</div>
                <div style={{ fontSize: 10, color: 'var(--text-4)' }}>root@mediqueue.io</div>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="hamburger-btn"
              style={{ width: 28, height: 28, borderRadius: 6 }}
              title="Close"
            >
              <X size={13} />
            </button>
          </div>
          {NAV_ADMIN.map(item => (
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
        <div style={{ marginTop: 'auto' }}>
          <hr className="divider" style={{ margin: '0 0 12px' }} />
          <button className="nav-link"><Settings size={14} />Platform Settings</button>
          <button className="nav-link"><LogOut size={14} />Sign Out</button>
        </div>
      </aside>

      {/* ── MAIN CONTENT — topbar row for mobile hamburger ── */}
      <div className="mobile-main-content" style={{ marginLeft: 210, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Admin Mobile Topbar — only visible on mobile via .topbar sticky */}
        <div className="topbar" style={{ borderBottom: '1px solid rgba(18,198,186,0.14)' }}>
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} title="Open menu">
            <Menu size={18} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #12c6ba, #0d968d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1.2 }}>System Admin Console</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-4)' }}>MediQueue Platform · v3.2.1</div>
            </div>
          </div>
          <div style={{ marginLeft: 'auto' }} className="desktop-only">
            <StatusBadge status="operational" />
          </div>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* SYSTEM HEALTH TAB (ORIGINAL + ENRICHED STATS) */}
        {nav === 'health' && (
          <>
            <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              <StatCard icon={<Building2 size={18} />} label="Active Centers" value="4 / 4" sub="All operational" accent="var(--text-1)" />
              <StatCard icon={<Ticket size={18} />} label="Total Tokens Today" value="1,234" sub="Peak: 158/hr" accent="var(--blue)" />
              <StatCard icon={<Users size={18} />} label="Active Platform Users" value="1,420" sub="Doctors, Staff & Patients" accent="#10B981" />
              <StatCard icon={<Activity size={18} />} label="Platform Health" value="99.98%" sub="Uptime 30d" accent="#10B981" />
            </div>

            {/* TRAFFIC & CAPACITY CHART */}
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>Platform Queue Traffic & Patient Load</h3>
                  <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>Real-time arrival rate vs max capacity threshold</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['Today', '7 Days', '30 Days'].map(r => (
                    <button key={r} onClick={() => setChartRange(r)} className="btn btn-sm" style={{
                      background: chartRange === r ? 'var(--blue)' : '#fff',
                      color: chartRange === r ? '#fff' : 'var(--text-2)',
                      border: '1px solid var(--border-md)'
                    }}>{r}</button>
                  ))}
                </div>
              </div>
              <div style={{ height: 220, background: '#ffffff', borderRadius: 12, padding: 16, border: '1px solid var(--border-md)' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { hour: '08:00', arrivals: 42, capacity: 80 },
                    { hour: '10:00', arrivals: 112, capacity: 120 },
                    { hour: '12:00', arrivals: 96, capacity: 120 },
                    { hour: '14:00', arrivals: 120, capacity: 120 },
                    { hour: '16:00', arrivals: 158, capacity: 120 },
                    { hour: '18:00', arrivals: 76, capacity: 80 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="hour" stroke="var(--text-4)" />
                    <YAxis stroke="var(--text-4)" />
                    <Tooltip />
                    <Area type="monotone" dataKey="arrivals" stroke="var(--blue)" fill="var(--blue-dim)" strokeWidth={2} />
                    <Area type="monotone" dataKey="capacity" stroke="#F59E0B" fill="none" strokeDasharray="4 4" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* SERVICES HEALTH TABLE */}
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', marginBottom: 14 }}>Core Infrastructure & Microservices Status</h3>
              <div className="table-responsive-wrapper">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
                  <thead>
                    <tr style={{ background: 'rgba(18, 198, 186, 0.08)', textAlign: 'left', color: 'var(--text-4)', textTransform: 'uppercase', fontSize: 11 }}>
                      <th style={{ padding: '10px 14px' }}>Service Name</th>
                      <th style={{ padding: '10px 14px' }}>Latency</th>
                      <th style={{ padding: '10px 14px' }}>30d Uptime</th>
                      <th style={{ padding: '10px 14px' }}>Active Connections</th>
                      <th style={{ padding: '10px 14px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SERVICES.map(s => (
                      <tr key={s.name} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--blue-dark)', fontFamily: 'monospace' }}>{s.latency}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-3)' }}>{s.uptime}</td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-3)' }}>{s.conns}</td>
                        <td style={{ padding: '12px 14px' }}><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* STAFF & ROLES MANAGEMENT TAB (WITH SEARCH BAR) */}
        {nav === 'roles' && (
          <div className="card glass-form-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Staff & Role Management</h3>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Create staff accounts, assign system roles & permission levels</div>
              </div>
              <button className="btn btn-primary" style={{ gap: 6, height: 40 }}>
                <Plus size={15} /> Add Staff Member
              </button>
            </div>

            {/* SEARCH BAR FOR ROLE MANAGEMENT */}
            <div style={{ position: 'relative', marginBottom: 18, maxWidth: 480 }}>
              <Search size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="input"
                placeholder="Search staff by Name, Role (e.g. Doctor, Receptionist), or Dept..."
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                style={{ paddingLeft: 36, height: 42, fontSize: 13.5 }}
              />
            </div>

            {/* Staff Directory Table */}
            <div className="table-responsive-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 640 }}>
                <thead>
                  <tr style={{ background: 'rgba(18, 198, 186, 0.08)', textAlign: 'left', color: 'var(--text-4)', textTransform: 'uppercase', fontSize: 11 }}>
                    <th style={{ padding: '10px 14px' }}>Staff ID</th>
                    <th style={{ padding: '10px 14px' }}>Name</th>
                    <th style={{ padding: '10px 14px' }}>Assigned Role</th>
                    <th style={{ padding: '10px 14px' }}>Department</th>
                    <th style={{ padding: '10px 14px' }}>Email</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, fontFamily: 'monospace' }}>{s.id}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-1)' }}>{s.name}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--blue-dark)', fontWeight: 600 }}>{s.role}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-3)' }}>{s.dept}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-3)' }}>{s.email}</td>
                      <td style={{ padding: '12px 14px' }}><StatusBadge status="active" /></td>
                      <td style={{ padding: '12px 14px' }}>
                        <button className="btn btn-ghost btn-sm">Edit Role</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MEDICAL CENTERS MANAGEMENT & DOCTOR ASSIGNMENT TAB */}
        {nav === 'clinics' && (
          <div className="card glass-form-card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Medical Centers & Doctor Assignment</h3>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Register new medical centers, assign doctors, and manage facility rooms</div>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => setShowAddCenterModal(true)} className="btn btn-ghost btn-sm" style={{ gap: 6, height: 40 }}>
                  <Plus size={14} /> Add New Medical Center
                </button>
                <button onClick={() => setShowAssignModal(true)} className="btn btn-primary btn-sm" style={{ gap: 6, height: 40 }}>
                  <UserCheck size={16} /> Assign Doctor to Center
                </button>
              </div>
            </div>

            {/* Medical Centers Cards Grid */}
            <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>
              {CLINICS_ADMIN.map(c => (
                <div key={c.name} style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid var(--border-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Building2 size={22} color="var(--blue)" />
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{c.city} · Hours: {c.hours}</div>
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--blue-dim)', padding: 12, borderRadius: 10, fontSize: 12.5, marginBottom: 14 }}>
                    <div>Doctors On Duty: <strong>{c.docs}</strong></div>
                    <div>Today's Tokens: <strong>{c.tokens}</strong></div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setShowAssignModal(true)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                      Assign Doctor
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1 }}>
                      Facility Config
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API & INTEGRATIONS TAB */}
        {nav === 'api' && (
          <div className="card glass-form-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginBottom: 14 }}>API & HL7 FHIR Integration Status</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ padding: 16, background: '#ffffff', borderRadius: 12, border: '1px solid var(--border-md)' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>HL7 FHIR v4.0 Endpoint</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>https://api.mediqueue.io/fhir/v4</div>
                <div style={{ fontSize: 11.5, color: '#10B981', marginTop: 6, fontWeight: 600 }}>● Active & Synchronized with Hospital EHR</div>
              </div>
            </div>
          </div>
        )}

        {/* AUDIT LOGS TAB */}
        {nav === 'logs' && (
          <div className="card glass-form-card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginBottom: 14 }}>Platform Audit Logs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
              {[
                { time: '18:42:10', actor: 'Dr. Ethan Carr', action: 'Issued prescription for #A-11' },
                { time: '18:30:05', actor: 'Receptionist Counter A', action: 'Issued walk-in token #A-15' },
                { time: '18:15:22', actor: 'System Admin', action: 'Assigned Dr. Aisha Patel to Central Clinic Room 03' },
                { time: '17:45:10', actor: 'System Admin', action: 'Registered new facility: MediQueue North Medical Center' }
              ].map((log, i) => (
                <div key={i} style={{ padding: 12, borderRadius: 8, background: '#ffffff', border: '1px solid var(--border)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-4)' }}>{log.time}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{log.actor}</span>
                  <span style={{ color: 'var(--text-3)' }}>{log.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>{/* end padding wrapper */}
      </div>{/* end mobile-main-content */}
    </div>
  )
}
