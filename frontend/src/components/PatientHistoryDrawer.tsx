import { useState, useEffect } from 'react'
import { X, FileText, Stethoscope, Paperclip, Eye } from 'lucide-react'
import { ViewReportModal } from './ViewReportModal'
import { HealthRecordItem } from '../types/patient'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

interface PatientHistoryDrawerProps {
  isOpen: boolean
  onClose: () => void
  patientId?: string
  patientName?: string
  patientToken?: string
}

/**
 * The patient's record list, opened from the queue.
 *
 * It previously flattened each row into a display-only summary and dropped
 * `file_url` on the way, so an uploaded report could be listed but never opened.
 * Rows are now kept as `HealthRecordItem`s and handed to `ViewReportModal`,
 * which renders the stored document and downloads it.
 *
 * Props are unchanged — DoctorPanel mounts this component too.
 */

/** Old mock rows point at `/files/<name>`, which was never uploaded anywhere. */
function hasRealFile(url?: string | null): boolean {
  return !!url && !!url.trim() && !url.startsWith('/files/')
}

/** API rows are snake_case straight from Postgres; the viewer wants camelCase. */
function toRecordItem(r: any): HealthRecordItem {
  const meds = r.rx_medications || r.rxMedications || []
  return {
    id: r.id,
    patientId: r.patient_id || '',
    title: r.title || 'Clinical Evaluation',
    recordType: (r.record_type || r.recordType || 'prescription') as HealthRecordItem['recordType'],
    issuingAuthority: r.issuing_authority || r.issuingAuthority || 'MediQueue Doctor Console',
    date: r.created_at
      ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      : 'Recent',
    notes: r.notes || undefined,
    fileUrl: r.file_url || r.fileUrl || undefined,
    medications: Array.isArray(meds) ? meds : [],
  }
}

/** One-line summary of what was prescribed, falling back to the clinical notes. */
function summarise(record: HealthRecordItem): string {
  const meds = record.medications
  if (Array.isArray(meds) && meds.length > 0) {
    return meds
      .map((m: any) => `${m.name || m.medication || 'Medication'} (${m.dosage || '1 dose'}${m.freq || m.frequency ? `, ${m.freq || m.frequency}` : ''})`)
      .join(' · ')
  }
  return record.notes || 'Clinical consultation & prescription'
}

export default function PatientHistoryDrawer({
  isOpen,
  onClose,
  patientId,
  // Neutral placeholders. These defaulted to 'Nimal Silva' / '#A-11' — a name
  // from the old demo seed data — so any render that didn't pass a patient
  // showed a fabricated patient identity on a clinical history screen.
  patientName = 'Patient',
  patientToken = '—'
}: PatientHistoryDrawerProps) {
  const [records, setRecords] = useState<HealthRecordItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<HealthRecordItem | null>(null)

  useEffect(() => {
    async function loadRecords() {
      try {
        setLoading(true)
        const targetId = patientId || 'all'
        const url = `${API_BASE}/records/${targetId}${patientName ? `?patientName=${encodeURIComponent(patientName)}` : ''}`
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setRecords((data.records || []).map(toRecordItem))
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

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(6, 35, 33, 0.5)',
      backdropFilter: 'blur(8px)',
      display: 'flex', justifyContent: 'flex-end'
    }}>
      {/* Sits above the drawer's own z-index, so the document opens over it. */}
      <ViewReportModal
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        record={selectedRecord}
      />

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
                  Past Consultations ({records.length})
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {records.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', background: '#ffffff', borderRadius: 14, color: 'var(--text-4)', fontSize: 13, border: '1px solid var(--border-md)' }}>
                    No past health records or prescriptions found for this patient in the database.
                  </div>
                ) : (
                  records.map(record => {
                    const attached = hasRealFile(record.fileUrl)
                    return (
                      <button
                        key={record.id}
                        type="button"
                        onClick={() => setSelectedRecord(record)}
                        className="hover-lift"
                        style={{
                          textAlign: 'left', width: '100%', cursor: 'pointer', font: 'inherit',
                          padding: 16, background: '#ffffff', borderRadius: 14,
                          border: '1px solid var(--border-md)', boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>{record.title}</div>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            {attached && (
                              <span className="badge badge-blue" style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Paperclip size={10} /> File
                              </span>
                            )}
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--blue)' }}>
                              <Eye size={12} /> View
                            </span>
                          </span>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--blue-dark)', fontWeight: 600, marginBottom: 8 }}>
                          {record.issuingAuthority} · {record.recordType} · <span style={{ color: 'var(--text-4)' }}>{record.date}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <strong>Rx Prescribed:</strong> {summarise(record)}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
