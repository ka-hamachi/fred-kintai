"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Attendance {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakDuration: number | null;
  workDuration: number | null;
  breakStart: string | null;
  breakEnd: string | null;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "--:--";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number | null) {
  if (minutes === null || minutes === undefined) return "--:--";
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  return `${sign}${h}時間${String(m).padStart(2, "0")}分`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "おはようございます";
  return "お疲れ様です";
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [monthlyData, setMonthlyData] = useState<Attendance[]>([]);
  const [overtimeBalance, setOvertimeBalance] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchTodayData();
    fetchMonthlyData();
    fetchOvertimeBalance();
  }, []);

  const fetchTodayData = async () => {
    const today = new Date().toISOString().split("T")[0];
    const res = await fetch(`/api/attendance?date=${today}`);
    if (res.ok) {
      const data = await res.json();
      setTodayAttendance(data);
    }
  };

  const fetchMonthlyData = async () => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const res = await fetch(`/api/attendance?month=${month}`);
    if (res.ok) {
      const data = await res.json();
      setMonthlyData(data);
    }
  };

  const fetchOvertimeBalance = async () => {
    const res = await fetch("/api/users/overtime");
    if (res.ok) {
      const data = await res.json();
      setOvertimeBalance(data?.overtimeBalance || 0);
    }
  };

  const getStatus = () => {
    if (!todayAttendance?.clockIn) return { text: "未出勤", color: "bg-gray-100 text-gray-600" };
    if (todayAttendance.breakStart && !todayAttendance.breakEnd) return { text: "休憩中", color: "bg-yellow-100 text-yellow-700" };
    if (todayAttendance.clockOut) return { text: "退勤済", color: "bg-green-100 text-green-700" };
    return { text: "勤務中", color: "bg-blue-100 text-blue-700" };
  };

  const status = getStatus();

  const totalWorkDays = monthlyData.filter((a) => a.clockIn).length;
  const totalWorkMinutes = monthlyData.reduce((sum, a) => sum + (a.workDuration || 0), 0);

  // 今月の規定労働時間: (その月の日数 - 8日) × 10時間
  const now = new Date();
  const daysInMonth = getDaysInMonth(now.getFullYear(), now.getMonth() + 1);
  const requiredWorkMinutes = (daysInMonth - 8) * 10 * 60; // 分単位
  const remainingWorkMinutes = requiredWorkMinutes - totalWorkMinutes;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            {getGreeting()}、{session?.user?.name}さん
          </h1>
          <p className="text-gray-500 mt-1">
            {currentTime.toLocaleDateString("ja-JP", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "long",
            })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-light text-gray-800 tabular-nums">
            {currentTime.toLocaleTimeString("ja-JP", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </p>
          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${status.color}`}>
            {status.text}
          </span>
        </div>
      </div>

      {/* Quick Action */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">本日の勤怠</h2>
            <div className="flex gap-8 mt-3">
              <div>
                <span className="text-xs text-gray-400">出勤</span>
                <p className="text-lg font-medium text-gray-700">{formatTime(todayAttendance?.clockIn ?? null)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400">退勤</span>
                <p className="text-lg font-medium text-gray-700">{formatTime(todayAttendance?.clockOut ?? null)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400">休憩</span>
                <p className="text-lg font-medium text-gray-700">{formatDuration(todayAttendance?.breakDuration ?? null)}</p>
              </div>
              <div>
                <span className="text-xs text-gray-400">勤務時間</span>
                <p className="text-lg font-medium text-gray-700">{formatDuration(todayAttendance?.workDuration ?? null)}</p>
              </div>
            </div>
          </div>
          <Link
            href="/dashboard/clock"
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            打刻する
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-400">今月の出勤日数</p>
              <p className="text-xl font-bold text-gray-800">{totalWorkDays}日</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-400">今月の総労働時間</p>
              <p className="text-xl font-bold text-gray-800">{formatDuration(totalWorkMinutes)}</p>
              <p className="text-xs text-gray-400 mt-0.5">規定: {formatDuration(requiredWorkMinutes)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-400">今月の残り勤務時間</p>
              <p className={`text-xl font-bold ${remainingWorkMinutes <= 0 ? "text-green-600" : "text-gray-800"}`}>
                {remainingWorkMinutes <= 0 ? "達成済" : formatDuration(remainingWorkMinutes)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${overtimeBalance >= 0 ? "bg-purple-50" : "bg-red-50"}`}>
              <svg className={`w-5 h-5 ${overtimeBalance >= 0 ? "text-purple-600" : "text-red-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-400">先月までの過不足</p>
              <p className={`text-xl font-bold ${overtimeBalance > 0 ? "text-purple-600" : overtimeBalance < 0 ? "text-red-600" : "text-gray-800"}`}>
                {overtimeBalance === 0 ? "±0" : overtimeBalance > 0 ? `+${formatDuration(overtimeBalance)}` : formatDuration(overtimeBalance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent History */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">最近の勤怠記録</h2>
          <Link href="/dashboard/history" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            すべて見る →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-50">
                <th className="px-6 py-3 font-medium">日付</th>
                <th className="px-6 py-3 font-medium">出勤</th>
                <th className="px-6 py-3 font-medium">退勤</th>
                <th className="px-6 py-3 font-medium">休憩</th>
                <th className="px-6 py-3 font-medium">勤務時間</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.slice(0, 5).map((record) => (
                <tr key={record.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {new Date(record.date + "T00:00:00").toLocaleDateString("ja-JP", {
                      month: "short",
                      day: "numeric",
                      weekday: "short",
                    })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatTime(record.clockIn)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatTime(record.clockOut)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDuration(record.breakDuration)}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-700">{formatDuration(record.workDuration)}</td>
                </tr>
              ))}
              {monthlyData.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400 text-sm">
                    今月の勤怠記録はまだありません
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
