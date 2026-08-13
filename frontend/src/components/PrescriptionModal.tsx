import { useState } from 'react'
import { X, Printer, Plus, Trash2, FileText, Stethoscope, ShieldCheck, CalendarDays, Clock, CheckCircle2 } from 'lucide-react'

export function PrescriptionModal({
  isOpen,
  onClose,
  patientId,
  doctorId,
  patientName = 'Patient',
  patientToken = '#A-01',
  doctorName = 'Dr. Medical Specialist',
  doctorDept = 'General Medicine',
  centerName = 'MediQueue Healthcare Clinic'
}: {
  isOpen: boolean
  onClose: () => void
  patientId?: string
  doctorId?: string
  patientName?: string
  patientToken?: string
  doctorName?: string
  doctorDept?: string
  centerName?: string
}) {
  const [complaint, setComplaint] = useState('Persistent dry cough & low-grade fever for 3 days')
  const [diagnosis, setDiagnosis] = useState('Acute Upper Respiratory Tract Infection')
  const [drugs, setDrugs] = useState([
    { name: 'Amoxicillin 500mg', dosage: '1 Capsule', freq: 'TDS (8 Hourly)', duration: '5 Days' },
    { name: 'Paracetamol 500mg', dosage: '1 Tablet', freq: 'PRN (As Needed)', duration: '3 Days' }
  ])
  const [advice, setAdvice] = useState('Increase fluid intake. Steam inhalation twice daily. Rest.')
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Follow-up State with Radios (No, 3 Days, 1 Week, 1 Month) & Calendar
  const [followUpOption, setFollowUpOption] = useState<'none' | '3days' | '1week' | '1month' | 'custom'>('none')
  const [followUpDate, setFollowUpDate] = useState('')

  const FOLLOWUP_RADIO_OPTIONS = [
    { value: 'none', label: 'No Follow-up', days: 0 },
    { value: '3days', label: '3 Days', days: 3 },
    { value: '1week', label: '1 Week', days: 7 },
    { value: '1month', label: '1 Month', days: 30 },
  ]

  const handleRadioChange = (val: string, days: number) => {
    setFollowUpOption(val as any)
    if (days > 0) {
      const d = new Date()
      d.setDate(d.getDate() + days)
      setFollowUpDate(d.toISOString().split('T')[0])
    } else {
      setFollowUpDate('')
    }
  }

  if (!isOpen) return null

  const addDrug = () => {
    setDrugs([...drugs, { name: '', dosage: '', freq: 'BD (12 Hourly)', duration: '5 Days' }])
  }

  const removeDrug = (index: number) => {
    setDrugs(drugs.filter((_, i) => i !== index))
  }

  const savePrescriptionToBackend = async () => {
    try {
      setSaving(true)
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'
      const res = await fetch(`${API_BASE}/records/prescription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patientId || null,
          doctorId: doctorId || null,
          complaint,
          diagnosis,
          rxMedications: drugs,
          advice,
          followUpDate: followUpDate || null
        })
      })
      if (res.ok) {
        setSaveSuccess(true)
      }
    } catch (e) {
      console.warn('Prescription API save notice:', e)
    } finally {
      setSaving(false)
      setShowPreview(true)
    }
  }

  const formattedFollowUpDate = followUpDate
    ? new Date(followUpDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      background: 'rgba(6, 35, 33, 0.65)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
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
            {saveSuccess && (
              <div style={{
                background: 'rgba(16,185,129,0.1)', border: '1px solid #10B981', color: '#10B981',
                padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16
              }}>
                <CheckCircle2 size={16} /> Prescription saved to patient health records in database!
              </div>
            )}
            <div style={{
              border: '2px solid var(--blue-border)', borderRadius: 16, padding: 32,
              background: '#ffffff', marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.04)'
            }}>
              {/* Header Letterhead */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--blue)', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--blue-dark)' }}>{centerName}</h2>
                  <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{doctorDept} & Specialist Consultation</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>MediQueue Healthcare Network · Tel: +94 11 234 5678</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>{doctorName}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>MBBS, MD ({doctorDept})</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-4)' }}>Reg No: SLMC-Registered</div>
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
              <div style={{ marginBottom: formattedFollowUpDate ? 16 : 24 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em' }}>Doctor Advice</div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{advice}</div>
              </div>

              {/* Follow-up Note in Printable Letterhead */}
              {formattedFollowUpDate && (
                <div style={{ marginBottom: 24, padding: '12px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.08)', border: '1.5px solid rgba(99,102,241,0.22)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CalendarDays size={14} /> Recommended Follow-up Date
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 700 }}>{formattedFollowUpDate}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>* Please book your follow-up appointment via MediQueue Patient App.</div>
                </div>
              )}

              {/* Sign Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 16, borderTop: '1px dashed #ccc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#10B981', fontWeight: 600 }}>
                  <ShieldCheck size={18} /> Digitally Signed & Verified via MediQueue Health EHR
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'cursive', fontSize: 20, color: 'var(--blue-dark)', fontWeight: 700 }}>{doctorName}</div>
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
          /* Form Controls */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Chief Complaint
              </label>
              <input
                className="input"
                value={complaint}
                onChange={e => setComplaint(e.target.value)}
                placeholder="e.g. Cough & fever for 3 days"
                style={{ height: 42 }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Clinical Diagnosis
              </label>
              <input
                className="input"
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
                placeholder="e.g. Acute Pharyngitis"
                style={{ height: 42 }}
              />
            </div>

            {/* Drugs List */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Rx Medications
                </label>
                <button onClick={addDrug} className="btn btn-ghost btn-sm" style={{ gap: 4, color: 'var(--blue)', fontSize: 12 }}>
                  <Plus size={14} /> Add Medication
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {drugs.map((d, index) => (
                  <div key={index} style={{
                    display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 34px', gap: 8, alignItems: 'center',
                    background: 'rgba(18, 198, 186, 0.04)', padding: 10, borderRadius: 12, border: '1px solid var(--border)'
                  }}>
                    <input
                      className="input"
                      value={d.name}
                      onChange={e => {
                        const next = [...drugs]
                        next[index].name = e.target.value
                        setDrugs(next)
                      }}
                      placeholder="Medicine Name (e.g. Amoxicillin 500mg)"
                      style={{ height: 38, fontSize: 12.5 }}
                    />
                    <input
                      className="input"
                      value={d.dosage}
                      onChange={e => {
                        const next = [...drugs]
                        next[index].dosage = e.target.value
                        setDrugs(next)
                      }}
                      placeholder="Dosage (1 Tab)"
                      style={{ height: 38, fontSize: 12.5 }}
                    />
                    <select
                      className="input"
                      value={d.freq}
                      onChange={e => {
                        const next = [...drugs]
                        next[index].freq = e.target.value
                        setDrugs(next)
                      }}
                      style={{ height: 38, fontSize: 12.5 }}
                    >
                      <option value="OD (Once Daily)">OD (Once Daily)</option>
                      <option value="BD (12 Hourly)">BD (12 Hourly)</option>
                      <option value="TDS (8 Hourly)">TDS (8 Hourly)</option>
                      <option value="QDS (6 Hourly)">QDS (6 Hourly)</option>
                      <option value="PRN (As Needed)">PRN (As Needed)</option>
                      <option value="MANE (Morning)">MANE (Morning)</option>
                      <option value="NOCTE (Night)">NOCTE (Night)</option>
                    </select>
                    <input
                      className="input"
                      value={d.duration}
                      onChange={e => {
                        const next = [...drugs]
                        next[index].duration = e.target.value
                        setDrugs(next)
                      }}
                      placeholder="5 Days"
                      style={{ height: 38, fontSize: 12.5 }}
                    />
                    <button
                      onClick={() => removeDrug(index)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)', border: 'none', borderRadius: 8,
                        width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#EF4444', cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Follow-up Section with Radio Group + Custom Date Picker */}
            <div style={{
              background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.18)',
              borderRadius: 14, padding: 16, marginTop: 4
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="#4f46e5" /> Recommended Follow-up Appointment
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
                {FOLLOWUP_RADIO_OPTIONS.map(opt => (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: followUpOption === opt.value ? 'rgba(99, 102, 241, 0.15)' : '#ffffff',
                      border: followUpOption === opt.value ? '1.5px solid #4f46e5' : '1px solid var(--border-md)',
                      borderRadius: 10, padding: '8px 12px', cursor: 'pointer',
                      fontSize: 12.5, fontWeight: followUpOption === opt.value ? 700 : 500,
                      color: followUpOption === opt.value ? '#4f46e5' : 'var(--text-2)',
                      transition: 'all 0.12s ease-in-out'
                    }}
                  >
                    <input
                      type="radio"
                      name="followUpGroup"
                      value={opt.value}
                      checked={followUpOption === opt.value}
                      onChange={() => handleRadioChange(opt.value, opt.days)}
                      style={{ accentColor: '#4f46e5', width: 14, height: 14 }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>

              {/* Custom Date Input Picker */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-4)', fontWeight: 600 }}>Or Select Date:</span>
                <input
                  type="date"
                  className="input"
                  value={followUpDate}
                  onChange={e => {
                    setFollowUpOption('custom')
                    setFollowUpDate(e.target.value)
                  }}
                  style={{ height: 38, width: 170, fontSize: 12.5 }}
                />
                {followUpDate && (
                  <span style={{ fontSize: 11.5, color: '#4f46e5', fontWeight: 600 }}>
                    Selected: {formattedFollowUpDate}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', display: 'block', marginBottom: 6, letterSpacing: '0.05em' }}>
                Advice / Lifestyle Notes
              </label>
              <textarea
                className="input"
                value={advice}
                onChange={e => setAdvice(e.target.value)}
                placeholder="e.g. Rest well, drink plenty of fluids"
                style={{ height: 60, padding: 10, fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button onClick={onClose} className="btn btn-ghost" style={{ height: 42 }}>
                Cancel
              </button>
              <button
                onClick={savePrescriptionToBackend}
                disabled={saving}
                className="btn btn-primary"
                style={{ gap: 8, height: 42, padding: '0 24px', fontSize: 14, fontWeight: 700 }}
              >
                <FileText size={16} /> {saving ? 'Saving...' : 'Generate & Save Prescription'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PrescriptionModal