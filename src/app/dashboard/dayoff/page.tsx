"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface DayOff {
  id: string;
  userId: string;
  date: string;
  type: string;
  user: { name: string };
}

const DAY_OFF_TYPES = ["", "休み", "午前休"];

const TYPE_COLORS: Record<string, string> = {
  "休み": "bg-red-100 text-red-700",
  "午前休": "bg-yellow-100 text-yellow-700",
};

const TYPE_DOT_COLORS: Record<string, string> = {
  "休み": "bg-red-400",
  "午前休": "bg-yellow-400",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export default function DayOffPage() {
  const { data: session } = useSession();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [myDayOffs, setMyDayOffs] = useState<DayOff[]>([]);
  const [allDayOffs, setAllDayOffs] = useState<DayOff[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  const [year, month] = selectedMonth.split("-").map(Number);
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    fetchDayOffs();
  }, [selectedMonth]);

  const fetchDayOffs = async () => {
    // 自分の休み
    const myRes = await fetch(`/api/dayoff?month=${selectedMonth}&userId=${session?.user?.id}`);
    if (myRes.ok) setMyDayOffs(await myRes.json());

    // 全員の休み
    const allRes = await fetch(`/api/dayoff?month=${selectedMonth}`);
    if (allRes.ok) setAllDayOffs(await allRes.json());
  };

  const handleDayOffChange = async (date: string, type: string) => {
    setSaving(date);
    try {
      await fetch("/api/dayoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, type }),
      });
      await fetchDayOffs();
    } catch {
      // ignore
    }
    setSaving(null);
  };

  const getMyDayOff = (date: string) => {
    return myDayOffs.find((d) => d.date === date);
  };

  const getDayOffsForDate = (date: string) => {
    return allDayOffs.filter((d) => d.date === date);
  };

  // カレンダーの日付配列を生成
  const calendarDays: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const nextMonth = () => {
    const d = new Date(year, month, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">みんなのお休み</h1>
        <p className="text-gray-500 mt-1">自分の休みを登録し、みんなの休みを確認できます</p>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center gap-4">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-gray-800">
          {year}年{month}月
        </h2>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap gap-3">
        {DAY_OFF_TYPES.filter(Boolean).map((type) => (
          <span key={type} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[type]}`}>
            <span className={`w-2 h-2 rounded-full ${TYPE_DOT_COLORS[type]}`}></span>
            {type}
          </span>
        ))}
      </div>

      {/* 自分の休み */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">自分の休み</h3>
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
          {/* Weekday headers */}
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`bg-gray-50 py-2 text-center text-xs font-medium ${
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-500"
              }`}
            >
              {day}
            </div>
          ))}
          {/* Calendar cells */}
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="bg-gray-50 min-h-[70px]"></div>;
            }
            const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
            const dayOff = getMyDayOff(dateStr);
            const dayOfWeek = (firstDay + day - 1) % 7;
            const isToday = dateStr === todayStr;
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;

            return (
              <div
                key={dateStr}
                className={`bg-white min-h-[70px] p-1.5 ${isToday ? "ring-2 ring-blue-400 ring-inset" : ""}`}
              >
                <div className={`text-xs font-medium mb-1 ${
                  isToday ? "text-blue-600" : isSunday ? "text-red-400" : isSaturday ? "text-blue-400" : "text-gray-600"
                }`}>
                  {day}
                </div>
                <select
                  value={dayOff?.type || ""}
                  onChange={(e) => handleDayOffChange(dateStr, e.target.value)}
                  disabled={saving === dateStr}
                  className={`w-full text-xs rounded px-1 py-0.5 border outline-none cursor-pointer ${
                    dayOff ? `${TYPE_COLORS[dayOff.type]} border-transparent` : "border-gray-200 text-gray-400"
                  } ${saving === dateStr ? "opacity-50" : ""}`}
                >
                  <option value="">-</option>
                  {DAY_OFF_TYPES.filter(Boolean).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {/* みんなの休み */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">みんなの休み</h3>
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
          {/* Weekday headers */}
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`bg-gray-50 py-2 text-center text-xs font-medium ${
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-500"
              }`}
            >
              {day}
            </div>
          ))}
          {/* Calendar cells */}
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <div key={`empty2-${idx}`} className="bg-gray-50 min-h-[80px]"></div>;
            }
            const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
            const dayOffs = getDayOffsForDate(dateStr);
            const dayOfWeek = (firstDay + day - 1) % 7;
            const isToday = dateStr === todayStr;
            const isSunday = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;

            return (
              <div
                key={dateStr}
                className={`bg-white min-h-[80px] p-1.5 ${isToday ? "ring-2 ring-blue-400 ring-inset" : ""}`}
              >
                <div className={`text-xs font-medium mb-1 flex items-center gap-1 ${
                  isToday ? "text-blue-600" : isSunday ? "text-red-400" : isSaturday ? "text-blue-400" : "text-gray-600"
                }`}>
                  {day}
                  {dayOffs.length > 0 && (
                    <span className="bg-red-100 text-red-600 text-[10px] px-1 rounded-full font-bold">
                      {dayOffs.length}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {dayOffs.map((d) => (
                    <div
                      key={d.id}
                      className={`text-[10px] leading-tight px-1 py-0.5 rounded truncate ${TYPE_COLORS[d.type]}`}
                      title={`${d.user.name} - ${d.type}`}
                    >
                      {d.user.name}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
