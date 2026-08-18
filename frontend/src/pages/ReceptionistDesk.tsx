import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity, AlertCircle, Bell, BellRing, CheckCircle2, Clock, Hash, Plus, Radio,
  Search, Stethoscope, Ticket, UserX, Users, Wifi, CalendarClock, Pencil, Menu, X
} from 'lucide-react'
import AccountMenu from '../components/AccountMenu'
import PublicTvDisplay from '../components/PublicTvDisplay'
import AddDoctorModal from '../components/AddDoctorModal'
import DoctorHoursModal from '../components/DoctorHoursModal'
import { Avatar, Badge, StatusBadge } from '../components/UIPrimitives'
import { useReceptionQueue } from '../hooks/useReceptionQueue'
import {
  STATUS_BADGE, STATUS_LABEL, currentFor, entryToken, fmtTime, formatToken,
  averageWaitMinutes, waitingFor
} from '../lib/receptionQueue'
import type { TokenSource } from '../lib/receptionQueue'
import type { ApiDoctor } from '../lib/api'


/** Compact metric — one line, no card chrome, so the strip stays out of the receptionist's way. */
function StatPill({ icon, label, value, accent = 'var(--text-2)' }: {
  icon: ReactNode; label: string; value: string; accent?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: 'rgba(255,255,255,0.7)', border: '1px solid var(--border-md)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1.15 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</div>
      </div>
    </div>
  )
}

