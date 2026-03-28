"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Attendance {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakDuration: number | null;
  workDuration: number | null;
  note: string | null;
  modifiedBy: string | null;
  user?: { name: string; email: string };
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number | null) {
  if (minutes === null || minutes === undefined) return "--:--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export default function HistoryPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [records, setRecords] = useState<Attendance[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/users")
        .then((r) => r.json())
        .then(setUsers);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchRecords();
  }, [selectedMonth, selectedUserId]);

  const fetchRecords = async () => {
    let url = `/api/attendance?month=${selectedMonth}`;
    if (selectedUserId) url += `&userId=${selectedUserId}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setRecords(data);
    }
  };

  const totalWorkMinutes = records.reduce((sum, r) => sum + (r.workDuration || 0), 0);
  const totalBreakMinutes = records.reduce((sum, r) => sum + (r.breakDuration || 0), 0);
  const workDays = records.filter((r) => r.clockIn).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">勤怠確認</h1>
        <p className="text-gray-500 mt-1">月別の勤怠記録を確認できます</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <div>
          <label className="block text-xs text-gray-400 mb-1">対象月</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        {isAdmin && (
          <div>
            <label className="block text-xs text-gray-400 mb-1">社員</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-w-[200px]"
            >
              <option value="">自分の記録</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-xs text-gray-400">出勤日数</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{workDays}日</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-xs text-gray-400">総労働時間</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatDuration(totalWorkMinutes)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          <p className="text-xs text-gray-400">総休憩時間</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatDuration(totalBreakMinutes)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-400 bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-3 font-medium">日付</th>
                {isAdmin && selectedUserId && <th className="px-6 py-3 font-medium">社員名</th>}
                <th className="px-6 py-3 font-medium">出勤</th>
                <th className="px-6 py-3 font-medium">退勤</th>
                <th className="px-6 py-3 font-medium">休憩</th>
                <th className="px-6 py-3 font-medium">勤務時間</th>
                <th className="px-6 py-3 font-medium">備考</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                    {new Date(record.date + "T00:00:00").toLocaleDateString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      weekday: "short",
                    })}
                  </td>
                  {isAdmin && selectedUserId && (
                    <td className="px-6 py-4 text-sm text-gray-600">{record.user?.name}</td>
                  )}
                  <td className="px-6 py-4 text-sm text-gray-600">{formatTime(record.clockIn)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatTime(record.clockOut)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDuration(record.breakDuration)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-700">{formatDuration(record.workDuration)}</td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {record.modifiedBy && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded text-xs">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {record.modifiedBy}が修正
                      </span>
                    )}
                    {record.note && <span className="ml-2 text-gray-500">{record.note}</span>}
                  </td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-400 text-sm">
                    この月の勤怠記録はありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
