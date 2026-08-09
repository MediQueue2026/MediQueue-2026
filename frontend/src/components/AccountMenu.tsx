import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, CloudOff, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import AnchoredMenu from './AnchoredMenu'
import { Avatar } from './UIPrimitives'

const ROLE_LABEL: Record<string, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  receptionist: 'Reception Staff',
  admin: 'System Administrator',
}

/**
 * Signed-in identity + sign-out, for the console headers.
 *
 * Shows who is actually signed in — the previous headers hardcoded "RE Staff",
 * which meant a receptionist and an admin looked identical on screen.
 */
export default function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  if (!user) return null

  const handleSignOut = async () => {
    setSigningOut(true)
    // Leave the console *before* clearing the session. Clearing first lets the
    // route guard fire on the page we're still standing on, which bounces the
    // user to that console's login screen — indistinguishable from a failed
    // sign-out. `logout()` lives on the context, so it still completes after
    // this component unmounts.
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
        <Avatar name={user.name} size={28} />
        {!compact && (
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
              {user.name}
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
        width={250}
      >
        <div style={{ padding: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
            <Avatar name={user.name} size={38} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-1)' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.email}
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, margin: '12px 0',
            fontSize: 11.5, fontWeight: 700, color: 'var(--blue-dark)',
          }}>
            <ShieldCheck size={13} /> {ROLE_LABEL[user.role ?? ''] ?? 'Signed in'}
          </div>

          {user.isDemo && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 12,
              fontSize: 11, lineHeight: 1.45, color: 'var(--amber)',
              background: 'var(--amber-dim)', border: '1px solid var(--amber-border)',
              borderRadius: 8, padding: '8px 10px',
            }}>
              <CloudOff size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              Demo mode — the backend is offline and nothing here is saved.
            </div>
          )}

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
