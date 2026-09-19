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
import { monthRange } from '@/utils/date';

export type DayRecord = {
  status: AttendanceStatus;
  overtimeHours: number;
  amountPaid: number;
  advanceAmount: number;
  remark: string;
  isHoliday?: boolean;
  holidayReason?: string;
};

export function useWorkerAttendance(workerId: string | null, monthStr: string) {
  const { user } = useAuth();
  const [records, setRecords] = useState<Record<string, DayRecord>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !workerId) {
      setRecords({});
      setLoading(false);
      return;
    }

    const { start, end } = monthRange(monthStr);

    // Range-only query → no composite index required.
    const q = query(
      collection(db, 'users', user.uid, 'attendance'),
      where('date', '>=', start),
      where('date', '<=', end)
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
            isHoliday: data.isHoliday === true,
            holidayReason: (data.holidayReason as string) ?? undefined,
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
  }, [user, workerId, monthStr]);

  const saveDay = useCallback(
    async (
      date: string,
      status: AttendanceStatus,
      overtimeHours: number,
      amountPaid: number,
      advanceAmount: number,
      remark: string
    ) => {
      if (!user || !workerId) return;
      const docId = `${date}_${workerId}`;
      const ref = doc(db, 'users', user.uid, 'attendance', docId);
      const isHoliday = status === 'holiday';
      await setDoc(
        ref,
        {
          workerId,
          date,
          status,
          overtimeHours,
          amountPaid,
          advanceAmount,
          remark,
          isHoliday,
          // Only clear holidayReason when status is no longer holiday.
          ...(isHoliday ? {} : { holidayReason: null }),
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    },
    [user, workerId]
  );

  const deleteDay = useCallback(
    async (date: string) => {
      if (!user || !workerId) return;
      const docId = `${date}_${workerId}`;
      await deleteDoc(doc(db, 'users', user.uid, 'attendance', docId));
    },
    [user, workerId]
  );

  return { records, loading, saveDay, deleteDay };
}