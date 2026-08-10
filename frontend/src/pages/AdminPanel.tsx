import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Activity, Building2, FileText, GitBranch, LogOut, Menu, Plus,
  Search, Settings, Ticket, Users, X, RefreshCw, CheckCircle2,
  AlertCircle, UserCheck, UserX, Stethoscope, ShieldCheck, MessageSquare, Send,
  Pencil, Pause, Play, Trash2
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
import type { ApiCenter, ApiDoctor, AuditLog } from '../lib/api'

const NAV_ADMIN = [
  { id: 'health', icon: <Activity size={15} />, label: 'System Health' },
  { id: 'roles', icon: <Users size={15} />, label: 'Staff & Roles' },
  { id: 'clinics', icon: <Building2 size={15} />, label: 'Medical Centers' },
  { id: 'api', icon: <MessageSquare size={15} />, label: 'Message Center' },
  { id: 'logs', icon: <FileText size={15} />, label: 'Audit Logs' },
]

const SERVICES = [
  { name: 'PostgreSQL Primary DB', latency: '2.3ms', uptime: '99.98%', conns: 142, status: 'healthy' as const },
  { name: 'Redis Cache Adapter', latency: '0.8ms', uptime: '100%', conns: 0, status: 'healthy' as const },
  { name: 'WebSocket (Socket.IO)', latency: '14ms', uptime: '99.91%', conns: 1284, status: 'healthy' as const },
  { name: 'HL7 FHIR Endpoint', latency: '88ms', uptime: '99.5%', conns: 0, status: 'degraded' as const },
  { name: 'SMS / OTP Gateway', latency: '220ms', uptime: '97.2%', conns: 0, status: 'degraded' as const },
  { name: 'Backup DB Replica', latency: '5.1ms', uptime: '99.95%', conns: 18, status: 'healthy' as const },
]

type StaffMember = {
  id: string
  name: string
  role: string
  dept: string
  email: string
  status: 'active' | 'suspended'
  phone: string
  createdAt?: string | null
}

const normalizeRole = (role: string) => {
  const normalized = role.toLowerCase()
  if (normalized.includes('admin')) return 'admin'
  if (normalized.includes('doctor')) return 'doctor'
  if (normalized.includes('reception')) return 'receptionist'
  return 'patient'
}

const formatRoleLabel = (role: string) => {
  switch (role) {
    case 'admin': return 'Admin'
    case 'doctor': return 'Doctor'
    case 'receptionist': return 'Receptionist'
    default: return 'Patient'
  }
}

const formatDept = (role: string) => {
  switch (role) {
    case 'doctor': return 'General Medicine'
    case 'receptionist': return 'Front Desk'
    case 'admin': return 'Administration'
    default: return 'Patient Services'
  }
}

const mapApiUserToStaffMember = (user: { id: string; email: string; fullName: string; phone: string | null; role: string; isActive: boolean; createdAt?: string | null }): StaffMember => ({
  id: user.id,
  name: user.fullName || user.email || 'Unnamed User',
  role: formatRoleLabel(user.role),
  dept: formatDept(user.role),
  email: user.email,
  status: user.isActive ? 'active' : 'suspended',
  phone: user.phone || '',
  createdAt: user.createdAt,
})

