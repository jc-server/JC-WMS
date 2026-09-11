import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  setDoc,
  doc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { AttendanceStatus } from '@/hooks/useAttendance';

export type DayRecord = {
  status: AttendanceStatus;
  overtimeHours: number;
  amountPaid: number;
  advanceAmount: number;
  remark: string;
};

export function useWorkerAttendance(siteId: string | null, workerId: string | null, monthStr: string) {
  const { user } = useAuth();
  const [records, setRecords] = useState<Record<string, DayRecord>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !siteId || !workerId) {
      setRecords({});
      setLoading(false);
      return;
    }

    const [year, month] = monthStr.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    const q = query(
      collection(db, 'users', user.uid, 'sites', siteId, 'attendance'),
      where('date', '>=', startStr),
      where('date', '<=', endStr)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const map: Record<string, DayRecord> = {};
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          if (data.workerId !== workerId) return;
          const dateStr = data.date as string;
          map[dateStr] = {
            status: data.status as AttendanceStatus,
            overtimeHours: Number(data.overtimeHours ?? 0),
            amountPaid: Number(data.amountPaid ?? 0),
            advanceAmount: Number(data.advanceAmount ?? 0),
            remark: (data.remark as string) ?? '',
          };
        });
        setRecords(map);
        setLoading(false);
      },
      (err) => {
        console.error('Worker attendance listener error:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, siteId, workerId, monthStr]);

  const saveDay = useCallback(
    async (date: string, status: AttendanceStatus, overtimeHours: number, amountPaid: number, advanceAmount: number, remark: string) => {
      if (!user || !siteId || !workerId) return;
      const docId = `${date}_${workerId}`;
      const ref = doc(db, 'users', user.uid, 'sites', siteId, 'attendance', docId);
      await setDoc(ref, {
        workerId,
        date,
        status,
        overtimeHours,
        amountPaid,
        advanceAmount,
        remark,
        updatedAt: Date.now(),
      }, { merge: true });
    },
    [user, siteId, workerId]
  );

  const deleteDay = useCallback(
    async (date: string) => {
      if (!user || !siteId || !workerId) return;
      const docId = `${date}_${workerId}`;
      await deleteDoc(doc(db, 'users', user.uid, 'sites', siteId, 'attendance', docId));
    },
    [user, siteId, workerId]
  );

  return { records, loading, saveDay, deleteDay };
}
