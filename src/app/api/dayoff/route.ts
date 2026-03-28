import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 休み一覧取得
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  const userId = searchParams.get("userId");

  const where: { date?: { startsWith: string }; userId?: string } = {};
  if (month) where.date = { startsWith: month };
  if (userId) where.userId = userId;

  const dayOffs = await prisma.dayOff.findMany({
    where,
    include: { user: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(dayOffs);
}

// 休みの登録・更新・削除
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { date, type } = body;

  if (!date) {
    return NextResponse.json({ error: "日付が必要です" }, { status: 400 });
  }

  const userId = session.user.id;

  // typeが空なら削除（休みを解除）
  if (!type || type === "") {
    await prisma.dayOff.deleteMany({
      where: { userId, date },
    });
    return NextResponse.json({ deleted: true });
  }

  const dayOff = await prisma.dayOff.upsert({
    where: { userId_date: { userId, date } },
    update: { type },
    create: { userId, date, type },
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json(dayOff);
}
