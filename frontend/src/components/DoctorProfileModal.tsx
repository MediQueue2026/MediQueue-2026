import { X, Award, ShieldCheck, Stethoscope, Calendar, CheckCircle2 } from 'lucide-react'
import type { ApiDoctor } from '../lib/api'

interface DoctorProfileModalProps {
  doctor: (ApiDoctor & { spec?: string | null }) | any
  isOpen: boolean
  onClose: () => void
}

export default function DoctorProfileModal({
  doctor,
  isOpen,
  onClose,
}: DoctorProfileModalProps) {
  if (!isOpen || !doctor) return null

  const experience = doctor.yearsOfExperience ?? (
    doctor.experienceStartYear
      ? Math.max(0, new Date().getFullYear() - Number(doctor.experienceStartYear))
      : null
  )

  const doctorSpecialization = (doctor as any).spec || doctor.specialization || doctor.dept || 'General Medicine'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(6, 35, 33, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="fade-in modal-card"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430, maxHeight: '90vh',
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(18, 198, 186, 0.28)',
          borderRadius: 22, padding: '28px 24px 24px',
          boxShadow: '0 24px 64px rgba(8,48,45,0.2), inset 0 1px 0 rgba(255,255,255,0.8)',
          position: 'relative', overflowY: 'auto',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Close"
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(18,198,186,0.1)', border: '1px solid rgba(18,198,186,0.22)',
            borderRadius: '50%', width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-2)', cursor: 'pointer',
          }}
        >
          <X size={17} />
        </button>

        {/* Doctor Header Profile */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 20 }}>
          <div style={{
            position: 'relative',
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #10B981, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 26, fontWeight: 900,
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.28)',
            marginBottom: 12,
          }}>
            <Stethoscope size={34} color="#fff" />
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              background: '#fff', borderRadius: '50%', padding: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CheckCircle2 size={18} color="#10B981" fill="#ecfdf5" />
            </div>
          </div>

          <h3 style={{ fontSize: 21, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.02em', margin: 0 }}>
            {doctor.name.startsWith('Dr.') ? doctor.name : `Dr. ${doctor.name}`}
          </h3>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            marginTop: 6, padding: '4px 12px', borderRadius: 999,
            background: 'rgba(18, 198, 186, 0.1)', border: '1px solid rgba(18, 198, 186, 0.25)',
            color: '#0d9488', fontSize: 12.5, fontWeight: 700,
          }}>
            <span>{doctorSpecialization}</span>
          </div>
        </div>

        {/* Details Card */}
        <div style={{
          background: 'rgba(248, 250, 252, 0.9)',
          border: '1px solid rgba(226, 232, 240, 0.95)',
          borderRadius: 16,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {/* Specialization */}
          <div style={detailRowStyle}>
            <div style={iconBoxStyle}>
              <Stethoscope size={16} color="#0d9488" />
            </div>
            <span style={labelStyle}>Specialization:</span>
            <span style={valueStyle}>{doctorSpecialization}</span>
          </div>

          {/* SLMC Registration No */}
          <div style={detailRowStyle}>
            <div style={iconBoxStyle}>
              <ShieldCheck size={16} color="#2563eb" />
            </div>
            <span style={labelStyle}>SLMC Reg. No:</span>
            <span style={valueStyle}>{doctor.slmcRegNo || '—'}</span>
          </div>

          {/* Qualifications */}
          <div style={detailRowStyle}>
            <div style={iconBoxStyle}>
              <Award size={16} color="#d97706" />
            </div>
            <span style={labelStyle}>Qualifications:</span>
            <span style={valueStyle}>{doctor.qualifications || '—'}</span>
          </div>

          {/* Years of Experience */}
          <div style={detailRowStyle}>
            <div style={iconBoxStyle}>
              <Calendar size={16} color="#10B981" />
            </div>
            <span style={labelStyle}>Years of Experience:</span>
            <span style={valueStyle}>
              {experience !== null && experience !== undefined
                ? `${experience} Years${doctor.experienceStartYear ? ` (Since ${doctor.experienceStartYear})` : ''}`
                : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const detailRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 13.5,
  lineHeight: 1.4,
}

const iconBoxStyle: React.CSSProperties = {
  width: 22,
  height: 22,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}

const labelStyle: React.CSSProperties = {
  color: 'var(--text-3)',
  fontWeight: 600,
  minWidth: 155,
  flexShrink: 0,
}

const valueStyle: React.CSSProperties = {
  color: 'var(--text-1)',
  fontWeight: 800,
  flex: 1,
  wordBreak: 'break-word',
}
