import React, { useState, useEffect } from 'react';
import { Download, MonitorCheck, X, Sparkles, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PwaInstallPromptProps {
  compact?: boolean;
  className?: string;
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({ compact = false, className = '' }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already running in standalone mode
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();

    // Check if dismissed in this session
    if (sessionStorage.getItem('mediqueue_pwa_dismissed') === 'true') {
      setIsDismissed(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If prompt isn't directly available (e.g. desktop Chrome installed, or iOS Safari)
      alert(
        'To install MediQueue:\n\n• On Chrome/Edge: Click the install icon (⊕) on the right side of the address bar.\n• On iOS/Safari: Tap Share and choose "Add to Home Screen".'
      );
      return;
    }

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem('mediqueue_pwa_dismissed', 'true');
  };

  if (isStandalone) {
    if (compact) return null;
    return (
      <div className={`flex items-center gap-2 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200/80 rounded-lg px-2.5 py-1 ${className}`}>
        <MonitorCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
        <span>MediQueue Desktop App Mode Active</span>
      </div>
    );
  }

  if (isDismissed || isInstalled) {
    return null;
  }

  if (compact) {
    return (
      <button
        onClick={handleInstallClick}
        type="button"
        title="Install MediQueue Clinic System as a standalone Desktop App"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white rounded-md text-xs font-semibold shadow-sm transition-all duration-150 animate-pulse hover:animate-none ${className}`}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50/70 p-3.5 shadow-sm transition-all duration-200 ${className}`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800">Install MediQueue Clinic System</h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-100/90 px-2 py-0.5 text-[10px] font-semibold text-teal-800">
                <Smartphone className="w-2.5 h-2.5" />
                Desktop & Tablet
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Launch directly from your taskbar or home screen in a dedicated standalone window with instant offline queue caching.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center ml-auto">
          <button
            type="button"
            onClick={handleInstallClick}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-teal-700 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          >
            <Download className="h-3.5 w-3.5" />
            Install 1-Click
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
            title="Dismiss for this session"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
