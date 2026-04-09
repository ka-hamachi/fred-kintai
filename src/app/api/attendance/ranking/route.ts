import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM

  if (!month) {
    return NextResponse.json({ error: "month parameter required" }, { status: 400 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      attendances: {
        where: {
          date: { startsWith: month },
          workDuration: { not: null },
        },
        select: {
          workDuration: true,
        },
      },
    },
  });

  const ranking = users
    .map((user) => ({
      id: user.id,
      name: user.name,
      totalMinutes: user.attendances.reduce((sum, a) => sum + (a.workDuration || 0), 0),
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  return NextResponse.json(ranking);
}
