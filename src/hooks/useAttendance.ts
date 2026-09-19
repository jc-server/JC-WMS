import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  getDocs,
  setDoc,
  doc,
  deleteDoc,
  query,
  where,
  writeBatch,
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

  const load = useCallback(async () => {
    if (!user) {
      setRecords({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Only query the requested date — never the whole collection.
      const q = query(attendancePath(user.uid), where('date', '==', date));
      const snap = await getDocs(q);
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
    } catch (err) {
      console.error('Attendance load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, date]);

  useEffect(() => {
    load();
  }, [load]);

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
      await setDoc(
        ref,
        {
          workerId,
          date,
          status,
          overtimeHours,
          amountPaid,
          remark,
          // Only mark as holiday if the new status IS holiday.
          isHoliday: status === 'holiday',
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      setRecords((prev) => ({
        ...prev,
        [workerId]: {
          id: docId,
          workerId,
          date,
          status,
          overtimeHours,
          amountPaid,
          advanceAmount: prev[workerId]?.advanceAmount ?? 0,
          remark,
          isHoliday: status === 'holiday',
          holidayReason: prev[workerId]?.holidayReason,
        },
      }));
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
        batch.set(
          ref,
          {
            workerId: entry.workerId,
            date,
            status: entry.status,
            overtimeHours: entry.overtimeHours,
            amountPaid: entry.amountPaid,
            remark: entry.remark,
            isHoliday: entry.status === 'holiday',
            updatedAt: Date.now(),
          },
          { merge: true }
        );
      }
      await batch.commit();

      setRecords((prev) => {
        const next = { ...prev };
        for (const entry of entries) {
          const docId = `${date}_${entry.workerId}`;
          next[entry.workerId] = {
            id: docId,
            workerId: entry.workerId,
            date,
            status: entry.status,
            overtimeHours: entry.overtimeHours,
            amountPaid: entry.amountPaid,
            advanceAmount: prev[entry.workerId]?.advanceAmount ?? 0,
            remark: entry.remark,
            isHoliday: entry.status === 'holiday',
            holidayReason: prev[entry.workerId]?.holidayReason,
          };
        }
        return next;
      });
    },
    [user, date]
  );

  const deleteRecord = useCallback(
    async (workerId: string) => {
      if (!user) return;
      const docId = `${date}_${workerId}`;
      await deleteDoc(doc(db, 'users', user.uid, 'attendance', docId));
      setRecords((prev) => {
        const next = { ...prev };
        delete next[workerId];
        return next;
      });
    },
    [user, date]
  );

  const markHoliday = useCallback(
    async (reason: string, workerIds: string[]): Promise<number> => {
      if (!user) throw new Error('Not signed in.');
      if (workerIds.length === 0) return 0;

      try {
        const existing = await getDocs(
          query(attendancePath(user.uid), where('date', '==', date))
        );
        const preserved = new Map<string, { amountPaid: number; advanceAmount: number }>();
        existing.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          preserved.set(data.workerId as string, {
            amountPaid: Number(data.amountPaid ?? 0),
            advanceAmount: Number(data.advanceAmount ?? 0),
          });
        });

        const batch = writeBatch(db);
        for (const workerId of workerIds) {
          const docId = `${date}_${workerId}`;
          const ref = doc(db, 'users', user.uid, 'attendance', docId);
          const keep = preserved.get(workerId) ?? { amountPaid: 0, advanceAmount: 0 };
          batch.set(
            ref,
            {
              workerId,
              date,
              status: 'holiday',
              isHoliday: true,
              holidayReason: reason,
              overtimeHours: 0,
              amountPaid: keep.amountPaid,
              advanceAmount: keep.advanceAmount,
              remark: `Holiday: ${reason}`,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        }
        await batch.commit();

        setRecords((prev) => {
          const next = { ...prev };
          for (const workerId of workerIds) {
            const keep = preserved.get(workerId) ?? { amountPaid: 0, advanceAmount: 0 };
            next[workerId] = {
              id: `${date}_${workerId}`,
              workerId,
              date,
              status: 'holiday',
              overtimeHours: 0,
              amountPaid: keep.amountPaid,
              advanceAmount: keep.advanceAmount,
              remark: `Holiday: ${reason}`,
              isHoliday: true,
              holidayReason: reason,
            };
          }
          return next;
        });

        return workerIds.length;
      } catch (err) {
        console.error('markHoliday error:', err);
        throw new Error('Could not mark holiday. Check your connection and try again.');
      }
    },
    [user, date]
  );

  return { records, loading, saveRecord, saveAll, deleteRecord, markHoliday, reload: load };
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
    (async () => {
      try {
        const q = query(
          attendancePath(user.uid),
          where('date', '>=', start),
          where('date', '<=', end)
        );
        const snap = await getDocs(q);
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
          map[workerId].otHours += Number(data.overtimeHours ?? 0);
          map[workerId].amountPaid += Number(data.amountPaid ?? 0);
          map[workerId].advanceAmount += Number(data.advanceAmount ?? 0);
        });
        setRecords(map);
      } catch (err) {
        console.error('Monthly attendance error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, monthStr]);

  return { records, loading };
}