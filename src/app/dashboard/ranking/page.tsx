"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface RankingEntry {
  id: string;
  name: string;
  totalMinutes: number;
}

function formatDuration(minutes: number) {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.abs(minutes) % 60;
  const sign = minutes < 0 ? "-" : "";
  return `${sign}${h}時間${String(m).padStart(2, "0")}分`;
}

export default function RankingPage() {
  const { data: session } = useSession();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRanking = async () => {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const res = await fetch(`/api/attendance/ranking?month=${month}`);
      if (res.ok) {
        setRanking(await res.json());
      }
      setLoading(false);
    };
    fetchRanking();
  }, []);

  const now = new Date();
  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">勤怠ランキング</h1>
        <p className="text-gray-500 mt-1">{monthLabel}の総労働時間ランキング</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        {loading ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            読み込み中...
          </div>
        ) : ranking.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400 text-sm">
            今月の勤怠データはまだありません
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {ranking.map((entry, index) => {
              const rank = index + 1;
              const isMe = entry.id === session?.user?.id;
              const medal =
                rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

              const maxMinutes = ranking[0]?.totalMinutes || 1;
              const barWidth = (entry.totalMinutes / maxMinutes) * 100;

              return (
                <div
                  key={entry.id}
                  className={`relative flex items-center gap-4 px-6 py-4 ${isMe ? "bg-blue-50/50" : "hover:bg-gray-50/50"}`}
                >
                  <div
                    className={`absolute inset-y-0 left-0 ${isMe ? "bg-blue-100/40" : "bg-gray-100/50"}`}
                    style={{ width: `${barWidth}%` }}
                  />
                  <div className="relative w-10 text-center flex-shrink-0">
                    {medal ? (
                      <span className="text-2xl">{medal}</span>
                    ) : (
                      <span className="text-sm font-bold text-gray-400">{rank}</span>
                    )}
                  </div>
                  <div className="relative flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isMe ? "text-blue-700" : "text-gray-700"}`}>
                      {entry.name}
                      {isMe && <span className="ml-2 text-xs text-blue-500">（あなた）</span>}
                    </p>
                  </div>
                  <div className="relative text-right flex-shrink-0">
                    <p className={`text-sm font-bold tabular-nums ${rank <= 3 ? "text-gray-800" : "text-gray-600"}`}>
                      {formatDuration(entry.totalMinutes)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
