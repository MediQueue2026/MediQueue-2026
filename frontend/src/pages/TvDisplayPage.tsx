import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Volume2, VolumeX, Maximize, Minimize, Wifi, WifiOff,
  Building2, Key, CheckCircle2, AlertCircle, RefreshCw, Smartphone, X, ArrowLeft
} from 'lucide-react';
import PublicTvDisplay from '../components/PublicTvDisplay';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/** Web Audio API chime synthesis for token announcements */
function playTokenChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Chime Tone 1: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.55);

    // Chime Tone 2: 880.00 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880.00, now + 0.22);
    gain2.gain.setValueAtTime(0.3, now + 0.22);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.22);
    osc2.stop(now + 0.95);
  } catch (err) {
    console.warn('[TV Display] Audio chime error:', err);
  }
}

interface TvDisplayPageProps {
  defaultPairMode?: boolean;
}

export default function TvDisplayPage({ defaultPairMode = false }: TvDisplayPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // 1. Center ID Resolution (URL param -> LocalStorage Paired Token -> Direct Center Id)
  const urlCenterId = searchParams.get('centerId');
  const [pairedCenterId, setPairedCenterId] = useState<string | null>(() => {
    return urlCenterId || localStorage.getItem('mq_tv_center_id') || null;
  });
  const [deviceToken, setDeviceToken] = useState<string | null>(() => {
    return localStorage.getItem('mq_device_token') || null;
  });
  const [deviceName, setDeviceName] = useState<string>(() => {
    return localStorage.getItem('mq_device_name') || 'Waiting Room TV';
  });

  // Pairing Modal State
  const [showPairModal, setShowPairModal] = useState<boolean>(() => {
    return defaultPairMode || (!urlCenterId && !localStorage.getItem('mq_tv_center_id'));
  });
  const [pairingCodeInput, setPairingCodeInput] = useState('');
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const [availableCenters, setAvailableCenters] = useState<Array<{ id: string; name: string; city?: string }>>([]);

  // Fetch registered medical centers for optional instant preview/selection
  useEffect(() => {
    fetch(`${API_BASE}/centers`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.centers)) {
          setAvailableCenters(data.centers);
        }
      })
      .catch(err => console.warn('[TV Display] Could not load center list:', err));
  }, []);

  // Audio & Fullscreen
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Connection & Backoff State
  const [isOffline, setIsOffline] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const previousTokenRef = useRef<string | null>(null);

  // ── 1. Screen Wake Lock API ──────────────────────────────────────────────
  useEffect(() => {
    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.log('[TV Display] Screen WakeLock acquired — display will stay active');
        }
      } catch (err) {
        console.warn('[TV Display] WakeLock request warning:', err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
      }
    };
  }, []);

  // ── 2. Device Heartbeat (every 45s) & Audio Context Gesture Unlock ────────
  useEffect(() => {
    const unlockAudio = () => {
      try {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          if (ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
        }
      } catch (_) {}
    };

    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });

    if (!deviceToken) return;

    const sendHeartbeat = async () => {
      try {
        await fetch(`${API_BASE}/devices/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceToken })
        });
      } catch (err) {
        console.warn('[TV Display] Heartbeat error:', err);
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 45000);
    return () => clearInterval(interval);
  }, [deviceToken]);

  // ── 3. Queue Polling & Audio Chime with Exponential Backoff ──────────────
  useEffect(() => {
    const centerId = urlCenterId || pairedCenterId;
    let timer: ReturnType<typeof setTimeout>;
    let pollInterval = 3000;

    const checkBoard = async () => {
      try {
        const query = centerId ? `?centerId=${encodeURIComponent(centerId)}` : '';
        const res = await fetch(`${API_BASE}/queue/board${query}`);
        if (res.ok) {
          const data = await res.json();
          setIsOffline(false);
          setReconnectAttempts(0);
          pollInterval = 3000;

          // Check if any doctor called a new token
          if (Array.isArray(data.doctors)) {
            const currentTokens = data.doctors
              .map((d: any) => d.nowServing?.token)
              .filter(Boolean)
              .join('|');

            if (previousTokenRef.current !== null && previousTokenRef.current !== currentTokens && currentTokens.length > 0) {
              if (audioEnabled) {
                playTokenChime();
              }
            }
            previousTokenRef.current = currentTokens;
          }
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (err) {
        console.warn('[TV Display] Network interruption:', err);
        setIsOffline(true);
        setReconnectAttempts(prev => prev + 1);
        // Exponential backoff: 3s -> 6s -> 12s -> max 24s
        pollInterval = Math.min(pollInterval * 2, 24000);
      } finally {
        timer = setTimeout(checkBoard, pollInterval);
      }
    };

    checkBoard();
    return () => clearTimeout(timer);
  }, [urlCenterId, pairedCenterId, audioEnabled]);

  // ── 4. Fullscreen Toggle ─────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // ── 5. Device Pairing Handler ────────────────────────────────────────────
  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = pairingCodeInput.trim().toUpperCase();
    if (!code) {
      setPairingError('Please enter a 6-character pairing code');
      return;
    }

    setPairingLoading(true);
    setPairingError(null);

    try {
      const res = await fetch(`${API_BASE}/devices/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairingCode: code,
          metadata: {
            userAgent: navigator.userAgent,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to pair device');
      }

      // Save persistent enrollment
      localStorage.setItem('mq_device_token', data.deviceToken);
      localStorage.setItem('mq_tv_center_id', data.centerId);
      localStorage.setItem('mq_device_name', data.deviceName);

      setDeviceToken(data.deviceToken);
      setPairedCenterId(data.centerId);
      setDeviceName(data.deviceName);
      setShowPairModal(false);
      setPairingCodeInput('');
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setPairingLoading(false);
    }
  };

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const activeCenterId = urlCenterId || pairedCenterId;

  return (
    <div className="relative w-screen h-screen bg-[#021412] text-white overflow-hidden select-none">
      {/* Underlying Live TV Board Component */}
      <PublicTvDisplay
        isOpen={true}
        centerId={activeCenterId}
        hideControls={true}
        onClose={handleClose}
      />

      {/* ── TOP LEFT BACK TO APP BUTTON (Always visible in standalone PWA window) ── */}
      <button
        onClick={handleClose}
        className="fixed top-3 left-4 z-[10001] flex items-center gap-2 bg-slate-900/85 hover:bg-slate-800 text-slate-200 hover:text-white backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-teal-500/30 shadow-xl text-xs font-semibold transition-all cursor-pointer"
        title="Exit TV Display & Return to Dashboard"
      >
        <ArrowLeft className="w-3.5 h-3.5 text-teal-400" />
        <span>Exit TV Mode</span>
      </button>

      {/* ── TOP RIGHT TV HARDENING OVERLAY BAR ── */}
      <div className="fixed top-3 right-4 z-[10001] flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-teal-500/30 shadow-xl text-xs">
        {/* Offline / Reconnecting Badge */}
        {isOffline ? (
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold animate-pulse">
            <WifiOff className="w-3.5 h-3.5" />
            <span>Reconnecting ({reconnectAttempts})…</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-emerald-400 font-semibold">
            <Wifi className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Online</span>
          </div>
        )}

        <div className="w-px h-3.5 bg-slate-700 mx-1" />

        {/* Audio Chime Toggle */}
        <button
          onClick={() => {
            const next = !audioEnabled;
            setAudioEnabled(next);
            if (next) playTokenChime();
          }}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${audioEnabled ? 'text-teal-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-800'}`}
          title={audioEnabled ? 'Audio Chime Enabled (Click to Mute)' : 'Audio Chime Muted (Click to Enable)'}
        >
          {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* Fullscreen Button */}
        <button
          onClick={toggleFullscreen}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Toggle TV Fullscreen (F11)"
        >
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>

        {/* Device Pairing Button */}
        <button
          onClick={() => setShowPairModal(true)}
          className="p-1.5 text-teal-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Pair / Change Clinic Center"
        >
          <Key className="w-4 h-4" />
        </button>

        <div className="w-px h-3.5 bg-slate-700 mx-1" />

        {/* Exit TV Button */}
        <button
          onClick={handleClose}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Exit TV Display"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── PAIRING MODAL OVERLAY ── */}
      {showPairModal && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-teal-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl relative">
            {/* Modal Exit/Close X Button */}
            <button
              onClick={activeCenterId ? () => setShowPairModal(false) : handleClose}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title={activeCenterId ? 'Close Settings' : 'Exit to Dashboard'}
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-teal-600/30 border border-teal-500/50 flex items-center justify-center text-teal-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Enroll Waiting-Room TV</h3>
                <p className="text-xs text-slate-400">Pair this screen to your clinic's queue board</p>
              </div>
            </div>

            <form onSubmit={handlePairSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Option 1: Enter 6-Character Pairing Code
                </label>
                <input
                  type="text"
                  placeholder="e.g. MQ-9821"
                  maxLength={10}
                  value={pairingCodeInput}
                  onChange={e => setPairingCodeInput(e.target.value.toUpperCase())}
                  className="w-full text-center text-2xl font-mono tracking-widest font-bold py-3 bg-slate-800 border border-teal-500/40 rounded-xl text-teal-300 focus:outline-none focus:border-teal-400"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1 text-center">
                  Generate this code inside your <strong>Reception Desk → Device Settings</strong> or <strong>Admin Panel</strong>.
                </p>
              </div>

              {pairingError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-950/60 border border-red-800/80 text-red-300 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pairingError}</span>
                </div>
              )}

              {/* Direct Medical Center Selection Option */}
              {availableCenters.length > 0 && (
                <div>
                  <div className="relative my-3 flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700/60" /></div>
                    <span className="relative bg-slate-900 px-3 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Or Select Medical Center Directly</span>
                  </div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Option 2: Direct Preview Selection
                  </label>
                  <select
                    value={activeCenterId || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setPairedCenterId(e.target.value);
                        localStorage.setItem('mq_tv_center_id', e.target.value);
                        setShowPairModal(false);
                      }
                    }}
                    className="w-full py-2.5 px-3 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-teal-400 cursor-pointer"
                  >
                    <option value="">-- Choose Center to Display --</option>
                    {availableCenters.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.city ? `(${c.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={activeCenterId ? () => setShowPairModal(false) : handleClose}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {activeCenterId ? 'Close Settings' : 'Back to Dashboard'}
                </button>
                <button
                  type="submit"
                  disabled={pairingLoading || !pairingCodeInput.trim()}
                  className="flex-1 py-2.5 text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {pairingLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Pairing…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Pair Screen
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
