"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  overtimeBalance: number;
  createdAt: string;
}

function formatDuration(minutes: number) {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : minutes > 0 ? "+" : "±";
  if (minutes === 0) return "±0";
  return `${sign}${h}時間${String(m).padStart(2, "0")}分`;
}

export default function UsersPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isAdmin = session?.user?.role === "admin";

  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
  });
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // 過不足編集
  const [editingOvertimeUserId, setEditingOvertimeUserId] = useState<string | null>(null);
  const [overtimeHours, setOvertimeHours] = useState("");
  const [overtimeMinutes, setOvertimeMinutes] = useState("");
  const [overtimeSign, setOvertimeSign] = useState<"+" | "-">("+");

  useEffect(() => {
    if (!isAdmin) {
      router.push("/dashboard");
      return;
    }
    fetchUsers();
  }, [isAdmin, router]);

  const fetchUsers = async () => {
    const res = await fetch("/api/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: `${data.name}さんのアカウントを作成しました` });
        setFormData({ name: "", email: "", password: "", role: "employee" });
        setShowForm(false);
        fetchUsers();
      } else {
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "エラーが発生しました" });
    }

    setSaving(false);
  };

  const startEditOvertime = (user: User) => {
    const absMinutes = Math.abs(user.overtimeBalance);
    const h = Math.floor(absMinutes / 60);
    const m = absMinutes % 60;
    setEditingOvertimeUserId(user.id);
    setOvertimeHours(String(h));
    setOvertimeMinutes(String(m));
    setOvertimeSign(user.overtimeBalance >= 0 ? "+" : "-");
  };

  const saveOvertime = async (userId: string) => {
    const totalMinutes = (parseInt(overtimeHours) || 0) * 60 + (parseInt(overtimeMinutes) || 0);
    const value = overtimeSign === "-" ? -totalMinutes : totalMinutes;

    try {
      const res = await fetch("/api/users/overtime", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, overtimeBalance: value }),
      });

      if (res.ok) {
        setMessage({ type: "success", text: "過不足労働時間を更新しました" });
        setEditingOvertimeUserId(null);
        fetchUsers();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "エラーが発生しました" });
      }
    } catch {
      setMessage({ type: "error", text: "エラーが発生しました" });
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">社員管理</h1>
          <p className="text-gray-500 mt-1">社員アカウントの管理・発行</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {showForm ? "キャンセル" : "+ 新規アカウント発行"}
        </button>
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

      {/* New User Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">新規アカウント発行</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">氏名</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="山田 太郎"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="yamada@fred.co.jp"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    placeholder="パスワード"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">権限</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                  <option value="employee">従業員</option>
                  <option value="admin">管理者</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? "作成中..." : "アカウントを作成"}
            </button>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h3 className="text-sm font-semibold text-gray-600">
            登録社員一覧（{users.length}名）
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-400 bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-3 font-medium">氏名</th>
                <th className="px-6 py-3 font-medium">メールアドレス</th>
                <th className="px-6 py-3 font-medium">権限</th>
                <th className="px-6 py-3 font-medium">過不足労働時間</th>
                <th className="px-6 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-sm font-medium">
                        {user.name.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {user.role === "admin" ? "管理者" : "従業員"}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {editingOvertimeUserId === user.id ? (
                      <div className="flex items-center gap-1.5">
                        <select
                          value={overtimeSign}
                          onChange={(e) => setOvertimeSign(e.target.value as "+" | "-")}
                          className="px-1.5 py-1 border border-gray-200 rounded text-sm text-gray-700 outline-none"
                        >
                          <option value="+">+</option>
                          <option value="-">-</option>
                        </select>
                        <input
                          type="number"
                          value={overtimeHours}
                          onChange={(e) => setOvertimeHours(e.target.value)}
                          className="w-14 px-2 py-1 border border-gray-200 rounded text-sm text-gray-700 outline-none text-center"
                          min="0"
                          placeholder="0"
                        />
                        <span className="text-xs text-gray-400">時間</span>
                        <input
                          type="number"
                          value={overtimeMinutes}
                          onChange={(e) => setOvertimeMinutes(e.target.value)}
                          className="w-14 px-2 py-1 border border-gray-200 rounded text-sm text-gray-700 outline-none text-center"
                          min="0"
                          max="59"
                          placeholder="0"
                        />
                        <span className="text-xs text-gray-400">分</span>
                        <button
                          onClick={() => saveOvertime(user.id)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingOvertimeUserId(null)}
                          className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs font-medium hover:bg-gray-200"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`text-sm font-medium ${
                          user.overtimeBalance > 0
                            ? "text-purple-600"
                            : user.overtimeBalance < 0
                            ? "text-red-600"
                            : "text-gray-500"
                        }`}
                      >
                        {formatDuration(user.overtimeBalance)}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingOvertimeUserId !== user.id && (
                      <button
                        onClick={() => startEditOvertime(user)}
                        className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-100 transition-colors"
                      >
                        過不足編集
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-gray-400 text-sm">
                    社員が登録されていません
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
