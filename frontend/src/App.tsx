import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import PatientDashboard from './pages/PatientDashboard'
import DoctorPanel from './pages/DoctorPanel'
import ReceptionistDesk from './pages/ReceptionistDesk'
import AdminPanel from './pages/AdminPanel'
import TvDisplayPage from './pages/TvDisplayPage'

import PatientLoginPage from './pages/auth/PatientLoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import StaffLoginPage from './pages/auth/StaffLoginPage'
import MedicalCenterSignupPage from './pages/auth/MedicalCenterSignupPage'
import AdminLoginPage from './pages/auth/AdminLoginPage'

import { DevNavbar } from './components/DevNavbar'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { GlobalMaintenanceGate } from './components/GlobalMaintenanceGate'

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div style={{ paddingTop: 46 }}>
          <DevNavbar />
          <GlobalMaintenanceGate>
            <Routes>
              <Route path="/" element={<LandingPage />} />

              {/* Patient Auth Portals */}
              <Route path="/login" element={<PatientLoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Healthcare Staff Auth Portals */}
              <Route path="/staff/login" element={<StaffLoginPage />} />
              <Route path="/staff/login/doctor" element={<StaffLoginPage />} />
              <Route path="/staff/login/receptionist" element={<StaffLoginPage />} />
              <Route path="/staff/register/medical-center" element={<MedicalCenterSignupPage />} />

              {/* Legacy staff login redirects */}
              <Route path="/login/doctor" element={<Navigate to="/staff/login" replace />} />
              <Route path="/login/receptionist" element={<Navigate to="/staff/login" replace />} />
              <Route path="/login/admin" element={<Navigate to="/admin/login" replace />} />

              {/* Isolated System Admin Portal */}
              <Route path="/admin/login" element={<AdminLoginPage />} />

              {/* Protected Consoles */}
              <Route
                path="/patient/*"
                element={
                  <ProtectedRoute allowedRoles={['patient', 'admin']} loginPath="/login">
                    <PatientDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor/*"
                element={
                  <ProtectedRoute allowedRoles={['doctor', 'admin']} loginPath="/staff/login">
                    <DoctorPanel />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/receptionist/*"
                element={
                  <ProtectedRoute allowedRoles={['receptionist', 'admin']} loginPath="/staff/login">
                    <ReceptionistDesk />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/*"
                element={
                  <ProtectedRoute allowedRoles={['admin']} loginPath="/admin/login">
                    <AdminPanel />
                  </ProtectedRoute>
                }
              />

              {/* Waiting-room board TV display */}
              <Route path="/tv-display" element={<TvDisplayPage />} />
            </Routes>
          </GlobalMaintenanceGate>
        </div>
      </Router>
    </AuthProvider>
  )
}
