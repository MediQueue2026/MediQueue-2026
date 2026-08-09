import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import PatientDashboard from './pages/PatientDashboard'
import DoctorPanel from './pages/DoctorPanel'
import ReceptionistDesk from './pages/ReceptionistDesk'
import AdminPanel from './pages/AdminPanel'
import TvDisplayPage from './pages/TvDisplayPage'
import LoginPage from './pages/auth/LoginPage'
import { DevNavbar } from './components/DevNavbar'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div style={{ paddingTop: 52 }}>
          <DevNavbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />

            {/* Sign-in — one screen, four portals. Public by design. */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/login/doctor" element={<LoginPage forcedRole="doctor" />} />
            <Route path="/login/receptionist" element={<LoginPage forcedRole="receptionist" />} />
            <Route path="/login/admin" element={<LoginPage forcedRole="admin" />} />

            {/* Consoles — each one requires a session with a matching role. An
                admin is allowed everywhere so support staff can reproduce an
                issue from the desk or the doctor's panel. */}
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
                <ProtectedRoute allowedRoles={['doctor', 'admin']} loginPath="/login/doctor">
                  <DoctorPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/receptionist/*"
              element={
                <ProtectedRoute allowedRoles={['receptionist', 'admin']} loginPath="/login/receptionist">
                  <ReceptionistDesk />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRoles={['admin']} loginPath="/login/admin">
                  <AdminPanel />
                </ProtectedRoute>
              }
            />

            {/* Waiting-room board — deliberately public so it can run on a TV
                with no one signed in. Shows tokens only, never patient records. */}
            <Route path="/tv-display" element={<TvDisplayPage />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}
