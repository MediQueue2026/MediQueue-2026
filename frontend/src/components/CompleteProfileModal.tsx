import React, { useState, useEffect } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  HeartPulse,
  Phone,
  ShieldCheck,
  User,
  X
} from 'lucide-react'
import DateOfBirthInput from './DateOfBirthInput'
import type { PatientProfile } from '../types/patient'

interface CompleteProfileModalProps {
  isOpen: boolean
  onClose: () => void
  profile: PatientProfile
  onSave: (updatedProfile: Partial<PatientProfile>) => Promise<boolean>
}

const PHONE_PATTERN = /^\+?[\d\s-]{9,15}$/
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

export default function CompleteProfileModal({
  isOpen,
  onClose,
  profile,
  onSave
}: CompleteProfileModalProps) {
  const [phone, setPhone] = useState(profile.phone || '')
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth || '')
  const [gender, setGender] = useState(profile.gender || 'Male')
  const [bloodGroup, setBloodGroup] = useState(profile.bloodGroup || '')
  const [nic, setNic] = useState(profile.nic || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setPhone(profile.phone || '')
      setDateOfBirth(profile.dateOfBirth || '')
      setGender(profile.gender || 'Male')
      setBloodGroup(profile.bloodGroup || '')
      setNic(profile.nic || '')
      setError('')
    }
  }, [isOpen, profile])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const cleanPhone = phone.trim()
    if (!cleanPhone) {
      setError('Please provide your mobile phone number for queue SMS notifications.')
      return
    }
    if (!PHONE_PATTERN.test(cleanPhone)) {
      setError('Please enter a valid phone number (e.g. 0771234567 or +94771234567).')
      return
    }
    if (!dateOfBirth) {
      setError('Please provide your Date of Birth.')
      return
    }

    setSaving(true)
    try {
      const ok = await onSave({
        phone: cleanPhone,
        dateOfBirth,
        gender,
        bloodGroup: bloodGroup || undefined,
        nic: nic.trim() || undefined
      })
      if (ok) {
        onClose()
      } else {
        setError('Could not update profile details. Please try again.')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    height: 42,
    fontSize: 13.5,
    width: '100%',
    borderRadius: 8
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)'
      }}
    >
      <div
        className="glass-form-card"
        style={{
          width: '100%',
          maxWidth: 500,
          background: '#ffffff',
          borderRadius: 20,
          padding: '28px 24px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            background: 'rgba(0,0,0,0.05)',
            border: 'none',
            borderRadius: '50%',
            width: 30,
            height: 30,
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
            color: 'var(--text-3)'
          }}
        >
          <X size={16} />
        </button>

        {/* Header Tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 11.5,
              fontWeight: 700,
              color: '#059669'
            }}
          >
            <HeartPulse size={13} /> Essential Patient Information
          </span>
        </div>

        <h3
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: 'var(--text-1)',
            letterSpacing: '-0.02em',
            margin: '0 0 6px'
          }}
        >
          Complete Your Profile
        </h3>
        <p
          style={{
            fontSize: 12.5,
            color: 'var(--text-4)',
            margin: '0 0 18px',
            lineHeight: 1.5
          }}
        >
          Welcome! We noticed your account is missing key health and contact details.
          Providing your mobile number and medical info ensures accurate queue SMS alerts and doctor consultations.
        </p>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#dc2626',
              fontSize: 12.5,
              marginBottom: 16
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Mobile Number */}
          <div>
            <label
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--text-3)',
                display: 'block',
                marginBottom: 5,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
              htmlFor="cp-phone"
            >
              Mobile Number <span style={{ color: '#ef4444' }}>*</span>{' '}
              <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-4)' }}>
                (for real-time SMS queue token updates)
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <Phone
                size={14}
                color="var(--text-4)"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                id="cp-phone"
                className="input"
                type="tel"
                required
                placeholder="0771234567"
                value={phone}
                onChange={e => {
                  setPhone(e.target.value)
                  setError('')
                }}
                style={{ ...inputStyle, paddingLeft: 34 }}
              />
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <label
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--text-3)',
                display: 'block',
                marginBottom: 5,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
            >
              Date of Birth <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div
              style={{
                background: 'rgba(248, 250, 252, 0.75)',
                border: '1px solid var(--border-md, #e2e8f0)',
                borderRadius: 10,
                padding: '10px 12px'
              }}
            >
              <DateOfBirthInput
                value={dateOfBirth}
                onChange={val => {
                  setDateOfBirth(val)
                  setError('')
                }}
                idPrefix="cp-dob"
              />
            </div>
          </div>

          {/* Gender & Blood Group Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--text-3)',
                  display: 'block',
                  marginBottom: 5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                Gender
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setGender('Male')}
                  style={{
                    height: 40,
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: gender === 'Male' ? '2px solid var(--blue, #0D9488)' : '1px solid var(--border-md, #e2e8f0)',
                    background: gender === 'Male' ? 'rgba(13, 148, 136, 0.08)' : '#ffffff',
                    color: gender === 'Male' ? 'var(--blue, #0D9488)' : 'var(--text-2, #334155)',
                    fontWeight: gender === 'Male' ? 700 : 500,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}
                >
                  {gender === 'Male' && <CheckCircle2 size={13} />} Male
                </button>
                <button
                  type="button"
                  onClick={() => setGender('Female')}
                  style={{
                    height: 40,
                    borderRadius: 8,
                    cursor: 'pointer',
                    border: gender === 'Female' ? '2px solid #ec4899' : '1px solid var(--border-md, #e2e8f0)',
                    background: gender === 'Female' ? 'rgba(236, 72, 153, 0.08)' : '#ffffff',
                    color: gender === 'Female' ? '#db2777' : 'var(--text-2, #334155)',
                    fontWeight: gender === 'Female' ? 700 : 500,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}
                >
                  {gender === 'Female' && <CheckCircle2 size={13} />} Female
                </button>
              </div>
            </div>

            <div>
              <label
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--text-3)',
                  display: 'block',
                  marginBottom: 5,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
                htmlFor="cp-blood"
              >
                Blood Group
              </label>
              <select
                id="cp-blood"
                className="input"
                value={bloodGroup}
                onChange={e => setBloodGroup(e.target.value)}
                style={inputStyle}
              >
                <option value="">-- Select Blood Group --</option>
                {BLOOD_GROUPS.map(bg => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* NIC (Optional) */}
          <div>
            <label
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                color: 'var(--text-3)',
                display: 'block',
                marginBottom: 5,
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}
              htmlFor="cp-nic"
            >
              National Identity Card (NIC){' '}
              <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--text-4)' }}>
                (optional)
              </span>
            </label>
            <div style={{ position: 'relative' }}>
              <User
                size={14}
                color="var(--text-4)"
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                id="cp-nic"
                className="input"
                type="text"
                placeholder="e.g. 199512345678"
                value={nic}
                onChange={e => setNic(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 34 }}
              />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 10,
              paddingTop: 14,
              borderTop: '1px solid var(--border)'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost"
              style={{ fontSize: 13, color: 'var(--text-4)' }}
            >
              Skip for now
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ minWidth: 150, justifyContent: 'center', fontWeight: 700 }}
            >
              {saving ? 'Saving Details…' : 'Save & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