export default function AdminPanel() {
  const [nav, setNav] = useState('health')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [staffSearch, setStaffSearch] = useState('')
  const [staffRoleFilter, setStaffRoleFilter] = useState('all')
  const [chartRange, setChartRange] = useState('Today')
  const [showAddCenterModal, setShowAddCenterModal] = useState(false)
  const [showAssignDoctorModal, setShowAssignDoctorModal] = useState(false)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null)
  const [suspendingStaff, setSuspendingStaff] = useState<StaffMember | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(false)

  const [centers, setCenters] = useState<ApiCenter[]>([])
  const [centersLoading, setCentersLoading] = useState(false)
  const [editingCenter, setEditingCenter] = useState<ApiCenter | null>(null)
  const [deletingCenter, setDeletingCenter] = useState<ApiCenter | null>(null)
  const [activeCenter, setActiveCenter] = useState<ApiCenter | null>(null)
  const [doctors, setDoctors] = useState<ApiDoctor[]>([])
  const [doctorsLoading, setDoctorsLoading] = useState(false)

  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Live data from Supabase via backend
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsSource, setLogsSource] = useState<'database' | 'dummy' | null>(null)

  useEffect(() => {
    if (nav === 'clinics') {
      let active = true
      setCentersLoading(true)
      setDoctorsLoading(true)

      Promise.all([api.getCenters(), api.getDoctors()])
        .then(([centersRes, doctorsRes]) => {
          if (!active) return
          setCenters(centersRes.centers)
          setDoctors(doctorsRes.doctors)
        })
        .catch(err => {
          if (!active) return
          console.error('Failed to load centers or doctors', err)
          setCenters([])
          setDoctors([])
        })
        .finally(() => {
          if (!active) return
          setCentersLoading(false)
          setDoctorsLoading(false)
        })

      return () => { active = false }
    }

    if (nav === 'logs') {
      setLogsLoading(true)
      api.getAuditLogs()
        .then(r => { setAuditLogs(r.logs); setLogsSource(r.source) })
        .catch(() => setAuditLogs([]))
        .finally(() => setLogsLoading(false))
    }
    if (nav === 'roles') {
      let active = true
      setLoadingUsers(true)
      api.getUsers()
        .then(r => {
          if (!active) return
          setStaffMembers(r.users.map(mapApiUserToStaffMember))
        })
        .catch(err => {
          if (!active) return
          console.error('Failed to load users', err)
          setStaffMembers([])
        })
        .finally(() => {
          if (!active) return
          setLoadingUsers(false)
        })
      return () => { active = false }
    }

    return undefined
  }, [nav])

  const filteredStaff = staffMembers.filter(s => {
    const searchText = staffSearch.toLowerCase()
    const matchesSearch =
      s.name.toLowerCase().includes(searchText) ||
      s.role.toLowerCase().includes(searchText) ||
      s.dept.toLowerCase().includes(searchText) ||
      s.email.toLowerCase().includes(searchText)

    const matchesRole = staffRoleFilter === 'all' || s.role.toLowerCase() === staffRoleFilter.toLowerCase()

    return matchesSearch && matchesRole
  })

  const staffSummaryCards = [
    { icon: <Users size={18} />, label: 'Total Users', value: staffMembers.length.toLocaleString(), sub: 'All registered accounts', accent: 'var(--text-1)' },
    { icon: <UserCheck size={18} />, label: 'Active Users', value: staffMembers.filter(member => member.status === 'active').length.toLocaleString(), sub: 'Currently enabled', accent: '#0d968d' },
    { icon: <UserX size={18} />, label: 'Suspended Users', value: staffMembers.filter(member => member.status === 'suspended').length.toLocaleString(), sub: 'Needs review', accent: '#f50b0b' },
  ]

  const handleSaveStaff = async () => {
    if (!editingStaff) return

    try {
      const { user } = await api.updateUser(editingStaff.id, {
        fullName: editingStaff.name,
        email: editingStaff.email,
        phone: editingStaff.phone || null,
        role: normalizeRole(editingStaff.role),
        isActive: editingStaff.status === 'active',
      })

      const updatedStaff = mapApiUserToStaffMember(user)
      setStaffMembers(prev => prev.map(member => member.id === editingStaff.id ? {
        ...updatedStaff,
        dept: editingStaff.dept,
      } : member))
      setEditingStaff(null)
    } catch (error) {
      console.error('Failed to update user', error)
      alert('Could not update the user. Please try again.')
    }
  }

  const handleDeleteStaff = async () => {
    if (!deletingStaff) return

    try {
      await api.deleteUser(deletingStaff.id)
      setStaffMembers(prev => prev.filter(member => member.id !== deletingStaff.id))
      setDeletingStaff(null)
    } catch (error) {
      console.error('Failed to delete user', error)
      alert('Could not delete the user. Please try again.')
    }
  }

  const handleSuspendStaff = async () => {
    if (!suspendingStaff) return

    try {
      const nextStatus = suspendingStaff.status === 'active' ? 'suspended' : 'active'
      const { user } = await api.updateUser(suspendingStaff.id, {
        fullName: suspendingStaff.name,
        email: suspendingStaff.email,
        phone: suspendingStaff.phone || null,
        role: normalizeRole(suspendingStaff.role),
        isActive: nextStatus === 'active',
      })

      const updatedStaff = mapApiUserToStaffMember(user)
      setStaffMembers(prev => prev.map(member => member.id === suspendingStaff.id ? {
        ...updatedStaff,
        dept: suspendingStaff.dept,
      } : member))
      setSuspendingStaff(null)
    } catch (error) {
      console.error('Failed to update user status', error)
      alert('Could not change the user status. Please try again.')
    }
  }

  const handleSaveCenter = async () => {
    if (!editingCenter) return

    try {
      const { center } = await api.updateCenter(editingCenter.id, {
        name: editingCenter.name,
        city: editingCenter.city,
        address: editingCenter.address,
        openingHours: editingCenter.opening_hours,
        services: editingCenter.services,
        phone: editingCenter.phone || undefined,
        status: editingCenter.status,
      })
      setCenters(prev => prev.map(item => item.id === center.id ? center : item))
      setEditingCenter(null)
    } catch (error) {
      console.error('Failed to update center', error)
      alert('Could not update the medical center. Please try again.')
    }
  }

  const handleDeleteCenter = async () => {
    if (!deletingCenter) return

    try {
      await api.deleteCenter(deletingCenter.id)
      setCenters(prev => prev.filter(item => item.id !== deletingCenter.id))
      setDeletingCenter(null)
    } catch (error) {
      console.error('Failed to delete center', error)
      alert('Could not delete the medical center. Please try again.')
    }
  }

  const handleAssignDoctor = async (assignment: { doctorId: string; centerId: string; room: string; specialty: string }) => {
    try {
      await api.updateDoctor(assignment.doctorId, {
        centerId: assignment.centerId,
        roomNumber: assignment.room,
        specialization: assignment.specialty,
      })
      const r = await api.getDoctors()
      setDoctors(r.doctors)
      setShowAssignDoctorModal(false)
      setActiveCenter(null)
    } catch (error) {
      console.error('Failed to assign doctor', error)
      alert('Could not assign the doctor. Please try again.')
    }
  }

  const handleRemoveDoctor = async (doctorId: string) => {
    try {
      await api.updateDoctor(doctorId, { centerId: null })
      const r = await api.getDoctors()
      setDoctors(r.doctors)
    } catch (error) {
      console.error('Failed to remove doctor from center', error)
      alert('Could not remove the doctor assignment. Please try again.')
    }
  }

  const handleToggleCenterStatus = async (center: ApiCenter) => {
    const nextStatus = center.status === 'operational' ? 'maintenance' : 'operational'

    try {
      const { center: updatedCenter } = await api.updateCenter(center.id, { status: nextStatus })
      setCenters(prev => prev.map(item => item.id === center.id ? updatedCenter : item))
    } catch (error) {
      console.error('Failed to change center status', error)
      alert('Could not change facility status. Please try again.')
    }
  }

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

      <AssignDoctorModal
        isOpen={showAssignDoctorModal}
        onClose={() => {
          setShowAssignDoctorModal(false)
          setActiveCenter(null)
        }}
        doctors={doctors}
        centers={centers}
        selectedCenter={activeCenter ?? undefined}
        onAssign={handleAssignDoctor}
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
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Review users, update roles, and manage access across the system.</div>
                </div>
                <button className="btn btn-primary" style={{ gap: 6, height: 40 }}>
                  <Plus size={15} /> Add Staff Member
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 18 }}>
                {staffSummaryCards.map(card => (
                  <StatCard key={card.label} icon={card.icon} label={card.label} value={card.value} sub={card.sub} accent={card.accent} />
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
                <div style={{ position: 'relative', maxWidth: 520, flex: 1, minWidth: 280 }}>
                  <Search size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    className="input"
                    placeholder="Search staff by name, role, department, or email"
                    value={staffSearch}
                    onChange={e => setStaffSearch(e.target.value)}
                    style={{ paddingLeft: 36, height: 44, fontSize: 13.5, borderRadius: 12, border: '1px solid var(--border-md)' }}
                  />
                </div>
                <div style={{ position: 'relative', minWidth: 180 }}>
                  <select
                    className="input"
                    value={staffRoleFilter}
                    onChange={e => setStaffRoleFilter(e.target.value)}
                    style={{ height: 44, width: '100%', fontSize: 13.5, borderRadius: 12, border: '1px solid var(--border-md)', background: '#fff', padding: '0 38px 0 14px', appearance: 'none', cursor: 'pointer' }}
                  >
                    <option value="all">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="doctor">Doctor</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="patient">Patient</option>
                  </select>
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-4)' }}>▾</div>
                </div>
              </div>

              <div className="table-responsive-wrapper">
                {loadingUsers ? (
                  <div style={{ padding: 18, color: 'var(--text-4)', fontSize: 13 }}>Loading users from the database…</div>
                ) : filteredStaff.length === 0 ? (
                  <div style={{ padding: 18, color: 'var(--text-4)', fontSize: 13 }}>No users found for this search.</div>
                ) : (
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
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '4px 8px',
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 700,
                              background: s.status === 'active' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.14)',
                              color: s.status === 'active' ? '#10B981' : '#B45309'
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.status === 'active' ? '#10B981' : '#F59E0B' }} />
                              {s.status === 'active' ? 'Active' : 'Suspended'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              <button onClick={() => setEditingStaff({ ...s })} style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Edit user">
                                <Pencil size={16} color="#111827" />
                              </button>
                              <button onClick={() => setSuspendingStaff({ ...s })} style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }} title={s.status === 'active' ? 'Suspend user' : 'Activate user'}>
                                {s.status === 'active' ? <Pause size={16} color="#D97706" /> : <Play size={16} color="#16A34A" />}
                              </button>
                              <button onClick={() => setDeletingStaff({ ...s })} style={{ width: 36, height: 36, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Delete user">
                                <Trash2 size={16} color="#DC2626" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
                {centers.map(c => {
                  const assignedDoctors = doctors.filter(d => d.centerId === c.id)
                  return (
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
                        <StatusBadge status={c.status === 'maintenance' ? 'maintenance' : c.status === 'closed' ? 'down' : 'operational'} />
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
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ flex: 1, minWidth: 120 }}
                            onClick={() => { setActiveCenter(c); setShowAssignDoctorModal(true) }}
                          >
                            <UserCheck size={14} /> Assign Doctor
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ flex: 1, minWidth: 120 }}
                            onClick={() => setEditingCenter(c)}
                          >
                            <Pencil size={14} /> Edit Center
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-sm"
                            style={{ flex: '1 1 auto', minWidth: 120, background: c.status === 'operational' ? '#F59E0B' : '#10B981', color: '#fff' }}
                            onClick={() => handleToggleCenterStatus(c)}
                          >
                            {c.status === 'operational' ? 'Mark for Maintenance' : 'Restore Operation'}
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ flex: '1 1 auto', minWidth: 120, background: '#DC2626', color: '#fff' }}
                            onClick={() => setDeletingCenter(c)}
                          >
                            <Trash2 size={14} /> Delete Center
                          </button>
                        </div>
                        {assignedDoctors.length > 0 && (
                          <div style={{ borderTop: '1px solid var(--border-md)', paddingTop: 12 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>Assigned Doctors ({assignedDoctors.length})</div>
                            <div style={{ display: 'grid', gap: 8 }}>
                              {assignedDoctors.map(doc => (
                                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 12, background: 'rgba(15, 118, 110, 0.05)' }}>
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{doc.name}</div>
                                    <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{doc.dept}{doc.room ? ` · ${doc.room}` : ''}</div>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveDoctor(doc.id)}
                                    className="btn btn-ghost btn-sm"
                                    style={{ minWidth: 110 }}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
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

          {deletingStaff && (
            <div onClick={() => setDeletingStaff(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(8, 48, 45, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 110 }}>
              <div onClick={e => e.stopPropagation()} className="card glass-form-card" style={{ width: '100%', maxWidth: 420, padding: 24, borderRadius: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Delete User</h3>
                  <button onClick={() => setDeletingStaff(null)} className="btn btn-ghost btn-sm">Close</button>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-3)', marginBottom: 18 }}>
                  Are you sure you want to delete <strong>{deletingStaff.name}</strong>? This action cannot be undone.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setDeletingStaff(null)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={handleDeleteStaff} className="btn btn-sm" style={{ background: '#DC2626', color: '#fff', border: '1px solid #DC2626' }}>Delete User</button>
                </div>
              </div>
            </div>
          )}

          {suspendingStaff && (
            <div onClick={() => setSuspendingStaff(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(8, 48, 45, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 105 }}>
              <div onClick={e => e.stopPropagation()} className="card glass-form-card" style={{ width: '100%', maxWidth: 420, padding: 24, borderRadius: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>{suspendingStaff.status === 'active' ? 'Suspend User' : 'Activate User'}</h3>
                  <button onClick={() => setSuspendingStaff(null)} className="btn btn-ghost btn-sm">Close</button>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-3)', marginBottom: 18 }}>
                  {suspendingStaff.status === 'active'
                    ? `Are you sure you want to suspend ${suspendingStaff.name}?`
                    : `Are you sure you want to activate ${suspendingStaff.name}?`}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setSuspendingStaff(null)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={handleSuspendStaff} className="btn btn-sm" style={{ background: '#D97706', color: '#fff', border: '1px solid #D97706' }}>
                    {suspendingStaff.status === 'active' ? 'Suspend User' : 'Activate User'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {editingStaff && (
            <div onClick={() => setEditingStaff(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(8, 48, 45, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }}>
              <div onClick={e => e.stopPropagation()} className="card glass-form-card" style={{ width: '100%', maxWidth: 560, padding: 24, borderRadius: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Edit User Details</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Update profile information and manage account access.</div>
                  </div>
                  <button onClick={() => setEditingStaff(null)} className="btn btn-ghost btn-sm">Close</button>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Full Name</label>
                    <input
                      className="input"
                      value={editingStaff.name}
                      onChange={e => setEditingStaff({ ...editingStaff, name: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Role</label>
                    <select
                      className="input"
                      value={editingStaff.role.toLowerCase()}
                      onChange={e => setEditingStaff({ ...editingStaff, role: e.target.value === 'admin' ? 'Admin' : e.target.value === 'doctor' ? 'Doctor' : e.target.value === 'receptionist' ? 'Receptionist' : 'Patient' })}
                      style={{ height: 44, borderRadius: 12, border: '1px solid var(--border-md)', background: '#fff' }}
                    >
                      <option value="admin">Admin</option>
                      <option value="doctor">Doctor</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="patient">Patient</option>
                    </select>
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Department</label>
                    <input
                      className="input"
                      value={editingStaff.dept}
                      onChange={e => setEditingStaff({ ...editingStaff, dept: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Email</label>
                    <input
                      className="input"
                      value={editingStaff.email}
                      onChange={e => setEditingStaff({ ...editingStaff, email: e.target.value })}
                    />
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Phone</label>
                    <input
                      className="input"
                      value={editingStaff.phone || ''}
                      onChange={e => setEditingStaff({ ...editingStaff, phone: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(18,198,186,0.07)', border: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Account Status</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{editingStaff.status === 'active' ? 'User can access the platform normally.' : 'User account is suspended.'}</div>
                    </div>
                    <div>
                      <button
                        onClick={() => setEditingStaff({ ...editingStaff, status: editingStaff.status === 'active' ? 'suspended' : 'active' })}
                        className="btn btn-sm"
                        style={{ background: editingStaff.status === 'active' ? '#D97706' : '#10B981', color: '#fff', border: '1px solid transparent' }}
                      >
                        {editingStaff.status === 'active' ? 'Suspend' : 'Activate'}
                      </button>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setEditingStaff(null)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button
                    onClick={handleSaveStaff}
                    className="btn btn-primary btn-sm"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          )}

          {editingCenter && (
            <div onClick={() => setEditingCenter(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(8, 48, 45, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }}>
              <div onClick={e => e.stopPropagation()} className="card glass-form-card" style={{ width: '100%', maxWidth: 560, padding: 24, borderRadius: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Edit Medical Center</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Update facility details and operational status.</div>
                  </div>
                  <button onClick={() => setEditingCenter(null)} className="btn btn-ghost btn-sm">Close</button>
                </div>

                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Facility Name</label>
                    <input className="input" value={editingCenter.name} onChange={e => setEditingCenter({ ...editingCenter, name: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>City</label>
                    <input className="input" value={editingCenter.city} onChange={e => setEditingCenter({ ...editingCenter, city: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Address</label>
                    <input className="input" value={editingCenter.address} onChange={e => setEditingCenter({ ...editingCenter, address: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Opening Hours</label>
                    <input className="input" value={editingCenter.opening_hours} onChange={e => setEditingCenter({ ...editingCenter, opening_hours: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Phone</label>
                    <input className="input" value={editingCenter.phone || ''} onChange={e => setEditingCenter({ ...editingCenter, phone: e.target.value })} />
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Services (comma separated)</label>
                    <input
                      className="input"
                      value={editingCenter.services.join(', ')}
                      onChange={e => setEditingCenter({ ...editingCenter, services: e.target.value.split(',').map(item => item.trim()).filter(Boolean) })}
                    />
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Status</label>
                    <select
                      className="input"
                      value={editingCenter.status || 'operational'}
                      onChange={e => setEditingCenter({ ...editingCenter, status: e.target.value as ApiCenter['status'] })}
                      style={{ height: 44, borderRadius: 12, border: '1px solid var(--border-md)', background: '#fff' }}
                    >
                      <option value="operational">Operational</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
                  <button onClick={() => setEditingCenter(null)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={handleSaveCenter} className="btn btn-primary btn-sm">Save Changes</button>
                </div>
              </div>
            </div>
          )}

          {deletingCenter && (
            <div onClick={() => setDeletingCenter(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(8, 48, 45, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 105 }}>
              <div onClick={e => e.stopPropagation()} className="card glass-form-card" style={{ width: '100%', maxWidth: 420, padding: 24, borderRadius: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Delete Medical Center</h3>
                  <button onClick={() => setDeletingCenter(null)} className="btn btn-ghost btn-sm">Close</button>
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--text-3)', marginBottom: 18 }}>
                  Are you sure you want to delete <strong>{deletingCenter.name}</strong>? This will remove the facility from the system.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setDeletingCenter(null)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={handleDeleteCenter} className="btn btn-sm" style={{ background: '#DC2626', color: '#fff', border: '1px solid #DC2626' }}>Delete Center</button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}