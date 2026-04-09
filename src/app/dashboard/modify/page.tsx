"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface CorrectionRequest {
  id: string;
  userId: string;
  attendanceId: string | null;
  date: string;
  requestedClockIn: string | null;
  requestedClockOut: string | null;
  requestedBreakDuration: number | null;
  reason: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: { name: string; email: string };
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  overtimeBalance: number;
}

interface Attendance {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  breakDuration: number | null;
  workDuration: number | null;
  note: string | null;
  modifiedBy: string | null;
  user?: { name: string; email: string };
}

function toLocalDatetimeValue(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  // JSTで表示 (UTC+9)
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 16);
}

// datetime-local の値(JST)をISO文字列(UTC)に変換
function toUTCFromJST(localValue: string | null): string | null {
  if (!localValue) return null;
  // datetime-local は "2026-04-01T09:00" 形式(JSTとして扱う)
  const jstDate = new Date(localValue + ":00+09:00");
  return jstDate.toISOString();
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number | null) {
  if (minutes === null || minutes === undefined) return "--:--";
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatDurationLong(minutes: number | null) {
  if (minutes === null || minutes === undefined) return "--:--";
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  return `${sign}${h}時間${String(m).padStart(2, "0")}分`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getBreakOptions() {
  const options: number[] = [0];
  for (let m = 10; m <= 300; m += 10) {
    options.push(m);
  }
  return options;
}

function getWeekendDays(year: number, month: number) {
  const days = getDaysInMonth(year, month);
  let weekends = 0;
  for (let d = 1; d <= days; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day === 0 || day === 6) weekends++;
  }
  return weekends;
}

export default function ModifyPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === "admin";

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [records, setRecords] = useState<Attendance[]>([]);
  const [editingRecord, setEditingRecord] = useState<Attendance | null>(null);
  const [formData, setFormData] = useState({
    clockIn: "",
    clockOut: "",
    breakDuration: 0,
    note: "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingBreakId, setSavingBreakId] = useState<string | null>(null);

  // Correction requests
  const [correctionRequests, setCorrectionRequests] = useState<CorrectionRequest[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  // New record state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newFormData, setNewFormData] = useState({
    clockIn: "",
    clockOut: "",
    breakDuration: 0,
    note: "",
  });

  useEffect(() => {
    if (!isAdmin) {
      router.push("/dashboard");
      return;
    }
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers);
    fetchCorrectionRequests();
  }, [isAdmin, router]);

  useEffect(() => {
    if (selectedUserId) fetchRecords();
  }, [selectedMonth, selectedUserId]);

  const fetchRecords = async () => {
    const res = await fetch(
      `/api/attendance?month=${selectedMonth}&userId=${selectedUserId}`
    );
    if (res.ok) {
      const data = await res.json();
      setRecords(data);
    }
  };

  const startEdit = (record: Attendance) => {
    setEditingRecord(record);
    setFormData({
      clockIn: toLocalDatetimeValue(record.clockIn),
      clockOut: toLocalDatetimeValue(record.clockOut),
      breakDuration: record.breakDuration || 0,
      note: record.note || "",
    });
    setMessage(null);
  };

  const handleSave = async () => {
    if (!editingRecord) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/attendance/modify", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: editingRecord.id,
          clockIn: toUTCFromJST(formData.clockIn || null),
          clockOut: toUTCFromJST(formData.clockOut || null),
          breakDuration: formData.breakDuration,
          note: formData.note || null,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "勤怠記録を修正しました" });
        setEditingRecord(null);
        fetchRecords();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "エラーが発生しました" });
      }
    } catch {
      setMessage({ type: "error", text: "エラーが発生しました" });
    }

    setSaving(false);
  };

  const handleNewRecord = async () => {
    if (!selectedUserId || !newDate) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/attendance/modify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          date: newDate,
          clockIn: toUTCFromJST(newFormData.clockIn || null),
          clockOut: toUTCFromJST(newFormData.clockOut || null),
          breakDuration: newFormData.breakDuration,
          note: newFormData.note || null,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "勤怠記録を追加しました" });
        setShowNewForm(false);
        setNewDate("");
        setNewFormData({ clockIn: "", clockOut: "", breakDuration: 0, note: "" });
        fetchRecords();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "エラーが発生しました" });
      }
    } catch {
      setMessage({ type: "error", text: "エラーが発生しました" });
    }

    setSaving(false);
  };

  const fetchCorrectionRequests = async () => {
    const res = await fetch("/api/correction-request?status=pending");
    if (res.ok) {
      const data = await res.json();
      setCorrectionRequests(data);
    }
  };

  const handleCorrectionAction = async (requestId: string, action: "approved" | "rejected") => {
    setProcessingRequestId(requestId);
    try {
      const res = await fetch("/api/correction-request", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });
      if (res.ok) {
        setMessage({
          type: "success",
          text: action === "approved" ? "修正依頼を承認しました" : "修正依頼を却下しました",
        });
        fetchCorrectionRequests();
        if (selectedUserId) fetchRecords();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "エラーが発生しました" });
      }
    } catch {
      setMessage({ type: "error", text: "エラーが発生しました" });
    }
    setProcessingRequestId(null);
  };

  const handleDelete = async (record: Attendance) => {
    const dateLabel = new Date(record.date + "T00:00:00").toLocaleDateString("ja-JP", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    });
    const timeLabel = formatTime(record.clockIn);
    if (!confirm(`${dateLabel} ${timeLabel} の出勤記録を削除しますか？\nこの操作は取り消せません。`)) return;

    try {
      const res = await fetch(`/api/attendance/modify?id=${record.id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: "勤怠記録を削除しました" });
        fetchRecords();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "削除に失敗しました" });
      }
    } catch {
      setMessage({ type: "error", text: "エラーが発生しました" });
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

  if (!isAdmin) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">勤怠修正</h1>
          <p className="text-gray-500 mt-1">社員の勤怠記録を修正できます</p>
        </div>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-700"
              : "bg-red-50 border border-red-200 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 flex-wrap">
        <div>
          <label className="block text-xs text-gray-400 mb-1">社員</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-w-[250px]"
          >
            <option value="">社員を選択してください</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email}) - {u.role === "admin" ? "管理者" : "従業員"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">対象月</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>
        {selectedUserId && (
          <div className="ml-auto">
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors mt-5"
            >
              + 新規記録追加
            </button>
          </div>
        )}
      </div>

      {/* Correction Requests */}
      <div className="bg-white rounded-xl border border-blue-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-blue-50 bg-blue-50/30">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            修正依頼
            {correctionRequests.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                {correctionRequests.length}件
              </span>
            )}
          </h3>
        </div>
        {correctionRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-400 bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">社員名</th>
                  <th className="px-6 py-3 font-medium">日付</th>
                  <th className="px-6 py-3 font-medium">希望出勤</th>
                  <th className="px-6 py-3 font-medium">希望退勤</th>
                  <th className="px-6 py-3 font-medium">休憩</th>
                  <th className="px-6 py-3 font-medium">理由</th>
                  <th className="px-6 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {correctionRequests.map((cr) => (
                  <tr key={cr.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">{cr.user.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(cr.date + "T00:00:00").toLocaleDateString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        weekday: "short",
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {cr.requestedClockIn
                        ? new Date(cr.requestedClockIn).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
                        : "--:--"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {cr.requestedClockOut
                        ? new Date(cr.requestedClockOut).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })
                        : "--:--"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {cr.requestedBreakDuration != null ? `${cr.requestedBreakDuration}分` : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">
                      {cr.reason || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCorrectionAction(cr.id, "approved")}
                          disabled={processingRequestId === cr.id}
                          className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors disabled:opacity-50"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => handleCorrectionAction(cr.id, "rejected")}
                          disabled={processingRequestId === cr.id}
                          className="px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          却下
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-16 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400">修正依頼はありません</p>
          </div>
        )}
      </div>

      {/* New Record Form */}
      {showNewForm && selectedUserId && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">新規勤怠記録</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">日付</label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">出勤</label>
              <input
                type="datetime-local"
                value={newFormData.clockIn}
                onChange={(e) => setNewFormData({ ...newFormData, clockIn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">退勤</label>
              <input
                type="datetime-local"
                value={newFormData.clockOut}
                onChange={(e) => setNewFormData({ ...newFormData, clockOut: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">休憩時間</label>
              <select
                value={newFormData.breakDuration}
                onChange={(e) => setNewFormData({ ...newFormData, breakDuration: Number(e.target.value) })}
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
              <label className="block text-xs text-gray-400 mb-1">備考</label>
              <input
                type="text"
                value={newFormData.note}
                onChange={(e) => setNewFormData({ ...newFormData, note: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="修正理由など"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleNewRecord}
              disabled={saving || !newDate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {selectedUserId && (() => {
        const selectedUser = users.find((u) => u.id === selectedUserId);
        const [year, monthStr] = selectedMonth.split("-").map(Number);
        const totalWorkDays = records.filter((a) => a.clockIn).length;
        const totalWorkMinutes = records.reduce((sum, a) => sum + (a.workDuration || 0), 0);
        const daysInMonth = getDaysInMonth(year, monthStr);
        const weekendDays = getWeekendDays(year, monthStr);
        const requiredWorkMinutes = (daysInMonth - weekendDays) * 9.5 * 60;
        const remainingWorkMinutes = requiredWorkMinutes - totalWorkMinutes;
        const overtimeBalance = selectedUser?.overtimeBalance || 0;

        return (
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
                  <p className="text-xl font-bold text-gray-800">{formatDurationLong(totalWorkMinutes)}</p>
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
                  <p className="text-xl font-bold text-gray-800">
                    {remainingWorkMinutes <= 0 ? "0時間00分" : formatDurationLong(remainingWorkMinutes)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${overtimeBalance >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                  <svg className={`w-5 h-5 ${overtimeBalance >= 0 ? "text-green-600" : "text-red-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-400">先月までの過不足</p>
                  <p className={`text-xl font-bold ${overtimeBalance > 0 ? "text-green-600" : overtimeBalance < 0 ? "text-red-600" : "text-gray-800"}`}>
                    {overtimeBalance === 0 ? "±0" : overtimeBalance > 0 ? `+${formatDurationLong(overtimeBalance)}` : formatDurationLong(overtimeBalance)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Edit Modal */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">勤怠修正</h3>
            <p className="text-sm text-gray-400 mb-6">
              {new Date(editingRecord.date + "T00:00:00").toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long",
              })}
              {editingRecord.user && ` - ${editingRecord.user.name}`}
            </p>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">出勤時刻</label>
                  <input
                    type="datetime-local"
                    value={formData.clockIn}
                    onChange={(e) => setFormData({ ...formData, clockIn: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">退勤時刻</label>
                  <input
                    type="datetime-local"
                    value={formData.clockOut}
                    onChange={(e) => setFormData({ ...formData, clockOut: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-400 mb-1">休憩時間</label>
                  <select
                    value={formData.breakDuration}
                    onChange={(e) => setFormData({ ...formData, breakDuration: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  >
                    {getBreakOptions().map((m) => (
                      <option key={m} value={m}>
                        {m === 0 ? "なし" : `${m}分`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">備考（修正理由）</label>
                <input
                  type="text"
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="修正理由を入力してください"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Records Table */}
      {selectedUserId ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-400 bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-3 font-medium">日付</th>
                  <th className="px-6 py-3 font-medium">出勤</th>
                  <th className="px-6 py-3 font-medium">退勤</th>
                  <th className="px-6 py-3 font-medium">休憩</th>
                  <th className="px-6 py-3 font-medium">勤務時間</th>
                  <th className="px-6 py-3 font-medium">修正者</th>
                  <th className="px-6 py-3 font-medium">操作</th>
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
                    <td className="px-6 py-4 text-sm text-gray-600">{formatTime(record.clockIn)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{formatTime(record.clockOut)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
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
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">{formatDuration(record.workDuration)}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{record.modifiedBy || "-"}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(record)}
                          className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors"
                        >
                          修正
                        </button>
                        <button
                          onClick={() => handleDelete(record)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="削除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
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
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-400">社員を選択してください</p>
        </div>
      )}
    </div>
  );
}
