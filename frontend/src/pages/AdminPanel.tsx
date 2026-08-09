import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Activity, Building2, FileText, GitBranch, LogOut, Menu, Plus,
  Search, Settings, Ticket, Users, X, RefreshCw, CheckCircle2,
  AlertCircle, UserCheck, Stethoscope, ShieldCheck, MessageSquare, Send
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import AccountMenu from '../components/AccountMenu'
import AssignDoctorModal from '../components/AssignDoctorModal'
import AddCenterModal from '../components/AddCenterModal'
import { Avatar, StatCard, StatusBadge } from '../components/UIPrimitives'
import { api } from '../lib/api'
import type { ApiCenter, AuditLog } from '../lib/api'

const NAV_ADMIN = [
  { id: 'health', icon: <Activity size={15} />, label: 'System Health' },
  { id: 'roles', icon: <Users size={15} />, label: 'Staff & Roles' },
  { id: 'clinics', icon: <Building2 size={15} />, label: 'Medical Centers' },
  { id: 'api', icon: <MessageSquare size={15} />, label: 'Message Center' },
  { id: 'logs', icon: <FileText size={15} />, label: 'Audit Logs' },
]

const STAFF_MEMBERS = [
  { id: '#ST-01', name: 'Dr. Ethan Carr', role: 'Medical Specialist', dept: 'General Medicine', email: 'ethan@mediqueue.io', status: 'active' },
  { id: '#ST-02', name: 'Dr. Aisha Patel', role: 'Senior Specialist', dept: 'Cardiology', email: 'aisha@mediqueue.io', status: 'active' },
  { id: '#ST-03', name: 'Chamari Silva', role: 'Receptionist Staff', dept: 'Front Counter A', email: 'chamari@mediqueue.io', status: 'active' },
  { id: '#ST-04', name: 'Dr. Sofia Montoya', role: 'Specialist', dept: 'Pediatrics', email: 'sofia@mediqueue.io', status: 'active' },
  { id: '#ST-05', name: 'Ruwan Fernando', role: 'Lab Technician', dept: 'Central Lab', email: 'ruwan@mediqueue.io', status: 'active' },
]

const SERVICES = [
  { name: 'PostgreSQL Primary DB', latency: '2.3ms', uptime: '99.98%', conns: 142, status: 'healthy' as const },
  { name: 'Redis Cache Adapter', latency: '0.8ms', uptime: '100%', conns: 0, status: 'healthy' as const },
  { name: 'WebSocket (Socket.IO)', latency: '14ms', uptime: '99.91%', conns: 1284, status: 'healthy' as const },
  { name: 'HL7 FHIR Endpoint', latency: '88ms', uptime: '99.5%', conns: 0, status: 'degraded' as const },
  { name: 'SMS / OTP Gateway', latency: '220ms', uptime: '97.2%', conns: 0, status: 'degraded' as const },
  { name: 'Backup DB Replica', latency: '5.1ms', uptime: '99.95%', conns: 18, status: 'healthy' as const },
]

