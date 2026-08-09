import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { HOME_PATH, useAuth } from '../context/AuthContext'
import type { UserRole } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: Exclude<UserRole, null>[]
  /** Which role's sign-in screen to send an anonymous visitor to. */
  loginPath?: string
}

/**
 * Gates a console behind a signed-in session with an allowed role.
 *
 * Waiting for `loading` matters: on a page reload the session is restored
 * asynchronously from the refresh cookie, so rendering the redirect immediately
 * would bounce an already-signed-in user to the login screen on every refresh.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  loginPath = '/login',
}) => {
  const { user, loading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{
        minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 12, background: 'var(--bg)',
      }}>
        <span className="pulse-live" />
        <span style={{ fontSize: 13, color: 'var(--text-4)', fontWeight: 600 }}>
          Restoring your session…
        </span>
      </div>
    )
  }

  if (!isAuthenticated) {
    // `state.from` lets the login screen return the user where they were headed.
    return <Navigate to={loginPath} replace state={{ from: location.pathname }} />
  }

  if (allowedRoles?.length && user?.role && !allowedRoles.includes(user.role)) {
    // Signed in, wrong console — send them to their own rather than to login,
    // which would look like their credentials failed.
    return <Navigate to={HOME_PATH[user.role]} replace />
  }

  return <>{children}</>
}
