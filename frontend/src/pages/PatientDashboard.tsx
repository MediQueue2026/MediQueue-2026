import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell, Building2, Calendar, ClipboardList, Download, Eye, FileText, FileUp, Heart, Home, LogOut,
  Map, MapPin, Menu, Phone, Plus, Search, Settings, ShieldCheck, Ticket, User, X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Avatar, StatusBadge } from '../components/UIPrimitives'
import { PrescriptionModal } from '../components/PrescriptionModal'
import { UploadReportModal } from '../components/UploadReportModal'
import { BookAppointmentModal } from '../components/BookAppointmentModal'
import { ViewReportModal } from '../components/ViewReportModal'
import { LiveClinicMap } from '../components/LiveClinicMap'
import {
  fetchPatientProfile,
  savePatientProfile,
  fetchHealthRecords,
  fetchPatientAppointments,
  fetchDoctorsList,
  fetchCentersList,
  fetchPatientSubscriptions,
  toggleDoctorSubscriptionAPI,
  formatSlotTime
} from '../services/patientService'
import { PatientProfile, HealthRecordItem, AppointmentItem } from '../types/patient'

const NAV_PATIENT = [
  { id: 'overview',      icon: <Home size={15} />,         label: 'Overview' },
  { id: 'doctors',       icon: <Search size={15} />,       label: 'Browse Doctors' },
  { id: 'subscriptions', icon: <Heart size={15} />,        label: 'Subscribed Doctors' },
  { id: 'token',         icon: <Ticket size={15} />,       label: 'Live Token' },
  { id: 'history',       icon: <ClipboardList size={15} />,label: 'Medical History & Reports' },
  { id: 'settings',      icon: <Settings size={15} />,     label: 'Settings' },
]