export default function AdminPanel() {
  const [nav, setNav] = useState('health')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [staffSearch, setStaffSearch] = useState('')
  const [chartRange, setChartRange] = useState('Today')
  const [showAddCenterModal, setShowAddCenterModal] = useState(false)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Live data from Supabase via backend
  const [centers, setCenters] = useState<ApiCenter[]>([])
  const [centersLoading, setCentersLoading] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsSource, setLogsSource] = useState<'database' | 'dummy' | null>(null)

  useEffect(() => {
    if (nav === 'clinics') {
      setCentersLoading(true)
      api.getCenters()
        .then(r => setCenters(r.centers))
        .catch(() => setCenters([]))
        .finally(() => setCentersLoading(false))
    }
    if (nav === 'logs') {
      setLogsLoading(true)
      api.getAuditLogs()
        .then(r => { setAuditLogs(r.logs); setLogsSource(r.source) })
        .catch(() => setAuditLogs([]))
        .finally(() => setLogsLoading(false))
    }
  }, [nav])

  const filteredStaff = STAFF_MEMBERS.filter(s =>
    s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.role.toLowerCase().includes(staffSearch.toLowerCase()) ||
    s.dept.toLowerCase().includes(staffSearch.toLowerCase())
  )

  const handleSignOut = async () => {
    setSigningOut(true)
    navigate('/', { replace: true })
    await logout()
  }

  return (
    <div className="mobile-layout-flex" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      <AddCenterModal
        isOpen={showAddCenterModal}
        onClose={() => setShowAddCenterModal(false)}
        onAdd={async (centerData) => {
          try {
            await api.createCenter(centerData)
            setCentersLoading(true)
            const r = await api.getCenters()
            setCenters(r.centers)
          } catch (err) {
            console.error('Failed to create center', err)
          } finally {
            setCentersLoading(false)
          }
        }}
      />

      {/* ── BROADCAST SUCCESS MODAL ── */}
      {showBroadcastModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(6, 35, 33, 0.65)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16
        }}>
          <div className="fade-in modal-card" style={{
            width: '100%', maxWidth: 400,
            background: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(18, 198, 186, 0.28)',
            borderRadius: 20, padding: '36px 32px',
            boxShadow: '0 20px 60px rgba(8, 48, 45, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
            textAlign: 'center'
          }}>
            <CheckCircle2 size={52} color="#10B981" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)' }}>Message Broadcasted</h4>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6, marginBottom: 24 }}>
              Your alert has been successfully sent to the selected users.
            </p>
            <button
              onClick={() => setShowBroadcastModal(false)}
              className="btn btn-primary"
              style={{ width: '100%', height: 42, fontSize: 14 }}
            >
              OK
            </button>
          </div>
        </div>
      )}

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
              <Avatar name={user?.name ?? 'System Admin'} size={30} color="#0d968d" text="#ffffff" />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name ?? 'System Admin'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.email ?? 'admin@mediqueue.io'}
                </div>
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
          <button
            className="nav-link"
            onClick={handleSignOut}
            disabled={signingOut}
            style={{ color: 'var(--crimson)' }}
          >
            <LogOut size={14} />{signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div className="mobile-main-content" style={{ marginLeft: 210, flex: 1, display: 'flex', flexDirection: 'column' }}>
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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="desktop-only"><StatusBadge status="operational" /></span>
            <AccountMenu compact />
          </div>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* SYSTEM HEALTH TAB */}
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

          {/* STAFF & ROLES MANAGEMENT TAB */}
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

          {/* MEDICAL CENTERS TAB */}
          {nav === 'clinics' && (
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Medical Centers</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Live facility list from Supabase · medical_centers table</div>
                </div>
                <button onClick={() => setShowAddCenterModal(true)} className="btn btn-ghost btn-sm" style={{ gap: 6, height: 40 }}>
                  <Plus size={14} /> Add New Medical Center
                </button>
              </div>

              {centersLoading && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)' }}>
                  <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ marginTop: 8, fontSize: 13 }}>Loading centers from database…</div>
                </div>
              )}

              {!centersLoading && centers.length === 0 && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-4)', fontSize: 13 }}>
                  <Building2 size={32} style={{ marginBottom: 10, opacity: 0.3 }} />
                  <div>No medical centers found in the database.</div>
                  <div style={{ fontSize: 11.5, marginTop: 4 }}>Run backend/src/db/schema.sql in Supabase SQL Editor to seed data.</div>
                </div>
              )}

              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
                {centers.map(c => (
                  <div key={c.id} style={{ background: '#ffffff', borderRadius: 14, padding: 20, border: '1px solid var(--border-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Building2 size={20} color="var(--blue)" />
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{c.name}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{c.city} · {c.address}</div>
                        </div>
                      </div>
                      <StatusBadge status="operational" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'var(--blue-dim)', padding: 12, borderRadius: 10, fontSize: 12, marginBottom: 14 }}>
                      <div><span style={{ color: 'var(--text-4)' }}>Hours:</span> <strong>{c.opening_hours}</strong></div>
                      <div><span style={{ color: 'var(--text-4)' }}>Phone:</span> <strong>{c.phone || '—'}</strong></div>
                      {c.services && c.services.length > 0 && (
                        <div style={{ gridColumn: '1/-1' }}>
                          <span style={{ color: 'var(--text-4)' }}>Services: </span>
                          {c.services.map(s => (
                            <span key={s} style={{ fontSize: 10.5, background: 'rgba(18,198,186,0.15)', color: 'var(--blue-dark)', borderRadius: 5, padding: '2px 7px', marginRight: 4, fontWeight: 600 }}>{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button className="btn btn-ghost btn-sm" style={{ width: '100%' }}>Facility Config</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MESSAGE CENTER TAB */}
          {nav === 'api' && (
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Message Center</h3>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Send alerts and maintenance notifications to users</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                    Target Audience
                  </label>
                  <select className="input" style={{ height: 44, fontSize: 14 }}>
                    <option value="all">All Users</option>
                    <option value="patients">Patients Only</option>
                    <option value="doctors">Doctors Only</option>
                    <option value="receptionists">Receptionists Only</option>
                    <option value="staff">All Staff (Doctors & Receptionists)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                    Message Content
                  </label>
                  <textarea
                    className="input"
                    placeholder="Type your message here... (e.g., The system will be down for maintenance at midnight)"
                    style={{ minHeight: 120, fontSize: 14, resize: 'vertical', padding: '12px 14px' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button className="btn btn-primary" onClick={() => setShowBroadcastModal(true)} style={{ gap: 8, height: 42, padding: '0 20px', fontSize: 14 }}>
                    <Send size={16} /> Send Message
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AUDIT LOGS TAB */}
          {nav === 'logs' && (
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Platform Audit Logs</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>
                    Incoming requests, approvals &amp; actions · {logsSource === 'dummy' ? 'Demo data (backend running)' : logsSource === 'database' ? 'Live from Supabase' : 'Loading…'}
                  </div>
                </div>
                <button onClick={() => { setLogsLoading(true); api.getAuditLogs().then(r => { setAuditLogs(r.logs); setLogsSource(r.source) }).finally(() => setLogsLoading(false)) }} className="btn btn-ghost btn-sm" style={{ gap: 6 }}>
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>

              {logsLoading && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-4)' }}>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ marginTop: 8, fontSize: 13 }}>Fetching audit logs…</div>
                </div>
              )}

              {!logsLoading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {auditLogs.map((log) => {
                    const roleColors: Record<string, { bg: string; color: string; border: string }> = {
                      receptionist: { bg: 'rgba(16,185,129,0.08)', color: '#059669', border: 'rgba(16,185,129,0.25)' },
                      patient: { bg: 'rgba(59,130,246,0.08)', color: '#2563EB', border: 'rgba(59,130,246,0.25)' },
                      doctor: { bg: 'rgba(139,92,246,0.08)', color: '#7C3AED', border: 'rgba(139,92,246,0.25)' },
                      admin: { bg: 'rgba(245,158,11,0.08)', color: '#D97706', border: 'rgba(245,158,11,0.25)' },
                      system: { bg: 'rgba(107,114,128,0.08)', color: '#6B7280', border: 'rgba(107,114,128,0.25)' },
                    }
                    const statusColors: Record<string, string> = {
                      approved: '#10B981', pending: '#F59E0B', completed: '#6B7280', rejected: '#EF4444'
                    }
                    const roleStyle = roleColors[log.actor_role] || roleColors.system
                    const eventIcons: Record<string, React.ReactNode> = {
                      approval: <CheckCircle2 size={13} color="#10B981" />,
                      request: <AlertCircle size={13} color="#F59E0B" />,
                      token_issued: <Ticket size={13} color="var(--blue)" />,
                      no_show: <UserCheck size={13} color="#EF4444" />,
                      prescription: <Stethoscope size={13} color="#7C3AED" />,
                      system: <ShieldCheck size={13} color="#6B7280" />,
                    }
                    const timeStr = (() => { try { return new Date(log.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) } catch { return log.time } })()
                    return (
                      <div key={log.id} style={{ padding: '12px 16px', borderRadius: 10, background: '#ffffff', border: `1px solid var(--border)`, borderLeft: `4px solid ${roleStyle.color}`, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-4)', fontSize: 11.5, flexShrink: 0, paddingTop: 2 }}>{timeStr}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: roleStyle.bg, color: roleStyle.color, border: `1px solid ${roleStyle.border}`, flexShrink: 0 }}>
                          {log.actor}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          {eventIcons[log.event_type] || eventIcons.system}
                        </span>
                        <span style={{ fontSize: 13, color: 'var(--text-2)', flex: 1, minWidth: 180 }}>{log.action}</span>
                        <select
                          value={log.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value as AuditLog['status']
                            setAuditLogs(logs => logs.map(l => l.id === log.id ? { ...l, status: newStatus } : l))
                            try {
                              await api.updateAuditLogStatus(log.id, newStatus)
                            } catch (err) {
                              console.error('Failed to update status', err)
                              setAuditLogs(logs => logs.map(l => l.id === log.id ? { ...l, status: log.status } : l))
                            }
                          }}
                          style={{
                            fontSize: 10.5, fontWeight: 700, color: statusColors[log.status] || '#6B7280', flexShrink: 0,
                            textTransform: 'uppercase', background: 'transparent', border: `1px solid var(--border)`,
                            borderRadius: 4, padding: '2px 4px', cursor: 'pointer', outline: 'none'
                          }}
                        >
                          <option value="approved">Approved</option>
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}