import React, { createContext, useContext, useState, useEffect } from 'react'

export type UserRole = 'patient' | 'doctor' | 'receptionist' | 'admin' | null

interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

interface AuthContextType {
  user: User | null
  login: (email: string, role: UserRole) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('mediqueue_user')
    return saved ? JSON.parse(saved) : null
  })

  const login = (email: string, role: UserRole) => {
    const mockUsers: Record<string, { id: string; name: string }> = {
      patient: { id: '#P-4821', name: 'Rajan Mehta' },
      doctor: { id: '#DOC-04', name: 'Dr. Ethan Carr' },
      receptionist: { id: '#REC-01', name: 'Chamari Silva' },
      admin: { id: '#ADM-99', name: 'System Admin' },
    }

    const roleInfo = mockUsers[role || 'patient'] || { id: '#USR-01', name: 'User' }
    const newUser: User = {
      id: roleInfo.id,
      name: roleInfo.name,
      email,
      role
    }

    setUser(newUser)
    localStorage.setItem('mediqueue_user', JSON.stringify(newUser))
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('mediqueue_user')
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