export default function PatientDashboard() {
  const [nav, setNav] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [docSearch, setDocSearch] = useState('')
  const [selectedSpec, setSelectedSpec] = useState('All')

  // Dynamic state loaded from Supabase / REST API
  const [doctors, setDoctors] = useState<any[]>([])
  const [centers, setCenters] = useState<any[]>([])
  const [selectedMapCenterId, setSelectedMapCenterId] = useState<string>('')
  const [subscribedIds, setSubscribedIds] = useState<string[]>([])
  const [signingOut, setSigningOut] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)

  // Modals state
  const [showRxModal, setShowRxModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showBookModal, setShowBookModal] = useState(false)
  const [showViewReportModal, setShowViewReportModal] = useState(false)
  const [selectedReport, setSelectedReport] = useState<HealthRecordItem | null>(null)
  const [selectedDoctorForBooking, setSelectedDoctorForBooking] = useState('')
  const [selectedCenterForBooking, setSelectedCenterForBooking] = useState('')

  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const activeUserId = user?.id || 'demo-patient'

  // Patient Profile state (dynamically bound to logged-in user)
  const [profile, setProfile] = useState<PatientProfile>({
    id: activeUserId,
    email: user?.email || '',
    fullName: user?.name || 'Patient User',
    phone: '',
    nic: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    bloodGroup: 'O+',
    allergies: '',
    chronicConditions: '',
    smsAlertsEnabled: true,
    delayAlertsEnabled: true,
  })

  // Dynamic Records & Appointments state
  const [records, setRecords] = useState<HealthRecordItem[]>([])
  const [recordFilter, setRecordFilter] = useState<'all' | 'prescription' | 'lab_report'>('all')
  const [myAppointments, setMyAppointments] = useState<AppointmentItem[]>([])

  const displayName = profile.fullName || user?.name || 'Patient'
  const firstName = displayName.split(' ')[0]

  // Find active appointment / token dynamically
  const activeAppointment = myAppointments.find(a => a.status === 'waiting' || a.status === 'booked' || a.status === 'in_consultation') || myAppointments[0]

  useEffect(() => {
    async function loadDynamicData() {
      if (!user) return
      const pData = await fetchPatientProfile(user.id, user.name, user.email)
      setProfile(pData)
      const rData = await fetchHealthRecords(user.id)
      setRecords(rData)
      const aData = await fetchPatientAppointments(user.id)
      setMyAppointments(aData)
      const dData = await fetchDoctorsList()
      setDoctors(dData)
      const cData = await fetchCentersList()
      setCenters(cData)
      if (cData.length > 0) setSelectedMapCenterId(cData[0].id)
      const sData = await fetchPatientSubscriptions(user.id)
      setSubscribedIds(sData)
    }
    loadDynamicData()
  }, [user?.id, user?.name, user?.email])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    navigate('/', { replace: true })
    await logout()
  }

  const toggleSubscribe = async (docName: string, docId?: string) => {
    const isSub = subscribedIds.includes(docName)
    if (isSub) {
      setSubscribedIds(subscribedIds.filter(id => id !== docName))
      showToast(`Unsubscribed from ${docName} alerts.`)
    } else {
      setSubscribedIds([...subscribedIds, docName])
      showToast(`Subscribed to live delay alerts for ${docName}!`)
    }
    if (docId) {
      await toggleDoctorSubscriptionAPI(activeUserId, docId)
    }
  }

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingSettings(true)
    const updated = await savePatientProfile(activeUserId, profile)
    setProfile(updated)
    setSavingSettings(false)
    showToast('✅ Patient Profile & Preferences saved to database!')
  }

  const openBookingForCenter = (centerId: string) => {
    setSelectedCenterForBooking(centerId)
    setShowBookModal(true)
  }

  const filteredDoctors = doctors.filter(d => {
    const docName = d.name || ''
    const docSpec = d.spec || d.specialization || ''
    const matchesSearch = docName.toLowerCase().includes(docSearch.toLowerCase()) || docSpec.toLowerCase().includes(docSearch.toLowerCase())
    const matchesSpec = selectedSpec === 'All' || docSpec.toLowerCase().includes(selectedSpec.toLowerCase())
    return matchesSearch && matchesSpec
  })

  const filteredRecords = records.filter(r => {
    if (recordFilter === 'all') return true
    return r.recordType === recordFilter
  })

  // Currently selected map center object & doctors assigned to it
  const activeMapCenter = centers.find(c => c.id === selectedMapCenterId) || centers[0] || {
    id: 'a1000000-0000-0000-0000-000000000001',
    name: 'MediQueue Central Clinic',
    city: 'Colombo 07',
    address: '124 Medical Plaza',
    opening_hours: '08:00 - 20:00',
    phone: '0112345678',
    services: ['Cardiology', 'General Medicine', 'Pediatrics']
  }

  const mapCenterDoctors = doctors.filter(d => 
    !d.centerId || d.centerId === activeMapCenter.id || d.center_id === activeMapCenter.id || doctors.length <= 2
  )

  return (
    <div className="mobile-layout-flex" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Modals */}
      <PrescriptionModal
        isOpen={showRxModal}
        onClose={() => setShowRxModal(false)}
        patientName={displayName}
        patientToken={activeAppointment?.queueToken || "#A-14"}
      />
      <UploadReportModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        patientId={activeUserId}
        onUploadSuccess={newRec => {
          setRecords([newRec, ...records])
          showToast(`✅ Health report "${newRec.title}" uploaded to database!`)
        }}
      />
      <BookAppointmentModal
        isOpen={showBookModal}
        onClose={() => setShowBookModal(false)}
        patientId={activeUserId}
        preselectedDoctor={selectedDoctorForBooking}
        preselectedCenter={selectedCenterForBooking}
        onBookingSuccess={newApt => {
          setMyAppointments([newApt, ...myAppointments])
          showToast(`🎉 Appointment booked! Queue Token assigned: ${newApt.queueToken}`)
        }}
      />
      <ViewReportModal
        isOpen={showViewReportModal}
        onClose={() => setShowViewReportModal(false)}
        record={selectedReport}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 999999,
          background: '#0d2623', color: '#ffffff', border: '1px solid #10B981',
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}>✕</button>
        </div>
      )}

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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-4)', paddingLeft: 4 }}>Patient Navigation</div>
            <button onClick={() => setSidebarOpen(false)} className="hamburger-btn" style={{ width: 28, height: 28, borderRadius: 6 }} title="Close menu">
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
              {profile.email}
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
              {activeAppointment ? (
                <>
                  <strong style={{ color: 'var(--blue)' }}>Token {activeAppointment.queueToken}</strong> for {activeAppointment.doctorName} — <strong style={{ color: 'var(--blue)' }}>{formatSlotTime(activeAppointment.slotHour)}</strong>
                </>
              ) : (
                'No active appointment for today. Click "Book Doctor" to schedule.'
              )}
            </span>
            <button onClick={() => { setNav('token'); setSidebarOpen(false) }} className="btn btn-sm" style={{ marginLeft: 'auto', flexShrink: 0, background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid var(--blue-border)', fontWeight: 600, fontSize: 11, padding: '4px 10px' }}>View Token</button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button onClick={() => setShowBookModal(true)} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
              <Plus size={14} /> Book Doctor
            </button>
            <Avatar name={displayName} size={30} />
          </div>
        </div>

        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* OVERVIEW TAB & LIVE TOKEN TAB */}
          {(nav === 'overview' || nav === 'token') && (
            <>
              {/* ── CLEAN HUMAN-DESIGNED WELCOME BANNER ── */}
              <div className="card glass-form-card" style={{
                padding: '24px 28px',
                background: '#ffffff',
                border: '1px solid var(--border-md)',
                borderRadius: 16,
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
                      Patient Portal Overview
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0, letterSpacing: '-0.02em' }}>
                      Welcome back, {firstName} 👨‍⚕️
                    </h2>
                    <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                      Account: <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{profile.email}</span>
                      {profile.bloodGroup && <span> · Blood Group: <strong style={{ color: 'var(--blue-dark)' }}>{profile.bloodGroup}</strong></span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setShowBookModal(true)}
                      className="btn btn-primary"
                      style={{ height: 42, padding: '0 20px', borderRadius: 10, gap: 8, fontWeight: 700, fontSize: 13.5 }}
                    >
                      <Calendar size={15} /> Book Appointment
                    </button>
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="btn btn-ghost"
                      style={{ height: 42, padding: '0 18px', borderRadius: 10, gap: 8, fontWeight: 600, fontSize: 13.5, background: 'var(--bg)', border: '1px solid var(--border-md)' }}
                    >
                      <FileUp size={15} color="var(--text-2)" /> Upload Medical Report
                    </button>
                  </div>
                </div>
              </div>

              {/* ── ACTIVE TOKEN HERO (HIGH VISIBILITY GLASSMORPHISM CARD) ── */}
              {activeAppointment ? (
                <div style={{
                  background: 'linear-gradient(135deg, #071e1c 0%, #0c2b28 50%, #051413 100%)',
                  border: '1px solid rgba(18, 198, 186, 0.45)',
                  borderRadius: 20, padding: '26px 28px', position: 'relative', overflow: 'hidden',
                  boxShadow: '0 16px 40px rgba(7, 30, 28, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                }}>
                  {/* Ambient Light Orbs */}
                  <div style={{ position: 'absolute', top: -50, right: -50, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(18, 198, 186, 0.22) 0%, transparent 70%)', pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', bottom: -50, left: 100, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />

                  {/* Header Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(18, 198, 186, 0.12)', border: '1px solid rgba(18, 198, 186, 0.3)', borderRadius: 20, padding: '4px 14px' }}>
                      <span className="pulse-blue" />
                      <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--blue)' }}>Live Queue Token Active</span>
                    </div>
                    {activeAppointment.isLateNumber && (
                      <span style={{ fontSize: 11, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#ef4444', borderRadius: 20, padding: '3px 10px', fontWeight: 700 }}>
                        ⚠️ Penalty Queue (Late Repeat No-Show)
                      </span>
                    )}
                  </div>

                  {/* Responsive Grid Layout */}
                  <div className="responsive-hero-active-token" style={{ display: 'grid', gridTemplateColumns: 'auto 1px 1.1fr 1px 1.4fr', gap: 0, alignItems: 'center' }}>
                    {/* Column 1: Token Display */}
                    <div style={{ textAlign: 'center', paddingRight: 28 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255, 255, 255, 0.6)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Your Queue Token</div>
                      <div style={{ fontSize: 62, fontWeight: 900, color: 'var(--blue)', lineHeight: 1, letterSpacing: '-0.04em', fontFamily: 'monospace', textShadow: '0 0 25px rgba(18, 198, 186, 0.5)' }}>
                        {activeAppointment.queueToken}
                      </div>
                      <div style={{ marginTop: 10 }}>
                        <StatusBadge status={activeAppointment.status === 'in_consultation' ? 'active' : 'waiting'} />
                      </div>
                    </div>

                    <div className="responsive-divider-line" style={{ width: 1, height: 90, background: 'rgba(255,255,255,0.12)', margin: '0 24px' }} />

                    {/* Column 2: Status & Time */}
                    <div style={{ paddingRight: 24 }}>
                      <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Current Queue Status</div>
                      <div style={{ fontSize: 26, fontWeight: 900, color: '#10B981', letterSpacing: '-0.02em', textTransform: 'uppercase', marginBottom: 4 }}>
                        {activeAppointment.status === 'in_consultation' ? 'In Consultation' : activeAppointment.status}
                      </div>
                      <div style={{ fontSize: 12.5, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Calendar size={13} color="var(--blue)" /> Date: <strong style={{ color: '#ffffff' }}>{activeAppointment.appointmentDate}</strong>
                      </div>
                      <div style={{ fontSize: 12.5, color: '#e2e8f0', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Bell size={13} color="var(--amber)" /> Scheduled: <strong style={{ color: 'var(--amber)' }}>{formatSlotTime(activeAppointment.slotHour)}</strong>
                      </div>
                    </div>

                    <div className="responsive-divider-line" style={{ width: 1, height: 90, background: 'rgba(255,255,255,0.12)', margin: '0 24px' }} />

                    {/* Column 3: Doctor & Clinic Details */}
                    <div>
                      <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Doctor & Location</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', marginBottom: 2 }}>{activeAppointment.doctorName}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--blue)', marginBottom: 12, fontWeight: 600 }}>{activeAppointment.specialization} · {activeAppointment.centerName}</div>
                      
                      {/* Interactive Token Action Buttons */}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button type="button" onClick={() => setShowRxModal(true)} className="btn btn-sm" style={{ background: 'rgba(18, 198, 186, 0.2)', border: '1px solid var(--blue)', color: '#ffffff', fontSize: 11, fontWeight: 700, gap: 5 }}>
                          <Eye size={12} color="var(--blue)" /> View Rx Note
                        </button>
                        <button type="button" onClick={() => { setNav('overview'); window.scrollTo({ top: 300, behavior: 'smooth' }) }} className="btn btn-sm" style={{ background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#ffffff', fontSize: 11, fontWeight: 700, gap: 5 }}>
                          <MapPin size={12} color="#10B981" /> Locate Room
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card glass-form-card" style={{ padding: 24, textAlign: 'center' }}>
                  <Ticket size={32} color="var(--text-4)" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>No Active Token for Today</div>
                  <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4, marginBottom: 14 }}>Browse doctors below or click 'Book Appointment' to schedule a consultation slot.</p>
                  <button onClick={() => setShowBookModal(true)} className="btn btn-primary btn-sm" style={{ margin: '0 auto' }}>
                    <Plus size={14} /> Book Doctor Appointment
                  </button>
                </div>
              )}

              {/* INTERACTIVE CLINIC NAVIGATOR MAP + UPCOMING APPOINTMENTS */}
              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18 }}>
                
                {/* REAL INTERACTIVE LEAFLET OPENSTREETMAP CARD */}
                <div className="card glass-form-card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Map size={16} color="var(--blue)" />
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>Interactive Live Clinic Navigator & Locator</span>
                    </div>
                    <StatusBadge status="active" />
                  </div>

                  <LiveClinicMap
                    centers={centers}
                    doctors={doctors}
                    selectedCenterId={selectedMapCenterId}
                    onSelectCenter={cId => setSelectedMapCenterId(cId)}
                    onBookCenter={cId => openBookingForCenter(cId)}
                  />
                </div>

                {/* UPCOMING APPOINTMENTS CARD */}
                <div className="card glass-form-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>Upcoming Appointments</div>
                    <button onClick={() => setShowBookModal(true)} className="btn btn-ghost btn-sm" style={{ gap: 4, fontSize: 11 }}>
                      <Plus size={13} /> Book New
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto', paddingRight: 2 }}>
                    {myAppointments.length > 0 ? (
                      myAppointments.map(u => (
                        <div key={u.id} style={{ padding: 12, background: '#ffffff', borderRadius: 10, border: '1px solid var(--border-md)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{u.doctorName}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--blue-dark)' }}>{u.specialization} · {u.centerName}</div>
                            </div>
                            <span className="badge badge-blue" style={{ fontSize: 11 }}>{u.queueToken}</span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={12} /> {u.appointmentDate} at {formatSlotTime(u.slotHour)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>
                        No upcoming appointments. Click "Book New" to schedule.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* BROWSE DOCTORS TAB */}
          {nav === 'doctors' && (
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Find & Browse Doctors</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Search by doctor name, specialty, or clinic room</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {['All', 'Cardiology', 'General', 'Pediatrics', 'Neurology', 'Orthopedics'].map(s => (
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

              <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {filteredDoctors.length > 0 ? (
                  filteredDoctors.map(doc => (
                    <div key={doc.id} style={{ background: '#ffffff', borderRadius: 14, padding: 18, border: '1px solid var(--border-md)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                        <Avatar name={doc.name} size={42} />
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{doc.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--blue-dark)', fontWeight: 600 }}>{doc.spec} · {doc.room}</div>
                          <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 2 }}>Est. wait {doc.wait}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
                        <button onClick={() => toggleSubscribe(doc.name, doc.id)} className="btn btn-sm btn-ghost" style={{ gap: 4 }}>
                          <Heart size={13} color={subscribedIds.includes(doc.name) ? 'var(--crimson)' : 'var(--text-4)'} fill={subscribedIds.includes(doc.name) ? 'var(--crimson)' : 'none'} />
                          {subscribedIds.includes(doc.name) ? 'Subscribed' : 'Subscribe'}
                        </button>
                        <button onClick={() => { setSelectedDoctorForBooking(doc.id); setShowBookModal(true) }} className="btn btn-sm btn-primary">
                          Book Slot
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ gridColumn: '1 / -1', padding: 24, textAlign: 'center', background: '#fff', borderRadius: 12, color: 'var(--text-4)', fontSize: 13 }}>
                    No doctors found matching "{docSearch || selectedSpec}". Try searching another name or selecting a different specialty filter.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SUBSCRIBED DOCTORS TAB */}
          {nav === 'subscriptions' && (
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginBottom: 6 }}>Subscribed Doctors & Delay Feed</h3>
              <p style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 20 }}>Receive real-time delay notifications, room changes & clinic updates (BR-05 / FR-07)</p>

              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {subscribedIds.length > 0 ? (
                    subscribedIds.map(docName => (
                      <div key={docName} style={{ padding: 14, background: '#ffffff', borderRadius: 12, border: '1px solid var(--border-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={docName} size={36} />
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{docName}</div>
                            <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>● Live Alerts Active</div>
                          </div>
                        </div>
                        <button onClick={() => toggleSubscribe(docName)} className="btn btn-ghost btn-sm">Unsubscribe</button>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: 16, background: '#fff', borderRadius: 10, textAlign: 'center', color: 'var(--text-4)', fontSize: 12 }}>
                      No subscribed doctors. Browse doctors to subscribe for delay alerts.
                    </div>
                  )}
                </div>

                <div style={{ background: '#ffffff', borderRadius: 12, padding: 18, border: '1px solid var(--border-md)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>Live Activity & Delay Updates</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { time: '10 min ago', doc: 'Dr. Aisha Patel', msg: 'Started morning consultations at Room 03. Queue running smoothly.' },
                      { time: '1 hour ago', doc: 'Dr. Ethan Carr', msg: 'Emergency consultation added. Delay of +15 minutes expected.' },
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

          {/* CONSOLIDATED MEDICAL HISTORY & REPORTS TAB */}
          {nav === 'history' && (
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>
                    Medical History & Diagnostic Reports
                  </h3>
                  <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Access doctor digital prescriptions (Rx), lab results, ECG scans & health records</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setRecordFilter('all')} className="btn btn-sm" style={{ background: recordFilter === 'all' ? 'var(--blue)' : '#fff', color: recordFilter === 'all' ? '#fff' : 'var(--text-2)', border: '1px solid var(--border-md)' }}>All Records</button>
                    <button onClick={() => setRecordFilter('prescription')} className="btn btn-sm" style={{ background: recordFilter === 'prescription' ? 'var(--blue)' : '#fff', color: recordFilter === 'prescription' ? '#fff' : 'var(--text-2)', border: '1px solid var(--border-md)' }}>Digital Prescriptions (Rx)</button>
                    <button onClick={() => setRecordFilter('lab_report')} className="btn btn-sm" style={{ background: recordFilter === 'lab_report' ? 'var(--blue)' : '#fff', color: recordFilter === 'lab_report' ? '#fff' : 'var(--text-2)', border: '1px solid var(--border-md)' }}>Lab Reports</button>
                  </div>
                  <button onClick={() => setShowUploadModal(true)} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
                    <FileUp size={14} /> Upload Report
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {filteredRecords.length > 0 ? (
                  filteredRecords.map(r => (
                    <div key={r.id} style={{ padding: 18, background: '#ffffff', borderRadius: 14, border: '1px solid var(--border-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: r.recordType === 'prescription' ? 'rgba(16,185,129,0.1)' : 'var(--blue-dim)', border: '1px solid var(--border-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: r.recordType === 'prescription' ? '#10B981' : 'var(--blue)' }}>
                          <FileText size={22} />
                        </div>
                        <div>
                          <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text-1)' }}>{r.title}</div>
                          <div style={{ fontSize: 12, color: 'var(--blue-dark)' }}>Issued by {r.issuingAuthority} · {r.date}</div>
                          {r.notes && <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 4, maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes}</div>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        {r.recordType === 'prescription' ? (
                          <button onClick={() => setShowRxModal(true)} className="btn btn-primary btn-sm" style={{ gap: 5 }}>
                            <Eye size={14} /> View Digital Prescription
                          </button>
                        ) : (
                          <button onClick={() => { setSelectedReport(r); setShowViewReportModal(true) }} className="btn btn-ghost btn-sm" style={{ gap: 5 }}>
                            <Eye size={14} /> View Diagnostic Report
                          </button>
                        )}
                        <button onClick={() => alert(`Downloading PDF document for ${r.title}...`)} className="btn btn-ghost btn-sm" style={{ gap: 5 }}>
                          <Download size={14} /> Download PDF
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', background: '#fff', borderRadius: 12, color: 'var(--text-4)', fontSize: 13 }}>
                    No health records or prescriptions found for your profile. Click "Upload Report" to attach your lab results.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {nav === 'settings' && (
            <div className="card glass-form-card" style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>Patient Profile & Preferences Settings</h3>
                <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0 }}>Manage your personal details, emergency contacts, medical background & notification alerts</p>
              </div>

              <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Section 1: Personal & Contact Information */}
                <div style={{ padding: 18, background: '#ffffff', borderRadius: 12, border: '1px solid var(--border-md)' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-1)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <User size={16} color="var(--blue)" /> Personal & Contact Details
                  </div>
                  <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Full Name</label>
                      <input
                        className="input"
                        value={profile.fullName}
                        onChange={e => setProfile({ ...profile, fullName: e.target.value })}
                        style={{ height: 42, fontSize: 13.5 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Email Address</label>
                      <input
                        className="input"
                        value={profile.email}
                        onChange={e => setProfile({ ...profile, email: e.target.value })}
                        style={{ height: 42, fontSize: 13.5 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Mobile Number (for SMS Token Alerts)</label>
                      <input
                        className="input"
                        value={profile.phone}
                        onChange={e => setProfile({ ...profile, phone: e.target.value })}
                        style={{ height: 42, fontSize: 13.5 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>NIC / National Identity Card</label>
                      <input
                        className="input"
                        value={profile.nic || ''}
                        onChange={e => setProfile({ ...profile, nic: e.target.value })}
                        placeholder="e.g. 199214500823"
                        style={{ height: 42, fontSize: 13.5 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Emergency Contact Information */}
                <div style={{ padding: 18, background: '#ffffff', borderRadius: 12, border: '1px solid var(--border-md)' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-1)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={16} color="var(--crimson)" /> Emergency Contact Person
                  </div>
                  <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Emergency Contact Name</label>
                      <input
                        className="input"
                        value={profile.emergencyContactName || ''}
                        onChange={e => setProfile({ ...profile, emergencyContactName: e.target.value })}
                        placeholder="e.g. Sunil Mehta (Father)"
                        style={{ height: 42, fontSize: 13.5 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Emergency Contact Phone</label>
                      <input
                        className="input"
                        value={profile.emergencyContactPhone || ''}
                        onChange={e => setProfile({ ...profile, emergencyContactPhone: e.target.value })}
                        placeholder="e.g. 0779988776"
                        style={{ height: 42, fontSize: 13.5 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Medical Background */}
                <div style={{ padding: 18, background: '#ffffff', borderRadius: 12, border: '1px solid var(--border-md)' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-1)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ClipboardList size={16} color="var(--amber)" /> Medical Background & Allergies
                  </div>
                  <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Blood Group</label>
                      <select
                        className="input"
                        value={profile.bloodGroup || 'O+'}
                        onChange={e => setProfile({ ...profile, bloodGroup: e.target.value })}
                        style={{ height: 42, fontSize: 13.5 }}
                      >
                        {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Known Drug Allergies</label>
                      <input
                        className="input"
                        value={profile.allergies || ''}
                        onChange={e => setProfile({ ...profile, allergies: e.target.value })}
                        placeholder="e.g. Penicillin, Aspirin"
                        style={{ height: 42, fontSize: 13.5 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Chronic Conditions</label>
                      <input
                        className="input"
                        value={profile.chronicConditions || ''}
                        onChange={e => setProfile({ ...profile, chronicConditions: e.target.value })}
                        placeholder="e.g. Asthma, Diabetes"
                        style={{ height: 42, fontSize: 13.5 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 4: Notification Alerts Preferences */}
                <div style={{ padding: 18, background: '#ffffff', borderRadius: 12, border: '1px solid var(--border-md)' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-1)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Bell size={16} color="var(--blue)" /> SMS & Notification Preferences
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={profile.smsAlertsEnabled}
                        onChange={e => setProfile({ ...profile, smsAlertsEnabled: e.target.checked })}
                        style={{ width: 18, height: 18, accentColor: 'var(--blue)' }}
                      />
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Receive real-time SMS alerts when your token is 3rd in line</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={profile.delayAlertsEnabled}
                        onChange={e => setProfile({ ...profile, delayAlertsEnabled: e.target.checked })}
                        style={{ width: 18, height: 18, accentColor: 'var(--blue)' }}
                      />
                      <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Receive SMS notifications when your doctor announces consultation delays</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="submit" disabled={savingSettings} className="btn btn-primary" style={{ height: 44, padding: '0 24px', fontSize: 14 }}>
                    {savingSettings ? 'Saving to Database...' : 'Save All Settings & Profile'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
