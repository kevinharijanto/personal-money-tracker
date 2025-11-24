import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/hybrid-auth";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";


export const GET = withAuth(async (req: Request, userId: string) => {
  // Get the current user's email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Find all pending invitations for this user's email
  const invitations = await prisma.invitation.findMany({
    where: {
      email: user.email.toLowerCase(),
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    include: {
      household: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invitations);
});

export const OPTIONS = withAuth(async (req: Request, userId: string) => {
  // OPTIONS handler for CORS preflight requests
  return new NextResponse(null, { status: 200 });
});
