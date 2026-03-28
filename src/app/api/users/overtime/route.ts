import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 過不足労働時間の取得
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || session.user.id;

  // 従業員は自分の情報のみ取得可能
  if (userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, overtimeBalance: true },
  });

  return NextResponse.json(user);
}

// 過不足労働時間の更新（管理者のみ）
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { userId, overtimeBalance } = body;

  if (!userId || overtimeBalance === undefined) {
    return NextResponse.json(
      { error: "社員IDと過不足時間が必要です" },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { overtimeBalance: Math.round(overtimeBalance) },
    select: { id: true, name: true, overtimeBalance: true },
  });

  return NextResponse.json(user);
}
