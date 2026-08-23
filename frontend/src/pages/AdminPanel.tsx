import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Activity, Building2, FileText, LogOut, Menu, Plus,
  Search, Settings, Ticket, Users, X, RefreshCw, CheckCircle2,
  AlertCircle, UserCheck, UserX, Stethoscope, ShieldCheck, MessageSquare, Send,
  Pencil, Pause, Play, Trash2, ChevronLeft, ChevronRight
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
import type { ApiCenter, ApiDoctor, ApiDoctorRequest, AuditLog } from '../lib/api'

const NAV_ADMIN = [
  { id: 'health', icon: <Activity size={15} />, label: 'System Health' },
  { id: 'approvals', icon: <UserCheck size={15} />, label: 'Doctor Approvals' },
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

function AssignedDoctorsDropdown({
  doctors,
  onRemoveDoctor,
}: {
  doctors: ApiDoctor[]
  onRemoveDoctor: (id: string) => void
}) {
  const [selectedId, setSelectedId] = useState<string>(doctors[0]?.id ?? '')

  if (doctors.length === 0) return null

  // Single assigned doctor -> display single doctor card directly
  if (doctors.length === 1) {
    const doc = doctors[0]
    return (
      <div style={{ borderTop: '1px solid var(--border-md)', paddingTop: 12 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
          Assigned Doctors (1)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 12, background: 'rgba(15, 118, 110, 0.05)', border: '1px solid var(--border-md)' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{doc.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{doc.dept}{doc.room ? ` · ${doc.room}` : ''}</div>
          </div>
          <button
            onClick={() => onRemoveDoctor(doc.id)}
            className="btn btn-ghost btn-sm"
            style={{ minWidth: 110 }}
          >
            Remove
          </button>
        </div>
      </div>
    )
  }

  // More than 1 assigned doctor -> render dropdown box
  const activeDoc = doctors.find(d => d.id === selectedId) || doctors[0]

  return (
    <div style={{ borderTop: '1px solid var(--border-md)', paddingTop: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
        Assigned Doctors ({doctors.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <select
          className="input"
          value={activeDoc?.id ?? ''}
          onChange={e => setSelectedId(e.target.value)}
          style={{
            height: 42,
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 10,
            border: '1px solid var(--border-md)',
            background: 'var(--bg)',
            color: 'var(--text-1)',
            padding: '0 12px',
            cursor: 'pointer'
          }}
        >
          {doctors.map(doc => (
            <option key={doc.id} value={doc.id}>
              {doc.name} — {doc.dept}{doc.room ? ` (${doc.room})` : ''}
            </option>
          ))}
        </select>
        {activeDoc && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: 10, borderRadius: 12, background: 'rgba(15, 118, 110, 0.05)', border: '1px solid var(--border-md)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{activeDoc.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{activeDoc.dept}{activeDoc.room ? ` · ${activeDoc.room}` : ''}</div>
            </div>
            <button
              onClick={() => onRemoveDoctor(activeDoc.id)}
              className="btn btn-ghost btn-sm"
              style={{ minWidth: 110 }}
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

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
  const [_doctorsLoading, setDoctorsLoading] = useState(false)

  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Live data from Supabase via backend
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsSource, setLogsSource] = useState<'database' | 'dummy' | null>(null)
  const [auditLogFilter, setAuditLogFilter] = useState('All Events')
  const [auditLogStartDate, setAuditLogStartDate] = useState('')
  const [auditLogEndDate, setAuditLogEndDate] = useState('')

  const fetchAuditLogs = (params?: { startDate?: string; endDate?: string }) => {
    setLogsLoading(true)
    api.getAuditLogs(params)
      .then(r => { setAuditLogs(r.logs); setLogsSource(r.source) })
      .catch(() => setAuditLogs([]))
      .finally(() => setLogsLoading(false))
  }

  // Doctor Approvals State
  const [pendingRequests, setPendingRequests] = useState<ApiDoctorRequest[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  const [rejectingDoctor, setRejectingDoctor] = useState<ApiDoctorRequest | null>(null)
  const [rejectionReasonInput, setRejectionReasonInput] = useState('')

  // Medical Center Requests State (Receptionist -> Super Admin)
  const [pendingCenterRequests, setPendingCenterRequests] = useState<ApiCenter[]>([])
  const [centerRequestsLoading, setCenterRequestsLoading] = useState(false)
  const [rejectingCenterRequest, setRejectingCenterRequest] = useState<ApiCenter | null>(null)
  const [centerRejectionReasonInput, setCenterRejectionReasonInput] = useState('')

  const fetchPendingDoctors = () => {
    setPendingLoading(true)
    api.getDoctorRequests({ status: 'pending' })
      .then(r => setPendingRequests(r.requests || []))
      .catch(err => {
        console.error('Failed to load pending doctor requests', err)
        setPendingRequests([])
      })
      .finally(() => setPendingLoading(false))
  }

  const fetchPendingCenterRequests = () => {
    setCenterRequestsLoading(true)
    api.getPendingCenters()
      .then(r => setPendingCenterRequests(r.pendingCenters || []))
      .catch(err => {
        console.error('Failed to load pending medical center requests', err)
        setPendingCenterRequests([])
      })
      .finally(() => setCenterRequestsLoading(false))
  }

  useEffect(() => {
    if (nav === 'approvals') {
      fetchPendingDoctors()
    }

    if (nav === 'clinics') {
      let active = true
      setCentersLoading(true)
      setDoctorsLoading(true)
      fetchPendingCenterRequests()

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
      fetchAuditLogs({ startDate: auditLogStartDate, endDate: auditLogEndDate })
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

  const normalizeAuditEventType = (value?: string) => {
    const normalized = String(value ?? '').trim().toLowerCase()
    const map: Record<string, string> = {
      system: 'system_warning',
      request: 'signup',
      approval: 'doctor_approved',
      approved: 'doctor_approved',
      rejected: 'doctor_rejected',
      delete: 'center_delete',
      suspend: 'user_suspended',
      edit: 'center_edit',
    }
    return map[normalized] ?? normalized
  }

  const normalizedAuditLogs = auditLogs.map(log => ({
    ...log,
    event_type: normalizeAuditEventType(log.event_type) as AuditLog['event_type'],
  }))

  const allowedAuditLogTypes = [
    'signup',
    'profile_updated',
    'user_suspended',
    'user_activated',
    'user_deleted',
    'doctor_approved',
    'doctor_rejected',
    'center_delete',
    'center_suspend',
    'center_edit',
    'system_warning',
  ] as const

  const auditLogTypeFilters = ['All Events', ...allowedAuditLogTypes]
  const filteredAuditLogs = (auditLogFilter === 'All Events'
    ? normalizedAuditLogs.filter(log => allowedAuditLogTypes.includes(log.event_type as typeof allowedAuditLogTypes[number]))
    : normalizedAuditLogs.filter(log => log.event_type === auditLogFilter && allowedAuditLogTypes.includes(log.event_type as typeof allowedAuditLogTypes[number])))

  const auditLogBadgeStyles: Record<string, { bg: string; border: string; color: string }> = {
    signup: { bg: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)', color: '#059669' },
    profile_updated: { bg: 'rgba(99,102,241,0.08)', border: '1px solid rgba(79,70,229,0.18)', color: '#4F46E5' },
    user_suspended: { bg: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', color: '#D97706' },
    user_activated: { bg: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.18)', color: '#16A34A' },
    user_deleted: { bg: 'rgba(239,68,68,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#DC2626' },
    doctor_approved: { bg: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)', color: '#059669' },
    doctor_rejected: { bg: 'rgba(239,68,68,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#DC2626' },
    center_delete: { bg: 'rgba(239,68,68,0.08)', border: '1px solid rgba(220,38,38,0.18)', color: '#DC2626' },
    center_suspend: { bg: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)', color: '#D97706' },
    center_edit: { bg: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', color: '#2563EB' },
    system_warning: { bg: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.18)', color: '#475569' },
  }

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
        email: editingCenter.email || undefined,
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

  const handleApproveDoctor = async (requestId: string) => {
    try {
      await api.approveDoctorRequest(requestId)
      fetchPendingDoctors()
      const r = await api.getDoctors()
      setDoctors(r.doctors)
    } catch (error) {
      console.error('Failed to approve doctor request', error)
      alert('Could not approve doctor request. Please try again.')
    }
  }

  const handleConfirmRejectDoctor = async () => {
    if (!rejectingDoctor) return
    try {
      await api.rejectDoctorRequest(rejectingDoctor.id, rejectionReasonInput.trim() || undefined)
      setRejectingDoctor(null)
      setRejectionReasonInput('')
      fetchPendingDoctors()
    } catch (error) {
      console.error('Failed to reject doctor request', error)
      alert('Could not reject doctor request. Please try again.')
    }
  }

  const handleApproveCenterRequest = async (centerId: string) => {
    try {
      await api.approveCenter(centerId)
      fetchPendingCenterRequests()
      const r = await api.getCenters()
      setCenters(r.centers)
    } catch (error) {
      console.error('Failed to approve medical center request', error)
      alert('Could not approve medical center request. Please try again.')
    }
  }

  const handleConfirmRejectCenterRequest = async () => {
    if (!rejectingCenterRequest) return
    try {
      await api.rejectCenter(rejectingCenterRequest.id, centerRejectionReasonInput.trim() || undefined)
      setRejectingCenterRequest(null)
      setCenterRejectionReasonInput('')
      fetchPendingCenterRequests()
    } catch (error) {
      console.error('Failed to reject medical center request', error)
      alert('Could not reject medical center request. Please try again.')
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
            const res = await api.createCenter(centerData)
            if (res?.center) {
              setCenters(prev => {
                const exists = prev.some(c => c.id === res.center.id)
                return exists ? prev : [...prev, res.center]
              })
            }
            const r = await api.getCenters()
            if (r?.centers) {
              setCenters(r.centers)
            }
          } catch (err) {
            console.error('Failed to create center', err)
            alert('Failed to add center to database.')
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

          {/* DOCTOR APPROVALS TAB */}
          {nav === 'approvals' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Doctor Approvals</h2>
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 2 }}>
                    Review doctors requested or registered by receptionists. Approved profiles are activated on the clinic roster.
                  </div>
                </div>
                <button
                  onClick={fetchPendingDoctors}
                  className="btn btn-ghost btn-sm"
                  style={{ gap: 6, border: '1px solid var(--border-md)' }}
                >
                  <RefreshCw size={13} className={pendingLoading ? 'spin' : ''} /> Refresh List
                </button>
              </div>

              {pendingLoading ? (
                <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-4)' }}>Loading pending approvals…</div>
              ) : pendingRequests.length === 0 ? (
                <div style={{
                  padding: '56px 24px', textAlign: 'center', background: 'rgba(255,255,255,0.7)',
                  borderRadius: 16, border: '1.5px dashed var(--border-md)'
                }}>
                  <CheckCircle2 size={42} color="#10B981" style={{ margin: '0 auto 12px' }} />
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>All Clear — No Pending Approvals</h4>
                  <p style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 4 }}>
                    When receptionists add doctors to their medical centers, pending requests will appear here for review.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
                  {pendingRequests.map(doc => (
                    <div key={doc.id} className="card glass-form-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <Avatar name={doc.doctorName} size={44} />
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>{doc.doctorName}</div>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--blue)' }}>{doc.specialization}</div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                          background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)',
                          color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em'
                        }}>
                          {doc.requestType === 'ASSIGN_EXISTING' ? 'Assignment' : 'New Registration'} · Pending
                        </span>
                      </div>

                      <div style={{
                        background: 'rgba(30, 41, 59, 0.03)', border: '1px solid var(--border-md)',
                        borderRadius: 10, padding: '10px 14px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6
                      }}>
                        <div>Center: <strong style={{ color: 'var(--text-1)' }}>{doc.centerName || 'Medical Center'}</strong></div>
                        <div>Room: <strong style={{ color: 'var(--text-1)' }}>{doc.roomNumber || '—'}</strong> · Token Series: <strong style={{ color: 'var(--blue)' }}>{doc.series || 'A'}</strong></div>
                        <div>Requested By: <strong style={{ color: 'var(--text-2)' }}>{doc.receptionistName || 'Receptionist'}</strong></div>
                        {doc.email && <div>Email: <span style={{ color: 'var(--text-3)' }}>{doc.email}</span></div>}
                      </div>

                      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        <button
                          onClick={() => handleApproveDoctor(doc.id)}
                          className="btn btn-emerald btn-sm"
                          style={{ flex: 1, justifyContent: 'center', gap: 6, height: 38 }}
                        >
                          <CheckCircle2 size={14} /> Approve Doctor
                        </button>
                        <button
                          onClick={() => { setRejectingDoctor(doc); setRejectionReasonInput('') }}
                          className="btn btn-ghost btn-sm"
                          style={{ flex: 1, justifyContent: 'center', gap: 6, height: 38, color: 'var(--crimson)' }}
                        >
                          <UserX size={14} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Rejection Modal */}
          {rejectingDoctor && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 10000,
              background: 'rgba(6, 35, 33, 0.65)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
            }}>
              <div className="card glass-form-card" style={{ width: '100%', maxWidth: 440, padding: 28, background: '#ffffff', borderRadius: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)', marginBottom: 8 }}>Reject Doctor Registration</h3>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>
                  Provide an optional rejection reason for Dr. <strong>{rejectingDoctor.doctorName}</strong>.
                </p>
                <textarea
                  className="input"
                  placeholder="e.g. Incomplete credentials, medical center not authorized..."
                  value={rejectionReasonInput}
                  onChange={e => setRejectionReasonInput(e.target.value)}
                  style={{ height: 80, fontSize: 13, padding: 10, marginBottom: 16, width: '100%' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => setRejectingDoctor(null)} className="btn btn-ghost btn-sm">Cancel</button>
                  <button onClick={handleConfirmRejectDoctor} className="btn btn-primary btn-sm" style={{ background: 'var(--crimson)', borderColor: 'var(--crimson)' }}>
                    Confirm Rejection
                  </button>
                </div>
              </div>
            </div>
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

              {/* PENDING MEDICAL CENTER REQUESTS (Receptionist -> Super Admin) */}
              {!centerRequestsLoading && pendingCenterRequests.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>
                    Pending Medical Center Requests ({pendingCenterRequests.length})
                  </h4>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 14 }}>
                    Requested by receptionists. The center stays hidden from booking and reception use until approved here.
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 8 }}>
                    {pendingCenterRequests.map(req => (
                      <div key={req.id} style={{
                        background: 'rgba(245, 158, 11, 0.04)', border: '1px solid rgba(245, 158, 11, 0.28)',
                        borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Building2 size={18} color="var(--blue)" />
                            </div>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{req.name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{req.city}{req.address ? ` · ${req.address}` : ''}</div>
                            </div>
                          </div>
                          <span style={{
                            fontSize: 10.5, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
                            background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)',
                            color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap'
                          }}>
                            Pending
                          </span>
                        </div>

                        <div style={{
                          background: 'rgba(30, 41, 59, 0.03)', border: '1px solid var(--border-md)',
                          borderRadius: 10, padding: '10px 14px', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6
                        }}>
                          <div>Hours: <strong style={{ color: 'var(--text-1)' }}>{req.opening_hours}</strong> · Phone: <strong style={{ color: 'var(--text-1)' }}>{req.phone || '—'}</strong></div>
                          <div>Email: <strong style={{ color: 'var(--text-1)' }}>{req.email || '—'}</strong></div>
                          <div>Requested By: <strong style={{ color: 'var(--text-2)' }}>{req.requestedByName || 'Receptionist'}</strong></div>
                          {req.services && req.services.length > 0 && (
                            <div>Services: <span style={{ color: 'var(--text-3)' }}>{req.services.join(', ')}</span></div>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                          <button
                            onClick={() => handleApproveCenterRequest(req.id)}
                            className="btn btn-emerald btn-sm"
                            style={{ flex: 1, justifyContent: 'center', gap: 6, height: 38 }}
                          >
                            <CheckCircle2 size={14} /> Approve
                          </button>
                          <button
                            onClick={() => { setRejectingCenterRequest(req); setCenterRejectionReasonInput('') }}
                            className="btn btn-ghost btn-sm"
                            style={{ flex: 1, justifyContent: 'center', gap: 6, height: 38, color: 'var(--crimson)' }}
                          >
                            <UserX size={14} /> Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Center Request Rejection Modal */}
              {rejectingCenterRequest && (
                <div style={{
                  position: 'fixed', inset: 0, zIndex: 10000,
                  background: 'rgba(6, 35, 33, 0.65)', backdropFilter: 'blur(10px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
                }}>
                  <div className="card glass-form-card" style={{ width: '100%', maxWidth: 440, padding: 28, background: '#ffffff', borderRadius: 16 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)', marginBottom: 8 }}>Reject Medical Center Request</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>
                      Provide an optional rejection reason for <strong>{rejectingCenterRequest.name}</strong>.
                    </p>
                    <textarea
                      className="input"
                      placeholder="e.g. Duplicate facility, incomplete address..."
                      value={centerRejectionReasonInput}
                      onChange={e => setCenterRejectionReasonInput(e.target.value)}
                      style={{ height: 80, fontSize: 13, padding: 10, marginBottom: 16, width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button onClick={() => setRejectingCenterRequest(null)} className="btn btn-ghost btn-sm">Cancel</button>
                      <button onClick={handleConfirmRejectCenterRequest} className="btn btn-primary btn-sm" style={{ background: 'var(--crimson)', borderColor: 'var(--crimson)' }}>
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                </div>
              )}

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
                        <div style={{ gridColumn: '1/-1' }}><span style={{ color: 'var(--text-4)' }}>Email:</span> <strong>{c.email || '—'}</strong></div>
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
                        <AssignedDoctorsDropdown doctors={assignedDoctors} onRemoveDoctor={handleRemoveDoctor} />
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
            <div className="card glass-form-card" style={{ padding: 18, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)' }}>Platform Audit Logs</h3>
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 2 }}>
                    Track important system events and user actions
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.62)', border: '1px solid var(--border-md)', borderRadius: 10, padding: '6px 10px' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)' }}>From</label>
                    <input
                      type="date"
                      value={auditLogStartDate}
                      onChange={e => setAuditLogStartDate(e.target.value)}
                      className="input"
                      style={{ minWidth: 130, height: 32, fontSize: 12, padding: '0 8px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(148,163,184,0.24)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.62)', border: '1px solid var(--border-md)', borderRadius: 10, padding: '6px 10px' }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)' }}>To</label>
                    <input
                      type="date"
                      value={auditLogEndDate}
                      onChange={e => setAuditLogEndDate(e.target.value)}
                      className="input"
                      style={{ minWidth: 130, height: 32, fontSize: 12, padding: '0 8px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(148,163,184,0.24)' }}
                    />
                  </div>
                  <button
                    onClick={() => fetchAuditLogs({ startDate: auditLogStartDate, endDate: auditLogEndDate })}
                    className="btn btn-ghost btn-sm"
                    style={{ gap: 6, background: 'rgba(255,255,255,0.62)', border: '1px solid var(--border-md)', borderRadius: 10 }}
                  >
                    <RefreshCw size={13} /> Apply
                  </button>
                  <button
                    onClick={() => {
                      setAuditLogStartDate('')
                      setAuditLogEndDate('')
                      fetchAuditLogs()
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{ gap: 6, background: 'rgba(255,255,255,0.62)', border: '1px solid var(--border-md)', borderRadius: 10 }}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '4px 0 12px', borderBottom: '1px solid rgba(148,163,184,0.26)' }}>
                {auditLogTypeFilters.map((filterName) => {
                  const isSelected = auditLogFilter === filterName
                  const badgeStyle = filterName === 'All Events'
                    ? { background: 'rgba(15,118,110,0.06)', border: '1px solid rgba(15,118,110,0.22)', color: '#0F766E' }
                    : auditLogBadgeStyles[filterName] ?? { background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.18)', color: '#475569' }

                  return (
                    <button
                      key={filterName}
                      onClick={() => setAuditLogFilter(filterName)}
                      className="btn btn-sm"
                      style={{
                        padding: '6px 10px',
                        minHeight: 30,
                        borderRadius: 8,
                        fontWeight: 700,
                        ...badgeStyle,
                      }}
                    >
                      {filterName === 'All Events' ? 'All Events' : filterName}
                    </button>
                  )
                })}
              </div>

              {logsLoading && (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-4)' }}>
                  <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <div style={{ marginTop: 8, fontSize: 13 }}>Fetching audit logs…</div>
                </div>
              )}

              {!logsLoading && (
                filteredAuditLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-4)', padding: '30px 12px 12px', fontSize: 13 }}>
                    No audit log entries found in the database.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {Object.entries(filteredAuditLogs.reduce((acc, log) => {
                      const dateKey = new Date(log.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      if (!acc[dateKey]) acc[dateKey] = []
                      acc[dateKey].push(log)
                      return acc
                    }, {} as Record<string, AuditLog[]>)).map(([dateKey, dayLogs]) => (
                      <div key={dateKey} style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid rgba(148,163,184,0.24)', paddingTop: 10 }}>
                        {dayLogs.map((log) => {
                          const eventMeta = auditLogBadgeStyles[log.event_type] ?? auditLogBadgeStyles.system
                          const logDate = new Date(log.time)
                          const timeStr = isNaN(logDate.getTime()) ? '—' : logDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          const statusLabel = log.status || 'completed'
                          const statusColors: Record<string, string> = {
                            approved: '#10B981',
                            pending: '#F59E0B',
                            completed: '#1d51b7',
                            rejected: '#EF4444',
                          }
                          const actorLabel = log.actor || 'System'
                          const eventTypeLabel = log.event_type || 'system'

                          return (
                            <div key={log.id} style={{ display: 'grid', gridTemplateColumns: '118px minmax(0, 1fr) 180px 110px', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid rgba(148,163,184,0.18)' }}>
                              <div style={{ fontSize: 12.5, color: 'var(--text-4)', fontWeight: 600, paddingLeft: 6 }}>{dateKey}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: eventMeta.bg, border: eventMeta.border, color: eventMeta.color }}>
                                  {log.event_type === 'signup' && <CheckCircle2 size={14} />}
                                  {log.event_type === 'profile_updated' && <Pencil size={14} />}
                                  {(log.event_type === 'user_suspended' || log.event_type === 'center_suspend') && <Pause size={14} />}
                                  {(log.event_type === 'user_activated' || log.event_type === 'doctor_approved') && <CheckCircle2 size={14} />}
                                  {(log.event_type === 'user_deleted' || log.event_type === 'center_delete' || log.event_type === 'doctor_rejected') && <UserX size={14} />}
                                  {(log.event_type === 'center_edit' || log.event_type === 'system_warning') && <ShieldCheck size={14} />}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                    <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: eventMeta.bg, border: eventMeta.border, color: eventMeta.color, textTransform: 'lowercase' }}>{eventTypeLabel}</span>
                                    <span style={{ fontWeight: 700, color: 'var(--text-2)', fontSize: 13.5 }}>{log.action}</span>
                                  </div>
                                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {log.center || 'Platform'} · {timeStr}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-4)' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', borderRadius: 999, background: 'rgba(148,163,184,0.10)', border: '1px solid rgba(148,163,184,0.16)', color: 'var(--text-3)', fontWeight: 700 }}>{actorLabel}</span>
                                <span style={{ fontFamily: 'monospace', color: 'var(--text-4)' }}>{log.actor_role || 'system'}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 70, padding: '5px 8px', borderRadius: 7, fontSize: 10.5, fontWeight: 700, background: `${statusColors[statusLabel] || '#6B7280'}14`, border: `1px solid ${statusColors[statusLabel] || '#6B7280'}33`, color: statusColors[statusLabel] || '#6B7280', textTransform: 'uppercase' }}>
                                  {statusLabel}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )
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
                    <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-2)' }}>Email</label>
                    <input className="input" type="email" value={editingCenter.email || ''} onChange={e => setEditingCenter({ ...editingCenter, email: e.target.value })} />
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