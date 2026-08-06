import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import PatientDashboard from './pages/PatientDashboard'
import DoctorPanel from './pages/DoctorPanel'
import ReceptionistDesk from './pages/ReceptionistDesk'
import AdminPanel from './pages/AdminPanel'
import TvDisplayPage from './pages/TvDisplayPage'
import { DevNavbar } from './components/DevNavbar'

export default function App() {
  return (
    <Router>
      <div style={{ paddingTop: 42 }}>
        <DevNavbar />
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/patient/*" element={<PatientDashboard />} />
          <Route path="/doctor/*" element={<DoctorPanel />} />
          <Route path="/receptionist/*" element={<ReceptionistDesk />} />
          <Route path="/admin/*" element={<AdminPanel />} />
          <Route path="/tv-display" element={<TvDisplayPage />} />
        </Routes>
      </div>
    </Router>
  )
}
