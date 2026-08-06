import { useState } from 'react'
import { X, Clock, AlertTriangle, Send, CheckCircle2, MessageSquare } from 'lucide-react'

export default function DelayAlertModal({ isOpen, onClose, onSend }: {
  isOpen: boolean
  onClose: () => void
  onSend?: (delayMinutes: number, reason: string) => void
}) {
  const [delay, setDelay] = useState(15)
  const [reason, setReason] = useState('Emergency consultation in progress')
  const [sent, setSent] = useState(false)

  if (!isOpen) return null

  const handleDispatch = () => {
    setSent(true)
    setTimeout(() => {
      onSend?.(delay, reason)
      setSent(false)
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
        border: '1px solid rgba(245, 158, 11, 0.35)',
        borderRadius: 20, padding: '36px 32px',
        boxShadow: '0 20px 60px rgba(8, 48, 45, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        position: 'relative', overflowY: 'auto'
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 20, right: 20,
          background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.22)',
          borderRadius: '50%', width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-2)', cursor: 'pointer'
        }}>
          <X size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#F59E0B'
          }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Automatic Delay Alert</h3>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>Dr. Ethan Carr · Room 04 (General Medicine)</div>
          </div>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <CheckCircle2 size={52} color="#10B981" style={{ margin: '0 auto 14px' }} />
            <h4 style={{ fontSize: 18, fontWeight: 900, color: 'var(--text-1)' }}>Alert Dispatched to 7 Patients!</h4>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
              Simulated SMS & App notification sent. Live queue est. times updated.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 8, letterSpacing: '0.05em' }}>
                Estimated Delay Duration
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[10, 15, 20, 30].map(m => (
                  <button
                    key={m}
                    onClick={() => setDelay(m)}
                    className="btn"
                    style={{
                      height: 42,
                      background: delay === m ? '#F59E0B' : 'rgba(245, 158, 11, 0.08)',
                      color: delay === m ? '#ffffff' : 'var(--text-1)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      fontWeight: 800, fontSize: 14
                    }}
                  >
                    +{m} min
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Reason / Update Message
              </label>
              <select className="input" value={reason} onChange={e => setReason(e.target.value)} style={{ height: 44, fontSize: 14 }}>
                <option value="Emergency consultation in progress">Emergency consultation in progress</option>
                <option value="Unscheduled procedure required">Unscheduled procedure required</option>
                <option value="Doctor on brief administrative break">Doctor on brief administrative break</option>
                <option value="High patient volume delays">High patient volume delays</option>
              </select>
            </div>

            {/* Preview Box */}
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)', border: '1px dashed rgba(245, 158, 11, 0.35)',
              borderRadius: 12, padding: 14, fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, color: '#D97706', marginBottom: 4 }}>
                <MessageSquare size={14} /> SMS & App Broadcast Preview:
              </div>
              "Notice from MediQueue: Dr. Ethan Carr is running approx. <strong>{delay} mins</strong> behind schedule due to <em>{reason}</em>. Thank you for your patience."
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
              <button onClick={onClose} className="btn btn-ghost" style={{ height: 42 }}>Cancel</button>
              <button onClick={handleDispatch} className="btn btn-amber" style={{ gap: 8, height: 42, padding: '0 20px', fontSize: 14 }}>
                <Send size={15} /> Send Delay Alert to All
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
