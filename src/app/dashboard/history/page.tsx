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

interface CorrectionRequest {
  id: string;
  attendanceId: string | null;
  date: string;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  requestedBreakDuration: number | null;
  reason: string | null;
  status: string;
  createdAt: string;
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

function getBreakOptions() {
  const options: number[] = [0];
  for (let m = 10; m <= 300; m += 10) {
    options.push(m);
  }
  return options;
}

function getTimeOptions() {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 5) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return options;
}

// HH:MM を JST の ISO 文字列に変換（指定日付ベース）
function timeToUTCISO(date: string, time: string): string {
  return new Date(`${date}T${time}:00+09:00`).toISOString();
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
  const [savingBreakId, setSavingBreakId] = useState<string | null>(null);

  // Correction request modal
  const [correctionModal, setCorrectionModal] = useState<Attendance | null>(null);
  const [corrClockIn, setCorrClockIn] = useState("");
  const [corrClockOut, setCorrClockOut] = useState("");
  const [corrBreak, setCorrBreak] = useState(0);
  const [corrReason, setCorrReason] = useState("");
  const [corrSaving, setCorrSaving] = useState(false);
  const [corrMessage, setCorrMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Existing correction requests for this user
  const [myRequests, setMyRequests] = useState<CorrectionRequest[]>([]);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/users")
        .then((r) => r.json())
        .then(setUsers);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchRecords();
    fetchMyRequests();
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

  const fetchMyRequests = async () => {
    const res = await fetch("/api/correction-request");
    if (res.ok) {
      const data = await res.json();
      setMyRequests(data);
    }
  };

  const handleBreakChange = async (attendanceId: string, minutes: number) => {
    setSavingBreakId(attendanceId);
    try {
      const res = await fetch("/api/attendance/break", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId, breakDuration: minutes }),
      });
      if (res.ok) {
        fetchRecords();
      }
    } catch {
      // ignore
    }
    setSavingBreakId(null);
  };

  const openCorrectionModal = (record: Attendance) => {
    setCorrectionModal(record);
    // Pre-fill with current times
    if (record.clockIn) {
      const d = new Date(record.clockIn);
      const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      setCorrClockIn(`${String(jst.getHours()).padStart(2, "0")}:${String(jst.getMinutes()).padStart(2, "0")}`);
    } else {
      setCorrClockIn("");
    }
    if (record.clockOut) {
      const d = new Date(record.clockOut);
      const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
      setCorrClockOut(`${String(jst.getHours()).padStart(2, "0")}:${String(jst.getMinutes()).padStart(2, "0")}`);
    } else {
      setCorrClockOut("");
    }
    setCorrBreak(record.breakDuration || 0);
    setCorrReason("");
    setCorrMessage(null);
  };

  const handleCorrectionSubmit = async () => {
    if (!correctionModal) return;
    setCorrSaving(true);
    setCorrMessage(null);

    try {
      const res = await fetch("/api/correction-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: correctionModal.id,
          date: correctionModal.date,
          requestedClockIn: corrClockIn ? timeToUTCISO(correctionModal.date, corrClockIn) : null,
          requestedClockOut: corrClockOut ? timeToUTCISO(correctionModal.date, corrClockOut) : null,
          requestedBreakDuration: corrBreak,
          reason: corrReason || null,
        }),
      });

      if (res.ok) {
        setCorrMessage({ type: "success", text: "修正依頼を送信しました" });
        fetchMyRequests();
        setTimeout(() => {
          setCorrectionModal(null);
        }, 1500);
      } else {
        const data = await res.json();
        setCorrMessage({ type: "error", text: data.error || "エラーが発生しました" });
      }
    } catch {
      setCorrMessage({ type: "error", text: "エラーが発生しました" });
    }

    setCorrSaving(false);
  };

  // Get the status of a correction request for a given date
  const getRequestStatus = (date: string) => {
    return myRequests.find((r) => r.date === date && r.status === "pending");
  };

  // 自分の記録を見ている場合のみ休憩編集可能
  const canEditBreak = !selectedUserId || isAdmin;
  // 自分の記録を見ている場合のみ修正依頼可能
  const canRequestCorrection = !selectedUserId && !isAdmin;

  const totalWorkMinutes = records.reduce((sum, r) => sum + (r.workDuration || 0), 0);
  const totalBreakMinutes = records.reduce((sum, r) => sum + (r.breakDuration || 0), 0);
  const workDays = records.filter((r) => r.clockIn).length;

  const timeOptions = getTimeOptions();

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

      {/* Correction Request Modal */}
      {correctionModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">修正依頼</h3>
            <p className="text-sm text-gray-400 mb-6">
              {new Date(correctionModal.date + "T00:00:00").toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
            </p>

            {corrMessage && (
              <div
                className={`px-4 py-3 rounded-lg text-sm mb-4 ${
                  corrMessage.type === "success"
                    ? "bg-green-50 border border-green-200 text-green-700"
                    : "bg-red-50 border border-red-200 text-red-700"
                }`}
              >
                {corrMessage.text}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">正しい出勤時刻</label>
                  <select
                    value={corrClockIn}
                    onChange={(e) => setCorrClockIn(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">未選択</option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">正しい退勤時刻</label>
                  <select
                    value={corrClockOut}
                    onChange={(e) => setCorrClockOut(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    <option value="">未選択</option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">休憩時間</label>
                <select
                  value={corrBreak}
                  onChange={(e) => setCorrBreak(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  {getBreakOptions().map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? "なし" : `${m}分`}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">修正理由</label>
                <input
                  type="text"
                  value={corrReason}
                  onChange={(e) => setCorrReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="修正理由を入力してください"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setCorrectionModal(null)}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleCorrectionSubmit}
                disabled={corrSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {corrSaving ? "送信中..." : "依頼を送信"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                {canRequestCorrection && <th className="px-6 py-3 font-medium">修正依頼</th>}
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const pendingRequest = getRequestStatus(record.date);
                return (
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
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {canEditBreak ? (
                        <select
                          value={record.breakDuration || 0}
                          onChange={(e) => handleBreakChange(record.id, Number(e.target.value))}
                          disabled={savingBreakId === record.id}
                          className={`bg-transparent outline-none cursor-pointer text-sm ${savingBreakId === record.id ? "opacity-50" : ""}`}
                        >
                          {getBreakOptions().map((m) => (
                            <option key={m} value={m}>
                              {m === 0 ? "0:00" : formatDuration(m)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        formatDuration(record.breakDuration)
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">{formatDuration(record.workDuration)}</td>
                    {canRequestCorrection && (
                      <td className="px-6 py-4">
                        {pendingRequest ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-medium">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            依頼中
                          </span>
                        ) : (
                          <button
                            onClick={() => openCorrectionModal(record)}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                          >
                            修正依頼
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
              {records.length === 0 && (
                <tr>
                  <td colSpan={canRequestCorrection ? 7 : 6} className="px-6 py-16 text-center text-gray-400 text-sm">
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
