import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Settings, Wrench } from 'lucide-react';

export const GlobalMaintenanceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check maintenance mode on mount and when location changes
    const checkMaintenance = async () => {
      try {
        const res = await api.getPublicSettings();
        setMaintenanceMode(res.settings?.maintenance_mode || false);
      } catch (err) {
        console.error('Failed to check maintenance mode', err);
      } finally {
        setLoading(false);
      }
    };
    checkMaintenance();
  }, [location.pathname]);

  // Admin bypass: Admins can always access the site
  if (user?.role === 'admin') {
    return <>{children}</>;
  }

  // Allow access to admin login specifically
  if (location.pathname === '/login/admin') {
    return <>{children}</>;
  }

  // Show maintenance screen if active
  if (!loading && maintenanceMode) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #062321, #0f4b46)',
        color: 'white',
        padding: 24,
        textAlign: 'center'
      }}>
        <div className="glass-form-card fade-in" style={{
          maxWidth: 500,
          width: '100%',
          padding: '48px 32px',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 24,
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)'
        }}>
          <Wrench size={56} color="#12c6ba" style={{ margin: '0 auto 24px', opacity: 0.9 }} />
          <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 12, letterSpacing: '-0.02em' }}>
            System Under Maintenance
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: 32 }}>
            The MediQueue platform is currently undergoing scheduled maintenance to improve reliability and performance. We'll be back online shortly.
          </p>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(18, 198, 186, 0.15)',
            color: '#12c6ba',
            padding: '10px 16px',
            borderRadius: 100,
            fontSize: 14,
            fontWeight: 600
          }}>
            <Settings size={16} className="spin" /> Work in progress...
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
