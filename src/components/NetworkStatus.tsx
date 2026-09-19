import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [showNotification, setShowNotification] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowNotification(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setShowNotification(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowNotification(true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
          isOnline
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse'
        }`}
        title={isOnline ? 'Connected to Internet' : 'Working Offline'}
      >
        {isOnline ? (
          <>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <Wifi className="w-3 h-3 hidden sm:inline" />
            <span className="hidden sm:inline">Online</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <WifiOff className="w-3 h-3" />
            <span>Offline</span>
          </>
        )}
      </div>

      {showNotification && !isOnline && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-600 text-white px-4 py-2 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2">
          <WifiOff className="w-4 h-4 animate-bounce" />
          <span>You are offline. Changes will sync when reconnected.</span>
        </div>
      )}
    </div>
  );
}