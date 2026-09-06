import React, { useState } from 'react'
import { FileUp, X, Check, AlertCircle, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'
import { HealthRecordItem } from '../types/patient'
import { ApiError, api, validateHealthRecordFile } from '../lib/api'

interface UploadReportModalProps {
  isOpen: boolean
  onClose: () => void
  patientId: string
  onUploadSuccess: (newRecord: HealthRecordItem) => void
}

/**
 * Attaches a real document to the patient's health records.
 *
 * This used to fake it: the chosen file was never read, `fileUrl` was set to the
 * cosmetic string `/files/<name>`, and a setTimeout stood in for the request. The
 * row landed in `health_records` pointing at a path that had never existed, so
 * the viewer had nothing to open.
 *
 * Now it is two real calls, in order, because the second depends on the first:
 *
 *   1. POST /api/uploads  → puts the bytes in the `health-records` Supabase
 *      Storage bucket and returns the public URL.
 *   2. POST /api/records/upload → saves the row with that URL in `file_url`.
 *
 * They are separate stages in the UI as well as in the code: an upload that
 * succeeds and a save that fails leaves an orphaned file rather than a broken
 * row, and the message says which half went wrong.
 */

type Stage = 'idle' | 'uploading' | 'saving'

/** Wording for each stage of the two-step submit. */
const STAGE_LABEL: Record<Stage, string> = {
  idle: '',
  uploading: 'Uploading file…',
  saving: 'Saving record…',
}

export function UploadReportModal({ isOpen, onClose, patientId, onUploadSuccess }: UploadReportModalProps) {
  const [title, setTitle] = useState('')
  const [recordType, setRecordType] = useState<HealthRecordItem['recordType']>('lab_report')
  const [issuingAuthority, setIssuingAuthority] = useState('')
  const [notes, setNotes] = useState('')
  /** The actual File, not just its name — the whole point of the rewrite. */
  const [file, setFile] = useState<File | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState('')

  if (!isOpen) return null

  const submitting = stage !== 'idle'

  const resetAndClose = () => {
    setTitle('')
    setRecordType('lab_report')
    setIssuingAuthority('')
    setNotes('')
    setFile(null)
    setStage('idle')
    setError('')
    onClose()
  }

  /** Validate at selection time — a 12 MB file should be refused before the submit. */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0]
    if (!chosen) return

    const problem = validateHealthRecordFile(chosen)
    if (problem) {
      setFile(null)
      setError(problem)
      e.target.value = ''   // let them re-pick the same file after fixing it
      return
    }
    setError('')
    setFile(chosen)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please provide a report title.')
      return
    }
    if (!file) {
      setError('Please attach the report file (PDF, PNG or JPG).')
      return
    }
    // Re-check rather than trusting the flag set at selection time.
    const problem = validateHealthRecordFile(file)
    if (problem) {
      setError(problem)
      return
    }

    setError('')
    // Tracked locally as well as in state: `stage` in the catch below would still
    // hold the value from this render, so it can't say which call actually failed.
    let phase: 'uploading' | 'saving' = 'uploading'
    try {
      setStage('uploading')
      const uploaded = await api.uploadFile(file, 'health-records')

      phase = 'saving'
      setStage('saving')
      const { record } = await api.createHealthRecord({
        patientId,
        title: title.trim(),
        recordType,
        issuingAuthority: issuingAuthority.trim() || 'External Medical Lab',
        notes: notes.trim(),
        fileUrl: uploaded.fileUrl,
        mimeType: file.type,
        fileSize: file.size,
      })

      onUploadSuccess({
        id: record.id,
        patientId: record.patient_id ?? patientId,
        title: record.title,
        recordType: (record.record_type as HealthRecordItem['recordType']) ?? recordType,
        issuingAuthority: record.issuing_authority ?? 'External Medical Lab',
        date: record.created_at
          ? new Date(record.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
          : new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
        notes: record.notes ?? undefined,
        fileUrl: record.file_url ?? uploaded.fileUrl,
      })
      resetAndClose()
    } catch (err) {
      // Which stage failed is the useful part — the file may already be stored.
      const where = phase === 'uploading' ? 'Upload failed' : 'Could not save the record'
      setError(err instanceof ApiError ? `${where}: ${err.message}` : `${where}. Please try again.`)
      setStage('idle')
    }
  }

  const FileIcon = file?.type === 'application/pdf' ? FileText : ImageIcon

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
          <button onClick={resetAndClose} disabled={submitting} style={{ background: 'transparent', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', color: 'var(--text-4)', opacity: submitting ? 0.4 : 1 }}><X size={18} /></button>
        </div>

        {error && (
          <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px', background: 'var(--crimson-dim)', border: '1px solid var(--crimson-border)', borderRadius: 8, color: 'var(--crimson)', fontSize: 12, marginBottom: 14, lineHeight: 1.45 }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Report Title *</label>
            <input
              className="input"
              placeholder="e.g. Complete Blood Count (CBC) or Chest X-Ray"
              value={title}
              onChange={e => { setTitle(e.target.value); setError('') }}
              disabled={submitting}
              style={{ height: 42, fontSize: 13.5 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Category</label>
              <select
                className="input"
                value={recordType}
                onChange={e => setRecordType(e.target.value as HealthRecordItem['recordType'])}
                disabled={submitting}
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
                disabled={submitting}
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
              disabled={submitting}
              style={{ padding: 10, fontSize: 13 }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Attachment File (PDF, PNG, JPG) *</label>
            <div style={{
              border: `2px dashed ${file ? 'var(--blue)' : 'var(--border-md)'}`,
              borderRadius: 10, padding: 16, textAlign: 'center',
              background: file ? 'var(--blue-dim)' : '#fafafa',
              position: 'relative', transition: 'border-color 0.15s ease, background 0.15s ease',
            }}>
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                disabled={submitting}
                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: submitting ? 'not-allowed' : 'pointer' }}
              />
              <FileIcon size={24} color="var(--blue)" style={{ margin: '0 auto 6px' }} />
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)' }}>
                {file ? file.name : 'Click or drag file here to attach document'}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 2 }}>
                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · ready to upload` : 'Max file size 10MB'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', marginTop: 10 }}>
            {submitting && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}>
                <Loader2 size={13} style={{ animation: 'spin 0.9s linear infinite' }} /> {STAGE_LABEL[stage]}
              </span>
            )}
            <button type="button" onClick={resetAndClose} disabled={submitting} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={submitting} className="btn btn-primary" style={{ gap: 6, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'wait' : 'pointer' }}>
              <Check size={14} /> {submitting ? 'Working…' : 'Save Health Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
