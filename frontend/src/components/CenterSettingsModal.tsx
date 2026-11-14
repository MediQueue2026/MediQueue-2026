import React, { useState, useEffect } from 'react';
import {
  X, Check, AlertCircle, RefreshCw, Tv, Printer,
  ShieldCheck, Smartphone, ExternalLink, Key,
  Sparkles, Sliders, MonitorCheck, Copy, CheckCheck,
  Globe, EyeOff, ArrowRight, ArrowLeft, Receipt,
  Building2, Lock, Info, CheckCircle2
} from 'lucide-react';
import { api, type ApiCenterSettings, type ApiCenterDevice } from '../lib/api';

interface CenterSettingsModalProps {
  centerId: string;
  centerName: string;
  isOpen: boolean;
  onClose: () => void;
  canEditPlan?: boolean; // Super admin can change plan; receptionist adjusts printer/devices
}

export default function CenterSettingsModal({
  centerId,
  centerName,
  isOpen,
  onClose,
  canEditPlan = true,
}: CenterSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'modules' | 'printer' | 'devices'>('modules');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Center Settings State
  const [settings, setSettings] = useState<ApiCenterSettings>({
    center_id: centerId,
    plan: 'standard',
    is_listed_publicly: true,
    features: {
      walk_in_tokens: true,
      online_booking: true,
      health_records: true,
      sms_notifications: true,
      tv_display: true,
      kiosk_checkin: false,
      billing_invoicing: false,
      pharmacy_inventory: false,
    },
    custom_branding: {
      logo_url: null,
      accent_color: '#0D9488',
      ticket_header: 'MediQueue Clinic Token',
      ticket_footer: 'Thank you for waiting patiently',
    },
    printer_config: {
      auto_print: false,
      paper_width: '80mm',
    },
  });

  // Devices & Pairing State
  const [devices, setDevices] = useState<ApiCenterDevice[]>([]);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [latestPairingCode, setLatestPairingCode] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !centerId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setCopiedCode(false);

    Promise.all([
      api.getCenterSettings(centerId).catch(err => {
        console.warn('Could not load center settings:', err);
        return null;
      }),
      api.getCenterDevices(centerId).catch(err => {
        console.warn('Could not load devices:', err);
        return null;
      }),
    ]).then(([settingsRes, devicesRes]) => {
      if (cancelled) return;
      if (settingsRes?.settings) {
        setSettings(settingsRes.settings);
      }
      if (devicesRes?.devices) {
        setDevices(devicesRes.devices);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, centerId]);

  if (!isOpen) return null;

  const handlePlanChange = (newPlan: ApiCenterSettings['plan']) => {
    const updatedFeatures = { ...settings.features };
    if (newPlan === 'listing_only') {
      updatedFeatures.walk_in_tokens = false;
      updatedFeatures.online_booking = false;
      updatedFeatures.health_records = false;
      updatedFeatures.tv_display = false;
      updatedFeatures.sms_notifications = false;
      updatedFeatures.kiosk_checkin = false;
      updatedFeatures.billing_invoicing = false;
    } else if (newPlan === 'basic') {
      updatedFeatures.walk_in_tokens = true;
      updatedFeatures.online_booking = false;
      updatedFeatures.health_records = false;
      updatedFeatures.tv_display = true;
      updatedFeatures.sms_notifications = false;
      updatedFeatures.kiosk_checkin = false;
      updatedFeatures.billing_invoicing = false;
    } else if (newPlan === 'standard') {
      updatedFeatures.walk_in_tokens = true;
      updatedFeatures.online_booking = true;
      updatedFeatures.health_records = true;
      updatedFeatures.tv_display = true;
      updatedFeatures.sms_notifications = true;
      updatedFeatures.kiosk_checkin = false;
      updatedFeatures.billing_invoicing = false;
    } else if (newPlan === 'premium') {
      updatedFeatures.walk_in_tokens = true;
      updatedFeatures.online_booking = true;
      updatedFeatures.health_records = true;
      updatedFeatures.tv_display = true;
      updatedFeatures.sms_notifications = true;
      updatedFeatures.kiosk_checkin = true;
      updatedFeatures.billing_invoicing = true;
    }

    setSettings(prev => ({
      ...prev,
      plan: newPlan,
      features: updatedFeatures,
    }));
  };

  const handleToggleFeature = (key: keyof ApiCenterSettings['features']) => {
    setSettings(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: !prev.features[key],
      },
    }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await api.updateCenterSettings(centerId, {
        plan: settings.plan,
        is_listed_publicly: settings.is_listed_publicly,
        features: settings.features,
        custom_branding: settings.custom_branding,
        printer_config: settings.printer_config,
      });
      setSuccessMsg('Clinic settings and module configuration saved successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save clinic configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePairingCode = async () => {
    setGeneratingCode(true);
    setError(null);
    try {
      const res = await api.generateDevicePairingCode({
        centerId,
        deviceName: `${centerName} Waiting TV`,
        deviceRole: 'tv_display',
      });
      setLatestPairingCode(res.pairingCode);
      const devRes = await api.getCenterDevices(centerId);
      if (devRes?.devices) {
        setDevices(devRes.devices);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate TV pairing code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = (code: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  // Count active modules
  const activeFeaturesCount = Object.values(settings.features).filter(Boolean).length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(6, 35, 33, 0.65)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="fade-in modal-card"
        style={{
          width: '100%',
          maxWidth: 820,
          maxHeight: '92vh',
          background: 'rgba(255, 255, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(13, 148, 136, 0.25)',
          borderRadius: 22,
          padding: '28px 28px 20px',
          boxShadow: '0 24px 64px rgba(8, 48, 45, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          position: 'relative',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top-Right Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'rgba(13, 148, 136, 0.08)',
            border: '1px solid rgba(13, 148, 136, 0.22)',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-2)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(13, 148, 136, 0.18)';
            e.currentTarget.style.color = '#0D9488';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(13, 148, 136, 0.08)';
            e.currentTarget.style.color = 'var(--text-2)';
          }}
          title="Close Settings"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.15), rgba(20, 184, 166, 0.08))',
              border: '1.5px solid rgba(13, 148, 136, 0.32)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0D9488',
              flexShrink: 0,
            }}
          >
            <Sliders size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: 'var(--text-1)',
                  letterSpacing: '-0.02em',
                  margin: 0,
                }}
              >
                Center Settings & Feature Modules
              </h3>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 9px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  background: 'rgba(13, 148, 136, 0.12)',
                  color: '#0F766E',
                  border: '1px solid rgba(13, 148, 136, 0.28)',
                }}
              >
                <Sparkles size={11} /> {settings.plan.replace('_', ' ')}
              </span>
              {settings.is_listed_publicly ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#059669',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                >
                  <Globe size={11} /> Public Marketplace
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 700,
                    background: 'rgba(100, 116, 139, 0.1)',
                    color: '#475569',
                    border: '1px solid rgba(100, 116, 139, 0.25)',
                  }}
                >
                  <EyeOff size={11} /> Private Clinic
                </span>
              )}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-4)', marginTop: 3 }}>
              Customizing software modules, receipt slip formats, and TV pairing for{' '}
              <strong style={{ color: 'var(--text-2)' }}>{centerName}</strong>
            </div>
          </div>
        </div>

        {/* Tab Navigation Ribbon */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: 5,
            background: 'rgba(15, 23, 42, 0.04)',
            borderRadius: 14,
            border: '1px solid var(--border-md)',
            marginBottom: 20,
            overflowX: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('modules')}
            style={{
              flex: 1,
              minWidth: 160,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '9px 14px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: activeTab === 'modules' ? 800 : 600,
              cursor: 'pointer',
              border: activeTab === 'modules' ? '1px solid #0D9488' : '1px solid transparent',
              background: activeTab === 'modules' ? '#0D9488' : 'transparent',
              color: activeTab === 'modules' ? '#ffffff' : 'var(--text-3)',
              boxShadow: activeTab === 'modules' ? '0 2px 10px rgba(13, 148, 136, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Sliders size={14} />
            <span>Modules & Plan</span>
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 700,
                background: activeTab === 'modules' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.08)',
                color: activeTab === 'modules' ? '#ffffff' : 'var(--text-3)',
              }}
            >
              {activeFeaturesCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('printer')}
            style={{
              flex: 1,
              minWidth: 160,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '9px 14px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: activeTab === 'printer' ? 800 : 600,
              cursor: 'pointer',
              border: activeTab === 'printer' ? '1px solid #0D9488' : '1px solid transparent',
              background: activeTab === 'printer' ? '#0D9488' : 'transparent',
              color: activeTab === 'printer' ? '#ffffff' : 'var(--text-3)',
              boxShadow: activeTab === 'printer' ? '0 2px 10px rgba(13, 148, 136, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Printer size={14} />
            <span>Thermal Slip & Hardware</span>
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 700,
                background: activeTab === 'printer' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.08)',
                color: activeTab === 'printer' ? '#ffffff' : 'var(--text-3)',
              }}
            >
              {settings.printer_config?.paper_width || '80mm'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('devices')}
            style={{
              flex: 1,
              minWidth: 160,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '9px 14px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: activeTab === 'devices' ? 800 : 600,
              cursor: 'pointer',
              border: activeTab === 'devices' ? '1px solid #0D9488' : '1px solid transparent',
              background: activeTab === 'devices' ? '#0D9488' : 'transparent',
              color: activeTab === 'devices' ? '#ffffff' : 'var(--text-3)',
              boxShadow: activeTab === 'devices' ? '0 2px 10px rgba(13, 148, 136, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Tv size={14} />
            <span>Waiting TV Screens</span>
            <span
              style={{
                padding: '1px 6px',
                borderRadius: 999,
                fontSize: 10.5,
                fontWeight: 700,
                background: activeTab === 'devices' ? 'rgba(255, 255, 255, 0.25)' : 'rgba(15, 23, 42, 0.08)',
                color: activeTab === 'devices' ? '#ffffff' : 'var(--text-3)',
              }}
            >
              {devices.length}
            </span>
          </button>
        </div>

        {/* Feedback Banners */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 14px',
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#B91C1C',
              fontSize: 12.5,
              marginBottom: 16,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '11px 14px',
              borderRadius: 12,
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#065F46',
              fontSize: 12.5,
              marginBottom: 16,
            }}
          >
            <CheckCircle2 size={16} color="#059669" style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Body */}
        <div style={{ flex: 1, minHeight: 320 }}>
          {loading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 0',
                gap: 12,
                color: 'var(--text-4)',
              }}
            >
              <RefreshCw size={28} className="animate-spin" color="#0D9488" />
              <div style={{ fontSize: 13, fontWeight: 600 }}>Loading clinic configuration…</div>
            </div>
          ) : (
            <>
              {/* ──────────────── TAB 1: MODULES & PLANS ──────────────── */}
              {activeTab === 'modules' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Plan Tier Selector */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                      }}
                    >
                      <label
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--text-3)',
                        }}
                      >
                        1. Software Subscription Plan
                      </label>
                      {!canEditPlan && (
                        <span
                          style={{
                            fontSize: 11,
                            color: 'var(--text-4)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Lock size={12} /> Managed by Super Admin
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 10,
                      }}
                    >
                      {[
                        {
                          id: 'listing_only',
                          title: 'Listing Only',
                          badge: 'Discovery',
                          desc: 'Public marketplace profile only. Internal clinic queue disabled.',
                        },
                        {
                          id: 'basic',
                          title: 'Basic Queue',
                          badge: 'Walk-In',
                          desc: 'On-site walk-in token generation & receptionist calling desk.',
                        },
                        {
                          id: 'standard',
                          title: 'Standard Clinic',
                          badge: 'Popular',
                          desc: 'Walk-in tokens + Online Appointments + EMR records + TV board.',
                        },
                        {
                          id: 'premium',
                          title: 'Enterprise',
                          badge: 'Full Suite',
                          desc: 'All features + Patient self-service tablet kiosk & Billing.',
                        },
                      ].map(tier => {
                        const isSelected = settings.plan === tier.id;
                        return (
                          <div
                            key={tier.id}
                            onClick={() => canEditPlan && handlePlanChange(tier.id as any)}
                            style={{
                              padding: '14px 14px',
                              borderRadius: 14,
                              border: isSelected
                                ? '2px solid #0D9488'
                                : '1.5px solid var(--border-md)',
                              background: isSelected
                                ? 'rgba(13, 148, 136, 0.05)'
                                : '#ffffff',
                              boxShadow: isSelected
                                ? '0 4px 14px rgba(13, 148, 136, 0.15)'
                                : 'none',
                              cursor: canEditPlan ? 'pointer' : 'default',
                              transition: 'all 0.15s ease',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  marginBottom: 6,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 13.5,
                                    fontWeight: 800,
                                    color: isSelected ? '#0D9488' : 'var(--text-1)',
                                  }}
                                >
                                  {tier.title}
                                </span>
                                {isSelected ? (
                                  <div
                                    style={{
                                      width: 18,
                                      height: 18,
                                      borderRadius: '50%',
                                      background: '#0D9488',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: '#fff',
                                    }}
                                  >
                                    <Check size={12} strokeWidth={3} />
                                  </div>
                                ) : (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      padding: '2px 6px',
                                      borderRadius: 6,
                                      background: 'rgba(15, 23, 42, 0.06)',
                                      color: 'var(--text-4)',
                                    }}
                                  >
                                    {tier.badge}
                                  </span>
                                )}
                              </div>
                              <p
                                style={{
                                  fontSize: 11.5,
                                  color: 'var(--text-4)',
                                  lineHeight: 1.45,
                                  margin: 0,
                                }}
                              >
                                {tier.desc}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Public Marketplace Switch */}
                  <div
                    style={{
                      background: 'rgba(13, 148, 136, 0.04)',
                      border: '1px solid rgba(13, 148, 136, 0.2)',
                      borderRadius: 14,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: settings.is_listed_publicly
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(100, 116, 139, 0.12)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: settings.is_listed_publicly ? '#059669' : '#64748B',
                          flexShrink: 0,
                        }}
                      >
                        {settings.is_listed_publicly ? <Globe size={20} /> : <EyeOff size={20} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-1)' }}>
                          Public Patient Marketplace Discovery
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
                          {settings.is_listed_publicly
                            ? 'Listed publicly — patients can find and book appointments at this medical center online.'
                            : 'Private operation — hidden from the public MediQueue search; internal receptionist use only.'}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSettings(prev => ({
                          ...prev,
                          is_listed_publicly: !prev.is_listed_publicly,
                        }))
                      }
                      style={{
                        padding: '7px 14px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: '1.5px solid',
                        borderColor: settings.is_listed_publicly ? '#10B981' : 'var(--border-lg)',
                        background: settings.is_listed_publicly
                          ? 'rgba(16, 185, 129, 0.12)'
                          : 'rgba(100, 116, 139, 0.08)',
                        color: settings.is_listed_publicly ? '#047857' : 'var(--text-3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {settings.is_listed_publicly ? (
                        <>
                          <Check size={14} strokeWidth={3} /> Listed
                        </>
                      ) : (
                        <>Private</>
                      )}
                    </button>
                  </div>

                  {/* Granular Feature Modules */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11.5,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-3)',
                        marginBottom: 10,
                      }}
                    >
                      2. Active Feature Modules (Toggle on/off)
                    </label>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                        gap: 10,
                      }}
                    >
                      {[
                        {
                          key: 'walk_in_tokens' as const,
                          name: 'Walk-In Queue Tokens',
                          desc: 'On-site token counter, slip generation, physical queue calling',
                          icon: <ShieldCheck size={17} color="#0D9488" />,
                        },
                        {
                          key: 'online_booking' as const,
                          name: 'Online Patient Booking',
                          desc: 'Allows remote patients to schedule doctor appointments online',
                          icon: <Sparkles size={17} color="#2563EB" />,
                        },
                        {
                          key: 'health_records' as const,
                          name: 'Medical Records & EMR',
                          desc: 'Patient past prescriptions, medical history, and file uploads',
                          icon: <Building2 size={17} color="#7C3AED" />,
                        },
                        {
                          key: 'tv_display' as const,
                          name: 'Waiting-Room TV Board',
                          desc: 'Big-screen now-serving display for clinic waiting areas',
                          icon: <Tv size={17} color="#059669" />,
                        },
                        {
                          key: 'sms_notifications' as const,
                          name: 'SMS / WhatsApp Alerts',
                          desc: 'Automatic queue updates and booking SMS to patient mobile',
                          icon: <Smartphone size={17} color="#D97706" />,
                        },
                        {
                          key: 'kiosk_checkin' as const,
                          name: 'Self-Service Tablet Kiosk',
                          desc: 'Allows walk-in patients to check themselves in via an iPad/tablet',
                          icon: <Smartphone size={17} color="#9333EA" />,
                        },
                      ].map(feat => {
                        const active = Boolean(settings.features[feat.key]);
                        return (
                          <div
                            key={feat.key}
                            onClick={() => handleToggleFeature(feat.key)}
                            style={{
                              padding: '12px 14px',
                              borderRadius: 14,
                              border: active
                                ? '1.5px solid rgba(13, 148, 136, 0.45)'
                                : '1.5px solid var(--border-md)',
                              background: active
                                ? 'rgba(13, 148, 136, 0.04)'
                                : '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              boxShadow: active
                                ? '0 2px 8px rgba(13, 148, 136, 0.08)'
                                : 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 8,
                                  background: active
                                    ? 'rgba(13, 148, 136, 0.1)'
                                    : 'rgba(15, 23, 42, 0.05)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {feat.icon}
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: active ? 'var(--text-1)' : 'var(--text-3)',
                                  }}
                                >
                                  {feat.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: 11,
                                    color: 'var(--text-4)',
                                    marginTop: 1,
                                    lineHeight: 1.35,
                                  }}
                                >
                                  {feat.desc}
                                </div>
                              </div>
                            </div>

                            <div
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 7,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                background: active ? '#0D9488' : 'rgba(15, 23, 42, 0.08)',
                                color: active ? '#ffffff' : 'transparent',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <Check size={14} strokeWidth={3} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────── TAB 2: THERMAL PRINTER CONFIG ──────────────── */}
              {activeTab === 'printer' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                  {/* Paper Format Comparison */}
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: 11.5,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--text-3)',
                        marginBottom: 10,
                      }}
                    >
                      Receipt Paper Width (Hardware Standard)
                    </label>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: 12,
                      }}
                    >
                      <div
                        onClick={() =>
                          setSettings(prev => ({
                            ...prev,
                            printer_config: { ...prev.printer_config, paper_width: '80mm' },
                          }))
                        }
                        style={{
                          padding: 16,
                          borderRadius: 14,
                          border:
                            settings.printer_config?.paper_width === '80mm'
                              ? '2px solid #0D9488'
                              : '1.5px solid var(--border-md)',
                          background:
                            settings.printer_config?.paper_width === '80mm'
                              ? 'rgba(13, 148, 136, 0.05)'
                              : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Printer size={18} color="#0D9488" />
                            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>
                              80mm Standard POS Slip
                            </span>
                          </div>
                          {settings.printer_config?.paper_width === '80mm' && (
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: '#0D9488',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                              }}
                            >
                              <Check size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0, lineHeight: 1.45 }}>
                          Standard desktop thermal POS printers (Epson TM-T20, Star Micronics, Xprinter). Fits QR code and queue details comfortably.
                        </p>
                      </div>

                      <div
                        onClick={() =>
                          setSettings(prev => ({
                            ...prev,
                            printer_config: { ...prev.printer_config, paper_width: '58mm' },
                          }))
                        }
                        style={{
                          padding: 16,
                          borderRadius: 14,
                          border:
                            settings.printer_config?.paper_width === '58mm'
                              ? '2px solid #0D9488'
                              : '1.5px solid var(--border-md)',
                          background:
                            settings.printer_config?.paper_width === '58mm'
                              ? 'rgba(13, 148, 136, 0.05)'
                              : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Receipt size={18} color="#0D9488" />
                            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>
                              58mm Compact Receipt
                            </span>
                          </div>
                          {settings.printer_config?.paper_width === '58mm' && (
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: '#0D9488',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                              }}
                            >
                              <Check size={12} strokeWidth={3} />
                            </div>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--text-4)', margin: 0, lineHeight: 1.45 }}>
                          Narrow handheld Bluetooth/USB thermal printers. Formats ticket margins for compact paper rolls without text truncation.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Auto-Print Switch */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--border-md)',
                      borderRadius: 14,
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-1)' }}>
                        Automatic Print Dialog on Token Issue
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
                        Trigger the system print dialog immediately whenever receptionist issues a walk-in queue token.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSettings(prev => ({
                          ...prev,
                          printer_config: {
                            ...prev.printer_config,
                            auto_print: !prev.printer_config?.auto_print,
                          },
                        }))
                      }
                      style={{
                        padding: '7px 14px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: '1.5px solid',
                        borderColor: settings.printer_config?.auto_print
                          ? '#0D9488'
                          : 'var(--border-lg)',
                        background: settings.printer_config?.auto_print
                          ? 'rgba(13, 148, 136, 0.12)'
                          : 'rgba(100, 116, 139, 0.08)',
                        color: settings.printer_config?.auto_print
                          ? '#0F766E'
                          : 'var(--text-3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {settings.printer_config?.auto_print ? (
                        <>
                          <Check size={14} strokeWidth={3} /> Auto-Print Enabled
                        </>
                      ) : (
                        <>Manual Click Only</>
                      )}
                    </button>
                  </div>

                  {/* Live Simulated Thermal Receipt Slip Preview */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: 18,
                      alignItems: 'start',
                    }}
                  >
                    {/* Custom Header & Footer Text */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <label
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--text-3)',
                        }}
                      >
                        Custom Slip Header & Footer Text
                      </label>

                      <div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--text-2)',
                            display: 'block',
                            marginBottom: 4,
                          }}
                        >
                          Ticket Header Banner:
                        </span>
                        <input
                          type="text"
                          value={settings.custom_branding?.ticket_header || ''}
                          onChange={e =>
                            setSettings(prev => ({
                              ...prev,
                              custom_branding: {
                                ...prev.custom_branding,
                                ticket_header: e.target.value,
                              },
                            }))
                          }
                          placeholder="e.g. MediQueue Clinic Token"
                          style={{
                            width: '100%',
                            fontSize: 13,
                            padding: '9px 12px',
                            borderRadius: 10,
                            border: '1px solid var(--border-md)',
                            background: '#ffffff',
                            color: 'var(--text-1)',
                            outline: 'none',
                          }}
                        />
                      </div>

                      <div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--text-2)',
                            display: 'block',
                            marginBottom: 4,
                          }}
                        >
                          Ticket Footer Greeting / Phone:
                        </span>
                        <input
                          type="text"
                          value={settings.custom_branding?.ticket_footer || ''}
                          onChange={e =>
                            setSettings(prev => ({
                              ...prev,
                              custom_branding: {
                                ...prev.custom_branding,
                                ticket_footer: e.target.value,
                              },
                            }))
                          }
                          placeholder="e.g. Thank you for waiting patiently"
                          style={{
                            width: '100%',
                            fontSize: 13,
                            padding: '9px 12px',
                            borderRadius: 10,
                            border: '1px solid var(--border-md)',
                            background: '#ffffff',
                            color: 'var(--text-1)',
                            outline: 'none',
                          }}
                        />
                      </div>
                    </div>

                    {/* Live Ticket Card */}
                    <div
                      style={{
                        background: '#fefefe',
                        border: '1px dashed #cbd5e1',
                        borderRadius: 12,
                        padding: '16px 20px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
                        fontFamily: 'monospace',
                        color: '#0f172a',
                        maxWidth: 320,
                        margin: '0 auto',
                      }}
                    >
                      <div style={{ textAlign: 'center', borderBottom: '1px dashed #94a3b8', paddingBottom: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 900, textTransform: 'uppercase' }}>
                          {settings.custom_branding?.ticket_header || centerName}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                          {centerName} · {settings.printer_config?.paper_width || '80mm'} Slip
                        </div>
                      </div>

                      <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#64748b' }}>
                          YOUR TOKEN NUMBER
                        </div>
                        <div
                          style={{
                            fontSize: 34,
                            fontWeight: 900,
                            color: '#0D9488',
                            letterSpacing: '0.05em',
                            margin: '4px 0',
                          }}
                        >
                          A-042
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>Dr. Samantha Silva</div>
                        <div style={{ fontSize: 10, color: '#64748b' }}>Consultation Room 3</div>
                      </div>

                      <div
                        style={{
                          borderTop: '1px dashed #94a3b8',
                          paddingTop: 8,
                          textAlign: 'center',
                          fontSize: 10,
                          color: '#64748b',
                        }}
                      >
                        <div>Est. Wait: ~15 mins (3 ahead)</div>
                        <div style={{ marginTop: 4, fontWeight: 700, color: '#334155' }}>
                          {settings.custom_branding?.ticket_footer || 'Thank you for waiting patiently'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ──────────────── TAB 3: WAITING-ROOM TV SCREENS ──────────────── */}
              {activeTab === 'devices' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Hero Pair Code Box */}
                  <div
                    style={{
                      background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.08), rgba(20, 184, 166, 0.04))',
                      border: '1.5px solid rgba(13, 148, 136, 0.28)',
                      borderRadius: 16,
                      padding: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 16,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <Tv size={20} color="#0D9488" />
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)' }}>
                          Pair a Waiting-Room Screen
                        </span>
                      </div>
                      <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0, maxWidth: 440 }}>
                        Turn on any smart TV or browser in your clinic waiting area, navigate to{' '}
                        <strong style={{ color: '#0D9488' }}>/tv-display</strong>, and enter the generated pairing code.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleGeneratePairingCode}
                      disabled={generatingCode}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 12,
                        background: '#0D9488',
                        color: '#ffffff',
                        border: 'none',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                        boxShadow: '0 4px 14px rgba(13, 148, 136, 0.3)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {generatingCode ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" /> Generating…
                        </>
                      ) : (
                        <>
                          <Key size={15} /> Generate 6-Digit Code
                        </>
                      )}
                    </button>
                  </div>

                  {/* Active Code Display Card */}
                  {latestPairingCode && (
                    <div
                      style={{
                        background: '#0f172a',
                        border: '1.5px solid rgba(13, 148, 136, 0.5)',
                        borderRadius: 16,
                        padding: '20px 24px',
                        textAlign: 'center',
                        color: '#ffffff',
                        position: 'relative',
                        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.25)',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.12em',
                          color: '#94a3b8',
                          marginBottom: 6,
                        }}
                      >
                        Waiting Room TV Enrollment Code (Valid for 15 mins)
                      </div>
                      <div
                        style={{
                          fontSize: 36,
                          fontWeight: 900,
                          letterSpacing: '0.18em',
                          fontFamily: 'monospace',
                          color: '#2dd4bf',
                          margin: '6px 0 10px',
                        }}
                      >
                        {latestPairingCode}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(latestPairingCode)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 8,
                            background: copiedCode ? '#059669' : 'rgba(255, 255, 255, 0.12)',
                            color: '#ffffff',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          {copiedCode ? <CheckCheck size={14} /> : <Copy size={14} />}
                          {copiedCode ? 'Copied to Clipboard!' : 'Copy Code'}
                        </button>

                        <a
                          href={`/tv-display?centerId=${centerId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: '6px 14px',
                            borderRadius: 8,
                            background: 'rgba(13, 148, 136, 0.3)',
                            color: '#2dd4bf',
                            border: '1px solid rgba(45, 212, 191, 0.3)',
                            fontSize: 12,
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <ExternalLink size={14} /> Test Launch Board ↗
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Devices List */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 10,
                      }}
                    >
                      <label
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: 'var(--text-3)',
                        }}
                      >
                        Enrolled Clinic Devices ({devices.length})
                      </label>

                      <a
                        href={`/tv-display?centerId=${centerId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#0D9488',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        Preview Public TV Screen <ExternalLink size={12} />
                      </a>
                    </div>

                    {devices.length === 0 ? (
                      <div
                        style={{
                          padding: 32,
                          textAlign: 'center',
                          borderRadius: 14,
                          border: '1px dashed var(--border-lg)',
                          background: 'rgba(15, 23, 42, 0.02)',
                          color: 'var(--text-4)',
                          fontSize: 12.5,
                        }}
                      >
                        No paired TV screens yet. Click <strong>Generate 6-Digit Code</strong> above to link your first waiting-room display!
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: 8 }}>
                        {devices.map(device => {
                          const lastSeen = new Date(device.last_heartbeat).toLocaleTimeString();
                          return (
                            <div
                              key={device.id}
                              style={{
                                padding: '12px 16px',
                                borderRadius: 12,
                                border: '1px solid var(--border-md)',
                                background: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 14,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 10,
                                    background: 'rgba(13, 148, 136, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: '#0D9488',
                                  }}
                                >
                                  <MonitorCheck size={18} />
                                </div>
                                <div>
                                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text-1)' }}>
                                    {device.device_name}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                                    Role: {device.device_role} · Paired:{' '}
                                    {new Date(device.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>

                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 10px',
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  color: '#059669',
                                  border: '1px solid rgba(16, 185, 129, 0.25)',
                                }}
                              >
                                <span
                                  style={{
                                    width: 7,
                                    height: 7,
                                    borderRadius: '50%',
                                    background: '#10B981',
                                  }}
                                />
                                Online (Seen {lastSeen})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer with Stepper Navigation and Save */}
        <div
          style={{
            marginTop: 24,
            paddingTop: 16,
            borderTop: '1px solid var(--border-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {/* Stepper Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeTab !== 'modules' && (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'devices') setActiveTab('printer');
                  else if (activeTab === 'printer') setActiveTab('modules');
                }}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, fontSize: 12, color: 'var(--text-3)' }}
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}

            {activeTab !== 'devices' && (
              <button
                type="button"
                onClick={() => {
                  if (activeTab === 'modules') setActiveTab('printer');
                  else if (activeTab === 'printer') setActiveTab('devices');
                }}
                className="btn btn-ghost btn-sm"
                style={{ gap: 6, fontSize: 12, color: '#0D9488', fontWeight: 700 }}
              >
                Next Section <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: 12.5, color: 'var(--text-3)' }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saving || loading}
              style={{
                padding: '9px 20px',
                borderRadius: 12,
                background: '#0D9488',
                color: '#ffffff',
                border: '1px solid #0F766E',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: '0 4px 14px rgba(13, 148, 136, 0.3)',
                transition: 'all 0.15s ease',
              }}
            >
              {saving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Saving Configuration…
                </>
              ) : (
                <>
                  <Check size={14} strokeWidth={3} /> Save Clinic Configuration
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
