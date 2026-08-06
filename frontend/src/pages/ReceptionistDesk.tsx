import { useState } from 'react'
import {
  Activity, Bell, BellRing, Clock, Plus, Radio, Search,
  Stethoscope, Ticket, Users
} from 'lucide-react'
import WalkinSmsModal from '../components/WalkinSmsModal'
import PublicTvDisplay from '../components/PublicTvDisplay'
import { Avatar, Badge, StatCard, StatusBadge } from '../components/UIPrimitives'

type Priority = 'standard' | 'elderly' | 'emergency'

const LOBBY_DOCTORS = [
  { name: 'Dr. Ethan Carr',    dept: 'General',     room: 'Room 04', current: '#A-11', queue: ['#A-12','#A-13','#A-14'], wait: '15 min', status: 'active'  as const },
  { name: 'Dr. Aisha Patel',   dept: 'Cardiology',  room: 'Room 03', current: '#B-06', queue: ['#B-07','#B-08'],         wait: '8 min',  status: 'active'  as const },
  { name: 'Dr. S. Montoya',    dept: 'Pediatrics',  room: 'Room 11', current: '#C-09', queue: ['#C-10','#C-11','#C-12'], wait: '25 min', status: 'delayed' as const },
  { name: 'Dr. K. Nakamura',   dept: 'Orthopedics', room: 'Room 02', current: '—',     queue: [],                        wait: '—',      status: 'break'   as const },
]

const ALL_PATIENTS_RECEPTION = [
  { id: '#P-101', name: 'Nimal Silva', nic: '197945210082', phone: '0771234567', token: '#A-11', status: 'In Consultation', doc: 'Dr. Ethan Carr' },
  { id: '#P-102', name: 'Kasun Perera', nic: '199212004821', phone: '0719876543', token: '#A-12', status: 'Waiting in Lobby', doc: 'Dr. Ethan Carr' },
  { id: '#P-103', name: 'Dilini Fernando', nic: '199856210099', phone: '0754433221', token: '#A-13', status: 'Waiting in Lobby', doc: 'Dr. Ethan Carr' },
  { id: '#P-104', name: 'Rajan Mehta', nic: '198845210082', phone: '0778899001', token: '#A-14', status: 'Waiting in Lobby', doc: 'Dr. Ethan Carr' },
  { id: '#P-105', name: 'Sunil Wickramasinghe', nic: '196512345678', phone: '0721122334', token: '#A-15', status: 'Checked In', doc: 'Dr. Ethan Carr' },
]

