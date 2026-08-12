import { useState } from 'react'
import { X, Printer, Plus, Trash2, FileText, Stethoscope, ShieldCheck } from 'lucide-react'

export function PrescriptionModal({ isOpen, onClose, patientName = 'Nimal Silva', patientToken = '#A-11' }: {
  isOpen: boolean
  onClose: () => void
  patientName?: string
  patientToken?: string
}) {
  const [complaint, setComplaint] = useState('Persistent dry cough & low-grade fever for 3 days')
  const [diagnosis, setDiagnosis] = useState('Acute Upper Respiratory Tract Infection')
  const [drugs, setDrugs] = useState([
    { name: 'Amoxicillin 500mg', dosage: '1 Capsule', freq: 'TDS (8 Hourly)', duration: '5 Days' },
    { name: 'Paracetamol 500mg', dosage: '1 Tablet', freq: 'PRN (As Needed)', duration: '3 Days' }
  ])
  const [advice, setAdvice] = useState('Increase fluid intake. Steam inhalation twice daily. Rest.')
  const [showPreview, setShowPreview] = useState(false)

  if (!isOpen) return null

  const addDrug = () => {
    setDrugs([...drugs, { name: '', dosage: '', freq: 'BD (12 Hourly)', duration: '5 Days' }])
  }

  const removeDrug = (index: number) => {
    setDrugs(drugs.filter((_, i) => i !== index))
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
        width: '100%', maxWidth: showPreview ? 820 : 680, maxHeight: '90vh',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(18, 198, 186, 0.28)',
        borderRadius: 20, padding: '36px 32px',
        boxShadow: '0 20px 60px rgba(8, 48, 45, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, pb: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'var(--blue-dim)', border: '1px solid var(--blue-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--blue)'
            }}>
              <FileText size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
                {showPreview ? 'Medical Prescription Preview' : 'Digital Prescription Generator'}
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

        {showPreview ? (
          /* Printable Prescription Preview */
          <div>
            <div style={{
              border: '2px solid var(--blue-border)', borderRadius: 16, padding: 32,
              background: '#ffffff', marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
            }}>
              {/* Header Letterhead */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--blue)', pb: 16, marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--blue-dark)' }}>MediQueue Healthcare Clinic</h2>
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>General Medicine & Specialist Consultation</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>124 Hospital Road, Colombo 07 · Tel: +94 11 234 5678</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>Dr. Ethan Carr</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>MBBS, MD (General Medicine)</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>Reg No: SLMC-48291</div>
                </div>
              </div>

              {/* Patient details line */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, background: 'rgba(18, 198, 186, 0.08)', padding: '12px 16px', borderRadius: 10, fontSize: 13, marginBottom: 20 }}>
                <div><strong>Patient:</strong> {patientName}</div>
                <div><strong>Age/Gender:</strong> 47y / Male</div>
                <div><strong>Token:</strong> {patientToken}</div>
                <div><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
              </div>

              {/* Clinical Notes */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Diagnosis</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{diagnosis}</div>
              </div>

              {/* Rx Medication Table */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--blue)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Stethoscope size={18} /> Rx (Medications)
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(18, 198, 186, 0.1)', textAlign: 'left' }}>
                      <th style={{ padding: 10 }}>Medication</th>
                      <th style={{ padding: 10 }}>Dosage</th>
                      <th style={{ padding: 10 }}>Frequency</th>
                      <th style={{ padding: 10 }}>Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drugs.map((d, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: 10, fontWeight: 700 }}>{d.name}</td>
                        <td style={{ padding: 10 }}>{d.dosage}</td>
                        <td style={{ padding: 10 }}>{d.freq}</td>
                        <td style={{ padding: 10 }}>{d.duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Advice */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Doctor Advice</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{advice}</div>
              </div>

              {/* Sign Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16, borderTop: '1px dashed #ccc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#10B981', fontWeight: 600 }}>
                  <ShieldCheck size={18} /> Digitally Signed & Verified via MediQueue Health EHR
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'cursive', fontSize: 20, color: 'var(--blue-dark)', fontWeight: 700 }}>Dr. Ethan Carr</div>
                  <div style={{ fontSize: 10.5, color: 'var(--text-4)' }}>Doctor Signature</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPreview(false)} className="btn btn-ghost" style={{ height: 42 }}>
                Back to Edit
              </button>
              <button onClick={() => window.print()} className="btn btn-primary" style={{ gap: 8, height: 42, padding: '0 20px', fontSize: 14 }}>
                <Printer size={16} /> Print / Export PDF
              </button>
            </div>
          </div>
        ) : (
          /* Form View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Chief Complaint
              </label>
              <input className="input" value={complaint} onChange={e => setComplaint(e.target.value)} style={{ height: 44, fontSize: 14 }} />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Clinical Diagnosis
              </label>
              <input className="input" value={diagnosis} onChange={e => setDiagnosis(e.target.value)} style={{ height: 44, fontSize: 14 }} />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Prescribed Medications (Rx)
                </label>
                <button onClick={addDrug} className="btn btn-sm btn-ghost" style={{ gap: 4, fontSize: 11.5 }}>
                  <Plus size={14} /> Add Drug
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {drugs.map((d, i) => (
                  <div key={i} className="form-responsive-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.2fr 1fr 36px', gap: 8, alignItems: 'center' }}>
                    <input
                      className="input"
                      placeholder="Drug Name"
                      value={d.name}
                      onChange={e => {
                        const copy = [...drugs]
                        copy[i].name = e.target.value
                        setDrugs(copy)
                      }}
                      style={{ height: 40, fontSize: 13 }}
                    />
                    <input
                      className="input"
                      placeholder="Dosage"
                      value={d.dosage}
                      onChange={e => {
                        const copy = [...drugs]
                        copy[i].dosage = e.target.value
                        setDrugs(copy)
                      }}
                      style={{ height: 40, fontSize: 13 }}
                    />
                    <input
                      className="input"
                      placeholder="Frequency"
                      value={d.freq}
                      onChange={e => {
                        const copy = [...drugs]
                        copy[i].freq = e.target.value
                        setDrugs(copy)
                      }}
                      style={{ height: 40, fontSize: 13 }}
                    />
                    <input
                      className="input"
                      placeholder="Duration"
                      value={d.duration}
                      onChange={e => {
                        const copy = [...drugs]
                        copy[i].duration = e.target.value
                        setDrugs(copy)
                      }}
                      style={{ height: 40, fontSize: 13 }}
                    />
                    <button onClick={() => removeDrug(i)} className="btn btn-ghost btn-icon" style={{ color: 'var(--crimson)', height: 40 }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Advice & Instructions
              </label>
              <textarea className="input" rows={3} value={advice} onChange={e => setAdvice(e.target.value)} style={{ fontSize: 14 }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button onClick={onClose} className="btn btn-ghost" style={{ height: 42 }}>Cancel</button>
              <button onClick={() => setShowPreview(true)} className="btn btn-primary" style={{ height: 42, padding: '0 20px', fontSize: 14 }}>
                Preview & Print PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PrescriptionModal


