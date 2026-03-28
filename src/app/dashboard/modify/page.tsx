"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
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
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
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
    breakStart: "",
    breakEnd: "",
    note: "",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  // New record state
  const [showNewForm, setShowNewForm] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newFormData, setNewFormData] = useState({
    clockIn: "",
    clockOut: "",
    breakStart: "",
    breakEnd: "",
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
      breakStart: toLocalDatetimeValue(record.breakStart),
      breakEnd: toLocalDatetimeValue(record.breakEnd),
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
          clockIn: formData.clockIn || null,
          clockOut: formData.clockOut || null,
          breakStart: formData.breakStart || null,
          breakEnd: formData.breakEnd || null,
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
          clockIn: newFormData.clockIn || null,
          clockOut: newFormData.clockOut || null,
          breakStart: newFormData.breakStart || null,
          breakEnd: newFormData.breakEnd || null,
          note: newFormData.note || null,
        }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "勤怠記録を追加しました" });
        setShowNewForm(false);
        setNewDate("");
        setNewFormData({ clockIn: "", clockOut: "", breakStart: "", breakEnd: "", note: "" });
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
              <label className="block text-xs text-gray-400 mb-1">休憩開始</label>
              <input
                type="datetime-local"
                value={newFormData.breakStart}
                onChange={(e) => setNewFormData({ ...newFormData, breakStart: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">休憩終了</label>
              <input
                type="datetime-local"
                value={newFormData.breakEnd}
                onChange={(e) => setNewFormData({ ...newFormData, breakEnd: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
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
                <div>
                  <label className="block text-xs text-gray-400 mb-1">休憩開始</label>
                  <input
                    type="datetime-local"
                    value={formData.breakStart}
                    onChange={(e) => setFormData({ ...formData, breakStart: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">休憩終了</label>
                  <input
                    type="datetime-local"
                    value={formData.breakEnd}
                    onChange={(e) => setFormData({ ...formData, breakEnd: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
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
                    <td className="px-6 py-4 text-sm text-gray-600">{formatDuration(record.breakDuration)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">{formatDuration(record.workDuration)}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">{record.modifiedBy || "-"}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => startEdit(record)}
                        className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors"
                      >
                        修正
                      </button>
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
