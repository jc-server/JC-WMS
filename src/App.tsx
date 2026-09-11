import { useState, useEffect } from 'react';
import {
  HardHat, Users, CalendarCheck, Wallet, LogOut, Loader2, Sun, Moon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useWorkers, type Worker } from '@/hooks/useWorkers';
import { useAttendance } from '@/hooks/useAttendance';
import { useAdvances } from '@/hooks/useAdvances';
import AuthScreen from '@/components/AuthScreen';
import WorkerManagement from '@/components/WorkerManagement';
import AttendanceMatrix from '@/components/AttendanceMatrix';
import WageSummaryView from '@/components/WageSummary';
import SiteSelector from '@/components/SiteSelector';
import MetricsRibbon from '@/components/MetricsRibbon';
import WorkerProfile from '@/components/WorkerProfile';

type Tab = 'attendance' | 'workers' | 'wages';

function todayStr() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export default function App() {
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<Tab>('attendance');
  const [siteId, setSiteId] = useState<string | null>(() => localStorage.getItem('jcwms-site'));
  const [todayMetrics, setTodayMetrics] = useState({ present: 0, absent: 0, half: 0, otHours: 0, advancePayout: 0, dailyCost: 0 });

  const { workers, updateWorker, deleteWorker } = useWorkers(siteId);
  const { records: todayAtt } = useAttendance(siteId, todayStr());
  const { advances } = useAdvances(siteId);
  const [profileWorker, setProfileWorker] = useState<Worker | null>(null);

  useEffect(() => {
    if (siteId) localStorage.setItem('jcwms-site', siteId);
  }, [siteId]);

  // Compute live metrics for today
  useEffect(() => {
    const activeWorkers = workers.filter((w) => w.active);
    let present = 0, absent = 0, half = 0, otHours = 0, dailyCost = 0;

    activeWorkers.forEach((w) => {
      const r = todayAtt[w.id];
      const status = r?.status ?? 'absent';
      const ot = r?.overtimeHours ?? 0;

      if (status === 'present') {
        present++;
        dailyCost += w.dailyWage + ot * w.overtimeHourlyRate;
      } else if (status === 'half') {
        half++;
        dailyCost += w.dailyWage * 0.5 + ot * w.overtimeHourlyRate;
      } else {
        absent++;
        dailyCost += ot * w.overtimeHourlyRate;
      }
      otHours += ot;
    });

    const todayAdvancePayout = advances
      .filter((a) => a.date === todayStr())
      .reduce((sum, a) => sum + a.amount, 0);

    setTodayMetrics({ present, absent, half, otHours, advancePayout: todayAdvancePayout, dailyCost });
  }, [workers, todayAtt, advances]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  const tabs: { id: Tab; label: string; icon: typeof Users }[] = [
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
    { id: 'workers', label: 'Workers', icon: Users },
    { id: 'wages', label: 'Wages', icon: Wallet },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 transition-colors">
      <header className="bg-white dark:bg-zinc-900 sticky top-0 z-40 shadow-sm border-b border-slate-200 dark:border-zinc-800 transition-colors">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-amber-400 rounded-xl flex items-center justify-center shrink-0">
              <HardHat className="w-5 h-5 text-slate-900" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-slate-900 dark:text-white font-bold text-lg leading-none">JC-WMS</h1>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Workers Management System</p>
            </div>
          </div>

          <SiteSelector currentSiteId={siteId} onSelectSite={setSiteId} />

          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleTheme}
              className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-all active:scale-90"
              title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium"
            >
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        <nav className="max-w-5xl mx-auto px-4 flex gap-1 pb-2">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                  active
                    ? 'bg-amber-400 text-slate-900'
                    : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {tab === 'attendance' && (
          <>
            <MetricsRibbon {...todayMetrics} />
            <AttendanceMatrix workers={workers} siteId={siteId} onOpenProfile={setProfileWorker} />
          </>
        )}
        {tab === 'workers' && <WorkerManagement siteId={siteId} onOpenProfile={setProfileWorker} />}
        {tab === 'wages' && <WageSummaryView workers={workers} siteId={siteId} onOpenProfile={setProfileWorker} />}
      </main>

      <footer className="max-w-5xl mx-auto px-4 py-6 text-center text-slate-400 dark:text-slate-500 text-xs font-medium">
        &copy; 2026 Jaiswal Construction. All Rights Reserved | Created by{' '}
        <a
          href="https://github.com/kalmux1"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-600 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:underline transition-colors"
        >
          KALMUX
        </a>
      </footer>

      {profileWorker && (
        <WorkerProfile
          worker={profileWorker}
          siteId={siteId}
          onClose={() => setProfileWorker(null)}
          onUpdate={updateWorker}
          onDelete={deleteWorker}
        />
      )}
    </div>
  );
}
