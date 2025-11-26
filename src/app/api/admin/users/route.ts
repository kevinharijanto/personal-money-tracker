import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const admin = requireAdmin(req);
  if (!admin.ok) {
    return admin.response;
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      memberships: {
        include: {
          household: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  const payload = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    households: user.memberships.map((membership) => ({
      id: membership.household.id,
      name: membership.household.name,
      role: membership.role,
    })),
  }));

  return NextResponse.json({ users: payload });
}
