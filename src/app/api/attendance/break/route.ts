import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 休憩時間の更新（従業員も自分の分は可能）
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { attendanceId, breakDuration } = body;

  if (!attendanceId || breakDuration === undefined) {
    return NextResponse.json({ error: "無効なリクエストです" }, { status: 400 });
  }

  const existing = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!existing) {
    return NextResponse.json({ error: "勤怠記録が見つかりません" }, { status: 404 });
  }

  // 従業員は自分の記録のみ、管理者は全員可能
  if (existing.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 勤務時間を再計算
  let workDuration = existing.workDuration;
  if (existing.clockIn && existing.clockOut) {
    const clockInTime = new Date(existing.clockIn).getTime();
    const clockOutTime = new Date(existing.clockOut).getTime();
    workDuration = Math.round((clockOutTime - clockInTime) / 60000) - breakDuration;
  }

  const attendance = await prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      breakDuration,
      workDuration,
    },
  });

  return NextResponse.json(attendance);
}
