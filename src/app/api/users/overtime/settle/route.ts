import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 前月の過不足を自動計算して overtimeBalance に加算する
// ダッシュボード表示時に呼ばれ、当月まだ精算していない場合に実行
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const now = new Date();

  // 前月の年月を計算
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevYear = prevMonth.getFullYear();
  const prevMonthNum = prevMonth.getMonth() + 1;
  const prevMonthStr = `${prevYear}-${String(prevMonthNum).padStart(2, "0")}`;

  // 精算済みかチェック（前月の精算キーで確認）
  const settleKey = `settled_${prevMonthStr}`;
  const existingSettle = await prisma.attendance.findFirst({
    where: {
      userId,
      note: settleKey,
    },
  });

  if (existingSettle) {
    // 既に精算済み
    return NextResponse.json({ settled: false, message: "already settled" });
  }

  // 前月の勤怠データを取得
  const prevAttendances = await prisma.attendance.findMany({
    where: {
      userId,
      date: { startsWith: prevMonthStr },
    },
  });

  // 前月のデータがない場合はスキップ（初月など）
  if (prevAttendances.length === 0) {
    return NextResponse.json({ settled: false, message: "no data" });
  }

  // 前月の総労働時間（分）
  const totalWorkMinutes = prevAttendances.reduce(
    (sum, a) => sum + (a.workDuration || 0),
    0
  );

  // 前月の規定労働時間: (前月の日数 - 8) × 10時間
  const daysInPrevMonth = new Date(prevYear, prevMonthNum, 0).getDate();
  const requiredMinutes = (daysInPrevMonth - 8) * 10 * 60;

  // 過不足 = 実績 - 規定
  const diff = totalWorkMinutes - requiredMinutes;

  // ユーザーの overtimeBalance を更新
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      overtimeBalance: { increment: diff },
    },
    select: { overtimeBalance: true },
  });

  // 精算済みマークを記録（特殊なattendanceレコードとして）
  await prisma.attendance.create({
    data: {
      userId,
      date: `${prevMonthStr}-settle`,
      note: settleKey,
    },
  });

  return NextResponse.json({
    settled: true,
    diff,
    newBalance: user.overtimeBalance,
  });
}
