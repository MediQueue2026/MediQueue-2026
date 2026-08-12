import { X, FileText, Activity, Calendar, Download, Stethoscope, HeartPulse } from 'lucide-react'

export default function PatientHistoryDrawer({ isOpen, onClose, patientName = 'Nimal Silva', patientToken = '#A-11' }: {
  isOpen: boolean
  onClose: () => void
  patientName?: string
  patientToken?: string
}) {
  if (!isOpen) return null

  const visits = [
    { date: 'Jul 12, 2026', doc: 'Dr. Ethan Carr', spec: 'General Medicine', dx: 'Acute Bronchitis & Pharyngitis', rx: 'Amoxicillin 500mg, Paracetamol 500mg', status: 'Resolved' },
    { date: 'May 30, 2026', doc: 'Dr. Aisha Patel', spec: 'Cardiology', dx: 'Routine ECG & Blood Pressure Check', rx: 'Amlodipine 5mg OD', status: 'Ongoing Monitoring' },
    { date: 'Feb 14, 2026', doc: 'Dr. S. Montoya', spec: 'General Practice', dx: 'Seasonal Influenza', rx: 'Rest, Hydration & Multivitamins', status: 'Resolved' }
  ]

  const labs = [
    { title: 'Complete Blood Count (CBC)', date: 'Jul 12, 2026', lab: 'Central Diagnostics', status: 'Normal' },
    { title: 'Resting Electrocardiogram (ECG)', date: 'May 30, 2026', lab: 'CardioLab North', status: 'Sinus Rhythm' },
    { title: 'Lipid Profile & HbA1c', date: 'Jan 10, 2026', lab: 'Central Diagnostics', status: 'Borderline High' }
  ]

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
              <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Medical History & Reports</h3>
              <div style={{ fontSize: 12.5, color: 'var(--text-4)' }}>Patient: <strong>{patientName}</strong> ({patientToken}) · Male, 47y</div>
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

        {/* Vitals Summary Card */}
        <div className="card" style={{ padding: 18, marginBottom: 24, background: 'rgba(18, 198, 186, 0.06)', border: '1px solid var(--border-md)', borderRadius: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <HeartPulse size={16} color="var(--blue)" /> Historical Vitals Baseline
          </div>
          <div className="vitals-responsive-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, textAlign: 'center' }}>
            {[
              { label: 'Avg BP', val: '126/80' },
              { label: 'Heart Rate', val: '74 bpm' },
              { label: 'BMI', val: '24.2' },
              { label: 'Blood Group', val: 'O+' }
            ].map(v => (
              <div key={v.label} style={{ background: '#ffffff', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10.5, color: 'var(--text-4)' }}>{v.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginTop: 2 }}>{v.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Past Visit Logs */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Stethoscope size={18} color="var(--blue)" /> Past Consultation Records ({visits.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {visits.map((v, i) => (
              <div key={i} className="card" style={{ padding: 16, background: '#ffffff', border: '1px solid var(--border-md)', borderRadius: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{v.dx}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{v.date}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                  Attended by: <strong>{v.doc}</strong> ({v.spec})
                </div>
                <div style={{ fontSize: 12, background: 'var(--blue-dim)', padding: '8px 12px', borderRadius: 8, color: 'var(--text-2)' }}>
                  <strong>Rx:</strong> {v.rx}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Diagnostic & Lab Reports */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Activity size={18} color="var(--blue)" /> Diagnostic & Lab Reports ({labs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {labs.map((l, i) => (
              <div key={i} style={{
                padding: '14px 16px', borderRadius: 12, background: '#ffffff',
                border: '1px solid var(--border-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{l.title}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>{l.lab} · {l.date}</div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ gap: 5, fontSize: 11.5 }}>
                  <Download size={14} /> PDF
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
