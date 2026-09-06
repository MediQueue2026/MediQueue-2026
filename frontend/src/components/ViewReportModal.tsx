import { useEffect, useState } from 'react'
import { FileText, X, Download, ShieldCheck, Activity, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import { HealthRecordItem } from '../types/patient'

interface ViewReportModalProps {
  isOpen: boolean
  onClose: () => void
  record: HealthRecordItem | null
}

/**
 * Opens a stored health record: metadata, plus the actual document.
 *
 * The previous version rendered only the text fields and its "Download PDF"
 * button called `alert()`. Now the file at `file_url` is fetched and shown —
 * PDFs in an <object>, images inline — and downloading writes the real bytes.
 *
 * Rows with no `file_url` are expected, not an error: prescriptions written in
 * the Doctor Console are text-only, and the mock rows created before uploads
 * were real have a `/files/<name>` path that never existed. Both render the
 * metadata with an explanatory note where the document would be.
 */

type FileKind = 'pdf' | 'image' | 'other'

/**
 * Whether a record has a document that can actually be opened.
 *
 * Exported because the records list on the Patient Dashboard needs the same
 * answer before it offers a Download button. Old mock rows stored a cosmetic
 * `/files/<name>` path that was never uploaded anywhere.
 */
export function isRealFileUrl(url?: string): url is string {
  if (!url || !url.trim()) return false
  return !url.startsWith('/files/')
}

function fileKindOf(url: string): FileKind {
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)) return 'image'
  return 'other'
}

/** A filename for the download, derived from the report title rather than the hashed storage key. */
function downloadNameFor(record: HealthRecordItem, url: string): string {
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase() || 'pdf'
  const base = record.title.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_') || 'health_record'
  return `${base}.${extension}`
}

/**
 * Saves the record's file to disk.
 *
 * Fetched as a blob rather than using `<a download>`: the file lives on the
 * Supabase Storage origin, and a cross-origin `download` attribute is ignored by
 * browsers — the link would navigate to the file instead of saving it. The
 * bucket sends `access-control-allow-origin: *`, so the fetch is allowed.
 *
 * Throws on failure; callers decide how to report it.
 */
export async function downloadRecordFile(record: HealthRecordItem): Promise<void> {
  const url = record.fileUrl
  if (!isRealFileUrl(url)) throw new Error('This record has no attached file.')

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Storage returned ${res.status}`)
  const blob = await res.blob()

  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = downloadNameFor(record, url)
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export function ViewReportModal({ isOpen, onClose, record }: ViewReportModalProps) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  // Clear transient download state when a different record is opened.
  useEffect(() => {
    setDownloadError('')
    setDownloading(false)
  }, [record?.id])

  if (!isOpen || !record) return null

  const fileUrl = record.fileUrl
  const hasFile = isRealFileUrl(fileUrl)
  const kind = hasFile ? fileKindOf(fileUrl) : 'other'

  const handleDownload = async () => {
    if (!hasFile) return
    setDownloading(true)
    setDownloadError('')
    try {
      await downloadRecordFile(record)
    } catch {
      // Most likely the file was removed from the bucket, or the network failed.
      setDownloadError('Could not download the file. It may have been removed from storage.')
    } finally {
      setDownloading(false)
    }
  }

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

        {/* ── The document itself ── */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 6 }}>
            Attached Document
          </div>

          {!hasFile ? (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '12px 14px', background: '#fafafa',
              border: '1px dashed var(--border-md)', borderRadius: 10,
              fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.5,
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--text-4)' }} />
              <span>
                No file is attached to this record. Prescriptions issued in the Doctor
                Console are recorded as text, and records created before file uploads
                were enabled have no stored document.
              </span>
            </div>
          ) : kind === 'image' ? (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}>
              <img
                src={fileUrl}
                alt={record.title}
                style={{
                  width: '100%', maxHeight: 420, objectFit: 'contain',
                  borderRadius: 10, border: '1px solid var(--border-md)', background: '#fafafa',
                }}
              />
            </a>
          ) : kind === 'pdf' ? (
            <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-md)', background: '#fafafa' }}>
              {/* <object> degrades to its children when the browser has no PDF
                  viewer, which <iframe> does not do. */}
              <object data={fileUrl} type="application/pdf" width="100%" height="420">
                <div style={{ padding: 20, textAlign: 'center', fontSize: 12.5, color: 'var(--text-3)' }}>
                  This browser can't display PDFs inline.{' '}
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', fontWeight: 700 }}>
                    Open it in a new tab
                  </a>{' '}
                  or use Download below.
                </div>
              </object>
            </div>
          ) : (
            <div style={{ padding: '12px 14px', background: '#fafafa', border: '1px solid var(--border-md)', borderRadius: 10, fontSize: 12.5, color: 'var(--text-3)' }}>
              This file type can't be previewed. Use Download to open it.
            </div>
          )}

          {downloadError && (
            <div role="alert" style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
              padding: '9px 11px', background: 'var(--crimson-dim)',
              border: '1px solid var(--crimson-border)', borderRadius: 8,
              color: 'var(--crimson)', fontSize: 12, fontWeight: 600,
            }}>
              <AlertCircle size={13} /> {downloadError}
            </div>
          )}
        </div>

        {/* ── Record metadata ── */}
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
              const meds = (record as any).rxMedications || record.medications || (record as any).rx_medications
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
          {hasFile && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              style={{ gap: 6, textDecoration: 'none' }}
            >
              <ExternalLink size={14} /> Open in new tab
            </a>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={!hasFile || downloading}
            title={hasFile ? undefined : 'This record has no attached file'}
            className="btn btn-primary"
            style={{ gap: 6, opacity: !hasFile || downloading ? 0.5 : 1, cursor: !hasFile ? 'not-allowed' : downloading ? 'wait' : 'pointer' }}
          >
            {downloading
              ? <><Loader2 size={14} style={{ animation: 'spin 0.9s linear infinite' }} /> Downloading…</>
              : <><Download size={14} /> Download</>}
          </button>
        </div>
      </div>
    </div>
  )
}
