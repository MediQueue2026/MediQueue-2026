import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity, ArrowRight, Bell, Building2, CheckCircle2, ChevronDown, Clock,
  Phone, Search, Shield, Stethoscope, Ticket, Users,
} from 'lucide-react'
import bgLobby from '../imports/mediqueue_bg_lobby.png'
import AnchoredMenu from '../components/AnchoredMenu'
import MolecularParticles from '../components/MolecularParticles'
import { Avatar, StatusBadge } from '../components/UIPrimitives'
import { api } from '../lib/api'
import type { ApiBoardEntry, ApiDoctor } from '../lib/api'

/**
 * Public landing page — Persuade surface.
 *
 * The live clinic board is the argument: a visitor can read today's real token
 * numbers, and look their own token up, before creating any account. Everything
 * else on the page supports that one demonstration.
 *
 * When the API is unreachable the board falls back to the sample roster below
 * and says so in the open — a queue product that quietly invents live numbers
 * is claiming exactly the thing it can't back up.
 */

const SAMPLE_DOCTORS: ApiDoctor[] = [
  { id: 's1', name: 'Dr. Aisha Patel', dept: 'Cardiology', room: 'Room 03', series: 'A', status: 'active', avgConsultMinutes: 12 },
  { id: 's2', name: 'Dr. Marcus Reeves', dept: 'General Medicine', room: 'Room 07', series: 'B', status: 'active', avgConsultMinutes: 10 },
  { id: 's3', name: 'Dr. Sofia Montoya', dept: 'Pediatrics', room: 'Room 11', series: 'C', status: 'delayed', avgConsultMinutes: 15 },
  { id: 's4', name: 'Dr. Kenji Nakamura', dept: 'Orthopedics', room: 'Room 02', series: 'D', status: 'break', avgConsultMinutes: 10 },
  { id: 's5', name: 'Dr. Priya Kumari', dept: 'Neurology', room: 'Room 15', series: 'E', status: 'active', avgConsultMinutes: 14 },
  { id: 's6', name: 'Dr. Ethan Carr', dept: 'General Medicine', room: 'Room 04', series: 'F', status: 'active', avgConsultMinutes: 8 },
]

const SAMPLE_BOARD: ApiBoardEntry[] = [
  { doctorId: 's1', series: 'A', nowServing: 14, waiting: 3 },
  { doctorId: 's2', series: 'B', nowServing: 22, waiting: 5 },
  { doctorId: 's3', series: 'C', nowServing: 9, waiting: 7 },
  { doctorId: 's4', series: 'D', nowServing: null, waiting: 0 },
  { doctorId: 's5', series: 'E', nowServing: 31, waiting: 2 },
  { doctorId: 's6', series: 'F', nowServing: 7, waiting: 4 },
]

const STAFF_PORTALS = [
  {
    to: '/login/receptionist',
    label: 'Reception Desk',
    detail: 'Issue tokens, run the counter queue, send SMS alerts',
    icon: <Ticket size={17} />,
    accent: '#E28A00',
  },
  {
    to: '/login/doctor',
    label: 'Doctor Console',
    detail: 'Call patients, record consultations, publish delay notices',
    icon: <Stethoscope size={17} />,
    accent: '#10B981',
  },
  {
    to: '/login/admin',
    label: 'System Admin',
    detail: 'Staff accounts, slot limits, centres, and audit logs',
    icon: <Shield size={17} />,
    accent: '#DC2626',
  },
]

type LookupResult =
  | { kind: 'idle' }
  | { kind: 'unknown'; typed: string }
  | { kind: 'serving'; token: string; doctor: ApiDoctor }
  | { kind: 'passed'; token: string; doctor: ApiDoctor }
  | { kind: 'waiting'; token: string; doctor: ApiDoctor; ahead: number; minutes: number }

