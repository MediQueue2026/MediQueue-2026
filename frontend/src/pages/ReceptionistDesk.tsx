import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity, AlertCircle, Bell, BellRing, CheckCircle2, Clock, Hash, Plus, Radio,
  Search, Stethoscope, Ticket, UserX, Users, Wifi
} from 'lucide-react'
import WalkinSmsModal from '../components/WalkinSmsModal'
import PublicTvDisplay from '../components/PublicTvDisplay'
import { Avatar, Badge, StatusBadge } from '../components/UIPrimitives'
import { useReceptionQueue } from '../hooks/useReceptionQueue'
import {
  STATUS_BADGE, STATUS_LABEL, currentFor, entryToken, fmtTime, formatToken,
  averageWaitMinutes, waitingFor
} from '../lib/receptionQueue'
import type { TokenSource } from '../lib/receptionQueue'

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

  const [activeTab, setActiveTab] = useState<'checkin' | 'patients' | 'doctors'>('checkin')
  const [showWalkinModal, setShowWalkinModal] = useState(false)
  const [showTvDisplay, setShowTvDisplay] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')

  // Counter form — mirrors the two ways a token reaches the queue.
  const [tokenSource, setTokenSource] = useState<TokenSource>('online')
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

  // Clinic-wide numbers for the header strip.
  const issuedToday = queue.entries.length
  const waitingInLobby = useMemo(
    () => queue.entries.filter(e => e.status === 'waiting').length,
    [queue.entries],
  )
  const avgWait = useMemo(() => averageWaitMinutes(queue.entries), [queue.entries])
  const activeDoctors = useMemo(() => queue.doctors.filter(d => d.status === 'active').length, [queue.doctors])

  const resetForm = () => {
    setFormName(''); setFormNic(''); setFormPhone(''); setPhysicalToken('')
  }

  const handleIssueToken = () => {
    const result = queue.issue({
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

  const switchSource = (source: TokenSource) => {
    setTokenSource(source)
    queue.clearError()
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
    (tokenSource === 'online' || physicalToken.trim().length > 0)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Modals */}
      <WalkinSmsModal
        isOpen={showWalkinModal}
        onClose={() => setShowWalkinModal(false)}
        doctors={queue.doctors}
        doctorId={queue.selectedDoctorId}
        nextToken={queue.nextToken}
        onIssue={({ name, phone, nic, doctorId }) => {
          queue.issue({ patientName: name, phone, nic, doctorId, source: 'online' })
        }}
      />
      <PublicTvDisplay
        isOpen={showTvDisplay}
        onClose={() => setShowTvDisplay(false)}
        doctor={selectedDoctor}
        current={current}
        waiting={waiting}
        estimateWait={queue.waitFor}
        onCallNext={queue.callNext}
      />

      {/* ── HEADER ── */}
      <div className="topbar" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
            borderRadius: 7, padding: '4px 10px', fontSize: 11.5, fontWeight: 700,
            color: 'var(--blue-dark)', flexShrink: 0,
          }}>Counter A-01</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Avatar name="RE Staff" size={28} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>Reception Desk</div>
              <div style={{ fontSize: 10, color: 'var(--text-4)', whiteSpace: 'nowrap' }} className="desktop-only">MediQueue Central Clinic</div>
            </div>
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
          <div className="desktop-only" style={{ alignItems: 'center', gap: 6 }}>
            <span className="pulse-live" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)' }}>Live queue</span>
          </div>
          <div style={{ position: 'relative', cursor: 'pointer' }}><Bell size={16} color="var(--text-3)" /><span style={{ position: 'absolute', top: -3, right: -3, width: 7, height: 7, background: 'var(--crimson)', borderRadius: '50%', border: '2px solid var(--bg)' }} /></div>
        </div>
      </div>

      {/* Sub-Navigation & Action Toolbar */}
      <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: 10, background: 'rgba(255, 255, 255, 0.25)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setActiveTab('checkin')} className={`btn btn-sm ${activeTab === 'checkin' ? 'btn-primary' : 'btn-ghost'}`}>
            <Ticket size={13} /> Issue Tokens & Queue
          </button>
          <button onClick={() => setActiveTab('patients')} className={`btn btn-sm ${activeTab === 'patients' ? 'btn-primary' : 'btn-ghost'}`}>
            <Users size={13} /> All Patients
          </button>
          <button onClick={() => setActiveTab('doctors')} className={`btn btn-sm ${activeTab === 'doctors' ? 'btn-primary' : 'btn-ghost'}`}>
            <Stethoscope size={13} /> Doctor Roster
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => setShowWalkinModal(true)} className="btn btn-primary btn-sm" style={{ gap: 5 }}>
            <Plus size={13} /> Walk-in SMS Registration
          </button>
          <button onClick={() => setShowTvDisplay(true)} className="btn btn-ghost btn-sm" style={{ gap: 5 }}>
            <Radio size={13} /> TV Display Board
          </button>
        </div>
      </div>

      {/* CLINIC-WIDE STAT RIBBON — one line, so it never competes with the live queue below */}
      <div style={{ padding: '18px 24px 0', display: 'flex', gap: 34, flexWrap: 'wrap' }}>
        <StatPill icon={<Ticket size={15} />} label="Issued Today" value={String(issuedToday)} />
        <StatPill icon={<Users size={15} />} label="Waiting Clinic-wide" value={String(waitingInLobby)} accent="var(--amber)" />
        <StatPill icon={<Clock size={15} />} label="Avg. Wait" value={`${avgWait} min`} accent="var(--blue)" />
        <StatPill icon={<Activity size={15} />} label="Doctors On Duty" value={`${activeDoctors}/${queue.doctors.length}`} accent="#10B981" />
      </div>

      {/* CHECK-IN & COUNTER QUEUE TAB */}
      {activeTab === 'checkin' && (
        <>
          {/* DOCTOR STRIP — the one control that scopes everything below it */}
          <div className="doctor-strip" style={{ padding: '16px 24px 0' }}>
            {queue.doctors.map(doc => {
              const serving = currentFor(queue.entries, doc.id)
              const docWaiting = waitingFor(queue.entries, doc.id)
              const isSelected = doc.id === queue.selectedDoctorId
              return (
                <button
                  key={doc.id}
                  onClick={() => { queue.setSelectedDoctorId(doc.id); queue.clearError() }}
                  className={`doctor-pill ${isSelected ? 'selected' : ''}`}
                >
                  <Avatar name={doc.name} size={34} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{doc.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>{doc.dept} · {doc.room}</div>
                  </div>
                  <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border-md)', margin: '0 2px' }} />
                  <div style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 800, fontFamily: 'monospace', color: serving ? 'var(--emerald)' : 'var(--text-4)' }}>
                      {serving ? entryToken(serving) : '—'}
                    </div>
                    <div style={{ color: 'var(--text-4)' }}>{docWaiting.length} waiting</div>
                  </div>
                  <StatusBadge status={doc.status} />
                </button>
              )
            })}
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
                    {tokenSource === 'online'
                      ? <>Next token: <strong style={{ color: 'var(--blue)' }}>{queue.nextToken}</strong></>
                      : <>Series <strong style={{ color: 'var(--blue)' }}>{selectedDoctor?.series}</strong> · pre-printed slip</>}
                  </div>
                </div>
              </div>

              {/* Source switch — a token is either generated here or already on paper */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'rgba(30, 41, 59, 0.04)', padding: 4, borderRadius: 10 }}>
                <button
                  onClick={() => switchSource('online')}
                  className={`btn btn-sm ${tokenSource === 'online' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ flex: 1, justifyContent: 'center', gap: 6 }}
                >
                  <Wifi size={13} /> Online / System
                </button>
                <button
                  onClick={() => switchSource('physical')}
                  className={`btn btn-sm ${tokenSource === 'physical' ? 'btn-amber' : 'btn-ghost'}`}
                  style={{ flex: 1, justifyContent: 'center', gap: 6 }}
                >
                  <Hash size={13} /> Physical Slip
                </button>
              </div>

              <form
                onSubmit={e => { e.preventDefault(); if (canIssue) handleIssueToken() }}
                style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                {tokenSource === 'physical' && (
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Printed Token Number</label>
                    <input
                      ref={physicalInputRef}
                      className="input"
                      type="number"
                      min={1}
                      placeholder="e.g. 16"
                      value={physicalToken}
                      onChange={e => { setPhysicalToken(e.target.value); queue.clearError() }}
                      style={{ height: 42, fontSize: 14, borderColor: queue.error ? 'var(--crimson-border)' : undefined }}
                    />
                    {/* Numbers already handed out today — stops the same slip being recorded twice */}
                    {issuedNumbers.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-4)', width: '100%', marginBottom: 2 }}>Already issued for series {selectedDoctor?.series}:</span>
                        {issuedNumbers.map(n => {
                          const entry = queue.doctorQueue.find(e => e.tokenNumber === n)!
                          const live = entry.status === 'waiting' || entry.status === 'called' || entry.status === 'in_progress'
                          return (
                            <span
                              key={n}
                              title={live ? 'Still active in the queue' : STATUS_LABEL[entry.status]}
                              style={{
                                fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5,
                                fontFamily: 'monospace',
                                background: live ? 'var(--crimson-dim)' : 'rgba(30, 41, 59, 0.04)',
                                border: `1px solid ${live ? 'var(--crimson-border)' : 'var(--border-md)'}`,
                                color: live ? 'var(--crimson)' : 'var(--text-4)',
                              }}
                            >
                              {formatToken(entry.series, n)}
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
                    {waiting.length} waiting · {queue.doctorQueue.filter(e => e.status === 'completed').length} completed · {queue.doctorQueue.filter(e => e.status === 'left').length} no-show
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
                      const isClosed = entry.status === 'completed' || entry.status === 'left'
                      const stripeColor = isCurrent
                        ? 'var(--emerald)'
                        : entry.status === 'waiting' ? 'var(--amber)'
                        : entry.status === 'left' ? 'var(--crimson-border)'
                        : 'transparent'
                      return (
                        <tr
                          key={entry.id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            borderLeft: `3px solid ${stripeColor}`,
                            background: isCurrent ? 'var(--emerald-dim)' : undefined,
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
                            <Badge cls={STATUS_BADGE[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
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
                              <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>Closed</span>
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
              <div key={d.id} className="card glass-form-card" style={{ padding: 20 }}>
                <Avatar name={d.name} size={44} />
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginTop: 12 }}>{d.name}</div>
                <div style={{ fontSize: 12, color: 'var(--blue-dark)' }}>{d.dept} · {d.room}</div>
                <div style={{ marginTop: 12 }}><StatusBadge status={d.status} /></div>
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--text-4)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span>Now serving: <strong style={{ color: 'var(--text-2)', fontFamily: 'monospace' }}>{serving ? entryToken(serving) : '—'}</strong></span>
                  <span>Waiting: <strong style={{ color: 'var(--text-2)' }}>{docWaiting.length}</strong> · Avg {d.avgConsultMinutes} min/consult</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
