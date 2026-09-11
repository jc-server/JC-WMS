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

export type AttendanceStatus = 'present' | 'half' | 'absent';

export type AttendanceRecord = {
  id: string;
  workerId: string;
  date: string;
  status: AttendanceStatus;
  overtimeHours: number;
  amountPaid: number;
  remark: string;
};

function sitePath(user: string, siteId: string) {
  return collection(db, 'users', user, 'sites', siteId, 'attendance');
}

export function useAttendance(siteId: string | null, date: string) {
  const { user } = useAuth();
  const [records, setRecords] = useState<Record<string, AttendanceRecord>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user || !siteId) {
      setRecords({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const snap = await getDocs(sitePath(user.uid, siteId));
      const map: Record<string, AttendanceRecord> = {};
      snap.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        const rec: AttendanceRecord = {
          id: d.id,
          workerId: data.workerId as string,
          date: data.date as string,
          status: data.status as AttendanceStatus,
          overtimeHours: Number(data.overtimeHours ?? 0),
          amountPaid: Number(data.amountPaid ?? data.advanceAmount ?? 0),
          remark: (data.remark as string) ?? '',
        };
        if (rec.date === date) {
          map[rec.workerId] = rec;
        }
      });
      setRecords(map);
    } catch (err) {
      console.error('Attendance load error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, siteId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const saveRecord = useCallback(
    async (workerId: string, status: AttendanceStatus, overtimeHours: number, amountPaid: number, remark: string) => {
      if (!user || !siteId) return;
      const docId = `${date}_${workerId}`;
      const ref = doc(db, 'users', user.uid, 'sites', siteId, 'attendance', docId);
      await setDoc(ref, {
        workerId,
        date,
        status,
        overtimeHours,
        amountPaid,
        remark,
        updatedAt: Date.now(),
      }, { merge: true });

      setRecords((prev) => ({
        ...prev,
        [workerId]: { id: docId, workerId, date, status, overtimeHours, amountPaid, remark },
      }));
    },
    [user, siteId, date]
  );

  const saveAll = useCallback(
    async (entries: { workerId: string; status: AttendanceStatus; overtimeHours: number; amountPaid: number; remark: string }[]) => {
      if (!user || !siteId || entries.length === 0) return;
      const batch = writeBatch(db);
      for (const entry of entries) {
        const docId = `${date}_${entry.workerId}`;
        const ref = doc(db, 'users', user.uid, 'sites', siteId, 'attendance', docId);
        batch.set(ref, {
          workerId: entry.workerId,
          date,
          status: entry.status,
          overtimeHours: entry.overtimeHours,
          amountPaid: entry.amountPaid,
          remark: entry.remark,
          updatedAt: Date.now(),
        }, { merge: true });
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
            remark: entry.remark,
          };
        }
        return next;
      });
    },
    [user, siteId, date]
  );

  const deleteRecord = useCallback(
    async (workerId: string) => {
      if (!user || !siteId) return;
      const docId = `${date}_${workerId}`;
      await deleteDoc(doc(db, 'users', user.uid, 'sites', siteId, 'attendance', docId));
      setRecords((prev) => {
        const next = { ...prev };
        delete next[workerId];
        return next;
      });
    },
    [user, siteId, date]
  );

  return { records, loading, saveRecord, saveAll, deleteRecord, reload: load };
}

export type AttendanceMonthRecord = {
  present: number;
  half: number;
  absent: number;
  otHours: number;
  amountPaid: number;
};

export function useMonthlyAttendance(siteId: string | null, monthStr: string) {
  const { user } = useAuth();
  const [records, setRecords] = useState<Record<string, AttendanceMonthRecord>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !siteId) {
      setRecords({});
      setLoading(false);
      return;
    }

    const [year, month] = monthStr.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    setLoading(true);
    (async () => {
      try {
        const q = query(
          sitePath(user.uid, siteId),
          where('date', '>=', startStr),
          where('date', '<=', endStr)
        );
        const snap = await getDocs(q);
        const map: Record<string, AttendanceMonthRecord> = {};
        snap.forEach((d) => {
          const data = d.data() as Record<string, unknown>;
          const workerId = data.workerId as string;
          const status = data.status as 'present' | 'half' | 'absent';
          const ot = Number(data.overtimeHours ?? 0);
          const paid = Number(data.amountPaid ?? data.advanceAmount ?? 0);
          if (!map[workerId]) {
            map[workerId] = { present: 0, half: 0, absent: 0, otHours: 0, amountPaid: 0 };
          }
          if (status === 'present') map[workerId].present++;
          else if (status === 'half') map[workerId].half++;
          else map[workerId].absent++;
          map[workerId].otHours += ot;
          map[workerId].amountPaid += paid;
        });
        setRecords(map);
      } catch (err) {
        console.error('Monthly attendance error:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, siteId, monthStr]);

  return { records, loading };
}
