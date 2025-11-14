import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the current user's email
    const user = await prisma.user.findUnique({
      where: { id: token.uid },
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

  } catch (error) {
    console.error("Error fetching pending invitations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}