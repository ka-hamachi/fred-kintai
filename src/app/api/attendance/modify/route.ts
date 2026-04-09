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
  const { attendanceId, clockIn, clockOut, breakDuration: bodyBreakDuration, note } = body;

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
  const breakDuration = bodyBreakDuration !== undefined ? bodyBreakDuration : existing.breakDuration;

  // Calculate work duration
  let workDuration: number | null = null;
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

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const attendanceId = searchParams.get("id");

  if (!attendanceId) {
    return NextResponse.json({ error: "勤怠IDが必要です" }, { status: 400 });
  }

  const existing = await prisma.attendance.findUnique({
    where: { id: attendanceId },
  });

  if (!existing) {
    return NextResponse.json({ error: "勤怠記録が見つかりません" }, { status: 404 });
  }

  await prisma.attendance.delete({ where: { id: attendanceId } });

  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { userId, date, clockIn, clockOut, breakDuration: bodyBreakDuration, note } = body;

  if (!userId || !date) {
    return NextResponse.json(
      { error: "社員IDと日付が必要です" },
      { status: 400 }
    );
  }

  let workDuration: number | null = null;
  const breakDuration = bodyBreakDuration || 0;

  const ciDate = clockIn ? new Date(clockIn) : null;
  const coDate = clockOut ? new Date(clockOut) : null;

  if (ciDate && coDate) {
    workDuration =
      Math.round((coDate.getTime() - ciDate.getTime()) / 60000) -
      breakDuration;
  }

  const attendance = await prisma.attendance.create({
    data: {
      userId,
      date,
      clockIn: ciDate,
      clockOut: coDate,
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
