import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function getToday() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC+9 (JST)
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
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
  const active = searchParams.get("active"); // "true" - get active session

  // Non-admin can only view their own records
  if (userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find active (un-clocked-out) session
  if (active === "true") {
    const activeSession = await prisma.attendance.findFirst({
      where: {
        userId,
        clockIn: { not: null },
        clockOut: null,
      },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { clockIn: "desc" },
    });
    return NextResponse.json(activeSession);
  }

  if (date) {
    // Return all records for this date (may be multiple)
    const attendances = await prisma.attendance.findMany({
      where: { userId, date },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { clockIn: "asc" },
    });
    // For backward compatibility, return first record if single, array if multiple
    if (attendances.length <= 1) {
      return NextResponse.json(attendances[0] || null);
    }
    return NextResponse.json(attendances);
  }

  const where: { userId: string; date?: { startsWith: string } } = { userId };
  if (month) {
    where.date = { startsWith: month };
  }

  const attendances = await prisma.attendance.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: [{ date: "desc" }, { clockIn: "asc" }],
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

  if (action === "clockIn") {
    // Check for active (un-clocked-out) session across any date
    const activeSession = await prisma.attendance.findFirst({
      where: {
        userId: session.user.id,
        clockIn: { not: null },
        clockOut: null,
      },
    });

    if (activeSession) {
      return NextResponse.json(
        { error: "未退勤の勤務記録があります。先に退勤してください" },
        { status: 400 }
      );
    }

    // Create new attendance record (allows multiple per day)
    const attendance = await prisma.attendance.create({
      data: {
        userId: session.user.id,
        date: today,
        clockIn: now,
      },
    });
    return NextResponse.json(attendance);
  } else if (action === "clockOut") {
    // Find the active session (across any date)
    const activeSession = await prisma.attendance.findFirst({
      where: {
        userId: session.user.id,
        clockIn: { not: null },
        clockOut: null,
      },
      orderBy: { clockIn: "desc" },
    });

    if (!activeSession) {
      return NextResponse.json(
        { error: "出勤打刻がありません" },
        { status: 400 }
      );
    }

    // Calculate work duration
    const clockInTime = new Date(activeSession.clockIn!).getTime();
    const breakDur = activeSession.breakDuration || 0;
    const workMinutes = Math.round((now.getTime() - clockInTime) / 60000) - breakDur;

    const attendance = await prisma.attendance.update({
      where: { id: activeSession.id },
      data: {
        clockOut: now,
        workDuration: workMinutes,
      },
    });
    return NextResponse.json(attendance);
  } else if (action === "breakStart") {
    const activeSession = await prisma.attendance.findFirst({
      where: {
        userId: session.user.id,
        clockIn: { not: null },
        clockOut: null,
      },
    });

    if (!activeSession) {
      return NextResponse.json(
        { error: "出勤打刻がありません" },
        { status: 400 }
      );
    }
    if (activeSession.breakStart && !activeSession.breakEnd) {
      return NextResponse.json(
        { error: "休憩中です" },
        { status: 400 }
      );
    }
    const attendance = await prisma.attendance.update({
      where: { id: activeSession.id },
      data: { breakStart: now, breakEnd: null },
    });
    return NextResponse.json(attendance);
  } else if (action === "breakEnd") {
    const activeSession = await prisma.attendance.findFirst({
      where: {
        userId: session.user.id,
        clockIn: { not: null },
        clockOut: null,
      },
    });

    if (!activeSession || !activeSession.breakStart || activeSession.breakEnd) {
      return NextResponse.json(
        { error: "休憩開始の打刻がありません" },
        { status: 400 }
      );
    }
    const breakStartTime = new Date(activeSession.breakStart).getTime();
    const breakMinutes = Math.round((now.getTime() - breakStartTime) / 60000);
    const totalBreak = (activeSession.breakDuration || 0) + breakMinutes;

    const attendance = await prisma.attendance.update({
      where: { id: activeSession.id },
      data: {
        breakEnd: now,
        breakDuration: totalBreak,
      },
    });
    return NextResponse.json(attendance);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
