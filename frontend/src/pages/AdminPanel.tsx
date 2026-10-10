import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

import {
  Activity, Building2, FileText, LogOut, Menu, Plus,
  Search, Ticket, Users, X, RefreshCw, CheckCircle2,
  AlertCircle, UserX, Stethoscope, ShieldCheck, MessageSquare, Send,
  Pencil, Pause, Play, Trash2, RotateCcw, Check, CornerDownLeft, Bell,
  ChevronDown, CreditCard, Clock
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AccountMenu from '../components/AccountMenu'
import AddDoctorModal from '../components/AddDoctorModal'
import AddCenterModal from '../components/AddCenterModal'
import { Avatar, StatCard, StatusBadge } from '../components/UIPrimitives'
import { ViewReportModal } from '../components/ViewReportModal'
import { api } from '../lib/api'
import type { ApiCenter, ApiDoctor, ApiUser, AuditLog, ApiCenterAdminMessage } from '../lib/api'

const NAV_ADMIN = [
  { id: 'health', icon: <Activity size={15} />, label: 'System Health' },
  { id: 'roles', icon: <Users size={15} />, label: 'Staff & Roles' },
  { id: 'clinics', icon: <Building2 size={15} />, label: 'Medical Centers' },
  { id: 'billing', icon: <CreditCard size={15} />, label: 'Billing & Payments' },
  { id: 'api', icon: <MessageSquare size={15} />, label: 'Message Centers' },
  { id: 'logs', icon: <FileText size={15} />, label: 'Audit Logs' },
]

type StaffMember = {
  id: string
  name: string
  rawRole: string
  role: string
  dept: string
  email: string
  status: 'active' | 'suspended'
  phone: string
  age?: number | null
  dateOfBirth?: string | null
  specialization?: string | null
  medicalCenters?: string[]
  currentStatus?: string | null
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

const mapApiUserToStaffMember = (user: ApiUser): StaffMember => ({
  id: user.id,
  name: user.fullName || user.email || 'Unnamed User',
  rawRole: user.role,
  role: formatRoleLabel(user.role),
  dept: user.specialization || formatDept(user.role),
  email: user.email,
  status: user.isActive ? 'active' : 'suspended',
  phone: user.phone || '',
  age: user.age ?? null,
  dateOfBirth: user.dateOfBirth ?? null,
  specialization: user.specialization ?? null,
  medicalCenters: user.medicalCenters || [],
  currentStatus: user.currentStatus ?? null,
  createdAt: user.createdAt,
})

function AdminHoursDisplay({ rawHours }: { rawHours?: string | null }) {
  const [expanded, setExpanded] = useState(false)
  if (!rawHours || !rawHours.trim()) {
    return <span>—</span>
  }

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  let schedule: { day: string; isOpen: boolean; openTime: string; closeTime: string }[] | null = null

  if (rawHours.includes('|') || rawHours.includes(':')) {
    const parts = rawHours.split('|').map(s => s.trim())
    const map = new Map<string, { isOpen: boolean; openTime: string; closeTime: string }>()
    parts.forEach(p => {
      const match = p.match(/^([A-Za-z]+)\s*:\s*(.+)$/)
      if (match) {
        const prefix = match[1].toLowerCase()
        const timePart = match[2].trim()
        if (timePart.toLowerCase().includes('close')) {
          map.set(prefix, { isOpen: false, openTime: '', closeTime: '' })
        } else {
          const times = timePart.split(/[-–]/).map(t => t.trim())
          map.set(prefix, { isOpen: true, openTime: times[0] || '', closeTime: times[1] || '' })
        }
      }
    })
    if (map.size > 0) {
      schedule = days.map(d => {
        const key = d.toLowerCase().slice(0, 3)
        const found = map.get(key) || map.get(d.toLowerCase())
        if (found) return { day: d, ...found }
        return { day: d, isOpen: d !== 'Sunday', openTime: '08:00 AM', closeTime: '05:00 PM' }
      })
    }
  }

  if (!schedule) {
    return <strong>{rawHours}</strong>
  }

  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date().getDay()]
  const todaySchedule = schedule.find(s => s.day === todayName) || schedule[0]

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <strong>
          Today ({todayName}): {todaySchedule.isOpen ? `${todaySchedule.openTime} – ${todaySchedule.closeTime}` : 'Closed'}
        </strong>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 2, color: 'var(--blue)',
            fontSize: 11, fontWeight: 700, padding: '0 4px',
          }}
        >
          {expanded ? 'Hide' : 'Schedule'}
          <ChevronDown size={12} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
      </div>

      {expanded && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100, minWidth: 240,
          background: '#ffffff', border: '1px solid var(--border-md)',
          borderRadius: 8, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4,
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
        }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 2 }}>
            Weekly Schedule
          </div>
          {schedule.map(item => {
            const isToday = item.day === todayName
            return (
              <div
                key={item.day}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: 11.5, padding: '2px 0',
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? 'var(--blue-dark)' : 'var(--text-2)',
                }}
              >
                <span>{item.day}</span>
                <span>{item.isOpen ? `${item.openTime} – ${item.closeTime}` : 'Closed'}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const DOCTOR_SPECIALISATIONS = [
  'General Medicine', 'Cardiology', 'Pediatrics', 'Orthopedics',
  'Dermatology', 'Neurology', 'Ophthalmology', 'ENT',
  'Gynecology', 'Psychiatry', 'Oncology', 'Radiology',
  'Gastroenterology', 'Urology', 'Endocrinology', 'Other',
]

const SRI_LANKA_PROVINCES = [
  'Western Province',
  'Central Province',
  'Southern Province',
  'Northern Province',
  'Eastern Province',
  'North Western Province',
  'North Central Province',
  'Uva Province',
  'Sabaragamuwa Province',
]

const SRI_LANKA_DISTRICTS = [
  // Western Province
  'Colombo', 'Gampaha', 'Kalutara',
  // Central Province
  'Kandy', 'Matale', 'Nuwara Eliya',
  // Southern Province
  'Galle', 'Matara', 'Hambantota',
  // Northern Province
  'Jaffna', 'Kilinochchi', 'Mannar', 'Mullaitivu', 'Vavuniya',
  // Eastern Province
  'Batticaloa', 'Ampara', 'Trincomalee',
  // North Western Province
  'Kurunegala', 'Puttalam',
  // North Central Province
  'Anuradhapura', 'Polonnaruwa',
  // Uva Province
  'Badulla', 'Monaragala',
  // Sabaragamuwa Province
  'Ratnapura', 'Kegalle',
]

function HeaderFilterDropdown({
  title,
  activeValue,
  options,
  isOpen,
  onToggle,
  onSelect,
  theme = 'blue',
}: {
  title: string
  activeValue: string
  options: { label: string; value: string }[]
  isOpen: boolean
  onToggle: () => void
  onSelect: (val: string) => void
  theme?: 'blue' | 'green' | 'yellow'
}) {
  const isFiltered = activeValue !== 'all' && activeValue !== ''

  const themeStyles = {
    blue: {
      activeBg: 'rgba(37, 99, 235, 0.16)',
      activeColor: '#1D4ED8',
      activeBorder: 'rgba(37, 99, 235, 0.35)',
      menuBorder: '1px solid rgba(37, 99, 235, 0.25)',
      itemHover: 'rgba(37, 99, 235, 0.08)',
      itemActiveBg: 'rgba(37, 99, 235, 0.12)',
      itemActiveColor: '#1D4ED8',
      shadow: '0 12px 32px rgba(37, 99, 235, 0.18)',
    },
    green: {
      activeBg: 'rgba(16, 185, 129, 0.16)',
      activeColor: '#047857',
      activeBorder: 'rgba(16, 185, 129, 0.35)',
      menuBorder: '1px solid rgba(16, 185, 129, 0.25)',
      itemHover: 'rgba(16, 185, 129, 0.08)',
      itemActiveBg: 'rgba(16, 185, 129, 0.12)',
      itemActiveColor: '#047857',
      shadow: '0 12px 32px rgba(16, 185, 129, 0.18)',
    },
    yellow: {
      activeBg: 'rgba(245, 158, 11, 0.20)',
      activeColor: '#B45309',
      activeBorder: 'rgba(245, 158, 11, 0.45)',
      menuBorder: '1px solid rgba(245, 158, 11, 0.35)',
      itemHover: 'rgba(245, 158, 11, 0.08)',
      itemActiveBg: 'rgba(245, 158, 11, 0.14)',
      itemActiveColor: '#B45309',
      shadow: '0 12px 32px rgba(245, 158, 11, 0.18)',
    },
  }[theme]

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span>{title}</span>
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          onToggle()
        }}
        style={{
          background: isFiltered ? themeStyles.activeBg : 'transparent',
          border: isFiltered ? `1px solid ${themeStyles.activeBorder}` : '1px solid transparent',
          color: isFiltered ? themeStyles.activeColor : 'inherit',
          borderRadius: 6,
          padding: '2px 5px',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          fontSize: 11,
          fontWeight: 700,
          transition: 'all 0.15s ease',
        }}
        title={`Filter by ${title}`}
      >
        <ChevronDown
          size={14}
          strokeWidth={2.4}
          style={{
            color: isFiltered ? themeStyles.activeColor : 'currentColor',
            opacity: 1,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s ease, color 0.15s ease'
          }}
        />
        {isFiltered && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: themeStyles.activeColor }} />
        )}
      </button>

      {isOpen && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 100,
            minWidth: 210,
            maxWidth: 280,
            maxHeight: 280,
            overflowY: 'auto',
            background: '#ffffff',
            borderRadius: 12,
            border: themeStyles.menuBorder,
            boxShadow: `${themeStyles.shadow}, 0 4px 12px rgba(0, 0, 0, 0.08)`,
            padding: 6,
            textTransform: 'none',
            fontWeight: 500,
            fontSize: 12.5,
          }}
        >
          {options.map((opt, i) => {
            const isSelected = activeValue === opt.value
            return (
              <div
                key={i}
                onClick={() => {
                  onSelect(opt.value)
                  onToggle()
                }}
                style={{
                  padding: '7px 10px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  background: isSelected ? themeStyles.itemActiveBg : 'transparent',
                  color: isSelected ? themeStyles.itemActiveColor : 'var(--text-1)',
                  fontWeight: isSelected ? 700 : 500,
                  transition: 'background 0.12s',
                  marginBottom: 2,
                }}
                onMouseEnter={e => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = themeStyles.itemHover
                }}
                onMouseLeave={e => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {opt.label}
                </span>
                {isSelected && (
                  <span style={{ fontSize: 13, lineHeight: 1 }}>✓</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AssignedDoctorsDropdown({
  doctors,
  centerId,
  onRemoveDoctor,
}: {
  doctors: ApiDoctor[]
  centerId: string
  onRemoveDoctor: (id: string, centerId: string) => void
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
            onClick={() => onRemoveDoctor(doc.id, centerId)}
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
              onClick={() => onRemoveDoctor(activeDoc.id, centerId)}
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
  const [staffSubTab, setStaffSubTab] = useState<'patients' | 'doctors' | 'centers'>('patients')
  const [staffStatusFilter, setStaffStatusFilter] = useState('all')

  // Header column filters
  const [patientCenterFilter, setPatientCenterFilter] = useState('all')
  const [doctorSpecFilter, setDoctorSpecFilter] = useState('all')
  const [doctorCenterFilter, setDoctorCenterFilter] = useState('all')
  const [centerProvinceFilter, setCenterProvinceFilter] = useState('all')
  const [centerDistrictFilter, setCenterDistrictFilter] = useState('all')
  const [activeHeaderFilter, setActiveHeaderFilter] = useState<string | null>(null)

  const handleClearAllFilters = () => {
    setStaffSearch('')
    setStaffStatusFilter('all')
    setPatientCenterFilter('all')
    setDoctorSpecFilter('all')
    setDoctorCenterFilter('all')
    setCenterProvinceFilter('all')
    setCenterDistrictFilter('all')
    setActiveHeaderFilter(null)
  }

  useEffect(() => {
    const handleGlobalClick = () => setActiveHeaderFilter(null)
    if (activeHeaderFilter) {
      window.addEventListener('click', handleGlobalClick)
      return () => window.removeEventListener('click', handleGlobalClick)
    }
  }, [activeHeaderFilter])

  const [showAddCenterModal, setShowAddCenterModal] = useState(false)
  const [doctorModalOpen, setDoctorModalOpen] = useState(false)
  const [modalDoctorCenter, setModalDoctorCenter] = useState<ApiCenter | null>(null)
  const [editingDoctorProfile, setEditingDoctorProfile] = useState<ApiDoctor | null>(null)
  const [showBroadcastModal, setShowBroadcastModal] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [viewingDocument, setViewingDocument] = useState<any>(null)

  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [deletingStaff, setDeletingStaff] = useState<StaffMember | null>(null)
  const [suspendingStaff, setSuspendingStaff] = useState<StaffMember | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(false)

  const [centers, setCenters] = useState<ApiCenter[]>([])
  const [centersLoading, setCentersLoading] = useState(false)
  const [editingCenter, setEditingCenter] = useState<ApiCenter | null>(null)
  const [deletingCenter, setDeletingCenter] = useState<ApiCenter | null>(null)
  const [doctors, setDoctors] = useState<ApiDoctor[]>([])
  const [_doctorsLoading, setDoctorsLoading] = useState(false)

  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [statsLoading, setStatsLoading] = useState(false)
  const [systemStats, setSystemStats] = useState<any>(null)

  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [changingMaintenance, setChangingMaintenance] = useState(false)

  const [centerInquiries, setCenterInquiries] = useState<ApiCenterAdminMessage[]>([])
  const [loadingInquiries, setLoadingInquiries] = useState(false)
  const [adminUnreadCount, setAdminUnreadCount] = useState(0)
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)

  // Message Center composer state
  const [adminSelectedCenterId, setAdminSelectedCenterId] = useState('all')
  const [adminMessageSubject, setAdminMessageSubject] = useState('')
  const [adminMessageBody, setAdminMessageBody] = useState('')
  const [adminMessageSending, setAdminMessageSending] = useState(false)
  const [adminMessageSuccess, setAdminMessageSuccess] = useState<string | null>(null)

  // Billing & Payments state
  const [billingFilter, setBillingFilter] = useState<'all' | 'verified' | 'pending' | 'flagged'>('all')
  const [remittanceRecords, setRemittanceRecords] = useState([
    {
      id: 'rem-1',
      centerId: 'c1',
      centerName: 'MediQueue Central Clinic',
      city: 'Colombo 07',
      plan: 'Professional Tier',
      month: 'October 2026',
      amount: 'LKR 15,000',
      refNo: 'BOC-992144',
      submittedAt: '2026-10-02',
      status: 'pending' as 'pending' | 'verified' | 'flagged',
      slipUrl: '#',
    },
    {
      id: 'rem-2',
      centerId: 'c2',
      centerName: 'MediQueue North Branch',
      city: 'Kandy',
      plan: 'Professional Tier',
      month: 'October 2026',
      amount: 'LKR 15,000',
      refNo: 'COMB-441208',
      submittedAt: '2026-10-01',
      status: 'verified' as 'pending' | 'verified' | 'flagged',
      slipUrl: '#',
    },
    {
      id: 'rem-3',
      centerId: 'c3',
      centerName: 'Apex Family Care Center',
      city: 'Galle',
      plan: 'Standard Tier',
      month: 'October 2026',
      amount: 'LKR 15,000',
      refNo: 'HNB-771923',
      submittedAt: '2026-10-04',
      status: 'pending' as 'pending' | 'verified' | 'flagged',
      slipUrl: '#',
    },
    {
      id: 'rem-4',
      centerId: 'c4',
      centerName: 'Sunrise Medical Clinic',
      city: 'Negombo',
      plan: 'Professional Tier',
      month: 'September 2026',
      amount: 'LKR 15,000',
      refNo: 'BOC-331092',
      submittedAt: '2026-09-02',
      status: 'verified' as 'pending' | 'verified' | 'flagged',
      slipUrl: '#',
    },
  ])

  const handleVerifyRemittance = (recordId: string) => {
    setRemittanceRecords(prev => prev.map(r => r.id === recordId ? { ...r, status: 'verified' } : r))
  }

  const handleFlagRemittance = (recordId: string) => {
    setRemittanceRecords(prev => prev.map(r => r.id === recordId ? { ...r, status: 'flagged' } : r))
  }

  const handleSendAdminNotice = async () => {
    if (!adminMessageBody.trim()) {
      alert('Please enter a message to send.')
      return
    }
    setAdminMessageSending(true)
    try {
      const targetCenters = centers.length > 0 ? centers : (await api.getCenters({ all: true })).centers
      if (adminSelectedCenterId === 'all') {
        if (targetCenters.length === 0) {
          alert('No medical centers found to send messages to.')
          setAdminMessageSending(false)
          return
        }
        await Promise.all(
          targetCenters.map(c =>
            api.sendCenterMessage(c.id, {
              title: adminMessageSubject.trim() || undefined,
              message: adminMessageBody.trim(),
              category: 'general',
            })
          )
        )
        setAdminMessageSuccess(`Notice successfully broadcast to all ${targetCenters.length} medical centers!`)
      } else {
        const center = targetCenters.find(c => c.id === adminSelectedCenterId)
        await api.sendCenterMessage(adminSelectedCenterId, {
          title: adminMessageSubject.trim() || undefined,
          message: adminMessageBody.trim(),
          category: 'general',
        })
        setAdminMessageSuccess(`Notice successfully sent to ${center?.name || 'the medical center'}!`)
      }
      setAdminMessageSubject('')
      setAdminMessageBody('')
      fetchCenterInquiries()
      setTimeout(() => setAdminMessageSuccess(null), 4000)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not send notice. Please try again.')
    } finally {
      setAdminMessageSending(false)
    }
  }

  const fetchUnreadCount = async () => {
    try {
      const res = await api.getAdminMessagesUnreadCount()
      if (typeof res?.unreadCount === 'number') {
        setAdminUnreadCount(res.unreadCount)
      }
    } catch (_) {}
  }

  const fetchCenterInquiries = async () => {
    setLoadingInquiries(true)
    try {
      const res = await api.getCenterMessagesToAdmin()
      if (res?.messages) {
        setCenterInquiries(res.messages)
      }
      fetchUnreadCount()
    } catch (err) {
      console.warn('Could not load center messages', err)
    } finally {
      setLoadingInquiries(false)
    }
  }

  const handleMarkAsRead = async (messageId: string) => {
    try {
      await api.markCenterMessageRead(messageId, true)
      setCenterInquiries(prev => prev.map(m => {
        if (m.id === messageId) return { ...m, isRead: true }
        if (m.replies) {
          return {
            ...m,
            replies: m.replies.map(r => r.id === messageId ? { ...r, isRead: true } : r)
          }
        }
        return m
      }))
      setAdminUnreadCount(c => Math.max(0, c - 1))
      fetchUnreadCount()
    } catch (err) {
      console.warn('Could not mark message as read', err)
    }
  }

  const handleMarkAsUnread = async (messageId: string) => {
    try {
      await api.markCenterMessageRead(messageId, false)
      setCenterInquiries(prev => prev.map(m => {
        if (m.id === messageId) return { ...m, isRead: false }
        if (m.replies) {
          return {
            ...m,
            replies: m.replies.map(r => r.id === messageId ? { ...r, isRead: false } : r)
          }
        }
        return m
      }))
      setAdminUnreadCount(c => c + 1)
      fetchUnreadCount()
    } catch (err) {
      console.warn('Could not mark message as unread', err)
    }
  }

  const handleSendReply = async (inquiry: ApiCenterAdminMessage) => {
    if (!replyText.trim()) return
    setReplySending(true)
    try {
      await api.sendCenterMessage(inquiry.centerId, {
        message: replyText.trim(),
        parentId: inquiry.id,
      })
      setReplyText('')
      setReplyingToId(null)
      fetchCenterInquiries()
      fetchUnreadCount()
    } catch (err) {
      alert('Could not send reply. Please try again.')
    } finally {
      setReplySending(false)
    }
  }

  useEffect(() => {
    fetchUnreadCount()
    api.getCenters({ all: true }).then(r => {
      if (r?.centers) setCenters(r.centers)
    }).catch(err => console.warn('Could not load centers on mount', err))

    const timer = setInterval(fetchUnreadCount, 25000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (nav === 'api' || nav === 'billing') {
      fetchCenterInquiries()
      if (centers.length === 0) {
        api.getCenters({ all: true }).then(r => {
          if (r?.centers) setCenters(r.centers)
        }).catch(err => console.warn('Could not load centers', err))
      }
    }
  }, [nav])

  // Fetch initial maintenance state on mount
  useEffect(() => {
    api.getSettings().then(r => {
      setMaintenanceMode(r.settings?.maintenance_mode || false)
    }).catch(err => console.error('Failed to load maintenance settings', err))
  }, [])

  const handleToggleMaintenance = async () => {
    const nextMode = !maintenanceMode
    // Switching this on signs every patient, doctor and receptionist out of the
    // platform. It used to fire on a single click of an unlabelled toggle.
    if (nextMode && !window.confirm(
      'Turn on maintenance mode?\n\nEvery patient, doctor and receptionist will be locked out until you turn it off. Live queues and bookings will stop.'
    )) {
      return
    }

    setChangingMaintenance(true)
    try {
      const res = await api.setMaintenanceMode(nextMode)
      setMaintenanceMode(res.settings?.maintenance_mode || false)
    } catch (err: any) {
      console.error('Failed to toggle maintenance mode', err)
      alert(err?.message || 'Could not update maintenance mode. Please run the system_settings table creation script in Supabase.')
    } finally {
      setChangingMaintenance(false)
    }
  }

  const fetchSystemStats = () => {
    setStatsLoading(true)
    api.getSystemStats()
      .then(r => setSystemStats(r))
      .catch(err => console.error('Failed to load system stats', err))
      .finally(() => setStatsLoading(false))
  }

  // Live data from Supabase via backend
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [_logsSource, setLogsSource] = useState<'database' | 'dummy' | null>(null)
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

  // Medical Center Requests State (Receptionist -> Super Admin)
  const [pendingCenterRequests, setPendingCenterRequests] = useState<ApiCenter[]>([])
  const [centerRequestsLoading, setCenterRequestsLoading] = useState(false)
  const [rejectingCenterRequest, setRejectingCenterRequest] = useState<ApiCenter | null>(null)
  const [centerRejectionReasonInput, setCenterRejectionReasonInput] = useState('')

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

  // Pending New Doctor Requests State (Receptionist -> System Admin approval)
  const [pendingDoctorRequests, setPendingDoctorRequests] = useState<import('../lib/api').ApiDoctorRequest[]>([])
  const [doctorRequestsLoading, setDoctorRequestsLoading] = useState(false)
  const [rejectingDoctorRequest, setRejectingDoctorRequest] = useState<import('../lib/api').ApiDoctorRequest | null>(null)
  const [doctorRejectionReasonInput, setDoctorRejectionReasonInput] = useState('')

  const fetchPendingNewDoctorRequests = () => {
    setDoctorRequestsLoading(true)
    api.getDoctorRequests({ status: 'pending' })
      .then(r => setPendingDoctorRequests((r.requests || []).filter((req: import('../lib/api').ApiDoctorRequest) => req.requestType === 'CREATE_NEW')))
      .catch(err => {
        console.error('Failed to load pending doctor requests', err)
        setPendingDoctorRequests([])
      })
      .finally(() => setDoctorRequestsLoading(false))
  }

  const refreshClinicsData = () => {
    setCentersLoading(true)
    setDoctorsLoading(true)
    fetchPendingCenterRequests()

    return Promise.all([api.getCenters(), api.getDoctors()])
      .then(([centersRes, doctorsRes]) => {
        setCenters(centersRes.centers)
        setDoctors(doctorsRes.doctors)
      })
      .catch(err => {
        console.error('Failed to load centers or doctors', err)
        setCenters([])
        setDoctors([])
      })
      .finally(() => {
        setCentersLoading(false)
        setDoctorsLoading(false)
      })
  }

  const refreshRolesData = () => {
    setLoadingUsers(true)
    fetchPendingNewDoctorRequests()
    return Promise.all([
      api.getUsers(),
      api.getCenters().catch(() => ({ centers: [] })),
      api.getDoctors().catch(() => ({ doctors: [] })),
    ])
      .then(([usersRes, centersRes, docsRes]) => {
        setStaffMembers(usersRes.users.map(mapApiUserToStaffMember))
        if (centersRes?.centers) setCenters(centersRes.centers)
        if (docsRes?.doctors) setDoctors(docsRes.doctors)
      })
      .catch(err => {
        console.error('Failed to load users', err)
        setStaffMembers([])
      })
      .finally(() => {
        setLoadingUsers(false)
      })
  }

  useEffect(() => {
    if (nav === 'health') {
      fetchSystemStats()
    }

    if (nav === 'clinics') {
      refreshClinicsData()
    }

    if (nav === 'logs') {
      fetchAuditLogs({ startDate: auditLogStartDate, endDate: auditLogEndDate })
    }
    if (nav === 'roles') {
      refreshRolesData()
    }

    return undefined
  }, [nav])

  const query = staffSearch.trim().toLowerCase()

  const patientsList = staffMembers.filter(s => s.rawRole === 'patient')
  const doctorsList = staffMembers.filter(s => s.rawRole === 'doctor')

  const filteredPatients = patientsList.filter(s => {
    const matchesSearch = !query ||
      s.name.toLowerCase().includes(query) ||
      s.email.toLowerCase().includes(query) ||
      s.phone.toLowerCase().includes(query) ||
      (s.medicalCenters || []).some(c => c.toLowerCase().includes(query))
    const matchesStatus = staffStatusFilter === 'all' || s.status === staffStatusFilter
    const matchesCenter = patientCenterFilter === 'all' ||
      (s.medicalCenters || []).some(c => c.toLowerCase() === patientCenterFilter.toLowerCase())
    return matchesSearch && matchesStatus && matchesCenter
  })

  const filteredDoctors = doctorsList.filter(s => {
    const matchedDoc = doctors.find(d => d.email === s.email || d.id === s.id)
    const allDocCenters = Array.from(new Set([
      ...(s.medicalCenters || []),
      ...(matchedDoc?.centers?.map(c => c.centerName).filter((c): c is string => Boolean(c)) || []),
      ...(matchedDoc?.centerName ? [matchedDoc.centerName] : [])
    ])).filter((c): c is string => Boolean(c))
    const matchesSearch = !query ||
      s.name.toLowerCase().includes(query) ||
      (s.specialization || s.dept || '').toLowerCase().includes(query) ||
      s.email.toLowerCase().includes(query) ||
      s.phone.toLowerCase().includes(query) ||
      allDocCenters.some(c => c.toLowerCase().includes(query))
    const matchesStatus = staffStatusFilter === 'all' || s.status === staffStatusFilter
    const matchesSpec = doctorSpecFilter === 'all' ||
      (s.specialization || s.dept || '').toLowerCase() === doctorSpecFilter.toLowerCase()
    const matchesDocCenter = doctorCenterFilter === 'all' ||
      allDocCenters.some(c => c.toLowerCase() === doctorCenterFilter.toLowerCase())
    return matchesSearch && matchesStatus && matchesSpec && matchesDocCenter
  })

  const filteredCenters = centers.filter(c => {
    const matchesSearch = !query ||
      c.name.toLowerCase().includes(query) ||
      (c.province || '').toLowerCase().includes(query) ||
      (c.city || '').toLowerCase().includes(query) ||
      (c.email || '').toLowerCase().includes(query) ||
      (c.phone || '').toLowerCase().includes(query)
    const matchesStatus = staffStatusFilter === 'all' || (c.status || 'operational') === staffStatusFilter
    const matchesProvince = centerProvinceFilter === 'all' || (() => {
      const cleanFilter = centerProvinceFilter.replace(/\s*province$/i, '').trim().toLowerCase()
      const cleanProv = (c.province || '').replace(/\s*province$/i, '').trim().toLowerCase()
      return cleanProv === cleanFilter
    })()
    const matchesDistrict = centerDistrictFilter === 'all' ||
      (c.city || '').toLowerCase() === centerDistrictFilter.toLowerCase()
    return matchesSearch && matchesStatus && matchesProvince && matchesDistrict
  })

  // Dropdown options
  const medicalCenterOptions = [
    { label: 'All Medical Centers', value: 'all' },
    ...Array.from(new Set([
      ...centers.map(c => c.name),
      ...staffMembers.flatMap(s => s.medicalCenters || []),
      ...doctors.flatMap(d => d.centers?.map(c => c.centerName).filter((cn): cn is string => Boolean(cn)) || (d.centerName ? [d.centerName] : []))
    ])).filter(Boolean).sort().map(name => ({ label: name, value: name }))
  ]

  const specializationOptions = [
    { label: 'All Specializations', value: 'all' },
    ...DOCTOR_SPECIALISATIONS.map(spec => ({ label: spec, value: spec }))
  ]

  const provinceOptions = [
    { label: 'All Provinces', value: 'all' },
    ...SRI_LANKA_PROVINCES.map(p => ({ label: p, value: p })),
    ...Array.from(new Set(centers.map(c => c.province).filter((p): p is string => Boolean(p))))
      .filter(p => !SRI_LANKA_PROVINCES.some(sp => sp.toLowerCase() === p.toLowerCase() || sp.replace(/\s*province$/i, '').trim().toLowerCase() === p.replace(/\s*province$/i, '').trim().toLowerCase()))
      .map(p => ({ label: p, value: p }))
  ]

  const districtOptions = [
    { label: 'All Districts', value: 'all' },
    ...SRI_LANKA_DISTRICTS.map(d => ({ label: d, value: d })),
    ...Array.from(new Set(centers.map(c => c.city).filter((c): c is string => Boolean(c))))
      .filter(c => !SRI_LANKA_DISTRICTS.some(d => d.toLowerCase() === c.toLowerCase()))
      .map(d => ({ label: d, value: d }))
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
    : normalizedAuditLogs.filter(log => {
        if (auditLogFilter === 'profile_updated') {
          return log.event_type === 'profile_updated' || (log.event_type === 'center_edit' && log.action.toLowerCase().includes('profile updated')) || (log.event_type === 'center_edit' && log.action.toLowerCase().includes('medical center updated'))
        }
        return log.event_type === auditLogFilter && allowedAuditLogTypes.includes(log.event_type as typeof allowedAuditLogTypes[number])
      }))

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

  const handleRemoveDoctor = async (doctorId: string, centerId: string) => {
    try {
      await api.updateDoctor(doctorId, { removeCenterId: centerId })
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

  const handleApproveDoctorRequest = async (requestId: string) => {
    try {
      await api.adminApproveDoctorRequest(requestId)
      fetchPendingNewDoctorRequests()
      alert('Doctor request approved! Account created and credentials sent via SMS.')
    } catch (error: any) {
      console.error('Failed to approve doctor request', error)
      alert(error?.message || 'Could not approve doctor request. Please try again.')
    }
  }

  const handleConfirmRejectDoctorRequest = async () => {
    if (!rejectingDoctorRequest) return
    try {
      await api.adminRejectDoctorRequest(rejectingDoctorRequest.id, doctorRejectionReasonInput.trim() || undefined)
      setRejectingDoctorRequest(null)
      setDoctorRejectionReasonInput('')
      fetchPendingNewDoctorRequests()
    } catch (error) {
      console.error('Failed to reject doctor request', error)
      alert('Could not reject doctor request. Please try again.')
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
        isAdmin={true}
        mode="create"
        onAdd={async () => {
          await refreshClinicsData()
          await refreshRolesData()
        }}
      />

      <AddCenterModal
        isOpen={Boolean(editingCenter)}
        onClose={() => setEditingCenter(null)}
        isAdmin={true}
        mode="edit"
        editCenter={editingCenter}
        onUpdated={async () => {
          await refreshClinicsData()
          await refreshRolesData()
          setEditingCenter(null)
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
        // 46px == the fixed DevNavbar's height (see App.tsx paddingTop). At 42 the
        // sidebar's first 4px sat behind the navbar.
        position: 'fixed', top: 46, bottom: 0, left: 0,
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
              style={{ display: 'flex', alignItems: 'center', width: '100%' }}
            >
              <span style={{ color: nav === item.id ? 'var(--blue)' : 'var(--text-4)' }}>{item.icon}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
              {item.id === 'api' && adminUnreadCount > 0 && (
                <span style={{
                  background: '#8B5CF6',
                  color: '#ffffff',
                  borderRadius: 999,
                  padding: '2px 7px',
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: 1,
                  boxShadow: '0 2px 6px rgba(139, 92, 246, 0.4)',
                }}>
                  {adminUnreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 'auto' }}>
          <hr className="divider" style={{ margin: '0 0 12px' }} />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img src="/logo.png" alt="MediQueue" style={{ height: 26, width: 'auto', objectFit: 'contain' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1.2 }}>System Admin Console</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-4)' }}>MediQueue Platform · v3.2.1</div>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Topbar Notifications Button (Admin) */}
            <button
              type="button"
              onClick={() => setNav('api')}
              style={{
                background: nav === 'api' ? '#6D28D9' : '#7C3AED',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: '6px 14px',
                fontWeight: 700,
                fontSize: 12.5,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              title="View Inquiries & Messages from Medical Centers"
            >
              <Bell size={14} />
              <span>Notifications</span>
              {adminUnreadCount > 0 && (
                <span style={{
                  background: '#EF4444',
                  color: '#fff',
                  borderRadius: '999px',
                  padding: '1px 6px',
                  fontSize: 10.5,
                  fontWeight: 800,
                  lineHeight: '14px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }}>
                  {adminUnreadCount}
                </span>
              )}
            </button>

            <div className="desktop-only" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.5)', padding: '6px 12px', borderRadius: 100, border: '1px solid var(--border-md)' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: maintenanceMode ? 'var(--crimson)' : 'var(--text-2)' }}>
                {maintenanceMode ? 'Maintenance Mode' : 'Operational'}
              </span>
              {/* This switch takes the whole platform offline for every user,
                  and it had no accessible name, no state and no confirmation —
                  a screen reader announced only "button", and a stray click or
                  Enter keypress on a focused control flipped it silently. */}
              <button
                onClick={handleToggleMaintenance}
                disabled={changingMaintenance}
                role="switch"
                aria-checked={maintenanceMode}
                aria-label={maintenanceMode
                  ? 'Maintenance mode is on — turn it off to bring the platform back online'
                  : 'Platform is operational — turn on maintenance mode'}
                title={maintenanceMode
                  ? 'Turn off maintenance mode'
                  : 'Turn on maintenance mode (locks out all non-admin users)'}
                style={{
                  width: 36, height: 20, borderRadius: 20,
                  background: maintenanceMode ? 'var(--crimson)' : '#10B981',
                  position: 'relative', cursor: changingMaintenance ? 'not-allowed' : 'pointer',
                  border: 'none', transition: '0.2s', opacity: changingMaintenance ? 0.7 : 1
                }}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, left: maintenanceMode ? 19 : 3,
                  transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>
            <AccountMenu compact />
          </div>
        </div>

        <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* SYSTEM HEALTH TAB */}
          {nav === 'health' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>System Health Dashboard</h2>
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 2 }}>
                    Real-time metrics and platform status overview from the database.
                  </div>
                </div>
                <button
                  onClick={fetchSystemStats}
                  className="btn btn-ghost btn-sm"
                  style={{ gap: 6, border: '1px solid var(--border-md)' }}
                >
                  <RefreshCw size={13} className={statsLoading ? 'spin' : ''} /> Refresh Data
                </button>
              </div>

              {statsLoading && !systemStats ? (
                <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-4)' }}>
                   <RefreshCw size={28} className="spin" style={{ margin: '0 auto 16px', opacity: 0.6, color: 'var(--blue)' }} />
                   <div style={{ fontSize: 13, fontWeight: 600 }}>Loading system statistics...</div>
                </div>
              ) : systemStats ? (
                <>
                  <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                    <StatCard icon={<Building2 size={18} />} label="Active Centers" value={`${systemStats.centers.operational} / ${systemStats.centers.total}`} sub={`${systemStats.centers.maintenance} in maintenance`} accent="var(--text-1)" />
                    <StatCard icon={<Ticket size={18} />} label="Total Tokens Today" value={systemStats.queue.tokensToday.toLocaleString()} sub={`${systemStats.queue.completedToday} completed`} accent="var(--blue)" />
                    <StatCard icon={<Users size={18} />} label="Active Platform Users" value={systemStats.users.active.toLocaleString()} sub={`${systemStats.users.total} total registered`} accent="#10B981" />
                    <StatCard icon={<Activity size={18} />} label="Platform Health" value="Optimal" sub={`${systemStats.audit.eventsToday} events logged today`} accent="#10B981" />
                  </div>

                  {/* detailed stats sections */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                    
                    {/* User Demographics */}
                    <div className="card glass-form-card" style={{ padding: 24, background: 'linear-gradient(145deg, #ffffff, rgba(255,255,255,0.6))' }}>
                       <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Users size={18} color="var(--blue)" /> User Distribution
                       </h3>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          {Object.entries(systemStats.users.byRole).map(([role, count]) => (
                            <div key={role} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(30,41,59,0.02)', padding: '10px 14px', borderRadius: 10 }}>
                               <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', textTransform: 'capitalize' }}>{role}s</span>
                               <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{count as React.ReactNode}</span>
                            </div>
                          ))}
                          <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px dashed var(--border-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-4)' }}>Suspended Accounts</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--crimson)', background: 'rgba(239,68,68,0.1)', padding: '2px 8px', borderRadius: 6 }}>{systemStats.users.suspended}</span>
                          </div>
                       </div>
                    </div>

                    {/* Doctors Overview */}
                    <div className="card glass-form-card" style={{ padding: 24, background: 'linear-gradient(145deg, #ffffff, rgba(255,255,255,0.6))' }}>
                       <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Stethoscope size={18} color="#10B981" /> Doctor Roster
                       </h3>
                       <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(30,41,59,0.02)', padding: '10px 14px', borderRadius: 10 }}>
                             <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Total Doctors</span>
                             <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{systemStats.doctors.total}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(30,41,59,0.02)', padding: '10px 14px', borderRadius: 10 }}>
                             <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Currently Active</span>
                             <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--blue)' }}>{systemStats.doctors.active}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(30,41,59,0.02)', padding: '10px 14px', borderRadius: 10 }}>
                             <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Approved Profiles</span>
                             <span style={{ fontSize: 15, fontWeight: 800, color: '#10B981' }}>{systemStats.doctors.approved}</span>
                          </div>
                          <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px dashed var(--border-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px' }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-4)' }}>Pending Approval</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#F59E0B', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 6 }}>{systemStats.doctors.pending}</span>
                          </div>
                       </div>
                    </div>

                   </div>
                </>
              ) : (
                 <div style={{ padding: '60px 0', textAlign: 'center' }}>
                    <AlertCircle size={32} color="var(--crimson)" style={{ margin: '0 auto 12px', opacity: 0.8 }} />
                    <div style={{ color: 'var(--crimson)', fontSize: 14, fontWeight: 600 }}>Failed to load system statistics.</div>
                    <div style={{ color: 'var(--text-4)', fontSize: 12, marginTop: 4 }}>Please try refreshing the page or checking your backend connection.</div>
                 </div>
              )}
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
              </div>

              {/* PENDING NEW DOCTOR REQUESTS (Receptionist → System Admin approval) */}
              {!doctorRequestsLoading && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>
                    Pending New Doctor Requests ({pendingDoctorRequests.length})
                  </h4>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 14 }}>
                    Submitted by receptionists to register a new doctor. Once approved, a user account is created and credentials are sent to the doctor via SMS.
                  </div>
                  {pendingDoctorRequests.length === 0 ? (
                    <div style={{
                      padding: 24, textAlign: 'center', background: 'rgba(245, 158, 11, 0.04)',
                      border: '1px dashed rgba(245, 158, 11, 0.28)', borderRadius: 14, color: 'var(--text-4)', fontSize: 13
                    }}>
                      No pending new doctor requests at this time.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginBottom: 8 }}>
                      {pendingDoctorRequests.map(req => (
                        <div key={req.id} style={{
                          background: 'rgba(245, 158, 11, 0.04)', border: '1px solid rgba(245, 158, 11, 0.28)',
                          borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Stethoscope size={18} color="var(--blue)" />
                              </div>
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{req.doctorName}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>{req.specialization}</div>
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
                            <div>SLMC Reg. No.: <strong style={{ color: 'var(--text-1)' }}>{req.slmcRegNo || '—'}</strong></div>
                            <div>Phone: <strong style={{ color: 'var(--text-1)' }}>{req.phone || '—'}</strong></div>
                            <div>Email: <strong style={{ color: 'var(--text-1)' }}>{req.email || 'Auto-generate'}</strong></div>
                            <div>Medical Center: <strong style={{ color: 'var(--text-2)' }}>{req.centerName}</strong></div>
                            <div>Requested By: <strong style={{ color: 'var(--text-2)' }}>{req.receptionistName}</strong></div>
                            <div>Date: <strong style={{ color: 'var(--text-2)' }}>{new Date(req.createdAt).toLocaleDateString()}</strong></div>
                          </div>

                          <div style={{ display: 'flex', gap: 10 }}>
                            <button
                              onClick={() => handleApproveDoctorRequest(req.id)}
                              className="btn btn-emerald btn-sm"
                              style={{ flex: 1, justifyContent: 'center', gap: 6, height: 38 }}
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                            <button
                              onClick={() => { setRejectingDoctorRequest(req); setDoctorRejectionReasonInput('') }}
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

              {/* THREE COLOR-CODED SUB-TABS (Patients: Blue, Doctors: Green, Medical Centers: Yellow) */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => { setStaffSubTab('patients'); setStaffStatusFilter('all'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '10px 20px', borderRadius: 12,
                    fontSize: 13.5, fontWeight: staffSubTab === 'patients' ? 800 : 600,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                    background: staffSubTab === 'patients' ? '#2563EB' : 'rgba(37, 99, 235, 0.06)',
                    color: staffSubTab === 'patients' ? '#ffffff' : '#2563EB',
                    border: `1.5px solid ${staffSubTab === 'patients' ? '#2563EB' : 'rgba(37, 99, 235, 0.25)'}`,
                    boxShadow: staffSubTab === 'patients' ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none'
                  }}
                >
                  <Users size={16} /> Patients
                  <span style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: staffSubTab === 'patients' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(37, 99, 235, 0.12)',
                    color: staffSubTab === 'patients' ? '#ffffff' : '#2563EB'
                  }}>
                    {patientsList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setStaffSubTab('doctors'); setStaffStatusFilter('all'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '10px 20px', borderRadius: 12,
                    fontSize: 13.5, fontWeight: staffSubTab === 'doctors' ? 800 : 600,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                    background: staffSubTab === 'doctors' ? '#10B981' : 'rgba(16, 185, 129, 0.06)',
                    color: staffSubTab === 'doctors' ? '#ffffff' : '#059669',
                    border: `1.5px solid ${staffSubTab === 'doctors' ? '#10B981' : 'rgba(16, 185, 129, 0.25)'}`,
                    boxShadow: staffSubTab === 'doctors' ? '0 4px 12px rgba(16, 185, 129, 0.25)' : 'none'
                  }}
                >
                  <Stethoscope size={16} /> Doctors
                  <span style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: staffSubTab === 'doctors' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(16, 185, 129, 0.12)',
                    color: staffSubTab === 'doctors' ? '#ffffff' : '#059669'
                  }}>
                    {doctorsList.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => { setStaffSubTab('centers'); setStaffStatusFilter('all'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '10px 20px', borderRadius: 12,
                    fontSize: 13.5, fontWeight: staffSubTab === 'centers' ? 800 : 600,
                    cursor: 'pointer', transition: 'all 0.15s ease',
                    background: staffSubTab === 'centers' ? '#F59E0B' : 'rgba(245, 158, 11, 0.08)',
                    color: staffSubTab === 'centers' ? '#ffffff' : '#D97706',
                    border: `1.5px solid ${staffSubTab === 'centers' ? '#F59E0B' : 'rgba(245, 158, 11, 0.3)'}`,
                    boxShadow: staffSubTab === 'centers' ? '0 4px 12px rgba(245, 158, 11, 0.25)' : 'none'
                  }}
                >
                  <Building2 size={16} /> Medical Centers
                  <span style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: staffSubTab === 'centers' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(245, 158, 11, 0.14)',
                    color: staffSubTab === 'centers' ? '#ffffff' : '#D97706'
                  }}>
                    {centers.length}
                  </span>
                </button>
              </div>

              {/* SEARCH BAR & STATUS DROPDOWN (matching the provided layout) */}
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
                    value={staffStatusFilter}
                    onChange={e => setStaffStatusFilter(e.target.value)}
                    style={{ height: 44, width: '100%', fontSize: 13.5, borderRadius: 12, border: '1px solid var(--border-md)', background: '#fff', padding: '0 38px 0 14px', appearance: 'none', cursor: 'pointer' }}
                  >
                    {staffSubTab === 'centers' ? (
                      <>
                        <option value="all">All Status</option>
                        <option value="operational">Operational</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="closed">Closed</option>
                      </>
                    ) : (
                      <>
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                      </>
                    )}
                  </select>
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-4)' }}>▾</div>
                </div>

                {/* PURPLE CLEAR ALL BUTTON */}
                <button
                  type="button"
                  onClick={handleClearAllFilters}
                  className="btn btn-sm"
                  style={{
                    background: '#8B5CF6',
                    color: '#ffffff',
                    border: '1px solid #7C3AED',
                    fontWeight: 700,
                    height: 44,
                    borderRadius: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '0 18px',
                    fontSize: 13.5,
                    boxShadow: '0 2px 8px rgba(139, 92, 246, 0.28)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Clear all search queries and active filters"
                >
                  <RotateCcw size={15} />
                  <span>Clear All</span>
                </button>
              </div>

              {/* TABLES FOR EACH SUB-TAB */}
              <div className="table-responsive-wrapper">
                {loadingUsers ? (
                  <div style={{ padding: 18, color: 'var(--text-4)', fontSize: 13 }}>Loading from database…</div>
                ) : staffSubTab === 'patients' ? (
                  /* PATIENTS TAB TABLE */
                  filteredPatients.length === 0 ? (
                    <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, background: 'rgba(37, 99, 235, 0.02)', borderRadius: 12, border: '1px dashed rgba(37, 99, 235, 0.25)' }}>
                      <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-2)', fontWeight: 600 }}>No patients found matching your search or filters.</p>
                      <button
                        type="button"
                        onClick={handleClearAllFilters}
                        className="btn btn-sm"
                        style={{
                          background: '#8B5CF6',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 700,
                          padding: '8px 18px',
                          borderRadius: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(139, 92, 246, 0.25)'
                        }}
                      >
                        <RotateCcw size={14} /> Clear All Filters
                      </button>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
                      <thead>
                        <tr style={{ background: 'rgba(37, 99, 235, 0.08)', textAlign: 'left', color: '#1D4ED8', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.04em' }}>
                          <th style={{ padding: '12px 14px' }}>Name</th>
                          <th style={{ padding: '12px 14px' }}>
                            <HeaderFilterDropdown
                              title="Medical Center"
                              activeValue={patientCenterFilter}
                              options={medicalCenterOptions}
                              isOpen={activeHeaderFilter === 'patient-center'}
                              onToggle={() => setActiveHeaderFilter(prev => prev === 'patient-center' ? null : 'patient-center')}
                              onSelect={val => setPatientCenterFilter(val)}
                              theme="blue"
                            />
                          </th>
                          <th style={{ padding: '12px 14px' }}>Phone Number</th>
                          <th style={{ padding: '12px 14px' }}>Email</th>
                          <th style={{ padding: '12px 14px' }}>Age</th>
                          <th style={{ padding: '12px 14px 12px 64px' }}>Status</th>
                          <th style={{ padding: '12px 14px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPatients.map(s => (
                          <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-1)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Avatar name={s.name} size={28} />
                                <span>{s.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 260 }}>
                                {s.medicalCenters && s.medicalCenters.length > 0 ? (
                                  s.medicalCenters.map((mc, idx) => (
                                    <span key={idx} style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 4,
                                      padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                      background: 'rgba(37, 99, 235, 0.08)', color: '#1D4ED8', border: '1px solid rgba(37, 99, 235, 0.22)'
                                    }}>
                                      <Building2 size={11} /> {mc}
                                    </span>
                                  ))
                                ) : (
                                  <span style={{ color: 'var(--text-4)', fontSize: 12 }}>—</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-2)', fontWeight: 500 }}>{s.phone || '—'}</td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-3)' }}>{s.email}</td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-1)', fontWeight: 700 }}>
                              {s.age !== null && s.age !== undefined ? `${s.age} yrs` : '—'}
                            </td>
                            <td style={{ padding: '12px 14px 12px 64px' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                                background: s.status === 'active' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.14)',
                                color: s.status === 'active' ? '#10B981' : '#B45309'
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.status === 'active' ? '#10B981' : '#F59E0B' }} />
                                {s.status === 'active' ? 'Active' : 'Suspended'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                                <button onClick={() => setEditingStaff({ ...s })} style={{ width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Edit user">
                                  <Pencil size={15} color="#111827" />
                                </button>
                                <button onClick={() => setSuspendingStaff({ ...s })} style={{ width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }} title={s.status === 'active' ? 'Suspend user' : 'Activate user'}>
                                  {s.status === 'active' ? <Pause size={15} color="#D97706" /> : <Play size={15} color="#16A34A" />}
                                </button>
                                <button onClick={() => setDeletingStaff({ ...s })} style={{ width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Delete user">
                                  <Trash2 size={15} color="#DC2626" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : staffSubTab === 'doctors' ? (
                  /* DOCTORS TAB TABLE */
                  filteredDoctors.length === 0 ? (
                    <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, background: 'rgba(16, 185, 129, 0.02)', borderRadius: 12, border: '1px dashed rgba(16, 185, 129, 0.25)' }}>
                      <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-2)', fontWeight: 600 }}>No doctors found matching your search or filters.</p>
                      <button
                        type="button"
                        onClick={handleClearAllFilters}
                        className="btn btn-sm"
                        style={{
                          background: '#8B5CF6',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 700,
                          padding: '8px 18px',
                          borderRadius: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(139, 92, 246, 0.25)'
                        }}
                      >
                        <RotateCcw size={14} /> Clear All Filters
                      </button>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
                      <thead>
                        <tr style={{ background: 'rgba(16, 185, 129, 0.08)', textAlign: 'left', color: '#047857', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.04em' }}>
                          <th style={{ padding: '12px 14px' }}>Name</th>
                          <th style={{ padding: '12px 14px' }}>
                            <HeaderFilterDropdown
                              title="Specialization"
                              activeValue={doctorSpecFilter}
                              options={specializationOptions}
                              isOpen={activeHeaderFilter === 'doctor-spec'}
                              onToggle={() => setActiveHeaderFilter(prev => prev === 'doctor-spec' ? null : 'doctor-spec')}
                              onSelect={val => setDoctorSpecFilter(val)}
                              theme="green"
                            />
                          </th>
                          <th style={{ padding: '12px 14px' }}>
                            <HeaderFilterDropdown
                              title="Medical Centers"
                              activeValue={doctorCenterFilter}
                              options={medicalCenterOptions}
                              isOpen={activeHeaderFilter === 'doctor-center'}
                              onToggle={() => setActiveHeaderFilter(prev => prev === 'doctor-center' ? null : 'doctor-center')}
                              onSelect={val => setDoctorCenterFilter(val)}
                              theme="green"
                            />
                          </th>
                          <th style={{ padding: '12px 14px' }}>Email</th>
                          <th style={{ padding: '12px 14px' }}>Phone Number</th>
                          <th style={{ padding: '12px 14px 12px 64px' }}>Status</th>
                          <th style={{ padding: '12px 14px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDoctors.map(s => {
                          const matchedDoc = doctors.find(d => d.email === s.email || d.id === s.id)
                          const allDocCenters = Array.from(new Set([
                            ...(s.medicalCenters || []),
                            ...(matchedDoc?.centers?.map(c => c.centerName).filter((c): c is string => Boolean(c)) || []),
                            ...(matchedDoc?.centerName ? [matchedDoc.centerName] : [])
                          ])).filter((c): c is string => Boolean(c))

                          return (
                            <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-1)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Avatar name={s.name} size={28} />
                                  <span>{s.name}</span>
                                </div>
                              </td>
                              <td style={{ padding: '12px 14px', color: '#047857', fontWeight: 700 }}>
                                {s.specialization || s.dept || 'General Medicine'}
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 280 }}>
                                  {allDocCenters.length > 0 ? (
                                    allDocCenters.map((mc, idx) => (
                                      <span key={idx} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                        background: 'rgba(16, 185, 129, 0.08)', color: '#047857', border: '1px solid rgba(16, 185, 129, 0.25)'
                                      }}>
                                        <Building2 size={11} /> {mc}
                                      </span>
                                    ))
                                  ) : (
                                    <span style={{ color: 'var(--text-4)', fontSize: 12 }}>—</span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '12px 14px', color: 'var(--text-3)' }}>{s.email}</td>
                              <td style={{ padding: '12px 14px', color: 'var(--text-2)', fontWeight: 500 }}>{s.phone || '—'}</td>
                              <td style={{ padding: '12px 14px 12px 64px' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                                  background: s.status === 'active' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.14)',
                                  color: s.status === 'active' ? '#10B981' : '#B45309'
                                }}>
                                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.status === 'active' ? '#10B981' : '#F59E0B' }} />
                                  {s.status === 'active' ? 'Active' : 'Suspended'}
                                </span>
                              </td>
                              <td style={{ padding: '12px 14px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                                  <button
                                    onClick={() => {
                                      const matched = doctors.find(d => d.email === s.email || d.id === s.id || (d as any).userId === s.id)
                                      const docToEdit: ApiDoctor = matched || {
                                        id: s.id,
                                        name: s.name,
                                        dept: s.specialization || s.dept || 'General Medicine',
                                        specialization: s.specialization || s.dept || 'General Medicine',
                                        room: '',
                                        series: '',
                                        status: s.status === 'active' ? 'active' : 'offline',
                                        email: s.email,
                                        phone: s.phone,
                                        avgConsultMinutes: 10,
                                        dateOfBirth: s.dateOfBirth,
                                      }
                                      setEditingDoctorProfile(docToEdit)
                                      setModalDoctorCenter(null)
                                      setDoctorModalOpen(true)
                                    }}
                                    style={{ width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }}
                                    title="Edit doctor profile"
                                  >
                                    <Pencil size={15} color="#111827" />
                                  </button>
                                  <button onClick={() => setSuspendingStaff({ ...s })} style={{ width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }} title={s.status === 'active' ? 'Suspend doctor' : 'Activate doctor'}>
                                    {s.status === 'active' ? <Pause size={15} color="#D97706" /> : <Play size={15} color="#16A34A" />}
                                  </button>
                                  <button onClick={() => setDeletingStaff({ ...s })} style={{ width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Delete doctor">
                                    <Trash2 size={15} color="#DC2626" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )
                ) : (
                  /* MEDICAL CENTERS TAB TABLE */
                  filteredCenters.length === 0 ? (
                    <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-4)', fontSize: 13, background: 'rgba(245, 158, 11, 0.02)', borderRadius: 12, border: '1px dashed rgba(245, 158, 11, 0.25)' }}>
                      <p style={{ margin: '0 0 12px 0', fontSize: 14, color: 'var(--text-2)', fontWeight: 600 }}>No medical centers found matching your search or filters.</p>
                      <button
                        type="button"
                        onClick={handleClearAllFilters}
                        className="btn btn-sm"
                        style={{
                          background: '#8B5CF6',
                          color: '#ffffff',
                          border: 'none',
                          fontWeight: 700,
                          padding: '8px 18px',
                          borderRadius: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(139, 92, 246, 0.25)'
                        }}
                      >
                        <RotateCcw size={14} /> Clear All Filters
                      </button>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 720 }}>
                      <thead>
                        <tr style={{ background: 'rgba(245, 158, 11, 0.10)', textAlign: 'left', color: '#B45309', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.04em' }}>
                          <th style={{ padding: '12px 14px' }}>Center Name</th>
                          <th style={{ padding: '12px 14px' }}>
                            <HeaderFilterDropdown
                              title="Province"
                              activeValue={centerProvinceFilter}
                              options={provinceOptions}
                              isOpen={activeHeaderFilter === 'center-province'}
                              onToggle={() => setActiveHeaderFilter(prev => prev === 'center-province' ? null : 'center-province')}
                              onSelect={val => setCenterProvinceFilter(val)}
                              theme="yellow"
                            />
                          </th>
                          <th style={{ padding: '12px 14px' }}>
                            <HeaderFilterDropdown
                              title="District"
                              activeValue={centerDistrictFilter}
                              options={districtOptions}
                              isOpen={activeHeaderFilter === 'center-district'}
                              onToggle={() => setActiveHeaderFilter(prev => prev === 'center-district' ? null : 'center-district')}
                              onSelect={val => setCenterDistrictFilter(val)}
                              theme="yellow"
                            />
                          </th>
                          <th style={{ padding: '12px 14px' }}>Email</th>
                          <th style={{ padding: '12px 14px' }}>Phone</th>
                          <th style={{ padding: '12px 14px 12px 64px' }}>Status</th>
                          <th style={{ padding: '12px 14px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredCenters.map(c => (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--text-1)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(245, 158, 11, 0.12)', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <Building2 size={15} />
                                </div>
                                <span>{c.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-2)' }}>{c.province || '—'}</td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-2)', fontWeight: 600 }}>{c.city || '—'}</td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-3)' }}>{c.email || '—'}</td>
                            <td style={{ padding: '12px 14px', color: 'var(--text-2)', fontWeight: 500 }}>{c.phone || '—'}</td>
                            <td style={{ padding: '12px 14px 12px 64px' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                padding: '4px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                                background: c.status === 'operational' ? 'rgba(16, 185, 129, 0.12)' : c.status === 'maintenance' ? 'rgba(245, 158, 11, 0.14)' : 'rgba(239, 68, 68, 0.12)',
                                color: c.status === 'operational' ? '#10B981' : c.status === 'maintenance' ? '#B45309' : '#EF4444'
                              }}>
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.status === 'operational' ? '#10B981' : c.status === 'maintenance' ? '#F59E0B' : '#EF4444' }} />
                                {c.status ? c.status.charAt(0).toUpperCase() + c.status.slice(1) : 'Operational'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                                <button onClick={() => setEditingCenter(c)} style={{ width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Edit center">
                                  <Pencil size={15} color="#111827" />
                                </button>
                                <button onClick={() => setDeletingCenter(c)} style={{ width: 32, height: 32, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer' }} title="Delete center">
                                  <Trash2 size={15} color="#DC2626" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
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
                <button
                  onClick={() => setShowAddCenterModal(true)}
                  className="btn btn-sm"
                  style={{
                    background: '#8B5CF6',
                    color: '#ffffff',
                    border: '1px solid #7C3AED',
                    fontWeight: 700,
                    height: 42,
                    borderRadius: 12,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0 18px',
                    boxShadow: '0 2px 10px rgba(139, 92, 246, 0.3)',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={15} /> Add New Medical Center
                </button>
              </div>

              {/* PENDING MEDICAL CENTER REQUESTS (Receptionist -> Super Admin) */}
              {!centerRequestsLoading && (
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}>
                    Pending Medical Center Requests ({pendingCenterRequests.length})
                  </h4>
                  <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 14 }}>
                    Requested by receptionists. The center stays hidden from booking and reception use until approved here.
                  </div>
                  {pendingCenterRequests.length === 0 ? (
                    <div style={{
                      padding: 24, textAlign: 'center', background: 'rgba(245, 158, 11, 0.04)',
                      border: '1px dashed rgba(245, 158, 11, 0.28)', borderRadius: 14, color: 'var(--text-4)', fontSize: 13
                    }}>
                      No pending medical center requests at this time.
                    </div>
                  ) : (
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
                          <div>Registration / License No.: <strong style={{ color: 'var(--text-1)' }}>{req.registrationNumber || '—'}</strong></div>
                          <div>License Status: <strong style={{ color: 'var(--text-1)' }}>{req.licenseStatus || '—'}</strong></div>
                          <div>Location: <strong style={{ color: 'var(--text-1)' }}>{req.city}{req.province ? ` · ${req.province}` : ''}</strong></div>
                          <div>Official Phone: <strong style={{ color: 'var(--text-1)' }}>{req.phone || '—'}</strong></div>
                          <div>Official Email: <strong style={{ color: 'var(--text-1)' }}>{req.email || '—'}</strong></div>
                          {req.website && <div>Website: <strong style={{ color: 'var(--text-1)' }}>{req.website}</strong></div>}
                          <div>Requested By: <strong style={{ color: 'var(--text-2)' }}>{req.requestedByName || 'Receptionist'}</strong></div>
                          {req.services && req.services.length > 0 && (
                            <div>Services: <span style={{ color: 'var(--text-3)' }}>{req.services.join(', ')}</span></div>
                          )}
                          {req.requestComment && (
                            <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--bg-2)', borderRadius: 8, border: '1px solid var(--border-md)' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', marginBottom: 4 }}>REQUEST COMMENT:</div>
                              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{req.requestComment}</div>
                            </div>
                          )}
                          {req.documents && req.documents.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)' }}>ATTACHED DOCUMENTS:</div>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                {req.documents.map((doc: any) => (
                                  <button
                                    key={doc.id}
                                    className="btn btn-sm"
                                    onClick={() => setViewingDocument({
                                      id: doc.id,
                                      title: doc.title,
                                      date: new Date(doc.createdAt).toLocaleDateString(),
                                      issuingAuthority: req.name,
                                      recordType: 'general',
                                      fileUrl: doc.fileUrl,
                                    })}
                                    style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--blue)' }}
                                  >
                                    <FileText size={12} /> {doc.title}
                                  </button>
                                ))}
                              </div>
                            </div>
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
                  )}
                </div>
              )}

              {/* Center Request Rejection Modal */}
              {rejectingCenterRequest && (
                createPortal(<div style={{
                  position: 'fixed', inset: 0, zIndex: 10000,
                  background: 'rgba(6, 35, 33, 0.65)', backdropFilter: 'blur(10px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
                }}>
                  <div className="card glass-form-card" style={{ width: '100%', maxWidth: 440, padding: 28, background: '#ffffff', borderRadius: 16 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)', marginBottom: 8 }}>Reject &amp; Delete Medical Center Request</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>
                      This permanently deletes <strong>{rejectingCenterRequest.name}</strong> and its uploaded documents. Provide an optional reason.
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
                </div>, document.body)
              )}

              {/* Doctor Request Rejection Modal */}
              {rejectingDoctorRequest && (
                createPortal(<div style={{
                  position: 'fixed', inset: 0, zIndex: 10000,
                  background: 'rgba(6, 35, 33, 0.65)', backdropFilter: 'blur(10px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
                }}>
                  <div className="card glass-form-card" style={{ width: '100%', maxWidth: 440, padding: 28, background: '#ffffff', borderRadius: 16 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)', marginBottom: 8 }}>Reject New Doctor Request</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 14 }}>
                      Rejecting the request for <strong>{rejectingDoctorRequest.doctorName}</strong>. Provide an optional reason to inform the receptionist.
                    </p>
                    <textarea
                      className="input"
                      placeholder="e.g. Incomplete SLMC details, duplicate submission..."
                      value={doctorRejectionReasonInput}
                      onChange={e => setDoctorRejectionReasonInput(e.target.value)}
                      style={{ height: 80, fontSize: 13, padding: 10, marginBottom: 16, width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button onClick={() => setRejectingDoctorRequest(null)} className="btn btn-ghost btn-sm">Cancel</button>
                      <button onClick={handleConfirmRejectDoctorRequest} className="btn btn-primary btn-sm" style={{ background: 'var(--crimson)', borderColor: 'var(--crimson)' }}>
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                </div>, document.body)
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
                  const assignedDoctors = doctors.filter(d =>
                    d.centerId === c.id || (d.centers ?? []).some(dc => dc.centerId === c.id))
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 8, background: 'var(--blue-dim)', padding: 12, borderRadius: 10, fontSize: 12, marginBottom: 14 }}>
                        <div><span style={{ color: 'var(--text-4)' }}>Hours:</span> <AdminHoursDisplay rawHours={c.opening_hours} /></div>
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
                        {c.documents && c.documents.filter((doc: any) => doc.type !== 'admin_message' && doc.type !== 'request_comment' && !doc.title?.trim().startsWith('{')).length > 0 && (
                          <div style={{ gridColumn: '1/-1', marginTop: 4 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)' }}>ATTACHED DOCUMENTS:</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                              {c.documents.filter((doc: any) => doc.type !== 'admin_message' && doc.type !== 'request_comment' && !doc.title?.trim().startsWith('{')).map((doc: any) => (
                                <button
                                  key={doc.id}
                                  className="btn btn-sm"
                                  onClick={() => setViewingDocument({
                                    id: doc.id,
                                    title: doc.title,
                                    date: new Date(doc.createdAt).toLocaleDateString(),
                                    issuingAuthority: c.name,
                                    recordType: 'general',
                                    fileUrl: doc.fileUrl,
                                  })}
                                  style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--blue)' }}
                                >
                                  <FileText size={12} /> {doc.title}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ flex: 1, minWidth: 120 }}
                            onClick={() => {
                              setModalDoctorCenter(c)
                              setEditingDoctorProfile(null)
                              setDoctorModalOpen(true)
                            }}
                          >
                            <Stethoscope size={14} /> Add Doctor
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
                        <AssignedDoctorsDropdown doctors={assignedDoctors} centerId={c.id} onRemoveDoctor={handleRemoveDoctor} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* MESSAGE CENTER TAB */}
          {nav === 'api' && (
            <>
              <div className="card glass-form-card" style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Message Center</h3>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Send alerts and maintenance notifications to users</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                    Select Medical Center <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    className="input"
                    value={adminSelectedCenterId}
                    onChange={e => setAdminSelectedCenterId(e.target.value)}
                    style={{ height: 44, fontSize: 14 }}
                  >
                    <option value="all">📢 All Medical Centers (Broadcast Announcement)</option>
                    {centers.map(c => (
                      <option key={c.id} value={c.id}>🏥 {c.name} {c.city ? `(${c.city})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                    Notice Heading / Subject
                  </label>
                  <input
                    className="input"
                    placeholder="e.g. Scheduled platform maintenance / Inspection notice"
                    value={adminMessageSubject}
                    onChange={e => setAdminMessageSubject(e.target.value)}
                    style={{ height: 42, fontSize: 14 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                    Message Content <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    className="input"
                    placeholder="Type the message to deliver directly to the medical center's receptionist desk and doctors…"
                    value={adminMessageBody}
                    onChange={e => setAdminMessageBody(e.target.value)}
                    style={{ minHeight: 110, fontSize: 14, resize: 'vertical', padding: '12px 14px' }}
                  />
                </div>

                {adminMessageSuccess && (
                  <div style={{
                    background: '#ecfdf5', border: '1px solid #6ee7b7',
                    borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#047857',
                    display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600,
                  }}>
                    <CheckCircle2 size={16} /> {adminMessageSuccess}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleSendAdminNotice}
                    disabled={adminMessageSending || !adminMessageBody.trim()}
                    style={{ gap: 8, height: 42, padding: '0 22px', fontSize: 14 }}
                  >
                    <Send size={16} /> {adminMessageSending ? 'Sending Notice…' : 'Send Message to Center'}
                  </button>
                </div>
              </div>
            </div>

            {/* INCOMING MESSAGES & UPLOADS FROM MEDICAL CENTERS (General Inquiries) */}
            {(() => {
              const generalInquiries = centerInquiries.filter(i => (i.category || 'general') === 'general')

              const renderInquiryColumn = (inquiriesList: ApiCenterAdminMessage[], emptyLabel: string) => {
                if (loadingInquiries) {
                  return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>Loading inquiries…</div>
                }
                if (inquiriesList.length === 0) {
                  return (
                    <div style={{ padding: 24, textAlign: 'center', background: 'rgba(139, 92, 246, 0.03)', borderRadius: 12, border: '1px dashed rgba(139, 92, 246, 0.2)', color: 'var(--text-4)', fontSize: 12.5 }}>
                      {emptyLabel}
                    </div>
                  )
                }

                const sortedInquiries = [...inquiriesList].sort(
                  (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                )

                const grouped = sortedInquiries.reduce<Record<string, ApiCenterAdminMessage[]>>((acc, inq) => {
                  const d = inq.createdAt
                    ? new Date(inq.createdAt).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })
                    : 'Recent'
                  if (!acc[d]) acc[d] = []
                  acc[d].push(inq)
                  return acc
                }, {})

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {Object.entries(grouped).map(([dateLabel, inqs]) => (
                      <div key={dateLabel}>
                        {/* Audit log style date header with divider line */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <div style={{
                            fontSize: 11, fontWeight: 800, color: '#6D28D9', textTransform: 'uppercase',
                            letterSpacing: '0.04em', background: 'rgba(109, 40, 217, 0.08)', padding: '3px 8px',
                            borderRadius: 6, border: '1px solid rgba(109, 40, 217, 0.15)'
                          }}>
                            📅 {dateLabel}
                          </div>
                          <div style={{ flex: 1, height: 1, background: 'var(--border-md)' }} />
                          <span style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 600 }}>
                            {inqs.length} {inqs.length === 1 ? 'Message' : 'Messages'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {inqs.map(inq => (
                            <div key={inq.id} style={{
                              padding: 14, borderRadius: 12, background: '#fff',
                              border: inq.isRead ? '1px solid var(--border-md)' : '1.5px solid rgba(139, 92, 246, 0.4)',
                              display: 'flex', flexDirection: 'column', gap: 8,
                              boxShadow: inq.isRead ? '0 1px 4px rgba(0,0,0,0.02)' : '0 3px 10px rgba(139, 92, 246, 0.08)',
                              transition: 'all 0.2s ease'
                            }}>
                              {/* Card Header */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 800, color: '#6D28D9', fontSize: 13.5 }}>{inq.centerName}</span>
                                  {inq.senderRole === 'admin' ? (
                                    <span style={{ fontSize: 10.5, background: 'rgba(37, 99, 235, 0.12)', color: '#2563EB', padding: '2px 7px', borderRadius: 5, fontWeight: 800, textTransform: 'uppercase' }}>
                                      🛡️ Sent by Admin
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 10.5, background: 'rgba(13, 148, 136, 0.12)', color: '#0D9488', padding: '2px 7px', borderRadius: 5, fontWeight: 800, textTransform: 'uppercase' }}>
                                      📥 Incoming Inquiry
                                    </span>
                                  )}
                                  {inq.centerCity && (
                                    <span style={{ fontSize: 10.5, background: 'rgba(139,92,246,0.1)', color: '#7C3AED', padding: '2px 7px', borderRadius: 5, fontWeight: 700 }}>
                                      {inq.centerCity}
                                    </span>
                                  )}
                                  {inq.category === 'payment' && (
                                    <span style={{ fontSize: 10.5, background: 'rgba(245, 158, 11, 0.12)', color: '#D97706', padding: '2px 7px', borderRadius: 5, fontWeight: 700 }}>
                                      💳 Payment
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
                                  {inq.createdAt ? new Date(inq.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                              </div>

                              {/* Title & Body */}
                              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-1)' }}>{inq.title}</div>
                              <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{inq.message}</div>

                              {/* Attachment Link */}
                              {inq.attachmentUrl && (
                                <div style={{ marginTop: 2 }}>
                                  <a
                                    href={inq.attachmentUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700,
                                      color: '#2563EB', background: 'rgba(37, 99, 235, 0.08)', padding: '5px 10px', borderRadius: 6,
                                      textDecoration: 'none'
                                    }}
                                  >
                                    <FileText size={12} /> View Attached: {inq.attachmentName || 'Attachment Document'}
                                  </a>
                                </div>
                              )}

                              {/* Action Buttons & Threaded Replies */}
                              {inq.senderRole === 'admin' ? (
                                <>
                                  {/* Threaded Clinic Replies to this Admin message */}
                                  {inq.replies && inq.replies.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, marginLeft: 16, paddingLeft: 10, borderLeft: '3px solid #10B981' }}>
                                      {inq.replies.map(reply => (
                                        <div key={reply.id} style={{
                                          padding: '8px 12px', borderRadius: 8, background: 'rgba(16, 185, 129, 0.05)',
                                          border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', flexDirection: 'column', gap: 4
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                              🏥 {reply.senderName || inq.centerName} (Receptionist Reply)
                                            </span>
                                            <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
                                              {reply.createdAt ? new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                          </div>
                                          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                                            {reply.message}
                                          </div>
                                          {/* Mark as Read / Unread controls for Receptionist's Reply */}
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                            {reply.isRead ? (
                                              <>
                                                <span style={{
                                                  display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px',
                                                  borderRadius: 5, background: 'rgba(16, 185, 129, 0.1)', color: '#059669',
                                                  fontSize: 11, fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)'
                                                }}>
                                                  <Check size={11} /> Read
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => handleMarkAsUnread(reply.id)}
                                                  style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
                                                    borderRadius: 5, background: '#1E3A8A', color: '#fff', fontSize: 11,
                                                    fontWeight: 700, border: 'none', cursor: 'pointer',
                                                    boxShadow: '0 2px 4px rgba(30, 58, 138, 0.2)'
                                                  }}
                                                >
                                                  <RotateCcw size={10} /> Mark as Unread
                                                </button>
                                              </>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => handleMarkAsRead(reply.id)}
                                                style={{
                                                  display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
                                                  borderRadius: 5, background: '#2563EB', color: '#fff', fontSize: 11,
                                                  fontWeight: 700, border: 'none', cursor: 'pointer',
                                                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                                                }}
                                              >
                                                <Check size={11} /> Mark as Read
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <>
                                  {/* Threaded Admin Replies (if any) */}
                                  {inq.replies && inq.replies.length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4, marginLeft: 16, paddingLeft: 10, borderLeft: '3px solid #60A5FA' }}>
                                      {inq.replies.map(reply => (
                                        <div key={reply.id} style={{
                                          padding: '8px 12px', borderRadius: 8, background: 'rgba(59, 130, 246, 0.05)',
                                          border: '1px solid rgba(59, 130, 246, 0.15)', display: 'flex', flexDirection: 'column', gap: 3
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                              🛡️ System Admin Reply
                                            </span>
                                            <span style={{ fontSize: 10.5, color: 'var(--text-4)' }}>
                                              {reply.createdAt ? new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                            </span>
                                          </div>
                                          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                                            {reply.message}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Action Buttons for incoming clinic inquiry: 1. Reply (Purple), 2. Mark as Read (Blue) / Read (Green), 3. Mark as Unread (Navy Blue) */}
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                                    {/* 1. Reply Button (Purple) */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReplyingToId(replyingToId === inq.id ? null : inq.id)
                                        setReplyText('')
                                      }}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                                        borderRadius: 6, background: '#7C3AED', color: '#fff', fontSize: 11.5,
                                        fontWeight: 700, border: 'none', cursor: 'pointer',
                                        boxShadow: '0 2px 4px rgba(124, 58, 237, 0.2)', transition: 'background 0.2s'
                                      }}
                                      onMouseEnter={e => e.currentTarget.style.background = '#6D28D9'}
                                      onMouseLeave={e => e.currentTarget.style.background = '#7C3AED'}
                                    >
                                      <CornerDownLeft size={12} /> Reply
                                    </button>

                                    {/* 2. Mark as Read (Blue) / Read (Green) */}
                                    {inq.isRead ? (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                                        borderRadius: 6, background: 'rgba(16, 185, 129, 0.1)', color: '#059669',
                                        fontSize: 11.5, fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)'
                                      }}>
                                        <Check size={13} /> Read
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleMarkAsRead(inq.id)}
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                                          borderRadius: 6, background: '#2563EB', color: '#fff', fontSize: 11.5,
                                          fontWeight: 700, border: 'none', cursor: 'pointer',
                                          boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)', transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#1D4ED8'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#2563EB'}
                                      >
                                        <Check size={12} /> Mark as Read
                                      </button>
                                    )}

                                    {/* 3. Mark as Unread (Navy Blue) */}
                                    {inq.isRead && (
                                      <button
                                        type="button"
                                        onClick={() => handleMarkAsUnread(inq.id)}
                                        style={{
                                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                                          borderRadius: 6, background: '#1E3A8A', color: '#fff', fontSize: 11.5,
                                          fontWeight: 700, border: 'none', cursor: 'pointer',
                                          boxShadow: '0 2px 4px rgba(30, 58, 138, 0.2)', transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.background = '#172554'}
                                        onMouseLeave={e => e.currentTarget.style.background = '#1E3A8A'}
                                      >
                                        <RotateCcw size={12} /> Mark as Unread
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}

                              {/* Inline Reply Box */}
                              {replyingToId === inq.id && (
                                <div style={{
                                  marginTop: 8, padding: 12, borderRadius: 10,
                                  background: '#F8FAFC', border: '1px solid #BFDBFE',
                                  display: 'flex', flexDirection: 'column', gap: 8,
                                  marginLeft: 14
                                }}>
                                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1E40AF' }}>
                                    Reply to {inq.centerName}:
                                  </div>
                                  <textarea
                                    className="input"
                                    value={replyText}
                                    onChange={e => setReplyText(e.target.value)}
                                    placeholder="Type your response to this medical center..."
                                    style={{ minHeight: 70, fontSize: 12.5, resize: 'vertical', padding: '8px 10px', background: '#fff' }}
                                  />
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                                    <button
                                      type="button"
                                      onClick={() => { setReplyingToId(null); setReplyText('') }}
                                      className="btn btn-ghost btn-xs"
                                      style={{ fontSize: 11.5 }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={!replyText.trim() || replySending}
                                      onClick={() => handleSendReply(inq)}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                                        borderRadius: 6, background: '#2563EB', color: '#fff', fontSize: 11.5,
                                        fontWeight: 700, border: 'none', cursor: replySending ? 'not-allowed' : 'pointer',
                                        opacity: !replyText.trim() || replySending ? 0.6 : 1
                                      }}
                                    >
                                      <Send size={12} /> {replySending ? 'Sending…' : 'Send Reply'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              }

                return (
                  <div className="card glass-form-card" style={{ padding: 22, marginTop: 22 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <MessageSquare size={17} color="#2563EB" />
                          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
                            Incoming Inquiries &amp; Requests from Medical Centers
                          </h3>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 2 }}>
                          Administrative support, facility approvals &amp; technical inquiries
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={fetchCenterInquiries}
                        className="btn btn-ghost btn-sm"
                        style={{ gap: 5, fontSize: 11.5 }}
                      >
                        <RefreshCw size={12} className={loadingInquiries ? 'spin' : ''} /> Refresh
                      </button>
                    </div>

                    {renderInquiryColumn(generalInquiries, 'No general messages or inquiries received yet.')}
                  </div>
                )
              })()}
            </>
          )}

          {/* ── BILLING & PAYMENTS TAB (Admin Center Subscriptions & Bank Slips Verification) ── */}
          {nav === 'billing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Header Info */}
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={20} color="var(--blue)" />
                  Medical Centers Billing &amp; Subscription Management
                </h3>
                <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 3 }}>
                  Monitor clinic subscription compliance, inspect bank deposit slips, and verify monthly remittance records.
                </div>
              </div>

              {/* Top Overview Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                <div className="card glass-form-card" style={{ padding: 18, borderLeft: '4px solid var(--blue)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase' }}>
                    Registered Clinics
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', marginTop: 6 }}>
                    {centers.filter(c => c.approvalStatus === 'approved').length} Active
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    Standard platform subscription
                  </div>
                </div>

                <div className="card glass-form-card" style={{ padding: 18, borderLeft: '4px solid #10B981' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase' }}>
                    Monthly Revenue (Est.)
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#059669', marginTop: 6 }}>
                    LKR {(centers.filter(c => c.approvalStatus === 'approved').length * 15000).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    Based on LKR 15,000 / clinic tier
                  </div>
                </div>

                <div className="card glass-form-card" style={{ padding: 18, borderLeft: '4px solid #F59E0B' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase' }}>
                    Pending Slips Review
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#D97706', marginTop: 6 }}>
                    {remittanceRecords.filter(r => r.status === 'pending').length} Slips
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    Awaiting admin verification
                  </div>
                </div>

                <div className="card glass-form-card" style={{ padding: 18, borderLeft: '4px solid #8B5CF6' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase' }}>
                    Payment Compliance
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#7C3AED', marginTop: 6 }}>
                    98%
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    On-time monthly remittance rate
                  </div>
                </div>
              </div>

              {/* Remittance Verification Table */}
              <div className="card glass-form-card" style={{ padding: 22 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
                      Submitted Monthly Remittance Slips
                    </h4>
                    <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
                      Review proof of payment submitted by clinic receptionists &amp; managers.
                    </div>
                  </div>

                  {/* Filter Pills */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {(['all', 'pending', 'verified', 'flagged'] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setBillingFilter(f)}
                        style={{
                          padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          border: billingFilter === f ? '1.5px solid var(--blue)' : '1px solid var(--border-md)',
                          background: billingFilter === f ? 'rgba(37, 99, 235, 0.1)' : '#fff',
                          color: billingFilter === f ? 'var(--blue)' : 'var(--text-3)',
                          cursor: 'pointer', textTransform: 'capitalize'
                        }}
                      >
                        {f === 'all' ? 'All Records' : f === 'pending' ? 'Pending Review' : f}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid var(--border-md)', color: 'var(--text-4)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <th style={{ padding: '12px 14px' }}>Medical Center</th>
                        <th style={{ padding: '12px 14px' }}>Subscription Plan</th>
                        <th style={{ padding: '12px 14px' }}>Billing Cycle</th>
                        <th style={{ padding: '12px 14px' }}>Deposit Ref #</th>
                        <th style={{ padding: '12px 14px' }}>Amount</th>
                        <th style={{ padding: '12px 14px' }}>Date Submitted</th>
                        <th style={{ padding: '12px 14px' }}>Verification Status</th>
                        <th style={{ padding: '12px 14px', textAlign: 'right' }}>Admin Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remittanceRecords
                        .filter(r => billingFilter === 'all' || r.status === billingFilter)
                        .map(row => (
                          <tr key={row.id} style={{ borderBottom: '1px solid var(--border-md)' }}>
                            <td style={{ padding: '14px', fontWeight: 700, color: 'var(--text-1)' }}>
                              <div>{row.centerName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 500 }}>{row.city}</div>
                            </td>
                            <td style={{ padding: '14px', color: 'var(--text-2)', fontSize: 12.5 }}>
                              {row.plan}
                            </td>
                            <td style={{ padding: '14px', color: 'var(--text-2)' }}>
                              {row.month}
                            </td>
                            <td style={{ padding: '14px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-1)' }}>
                              {row.refNo}
                            </td>
                            <td style={{ padding: '14px', fontWeight: 700, color: 'var(--brand-teal)' }}>
                              {row.amount}
                            </td>
                            <td style={{ padding: '14px', color: 'var(--text-3)', fontSize: 12 }}>
                              {row.submittedAt}
                            </td>
                            <td style={{ padding: '14px' }}>
                              {row.status === 'verified' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontSize: 11.5, fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                  <Check size={12} /> Verified
                                </span>
                              ) : row.status === 'pending' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(245, 158, 11, 0.12)', color: '#D97706', fontSize: 11.5, fontWeight: 700, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                                  <Clock size={12} /> Pending Review
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, background: 'rgba(239, 68, 68, 0.1)', color: '#DC2626', fontSize: 11.5, fontWeight: 700, border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                                  Flagged / Issue
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '14px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <button
                                  type="button"
                                  onClick={() => alert(`Opening deposit slip for ${row.centerName} (Ref: ${row.refNo})`)}
                                  className="btn btn-ghost btn-xs"
                                  style={{ fontSize: 11.5, color: '#2563EB' }}
                                >
                                  View Slip
                                </button>
                                {row.status !== 'verified' && (
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyRemittance(row.id)}
                                    className="btn btn-xs"
                                    style={{ background: '#10B981', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700, borderRadius: 5, padding: '3px 8px' }}
                                  >
                                    Approve
                                  </button>
                                )}
                                {row.status !== 'flagged' && (
                                  <button
                                    type="button"
                                    onClick={() => handleFlagRemittance(row.id)}
                                    className="btn btn-ghost btn-xs"
                                    style={{ color: '#D97706', fontSize: 11 }}
                                  >
                                    Flag
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
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

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '4px 0 14px', borderBottom: '1px solid rgba(148,163,184,0.26)' }}>
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
                        padding: '5px 12px',
                        minHeight: 30,
                        borderRadius: 20,
                        fontWeight: 700,
                        fontSize: 11.5,
                        letterSpacing: '0.02em',
                        transition: 'all 0.15s ease',
                        ...(isSelected
                          ? {
                              background: badgeStyle.color,
                              border: `1px solid ${badgeStyle.color}`,
                              color: '#fff',
                              boxShadow: `0 2px 8px ${badgeStyle.color}40`,
                            }
                          : {
                              ...badgeStyle,
                              opacity: 0.75,
                            }),
                      }}
                    >
                      {filterName === 'All Events'
                        ? 'All Events'
                        : filterName === 'profile_updated'
                        ? 'Profile Updates'
                        : filterName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {Object.entries(filteredAuditLogs.reduce((acc, log) => {
                      const dateKey = new Date(log.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      if (!acc[dateKey]) acc[dateKey] = []
                      acc[dateKey].push(log)
                      return acc
                    }, {} as Record<string, AuditLog[]>)).map(([dateKey, dayLogs]) => (
                      <div key={dateKey} style={{ display: 'flex', flexDirection: 'column' }}>
                        {/* Date group header */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0 6px',
                        }}>
                          <span style={{
                            fontSize: 11, fontWeight: 800, color: 'var(--text-4)', textTransform: 'uppercase',
                            letterSpacing: '0.07em', background: 'rgba(148,163,184,0.10)',
                            border: '1px solid rgba(148,163,184,0.20)', borderRadius: 6,
                            padding: '2px 8px',
                          }}>{dateKey}</span>
                          <div style={{ flex: 1, height: 1, background: 'rgba(148,163,184,0.18)' }} />
                          <span style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600 }}>{dayLogs.length} event{dayLogs.length !== 1 ? 's' : ''}</span>
                        </div>
                        {dayLogs.map((log) => {
                          const eventMeta = auditLogBadgeStyles[log.event_type] ?? auditLogBadgeStyles.system_warning
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
                          const actorRole = log.actor_role || 'system'
                          const eventTypeLabel = log.event_type || 'system'
                          // Build initials for the actor avatar
                          const initials = actorLabel.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

                          return (
                            <div key={log.id} style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(0, 1fr) minmax(160px, 220px) 90px',
                              alignItems: 'center',
                              gap: 12,
                              padding: '10px 12px',
                              borderRadius: 10,
                              marginBottom: 4,
                              background: 'rgba(255,255,255,0.55)',
                              border: '1px solid rgba(148,163,184,0.14)',
                              transition: 'background 0.15s',
                            }}>
                              {/* Event info column */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                <div style={{
                                  width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  background: eventMeta?.bg ?? 'rgba(148,163,184,0.08)',
                                  border: eventMeta?.border ?? '1px solid rgba(148,163,184,0.18)',
                                  color: eventMeta?.color ?? '#475569',
                                }}>
                                  {log.event_type === 'signup' && <CheckCircle2 size={14} />}
                                  {log.event_type === 'profile_updated' && <Pencil size={14} />}
                                  {(log.event_type === 'user_suspended' || log.event_type === 'center_suspend') && <Pause size={14} />}
                                  {(log.event_type === 'user_activated' || log.event_type === 'doctor_approved') && <CheckCircle2 size={14} />}
                                  {(log.event_type === 'user_deleted' || log.event_type === 'center_delete' || log.event_type === 'doctor_rejected') && <UserX size={14} />}
                                  {(log.event_type === 'center_edit' || log.event_type === 'system_warning') && <ShieldCheck size={14} />}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
                                    <span style={{
                                      padding: '2px 7px', borderRadius: 5, fontSize: 10.5, fontWeight: 800,
                                      background: eventMeta?.bg ?? 'rgba(148,163,184,0.08)',
                                      border: eventMeta?.border ?? '1px solid rgba(148,163,184,0.18)',
                                      color: eventMeta?.color ?? '#475569',
                                      textTransform: 'lowercase', letterSpacing: '0.02em',
                                    }}>{eventTypeLabel}</span>
                                    <span style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: 13 }}>{log.action}</span>
                                  </div>
                                  <div style={{ fontSize: 11.5, color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {log.center || 'Platform'} &middot; {timeStr}
                                  </div>
                                </div>
                              </div>

                              {/* Actor column */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 9, justifyContent: 'flex-end', minWidth: 0 }}>
                                <div style={{
                                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                                  background: 'linear-gradient(135deg, #12C6BA22 0%, #0ea5e922 100%)',
                                  border: '1.5px solid rgba(18,198,186,0.3)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 10.5, fontWeight: 800, color: 'var(--blue-dark)', letterSpacing: '0.01em',
                                }}>{initials}</div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actorLabel}</div>
                                  <span style={{
                                    display: 'inline-block', fontSize: 10, fontWeight: 700,
                                    padding: '1px 6px', borderRadius: 4,
                                    background: 'rgba(148,163,184,0.10)',
                                    border: '1px solid rgba(148,163,184,0.20)',
                                    color: 'var(--text-4)', textTransform: 'lowercase',
                                    marginTop: 2,
                                  }}>{actorRole}</span>
                                </div>
                              </div>

                              {/* Status column */}
                              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  minWidth: 76, padding: '5px 10px', borderRadius: 8,
                                  fontSize: 10.5, fontWeight: 800,
                                  background: `${statusColors[statusLabel] || '#6B7280'}14`,
                                  border: `1px solid ${statusColors[statusLabel] || '#6B7280'}33`,
                                  color: statusColors[statusLabel] || '#6B7280',
                                  textTransform: 'uppercase', letterSpacing: '0.04em',
                                }}>
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

      <ViewReportModal
        isOpen={!!viewingDocument}
        onClose={() => setViewingDocument(null)}
        record={viewingDocument}
      />

      <AddDoctorModal
        isOpen={doctorModalOpen}
        onClose={() => {
          setDoctorModalOpen(false)
          setEditingDoctorProfile(null)
          setModalDoctorCenter(null)
        }}
        centerId={modalDoctorCenter?.id ?? editingDoctorProfile?.centerId ?? null}
        centerName={modalDoctorCenter?.name ?? editingDoctorProfile?.centerName ?? null}
        editDoctor={editingDoctorProfile}
        isAdmin={true}
        onCreated={() => {
          refreshClinicsData()
          refreshRolesData()
        }}
      />

      <AddCenterModal
        isOpen={showAddCenterModal || Boolean(editingCenter)}
        onClose={() => {
          setShowAddCenterModal(false)
          setEditingCenter(null)
        }}
        mode={editingCenter ? 'edit' : 'create'}
        isAdmin={true}
        editCenter={editingCenter}
        onAdd={() => {
          refreshClinicsData()
        }}
        onUpdated={() => {
          refreshClinicsData()
        }}
      />
    </div>
  )
}