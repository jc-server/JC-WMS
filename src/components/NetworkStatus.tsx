import { useState, useEffect, useRef } from 'react';
import { Wifi, WifiOff } from 'lucide-react';

type Message = { type: 'offline' | 'online' } | null;

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [message, setMessage] = useState<Message>(() =>
    typeof navigator === 'undefined' || navigator.onLine ? null : { type: 'offline' }
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTimer = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      setMessage({ type: 'online' });
      clearTimer();
      timerRef.current = setTimeout(() => setMessage(null), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setMessage({ type: 'offline' });
      clearTimer();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearTimer();
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
            <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <Wifi className="w-3 h-3 hidden sm:inline" aria-hidden="true" />
            <span className="hidden sm:inline">Online</span>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden="true" />
            <WifiOff className="w-3 h-3" aria-hidden="true" />
            <span>Offline</span>
          </>
        )}
      </div>

      {message && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 max-w-[90vw] ${
            message.type === 'offline' ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {message.type === 'offline' ? (
            <>
              <WifiOff className="w-4 h-4 animate-bounce" aria-hidden="true" />
              <span>You are offline. Changes will sync when reconnected.</span>
            </>
          ) : (
            <>
              <Wifi className="w-4 h-4" aria-hidden="true" />
              <span>Back online. Syncing changes.</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}