export default function ReceptionistDesk() {
  const queue = useReceptionQueue()

  const [activeTab, setActiveTab] = useState<'checkin' | 'patients' | 'doctors' | 'my-doctors'>('checkin')

  const [showTvDisplay, setShowTvDisplay] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')

  // My Doctors tab
  const [showAddDoctor, setShowAddDoctor] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState<ApiDoctor | null>(null)
  const [hoursDoctor, setHoursDoctor] = useState<ApiDoctor | null>(null)

  // Counter form — patients book their own online tokens from the Patient app;
  // this desk only records walk-ins against a pre-printed physical slip.
  const tokenSource: TokenSource = 'physical'
  const [formName, setFormName] = useState('')
  const [formNic, setFormNic] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [physicalToken, setPhysicalToken] = useState('')
  const [issued, setIssued] = useState<string | null>(null)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const physicalInputRef = useRef<HTMLInputElement>(null)

  // Keeps the counter fast for back-to-back walk-ins: whichever field is
  // needed first is already focused after a source switch or a successful issue.
  useEffect(() => {
    if (activeTab !== 'checkin') return
    const target = tokenSource === 'physical' ? physicalInputRef.current : nameInputRef.current
    target?.focus()
  }, [tokenSource, activeTab])

  const { selectedDoctor, current, waiting, upNext, issuedNumbers } = queue

  // Quick-pick candidates for a printed slip number — the lowest numbers not
  // already recorded today, so the receptionist taps a number instead of typing it.
  const nextAvailableTokens = useMemo(() => {
    const taken = new Set(issuedNumbers)
    const candidates: number[] = []
    for (let n = 1; candidates.length < 8 && n < 1000; n++) {
      if (!taken.has(n)) candidates.push(n)
    }
    return candidates
  }, [issuedNumbers])

  // Clinic-wide numbers for the header strip.
  const issuedToday = queue.entries.length
  const waitingInLobby = useMemo(
    () => queue.entries.filter(e => e.status === 'waiting').length,
    [queue.entries],
  )
  const avgWait = useMemo(() => averageWaitMinutes(queue.entries, queue.doctors), [queue.entries, queue.doctors])
  const activeDoctors = useMemo(() => queue.doctors.filter(d => d.status === 'active').length, [queue.doctors])

  const resetForm = () => {
    setFormName(''); setFormNic(''); setFormPhone(''); setPhysicalToken('')
  }

  const handleIssueToken = async () => {
    const result = await queue.issue({
      patientName: formName,
      nic: formNic,
      phone: formPhone,
      source: tokenSource,
      tokenNumber: tokenSource === 'physical' ? Number(physicalToken) : undefined,
    })
    if (result.ok && result.entry) {
      setIssued(entryToken(result.entry))
      resetForm()
      nameInputRef.current?.focus()
      setTimeout(() => setIssued(null), 3000)
    }
  }

  // Search spans the whole clinic, not just the selected doctor's queue.
  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase()
    return queue.entries.filter(e =>
      !q ||
      e.patientName.toLowerCase().includes(q) ||
      (e.nic ?? '').includes(q) ||
      entryToken(e).toLowerCase().includes(q),
    )
  }, [queue.entries, patientSearch])

  const canIssue =
    !queue.issuing &&
    formName.trim().length > 0 &&
    physicalToken.trim().length > 0

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: 'var(--bg)', display: 'flex' }}>

      {/* Modals */}

      <PublicTvDisplay
        isOpen={showTvDisplay}
        onClose={() => setShowTvDisplay(false)}
        doctor={selectedDoctor}
        current={current}
        waiting={waiting}
        estimateWait={queue.waitFor}
        onCallNext={queue.callNext}
      />

      {/* ── MOBILE BACKDROP OVERLAY ── */}
      {showMobileSidebar && (
        <div
          className="mobile-only"
          onClick={() => setShowMobileSidebar(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000 }}
        />
      )}

      {/* ── SIDEBAR ── */}
      <div className={`reception-sidebar ${showMobileSidebar ? 'mobile-open' : ''}`} style={{
        width: 260, background: 'var(--surface)', borderRight: '1px solid var(--border-md)',
        display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100vh'
      }}>
        {/* Branding */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border-md)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
            borderRadius: 7, padding: '4px 10px', fontSize: 11.5, fontWeight: 700,
            color: 'var(--blue-dark)', flexShrink: 0,
          }}>A-01</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1.1 }}>Reception Desk</div>
            <div style={{ fontSize: 11, color: 'var(--text-4)' }}>Central Clinic</div>
          </div>
        </div>

        {/* Nav Tabs */}
        <div style={{ padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingLeft: 8 }}>Navigation</div>
          <button onClick={() => { setActiveTab('checkin'); setShowMobileSidebar(false) }} className={`btn ${activeTab === 'checkin' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start', padding: '12px 14px' }}>
            <Ticket size={16} /> Issue Tokens & Queue
          </button>
          <button onClick={() => { setActiveTab('doctors'); setShowMobileSidebar(false) }} className={`btn ${activeTab === 'doctors' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start', padding: '12px 14px' }}>
            <Stethoscope size={16} /> Doctor Roster
          </button>
          <button onClick={() => { setActiveTab('patients'); setShowMobileSidebar(false) }} className={`btn ${activeTab === 'patients' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start', padding: '12px 14px' }}>
            <Users size={16} /> Patients
          </button>
          <button onClick={() => { setActiveTab('my-doctors'); setShowMobileSidebar(false) }} className={`btn ${activeTab === 'my-doctors' ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'flex-start', padding: '12px 14px' }}>
            <CalendarClock size={16} /> Manage Doctors
          </button>
        </div>

        {/* Actions */}
        <div style={{ padding: '20px 16px', borderTop: '1px solid var(--border-md)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => { setShowTvDisplay(true); setShowMobileSidebar(false) }} className="btn btn-ghost" style={{ justifyContent: 'flex-start', padding: '12px 14px' }}>
            <Radio size={16} /> TV Display Board
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* TOPBAR */}
        <div className="topbar" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--border-md)', background: 'rgba(255,255,255,0.7)', position: 'sticky', top: 0, zIndex: 30 }}>
          <button
            onClick={() => setShowMobileSidebar(o => !o)}
            className="btn btn-ghost btn-sm mobile-only"
            style={{ gap: 6, padding: '5px 9px', border: '1px solid var(--border-md)', background: '#ffffff' }}
          >
            {showMobileSidebar ? <X size={16} /> : <Menu size={16} />}
          </button>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginLeft: 'auto' }}>
            <button
              onClick={() => setShowTvDisplay(true)}
              className="btn btn-ghost btn-sm"
              style={{ gap: 6, fontSize: 11.5, color: 'var(--text-3)', padding: '5px 11px', border: '1px solid var(--border-md)', background: '#ffffff' }}
            >
              <Radio size={13} color="var(--blue)" /> Public TV Board
            </button>
            <div className="desktop-only" style={{ alignItems: 'center', gap: 6 }}>
              <span className="pulse-live" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)' }}>Live queue</span>
            </div>
            <div style={{ position: 'relative', cursor: 'pointer' }}><Bell size={16} color="var(--text-3)" /><span style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, background: 'var(--crimson)', borderRadius: '50%', border: '2px solid var(--bg)' }} /></div>
            <AccountMenu />
          </div>
        </div>

        {/* CONTENT SCROLL AREA */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* CLINIC-WIDE STAT RIBBON — one line, so it never competes with the live queue below */}
          <div style={{ padding: '18px 24px 0', display: 'flex', gap: 34, flexWrap: 'wrap' }}>
            <StatPill icon={<Ticket size={15} />} label="Issued Today" value={String(issuedToday)} />
            <StatPill icon={<Users size={15} />} label="Waiting Clinic-wide" value={String(waitingInLobby)} accent="var(--amber)" />
            <StatPill icon={<Clock size={15} />} label="Avg. Wait" value={`${avgWait} min`} accent="var(--blue)" />
            <StatPill icon={<Activity size={15} />} label="Doctors On Duty" value={`${activeDoctors}/${queue.doctors.length}`} accent="#10B981" />
          </div>

          {(queue.offline || queue.migrationPending) && (
            <div style={{ padding: '14px 24px 0' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600,
                color: 'var(--amber)', background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
                borderRadius: 9, padding: '9px 14px',
              }}>
                <AlertCircle size={14} />
                {queue.offline
                  ? "Backend not reachable — showing demo data. Start the backend (npm run dev in backend/) to use the live queue."
                  : "Connected to the backend, but the walk-in queue table doesn't exist yet — run backend/src/db/migrations/002_walk_in_queue.sql in the Supabase SQL Editor, then refresh."}
              </div>
            </div>
          )}

          {/* CHECK-IN & COUNTER QUEUE TAB */}
          {activeTab === 'checkin' && (
            <>
              {/* QUEUE HEADER — switch doctors here without leaving the tab */}
              <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('doctors')} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13, gap: 6 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>←</span> Back to Roster
                </button>
                <div style={{ width: 1, height: 20, background: 'var(--border-md)' }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-4)' }}>Queue for</div>
                <select
                  className="input"
                  value={queue.selectedDoctorId}
                  onChange={e => { queue.setSelectedDoctorId(e.target.value); queue.clearError() }}
                  style={{ width: 'auto', height: 38, fontSize: 14.5, fontWeight: 800, padding: '0 12px', color: 'var(--text-1)' }}
                >
                  {queue.doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name} — {d.dept}</option>
                  ))}
                </select>
              </div>

              {/* LIVE QUEUE HERO — the two things a receptionist needs at a glance, big enough to read from a step back */}
              <div style={{ padding: '14px 24px 0' }}>
                <div className="card glass-form-card reception-hero-grid">
                  <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, minWidth: 0 }}>
                    <span className="eyebrow">Now Serving · {selectedDoctor?.name}</span>
                    {current ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          <span style={{ fontSize: 56, fontWeight: 900, fontFamily: 'monospace', color: 'var(--emerald)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                            {entryToken(current)}
                          </span>
                          <span className="pulse-live" />
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{current.patientName}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <button
                            onClick={queue.completeCurrent}
                            disabled={queue.completing}
                            className="btn btn-ghost"
                            style={{ gap: 6, fontWeight: 700, color: 'var(--emerald)' }}
                          >
                            <CheckCircle2 size={15} /> Mark Complete
                          </button>
                          <button
                            onClick={() => queue.setStatus(current.id, 'left')}
                            className="btn btn-ghost"
                            style={{ gap: 6, fontWeight: 700, color: 'var(--crimson)' }}
                          >
                            <UserX size={15} /> No-Show
                          </button>
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 15, color: 'var(--text-4)', paddingTop: 8, paddingBottom: 8 }}>
                        Room is free — call the next token when ready.
                      </div>
                    )}
                  </div>

                  <div className="reception-hero-divider" />

                  <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, minWidth: 0 }}>
                    <span className="eyebrow">Up Next</span>
                    <div>
                      <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'monospace', color: upNext ? 'var(--blue)' : 'var(--text-4)', lineHeight: 1 }}>
                        {upNext ? entryToken(upNext) : '— queue empty —'}
                      </div>
                      {upNext && <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 5 }}>{upNext.patientName}</div>}
                    </div>
                    <button
                      onClick={queue.callNext}
                      disabled={queue.calling || !upNext}
                      className={`btn btn-emerald ${upNext ? 'btn-attention' : ''}`}
                      style={{
                        gap: 8, fontWeight: 800, fontSize: 16, height: 54, borderRadius: 11,
                        opacity: upNext ? 1 : 0.5, cursor: upNext ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <BellRing size={19} /> Call Next Patient
                    </button>
                  </div>
                </div>
              </div>

              <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 20, padding: '18px 24px 28px' }}>
                {/* Token issuance form card */}
                <div className="card glass-form-card" style={{ padding: 26 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Plus size={17} color="var(--blue)" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>Issue Token — {selectedDoctor?.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>
                        <>Series <strong style={{ color: 'var(--blue)' }}>{selectedDoctor?.series}</strong> · pre-printed slip</>
                      </div>
                    </div>
                  </div>

                  <form
                    onSubmit={e => { e.preventDefault(); if (canIssue) handleIssueToken() }}
                    style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                  >
                    {tokenSource === 'physical' && (
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Printed Token Number</label>

                        {/* Tap the next slip number instead of typing it — the nearest available one is highlighted. */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {nextAvailableTokens.map((n, i) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => { setPhysicalToken(String(n)); queue.clearError() }}
                              className={`btn btn-sm ${physicalToken === String(n) ? 'btn-primary' : i === 0 ? 'btn-amber' : 'btn-ghost'}`}
                              style={{ width: 44, height: 40, padding: 0, justifyContent: 'center', fontWeight: 800, fontFamily: 'monospace', fontSize: 13.5 }}
                              title={i === 0 ? 'Next available number' : undefined}
                            >
                              {n}
                            </button>
                          ))}
                        </div>

                        <input
                          ref={physicalInputRef}
                          className="input"
                          type="number"
                          min={1}
                          placeholder="Or type a different number"
                          value={physicalToken}
                          onChange={e => { setPhysicalToken(e.target.value); queue.clearError() }}
                          style={{ height: 42, fontSize: 14, borderColor: queue.error ? 'var(--crimson-border)' : undefined }}
                        />
                        {/* Numbers already handed out today — stops the same slip being recorded twice */}
                        {issuedNumbers.length > 0 && (
                          <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 700, width: '100%', marginBottom: 3 }}>
                              Issued & Used Token Numbers (Series {selectedDoctor?.series}):
                            </span>
                            {issuedNumbers.map(n => {
                              const entry = queue.doctorQueue.find(e => e.tokenNumber === n)
                              const isCancelled = entry?.status === 'cancelled' || entry?.status === 'left'
                              const live = entry?.status === 'waiting' || entry?.status === 'called' || entry?.status === 'in_progress'

                              return (
                                <span
                                  key={n}
                                  title={isCancelled ? 'Booking Cancelled / No-Show' : live ? 'Active in Queue' : 'Completed'}
                                  style={{
                                    fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
                                    fontFamily: 'monospace',
                                    background: isCancelled ? 'rgba(239, 68, 68, 0.15)' : live ? 'var(--blue-dim)' : 'rgba(30, 41, 59, 0.06)',
                                    border: `1px solid ${isCancelled ? 'rgba(239, 68, 68, 0.4)' : live ? 'var(--blue-border)' : 'var(--border-md)'}`,
                                    color: isCancelled ? '#ef4444' : live ? 'var(--blue)' : 'var(--text-4)',
                                    textDecoration: isCancelled ? 'line-through' : 'none'
                                  }}
                                >
                                  {formatToken(selectedDoctor?.series || 'A', n)}
                                  {isCancelled ? ' (Cancelled)' : live ? ' (Active)' : ' (Done)'}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient Full Name</label>
                      <input
                        ref={nameInputRef}
                        autoFocus
                        className="input"
                        placeholder="e.g. Sunil Perera"
                        value={formName}
                        onChange={e => { setFormName(e.target.value); queue.clearError() }}
                        style={{ height: 42, fontSize: 14 }}
                      />
                    </div>
                    <div className="form-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NIC / Passport</label>
                        <input
                          className="input"
                          placeholder="198845210082"
                          value={formNic}
                          onChange={e => setFormNic(e.target.value)}
                          style={{ height: 42, fontSize: 14 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mobile (SMS)</label>
                        <input
                          className="input"
                          placeholder="0771234567"
                          value={formPhone}
                          onChange={e => setFormPhone(e.target.value)}
                          style={{ height: 42, fontSize: 14 }}
                        />
                      </div>
                    </div>

                    {queue.error && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600,
                        color: 'var(--crimson)', background: 'var(--crimson-dim)',
                        border: '1px solid var(--crimson-border)', borderRadius: 9, padding: '9px 12px',
                      }}>
                        <AlertCircle size={14} /> {queue.error}
                      </div>
                    )}

                    {issued && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700,
                        color: 'var(--emerald)', background: 'var(--emerald-dim)',
                        border: '1px solid var(--emerald-border)', borderRadius: 9, padding: '9px 12px',
                      }}>
                        <CheckCircle2 size={14} /> Token {issued} issued · SMS dispatched
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!canIssue}
                      className={`btn ${tokenSource === 'physical' ? 'btn-amber' : 'btn-primary'}`}
                      style={{
                        width: '100%', marginTop: 2, height: 44, fontSize: 14.5, fontWeight: 700, borderRadius: 10,
                        opacity: canIssue ? 1 : 0.55, cursor: canIssue ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {tokenSource === 'physical'
                        ? <><Hash size={16} /> {queue.issuing ? 'Recording…' : 'Record Printed Token'}</>
                        : <><Ticket size={16} /> {queue.issuing ? 'Issuing…' : 'Issue Token & Send SMS'}</>}
                    </button>
                  </form>
                </div>

                {/* ACTIVE QUEUE — the selected doctor's live line, now the visual centre of the page */}
                <div className="card glass-form-card" style={{ padding: 26 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)' }}>Active Queue — {selectedDoctor?.name}</h3>
                      <div style={{ fontSize: 12, color: 'var(--text-4)' }}>
                        {waiting.length} waiting · {queue.doctorQueue.filter(e => e.status === 'completed').length} completed · {queue.doctorQueue.filter(e => e.status === 'left' || e.status === 'cancelled').length} cancelled / no-show
                      </div>
                    </div>
                  </div>

                  <div className="table-responsive-wrapper">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 780 }}>
                      <thead>
                        <tr style={{ background: 'rgba(30, 41, 59, 0.04)', textAlign: 'left', color: 'var(--text-4)', textTransform: 'uppercase', fontSize: 11 }}>
                          <th style={{ padding: '13px 16px' }}>Token</th>
                          <th style={{ padding: '13px 16px' }}>Patient</th>
                          <th style={{ padding: '13px 16px' }}>Phone</th>
                          <th style={{ padding: '13px 16px' }}>Source</th>
                          <th style={{ padding: '13px 16px' }}>Status</th>
                          <th style={{ padding: '13px 16px' }}>Checked In</th>
                          <th style={{ padding: '13px 16px' }}>Est. Wait</th>
                          <th style={{ padding: '13px 16px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queue.doctorQueue.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--text-4)' }}>
                              No tokens issued for this doctor yet.
                            </td>
                          </tr>
                        )}
                        {queue.doctorQueue.map(entry => {
                          const isCurrent = current?.id === entry.id
                          const isClosed = entry.status === 'completed' || entry.status === 'left' || entry.status === 'cancelled'
                          const stripeColor = isCurrent
                            ? 'var(--emerald)'
                            : entry.status === 'waiting' ? 'var(--amber)'
                              : (entry.status === 'left' || entry.status === 'cancelled') ? 'var(--crimson-border)'
                                : 'transparent'
                          return (
                            <tr
                              key={entry.id}
                              style={{
                                borderBottom: '1px solid var(--border)',
                                borderLeft: `3px solid ${stripeColor}`,
                                background: isCurrent ? 'var(--emerald-dim)' : undefined,
                                opacity: isClosed ? 0.75 : 1,
                              }}
                            >
                              <td style={{ padding: '13px 16px', fontWeight: 800, fontFamily: 'monospace', color: isCurrent ? 'var(--emerald)' : 'var(--blue)' }}>
                                {entryToken(entry)}
                              </td>
                              <td style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--text-1)' }}>{entry.patientName}</td>
                              <td style={{ padding: '13px 16px', color: 'var(--text-3)' }}>{entry.phone || '—'}</td>
                              <td style={{ padding: '13px 16px' }}>
                                {entry.source === 'online'
                                  ? <Badge cls="badge-blue"><Wifi size={10} /> Online</Badge>
                                  : <Badge cls="badge-amber"><Hash size={10} /> Physical</Badge>}
                              </td>
                              <td style={{ padding: '13px 16px' }}>
                                <Badge cls={STATUS_BADGE[entry.status] || 'badge-crimson'}>{STATUS_LABEL[entry.status] || 'Cancelled'}</Badge>
                              </td>
                              <td style={{ padding: '13px 16px', color: 'var(--text-3)' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                  <Clock size={12} /> {fmtTime(entry.issuedAt)}
                                </span>
                              </td>
                              <td style={{ padding: '13px 16px', color: 'var(--text-3)' }}>
                                {entry.status === 'waiting' ? `~${queue.waitFor(entry)} min` : '—'}
                              </td>
                              <td style={{ padding: '13px 16px' }}>
                                {isClosed ? (
                                  // The Status column already names the state — no need to repeat it here.
                                  <span style={{ fontSize: 12, color: 'var(--text-4)' }}>—</span>
                                ) : (
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                      onClick={() => queue.setStatus(entry.id, 'completed')}
                                      className="btn btn-ghost btn-sm"
                                      style={{ gap: 4, color: 'var(--emerald)' }}
                                    >
                                      <CheckCircle2 size={12} /> Done
                                    </button>
                                    <button
                                      onClick={() => queue.setStatus(entry.id, 'left')}
                                      className="btn btn-ghost btn-sm"
                                      style={{ gap: 4, color: 'var(--crimson)' }}
                                    >
                                      <UserX size={12} /> No-Show
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ALL PATIENTS MANAGEMENT TAB */}
          {activeTab === 'patients' && (
            <div style={{ padding: '18px 24px 28px' }}>
              <div className="card glass-form-card" style={{ padding: 26 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>All Registered Patients Directory</h3>
                    <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Search, check-in, update status, or view patient profiles</div>
                  </div>
                  <div style={{ position: 'relative', width: 320, maxWidth: '100%' }}>
                    <Search size={15} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      className="input"
                      placeholder="Search by Name, NIC, or Token..."
                      value={patientSearch}
                      onChange={e => setPatientSearch(e.target.value)}
                      style={{ paddingLeft: 36, height: 42, fontSize: 13 }}
                    />
                  </div>
                </div>

                <div className="table-responsive-wrapper">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 680 }}>
                    <thead>
                      <tr style={{ background: 'rgba(18, 198, 186, 0.08)', textAlign: 'left', color: 'var(--text-4)', textTransform: 'uppercase', fontSize: 11 }}>
                        <th style={{ padding: '13px 16px' }}>Patient ID</th>
                        <th style={{ padding: '13px 16px' }}>Name</th>
                        <th style={{ padding: '13px 16px' }}>NIC Number</th>
                        <th style={{ padding: '13px 16px' }}>Phone</th>
                        <th style={{ padding: '13px 16px' }}>Active Token</th>
                        <th style={{ padding: '13px 16px' }}>Assigned Doctor</th>
                        <th style={{ padding: '13px 16px' }}>Status</th>
                        <th style={{ padding: '13px 16px' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPatients.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ padding: '28px 14px', textAlign: 'center', color: 'var(--text-4)' }}>
                            No patients match "{patientSearch}".
                          </td>
                        </tr>
                      )}
                      {filteredPatients.map(p => {
                        const doc = queue.doctors.find(d => d.id === p.doctorId)
                        return (
                          <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '13px 16px', fontWeight: 700, fontFamily: 'monospace' }}>#{p.id.replace(/^q-/, 'P-')}</td>
                            <td style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--text-1)' }}>{p.patientName}</td>
                            <td style={{ padding: '13px 16px', color: 'var(--text-3)' }}>{p.nic ?? '—'}</td>
                            <td style={{ padding: '13px 16px', color: 'var(--text-3)' }}>{p.phone || '—'}</td>
                            <td style={{ padding: '13px 16px', fontWeight: 800, color: 'var(--blue)', fontFamily: 'monospace' }}>{entryToken(p)}</td>
                            <td style={{ padding: '13px 16px', color: 'var(--text-2)' }}>{doc?.name ?? '—'}</td>
                            <td style={{ padding: '13px 16px' }}><Badge cls={STATUS_BADGE[p.status]}>{STATUS_LABEL[p.status]}</Badge></td>
                            <td style={{ padding: '13px 16px' }}>
                              <button className="btn btn-ghost btn-sm">Edit Profile</button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* DOCTOR STATUS ROSTER TAB */}
          {activeTab === 'doctors' && (
            <div className="responsive-grid-4" style={{ padding: '18px 24px 28px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {queue.doctors.map(d => {
                const serving = currentFor(queue.entries, d.id)
                const docWaiting = waitingFor(queue.entries, d.id)
                return (
                  <div
                    key={d.id}
                    className="card glass-form-card hover-lift"
                    style={{ padding: 20, cursor: 'pointer' }}
                    onClick={() => { queue.setSelectedDoctorId(d.id); setActiveTab('checkin'); queue.clearError() }}
                  >
                    <Avatar name={d.name} size={44} />
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginTop: 12 }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--blue-dark)' }}>{d.dept} · {d.room}</div>
                    <div style={{ marginTop: 12 }}><StatusBadge status={d.status} /></div>
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>Now serving: <strong style={{ color: 'var(--text-2)', fontFamily: 'monospace' }}>{serving ? entryToken(serving) : '—'}</strong></span>
                      <span>Waiting: <strong style={{ color: 'var(--text-2)' }}>{docWaiting.length}</strong> · Avg {d.avgConsultMinutes} min/consult</span>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); queue.setSelectedDoctorId(d.id); setActiveTab('checkin'); queue.clearError() }}
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%', justifyContent: 'center', gap: 6, marginTop: 14 }}
                    >
                      <Ticket size={13} /> Manage Queue
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* MY DOCTORS MANAGEMENT TAB */}
          {activeTab === 'my-doctors' && (
            <div style={{ padding: '18px 24px 36px' }}>

              {/* Modals */}
              <AddDoctorModal
                isOpen={showAddDoctor || !!editingDoctor}
                onClose={() => { setShowAddDoctor(false); setEditingDoctor(null) }}
                centerId={queue.doctors[0]?.centerId ?? null}
                centerName={queue.doctors[0]?.centerName ?? 'Central Clinic'}
                editDoctor={editingDoctor}
                allDoctors={queue.doctors}
                onCreated={() => queue.refresh()}
              />
              <DoctorHoursModal
                isOpen={!!hoursDoctor}
                onClose={() => setHoursDoctor(null)}
                doctor={hoursDoctor}
                onSaved={() => queue.refresh()}
              />

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>My Doctors</h2>
                  <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 2 }}>
                    Add doctors · Set available hours · Total capacity = hours × max per hour
                  </div>
                </div>
                <button
                  onClick={() => setShowAddDoctor(true)}
                  className="btn btn-primary"
                  style={{ gap: 7, padding: '0 18px', height: 40 }}
                >
                  <Plus size={15} /> Add Doctor
                </button>
              </div>

              {/* Cards grid */}
              {queue.doctors.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '56px 24px',
                  background: 'rgba(255,255,255,0.5)', borderRadius: 16,
                  border: '1.5px dashed var(--border-md)',
                }}>
                  <Stethoscope size={38} style={{ margin: '0 auto 14px', color: 'var(--text-4)' }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-2)' }}>No doctors yet</div>
                  <div style={{ fontSize: 13, color: 'var(--text-4)', marginTop: 4 }}>Click "Add Doctor" to register the first one.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
                  {queue.doctors.map(d => {
                    const serving = currentFor(queue.entries, d.id)
                    const docWaiting = waitingFor(queue.entries, d.id)
                    return (
                      <div key={d.id} className="card glass-form-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', overflow: 'hidden' }}>
                        {/* Accent stripe */}
                        <div style={{
                          position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderRadius: '16px 16px 0 0',
                          background: d.status === 'active' ? '#10B981' : d.status === 'delayed' ? 'var(--amber, #f59e0b)' : d.status === 'break' ? 'var(--blue)' : '#94a3b8',
                        }} />

                        {/* Avatar + name */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <Avatar name={d.name} size={46} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', lineHeight: 1.2 }}>{d.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--blue-dark)', marginTop: 2 }}>{d.dept}</div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-4)', marginTop: 1 }}>
                              {d.room !== '—' ? d.room : 'No room assigned'}
                              {d.series && d.series !== '?' ? ` · Series ${d.series}` : ''}
                            </div>
                          </div>
                          <StatusBadge status={d.status} />
                        </div>

                        {/* Capacity stats */}
                        <div style={{
                          background: 'rgba(18,198,186,0.05)', border: '1px solid rgba(18,198,186,0.15)',
                          borderRadius: 10, padding: '10px 14px',
                          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                        }}>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max / Hour</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>{d.maxAppointmentsPerHour ?? 4}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Now Serving</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', fontFamily: 'monospace' }}>{serving ? entryToken(serving) : '—'}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Waiting</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--amber, #f59e0b)' }}>{docWaiting.length}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg. Consult</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>{d.avgConsultMinutes} min</div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => setEditingDoctor(d)}
                            className="btn btn-ghost btn-sm"
                            style={{ flex: 1, justifyContent: 'center', gap: 5 }}
                          >
                            <Pencil size={12} /> Edit Info
                          </button>
                          <button
                            onClick={() => setHoursDoctor(d)}
                            className="btn btn-ghost btn-sm"
                            style={{ flex: 1, justifyContent: 'center', gap: 5, color: 'var(--amber, #f59e0b)', borderColor: 'rgba(245,158,11,0.3)' }}
                          >
                            <CalendarClock size={12} /> Edit Hours
                          </button>
                        </div>
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
