import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await req.json().catch(() => ({}));
    const parsed = acceptInvitationSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { token: invitationToken } = parsed.data;

    // Find the invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token: invitationToken },
      include: {
        household: true,
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation token" }, { status: 404 });
    }

    // Check if invitation is still valid
    if (invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invitation has expired or been used" }, { status: 400 });
    }

    // Get the current user
    const user = await prisma.user.findUnique({
      where: { id: token.uid as string },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if the invitation email matches the user's email
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "This invitation is not for your email address" }, { status: 403 });
    }

    // Check if user is already a member of the household
    const existingMembership = await prisma.membership.findFirst({
      where: {
        userId: token.uid as string,
        householdId: invitation.householdId,
      },
    });

    if (existingMembership) {
      return NextResponse.json({ error: "You are already a member of this household" }, { status: 409 });
    }

    // Create membership and update invitation status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create membership
      const membership = await tx.membership.create({
        data: {
          userId: token.uid as string,
          householdId: invitation.householdId,
          role: "MEMBER",
        },
        include: {
          household: true,
          user: { select: { name: true, email: true } },
        },
      });

      // Update invitation status
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      });

      return membership;
    });

    return NextResponse.json({
      message: "Successfully joined the household",
      household: result.household,
      membership: {
        role: result.role,
        createdAt: result.createdAt,
      },
    });

  } catch (error) {
    console.error("Error accepting invitation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    // Find the invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        household: { select: { name: true } },
        invitedBy: { select: { name: true, email: true } },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation token" }, { status: 404 });
    }

    // Check if invitation is still valid
    if (invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
      return NextResponse.json({ 
        error: "Invitation has expired or been used",
        status: invitation.status,
        expired: invitation.expiresAt < new Date()
      }, { status: 400 });
    }

    return NextResponse.json({
      email: invitation.email,
      household: invitation.household,
      invitedBy: invitation.invitedBy,
      expiresAt: invitation.expiresAt,
    });

  } catch (error) {
    console.error("Error fetching invitation:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}