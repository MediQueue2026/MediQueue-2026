import { FileText, X, Download, ShieldCheck, Activity } from 'lucide-react'
import { HealthRecordItem } from '../types/patient'

interface ViewReportModalProps {
  isOpen: boolean
  onClose: () => void
  record: HealthRecordItem | null
}

export function ViewReportModal({ isOpen, onClose, record }: ViewReportModalProps) {
  if (!isOpen || !record) return null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(7, 21, 20, 0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div className="card glass-form-card" style={{
        width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto',
        background: '#ffffff', borderRadius: 16,
        padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
              <FileText size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>{record.title}</h3>
              <p style={{ fontSize: 11.5, color: 'var(--text-4)', margin: 0 }}>{record.issuingAuthority} · {record.date}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-4)' }}><X size={18} /></button>
        </div>

        {/* Diagnostic Document Simulation */}
        <div style={{ padding: 20, background: '#fafafa', borderRadius: 12, border: '1px solid var(--border-md)', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, borderBottom: '1px dashed var(--border-md)', paddingBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--blue-dark)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={14} /> Official Diagnostic Document
            </div>
            <div style={{ fontSize: 11, color: '#10B981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldCheck size={13} /> Verified EHR Record
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, color: 'var(--text-2)' }}>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Document Title</span>
              <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{record.title}</span>
            </div>

            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Category / Type</span>
              <span style={{ textTransform: 'uppercase', fontWeight: 600, color: 'var(--blue)' }}>{record.recordType.replace('_', ' ')}</span>
            </div>

            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>Diagnostic Observations & Findings</span>
              <p style={{ background: '#ffffff', padding: 12, borderRadius: 8, border: '1px solid var(--border-md)', lineHeight: 1.6, marginTop: 4 }}>
                {record.notes || 'No detailed clinical observations entered for this record.'}
              </p>
            </div>

            {(() => {
              const meds = record.rxMedications || (record as any).rx_medications
              if (!meds || !Array.isArray(meds) || meds.length === 0) return null
              return (
                <div style={{ marginTop: 10 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--blue)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                    Rx Medications Prescribed
                  </span>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: '#ffffff', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-md)' }}>
                    <thead>
                      <tr style={{ background: 'rgba(18, 198, 186, 0.1)', textAlign: 'left' }}>
                        <th style={{ padding: 8 }}>Medication</th>
                        <th style={{ padding: 8 }}>Dosage</th>
                        <th style={{ padding: 8 }}>Frequency</th>
                        <th style={{ padding: 8 }}>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meds.map((d: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                          <td style={{ padding: 8, fontWeight: 700 }}>{d.name || d.medication || 'Medication'}</td>
                          <td style={{ padding: 8 }}>{d.dosage || '—'}</td>
                          <td style={{ padding: 8 }}>{d.freq || d.frequency || '—'}</td>
                          <td style={{ padding: 8 }}>{d.duration || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        </div>

        {/* Action triggers */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} className="btn btn-ghost">Close</button>
          <button
            type="button"
            onClick={() => alert(`Downloading PDF copy of "${record.title}"...`)}
            className="btn btn-primary"
            style={{ gap: 6 }}
          >
            <Download size={14} /> Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}