/** Accepts `A-14`, `#a14`, `a 14` — whatever a patient reads off their slip. */
function parseToken(raw: string): { series: string; number: number } | null {
  const match = raw.trim().toUpperCase().match(/^#?\s*([A-Z])\s*[-\s]?\s*(\d{1,4})$/)
  if (!match) return null
  return { series: match[1], number: Number(match[2]) }
}

export default function LandingPage() {
  const navigate = useNavigate()

  const [doctors, setDoctors] = useState<ApiDoctor[]>(SAMPLE_DOCTORS)
  const [board, setBoard] = useState<ApiBoardEntry[]>(SAMPLE_BOARD)
  const [live, setLive] = useState(false)
  const [loadingBoard, setLoadingBoard] = useState(true)

  const [spec, setSpec] = useState('All')
  const [tokenInput, setTokenInput] = useState('')
  const [lookup, setLookup] = useState<LookupResult>({ kind: 'idle' })
  const [staffMenuOpen, setStaffMenuOpen] = useState(false)
  const staffButtonRef = useRef<HTMLButtonElement>(null)

  // Real roster + real board when the backend is up; labelled sample data when not.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [doctorsRes, boardRes] = await Promise.all([api.getDoctors(), api.getPublicBoard()])
        if (cancelled) return
        if (doctorsRes.doctors.length) setDoctors(doctorsRes.doctors)
        setBoard(boardRes.board)
        setLive(true)
      } catch {
        // Sample roster stays, and the badge below says so.
      } finally {
        if (!cancelled) setLoadingBoard(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const boardBySeries = useMemo(
    () => new Map(board.map(b => [b.series, b])),
    [board],
  )

  const specialities = useMemo(
    () => ['All', ...Array.from(new Set(doctors.map(d => d.dept)))],
    [doctors],
  )

  const visibleDoctors = useMemo(
    () => (spec === 'All' ? doctors : doctors.filter(d => d.dept === spec)),
    [doctors, spec],
  )

  const totalWaiting = useMemo(() => board.reduce((sum, b) => sum + b.waiting, 0), [board])
  const openRooms = useMemo(() => doctors.filter(d => d.status === 'active').length, [doctors])

  /**
   * Answers "where am I in the line?" from the public board alone — no account,
   * no token, nothing that could identify another patient.
   */
  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseToken(tokenInput)
    if (!parsed) return setLookup({ kind: 'unknown', typed: tokenInput.trim() })

    const doctor = doctors.find(d => d.series === parsed.series)
    const standing = boardBySeries.get(parsed.series)
    if (!doctor || !standing) return setLookup({ kind: 'unknown', typed: tokenInput.trim() })

    const token = `#${parsed.series}-${String(parsed.number).padStart(2, '0')}`
    const serving = standing.nowServing

    if (serving !== null && parsed.number === serving) {
      return setLookup({ kind: 'serving', token, doctor })
    }
    if (serving !== null && parsed.number < serving) {
      return setLookup({ kind: 'passed', token, doctor })
    }
    const ahead = serving === null ? standing.waiting : parsed.number - serving - 1
    setLookup({
      kind: 'waiting',
      token,
      doctor,
      ahead: Math.max(0, ahead),
      minutes: Math.max(0, ahead) * doctor.avgConsultMinutes,
    })
  }

  return (
    // The app shell's body gradient runs teal → indigo, which drops body text
    // below 4.5:1 in the lower sections. Every console sets its own ground for
    // the same reason; this page does too.
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── HEADER ── */}
      <header className="topbar" style={{ borderRadius: 0, justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, var(--teal) 0%, var(--teal-dark) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(18,198,186,0.35)', flexShrink: 0,
          }}>
            <Activity size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>MediQueue</div>
            <div style={{ fontSize: 9, color: 'var(--text-4)', fontWeight: 600, letterSpacing: '0.05em' }} className="desktop-only">HEALTHCARE PLATFORM</div>
          </div>
        </div>

        <div className="badge badge-emerald desktop-only" style={{ gap: 6, padding: '5px 11px', fontSize: 12 }}>
          <span className="pulse-live" />
          {live ? `${totalWaiting} patients in queue now` : 'Sample data — server offline'}
        </div>

        <div className="desktop-only" style={{ flex: 1, minWidth: 200, maxWidth: 380, position: 'relative' }}>
          <Search size={14} color="var(--text-4)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input className="input" placeholder="Search doctors or specialities…" style={{ paddingLeft: 36, height: 34 }} />
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, flexWrap: 'nowrap' }}>
          {/* Staff sign-in — the three consoles, one step from the front door. */}
          <>
            <button
              ref={staffButtonRef}
              onClick={() => setStaffMenuOpen(o => !o)}
              aria-haspopup="menu"
              aria-expanded={staffMenuOpen}
              className="btn btn-ghost btn-sm"
              style={{ padding: '5px 10px', fontSize: 12, gap: 5 }}
            >
              <Building2 size={13} /> <span className="desktop-only">Staff sign-in</span>
              <ChevronDown size={12} />
            </button>

            <AnchoredMenu
              anchorRef={staffButtonRef}
              open={staffMenuOpen}
              onClose={() => setStaffMenuOpen(false)}
              width={292}
            >
              {STAFF_PORTALS.map(p => (
                <Link
                  key={p.to}
                  to={p.to}
                  role="menuitem"
                  onClick={() => setStaffMenuOpen(false)}
                  className="staff-portal-link"
                >
                  <span style={{ color: p.accent, display: 'flex', flexShrink: 0 }}>{p.icon}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{p.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-4)', lineHeight: 1.4 }}>{p.detail}</span>
                  </span>
                </Link>
              ))}
            </AnchoredMenu>
          </>

          <Link to="/login" className="btn btn-ghost btn-sm" style={{ padding: '5px 10px', fontSize: 12, textDecoration: 'none' }}>
            Patient login
          </Link>
          <Link to="/login?new=1" className="btn btn-primary btn-sm" style={{ padding: '5px 12px', fontSize: 12, textDecoration: 'none' }}>
            Create account
          </Link>
          <button className="btn btn-danger btn-sm desktop-only" style={{ borderColor: 'var(--crimson-border)' }}>
            <Phone size={13} />Emergency
          </button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section style={{
        background: 'linear-gradient(180deg, rgba(16, 179, 168, 0.10) 0%, rgba(255, 255, 255, 0.10) 100%)',
        padding: '56px 24px 52px',
        borderBottom: '1px solid var(--border)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <MolecularParticles />
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '70%', height: '100%',
          backgroundImage: `url(${bgLobby})`,
          backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center left',
          opacity: 0.09, pointerEvents: 'none', zIndex: 1,
          WebkitMaskImage: 'radial-gradient(ellipse 80% 90% at 40% 60%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 75%)',
          maskImage: 'radial-gradient(ellipse 80% 90% at 40% 60%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 75%)',
        }} />

        <div className="responsive-hero-grid" style={{
          maxWidth: 1240, margin: '0 auto', display: 'grid',
          gridTemplateColumns: '1fr 440px', gap: 56, alignItems: 'center',
          position: 'relative', zIndex: 2,
        }}>
          <div>
            <h1 style={{
              fontSize: 'clamp(34px, 5.2vw, 54px)', fontWeight: 900, color: 'var(--text-1)',
              letterSpacing: '-0.038em', lineHeight: 1.04, marginBottom: 20, textWrap: 'balance',
            }}>
              Wait at home,<br />
              <span style={{ color: 'var(--blue-dark)' }}>not in the corridor.</span>
            </h1>
            <p style={{
              fontSize: 17, color: 'var(--text-2)', lineHeight: 1.65,
              maxWidth: '64ch', marginBottom: 30, fontWeight: 450,
            }}>
              Every token in every consulting room, updated the moment a patient is called.
              Check where the queue has reached before you leave the house — no app, no account,
              just the number on your slip.
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 34 }}>
              <Link to="/login?new=1" className="btn btn-primary btn-lg" style={{ textDecoration: 'none', gap: 8 }}>
                Book an appointment <ArrowRight size={16} />
              </Link>
              <a href="#live-board" className="btn btn-ghost btn-lg" style={{ textDecoration: 'none', gap: 8 }}>
                See today's queue
              </a>
            </div>

            {/* Numbers the page can actually stand behind. */}
            <dl style={{ display: 'flex', gap: 40, flexWrap: 'wrap', margin: 0 }}>
              {[
                { v: String(doctors.length), l: 'Consulting rooms' },
                { v: String(openRooms), l: 'Seeing patients now' },
                { v: String(totalWaiting), l: 'Patients waiting' },
                { v: live ? 'Live' : 'Sample', l: live ? 'Updated on every call' : 'Server offline' },
              ].map(s => (
                <div key={s.l}>
                  <dt style={{ fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600, order: 2, marginTop: 3 }}>{s.l}</dt>
                  <dd style={{
                    fontSize: 26, fontWeight: 800, color: 'var(--text-1)',
                    letterSpacing: '-0.03em', margin: 0, lineHeight: 1,
                  }}>{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Token lookup — the product, working, before sign-up. */}
          <div className="card glass-form-card" style={{ padding: 28, background: 'rgba(255, 255, 255, 0.9)' }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
              Where has the queue reached?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6, marginBottom: 18, lineHeight: 1.55 }}>
              Type the token number printed on your slip.
            </p>

            <form onSubmit={handleLookup} style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                placeholder="A-14"
                value={tokenInput}
                onChange={e => { setTokenInput(e.target.value); setLookup({ kind: 'idle' }) }}
                aria-label="Your token number"
                style={{ height: 46, fontSize: 16, fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.04em' }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!tokenInput.trim() || loadingBoard}
                style={{ height: 46, padding: '0 18px', fontWeight: 700, borderRadius: 10, flexShrink: 0 }}
              >
                Check
              </button>
            </form>

            <div style={{ marginTop: 18 }} aria-live="polite">
              {lookup.kind === 'idle' && (
                <p style={{ fontSize: 12.5, color: 'var(--text-4)', lineHeight: 1.6, margin: 0 }}>
                  {loadingBoard
                    ? 'Loading today\'s board…'
                    : live
                      ? `Reading today's live board across ${doctors.length} rooms.`
                      : 'Showing sample data — start the MediQueue server for live numbers.'}
                </p>
              )}

              {lookup.kind === 'unknown' && (
                <div className="lookup-result" style={{ borderColor: 'var(--amber-border)', background: 'var(--amber-dim)' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--amber)' }}>
                    No queue found for “{lookup.typed}”
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '5px 0 0', lineHeight: 1.55 }}>
                    Tokens look like <strong style={{ fontFamily: 'monospace' }}>A-14</strong> — a room letter and
                    the number from your slip. Ask at reception if your slip looks different.
                  </p>
                </div>
              )}

              {lookup.kind === 'serving' && (
                <div className="lookup-result" style={{ borderColor: 'var(--emerald-border)', background: 'var(--emerald-dim)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle2 size={17} color="var(--emerald)" />
                    <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--emerald)' }}>
                      {lookup.token} is being called now
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '6px 0 0', lineHeight: 1.55 }}>
                    Go to {lookup.doctor.room} — {lookup.doctor.name} is ready for you.
                  </p>
                </div>
              )}

              {lookup.kind === 'passed' && (
                <div className="lookup-result" style={{ borderColor: 'var(--crimson-border)', background: 'var(--crimson-dim)' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--crimson)' }}>
                    {lookup.token} has already been called
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: '5px 0 0', lineHeight: 1.55 }}>
                    Speak to reception at {lookup.doctor.room} — they can put you back in the line.
                  </p>
                </div>
              )}

              {lookup.kind === 'waiting' && (
                <div className="lookup-result" style={{ borderColor: 'var(--blue-border)', background: 'var(--blue-dim)' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 34, fontWeight: 900, color: 'var(--blue-dark)', fontFamily: 'monospace', letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {lookup.ahead}
                    </span>
                    <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-1)' }}>
                      {lookup.ahead === 1 ? 'patient ahead of you' : 'patients ahead of you'}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: '8px 0 0', lineHeight: 1.6 }}>
                    {lookup.token} · {lookup.doctor.name} · {lookup.doctor.room}
                    {lookup.ahead > 0 && <> · roughly {lookup.minutes} minutes at today's pace</>}
                  </p>
                  {lookup.doctor.status === 'delayed' && (
                    <p style={{ fontSize: 12, color: 'var(--amber)', margin: '8px 0 0', fontWeight: 600 }}>
                      This room is running late — allow extra time.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE BOARD ── */}
      <section id="live-board" style={{ padding: '52px 24px 44px', maxWidth: 1240, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 27, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
              Today's consulting rooms
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 7, maxWidth: '68ch', lineHeight: 1.6 }}>
              {live
                ? 'Read live from the reception desk. The number changes the moment a patient is called.'
                : 'Sample rooms. Start the MediQueue server to read the live board.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {specialities.map(s => (
              <button
                key={s}
                onClick={() => setSpec(s)}
                aria-pressed={spec === s}
                className="btn btn-sm"
                style={{
                  background: spec === s ? 'var(--blue)' : 'rgba(255,255,255,0.6)',
                  color: spec === s ? '#fff' : 'var(--text-3)',
                  border: '1px solid', borderColor: spec === s ? 'var(--blue)' : 'var(--border-md)',
                }}
              >{s}</button>
            ))}
          </div>
        </div>

        {/* A board, not a card grid — the token is the row's reason to exist. */}
        <div className="card glass-form-card" style={{ padding: 0, overflow: 'hidden' }}>
          {visibleDoctors.length === 0 && (
            <p style={{ padding: '38px 24px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13.5, margin: 0 }}>
              No rooms open in {spec} today.
            </p>
          )}

          {visibleDoctors.map((doc, i) => {
            const standing = boardBySeries.get(doc.series)
            const serving = standing?.nowServing ?? null
            const waiting = standing?.waiting ?? 0
            return (
              <div
                key={doc.id}
                className="board-row"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)', animationDelay: `${Math.min(i, 7) * 55}ms` }}
              >
                <Avatar name={doc.name} size={42} />

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.015em' }}>{doc.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 2 }}>{doc.dept} · {doc.room}</div>
                </div>

                <div className="board-row-token">
                  <div style={{ fontSize: 10.5, color: 'var(--text-4)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    Now serving
                  </div>
                  <div style={{
                    fontSize: 27, fontWeight: 900, fontFamily: 'monospace', letterSpacing: '-0.03em',
                    color: serving === null ? 'var(--text-4)' : 'var(--blue-dark)', lineHeight: 1.15,
                  }}>
                    {serving === null ? '—' : `#${doc.series}-${String(serving).padStart(2, '0')}`}
                  </div>
                </div>

                <div className="board-row-wait">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', fontWeight: 600 }}>
                    <Users size={14} color="var(--text-4)" />
                    {waiting === 0 ? 'No one waiting' : `${waiting} waiting`}
                  </div>
                  {waiting > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>
                      <Clock size={12} /> about {waiting * doc.avgConsultMinutes} min to clear
                    </div>
                  )}
                </div>

                <StatusBadge status={doc.status === 'offline' ? 'offline' : doc.status} />
              </div>
            )
          })}
        </div>
      </section>

      {/* ── HOW IT WORKS — the sequence is the information, so it is numbered. ── */}
      <section style={{ padding: '20px 24px 56px', maxWidth: 1240, margin: '0 auto' }}>
        <h2 style={{ fontSize: 27, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', marginBottom: 26 }}>
          How a visit works
        </h2>
        <ol className="how-it-works">
          {[
            {
              title: 'Book, or walk in',
              body: 'Reserve a slot online, or take a token at the counter. Both land in the same queue — walk-ins are never pushed to the back.',
            },
            {
              title: 'Watch the number, not the clock',
              body: 'Your token and the room\'s current number update together. Reception sends an SMS as your turn approaches.',
            },
            {
              title: 'Arrive when it is nearly your turn',
              body: 'Rooms running late publish a delay notice, so a slipping schedule reaches you before you have left home.',
            },
          ].map((step, i) => (
            <li key={step.title}>
              <span className="how-step-number">{i + 1}</span>
              <div>
                <h3 style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.015em' }}>{step.title}</h3>
                <p style={{ fontSize: 13.5, color: 'var(--text-3)', lineHeight: 1.65, marginTop: 6, maxWidth: '52ch' }}>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── STAFF ACCESS ── */}
      <section style={{ padding: '0 24px 56px', maxWidth: 1240, margin: '0 auto' }}>
        <div className="card glass-form-card staff-band">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.025em' }}>
              Working here today?
            </h2>
            <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 8, lineHeight: 1.6, maxWidth: '48ch' }}>
              Sign in to your console. Staff accounts are created by your system
              administrator — there is no self-service sign-up for clinic roles.
            </p>
          </div>

          <div className="staff-band-links">
            {STAFF_PORTALS.map(p => (
              <Link key={p.to} to={p.to} className="staff-portal-card">
                <span style={{ color: p.accent, display: 'flex' }}>{p.icon}</span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{p.label}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-4)', lineHeight: 1.45, marginTop: 2 }}>{p.detail}</span>
                </span>
                <ArrowRight size={15} color="var(--text-4)" style={{ flexShrink: 0 }} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(10px)', padding: '40px 24px 24px' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 32, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', marginBottom: 10 }}>MediQueue Systems</div>
              <p style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.65, maxWidth: '38ch', margin: 0 }}>
                Outpatient queue management, live token tracking, and EHR integration
                for clinics that would rather not run on a shouted name and a paper list.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 16, fontSize: 11.5, color: 'var(--text-4)', fontWeight: 600 }}>
                <Shield size={13} /> HIPAA compliant · ISO 27001 · HL7 FHIR
              </div>
            </div>

            {([
              ['For patients', [['Track a token', '#live-board'], ['Patient login', '/login'], ['Create account', '/login?new=1']]],
              ['For clinics', [['Reception Desk', '/login/receptionist'], ['Doctor Console', '/login/doctor'], ['System Admin', '/login/admin']]],
              ['Displays', [['Waiting-room board', '/tv-display']]],
            ] as const).map(([title, links]) => (
              <div key={title}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>{title}</div>
                {links.map(([label, to]) => (
                  to.startsWith('#')
                    ? <a key={label} href={to} className="footer-link">{label}</a>
                    : <Link key={label} to={to} className="footer-link">{label}</Link>
                ))}
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>© 2026 MediQueue Systems Pvt. Ltd.</span>
            <button
              onClick={() => navigate('/tv-display')}
              className="btn btn-ghost btn-sm"
              style={{ gap: 6, fontSize: 11.5 }}
            >
              <Bell size={12} /> Open waiting-room display
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
