import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { roundCurrency } from '@/utils/calculations';
import type { Worker } from '@/hooks/useWorkers';

type Bucket = { present: number; half: number; holiday: number; otHours: number };

export type WageBreakdownRow = {
  worker: Worker;
  present: number;
  half: number;
  holiday: number;
  otHours: number;
  wage: number;
};

/**
 * Computes wages for the given worker list over a [fromDate, toDate] range,
 * pulling attendance from the GLOBAL attendance collection.
 * Formula: (present × dailyWage) + (half × 0.5 × dailyWage) + (OT × otRate)
 */
export function useWageCalculator(
  workers: Worker[],
  fromDate: string,
  toDate: string
) {
  const { user } = useAuth();
  const [records, setRecords] = useState<Record<string, Bucket>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !fromDate || !toDate || fromDate > toDate) {
      setRecords({});
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'attendance'),
      where('date', '>=', fromDate),
      where('date', '<=', toDate)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const map: Record<string, Bucket> = {};
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          if (data.isHoliday === true) return; // holidays earn ₹0
          const wid = data.workerId as string;
          if (!map[wid]) map[wid] = { present: 0, half: 0, holiday: 0, otHours: 0 };
          const status = data.status as string;
          if (status === 'present') map[wid].present++;
          else if (status === 'half') map[wid].half++;
          else if (status === 'holiday') map[wid].holiday++;
          map[wid].otHours += Number(data.overtimeHours ?? 0);
        });
        setRecords(map);
        setLoading(false);
      },
      (err) => {
        console.error('Wage calculator listener error:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, fromDate, toDate]);

  const breakdown: WageBreakdownRow[] = workers.map((w) => {
    const r = records[w.id] ?? { present: 0, half: 0, holiday: 0, otHours: 0 };
    const wage =
      r.present * w.dailyWage +
      r.half * 0.5 * w.dailyWage +
      r.otHours * w.overtimeHourlyRate;
    return {
      worker: w,
      present: r.present,
      half: r.half,
      holiday: r.holiday,
      otHours: r.otHours,
      wage: roundCurrency(wage),
    };
  });

  const total = roundCurrency(breakdown.reduce((s, b) => s + b.wage, 0));

  return { total, breakdown, loading };
}