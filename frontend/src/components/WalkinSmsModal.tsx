import { useEffect, useState } from 'react'
import { X, Send, Phone, User, Ticket, CheckCircle2, MessageSquare } from 'lucide-react'
import type { ReceptionDoctor } from '../lib/receptionQueue'

export default function WalkinSmsModal({
  isOpen, onClose, onIssue, doctors = [], doctorId, nextToken = '#A-01',
}: {
  isOpen: boolean
  onClose: () => void
  onIssue?: (tokenData: { name: string; phone: string; nic?: string; doctorId: string; token: string }) => void
  /** Live doctor roster — falls back to an empty list when rendered standalone. */
  doctors?: ReceptionDoctor[]
  /** Doctor the desk is currently issuing for. */
  doctorId?: string
  /** Real next token from the queue, so the slip and the SMS agree. */
  nextToken?: string
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedDoctorId, setSelectedDoctorId] = useState(doctorId ?? doctors[0]?.id ?? '')
  const [sent, setSent] = useState(false)

  // Follow the desk's doctor selection whenever the modal is (re)opened.
  useEffect(() => {
    if (isOpen && doctorId) setSelectedDoctorId(doctorId)
  }, [isOpen, doctorId])

  const doctor = doctors.find(d => d.id === selectedDoctorId)
  const doctorLabel = doctor ? `${doctor.name} (${doctor.room})` : 'the assigned doctor'
  const generatedToken = nextToken

  if (!isOpen) return null

  const handleIssueToken = (e: React.FormEvent) => {
    e.preventDefault()
    // Commit to the queue first so the confirmation shows a token that exists.
    onIssue?.({ name, phone, doctorId: selectedDoctorId, token: generatedToken })
    setSent(true)
    setTimeout(() => {
      setSent(false)
      setName('')
      setPhone('')
      onClose()
    }, 1200)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(6, 35, 33, 0.65)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16
    }}>
      <div className="fade-in modal-card" style={{
        width: '100%', maxWidth: 540, maxHeight: '90vh',
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(18, 198, 186, 0.28)',
        borderRadius: 20, padding: '36px 32px',
        boxShadow: '0 20px 60px rgba(8, 48, 45, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        position: 'relative', overflowY: 'auto'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(18, 198, 186, 0.1)', border: '1px solid rgba(18, 198, 186, 0.22)',
          borderRadius: '50%', width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)', cursor: 'pointer'
        }}>
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--blue)'
          }}>
            <Ticket size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Walk-In Patient & SMS Service</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>Counter A-01 · Receptionist Token Dispatch</div>
          </div>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <CheckCircle2 size={52} color="#10B981" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)' }}>Token {generatedToken} Issued!</h4>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
              Simulated SMS notification dispatched to <strong>{phone}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleIssueToken} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Patient Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="var(--text-4)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  required
                  className="input"
                  placeholder="e.g. Sunil Perera"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{ paddingLeft: 38, height: 44, fontSize: 14 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Mobile Number (for SMS Confirmation)
              </label>
              <div style={{ position: 'relative' }}>
                <Phone size={16} color="var(--text-4)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  required
                  className="input"
                  placeholder="0771234567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{ paddingLeft: 38, height: 44, fontSize: 14 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Assigned Doctor & Room
              </label>
              <select
                className="input"
                value={selectedDoctorId}
                onChange={e => setSelectedDoctorId(e.target.value)}
                style={{ height: 44, fontSize: 14 }}
              >
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.room} - {d.dept})</option>
                ))}
              </select>
            </div>

            {/* SMS Preview Box */}
            <div style={{
              background: 'var(--blue-dim)', border: '1px dashed var(--blue-border)',
              borderRadius: 12, padding: 14, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: 'var(--blue-dark)', marginBottom: 4 }}>
                <MessageSquare size={14} /> SMS Broadcast Preview:
              </div>
              "MediQueue: Hello {name || 'Patient'}, Token <strong>{generatedToken}</strong> issued for {doctorLabel}. Track live queue status: mediqueue.io/t/{generatedToken.replace(/[#-]/g, '').toLowerCase()}"
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button type="button" onClick={onClose} className="btn btn-ghost" style={{ height: 42 }}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ gap: 8, height: 42, padding: '0 20px', fontSize: 14 }}>
                <Send size={15} /> Issue Token & Send SMS
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
