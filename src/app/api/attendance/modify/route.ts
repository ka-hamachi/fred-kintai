import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { attendanceId, clockIn, clockOut, breakStart, breakEnd, note } = body;

  if (!attendanceId) {
    return NextResponse.json(
      { error: "勤怠IDが必要です" },
      { status: 400 }
    );
  }

  const existing = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "勤怠記録が見つかりません" },
      { status: 404 }
    );
  }

  // undefined = フィールド未送信(既存値維持), null = 明示的にクリア
  const newClockIn = clockIn === undefined ? existing.clockIn : clockIn ? new Date(clockIn) : null;
  const newClockOut = clockOut === undefined ? existing.clockOut : clockOut ? new Date(clockOut) : null;
  const newBreakStart = breakStart === undefined ? existing.breakStart : breakStart ? new Date(breakStart) : null;
  const newBreakEnd = breakEnd === undefined ? existing.breakEnd : breakEnd ? new Date(breakEnd) : null;

  // Calculate durations
  let breakDuration: number | null = null;
  let workDuration: number | null = null;

  if (newBreakStart && newBreakEnd) {
    breakDuration = Math.round(
      (newBreakEnd.getTime() - newBreakStart.getTime()) / 60000
    );
  }

  if (newClockIn && newClockOut) {
    workDuration =
      Math.round((newClockOut.getTime() - newClockIn.getTime()) / 60000) -
      (breakDuration || 0);
  }

  const attendance = await prisma.attendance.update({
    where: { id: attendanceId },
    data: {
      clockIn: newClockIn,
      clockOut: newClockOut,
      breakStart: newBreakStart,
      breakEnd: newBreakEnd,
      workDuration,
      breakDuration,
      note: note || existing.note,
      modifiedBy: session.user.name,
      modifiedAt: new Date(),
    },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(attendance);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { userId, date, clockIn, clockOut, breakStart, breakEnd, note } = body;

  if (!userId || !date) {
    return NextResponse.json(
      { error: "社員IDと日付が必要です" },
      { status: 400 }
    );
  }

  let workDuration: number | null = null;
  let breakDuration: number | null = null;

  const ciDate = clockIn ? new Date(clockIn) : null;
  const coDate = clockOut ? new Date(clockOut) : null;
  const bsDate = breakStart ? new Date(breakStart) : null;
  const beDate = breakEnd ? new Date(breakEnd) : null;

  if (bsDate && beDate) {
    breakDuration = Math.round((beDate.getTime() - bsDate.getTime()) / 60000);
  }
  if (ciDate && coDate) {
    workDuration =
      Math.round((coDate.getTime() - ciDate.getTime()) / 60000) -
      (breakDuration || 0);
  }

  const attendance = await prisma.attendance.upsert({
    where: { userId_date: { userId, date } },
    update: {
      clockIn: ciDate,
      clockOut: coDate,
      breakStart: bsDate,
      breakEnd: beDate,
      workDuration,
      breakDuration,
      note,
      modifiedBy: session.user.name,
      modifiedAt: new Date(),
    },
    create: {
      userId,
      date,
      clockIn: ciDate,
      clockOut: coDate,
      breakStart: bsDate,
      breakEnd: beDate,
      workDuration,
      breakDuration,
      note,
      modifiedBy: session.user.name,
      modifiedAt: new Date(),
    },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(attendance);
}
