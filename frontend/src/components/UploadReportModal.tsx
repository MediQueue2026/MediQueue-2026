import React, { useState } from 'react'
import { FileUp, X, Check, AlertCircle } from 'lucide-react'
import { HealthRecordItem } from '../types/patient'

interface UploadReportModalProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  onUploadSuccess: (newRecord: HealthRecordItem) => void
}

export function UploadReportModal({ isOpen, onClose, patientId, onUploadSuccess }: UploadReportModalProps) {
  const [title, setTitle] = useState('')
  const [recordType, setRecordType] = useState<HealthRecordItem['recordType']>('lab_report')
  const [issuingAuthority, setIssuingAuthority] = useState('')
  const [notes, setNotes] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please provide a report title.')
      return
    }
    setError('')
    setSubmitting(true)

    setTimeout(() => {
      const createdRecord: HealthRecordItem = {
        id: `rec_${Date.now()}`,
        patientId,
        title,
        recordType,
        issuingAuthority: issuingAuthority.trim() || 'External Medical Lab',
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        notes,
        fileUrl: fileName ? `/files/${fileName}` : undefined,
      }

      onUploadSuccess(createdRecord)
      setSubmitting(false)
      onClose()
    }, 600)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(7, 21, 20, 0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div className="card glass-form-card" style={{
        width: '100%', maxWidth: 520, background: '#ffffff', borderRadius: 16,
        padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.25)', position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue)' }}>
              <FileUp size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>Upload Diagnostic & Health Report</h3>
              <p style={{ fontSize: 11.5, color: 'var(--text-4)', margin: 0 }}>Add lab results, X-Rays, or medical certificates to your profile</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-4)' }}><X size={18} /></button>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--crimson-dim)', border: '1px solid var(--crimson-border)', borderRadius: 8, color: 'var(--crimson)', fontSize: 12, marginBottom: 14 }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Report Title *</label>
            <input
              className="input"
              placeholder="e.g. Complete Blood Count (CBC) or Chest X-Ray"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ height: 42, fontSize: 13.5 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Category</label>
              <select
                className="input"
                value={recordType}
                onChange={e => setRecordType(e.target.value as any)}
                style={{ height: 42, fontSize: 13.5 }}
              >
                <option value="lab_report">Lab Report</option>
                <option value="ecg">ECG Scan</option>
                <option value="xray">X-Ray / Imaging</option>
                <option value="prescription">Prescription Copy</option>
                <option value="general">General Medical Report</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Issuing Lab / Hospital</label>
              <input
                className="input"
                placeholder="e.g. Central Diagnostics"
                value={issuingAuthority}
                onChange={e => setIssuingAuthority(e.target.value)}
                style={{ height: 42, fontSize: 13.5 }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Clinical Notes & Observations</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Add key test results or doctor comments..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ padding: 10, fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Attachment File (PDF, PNG, JPG)</label>
            <div style={{ border: '2px dashed var(--border-md)', borderRadius: 10, padding: 16, textAlign: 'center', background: '#fafafa', position: 'relative' }}>
              <input type="file" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
              <FileUp size={24} color="var(--blue)" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>{fileName ? `Attached: ${fileName}` : 'Click or drag file here to attach document'}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 2 }}>Max file size 10MB</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ gap: 6 }}>
              <Check size={14} /> {submitting ? 'Saving...' : 'Save Health Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
