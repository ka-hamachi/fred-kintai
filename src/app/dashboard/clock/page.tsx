"use client";

import { useEffect, useState } from "react";

interface Attendance {
  id: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  breakDuration: number | null;
  workDuration: number | null;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "--:--";
  return new Date(dateStr).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(minutes: number | null) {
  if (minutes === null || minutes === undefined) return "--:--";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}時間${String(m).padStart(2, "0")}分`;
}

// 10分刻みで10〜300分の選択肢を生成
function getBreakOptions() {
  const options: number[] = [0];
  for (let m = 10; m <= 300; m += 10) {
    options.push(m);
  }
  return options;
}

export default function ClockPage() {
  const [activeSession, setActiveSession] = useState<Attendance | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingBreak, setSavingBreak] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchActiveSession();
  }, []);

  const fetchActiveSession = async () => {
    // Fetch active (un-clocked-out) session
    const res = await fetch("/api/attendance?active=true");
    if (res.ok) {
      const data = await res.json();
      setActiveSession(data);
    }
  };

  const handleAction = async (action: string) => {
    setLoading(action);
    setMessage(null);

    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: "error", text: data.error });
      } else {
        if (action === "clockOut") {
          // After clock out, clear active session
          setActiveSession(null);
        } else {
          setActiveSession(data);
        }
        const messages: Record<string, string> = {
          clockIn: "出勤を記録しました",
          clockOut: "退勤を記録しました",
        };
        setMessage({ type: "success", text: messages[action] });
      }
    } catch {
      setMessage({ type: "error", text: "エラーが発生しました" });
    }

    setLoading(null);
  };

  const handleBreakChange = async (minutes: number) => {
    if (!activeSession?.id) return;
    setSavingBreak(true);

    try {
      const res = await fetch("/api/attendance/break", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId: activeSession.id, breakDuration: minutes }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveSession(data);
        setMessage({ type: "success", text: `休憩時間を${minutes}分に設定しました` });
      }
    } catch {
      setMessage({ type: "error", text: "エラーが発生しました" });
    }

    setSavingBreak(false);
  };

  const canClockIn = !activeSession;
  const canClockOut = !!activeSession?.clockIn;

  const getStatusInfo = () => {
    if (!activeSession) return { text: "未出勤", bg: "bg-gray-50", border: "border-gray-200", dot: "bg-gray-400" };
    if (activeSession.clockOut) return { text: "退勤済", bg: "bg-green-50", border: "border-green-200", dot: "bg-green-400" };
    return { text: "勤務中", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-400" };
  };

  const statusInfo = getStatusInfo();

  // Check if active session is from a different date than today
  const isCarryOver = (() => {
    if (!activeSession?.clockIn) return false;
    const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const today = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
    return activeSession.date !== today;
  })();

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">勤怠入力</h1>
        <p className="text-gray-500 mt-1">打刻ボタンを押して勤怠を記録してください</p>
      </div>

      {/* Current Time & Status */}
      <div className={`rounded-2xl border ${statusInfo.border} ${statusInfo.bg} p-8 text-center`}>
        <p className="text-5xl font-light text-gray-800 tabular-nums">
          {currentTime.toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
        <p className="text-gray-500 mt-2">
          {currentTime.toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <span className={`w-2 h-2 rounded-full ${statusInfo.dot} animate-pulse`}></span>
          <span className="text-sm font-medium text-gray-600">{statusInfo.text}</span>
        </div>
        {isCarryOver && (
          <p className="text-xs text-amber-600 mt-2">
            {new Date(activeSession!.date + "T00:00:00").toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}
            からの勤務を継続中
          </p>
        )}
      </div>

      {/* Message */}
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

      {/* Action Buttons - 出勤・退勤のみ */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => handleAction("clockIn")}
          disabled={!canClockIn || loading !== null}
          className="relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-50 disabled:hover:border-blue-200"
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
          </svg>
          <span className="text-lg font-bold">出勤</span>
          {loading === "clockIn" && (
            <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 rounded-2xl">
              <svg className="animate-spin w-6 h-6 text-blue-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </button>

        <button
          onClick={() => handleAction("clockOut")}
          disabled={!canClockOut || loading !== null}
          className="relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-50 disabled:hover:border-red-200"
        >
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="text-lg font-bold">退勤</span>
          {loading === "clockOut" && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50/80 rounded-2xl">
              <svg className="animate-spin w-6 h-6 text-red-600" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </button>
      </div>

      {/* Active Session Summary */}
      {activeSession?.clockIn && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {isCarryOver
              ? `${new Date(activeSession.date + "T00:00:00").toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}からの勤務記録`
              : "本日の記録"}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">出勤時刻</p>
              <p className="text-lg font-medium text-gray-700">{formatTime(activeSession.clockIn)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">退勤時刻</p>
              <p className="text-lg font-medium text-gray-700">{formatTime(activeSession.clockOut)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">休憩時間</p>
              <select
                value={activeSession.breakDuration || 0}
                onChange={(e) => handleBreakChange(Number(e.target.value))}
                disabled={savingBreak}
                className={`text-lg font-medium text-gray-700 bg-transparent outline-none cursor-pointer ${savingBreak ? "opacity-50" : ""}`}
              >
                {getBreakOptions().map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "なし" : `${m}分`}
                  </option>
                ))}
              </select>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-1">勤務時間</p>
              <p className="text-lg font-medium text-gray-700">{formatDuration(activeSession.workDuration)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
