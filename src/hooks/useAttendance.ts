import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  setDoc,
  doc,
  deleteDoc,
  query,
  where,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { monthRange } from '@/utils/date';

export type AttendanceStatus = 'present' | 'half' | 'absent' | 'holiday';

export type AttendanceRecord = {
  id: string;
  workerId: string;
  date: string;
  status: AttendanceStatus;
  overtimeHours: number;
  amountPaid: number;
  advanceAmount: number;
  remark: string;
  isHoliday?: boolean;
  holidayReason?: string;
};

function attendancePath(user: string) {
  return collection(db, 'users', user, 'attendance');
}

export function useAttendance(date: string) {
  const { user } = useAuth();
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);

  // Real-time subscription so the metrics ribbon and any other consumer
  // reflect attendance changes immediately, without a manual refresh.
  useEffect(() => {
    if (!user || !date) {
      setRecords({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(attendancePath(user.uid), where('date', '==', date));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const map: Record<string, AttendanceRecord> = {};
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const workerId = data.workerId as string;
          map[workerId] = {
            id: d.id,
            workerId,
            date: data.date as string,
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
        console.error('Attendance listener error:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, date]);

  const saveRecord = useCallback(
    async (
      workerId: string,
      status: AttendanceStatus,
      overtimeHours: number,
      amountPaid: number,
      remark: string
    ) => {
      if (!user) return;
      const docId = `${date}_${workerId}`;
      const ref = doc(db, 'users', user.uid, 'attendance', docId);
      const isHoliday = status === 'holiday';
      // An absent worker cannot log overtime — never store OT on absent days.
      const effectiveOT = status === 'absent' ? 0 : overtimeHours;

      await setDoc(
        ref,
        {
          workerId,
          date,
          status,
          overtimeHours: effectiveOT,
          amountPaid,
          remark,
          isHoliday,
          // Clear stale holidayReason whenever the day is no longer a holiday.
          holidayReason: isHoliday ? undefined : null,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
    },
    [user, date]
  );

  const saveAll = useCallback(
    async (
      entries: {
        workerId: string;
        status: AttendanceStatus;
        overtimeHours: number;
        amountPaid: number;
        remark: string;
      }[]
    ) => {
      if (!user || entries.length === 0) return;
      const batch = writeBatch(db);
      for (const entry of entries) {
        const docId = `${date}_${entry.workerId}`;
        const ref = doc(db, 'users', user.uid, 'attendance', docId);
        const isHoliday = entry.status === 'holiday';
        const effectiveOT = entry.status === 'absent' ? 0 : entry.overtimeHours;

        batch.set(
          ref,
          {
            workerId: entry.workerId,
            date,
            status: entry.status,
            overtimeHours: effectiveOT,
            amountPaid: entry.amountPaid,
            remark: entry.remark,
            isHoliday,
            holidayReason: isHoliday ? undefined : null,
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      }
      await batch.commit();
    },
    [user, date]
  );

  const deleteRecord = useCallback(
    async (workerId: string) => {
      if (!user) return;
      const docId = `${date}_${workerId}`;
      await deleteDoc(doc(db, 'users', user.uid, 'attendance', docId));
    },
    [user, date]
  );

  const markHoliday = useCallback(
    async (reason: string, workerIds: string[]): Promise<number> => {
      if (!user) throw new Error('Not signed in.');
      if (workerIds.length === 0) return 0;

      try {
        const batch = writeBatch(db);
        for (const workerId of workerIds) {
          const docId = `${date}_${workerId}`;
          const ref = doc(db, 'users', user.uid, 'attendance', docId);
          // merge:true preserves any existing amountPaid / advanceAmount.
          batch.set(
            ref,
            {
              workerId,
              date,
              status: 'holiday',
              isHoliday: true,
              holidayReason: reason,
              overtimeHours: 0,
              remark: `Holiday: ${reason}`,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        }
        await batch.commit();
        return workerIds.length;
      } catch (err) {
        console.error('markHoliday error:', err);
        throw new Error('Could not mark holiday. Check your connection and try again.');
      }
    },
    [user, date]
  );

  return { records, loading, saveRecord, saveAll, deleteRecord, markHoliday };
}

export type AttendanceMonthRecord = {
  present: number;
  half: number;
  absent: number;
  holiday: number;
  otHours: number;
  amountPaid: number;
  advanceAmount: number;
};

export function useMonthlyAttendance(monthStr: string) {
  const { user } = useAuth();
  const [records, setRecords] = useState<Record<string, AttendanceMonthRecord>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRecords({});
      setLoading(false);
      return;
    }

    const { start, end } = monthRange(monthStr);
    setLoading(true);

    const q = query(
      attendancePath(user.uid),
      where('date', '>=', start),
      where('date', '<=', end)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const map: Record<string, AttendanceMonthRecord> = {};
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const workerId = data.workerId as string;
          const status = data.status as AttendanceStatus;
          if (!map[workerId]) {
            map[workerId] = {
              present: 0,
              half: 0,
              absent: 0,
              holiday: 0,
              otHours: 0,
              amountPaid: 0,
              advanceAmount: 0,
            };
          }
          if (status === 'present') map[workerId].present++;
          else if (status === 'half') map[workerId].half++;
          else if (status === 'holiday') map[workerId].holiday++;
          else map[workerId].absent++;

          // OT only counts on days the worker actually worked.
          if (status !== 'absent') {
            map[workerId].otHours += Number(data.overtimeHours ?? 0);
          }
          map[workerId].amountPaid += Number(data.amountPaid ?? 0);
          map[workerId].advanceAmount += Number(data.advanceAmount ?? 0);
        });
        setRecords(map);
        setLoading(false);
      },
      (err) => {
        console.error('Monthly attendance listener error:', err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user, monthStr]);

  return { records, loading };
}