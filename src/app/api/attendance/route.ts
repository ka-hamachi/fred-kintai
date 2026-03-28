import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || session.user.id;
  const month = searchParams.get("month"); // YYYY-MM
  const date = searchParams.get("date"); // YYYY-MM-DD

  // Non-admin can only view their own records
  if (userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (date) {
    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date } },
      include: { user: { select: { name: true, email: true } } },
    });
    return NextResponse.json(attendance);
  }

  const where: { userId: string; date?: { startsWith: string } } = { userId };
  if (month) {
    where.date = { startsWith: month };
  }

  const attendances = await prisma.attendance.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(attendances);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { action } = body; // clockIn, clockOut, breakStart, breakEnd
  const today = getToday();
  const now = new Date();

  let attendance = await prisma.attendance.findUnique({
    where: { userId_date: { userId: session.user.id, date: today } },
  });

  if (action === "clockIn") {
    if (attendance?.clockIn) {
      return NextResponse.json(
        { error: "本日は既に出勤済みです" },
        { status: 400 }
      );
    }
    attendance = await prisma.attendance.upsert({
      where: { userId_date: { userId: session.user.id, date: today } },
      update: { clockIn: now },
      create: {
        userId: session.user.id,
        date: today,
        clockIn: now,
      },
    });
  } else if (action === "clockOut") {
    if (!attendance?.clockIn) {
      return NextResponse.json(
        { error: "出勤打刻がありません" },
        { status: 400 }
      );
    }
    if (attendance?.clockOut) {
      return NextResponse.json(
        { error: "本日は既に退勤済みです" },
        { status: 400 }
      );
    }

    // Calculate work duration
    const clockInTime = new Date(attendance.clockIn).getTime();
    const breakDur = attendance.breakDuration || 0;
    const workMinutes = Math.round((now.getTime() - clockInTime) / 60000) - breakDur;

    attendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockOut: now,
        workDuration: workMinutes,
      },
    });
  } else if (action === "breakStart") {
    if (!attendance?.clockIn) {
      return NextResponse.json(
        { error: "出勤打刻がありません" },
        { status: 400 }
      );
    }
    if (attendance?.breakStart && !attendance?.breakEnd) {
      return NextResponse.json(
        { error: "休憩中です" },
        { status: 400 }
      );
    }
    attendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: { breakStart: now, breakEnd: null },
    });
  } else if (action === "breakEnd") {
    if (!attendance?.breakStart || attendance?.breakEnd) {
      return NextResponse.json(
        { error: "休憩開始の打刻がありません" },
        { status: 400 }
      );
    }
    const breakStartTime = new Date(attendance.breakStart).getTime();
    const breakMinutes = Math.round((now.getTime() - breakStartTime) / 60000);
    const totalBreak = (attendance.breakDuration || 0) + breakMinutes;

    attendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        breakEnd: now,
        breakDuration: totalBreak,
      },
    });
  }

  return NextResponse.json(attendance);
}
