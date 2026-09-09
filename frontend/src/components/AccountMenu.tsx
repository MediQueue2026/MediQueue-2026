import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, CloudOff, CreditCard, LogOut, Mail, Phone, Settings, Stethoscope, Tag, User } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AnchoredMenu from './AnchoredMenu'
import { Avatar } from './UIPrimitives'

const ROLE_LABEL: Record<string, string> = {
  patient: 'Patient Portal',
  doctor: 'Doctor Console',
  receptionist: 'Reception Desk',
  admin: 'System Administrator',
}

interface AccountMenuProps {
  compact?: boolean
  phone?: string
  nic?: string
  specialization?: string
  series?: string
  onEditProfile?: () => void
}

export default function AccountMenu({ compact = false, phone, nic, specialization, series, onEditProfile }: AccountMenuProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  if (!user) return null

  const isDoctor = user.role === 'doctor' || Boolean(specialization || series)
  const isPatient = user.role === 'patient' || Boolean(phone || nic || onEditProfile)
  const displayName = (user as any)?.full_name || user.name || 'User Profile'
  const displayPhone = phone || (user as any)?.phone || ''
  const displayNic = nic || ''
  const displaySpec = specialization || (user as any)?.specialization || (user as any)?.dept || 'General Medicine'
  const displaySeries = series || (user as any)?.series || 'A'

  const handleSignOut = async () => {
    setSigningOut(true)
    navigate('/', { replace: true })
    await logout()
  }

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
          background: open ? 'rgba(18, 198, 186, 0.10)' : 'transparent',
          border: '1px solid', borderColor: open ? 'var(--blue-border)' : 'transparent',
          borderRadius: 9, padding: '3px 7px 3px 3px', flexShrink: 0,
        }}
      >
        <Avatar name={displayName} size={28} />
        {!compact && (
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-4)', whiteSpace: 'nowrap' }}>
              {ROLE_LABEL[user.role ?? ''] ?? 'Signed in'}
            </div>
          </div>
        )}
        <ChevronDown size={13} color="var(--text-4)" />
      </button>

      <AnchoredMenu
        anchorRef={buttonRef}
        open={open}
        onClose={() => setOpen(false)}
        width={270}
      >
        <div style={{ padding: 8 }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
            <Avatar name={displayName} size={38} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
              <div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 600 }}>
                {ROLE_LABEL[user.role ?? ''] ?? 'User Profile'}
              </div>
            </div>
          </div>

          {/* Profile details list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '10px 0', padding: '8px 10px', background: 'rgba(0,0,0,0.02)', borderRadius: 8, border: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
              <User size={13} color="var(--blue)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>Name:</span>
              <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{displayName}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
              <Mail size={13} color="var(--blue)" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>Email:</span>
              <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }} title={user.email}>{user.email}</span>
            </div>

            {isDoctor && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
                  <Stethoscope size={13} color="var(--blue)" style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>Specialization:</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>{displaySpec}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
                  <Tag size={13} color="var(--blue)" style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>Series:</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 700, color: 'var(--blue-dark)', background: 'var(--blue-dim)', border: '1px solid var(--blue-border)', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>
                    Series #{displaySeries}
                  </span>
                </div>
              </>
            )}

            {isPatient && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
                  <Phone size={13} color="var(--blue)" style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>Mobile:</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600, color: displayPhone ? 'var(--text-1)' : 'var(--text-4)' }}>{displayPhone || 'Not set'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-2)' }}>
                  <CreditCard size={13} color="var(--blue)" style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600 }}>NIC:</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600, color: displayNic ? 'var(--text-1)' : 'var(--text-4)' }}>{displayNic || 'Not set'}</span>
                </div>
              </>
            )}
          </div>

          {user.isDemo && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 8,
              fontSize: 11, lineHeight: 1.45, color: 'var(--amber)',
              background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
              borderRadius: 8, padding: '6px 8px',
            }}>
              <CloudOff size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              Demo mode — backend data state active.
            </div>
          )}

          {/* Edit Profile Action */}
          {onEditProfile && (
            <button
              onClick={() => {
                setOpen(false)
                onEditProfile()
              }}
              className="btn btn-sm"
              style={{ width: '100%', justifyContent: 'center', gap: 6, marginBottom: 6, background: 'var(--blue-dim)', color: 'var(--blue-dark)', border: '1px solid var(--blue-border)', fontWeight: 700 }}
            >
              <Settings size={13} /> Edit Profile
            </button>
          )}

          {/* Sign Out Action */}
          <button
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', justifyContent: 'center', gap: 6, color: 'var(--crimson)' }}
          >
            <LogOut size={13} /> {signingOut ? 'Signing out…' : 'Sign Out'}
          </button>
        </div>
      </AnchoredMenu>
    </>
  )
}
