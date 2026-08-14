import { useState, useEffect } from 'react'
import { X, FileText, Stethoscope } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

interface PatientHistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  patientId?: string
  patientName?: string
  patientToken?: string
}

export default function PatientHistoryDrawer({
  isOpen,
  onClose,
  patientId,
  patientName = 'Nimal Silva',
  patientToken = '#A-11'
}: PatientHistoryDrawerProps) {
  const [dbRecords, setDbRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    async function loadRecords() {
      try {
        setLoading(true)
        const targetId = patientId || 'all'
        const url = `${API_BASE}/records/${targetId}${patientName ? `?patientName=${encodeURIComponent(patientName)}` : ''}`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setDbRecords(data.records || [])
        }
      } catch (e) {
        console.warn('Patient history API fetch warning:', e)
      } finally {
        setLoading(false)
      }
    }
    if (isOpen) {
      loadRecords()
    }
  }, [isOpen, patientId, patientName])

  if (!isOpen) return null

  const visits = dbRecords.map(r => {
    const meds = r.rx_medications || r.rxMedications
    const rxStr = Array.isArray(meds) && meds.length > 0
      ? meds.map((m: any) => `${m.name || m.medication || 'Medication'} (${m.dosage || '1 dose'}${m.freq ? `, ${m.freq}` : ''})`).join(' · ')
      : (r.notes || 'Clinical consultation & prescription')

    return {
      date: r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'Recent',
      doc: r.issuing_authority || 'Doctor Console',
      spec: r.record_type || 'Prescription',
      dx: r.title || 'Clinical Evaluation',
      rx: rxStr,
      status: 'Saved to DB'
    }
  })

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(6, 35, 33, 0.5)',
      backdropFilter: 'blur(8px)',
      display: 'flex', justifyContent: 'flex-end'
    }}>
      <div className="fade-in drawer-card" style={{
        width: '100%', maxWidth: 600, height: '100%',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(18, 198, 186, 0.28)',
        boxShadow: '-10px 0 50px rgba(6, 35, 33, 0.2)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', padding: '32px 28px'
      }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#10B981'
            }}>
              <FileText size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
                Electronic Health Records
              </h3>
              <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>Patient: <strong>{patientName}</strong> ({patientToken})</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(18, 198, 186, 0.1)', border: '1px solid rgba(18, 198, 186, 0.22)',
            borderRadius: '50%', width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-2)', cursor: 'pointer'
          }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-4)' }}>Loading health records from Supabase...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Medical Consultation History */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <Stethoscope size={16} color="var(--blue)" />
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Past Consultations ({visits.length})
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {visits.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', background: '#ffffff', borderRadius: 14, color: 'var(--text-4)', fontSize: 13, border: '1px solid var(--border-md)' }}>
                    No past health records or prescriptions found for this patient in the database.
                  </div>
                ) : (
                  visits.map((v, i) => (
                    <div key={i} style={{
                      padding: 16, background: '#ffffff', borderRadius: 14,
                      border: '1px solid var(--border-md)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>{v.dx}</div>
                        <span className="badge badge-emerald" style={{ fontSize: 10 }}>{v.status}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--blue-dark)', fontWeight: 600, marginBottom: 8 }}>
                        {v.doc} · {v.spec} · <span style={{ color: 'var(--text-4)' }}>{v.date}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <strong>Rx Prescribed:</strong> {v.rx}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}