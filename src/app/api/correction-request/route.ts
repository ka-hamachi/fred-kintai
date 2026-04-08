import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: List correction requests
// - Employees see their own requests
// - Admins see all pending requests (or filtered by status)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const isAdmin = session.user.role === "admin";

  const where: Record<string, unknown> = {};

  if (!isAdmin) {
    where.userId = session.user.id;
  }

  if (status) {
    where.status = status;
  }

  const requests = await prisma.correctionRequest.findMany({
    where,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

// POST: Create a new correction request (employee submits)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { attendanceId, date, requestedClockIn, requestedClockOut, requestedBreakDuration, reason } = body;

  if (!date) {
    return NextResponse.json({ error: "日付が必要です" }, { status: 400 });
  }

  const correctionRequest = await prisma.correctionRequest.create({
    data: {
      userId: session.user.id,
      attendanceId: attendanceId || null,
      date,
      requestedClockIn: requestedClockIn ? new Date(requestedClockIn) : null,
      requestedClockOut: requestedClockOut ? new Date(requestedClockOut) : null,
      requestedBreakDuration: requestedBreakDuration ?? null,
      reason: reason || null,
      status: "pending",
    },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(correctionRequest);
}

// PUT: Approve or reject a correction request (admin only)
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { requestId, action } = body; // action: "approved" | "rejected"

  if (!requestId || !["approved", "rejected"].includes(action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const correctionReq = await prisma.correctionRequest.findUnique({
    where: { id: requestId },
  });

  if (!correctionReq) {
    return NextResponse.json({ error: "修正依頼が見つかりません" }, { status: 404 });
  }

  if (correctionReq.status !== "pending") {
    return NextResponse.json({ error: "この依頼は既に処理済みです" }, { status: 400 });
  }

  // If approved, apply the correction to the attendance record
  if (action === "approved") {
    const newClockIn = correctionReq.requestedClockIn;
    const newClockOut = correctionReq.requestedClockOut;
    const breakDuration = correctionReq.requestedBreakDuration ?? 0;

    let workDuration: number | null = null;
    if (newClockIn && newClockOut) {
      workDuration =
        Math.round((newClockOut.getTime() - newClockIn.getTime()) / 60000) -
        breakDuration;
    }

    // If attendanceId is specified, update that specific record; otherwise create new
    if (correctionReq.attendanceId) {
      await prisma.attendance.update({
        where: { id: correctionReq.attendanceId },
        data: {
          clockIn: newClockIn,
          clockOut: newClockOut,
          breakDuration,
          workDuration,
          modifiedBy: session.user.name,
          modifiedAt: new Date(),
          note: correctionReq.reason || "修正依頼による修正",
        },
      });
    } else {
      await prisma.attendance.create({
        data: {
          userId: correctionReq.userId,
          date: correctionReq.date,
          clockIn: newClockIn,
          clockOut: newClockOut,
          breakDuration,
          workDuration,
          modifiedBy: session.user.name,
          modifiedAt: new Date(),
          note: correctionReq.reason || "修正依頼による修正",
        },
      });
    }
  }

  const updated = await prisma.correctionRequest.update({
    where: { id: requestId },
    data: {
      status: action,
      reviewedBy: session.user.name,
      reviewedAt: new Date(),
    },
    include: { user: { select: { name: true, email: true } } },
  });

  return NextResponse.json(updated);
}