export default function ReceptionistDesk() {
  const [priority, setPriority] = useState<Priority>('standard')
  const [activeTab, setActiveTab] = useState<'checkin' | 'patients' | 'doctors'>('checkin')
  const [showWalkinModal, setShowWalkinModal] = useState(false)
  const [showTvDisplay, setShowTvDisplay] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [currentServingToken, setCurrentServingToken] = useState('#A-11')

  const handleCallNext = () => {
    const nextToken = currentServingToken === '#A-11' ? '#A-12' : '#A-13'
    setCurrentServingToken(nextToken)
  }

  const filteredPatients = ALL_PATIENTS_RECEPTION.filter(p =>
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) ||
    p.nic.includes(patientSearch) ||
    p.token.toLowerCase().includes(patientSearch.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Modals */}
      <WalkinSmsModal isOpen={showWalkinModal} onClose={() => setShowWalkinModal(false)} />
      <PublicTvDisplay isOpen={showTvDisplay} onClose={() => setShowTvDisplay(false)} />

      {/* ── HEADER ── */}
      <div className="topbar" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
        {/* Left: counter badge + staff info */}
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

        {/* Center: Call Next */}
        <button onClick={handleCallNext} className="btn btn-emerald btn-sm" style={{ gap: 5, fontWeight: 800, padding: '5px 12px', borderRadius: 8, flexShrink: 0 }}>
          <BellRing size={14} /> Call Next ({currentServingToken === '#A-11' ? '#A-12' : '#A-13'})
        </button>

        {/* Notification indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
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

      {/* TOP METRICS */}
      <div className="responsive-grid-4" style={{ padding: '18px 24px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        {[
          { icon: <Ticket size={18} />, label: 'Tokens Issued Today', val: '87',    accent: 'var(--text-1)' },
          { icon: <Activity size={18}/>, label: 'Currently Serving',  val: currentServingToken, accent: '#10B981' },
          { icon: <Users size={18} />,  label: 'Waiting in Lobby',    val: '14',    accent: '#F59E0B' },
          { icon: <Clock size={18} />,  label: 'Avg. Wait Time',      val: '11 min', accent: 'var(--blue)' },
        ].map((m, i) => (
          <StatCard key={i} icon={m.icon} label={m.label} value={m.val} accent={m.accent} />
        ))}
      </div>

      {/* CHECK-IN & COUNTER QUEUE TAB */}
      {activeTab === 'checkin' && (
        <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: 20, padding: '0 24px 28px' }}>
          {/* Token issuance form card */}
          <div className="card glass-form-card" style={{ padding: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={18} color="var(--blue)" />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>Issue Walk-in Token</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)' }}>Next token will be <strong style={{ color: 'var(--blue)' }}>#A-25</strong></div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient Full Name</label>
                <input className="input" placeholder="e.g. Sunil Perera" style={{ height: 44, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>NIC / Passport Number</label>
                <input className="input" placeholder="e.g. 198845210082" style={{ height: 44, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-4)', fontWeight: 700, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned Doctor & Room</label>
                <select className="input" style={{ height: 44, fontSize: 14 }}>
                  <option>Dr. Ethan Carr — General Medicine (Room 04)</option>
                  <option>Dr. Aisha Patel — Cardiology (Room 03)</option>
                  <option>Dr. S. Montoya — Pediatrics (Room 11)</option>
                </select>
              </div>

              <button onClick={() => setShowWalkinModal(true)} className="btn btn-primary" style={{ width: '100%', marginTop: 8, height: 44, fontSize: 14.5, fontWeight: 700, borderRadius: 10 }}>
                <Ticket size={16} /> Issue Token & Send SMS
              </button>
            </div>
          </div>

          {/* Lobby Doctor Cards Grid */}
          <div className="responsive-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {LOBBY_DOCTORS.map(doc => (
              <div key={doc.name} className="card glass-form-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>{doc.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--blue-dark)' }}>{doc.dept} · {doc.room}</div>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
                <div style={{ background: '#ffffff', padding: 14, borderRadius: 10, border: '1px solid var(--border-md)', marginBottom: 12 }}>
                  <div style={{ fontSize: 10.5, color: 'var(--text-4)', textTransform: 'uppercase' }}>NOW SERVING</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--blue)', fontFamily: 'monospace' }}>{doc.current}</div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>
                  Queue: {doc.queue.join(', ') || 'No waiting tokens'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ALL PATIENTS MANAGEMENT TAB */}
      {activeTab === 'patients' && (
        <div style={{ padding: '0 24px 28px' }}>
          <div className="card glass-form-card" style={{ padding: 24 }}>
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
                    <th style={{ padding: '12px 14px' }}>Patient ID</th>
                    <th style={{ padding: '12px 14px' }}>Name</th>
                    <th style={{ padding: '12px 14px' }}>NIC Number</th>
                    <th style={{ padding: '12px 14px' }}>Phone</th>
                    <th style={{ padding: '12px 14px' }}>Active Token</th>
                    <th style={{ padding: '12px 14px' }}>Assigned Doctor</th>
                    <th style={{ padding: '12px 14px' }}>Status</th>
                    <th style={{ padding: '12px 14px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 700, fontFamily: 'monospace' }}>{p.id}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-1)' }}>{p.name}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-3)' }}>{p.nic}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-3)' }}>{p.phone}</td>
                      <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--blue)', fontFamily: 'monospace' }}>{p.token}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--text-2)' }}>{p.doc}</td>
                      <td style={{ padding: '12px 14px' }}><Badge cls="badge-blue">{p.status}</Badge></td>
                      <td style={{ padding: '12px 14px' }}>
                        <button className="btn btn-ghost btn-sm">Edit Profile</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DOCTOR STATUS ROSTER TAB */}
      {activeTab === 'doctors' && (
        <div className="responsive-grid-4" style={{ padding: '0 24px 28px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {LOBBY_DOCTORS.map(d => (
            <div key={d.name} className="card glass-form-card" style={{ padding: 20 }}>
              <Avatar name={d.name} size={44} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginTop: 12 }}>{d.name}</div>
              <div style={{ fontSize: 12, color: 'var(--blue-dark)' }}>{d.dept} · {d.room}</div>
              <div style={{ marginTop: 12 }}><StatusBadge status={d.status} /></div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
